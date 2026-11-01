import pool from '../config/db.js';

/**
 * Role Controller
 *
 * Provides authenticated users access to standardized engineering job role
 * benchmarks and skill requirements for gap analysis and target career tracking.
 */

/**
 * GET /api/roles
 * Retrieves all available job roles and benchmark specifications.
 * Supports optional ?search query.
 */
export const getRoles = async (req, res) => {
  try {
    const search = req.query.search ? String(req.query.search).trim() : '';

    let query =
      'SELECT id, role_name, category, description, required_skills, created_at, updated_at FROM role_requirements';
    const params = [];

    if (search) {
      query += ' WHERE role_name LIKE ? OR description LIKE ? OR category LIKE ?';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY category ASC, role_name ASC';

    const [rows] = await pool.query(query, params);

    return res.status(200).json({
      success: true,
      data: {
        roles: rows.map((r) => ({
          id: r.id,
          roleName: r.role_name,
          category: r.category || 'Software Development',
          description: r.description,
          requiredSkills:
            typeof r.required_skills === 'string'
              ? JSON.parse(r.required_skills)
              : r.required_skills,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        })),
        total: rows.length,
      },
    });
  } catch (error) {
    console.error('[roleController getRoles Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve available engineering roles.',
    });
  }
};

/**
 * GET /api/roles/:id
 * Retrieves a single role specification by ID.
 */
export const getRoleById = async (req, res) => {
  try {
    const roleId = Number(req.params.id);
    if (!roleId || isNaN(roleId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role ID format.',
      });
    }

    const [rows] = await pool.query(
      'SELECT id, role_name, category, description, required_skills, created_at, updated_at FROM role_requirements WHERE id = ? LIMIT 1',
      [roleId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Job role not found.',
      });
    }

    const r = rows[0];
    return res.status(200).json({
      success: true,
      data: {
        role: {
          id: r.id,
          roleName: r.role_name,
          category: r.category || 'Software Development',
          description: r.description,
          requiredSkills:
            typeof r.required_skills === 'string'
              ? JSON.parse(r.required_skills)
              : r.required_skills,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        },
      },
    });
  } catch (error) {
    console.error('[roleController getRoleById Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve job role details.',
    });
  }
};

