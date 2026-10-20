import pool from '../config/db.js';

// ====================================================================
// 1. OVERVIEW STATISTICS
// ====================================================================

/**
 * GET /api/admin/stats
 * Overview platform metrics querying actual database records across tables.
 * Strict ADMIN access.
 */
export const getAdminStats = async (req, res) => {
  try {
    const [[userStats]] = await pool.query(`
      SELECT
        COUNT(*) AS totalUsers,
        SUM(CASE WHEN role = 'ADMIN' THEN 1 ELSE 0 END) AS adminUsers,
        SUM(CASE WHEN role = 'USER' THEN 1 ELSE 0 END) AS regularUsers,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS activeUsers,
        SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) AS inactiveUsers
      FROM users
    `);

    const [[{ repoCount }]] = await pool.query(
      'SELECT COUNT(*) AS repoCount FROM repositories'
    );

    const [[{ analysisCount }]] = await pool.query(
      'SELECT COUNT(*) AS analysisCount FROM analysis_snapshots'
    );

    const [[{ roleCount }]] = await pool.query(
      'SELECT COUNT(*) AS roleCount FROM role_requirements'
    );

    const [[{ templateCount }]] = await pool.query(
      'SELECT COUNT(*) AS templateCount FROM recommendation_templates'
    );

    return res.status(200).json({
      success: true,
      message: 'Overview statistics retrieved successfully.',
      data: {
        totalUsers: Number(userStats.totalUsers) || 0,
        activeUsers: Number(userStats.activeUsers) || 0,
        inactiveUsers: Number(userStats.inactiveUsers) || 0,
        adminUsers: Number(userStats.adminUsers) || 0,
        regularUsers: Number(userStats.regularUsers) || 0,
        repositoryCount: Number(repoCount) || 0,
        analysisCount: Number(analysisCount) || 0,
        jobRolesCount: Number(roleCount) || 0,
        recommendationTemplatesCount: Number(templateCount) || 0,
      },
    });
  } catch (error) {
    console.error('[Admin getAdminStats Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve platform overview statistics.',
    });
  }
};

// ====================================================================
// 2. USER MANAGEMENT
// ====================================================================

/**
 * GET /api/admin/users
 * Paginated and searchable list of registered users.
 * Supports pagination (page, limit) and filters (search, role, isActive).
 */
export const getAllUsers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;

    const search = req.query.search ? String(req.query.search).trim() : '';
    const role = req.query.role ? String(req.query.role).trim().toUpperCase() : '';
    const isActiveQuery = req.query.isActive !== undefined ? String(req.query.isActive).trim() : '';

    const allowedSortFields = {
      id: 'id',
      name: 'name',
      email: 'email',
      role: 'role',
      created_at: 'created_at',
      createdAt: 'created_at',
    };
    const sortBy = allowedSortFields[req.query.sortBy] || 'id';
    const sortOrder = req.query.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const conditions = [];
    const params = [];

    if (search) {
      conditions.push('(name LIKE ? OR email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (role === 'USER' || role === 'ADMIN') {
      conditions.push('role = ?');
      params.push(role);
    }

    if (isActiveQuery === 'true' || isActiveQuery === '1') {
      conditions.push('is_active = 1');
    } else if (isActiveQuery === 'false' || isActiveQuery === '0') {
      conditions.push('is_active = 0');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count matching records for pagination
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM users ${whereClause}`,
      params
    );

    // Fetch matching records (never select password_hash)
    const [rows] = await pool.query(
      `SELECT id, name, email, role, is_active, created_at, updated_at
       FROM users
       ${whereClause}
       ORDER BY ${sortBy} ${sortOrder}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.status(200).json({
      success: true,
      data: {
        users: rows.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          isActive: Boolean(u.is_active),
          createdAt: u.created_at,
          updatedAt: u.updated_at,
        })),
        pagination: {
          total: Number(total),
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (error) {
    console.error('[Admin getAllUsers Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve users roster.',
    });
  }
};

/**
 * GET /api/admin/users/:id
 * Retrieve detailed user account information, including linked repository and analysis counts.
 */
export const getAdminUserById = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!userId || isNaN(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID format.' });
    }

    const [rows] = await pool.query(
      'SELECT id, name, email, role, is_active, created_at, updated_at FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const u = rows[0];

    // Fetch user associations
    const [[{ repoCount }]] = await pool.query(
      'SELECT COUNT(*) AS repoCount FROM repositories WHERE user_id = ?',
      [userId]
    );

    const [[{ snapshotCount }]] = await pool.query(
      'SELECT COUNT(*) AS snapshotCount FROM analysis_snapshots WHERE user_id = ?',
      [userId]
    );

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          isActive: Boolean(u.is_active),
          createdAt: u.created_at,
          updatedAt: u.updated_at,
          repositoryCount: Number(repoCount) || 0,
          analysisSnapshotCount: Number(snapshotCount) || 0,
        },
      },
    });
  } catch (error) {
    console.error('[Admin getAdminUserById Error]:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to retrieve user details.' });
  }
};

