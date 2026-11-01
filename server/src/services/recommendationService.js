import pool from '../config/db.js';
import { isSkillMatch } from '../utils/skillMatcher.js';

/**
 * Retrieves curated recommendation templates matching a list of target skills.
 *
 * @param {string[]|string} skills - Array of skill names or comma-separated string
 * @param {Object} [options]
 * @param {number} [options.limit=50] - Maximum number of templates to return
 * @returns {Promise<Array>} Array of matching recommendation templates
 */
export const getRecommendationsForSkills = async (skills, options = {}) => {
  // Normalize skills parameter into a clean array of strings
  let skillList = [];
  if (Array.isArray(skills)) {
    skillList = skills.map((s) => String(s || '').trim()).filter(Boolean);
  } else if (typeof skills === 'string' && skills.trim()) {
    skillList = skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  if (skillList.length === 0) {
    return [];
  }

  const limit = Math.min(100, Math.max(1, Number(options.limit) || 50));

  // Query active recommendation templates from MySQL using prepared statement
  const [rows] = await pool.query(
    `SELECT id, skill_name, title, description, resource_url, priority, created_at, updated_at
     FROM recommendation_templates
     ORDER BY 
       CASE priority
         WHEN 'CRITICAL' THEN 1
         WHEN 'HIGH' THEN 2
         WHEN 'MEDIUM' THEN 3
         WHEN 'LOW' THEN 4
         ELSE 5
       END ASC,
       id ASC`
  );

  if (!rows || rows.length === 0) {
    return [];
  }

  // Filter templates matching any of the requested skills using robust skill matcher
  const matchedTemplates = [];
  const seenIds = new Set();

  for (const template of rows) {
    if (seenIds.has(template.id)) continue;

    const matchesSkill = skillList.some((targetSkill) =>
      isSkillMatch(targetSkill, template.skill_name)
    );

    if (matchesSkill) {
      seenIds.add(template.id);
      matchedTemplates.push({
        id: template.id,
        skillName: template.skill_name,
        title: template.title,
        description: template.description,
        resourceUrl: template.resource_url,
        priority: template.priority,
        createdAt: template.created_at,
        updatedAt: template.updated_at,
      });

      if (matchedTemplates.length >= limit) {
        break;
      }
    }
  }

  return matchedTemplates;
};

/**
 * Retrieves missing skills and matching recommendation templates for a given role and user.
 *
 * @param {number} userId - Authenticated user ID
 * @param {number|string} roleIdOrName - Target role ID or role name
 * @returns {Promise<{ role: Object, missingSkills: string[], recommendations: Array }>}
 */
export const getRecommendationsForUserRole = async (userId, roleIdOrName) => {
  if (!userId) {
    throw new Error('User ID is required.');
  }

  // 1. Fetch role requirements
  const [roleRows] = await pool.query(
    'SELECT id, role_name, category, description, required_skills FROM role_requirements WHERE id = ? OR role_name = ? LIMIT 1',
    [Number(roleIdOrName) || 0, String(roleIdOrName || '').trim()]
  );

  if (!roleRows || roleRows.length === 0) {
    return {
      role: null,
      missingSkills: [],
      recommendations: [],
    };
  }

  const role = roleRows[0];
  const rawSkills =
    typeof role.required_skills === 'string'
      ? JSON.parse(role.required_skills || '[]')
      : role.required_skills || [];

  const requiredSkillNames = rawSkills.map((s) => (typeof s === 'string' ? s : s.name));

  // 2. Fetch user's detected skill evidence from their scanned repositories
  const [evidenceRows] = await pool.query(
    `SELECT DISTINCT se.skill_name
     FROM skill_evidence se
     INNER JOIN repositories r ON se.repository_id = r.id
     WHERE r.user_id = ?`,
    [userId]
  );
  const detectedSkills = evidenceRows.map((e) => e.skill_name);

  // 3. Identify missing skills (no supporting repository evidence)
  const missingSkills = requiredSkillNames.filter(
    (reqSkill) => !detectedSkills.some((detSkill) => isSkillMatch(reqSkill, detSkill))
  );

  // 4. Fetch matching recommendation templates for missing skills
  const recommendations = await getRecommendationsForSkills(missingSkills);

  return {
    role: {
      id: role.id,
      roleName: role.role_name,
      category: role.category,
      description: role.description,
    },
    missingSkills,
    recommendations,
  };
};
