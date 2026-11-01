import pool from '../config/db.js';
import { isSkillMatch } from '../utils/skillMatcher.js';

/**
 * Curated documentation links for major technologies
 */
const RESOURCE_MAP = {
  java: 'https://docs.oracle.com/en/java/',
  'spring boot': 'https://spring.io/guides',
  javascript: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
  typescript: 'https://www.typescriptlang.org/docs/',
  react: 'https://react.dev/learn',
  'react native': 'https://reactnative.dev/docs/getting-started',
  python: 'https://docs.python.org/3/tutorial/',
  django: 'https://docs.djangoproject.com/',
  fastapi: 'https://fastapi.tiangolo.com/tutorial/',
  'c#': 'https://learn.microsoft.com/en-us/dotnet/csharp/',
  '.net': 'https://learn.microsoft.com/en-us/dotnet/',
  go: 'https://go.dev/doc/',
  docker: 'https://docs.docker.com/get-started/',
  kubernetes: 'https://kubernetes.io/docs/tutorials/',
  'github actions': 'https://docs.github.com/en/actions',
  postgresql: 'https://www.postgresql.org/docs/',
  mysql: 'https://dev.mysql.com/doc/',
  mongodb: 'https://www.mongodb.com/docs/',
  redis: 'https://redis.io/docs/',
  terraform: 'https://developer.hashicorp.com/terraform/tutorials',
  junit: 'https://junit.org/junit5/docs/current/user-guide/',
  jest: 'https://jestjs.io/docs/getting-started',
  playwright: 'https://playwright.dev/docs/intro',
  flutter: 'https://docs.flutter.dev/',
  swift: 'https://developer.apple.com/documentation/swift',
  kotlin: 'https://kotlinlang.org/docs/home.html',
};

const getResourceUrl = (skillName) => {
  const norm = (skillName || '').toLowerCase().trim();
  for (const [key, url] of Object.entries(RESOURCE_MAP)) {
    if (norm.includes(key)) return url;
  }
  return `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(skillName)}`;
};

const getDeliverable = (skillName, category) => {
  const cat = (category || '').toLowerCase();
  if (cat.includes('language')) {
    return `Clean implementation in ${skillName} demonstrating modern syntax, OOP/functional patterns, and error handling`;
  }
  if (cat.includes('framework')) {
    return `Modular web service or UI application built with ${skillName} and organized project structure`;
  }
  if (cat.includes('database')) {
    return `Schema definition, migrations, and repository queries using ${skillName}`;
  }
  if (cat.includes('ci/cd') || cat.includes('tool')) {
    return `Automated workflow configuration (e.g. .github/workflows or Dockerfile) verifying ${skillName}`;
  }
  if (cat.includes('testing')) {
    return `Comprehensive automated test suite using ${skillName} with unit/mock test coverage`;
  }
  return `Verified code artifact demonstrating practical ${skillName} capabilities`;
};

const slugify = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

/**
 * GET /api/roadmap
 * Returns the personalized, skill-aware learning roadmap for the authenticated user's target role.
 */
