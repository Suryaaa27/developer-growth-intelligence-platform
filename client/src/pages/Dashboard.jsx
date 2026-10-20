import { Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import SkillCard from '../components/SkillCard';
import RepositoryCard from '../components/RepositoryCard';

/* ── Sample Demonstration Data (Clearly Labeled) ── */
const STAT_CARDS = [
  { id: 'repos', label: 'Repositories Analyzed', value: '8', meta: '2 updated recently' },
  { id: 'skills', label: 'Skills Detected', value: '14', meta: 'Across 5 categories' },
  { id: 'gaps', label: 'Skills to Improve', value: '4', meta: 'Target: Java Backend' },
  { id: 'readiness', label: 'Role Readiness', value: '68%', meta: 'Benchmark: 80%' },
];

const SAMPLE_SKILLS = [
  { skillName: 'Java', level: 85, category: 'Language' },
  { skillName: 'Spring Boot', level: 75, category: 'Framework' },
  { skillName: 'PostgreSQL', level: 70, category: 'Database' },
  { skillName: 'Docker', level: 50, category: 'Tools' },
  { skillName: 'RESTful APIs', level: 90, category: 'Architecture' },
  { skillName: 'JUnit 5', level: 60, category: 'Testing' },
];

const RECENT_REPOS = [
  {
    name: 'ecommerce-backend-api',
    description: 'Spring Boot REST service with PostgreSQL, JWT authentication and Redis caching layer.',
    language: 'Java',
    stars: 12,
    forks: 3,
    visibility: 'Public',
    updatedAt: '3 days ago',
  },
  {
    name: 'microservices-order-service',
    description: 'Event-driven order processing service using Kafka, Spring Cloud, and Docker Compose.',
    language: 'Java',
    stars: 7,
    forks: 1,
    visibility: 'Public',
    updatedAt: '1 week ago',
  },
  {
    name: 'developer-portfolio-site',
    description: 'Personal portfolio and technical writing showcase built with modern React.',
    language: 'JavaScript',
    stars: 5,
    forks: 0,
    visibility: 'Public',
    updatedAt: '2 weeks ago',
  },
];

const PRIORITY_RECOMMENDATIONS = [
  {
    id: 1,
    title: 'Integrate Docker containerization in backend projects',
    reason: 'Identified as a critical requirement for Java Backend Developer roles.',
    effort: '3-4 hours',
    priority: 'High',
  },
  {
    id: 2,
    title: 'Increase unit test coverage using JUnit 5 & Mockito',
    reason: 'Test evidence detected in only 1 of 8 repositories.',
    effort: '2-3 hours',
    priority: 'High',
  },
  {
    id: 3,
    title: 'Implement database indexing & query optimization benchmarks',
    reason: 'Enhances database proficiency evidence for enterprise roles.',
    effort: '4-5 hours',
    priority: 'Medium',
  },
];

const StatCard = ({ label, value, meta }) => (
  <div className="stat-card">
    <p className="stat-card__label">{label}</p>
    <p className="stat-card__value">{value}</p>
    <p className="stat-card__meta">{meta}</p>
  </div>
);

const Dashboard = () => {
  return (
    <AppLayout>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-header__title">Dashboard</h1>
        <p className="page-header__subtitle">
          Welcome back! Here is an overview of your GitHub repository analysis, detected competencies, and growth milestones.
        </p>
      </div>

      {/* GitHub Connection Banner */}
      <div
        className="card flex items-center justify-between mb-6"
        style={{
          gap: 'var(--space-5)',
          padding: 'var(--space-6) var(--space-8)',
          backgroundColor: 'var(--color-surface)',
          borderLeft: '4px solid var(--color-accent)',
        }}
      >
        <div>
          <div className="flex items-center gap-3" style={{ marginBottom: '4px' }}>
            <span style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-lg)', color: 'var(--color-text-primary)' }}>
              GitHub Account Status: Connected as @developer-sample
            </span>
            <span className="badge badge--green">Synchronized</span>
          </div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 0 }}>
            Last sync was completed today. Connect another organization or refresh repository analysis anytime.
          </p>
        </div>
        <Link to="/repositories" className="btn btn--primary" id="btn-sync-github">
          Sync Repositories
        </Link>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid-4 mb-6">
        {STAT_CARDS.map((stat) => (
          <StatCard key={stat.id} {...stat} />
        ))}
      </div>

      {/* Skill Distribution Visualization */}
      <section aria-labelledby="skills-overview" style={{ marginBottom: 'var(--space-8)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 id="skills-overview" className="section-heading" style={{ marginBottom: '2px' }}>
              Skill Distribution & Evidence
            </h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
              Calculated from commit code signatures, dependencies, and project manifests.
            </p>
          </div>
          <Link to="/skills" className="btn btn--secondary btn--sm">
            View Full Analysis &rarr;
          </Link>
        </div>

        <div className="grid-3">
          {SAMPLE_SKILLS.map((skill) => (
            <SkillCard key={skill.skillName} {...skill} />
          ))}
        </div>
      </section>

      {/* Two Column Section: Recent Repositories & Priority Recommendations */}
      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Recent Repositories */}
        <section aria-labelledby="recent-repos-heading">
          <div className="flex items-center justify-between mb-4">
            <h2 id="recent-repos-heading" className="section-heading" style={{ marginBottom: 0 }}>
              Recent Repositories
            </h2>
            <Link to="/repositories" style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)' }}>
              View all (8)
            </Link>
          </div>
          <div className="flex flex-col gap-4">
            {RECENT_REPOS.map((repo) => (
              <RepositoryCard key={repo.name} {...repo} />
            ))}
          </div>
        </section>

        {/* Priority Recommendations */}
        <section aria-labelledby="recommendations-heading">
          <div className="flex items-center justify-between mb-4">
            <h2 id="recommendations-heading" className="section-heading" style={{ marginBottom: 0 }}>
              Priority Learning Recommendations
            </h2>
            <Link to="/roadmap" style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)' }}>
              View roadmap
            </Link>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {PRIORITY_RECOMMENDATIONS.map((rec) => (
              <div
                key={rec.id}
                style={{
                  paddingBottom: 'var(--space-4)',
                  borderBottom: '1px solid var(--color-border-subtle)',
                }}
              >
                <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
                  <span style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-md)', color: 'var(--color-text-primary)' }}>
                    {rec.title}
                  </span>
                  <span className={`badge ${rec.priority === 'High' ? 'badge--amber' : 'badge--blue'}`}>
                    {rec.priority}
                  </span>
                </div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
                  {rec.reason}
                </p>
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-disabled)' }}>
                    Est. Effort: {rec.effort}
                  </span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-accent)', fontWeight: 'var(--fw-medium)' }}>
                    Target: Java Backend Developer
                  </span>
                </div>
              </div>
            ))}

            <Link
              to="/roadmap"
              className="btn btn--secondary btn--sm"
              style={{ marginTop: 'var(--space-2)', alignSelf: 'flex-start' }}
            >
              Open Interactive Roadmap
            </Link>
          </div>
        </section>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
