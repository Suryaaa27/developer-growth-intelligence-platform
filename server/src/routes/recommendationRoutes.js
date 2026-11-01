import express from 'express';
import { getRecommendations } from '../controllers/recommendationController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// Require authentication for all recommendation retrieval
router.use(authenticate);

// GET /api/recommendations
router.get('/', getRecommendations);

export default router;

