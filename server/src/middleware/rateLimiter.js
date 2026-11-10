import rateLimit from 'express-rate-limit';

/**
 * Production Rate Limiting Configuration
 *
 * Provides dedicated IP-based rate limiters for authentication endpoints:
 * - loginLimiter: Prevents brute-force credential stuffing and password guessing.
 * - registerLimiter: Prevents automated mass-account creation abuse.
 *
 * Security & Header Rules:
 * - standardHeaders: 'draft-7' (supplies RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset)
 * - legacyHeaders: false (disables legacy X-RateLimit-* headers)
 * - statusCode: 429 Too Many Requests
 * - Safe generic error message; does not log passwords or tokens.
 */

// Login Limiter: Default 10 requests per 15 minutes per IP
export const loginLimiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_LOGIN_WINDOW_MS
    ? Number(process.env.RATE_LIMIT_LOGIN_WINDOW_MS)
    : 15 * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_LOGIN_MAX
    ? Number(process.env.RATE_LIMIT_LOGIN_MAX)
    : 10, // 10 attempts
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  statusCode: 429,
  message: {
    success: false,
    message: 'Too many login attempts from this IP address. Please try again after 15 minutes.',
  },
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

// Registration Limiter: Default 5 requests per 15 minutes per IP
export const registerLimiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_REGISTER_WINDOW_MS
    ? Number(process.env.RATE_LIMIT_REGISTER_WINDOW_MS)
    : 15 * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_REGISTER_MAX
    ? Number(process.env.RATE_LIMIT_REGISTER_MAX)
    : 5, // 5 attempts
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  statusCode: 429,
  message: {
    success: false,
    message: 'Too many account creation attempts from this IP address. Please try again after 15 minutes.',
  },
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

