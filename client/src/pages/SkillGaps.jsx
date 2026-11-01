import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { InfoIcon } from '../components/icons';
import { skillsAPI, analysisAPI, rolesAPI, userAPI, recommendationsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const CATEGORY_ORDER = [
  'Software Development',
  'Mobile Development',
  'Data Engineering & AI',
  'DevOps & Cloud',
  'Cybersecurity',
  'QA & Testing',
  'Embedded & Systems',
  'Architecture & Specialized Engineering',
];

/**
 * Robust skill matcher comparing required role skill against detected repository skill.
 */
const isSkillMatchClient = (reqName, detName) => {
  if (!reqName || !detName) return false;
  const r = reqName.toLowerCase().trim();
  const d = detName.toLowerCase().trim();
  if (r === d) return true;

  const dBase = detName.replace(/\([^)]*\)/g, '').toLowerCase().trim();
  if (dBase && dBase === r) return true;

  const dTokens = d.split(/[\s,()/:&+-]+/).filter(Boolean);

  // Short tokens (<= 2 chars) must match exact token
  if (r.length <= 2) {
    return dTokens.includes(r);
  }

  // Compound requirements (e.g. 'PyTorch / TensorFlow', 'C#/.NET')
  if (r.includes('/') || r.includes('&')) {
    const parts = r.split(/[/&]/).map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      if (part.length <= 2) {
        if (dTokens.includes(part)) return true;
      } else if (d.includes(part) || (dBase && dBase.includes(part))) {
        return true;
      }
    }
  }

  if (d.includes(r) || (r.length >= 4 && dBase.includes(r))) return true;
  if (d.length >= 4 && r.includes(d)) return true;
  return false;
};

