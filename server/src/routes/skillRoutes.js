import express from 'express';
import { getUserSkills, getSkillEvidence } from '../controllers/skillController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// Enforce JWT authentication on all skill endpoints
router.use(authenticate);

// GET /api/skills              → Get all detected skills for the authenticated user
router.get('/', getUserSkills);

// GET /api/skills/:skillName   → Get granular evidence for a specific skill
router.get('/:skillName', getSkillEvidence);

export default router;
