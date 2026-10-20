import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

/**
 * Authentication Middleware
 * Reads the Bearer token from the Authorization header, verifies it,
 * checks that the user exists and is active, and attaches user info to req.user.
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. No Bearer token provided.',
      });
    }

    const token = authHeader.split(' ')[1];
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      console.error('[Auth Error]: JWT_SECRET is not configured.');
      return res.status(500).json({
        success: false,
        message: 'Internal server authentication configuration error.',
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired authentication token.',
      });
    }

    // Query MySQL to verify that user exists and is active
    const [rows] = await pool.query(
      'SELECT id, name, email, role, is_active FROM users WHERE id = ? LIMIT 1',
      [decoded.id]
    );

    if (!rows || rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User account not found.',
      });
    }

    const user = rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'User account is inactive. Please contact administrator.',
      });
    }

    // Attach user payload to request
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: Boolean(user.is_active),
    };

    next();
  } catch (error) {
    console.error('[Authentication Middleware Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication service encountered an unexpected error.',
    });
  }
};

/**
 * Role Authorization Middleware
 * Verifies that the authenticated user possesses one of the allowed roles (e.g. 'ADMIN').
 * Must be used AFTER the authenticate middleware.
 */
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. Role '${req.user.role}' lacks permission to access this resource.`,
      });
    }

    next();
  };
};

/**
 * Admin Authorization Middleware (Convenience Helper)
 * Strictly allows access only to users with role 'ADMIN'.
 */
export const requireAdmin = authorizeRoles('ADMIN');

/**
 * Resource Ownership or Admin Authorization Middleware
 * Ensures the authenticated user can only access their own private data
 * unless they possess the 'ADMIN' role. Prevents IDOR vulnerabilities.
 * @param {string} paramKey - The route parameter key containing the target user ID (defaults to 'id')
 */
export const requireSelfOrAdmin = (paramKey = 'id') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    const targetUserId = req.params?.[paramKey] || req.body?.[paramKey] || req.query?.[paramKey];

    // If targetUserId is not specified, proceed to next handler
    if (!targetUserId) {
      return next();
    }

    const isSelf = Number(req.user.id) === Number(targetUserId);
    const isAdmin = req.user.role === 'ADMIN';

    if (!isSelf && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Forbidden. You are not authorized to access another user's private data.",
      });
    }

    next();
  };
};