/**
 * PATCH /api/admin/users/:id/status
 * Activates or deactivates a user account.
 * Guarded against self-deactivation and deactivating the last active administrator.
 */
export const updateUserStatus = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { isActive } = req.body;

    if (!userId || isNaN(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID format.' });
    }

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive boolean field is required.',
      });
    }

    // Rule: Prevent admin from disabling their own account
    if (userId === req.user.id && !isActive) {
      return res.status(400).json({
        success: false,
        message: 'Administrators cannot deactivate their own active account.',
      });
    }

    const [check] = await pool.query(
      'SELECT id, role, is_active FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    if (!check || check.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const targetUser = check[0];

    // Rule: Prevent deactivating the sole active administrator
    if (!isActive && targetUser.role === 'ADMIN' && targetUser.is_active) {
      const [[{ activeAdmins }]] = await pool.query(
        "SELECT COUNT(*) AS activeAdmins FROM users WHERE role = 'ADMIN' AND is_active = 1"
      );
      if (activeAdmins <= 1) {
        return res.status(400).json({
          success: false,
          message: "Cannot deactivate the system's sole active administrator.",
        });
      }
    }

    await pool.query('UPDATE users SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, userId]);

    return res.status(200).json({
      success: true,
      message: `User account has been successfully ${isActive ? 'activated' : 'deactivated'}.`,
      data: {
        id: userId,
        isActive,
      },
    });
  } catch (error) {
    console.error('[Admin updateUserStatus Error]:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to update user status.' });
  }
};

/**
 * PATCH /api/admin/users/:id/role
 * Updates a user role (USER <-> ADMIN).
 * Guarded against self-demotion and demoting the last active administrator.
 */
export const updateUserRole = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { role } = req.body;

    if (!userId || isNaN(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID format.' });
    }

    if (!role || !['USER', 'ADMIN'].includes(String(role).toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: "Role must be either 'USER' or 'ADMIN'.",
      });
    }

    const targetRole = String(role).toUpperCase();

    // Rule: Prevent admin from removing their own administrative access
    if (userId === req.user.id && targetRole !== 'ADMIN') {
      return res.status(400).json({
        success: false,
        message: 'Administrators cannot remove their own administrative privileges.',
      });
    }

    const [check] = await pool.query(
      'SELECT id, role, is_active FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    if (!check || check.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const targetUser = check[0];

    // Rule: Prevent demoting the sole active administrator
    if (targetRole === 'USER' && targetUser.role === 'ADMIN' && targetUser.is_active) {
      const [[{ activeAdmins }]] = await pool.query(
        "SELECT COUNT(*) AS activeAdmins FROM users WHERE role = 'ADMIN' AND is_active = 1"
      );
      if (activeAdmins <= 1) {
        return res.status(400).json({
          success: false,
          message: "Cannot demote the system's sole active administrator.",
        });
      }
    }

    await pool.query('UPDATE users SET role = ? WHERE id = ?', [targetRole, userId]);

    return res.status(200).json({
      success: true,
      message: `User role has been updated to ${targetRole}.`,
      data: {
        id: userId,
        role: targetRole,
      },
    });
  } catch (error) {
    console.error('[Admin updateUserRole Error]:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to update user role.' });
  }
};

// ====================================================================
// 3. JOB-ROLE MANAGEMENT
// ====================================================================

/**
 * GET /api/admin/roles
 * Lists all target job roles and skill benchmarks.
 * Supports optional ?search query.
 */
export const getAllJobRoles = async (req, res) => {
  try {
    const search = req.query.search ? String(req.query.search).trim() : '';

    let query = 'SELECT id, role_name, description, required_skills, created_at, updated_at FROM role_requirements';
    const params = [];

    if (search) {
      query += ' WHERE role_name LIKE ? OR description LIKE ?';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY role_name ASC';

    const [rows] = await pool.query(query, params);

    return res.status(200).json({
      success: true,
      data: {
        roles: rows.map((r) => ({
          id: r.id,
          roleName: r.role_name,
          description: r.description,
          requiredSkills: typeof r.required_skills === 'string' ? JSON.parse(r.required_skills) : r.required_skills,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        })),
        total: rows.length,
      },
    });
  } catch (error) {
    console.error('[Admin getAllJobRoles Error]:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to retrieve job roles.' });
  }
};

