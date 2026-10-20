import AppLayout from '../components/AppLayout';

/* ── Clearly Identified Demonstration Snapshots ── */
const MOCK_SNAPSHOTS = [
  {
    id: 'snap-4',
    date: '12 Oct 2026 (Latest)',
    reposAnalyzed: 8,
    skillsDetected: 14,
    readinessScore: 68,
    keyChanges: 'Added Spring Security JWT authentication and JUnit 5 unit test suites in banking service.',
  },
  {
    id: 'snap-3',
    date: '28 Sep 2026',
    reposAnalyzed: 7,
    skillsDetected: 12,
    readinessScore: 61,
    keyChanges: 'Refactored microservices-order-service to use Spring Cloud and Docker Compose.',
  },
  {
    id: 'snap-2',
    date: '15 Sep 2026',
    reposAnalyzed: 6,
    skillsDetected: 10,
    readinessScore: 54,
    keyChanges: 'Introduced PostgreSQL relational schemas and JPA automated repositories.',
  },
  {
    id: 'snap-1',
    date: '01 Sep 2026',
    reposAnalyzed: 4,
    skillsDetected: 7,
    readinessScore: 45,
    keyChanges: 'Initial baseline repository synchronization and Java syntax AST scan.',
  },
];

const COMPLETED_MILESTONES = [
  {
    date: '10 Oct 2026',
    title: 'Containerized Spring Boot microservice with multi-stage Dockerfile',
    impact: '+7% readiness improvement',
  },
  {
    date: '26 Sep 2026',
    title: 'Configured Redis caching annotations in ecommerce-backend-api',
    impact: '+5% readiness improvement',
  },
  {
    date: '12 Sep 2026',
    title: 'Integrated Spring Data JPA entity relationships & repository tests',
    impact: '+9% readiness improvement',
  },
];

const ProgressHistory = () => {
  return (
    <AppLayout>
      {/* Page Header */}
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <h1 className="page-header__title">Progress History</h1>
            <p className="page-header__subtitle">
              Historical record of your code analysis snapshots, role readiness trends, and completed learning milestones.
            </p>
          </div>
          <span className="badge badge--neutral">
            Showing Sample Demonstration Data
          </span>
        </div>
      </div>

      {/* Readiness Trend Visualization Card */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="section-heading" style={{ marginBottom: '2px' }}>
              Readiness Score Evolution Over Time
            </h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
              Benchmarked against the Java Backend Developer core role requirements.
            </p>
          </div>
          <span className="badge badge--green">+23% Growth Since Sep 2026</span>
        </div>

        {/* CSS-based Bar Trend Visualization */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: '180px', paddingTop: 'var(--space-6)', borderBottom: '1px solid var(--color-border)' }}>
          {MOCK_SNAPSHOTS.slice().reverse().map((snap) => (
            <div key={snap.id} style={{ display: 'flex', flexTransverse: 'column', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-bold)', color: 'var(--color-accent)' }}>
                {snap.readinessScore}%
              </span>
              <div
                style={{
                  width: '48px',
                  height: `${snap.readinessScore * 1.8}px`,
                  backgroundColor: 'var(--color-accent)',
                  borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                  opacity: snap.readinessScore === 68 ? 1 : 0.7,
                }}
              />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
                {snap.date.split(' ')[0]} {snap.date.split(' ')[1]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Snapshots Table */}
      <section aria-labelledby="snapshots-heading" style={{ marginBottom: 'var(--space-8)' }}>
        <h2 id="snapshots-heading" className="section-heading">
          Analysis Snapshots History
        </h2>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '18%' }}>Snapshot Date</th>
                <th style={{ width: '15%' }}>Repos Analyzed</th>
                <th style={{ width: '15%' }}>Skills Detected</th>
                <th style={{ width: '16%' }}>Readiness Score</th>
                <th style={{ width: '36%' }}>Verified Milestone Changes</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_SNAPSHOTS.map((snap) => (
                <tr key={snap.id}>
                  <td>
                    <span style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--color-text-primary)' }}>
                      {snap.date}
                    </span>
                  </td>
                  <td>{snap.reposAnalyzed} repositories</td>
                  <td>{snap.skillsDetected} detected</td>
                  <td>
                    <span className="badge badge--blue" style={{ fontWeight: 'var(--fw-bold)' }}>
                      {snap.readinessScore}% match
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                      {snap.keyChanges}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Completed Milestones Log */}
      <section aria-labelledby="milestones-heading">
        <h2 id="milestones-heading" className="section-heading">
          Completed Competency Milestones
        </h2>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {COMPLETED_MILESTONES.map((m, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between"
              style={{
                paddingBottom: idx !== COMPLETED_MILESTONES.length - 1 ? 'var(--space-4)' : 0,
                borderBottom: idx !== COMPLETED_MILESTONES.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                flexWrap: 'wrap',
                gap: 'var(--space-2)',
              }}
            >
              <div>
                <p style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-base)', color: 'var(--color-text-primary)', marginBottom: '2px' }}>
                  {m.title}
                </p>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-disabled)', margin: 0 }}>
                  Completed on {m.date}
                </p>
              </div>
              <span className="badge badge--green">{m.impact}</span>
            </div>
          ))}
        </div>
      </section>
    </AppLayout>
  );
};

export default ProgressHistory;
