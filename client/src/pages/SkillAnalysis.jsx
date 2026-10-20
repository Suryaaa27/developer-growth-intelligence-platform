import { useState } from 'react';
import AppLayout from '../components/AppLayout';

/* ── Categorized Skills with Evidence & Verification Status ── */
const SKILL_CATEGORIES = [
  {
    category: 'Programming Languages',
    id: 'languages',
    skills: [
      {
        name: 'Java',
        level: 85,
        type: 'Verified Evidence',
        statusColor: 'green',
        evidenceSource: '4 repositories (ecommerce-backend, microservices-order, banking-engine, user-auth)',
        details: 'Active usage in core logic, OOP abstractions, Stream API, and multithreading constructs.',
      },
      {
        name: 'JavaScript',
        level: 65,
        type: 'Detected Evidence',
        statusColor: 'blue',
        evidenceSource: '1 repository (developer-portfolio-site)',
        details: 'Frontend React DOM rendering, event handling, and ES6 modular imports.',
      },
      {
        name: 'Python',
        level: 40,
        type: 'Detected Evidence',
        statusColor: 'blue',
        evidenceSource: '1 repository (data-pipeline-automation)',
        details: 'Data ingestion automation scripts and standard library file I/O operations.',
      },
    ],
  },
  {
    category: 'Frameworks',
    id: 'frameworks',
    skills: [
      {
        name: 'Spring Boot',
        level: 80,
        type: 'Verified Evidence',
        statusColor: 'green',
        evidenceSource: 'pom.xml manifests & Spring annotations across 3 services',
        details: '@RestController, @Service, @Autowired dependency injection, and JPA repository definitions.',
      },
      {
        name: 'Spring Security',
        level: 70,
        type: 'Verified Evidence',
        statusColor: 'green',
        evidenceSource: 'user-auth-microservice SecurityFilterChain configuration',
        details: 'JWT token signing, BCrypt password hashing, and role-based endpoint filters.',
      },
      {
        name: 'React',
        level: 60,
        type: 'Detected Evidence',
        statusColor: 'blue',
        evidenceSource: 'package.json in developer-portfolio-site',
        details: 'Functional components, hooks (useState, useEffect), and JSX markup composition.',
      },
    ],
  },
  {
    category: 'Databases & Persistence',
    id: 'databases',
    skills: [
      {
        name: 'PostgreSQL',
        level: 75,
        type: 'Verified Evidence',
        statusColor: 'green',
        evidenceSource: 'Schema DDL scripts & Spring Data JPA interfaces',
        details: 'Relational entity mappings, foreign key constraints, indexes, and parameterized queries.',
      },
      {
        name: 'Redis',
        level: 55,
        type: 'Detected Evidence',
        statusColor: 'blue',
        evidenceSource: 'application.yml configurations & caching decorators',
        details: 'Key-value cache eviction, token blacklisting, and session storage.',
      },
      {
        name: 'MongoDB',
        level: 30,
        type: 'Detected Evidence',
        statusColor: 'amber',
        evidenceSource: 'No direct repository evidence detected yet',
        details: 'Required for broad full-stack roles; recommend implementing in future projects.',
      },
    ],
  },
  {
    category: 'Architecture & Tools',
    id: 'tools',
    skills: [
      {
        name: 'RESTful API Design',
        level: 90,
        type: 'Verified Evidence',
        statusColor: 'green',
        evidenceSource: 'OpenAPI / Swagger specs & HTTP route definitions in 4 repos',
        details: 'Idempotent HTTP verbs (GET, POST, PUT, DELETE), JSON serialization, error payload standards.',
      },
      {
        name: 'Docker',
        level: 50,
        type: 'Detected Evidence',
        statusColor: 'blue',
        evidenceSource: 'Dockerfile & docker-compose.yml in microservices-order-service',
        details: 'Multi-stage container builds, network bridge orchestration, and port forwarding.',
      },
      {
        name: 'Maven & Gradle',
        level: 75,
        type: 'Verified Evidence',
        statusColor: 'green',
        evidenceSource: 'pom.xml and build.gradle manifest management',
        details: 'Dependency dependency management, plugins, compile targets, and packaging scripts.',
      },
    ],
  },
  {
    category: 'Testing & Quality',
    id: 'testing',
    skills: [
      {
        name: 'JUnit 5',
        level: 65,
        type: 'Verified Evidence',
        statusColor: 'green',
        evidenceSource: 'banking-transaction-engine /src/test directory',
        details: '@Test, @ParameterizedTest, assertions, and test fixture setup.',
      },
      {
        name: 'Mockito',
        level: 45,
        type: 'Detected Evidence',
        statusColor: 'amber',
        evidenceSource: 'Mock bean dependencies in 1 test suite',
        details: 'Mock injection, when/thenReturn stubbing for service isolation testing.',
      },
    ],
  },
];