/**
 * GET /api/admin/roles/:id
 * Retrieve specific job role details by ID.
 */
export const getJobRoleById = async (req, res) => {
  try {
    const roleId = Number(req.params.id);
    if (!roleId || isNaN(roleId)) {
      return res.status(400).json({ success: false, message: 'Invalid role ID format.' });
    }

    const [rows] = await pool.query(
      'SELECT id, role_name, description, required_skills, created_at, updated_at FROM role_requirements WHERE id = ? LIMIT 1',
      [roleId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Job role not found.' });
    }

    const r = rows[0];
    return res.status(200).json({
      success: true,
      data: {
        role: {
          id: r.id,
          roleName: r.role_name,
          description: r.description,
          requiredSkills: typeof r.required_skills === 'string' ? JSON.parse(r.required_skills) : r.required_skills,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        },
      },
    });
  } catch (error) {
    console.error('[Admin getJobRoleById Error]:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to retrieve job role.' });
  }
};

/**
 * POST /api/admin/roles
 * Creates a new target job role with benchmarks and required skills JSON.
 */
export const createJobRole = async (req, res) => {
  try {
    const { roleName, description, requiredSkills } = req.body;

    if (!roleName || String(roleName).trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'roleName is required and must be at least 2 characters long.',
      });
    }

    const trimmedName = String(roleName).trim();

    if (!requiredSkills || (typeof requiredSkills !== 'object' && !Array.isArray(requiredSkills))) {
      return res.status(400).json({
        success: false,
        message: 'requiredSkills is required and must be an array or JSON object.',
      });
    }

    // Check for duplicate role name
    const [existing] = await pool.query(
      'SELECT id FROM role_requirements WHERE role_name = ? LIMIT 1',
      [trimmedName]
    );
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: `A job role with the name '${trimmedName}' already exists.`,
      });
    }

    const skillsJson = JSON.stringify(requiredSkills);

    const [result] = await pool.query(
      'INSERT INTO role_requirements (role_name, description, required_skills) VALUES (?, ?, ?)',
      [trimmedName, description ? String(description).trim() : null, skillsJson]
    );

    return res.status(201).json({
      success: true,
      message: 'Job role created successfully.',
      data: {
        role: {
          id: result.insertId,
          roleName: trimmedName,
          description: description || null,
          requiredSkills,
        },
      },
    });
  } catch (error) {
    console.error('[Admin createJobRole Error]:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to create job role.' });
  }
};

/**
 * PUT /api/admin/roles/:id
 * Updates an existing target job role and its required skills.
 */
export const updateJobRole = async (req, res) => {
  try {
    const roleId = Number(req.params.id);
    const { roleName, description, requiredSkills } = req.body;

    if (!roleId || isNaN(roleId)) {
      return res.status(400).json({ success: false, message: 'Invalid role ID format.' });
    }

    const [check] = await pool.query(
      'SELECT id, role_name, description, required_skills FROM role_requirements WHERE id = ? LIMIT 1',
      [roleId]
    );
    if (!check || check.length === 0) {
      return res.status(404).json({ success: false, message: 'Job role not found.' });
    }

    const currentRole = check[0];
    const newName = roleName !== undefined ? String(roleName).trim() : currentRole.role_name;
    const newDesc = description !== undefined ? (description ? String(description).trim() : null) : currentRole.description;

    let newSkills = currentRole.required_skills;
    if (requiredSkills !== undefined) {
      if (!requiredSkills || (typeof requiredSkills !== 'object' && !Array.isArray(requiredSkills))) {
        return res.status(400).json({
          success: false,
          message: 'requiredSkills must be a valid array or JSON object.',
        });
      }
      newSkills = JSON.stringify(requiredSkills);
    } else if (typeof newSkills === 'object') {
      newSkills = JSON.stringify(newSkills);
    }

    // Check duplicate if name changed
    if (newName !== currentRole.role_name) {
      const [duplicate] = await pool.query(
        'SELECT id FROM role_requirements WHERE role_name = ? AND id != ? LIMIT 1',
        [newName, roleId]
      );
      if (duplicate.length > 0) {
        return res.status(409).json({
          success: false,
          message: `Another job role with the name '${newName}' already exists.`,
        });
      }
    }

    await pool.query(
      'UPDATE role_requirements SET role_name = ?, description = ?, required_skills = ? WHERE id = ?',
      [newName, newDesc, newSkills, roleId]
    );

    return res.status(200).json({
      success: true,
      message: 'Job role updated successfully.',
      data: {
        role: {
          id: roleId,
          roleName: newName,
          description: newDesc,
          requiredSkills: typeof newSkills === 'string' ? JSON.parse(newSkills) : newSkills,
        },
      },
    });
  } catch (error) {
    console.error('[Admin updateJobRole Error]:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to update job role.' });
  }
};

