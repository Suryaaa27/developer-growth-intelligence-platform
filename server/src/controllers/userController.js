import pool from '../config/db.js';

/**
 * GET /api/users/:id
 * Retrieves profile of a specific user.
 * Protected by authenticate and requireSelfOrAdmin('id') so users cannot access
 * other users' private records by tampering with the URL ID parameter.
 */
export const getUserById = async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (!userId || isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format.',
      });
    }

    const [rows] = await pool.query(
      'SELECT id, name, email, role, target_role, target_role_id, is_active, created_at, updated_at FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    const user = rows[0];

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          targetRole: user.target_role || null,
          targetRoleId: user.target_role_id || null,
          isActive: Boolean(user.is_active),
          createdAt: user.created_at,
          updatedAt: user.updated_at,
        },
      },
    });
  } catch (error) {
    console.error('[GetUserById Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve user profile.',
    });
  }
};

/**
 * PATCH /api/users/:id/target-role
 * Updates the target engineering role for the user.
 * Protected by authenticate and requireSelfOrAdmin('id').
 */
export const updateUserTargetRole = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!userId || isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format.',
      });
    }

    const { targetRole, targetRoleId } = req.body;
    if (!targetRole && !targetRoleId) {
      return res.status(400).json({
        success: false,
        message: 'targetRole or targetRoleId is required.',
      });
    }

    // Validate that the role exists in role_requirements
    let matchedRole = null;
    if (targetRoleId) {
      const [rows] = await pool.query(
        'SELECT id, role_name FROM role_requirements WHERE id = ? LIMIT 1',
        [Number(targetRoleId)]
      );
      if (rows.length > 0) matchedRole = rows[0];
    }

    if (!matchedRole && targetRole) {
      const [rows] = await pool.query(
        'SELECT id, role_name FROM role_requirements WHERE role_name = ? OR id = ? LIMIT 1',
        [String(targetRole).trim(), Number(targetRole) || 0]
      );
      if (rows.length > 0) matchedRole = rows[0];
    }

    if (!matchedRole) {
      return res.status(400).json({
        success: false,
        message: 'Selected role does not exist in engineering role catalog.',
      });
    }

    await pool.query(
      'UPDATE users SET target_role = ?, target_role_id = ?, updated_at = NOW() WHERE id = ?',
      [matchedRole.role_name, matchedRole.id, userId]
    );

    return res.status(200).json({
      success: true,
      message: 'Target role updated successfully.',
      data: {
        targetRole: matchedRole.role_name,
        targetRoleId: matchedRole.id,
      },
    });
  } catch (error) {
    console.error('[UpdateUserTargetRole Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to update user target role.',
    });
  }
};
