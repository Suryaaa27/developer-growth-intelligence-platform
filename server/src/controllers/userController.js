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
      'SELECT id, name, email, role, is_active, created_at, updated_at FROM users WHERE id = ? LIMIT 1',
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