/**
 * DELETE /api/admin/roles/:id
 * Deletes a target job role if not referenced by analysis snapshots.
 */
export const deleteJobRole = async (req, res) => {
  try {
    const roleId = Number(req.params.id);
    if (!roleId || isNaN(roleId)) {
      return res.status(400).json({ success: false, message: 'Invalid role ID format.' });
    }

    const [check] = await pool.query('SELECT id, role_name FROM role_requirements WHERE id = ? LIMIT 1', [roleId]);
    if (!check || check.length === 0) {
      return res.status(404).json({ success: false, message: 'Job role not found.' });
    }

    // Check if any analysis snapshots reference this role (Foreign Key RESTRICT protection)
    const [[{ snapshotRef }]] = await pool.query(
      'SELECT COUNT(*) AS snapshotRef FROM analysis_snapshots WHERE target_role_id = ?',
      [roleId]
    );

    if (snapshotRef > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete job role '${check[0].role_name}' because ${snapshotRef} analysis snapshot(s) reference it.`,
      });
    }

    await pool.query('DELETE FROM role_requirements WHERE id = ?', [roleId]);

    return res.status(200).json({
      success: true,
      message: `Job role '${check[0].role_name}' deleted successfully.`,
      data: { id: roleId },
    });
  } catch (error) {
    console.error('[Admin deleteJobRole Error]:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to delete job role.' });
  }
};

// ====================================================================
// 4. RECOMMENDATION TEMPLATES MANAGEMENT
// ====================================================================

/**
 * GET /api/admin/templates
 * Lists reusable learning recommendation templates.
 * Supports optional filtering by skillName, priority, or search term.
 */
export const getAllTemplates = async (req, res) => {
  try {
    const { skillName, priority, search } = req.query;

    let query = 'SELECT id, skill_name, title, description, resource_url, priority, created_at, updated_at FROM recommendation_templates';
    const conditions = [];
    const params = [];

    if (skillName) {
      conditions.push('skill_name = ?');
      params.push(String(skillName).trim());
    }

    if (priority && ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(String(priority).toUpperCase())) {
      conditions.push('priority = ?');
      params.push(String(priority).toUpperCase());
    }

    if (search) {
      conditions.push('(skill_name LIKE ? OR title LIKE ? OR description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY skill_name ASC, priority DESC, id ASC';

    const [rows] = await pool.query(query, params);

    return res.status(200).json({
      success: true,
      data: {
        templates: rows.map((t) => ({
          id: t.id,
          skillName: t.skill_name,
          title: t.title,
          description: t.description,
          resourceUrl: t.resource_url,
          priority: t.priority,
          createdAt: t.created_at,
          updatedAt: t.updated_at,
        })),
        total: rows.length,
      },
    });
  } catch (error) {
    console.error('[Admin getAllTemplates Error]:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to retrieve recommendation templates.' });
  }
};

/**
 * GET /api/admin/templates/:id
 * Retrieve a specific recommendation template by ID.
 */
export const getTemplateById = async (req, res) => {
  try {
    const templateId = Number(req.params.id);
    if (!templateId || isNaN(templateId)) {
      return res.status(400).json({ success: false, message: 'Invalid template ID format.' });
    }

    const [rows] = await pool.query(
      'SELECT id, skill_name, title, description, resource_url, priority, created_at, updated_at FROM recommendation_templates WHERE id = ? LIMIT 1',
      [templateId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Recommendation template not found.' });
    }

    const t = rows[0];
    return res.status(200).json({
      success: true,
      data: {
        template: {
          id: t.id,
          skillName: t.skill_name,
          title: t.title,
          description: t.description,
          resourceUrl: t.resource_url,
          priority: t.priority,
          createdAt: t.created_at,
          updatedAt: t.updated_at,
        },
      },
    });
  } catch (error) {
    console.error('[Admin getTemplateById Error]:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to retrieve template.' });
  }
};

/**
 * POST /api/admin/templates
 * Creates a reusable recommendation template.
 */
export const createTemplate = async (req, res) => {
  try {
    const { skillName, title, description, resourceUrl, priority } = req.body;

    if (!skillName || String(skillName).trim().length < 1) {
      return res.status(400).json({ success: false, message: 'skillName is required.' });
    }

    if (!title || String(title).trim().length < 2) {
      return res.status(400).json({ success: false, message: 'title is required and must be at least 2 characters.' });
    }

    if (!description || String(description).trim().length < 5) {
      return res.status(400).json({ success: false, message: 'description is required and must be at least 5 characters.' });
    }

    const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const assignedPriority = priority && validPriorities.includes(String(priority).toUpperCase())
      ? String(priority).toUpperCase()
      : 'MEDIUM';

    const trimmedSkill = String(skillName).trim();
    const trimmedTitle = String(title).trim();
    const trimmedDesc = String(description).trim();
    const trimmedUrl = resourceUrl ? String(resourceUrl).trim() : null;

    const [result] = await pool.query(
      'INSERT INTO recommendation_templates (skill_name, title, description, resource_url, priority) VALUES (?, ?, ?, ?, ?)',
      [trimmedSkill, trimmedTitle, trimmedDesc, trimmedUrl, assignedPriority]
    );

    return res.status(201).json({
      success: true,
      message: 'Recommendation template created successfully.',
      data: {
        template: {
          id: result.insertId,
          skillName: trimmedSkill,
          title: trimmedTitle,
          description: trimmedDesc,
          resourceUrl: trimmedUrl,
          priority: assignedPriority,
        },
      },
    });
  } catch (error) {
    console.error('[Admin createTemplate Error]:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to create recommendation template.' });
  }
};

/**
 * PUT /api/admin/templates/:id
 * Updates an existing recommendation template.
 */
export const updateTemplate = async (req, res) => {
  try {
    const templateId = Number(req.params.id);
    const { skillName, title, description, resourceUrl, priority } = req.body;

    if (!templateId || isNaN(templateId)) {
      return res.status(400).json({ success: false, message: 'Invalid template ID format.' });
    }

    const [check] = await pool.query(
      'SELECT id, skill_name, title, description, resource_url, priority FROM recommendation_templates WHERE id = ? LIMIT 1',
      [templateId]
    );
    if (!check || check.length === 0) {
      return res.status(404).json({ success: false, message: 'Recommendation template not found.' });
    }

    const current = check[0];
    const newSkill = skillName !== undefined ? String(skillName).trim() : current.skill_name;
    const newTitle = title !== undefined ? String(title).trim() : current.title;
    const newDesc = description !== undefined ? String(description).trim() : current.description;
    const newUrl = resourceUrl !== undefined ? (resourceUrl ? String(resourceUrl).trim() : null) : current.resource_url;

    let newPriority = current.priority;
    if (priority !== undefined) {
      const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      if (!validPriorities.includes(String(priority).toUpperCase())) {
        return res.status(400).json({
          success: false,
          message: "priority must be one of: 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'.",
        });
      }
      newPriority = String(priority).toUpperCase();
    }

    await pool.query(
      'UPDATE recommendation_templates SET skill_name = ?, title = ?, description = ?, resource_url = ?, priority = ? WHERE id = ?',
      [newSkill, newTitle, newDesc, newUrl, newPriority, templateId]
    );

    return res.status(200).json({
      success: true,
      message: 'Recommendation template updated successfully.',
      data: {
        template: {
          id: templateId,
          skillName: newSkill,
          title: newTitle,
          description: newDesc,
          resourceUrl: newUrl,
          priority: newPriority,
        },
      },
    });
  } catch (error) {
    console.error('[Admin updateTemplate Error]:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to update template.' });
  }
};

/**
 * DELETE /api/admin/templates/:id
 * Deletes a recommendation template.
 */
export const deleteTemplate = async (req, res) => {
  try {
    const templateId = Number(req.params.id);
    if (!templateId || isNaN(templateId)) {
      return res.status(400).json({ success: false, message: 'Invalid template ID format.' });
    }

    const [check] = await pool.query(
      'SELECT id, title FROM recommendation_templates WHERE id = ? LIMIT 1',
      [templateId]
    );
    if (!check || check.length === 0) {
      return res.status(404).json({ success: false, message: 'Recommendation template not found.' });
    }

    await pool.query('DELETE FROM recommendation_templates WHERE id = ?', [templateId]);

    return res.status(200).json({
      success: true,
      message: `Recommendation template '${check[0].title}' deleted successfully.`,
      data: { id: templateId },
    });
  } catch (error) {
    console.error('[Admin deleteTemplate Error]:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to delete template.' });
  }
};