export const getRoadmap = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. User ID not found.',
      });
    }

    // 1. Fetch user's target role and target_role_id
    const [userRows] = await pool.query(
      'SELECT id, target_role, target_role_id FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    const user = userRows[0];
    if (!user || (!user.target_role && !user.target_role_id)) {
      return res.status(200).json({
        success: true,
        message: 'No primary target career role selected.',
        data: {
          targetRole: null,
          targetRoleId: null,
          roleUnavailable: false,
          stages: [],
          tasks: [],
          stats: {
            totalTasks: 0,
            completedTasks: 0,
            inProgressTasks: 0,
            completionPercentage: 0,
            evidenceDetectedCount: 0,
            needsLearningCount: 0,
          },
        },
      });
    }

    // 2. Fetch role requirements from database
    const [roleRows] = await pool.query(
      'SELECT id, role_name, category, description, required_skills FROM role_requirements WHERE id = ? OR role_name = ? LIMIT 1',
      [user.target_role_id || 0, user.target_role || '']
    );

    if (roleRows.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Your saved target career role is no longer available in the engineering catalog. Please select a new target role in your Profile.',
        data: {
          targetRole: user.target_role || null,
          targetRoleId: user.target_role_id || null,
          roleUnavailable: true,
          stages: [],
          tasks: [],
          stats: {
            totalTasks: 0,
            completedTasks: 0,
            inProgressTasks: 0,
            completionPercentage: 0,
            evidenceDetectedCount: 0,
            needsLearningCount: 0,
          },
        },
      });
    }

    const role = roleRows[0];
    const roleId = role.id;
    const roleName = role.role_name;

    const rawSkills =
      typeof role.required_skills === 'string'
        ? JSON.parse(role.required_skills || '[]')
        : role.required_skills || [];

    // 3. Fetch user's detected skill evidence from repositories
    const [evidenceRows] = await pool.query(
      `SELECT DISTINCT se.skill_name
       FROM skill_evidence se
       INNER JOIN repositories r ON se.repository_id = r.id
       WHERE r.user_id = ?`,
      [userId]
    );
    const detectedSkillNames = evidenceRows.map((r) => r.skill_name);

    // 4. Fetch persistent roadmap progress for this user and role
    const [progressRows] = await pool.query(
      'SELECT task_key, status, completed_at FROM user_roadmap_progress WHERE user_id = ? AND role_id = ?',
      [userId, roleId]
    );
    const progressMap = {};
    for (const p of progressRows) {
      progressMap[p.task_key] = {
        status: p.status,
        completedAt: p.completed_at,
      };
    }

    // 4b. Fetch admin-curated recommendation templates to enrich learning resources & guidance
    let templateRows = [];
    try {
      const [rows] = await pool.query(
        'SELECT id, skill_name, title, description, resource_url, priority FROM recommendation_templates'
      );
      templateRows = rows || [];
    } catch (tplErr) {
      console.warn('[roadmapController] Error fetching recommendation templates:', tplErr.message);
    }

    // 5. Generate roadmap tasks based on required skills
    const tasks = [];
    const seenTaskKeys = new Set();

    for (let index = 0; index < rawSkills.length; index++) {
      const skill = rawSkills[index];
      const skillName = typeof skill === 'string' ? skill : skill.name;
      const category = typeof skill === 'object' && skill.category ? skill.category : 'Core Technology';
      const benchmarkScore = typeof skill === 'object' && skill.benchmarkScore ? skill.benchmarkScore : 70;

      const taskKey = `task-${roleId}-${slugify(skillName)}`;
      if (seenTaskKeys.has(taskKey)) continue;
      seenTaskKeys.add(taskKey);

      // Check if evidence exists in user's scanned repositories
      const hasEvidence = detectedSkillNames.some((det) => isSkillMatch(skillName, det));
      const evidenceStatus = hasEvidence ? 'Evidence Detected' : 'Needs Learning';

      // Determine stage
      const catLower = category.toLowerCase();
      let stage = 'Core Technologies';
      if (catLower.includes('language') || index === 0) {
        stage = 'Foundations';
      } else if (
        catLower.includes('tool') ||
        catLower.includes('ci/cd') ||
        catLower.includes('testing') ||
        catLower.includes('security') ||
        catLower.includes('cloud') ||
        catLower.includes('architecture')
      ) {
        stage = 'Advanced Concepts';
      }

      // Priority calculation: boost missing skills that need learning
      let priority = benchmarkScore >= 80 ? 'Core' : benchmarkScore >= 65 ? 'High' : 'Medium';
      if (!hasEvidence && priority === 'Medium') {
        priority = 'High';
      }

      // Check persistent user progress (defaults to NOT_STARTED)
      const userProgress = progressMap[taskKey] || { status: 'NOT_STARTED', completedAt: null };
      const completed = userProgress.status === 'COMPLETED';

      // Match admin recommendation template if available
      const matchedTemplate = templateRows.find((tpl) => isSkillMatch(skillName, tpl.skill_name));
      const resourceUrl = (matchedTemplate && matchedTemplate.resource_url)
        ? matchedTemplate.resource_url
        : getResourceUrl(skillName);
      const learningGuidance = matchedTemplate
        ? {
            templateId: matchedTemplate.id,
            title: matchedTemplate.title,
            description: matchedTemplate.description,
            priority: matchedTemplate.priority,
            resourceUrl: matchedTemplate.resource_url,
          }
        : null;

      tasks.push({
        id: taskKey,
        roleId,
        skillName,
        title: `Master ${skillName} Competencies & Practical Architecture`,
        category,
        stage,
        priority,
        effort: benchmarkScore >= 80 ? '6-8 hours' : benchmarkScore >= 65 ? '4-6 hours' : '3-4 hours',
        description: `Deepen verified capabilities in ${skillName}. Focus on practical usage, design patterns, and clean code conventions for the ${roleName} track.`,
        deliverable: getDeliverable(skillName, category),
        resourceUrl,
        learningGuidance,
        evidenceStatus,
        status: userProgress.status,
        completed,
        completedAt: userProgress.completedAt,
      });
    }

    // 6. Add a Capstone / Practical Project task
    const projectTaskKey = `task-${roleId}-portfolio-project`;
    if (!seenTaskKeys.has(projectTaskKey)) {
      const projectProgress = progressMap[projectTaskKey] || { status: 'NOT_STARTED', completedAt: null };
      tasks.push({
        id: projectTaskKey,
        roleId,
        skillName: `${roleName} Capstone`,
        title: `Build & Deploy Production-Ready Portfolio Project for ${roleName}`,
        category: 'Project',
        stage: 'Practical Projects',
        priority: 'Core',
        effort: '12-16 hours',
        description: `Synthesize your learning by building an end-to-end repository with modular architecture, robust automated tests, containerization, and clear documentation.`,
        deliverable: `Public GitHub repository with comprehensive README, automated CI workflow, and running demonstration`,
        resourceUrl: 'https://github.com',
        evidenceStatus: detectedSkillNames.length >= 3 ? 'Evidence Detected' : 'Needs Learning',
        status: projectProgress.status,
        completed: projectProgress.status === 'COMPLETED',
        completedAt: projectProgress.completedAt,
      });
    }

    // 7. Group tasks into ordered stages
    const STAGE_ORDER = ['Foundations', 'Core Technologies', 'Advanced Concepts', 'Practical Projects'];
    const stages = STAGE_ORDER.map((stageName) => {
      const stageTasks = tasks.filter((t) => t.stage === stageName);
      const stageCompleted = stageTasks.filter((t) => t.completed).length;
      return {
        name: stageName,
        totalTasks: stageTasks.length,
        completedTasks: stageCompleted,
        tasks: stageTasks,
      };
    }).filter((s) => s.tasks.length > 0);

    // 8. Calculate overall summary statistics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.completed).length;
    const inProgressTasks = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const evidenceDetectedCount = tasks.filter((t) => t.evidenceStatus === 'Evidence Detected').length;
    const needsLearningCount = tasks.filter((t) => t.evidenceStatus === 'Needs Learning').length;

    return res.status(200).json({
      success: true,
      message: 'Learning roadmap retrieved successfully.',
      data: {
        targetRole: roleName,
        targetRoleId: roleId,
        category: role.category,
        description: role.description,
        stages,
        tasks,
        stats: {
          totalTasks,
          completedTasks,
          inProgressTasks,
          completionPercentage,
          evidenceDetectedCount,
          needsLearningCount,
        },
      },
    });
  } catch (error) {
    console.error('[Roadmap getRoadmap Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate personalized learning roadmap.',
    });
  }
};

