import express from 'express';
import { runAnalysis, getSnapshots } from '../controllers/analysisController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// Enforce JWT authentication on all analysis endpoints
router.use(authenticate);

// POST /api/analysis/run → Run skill gap analysis for the authenticated user
router.post('/run', runAnalysis);

// GET /api/analysis/snapshots → Retrieve user's historical analysis snapshots
router.get('/snapshots', getSnapshots);

export default router;