/* ── Standard Industry Career Track Benchmarks ── */
const CAREER_TRACKS = {
  'java-backend': {
    title: 'Java Backend Developer',
    description: 'Core microservices, relational persistence, Spring ecosystem, containerization, and automated testing.',
    competencies: [
      {
        name: 'Java (Core & Modern)',
        matchKey: 'java',
        category: 'Language',
        priority: 'Core',
        recommendation: 'Ensure clean OOP practices and modern Stream API usage in your repositories.',
      },
      {
        name: 'Spring Boot & Spring Framework',
        matchKey: 'spring',
        category: 'Framework',
        priority: 'Core',
        recommendation: 'Add Spring Boot starter dependencies (e.g. spring-boot-starter-web) to pom.xml.',
      },
      {
        name: 'Relational Database (PostgreSQL / MySQL)',
        matchKey: 'sql',
        altKeys: ['mysql', 'postgres', 'h2'],
        category: 'Database',
        priority: 'Core',
        recommendation: 'Include JPA entity relationships, JDBC drivers, or migration scripts.',
      },
      {
        name: 'Docker & Containerization',
        matchKey: 'docker',
        category: 'Tool',
        priority: 'High',
        recommendation: 'Add a Dockerfile or docker-compose.yml to verify container readiness.',
      },
      {
        name: 'Testing (JUnit / Mockito)',
        matchKey: 'junit',
        altKeys: ['mockito', 'test'],
        category: 'Tool',
        priority: 'High',
        recommendation: 'Add unit and mock test files using JUnit 5 and Mockito.',
      },
      {
        name: 'CI/CD Pipelines (GitHub Actions / Jenkins)',
        matchKey: 'github actions',
        altKeys: ['jenkins', 'ci/cd'],
        category: 'Tool',
        priority: 'Medium',
        recommendation: 'Add a .github/workflows/ci.yml or Jenkinsfile pipeline.',
      },
    ],
  },
  'fullstack-javascript': {
    title: 'Full Stack JavaScript Developer',
    description: 'Modern Node.js/Express APIs, React/Next.js single-page frontends, and database integrations.',
    competencies: [
      {
        name: 'JavaScript & TypeScript',
        matchKey: 'javascript',
        altKeys: ['typescript'],
        category: 'Language',
        priority: 'Core',
        recommendation: 'Demonstrate typed applications with tsconfig.json or modern ES6+ source.',
      },
      {
        name: 'React Ecosystem',
        matchKey: 'react',
        category: 'Framework',
        priority: 'Core',
        recommendation: 'Build interactive UI components with modern hooks and state management.',
      },
      {
        name: 'Node.js & Express.js',
        matchKey: 'express',
        altKeys: ['node'],
        category: 'Framework',
        priority: 'Core',
        recommendation: 'Implement RESTful endpoints and route middleware with Express.js.',
      },
      {
        name: 'Database (MongoDB / SQL)',
        matchKey: 'mongo',
        altKeys: ['prisma', 'mysql', 'postgres', 'database'],
        category: 'Database',
        priority: 'Core',
        recommendation: 'Include Mongoose schemas, Prisma client, or SQL queries in project repositories.',
      },
      {
        name: 'Testing (Jest / Vitest)',
        matchKey: 'jest',
        altKeys: ['vitest', 'cypress', 'testing'],
        category: 'Tool',
        priority: 'High',
        recommendation: 'Add automated unit or integration tests to package.json test scripts.',
      },
      {
        name: 'Build Tooling (Vite / Webpack)',
        matchKey: 'vite',
        altKeys: ['webpack', 'build'],
        category: 'Tool',
        priority: 'Medium',
        recommendation: 'Configure Vite, Webpack, or Rollup in project manifests.',
      },
    ],
  },
  'devops-cloud': {
    title: 'DevOps & Cloud Engineer',
    description: 'Infrastructure as Code, CI/CD pipelines, container orchestration, and cloud configurations.',
    competencies: [
      {
        name: 'Docker & Containerization',
        matchKey: 'docker',
        category: 'Tool',
        priority: 'Core',
        recommendation: 'Provide multi-stage Dockerfiles and container compose manifests.',
      },
      {
        name: 'CI/CD Automation',
        matchKey: 'github actions',
        altKeys: ['jenkins', 'ci/cd'],
        category: 'Tool',
        priority: 'Core',
        recommendation: 'Set up automated pull request validation and deployment pipelines.',
      },
      {
        name: 'Infrastructure as Code (Terraform / CloudFormation)',
        matchKey: 'terraform',
        altKeys: ['cloudformation', 'hcl'],
        category: 'Tool',
        priority: 'High',
        recommendation: 'Add Terraform (.tf) or cloud infrastructure templates.',
      },
      {
        name: 'Shell & Automation Scripting',
        matchKey: 'shell',
        altKeys: ['bash', 'powershell', 'python'],
        category: 'Language',
        priority: 'High',
        recommendation: 'Include utility automation scripts for environment provisioning.',
      },
    ],
  },
};

