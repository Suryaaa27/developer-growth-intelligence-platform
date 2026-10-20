import express from 'express';
import {
  // 1. Overview Statistics
  getAdminStats,

  // 2. User Management
  getAllUsers,
  getAdminUserById,
  updateUserStatus,
  updateUserRole,

  // 3. Job-Role Management
  getAllJobRoles,
  getJobRoleById,
  createJobRole,
  updateJobRole,
  deleteJobRole,

  // 4. Recommendation Templates Management
  getAllTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from '../controllers/adminController.js';
import { authenticate, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Enforce both JWT authentication and ADMIN role for the entire /api/admin namespace
router.use(authenticate, requireAdmin);

// ── 1. Overview Statistics ─────────────────────────────────────
router.get('/stats', getAdminStats);

// ── 2. User Management ─────────────────────────────────────────
router.get('/users', getAllUsers);
router.get('/users/:id', getAdminUserById);
router.patch('/users/:id/status', updateUserStatus);
router.patch('/users/:id/role', updateUserRole);

// ── 3. Target Job-Role Management ──────────────────────────────
router.get('/roles', getAllJobRoles);
router.get('/roles/:id', getJobRoleById);
router.post('/roles', createJobRole);
router.put('/roles/:id', updateJobRole);
router.delete('/roles/:id', deleteJobRole);

// ── 4. Recommendation Templates Management ─────────────────────
router.get('/templates', getAllTemplates);
router.get('/templates/:id', getTemplateById);
router.post('/templates', createTemplate);
router.put('/templates/:id', updateTemplate);
router.delete('/templates/:id', deleteTemplate);

export default router;
