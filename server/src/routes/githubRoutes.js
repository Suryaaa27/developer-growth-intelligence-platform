import express from 'express';
import { getRepos, syncRepos } from '../controllers/githubController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// Enforce JWT authentication on all GitHub endpoints
router.use(authenticate);

// GET /api/github/repos     → Fetch authenticated user's synchronized GitHub repos
router.get('/repos', getRepos);

// POST /api/github/sync     → Fetch public repos from GitHub and sync into database
router.post('/sync', syncRepos);

export default router;
