// API base URL — proxied to backend in development
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Generic fetch wrapper
const request = async (endpoint, options = {}) => {
  const token = sessionStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && !endpoint.startsWith('/auth/login') && !endpoint.startsWith('/auth/register')) {
      sessionStorage.removeItem('token');
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    // Build a rich error that preserves extra fields from the API response body
    // (e.g. retryAfter, retryGuidance, code) alongside the human-readable message.
    const err = new Error(data.message || 'API request failed');
    err.status = response.status;
    if (data.code) err.code = data.code;
    if (typeof data.retryAfter === 'number') err.retryAfter = data.retryAfter;
    if (data.retryGuidance) err.retryGuidance = data.retryGuidance;
    throw err;
  }
  return data;
};

// ── Auth ────────────────────────────────────────────────────
export const authAPI = {
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  getMe: () => request('/auth/me'),
  getGitHubAuthUrl: () => request('/auth/github?format=json'),
};

// ── Users (Ownership Protected) ─────────────────────────────
export const userAPI = {
  getUserById: (id) => request(`/users/${id}`),
};

// ── Admin (Role Protected: ADMIN only) ──────────────────────
export const adminAPI = {
  // Stats
  getStats: () => request('/admin/stats'),

  // Users
  getAllUsers: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/admin/users${query ? `?${query}` : ''}`);
  },
  getUserById: (id) => request(`/admin/users/${id}`),
  updateUserStatus: (id, isActive) =>
    request(`/admin/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    }),
  updateUserRole: (id, role) =>
    request(`/admin/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  // Target Job Roles
  getAllRoles: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/admin/roles${query ? `?${query}` : ''}`);
  },
  getRoleById: (id) => request(`/admin/roles/${id}`),
  createRole: (body) => request('/admin/roles', { method: 'POST', body: JSON.stringify(body) }),
  updateRole: (id, body) => request(`/admin/roles/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteRole: (id) => request(`/admin/roles/${id}`, { method: 'DELETE' }),

  // Recommendation Templates
  getAllTemplates: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/admin/templates${query ? `?${query}` : ''}`);
  },
  getTemplateById: (id) => request(`/admin/templates/${id}`),
  createTemplate: (body) => request('/admin/templates', { method: 'POST', body: JSON.stringify(body) }),
  updateTemplate: (id, body) => request(`/admin/templates/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteTemplate: (id) => request(`/admin/templates/${id}`, { method: 'DELETE' }),
};


// ── GitHub ──────────────────────────────────────────────────
export const githubAPI = {
  getRepos: () => request('/github/repos'),
  syncRepos: (body) => request('/github/sync', { method: 'POST', body: JSON.stringify(body) }),
};

// ── Skills ──────────────────────────────────────────────────
export const skillsAPI = {
  getUserSkills: () => request('/skills'),
  getSkillEvidence: (skillName) => request(`/skills/${encodeURIComponent(skillName)}`),
};

// ── Analysis ────────────────────────────────────────────────
export const analysisAPI = {
  runAnalysis: (body = {}) => request('/analysis/run', { method: 'POST', body: JSON.stringify(body) }),
  getSnapshots: () => request('/analysis/snapshots'),
};

// ── Roadmap ─────────────────────────────────────────────────
export const roadmapAPI = {
  getRoadmap: () => request('/roadmap'),
  getSkillRecommendations: (skillName) => request(`/roadmap/${skillName}`),
};

// ── Progress ────────────────────────────────────────────────
export const progressAPI = {
  getProgress: () => request('/progress'),
};
