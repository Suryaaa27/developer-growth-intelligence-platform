import express from 'express';
import { register, login, getMe } from '../controllers/authController.js';
import { initiateGitHubOAuth, handleGitHubCallback, disconnectGitHub } from '../controllers/githubAuthController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { loginLimiter, registerLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Public routes with dedicated IP rate limiting
router.post('/register', registerLimiter, register);
router.post('/login', loginLimiter, login);
router.get('/github/callback', handleGitHubCallback);

// Protected routes
router.get('/me', authenticate, getMe);
router.get('/github', authenticate, initiateGitHubOAuth);
router.post('/github/disconnect', authenticate, disconnectGitHub);

export default router;
