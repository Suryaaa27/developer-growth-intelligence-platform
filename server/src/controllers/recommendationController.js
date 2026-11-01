import {
  getRecommendationsForSkills,
  getRecommendationsForUserRole,
} from '../services/recommendationService.js';

/**
 * GET /api/recommendations
 *
 * Retrieves admin-curated recommendation templates matching requested skills or
 * identified missing skills for an exploratory or target career role.
 *
 * Query params:
 *   - skills: comma-separated list of skill names (e.g. ?skills=Docker,React)
 *   - roleId: role requirements ID (e.g. ?roleId=1)
 *   - role: role name (e.g. ?role=Java%20Backend%20Developer)
 *   - limit: maximum recommendations to return (default 50)
 */
export const getRecommendations = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. User ID not found.',
      });
    }

    const { skills, roleId, role, limit } = req.query;

    // Mode 1: Role-based recommendation resolution (checks missing skills against user evidence)
    if (roleId || role) {
      const targetRole = roleId || role;
      const result = await getRecommendationsForUserRole(userId, targetRole);

      return res.status(200).json({
        success: true,
        message: 'Role-based recommendations retrieved successfully.',
        data: result.recommendations,
        role: result.role,
        missingSkills: result.missingSkills,
        recommendations: result.recommendations,
        count: result.recommendations.length,
      });
    }

    // Mode 2: Explicit skills query (e.g. ?skills=Docker,TypeScript)
    if (skills) {
      const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
      const recommendations = await getRecommendationsForSkills(skills, { limit: parsedLimit });

      return res.status(200).json({
        success: true,
        message: 'Recommendations retrieved successfully.',
        data: recommendations,
        recommendations,
        count: recommendations.length,
      });
    }

    // Mode 3: Neither provided — return empty result gracefully
    return res.status(200).json({
      success: true,
      message: 'No skills or role specified for recommendation matching.',
      data: [],
      recommendations: [],
      count: 0,
    });
  } catch (error) {
    console.error('[Recommendation getRecommendations Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve learning recommendations.',
    });
  }
};