const SkillAnalysis = () => {
  const [selectedTab, setSelectedTab] = useState('all');
  const [isLoading, setIsLoading] = useState(false);

  const filterCategories =
    selectedTab === 'all'
      ? SKILL_CATEGORIES
      : SKILL_CATEGORIES.filter((cat) => cat.id === selectedTab);

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 600);
  };

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <h1 className="page-header__title">Skill Analysis</h1>
            <p className="page-header__subtitle">
              Comprehensive technical skill evaluation detected from repository code signatures, AST analysis, and build manifests.
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="btn btn--secondary btn--sm"
            disabled={isLoading}
          >
            {isLoading ? 'Re-analyzing Evidence...' : 'Refresh Skill Analysis'}
          </button>
        </div>
      </div>

      {/* Distinction Explanation Banner */}
      <div
        className="card mb-6"
        style={{
          borderLeft: '4px solid var(--color-success)',
          backgroundColor: 'var(--color-surface)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
        }}
      >
        <span style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-md)', color: 'var(--color-text-primary)' }}>
          How Evidence & Proficiency are Evaluated:
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          <div>
            <strong style={{ color: 'var(--color-success)' }}>&bull; Verified Evidence:</strong> Found in active production source code, unit test suites, and operational configurations.
          </div>
          <div>
            <strong style={{ color: 'var(--color-accent)' }}>&bull; Detected Evidence:</strong> Found in dependencies, manifests, or exploratory scripts, awaiting deeper architectural verification.
          </div>
        </div>
      </div>

      {/* Category Tabs - GitHub underline style */}
      <div className="tab-bar mb-6" style={{ marginBottom: 0, marginTop: 'var(--space-5)' }}>
        <button
          onClick={() => setSelectedTab('all')}
          className={`tab-btn ${selectedTab === 'all' ? 'active' : ''}`}
        >
          All Categories
          <span className="tab-btn-count">14</span>
        </button>
        {SKILL_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedTab(cat.id)}
            className={`tab-btn ${selectedTab === cat.id ? 'active' : ''}`}
          >
            {cat.category}
            <span className="tab-btn-count">{cat.skills.length}</span>
          </button>
        ))}
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="card empty-state">
          <p className="empty-state__title">Scanning repository code trees...</p>
          <p className="empty-state__desc">Extracting AST patterns, dependency manifests, and test fixtures.</p>
        </div>
      ) : (
        /* Categorized Skill Tables & Cards */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
          {filterCategories.map((group) => (
            <section key={group.id} aria-labelledby={`sec-${group.id}`}>
              <div className="flex items-center justify-between mb-4">
                <h2 id={`sec-${group.id}`} className="section-heading" style={{ marginBottom: 0 }}>
                  {group.category}
                </h2>
                <span className="badge badge--neutral">{group.skills.length} competencies</span>
              </div>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '22%' }}>Skill Name</th>
                      <th style={{ width: '18%' }}>Proficiency Score</th>
                      <th style={{ width: '20%' }}>Verification Status</th>
                      <th style={{ width: '40%' }}>Detected Evidence Source & Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.skills.map((skill) => (
                      <tr key={skill.name}>
                        <td>
                          <span style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-base)', color: 'var(--color-text-primary)' }}>
                            {skill.name}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                            <div className="progress-bar" style={{ width: '100px', height: '8px' }}>
                              <div
                                className="progress-bar__fill"
                                style={{
                                  width: `${skill.level}%`,
                                  backgroundColor:
                                    skill.level >= 75
                                      ? 'var(--color-success)'
                                      : skill.level >= 45
                                      ? 'var(--color-accent)'
                                      : 'var(--color-warning)',
                                }}
                              />
                            </div>
                            <span style={{ fontWeight: 'var(--fw-bold)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
                              {skill.level}%
                            </span>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              skill.statusColor === 'green'
                                ? 'badge--green'
                                : skill.statusColor === 'blue'
                                ? 'badge--blue'
                                : 'badge--amber'
                            }`}
                          >
                            {skill.type}
                          </span>
                        </td>
                        <td>
                          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--color-text-primary)', marginBottom: '2px' }}>
                            {skill.evidenceSource}
                          </p>
                          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                            {skill.details}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </AppLayout>
  );
};

export default SkillAnalysis;
