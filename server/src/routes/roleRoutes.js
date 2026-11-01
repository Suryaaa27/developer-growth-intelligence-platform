import express from 'express';
import { getRoles, getRoleById } from '../controllers/roleController.js';

const router = express.Router();

// GET /api/roles       → Get all available job roles (public catalog for registration & benchmarks)
router.get('/', getRoles);

// GET /api/roles/:id   → Get required skills for a specific role
router.get('/:id', getRoleById);

export default router;