/**
 * PATCH /api/roadmap/tasks/:taskKey
 * Updates persistent learning progress for a specific roadmap task.
 */
export const updateTaskProgress = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. User ID not found.',
      });
    }

    const { taskKey } = req.params;
    const { roleId, status } = req.body;

    if (!taskKey || !status) {
      return res.status(400).json({
        success: false,
        message: 'taskKey and status are required fields.',
      });
    }

    const validStatuses = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    // Determine target role ID if not provided in body
    let targetRoleId = Number(roleId);
    if (!targetRoleId || isNaN(targetRoleId)) {
      const [userRows] = await pool.query(
        'SELECT target_role_id FROM users WHERE id = ? LIMIT 1',
        [userId]
      );
      targetRoleId = userRows[0]?.target_role_id;
    }

    if (!targetRoleId) {
      return res.status(400).json({
        success: false,
        message: 'Target role ID could not be identified for progress tracking.',
      });
    }

    const completedAt = status === 'COMPLETED' ? new Date() : null;

    // Idempotent upsert into user_roadmap_progress
    await pool.query(
      `INSERT INTO user_roadmap_progress (user_id, role_id, task_key, status, completed_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         status = VALUES(status),
         completed_at = VALUES(completed_at),
         updated_at = NOW()`,
      [userId, targetRoleId, String(taskKey).trim(), status, completedAt]
    );

    return res.status(200).json({
      success: true,
      message: 'Task progress updated successfully.',
      data: {
        taskKey,
        roleId: targetRoleId,
        status,
        completedAt,
      },
    });
  } catch (error) {
    console.error('[Roadmap updateTaskProgress Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update roadmap task progress.',
    });
  }
};
