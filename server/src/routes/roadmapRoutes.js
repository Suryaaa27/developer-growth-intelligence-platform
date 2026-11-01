import express from 'express';
import { getRoadmap, updateTaskProgress } from '../controllers/roadmapController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// Enforce authentication on all learning roadmap routes
router.use(authenticate);

// GET   /api/roadmap                  → Retrieve personalized, skill-aware learning roadmap
router.get('/', getRoadmap);

// PATCH /api/roadmap/tasks/:taskKey   → Update task progress (NOT_STARTED | IN_PROGRESS | COMPLETED)
router.patch('/tasks/:taskKey', updateTaskProgress);

export default router;
