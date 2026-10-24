import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

/**
 * Generate a signed JWT token
 */
const generateToken = (id, role) => {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign({ id, role }, secret, { expiresIn });
};

/**
 * POST /api/auth/register
 * Registers a new user account with role USER.
 */
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 1. Input presence validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required fields.',
      });
    }

    const trimmedName = String(name).trim();
    const trimmedEmail = String(email).trim().toLowerCase();
    const trimmedPassword = String(password);

    if (trimmedName.length < 2 || trimmedName.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Name must be between 2 and 100 characters long.',
      });
    }

    // 2. Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.',
      });
    }

    // 3. Password policy: minimum 8 characters, at least 1 letter and 1 number
    if (trimmedPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.',
      });
    }

    // 4. Check for existing email in database
    const [existingUsers] = await pool.query(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [trimmedEmail]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    // 5. Hash password with bcryptjs (salt rounds = 10)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(trimmedPassword, salt);

    // 6. Insert new user into MySQL with role 'USER' explicitly enforced
    const [result] = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, is_active)
       VALUES (?, ?, ?, 'USER', TRUE)`,
      [trimmedName, trimmedEmail, passwordHash]
    );

    const newUserId = result.insertId;

    // 7. Generate JWT
    const token = generateToken(newUserId, 'USER');

    // 8. Return response (never return password_hash)
    return res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      data: {
        user: {
          id: newUserId,
          name: trimmedName,
          email: trimmedEmail,
          role: 'USER',
        },
        token,
      },
    });
  } catch (error) {
    console.error('[Register Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred during registration.',
    });
  }
};

/**
 * POST /api/auth/login
 * Authenticates user credentials and returns signed JWT token.
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const inputPassword = String(password);

    // 1. Fetch user by email
    const [rows] = await pool.query(
      'SELECT id, name, email, password_hash, role, is_active, github_id, github_username FROM users WHERE email = ? LIMIT 1',
      [trimmedEmail]
    );

    // Reject if user not found without disclosing email existence
    if (!rows || rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const user = rows[0];

    // 2. Reject if account is inactive
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'This account has been deactivated. Please contact support.',
      });
    }

    // 3. Verify password hash using bcryptjs
    const isPasswordValid = await bcrypt.compare(inputPassword, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // 4. Generate JWT
    const token = generateToken(user.id, user.role);

    // 5. Return success payload with safe user attributes
    return res.status(200).json({
      success: true,
      message: 'Authentication successful.',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          githubId: user.github_id ? Number(user.github_id) : null,
          githubUsername: user.github_username || null,
        },
        token,
      },
    });
  } catch (error) {
    console.error('[Login Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred during login.',
    });
  }
};

/**
 * GET /api/auth/me
 * Returns authenticated user's profile verified against MySQL.
 */
export const getMe = async (req, res) => {
  try {
    // req.user was populated and verified by authenticate middleware
    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
          githubId: req.user.githubId || null,
          githubUsername: req.user.githubUsername || null,
        },
      },
    });
  } catch (error) {
    console.error('[GetMe Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve user profile.',
    });
  }
};
