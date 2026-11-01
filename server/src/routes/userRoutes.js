
import express from 'express';
import { getUserById, updateUserTargetRole } from '../controllers/userController.js';
import { authenticate, requireSelfOrAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET /api/users/:id
// Accessible by the account owner (self) OR an ADMIN.
// Any attempt by a USER to access another user's ID is rejected with 403 Forbidden.
router.get('/:id', authenticate, requireSelfOrAdmin('id'), getUserById);

// PATCH /api/users/:id/target-role
// Updates the authenticated user's target engineering role.
// Accessible by self or ADMIN.
router.patch('/:id/target-role', authenticate, requireSelfOrAdmin('id'), updateUserTargetRole);

export default router;
