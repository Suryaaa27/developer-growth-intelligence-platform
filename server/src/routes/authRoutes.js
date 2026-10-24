import express from 'express';
import { register, login, getMe } from '../controllers/authController.js';
import { initiateGitHubOAuth, handleGitHubCallback } from '../controllers/githubAuthController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.get('/github/callback', handleGitHubCallback);

// Protected routes
router.get('/me', authenticate, getMe);
router.get('/github', authenticate, initiateGitHubOAuth);

export default router;
