import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { skillsAPI, analysisAPI } from '../services/api';

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
  const [selectedRoleKey, setSelectedRoleKey] = useState('java-backend');

  // Live skills state from GET /api/skills
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisAlert, setAnalysisAlert] = useState(null);

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

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

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

  const selectedTrack = CAREER_TRACKS[selectedRoleKey] || CAREER_TRACKS['java-backend'];

  // Match live detected skills against the selected track competencies
  const competencyComparisons = useMemo(() => {
    return selectedTrack.competencies.map((comp) => {
      // Find matching skill from user's live detected skills
      const detected = skills.find((s) => {
        const sName = (s.skillName || '').toLowerCase();
        if (sName.includes(comp.matchKey)) return true;
        if (comp.altKeys && comp.altKeys.some((k) => sName.includes(k))) return true;
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

      return {
        ...comp,
        status: 'Missing Signal',
        statusClass: 'badge--amber',
        evidenceScore: 0,
        evidenceDetails: comp.recommendation,
        matched: false,
      };
    });
  }, [selectedTrack, skills]);

  const matchedCount = useMemo(() => {
    return competencyComparisons.filter((c) => c.matched).length;
  }, [competencyComparisons]);

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <h1 className="page-header__title">Skill Gaps Analysis</h1>
            <p className="page-header__subtitle">
              Benchmark observable repository evidence against standard industry career track competencies.
            </p>
          </div>
          <div className="flex items-center gap-3">
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
      </div>

      {/* Analysis Alert Banner */}
      {analysisAlert && (
        <div
          className="card mb-6"
          style={{
            borderColor: analysisAlert.type === 'success' ? 'var(--color-success)' : 'var(--color-danger, #f85149)',
            backgroundColor: analysisAlert.type === 'success' ? 'rgba(46,160,67,0.1)' : 'rgba(218,54,51,0.1)',
            padding: 'var(--space-3) var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 'var(--text-sm)' }}>{analysisAlert.message}</span>
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
      <div
        className="card mb-6"
        style={{
          borderLeft: '4px solid var(--color-accent)',
          backgroundColor: 'var(--color-surface)',
          padding: 'var(--space-5) var(--space-6)',
        }}
      >
        <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-1)' }}>
          <span className="badge badge--blue" style={{ textTransform: 'uppercase' }}>Evidence Transparency</span>
          <span style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-md)', color: 'var(--color-text-primary)' }}>
            About Role Readiness & Gaps
          </span>
        </div>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.6 }}>
          Automated algorithmic role-readiness scores are currently in development. Rather than fabricating
          arbitrary percentage ratings, DevGrowth benchmarks your <strong>actual verified GitHub repository evidence</strong> against
          standard technical requirements. A <em>Missing Signal</em> indicates no artifact was found in your scanned repositories — not
          a lack of developer ability.
        </p>
      </div>

      {/* Role Selector Controls */}
      <div className="card mb-6" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div style={{ flex: 1, minWidth: '260px' }}>
          <label htmlFor="role-select" className="form-label" style={{ marginBottom: 'var(--space-2)' }}>
            Benchmark Engineering Career Track:
          </label>
          <select
            id="role-select"
            className="form-select"
            value={selectedRoleKey}
            onChange={(e) => setSelectedRoleKey(e.target.value)}
            style={{ fontWeight: 'var(--fw-semibold)' }}
          >
            <option value="java-backend">Java Backend Developer Track</option>
            <option value="fullstack-javascript">Full Stack JavaScript Developer Track</option>
            <option value="devops-cloud">DevOps & Cloud Engineer Track</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: '2px', fontWeight: 'var(--fw-bold)' }}>
              Demonstrated Signals
            </p>
            <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--fw-bold)', color: 'var(--color-accent)', margin: 0 }}>
              {loading ? '–' : `${matchedCount} / ${competencyComparisons.length}`}
            </p>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
              Competencies with Observable Evidence
            </p>
          </div>
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
        <div className="card empty-state" style={{ padding: 'var(--space-8) var(--space-6)' }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4, marginBottom: 'var(--space-3)' }}>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
            <path d="M11 8v6" />
            <path d="M8 11h6" />
          </svg>
          <p className="empty-state__title">No Skill Evidence Detected Yet</p>
          <p className="empty-state__desc" style={{ maxWidth: '420px' }}>
            Synchronize your public GitHub repositories and click Run Skill Analysis to populate evidence across track competencies.
          </p>
          <div className="flex items-center gap-3 mt-4" style={{ justifyContent: 'center' }}>
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
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 id="gaps-table-heading" className="section-heading" style={{ marginBottom: '2px' }}>
                Required Competencies vs. Scanned Evidence
              </h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
                {selectedTrack.description}
              </p>
            </div>
            <span className="badge badge--neutral">{selectedTrack.competencies.length} track requirements</span>
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
                      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.5 }}>
                        {item.evidenceDetails}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </AppLayout>
  );
};

export default SkillGaps;