const SkillGaps = () => {
  const { user, updateUser } = useAuth();
  const [apiRoles, setApiRoles] = useState([]);
  const [selectedRoleKey, setSelectedRoleKey] = useState('java-backend');
  const [updatingRole, setUpdatingRole] = useState(false);
  const [roleUpdateMsg, setRoleUpdateMsg] = useState(null);

  // Live skills state from GET /api/skills
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisAlert, setAnalysisAlert] = useState(null);

  // Admin-curated recommendations state
  const [recommendations, setRecommendations] = useState([]);
  const [_recsLoading, setRecsLoading] = useState(false);

  // Fetch real skills from backend
  const fetchSkills = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await skillsAPI.getUserSkills();
      const rawList = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.data?.skills)
        ? response.data.skills
        : Array.isArray(response?.skills)
        ? response.skills
        : [];
      setSkills(rawList);
    } catch (err) {
      console.error('[SkillGaps fetch error]:', err);
      setLoadError(err.message || 'Unable to retrieve detected skill data.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch all engineering roles dynamically from database
  const fetchRoles = useCallback(async () => {
    try {
      const res = await rolesAPI.getAllRoles();
      if (res?.success && Array.isArray(res?.data?.roles) && res.data.roles.length > 0) {
        const rolesList = res.data.roles;
        setApiRoles(rolesList);
        setSelectedRoleKey((prev) => {
          // If user has a saved target role or targetRoleId, prioritize it
          if (user?.targetRoleId) {
            const matchById = rolesList.find((r) => r.id === user.targetRoleId);
            if (matchById) return matchById.id.toString();
          }
          if (user?.targetRole) {
            const matchByName = rolesList.find(
              (r) => r.roleName.toLowerCase() === user.targetRole.toLowerCase()
            );
            if (matchByName) return matchByName.id.toString();
          }
          const prevMatch = rolesList.find(
            (r) =>
              r.id.toString() === prev ||
              r.roleName.toLowerCase().replace(/[^a-z0-9]/g, '-') === prev ||
              (prev === 'java-backend' && r.roleName.includes('Java'))
          );
          return prevMatch ? prevMatch.id.toString() : rolesList[0].id.toString();
        });
      }
    } catch (err) {
      console.warn('[SkillGaps fetchRoles Warning]: Using built-in tracks fallback:', err.message);
    }
  }, [user?.targetRoleId, user?.targetRole]);

  useEffect(() => {
    fetchSkills();
    fetchRoles();
  }, [fetchSkills, fetchRoles]);

  // Group catalog roles into standardized categories
  const groupedRoles = useMemo(() => {
    const groups = {};
    for (const cat of CATEGORY_ORDER) {
      groups[cat] = [];
    }
    groups['Other Engineering Roles'] = [];

    for (const r of apiRoles) {
      const cat = r.category && groups[r.category] ? r.category : 'Other Engineering Roles';
      groups[cat].push(r);
    }

    return Object.entries(groups).filter(([, items]) => items.length > 0);
  }, [apiRoles]);

  // Check if currently selected role is the user's saved target role
  const isCurrentTargetRole = useMemo(() => {
    if (!user) return false;
    const activeRole = apiRoles.find((r) => r.id.toString() === selectedRoleKey.toString());
    if (!activeRole) return false;
    return (
      (user.targetRoleId && activeRole.id === user.targetRoleId) ||
      (user.targetRole && activeRole.roleName.toLowerCase() === user.targetRole.toLowerCase())
    );
  }, [user, apiRoles, selectedRoleKey]);

  // Save selected role as user's profile target role
  const handleSetTargetRole = async () => {
    const activeRole = apiRoles.find((r) => r.id.toString() === selectedRoleKey.toString());
    if (!activeRole || !user?.id) return;
    setUpdatingRole(true);
    setRoleUpdateMsg(null);
    try {
      const res = await userAPI.updateTargetRole(user.id, {
        targetRole: activeRole.roleName,
        targetRoleId: activeRole.id,
      });
      if (res?.success) {
        if (updateUser) {
          updateUser({ targetRole: activeRole.roleName, targetRoleId: activeRole.id });
        }
        setRoleUpdateMsg({ type: 'success', text: `Target role successfully updated to "${activeRole.roleName}"!` });
        setTimeout(() => setRoleUpdateMsg(null), 3500);
      } else {
        setRoleUpdateMsg({ type: 'error', text: res?.message || 'Failed to update target role.' });
      }
    } catch (err) {
      setRoleUpdateMsg({ type: 'error', text: err.message || 'Failed to update target role.' });
    } finally {
      setUpdatingRole(false);
    }
  };

  // Run on-demand skill analysis
  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisAlert(null);
    try {
      const response = await analysisAPI.runAnalysis();
      if (response?.success) {
        setAnalysisAlert({
          type: 'success',
          message: `Analysis completed: ${response.data?.evidenceCount || 0} evidence records analyzed.`,
        });
        await fetchSkills();
      } else {
        setAnalysisAlert({
          type: 'error',
          message: response?.message || 'Skill analysis failed.',
        });
      }
    } catch (err) {
      console.error('[SkillGaps runAnalysis error]:', err);
      setAnalysisAlert({
        type: 'error',
        message: err.message || 'Failed to trigger skill analysis.',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Derive selected track from API roles or fallback CAREER_TRACKS
  const selectedTrack = useMemo(() => {
    if (apiRoles.length > 0) {
      const found = apiRoles.find((r) => r.id.toString() === selectedRoleKey.toString());
      if (found) {
        const skillsList = Array.isArray(found.requiredSkills)
          ? found.requiredSkills
          : typeof found.requiredSkills === 'string'
          ? JSON.parse(found.requiredSkills || '[]')
          : [];

        return {
          id: found.id,
          title: found.roleName,
          description: found.description || 'Target engineering role specifications and benchmark requirements.',
          competencies: skillsList.map((s) => ({
            name: s.name,
            category: s.category || 'Skill',
            priority: (s.benchmarkScore || 70) >= 80 ? 'Core' : (s.benchmarkScore || 70) >= 65 ? 'High' : 'Medium',
            benchmarkScore: s.benchmarkScore || 70,
            recommendation: `Demonstrate ${s.name} in your repositories via package manifests, configuration files, or primary source code.`,
          })),
        };
      }
    }
    return CAREER_TRACKS[selectedRoleKey] || CAREER_TRACKS['java-backend'];
  }, [apiRoles, selectedRoleKey]);

  // Derive missing skill names from selectedTrack and detected skills
  const missingSkillNames = useMemo(() => {
    return (selectedTrack.competencies || [])
      .filter((comp) => {
        const detected = skills.some((s) => {
          if (isSkillMatchClient(comp.name, s.skillName)) return true;
          if (comp.matchKey) {
            const sName = (s.skillName || '').toLowerCase();
            if (sName.includes(comp.matchKey)) return true;
            if (comp.altKeys && comp.altKeys.some((k) => sName.includes(k))) return true;
          }
          return false;
        });
        return !detected;
      })
      .map((c) => c.name);
  }, [selectedTrack, skills]);

  const missingSkillsKey = missingSkillNames.join(',');

  // Fetch admin recommendation templates for missing skills
  useEffect(() => {
    let isCancelled = false;

    if (!missingSkillsKey) {
      setRecommendations([]);
      return;
    }

    const fetchRecommendations = async () => {
      setRecsLoading(true);
      try {
        const queryParams = {
          skills: missingSkillsKey,
        };
        if (selectedRoleKey && !isNaN(Number(selectedRoleKey))) {
          queryParams.roleId = selectedRoleKey;
        }
        const res = await recommendationsAPI.getRecommendations(queryParams);
        if (!isCancelled && res?.success) {
          const list = Array.isArray(res.data)
            ? res.data
            : Array.isArray(res?.data?.recommendations)
            ? res.data.recommendations
            : Array.isArray(res?.recommendations)
            ? res.recommendations
            : [];
          setRecommendations(list);
        }
      } catch (err) {
        console.warn('[SkillGaps fetchRecommendations Warning]:', err.message);
      } finally {
        if (!isCancelled) setRecsLoading(false);
      }
    };

    fetchRecommendations();
    return () => {
      isCancelled = true;
    };
  }, [missingSkillsKey, selectedRoleKey]);

  // Match live detected skills against the selected track competencies
  const competencyComparisons = useMemo(() => {
    return (selectedTrack.competencies || []).map((comp) => {
      // Find matching skill from user's live detected skills
      const detected = skills.find((s) => {
        if (isSkillMatchClient(comp.name, s.skillName)) return true;
        if (comp.matchKey) {
          const sName = (s.skillName || '').toLowerCase();
          if (sName.includes(comp.matchKey)) return true;
          if (comp.altKeys && comp.altKeys.some((k) => sName.includes(k))) return true;
        }
        return false;
      });

      if (detected) {
        return {
          ...comp,
          status: 'Evidence Found',
          statusClass: 'badge--green',
          evidenceScore: Math.round(detected.confidenceScore || 0),
          evidenceDetails: `Observable evidence detected in ${detected.repositoryCount} ${
            detected.repositoryCount === 1 ? 'repository' : 'repositories'
          } (${(detected.contributingRepositories || []).slice(0, 2).join(', ')}) via ${detected.evidenceType?.replace(/_/g, ' ') || 'code signals'}.`,
          matched: true,
        };
      }

      // Check if an admin recommendation template matches this missing competency
      const template = recommendations.find((r) => isSkillMatchClient(comp.name, r.skillName || r.skill_name));

      return {
        ...comp,
        status: 'Missing Signal',
        statusClass: 'badge--amber',
        evidenceScore: 0,
        evidenceDetails: template ? template.description : comp.recommendation,
        template: template || null,
        matched: false,
      };
    });
  }, [selectedTrack, skills, recommendations]);

  const matchedCount = useMemo(() => {
    return competencyComparisons.filter((c) => c.matched).length;
  }, [competencyComparisons]);

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header__content">
          <h1 className="page-header__title">Skill Gaps Analysis</h1>
          <p className="page-header__subtitle">
            Benchmark observable repository evidence against standard industry career track competencies.
          </p>
        </div>
        <div className="page-header__actions">
          <button
            type="button"
            onClick={handleRunAnalysis}
            disabled={isAnalyzing || loading}
            className="btn btn--primary btn--sm"
          >
            {isAnalyzing ? 'Analyzing...' : 'Run Skill Analysis'}
          </button>
          <Link to="/skills" className="btn btn--secondary btn--sm">
            Full Evidence →
          </Link>
        </div>
      </div>

      {/* Analysis Alert Banner */}
      {analysisAlert && (
        <div
          className="card mb-6 alert-banner"
          style={{
            borderColor: analysisAlert.type === 'success' ? 'var(--color-success)' : 'var(--color-danger, #f85149)',
            backgroundColor: analysisAlert.type === 'success' ? 'rgba(46,160,67,0.1)' : 'rgba(218,54,51,0.1)',
            padding: 'var(--space-3) var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '15px' }}>{analysisAlert.message}</span>
          <button
            type="button"
            onClick={() => setAnalysisAlert(null)}
            className="btn btn--secondary btn--sm"
            style={{ padding: '2px 8px', fontSize: 'var(--text-xs)' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Data Transparency Banner */}
      <div className="callout-banner callout-banner--info mb-6">
        <div className="callout-banner__left">
          <div className="callout-banner__title-row">
            <InfoIcon size={16} style={{ color: 'var(--color-link)' }} />
            <span className="badge badge--blue" style={{ textTransform: 'uppercase' }}>Evidence Transparency</span>
            <span className="callout-banner__title">
              About Role Readiness & Gaps
            </span>
          </div>
          <p className="callout-banner__desc" style={{ maxWidth: '100ch' }}>
            Automated algorithmic role-readiness scores are currently in development. Rather than fabricating
            arbitrary percentage ratings, DevGrowth benchmarks your <strong>actual verified GitHub repository evidence</strong> against
            standard technical requirements. A <em>Missing Signal</em> indicates no artifact was found in your scanned repositories — not
            a lack of developer ability.
          </p>
        </div>
      </div>

      {/* Role Selector Controls */}
      <div className="card track-benchmark-card mb-6">
        <div className="track-benchmark-card__left">
          <div className="track-benchmark-card__top-row">
            <label htmlFor="role-select" className="form-label" style={{ margin: 0 }}>
              Benchmark Engineering Career Track:
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isCurrentTargetRole ? (
                <span className="badge badge--green">
                  ✓ My Target Role
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleSetTargetRole}
                  disabled={updatingRole || !user}
                  className="btn btn--secondary btn--sm"
                  title="Save this role as your profile target role"
                >
                  {updatingRole ? 'Updating...' : 'Set as My Target Role'}
                </button>
              )}
              <Link
                to="/profile"
                style={{ fontSize: '13px', color: 'var(--color-link)', textDecoration: 'none' }}
                title="Manage persistent career target in Profile"
              >
                Profile Settings →
              </Link>
            </div>
          </div>

          <select
            id="role-select"
            className="form-select"
            value={selectedRoleKey}
            onChange={(e) => setSelectedRoleKey(e.target.value)}
            style={{ fontWeight: 600 }}
          >
            {groupedRoles.length > 0 ? (
              groupedRoles.map(([category, items]) => (
                <optgroup key={category} label={category}>
                  {items.map((r) => (
                    <option key={r.id} value={r.id.toString()}>
                      {r.roleName}
                    </option>
                  ))}
                </optgroup>
              ))
            ) : apiRoles.length > 0 ? (
              apiRoles.map((r) => (
                <option key={r.id} value={r.id.toString()}>
                  {r.roleName}
                </option>
              ))
            ) : (
              <>
                <option value="java-backend">Java Backend Developer Track</option>
                <option value="fullstack-javascript">Full Stack JavaScript Developer Track</option>
                <option value="devops-cloud">DevOps & Cloud Engineer Track</option>
              </>
            )}
          </select>

          {roleUpdateMsg && (
            <p
              style={{
                marginTop: '8px',
                marginBottom: 0,
                fontSize: '13px',
                color: roleUpdateMsg.type === 'success' ? 'var(--color-success)' : 'var(--color-danger, #f85149)',
                fontWeight: 500,
              }}
            >
              {roleUpdateMsg.text}
            </p>
          )}
        </div>

        <div className="track-benchmark-card__right-panel">
          <p className="track-benchmark-card__signals-label">
            Demonstrated Signals
          </p>
          <p className="track-benchmark-card__signals-value">
            {loading ? '–' : `${matchedCount} / ${competencyComparisons.length}`}
          </p>
          <p className="track-benchmark-card__signals-caption">
            Competencies with Observable Evidence
          </p>
        </div>
      </div>

      {/* Load Error Banner */}
      {loadError && (
        <div
          className="card mb-6"
          style={{
            backgroundColor: 'rgba(218, 54, 51, 0.1)',
            borderColor: 'rgba(218, 54, 51, 0.3)',
            color: 'var(--color-text-primary)',
            padding: 'var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <p style={{ margin: 0, fontWeight: 'var(--fw-semibold)', color: 'var(--color-danger, #f85149)' }}>
              Failed to load skill evidence
            </p>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
              {loadError}
            </p>
          </div>
          <button type="button" onClick={fetchSkills} className="btn btn--secondary btn--sm">
            Retry Loading
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="card" style={{ opacity: 0.6, padding: 'var(--space-6)' }}>
          <div style={{ height: '24px', width: '35%', backgroundColor: 'var(--color-surface-2)', borderRadius: '4px', marginBottom: '16px' }} />
          <div style={{ height: '14px', width: '75%', backgroundColor: 'var(--color-surface-2)', borderRadius: '4px', marginBottom: '12px' }} />
          <div style={{ height: '14px', width: '60%', backgroundColor: 'var(--color-surface-2)', borderRadius: '4px' }} />
        </div>
      )}

      {/* Empty State when no skills detected */}
      {!loading && !loadError && skills.length === 0 && (
        <div className="empty-state">
          <div className="empty-state__icon">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
              <path d="M11 8v6" />
              <path d="M8 11h6" />
            </svg>
          </div>
          <p className="empty-state__title">No Skill Evidence Detected Yet</p>
          <p className="empty-state__desc">
            Synchronize your public GitHub repositories and click Run Skill Analysis to populate evidence across track competencies.
          </p>
          <div className="empty-state__actions">
            <button
              type="button"
              onClick={handleRunAnalysis}
              disabled={isAnalyzing}
              className="btn btn--primary btn--sm"
            >
              {isAnalyzing ? 'Analyzing...' : 'Run Skill Analysis'}
            </button>
            <Link to="/repositories" className="btn btn--secondary btn--sm">
              Manage Repositories
            </Link>
          </div>
        </div>
      )}

      {/* Skill Comparison Table */}
      {!loading && !loadError && skills.length > 0 && (
        <section aria-labelledby="gaps-table-heading">
          <div className="section-header">
            <div className="section-header__content">
              <h2 id="gaps-table-heading" className="section-heading">
                Required Competencies vs. Scanned Evidence
              </h2>
              <p className="section-subtitle">
                {selectedTrack.description}
              </p>
            </div>
            <div className="section-header__actions">
              <span className="badge badge--neutral">{selectedTrack.competencies.length} track requirements</span>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>Competency Requirement</th>
                  <th style={{ width: '12%' }}>Category</th>
                  <th style={{ width: '14%' }}>Evidence Signal</th>
                  <th style={{ width: '12%' }}>Status</th>
                  <th style={{ width: '10%' }}>Priority</th>
                  <th style={{ width: '30%' }}>Observable Artifacts & Guidance</th>
                </tr>
              </thead>
              <tbody>
                {competencyComparisons.map((item) => (
                  <tr key={item.name}>
                    <td>
                      <span style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-base)', color: 'var(--color-text-primary)' }}>
                        {item.name}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge--neutral" style={{ fontSize: 'var(--text-xs)' }}>
                        {item.category}
                      </span>
                    </td>
                    <td>
                      {item.matched ? (
                        <span style={{ fontWeight: 'var(--fw-bold)', color: 'var(--color-success)' }}>
                          {item.evidenceScore}% Strength
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                          No Signal (0%)
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${item.statusClass}`}>
                        {item.status}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          item.priority === 'Core'
                            ? 'badge--neutral'
                            : item.priority === 'High'
                            ? 'badge--amber'
                            : 'badge--neutral'
                        }`}
                      >
                        {item.priority}
                      </span>
                    </td>
                    <td>
                      {item.matched ? (
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.5 }}>
                          {item.evidenceDetails}
                        </p>
                      ) : item.template ? (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '4px' }}>
                            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-bold)', color: 'var(--color-accent)' }}>
                              {item.template.title}
                            </span>
                            {item.template.priority && (
                              <span className="badge badge--neutral" style={{ fontSize: '10px', padding: '1px 5px' }}>
                                {item.template.priority}
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: '0 0 6px 0', lineHeight: 1.4 }}>
                            {item.template.description}
                          </p>
                          {item.template.resourceUrl && (
                            <a
                              href={item.template.resourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn--secondary btn--sm"
                              style={{ padding: '2px 8px', fontSize: '11px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              Curated Guide ↗
                            </a>
                          )}
                        </div>
                      ) : (
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.5 }}>
                          {item.evidenceDetails}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Admin Recommendations Section */}
          {recommendations.length > 0 && (
            <div className="card mt-6" style={{ padding: 'var(--space-5)' }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--fw-bold)', margin: '0 0 2px 0' }}>
                    Curated Learning Recommendations for Missing Gaps
                  </h3>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                    Official administrator-curated guides, best practices, and learning resources mapped directly to your detected gaps.
                  </p>
                </div>
                <Link to="/roadmap" className="btn btn--secondary btn--sm">
                  View Roadmap →
                </Link>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
                {recommendations.map((rec) => (
                  <div
                    key={rec.id || rec.skillName}
                    style={{
                      padding: 'var(--space-4)',
                      backgroundColor: 'var(--color-surface-2)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="badge badge--blue" style={{ fontSize: '11px' }}>
                          {rec.skillName}
                        </span>
                        {rec.priority && (
                          <span
                            className={`badge ${
                              rec.priority === 'CRITICAL'
                                ? 'badge--danger'
                                : rec.priority === 'HIGH'
                                ? 'badge--amber'
                                : 'badge--neutral'
                            }`}
                            style={{ fontSize: '10px' }}
                          >
                            {rec.priority}
                          </span>
                        )}
                      </div>
                      <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', margin: '0 0 var(--space-2) 0' }}>
                        {rec.title}
                      </h4>
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.4 }}>
                        {rec.description}
                      </p>
                    </div>

                    {rec.resourceUrl && (
                      <div className="mt-3" style={{ paddingTop: 'var(--space-2)', borderTop: '1px solid var(--color-border)' }}>
                        <a
                          href={rec.resourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn--primary btn--sm"
                          style={{ width: '100%', justifyContent: 'center', textDecoration: 'none', fontSize: '11px', padding: '4px 8px' }}
                        >
                          Access Guide & Docs ↗
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </AppLayout>
  );
};

export default SkillGaps;
