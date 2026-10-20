import { useState } from 'react';
import AppLayout from '../components/AppLayout';

/* ── Benchmark Roles Data ── */
const ROLE_DEFINITIONS = {
  'java-backend': {
    title: 'Java Backend Developer',
    description: 'Specializes in scalable microservices, relational databases, Spring Boot frameworks, containerized deployments, and clean unit testing.',
    overallMatch: '68%',
    skills: [
      {
        name: 'Java (Core & Modern)',
        requiredLevel: '80%',
        detectedLevel: '85%',
        status: 'Met',
        priority: 'Core',
        evidenceFound: 'Verified in 4 repositories with clean OOP & Java Stream API practices.',
        missingNotes: 'None. Strong baseline proficiency observed.',
      },
      {
        name: 'Spring Boot & Spring Cloud',
        requiredLevel: '75%',
        detectedLevel: '75%',
        status: 'Met',
        priority: 'Core',
        evidenceFound: 'Verified in ecommerce-backend-api and microservices-order-service.',
        missingNotes: 'None. Solid REST controller and dependency injection usage.',
      },
      {
        name: 'Relational Database (PostgreSQL / MySQL)',
        requiredLevel: '70%',
        detectedLevel: '70%',
        status: 'Met',
        priority: 'Core',
        evidenceFound: 'PostgreSQL schema DDL and Spring Data JPA repositories verified.',
        missingNotes: 'Consider adding complex JOIN and indexing benchmarks.',
      },
      {
        name: 'Docker & Containerization',
        requiredLevel: '65%',
        detectedLevel: '50%',
        status: 'Partial',
        priority: 'High',
        evidenceFound: 'Basic Dockerfile detected in 1 repository.',
        missingNotes: 'Missing multi-stage production builds and Docker Compose clustering.',
      },
      {
        name: 'Testing (JUnit 5 & Mockito)',
        requiredLevel: '70%',
        detectedLevel: '55%',
        status: 'Partial',
        priority: 'High',
        evidenceFound: 'Unit tests present in 1 repository (banking-transaction-engine).',
        missingNotes: 'Mocking service dependencies (Mockito) and integration test fixtures missing in others.',
      },
      {
        name: 'Message Queues (Kafka / RabbitMQ)',
        requiredLevel: '60%',
        detectedLevel: '20%',
        status: 'Gap',
        priority: 'Medium',
        evidenceFound: 'References in draft order-service configuration.',
        missingNotes: 'No active producer/consumer listener implementations verified in code.',
      },
      {
        name: 'CI/CD Pipelines (GitHub Actions)',
        requiredLevel: '50%',
        detectedLevel: '0%',
        status: 'Gap',
        priority: 'Medium',
        evidenceFound: 'No .github/workflows directory detected.',
        missingNotes: 'Add automated build & test workflow files to repositories.',
      },
    ],
  },
  'fullstack-javascript': {
    title: 'Full Stack JavaScript Developer',
    description: 'Focuses on modern Node.js/Express APIs, React/Next.js single-page frontend applications, and MongoDB data modeling.',
    overallMatch: '52%',
    skills: [
      {
        name: 'JavaScript (ES6+) & TypeScript',
        requiredLevel: '80%',
        detectedLevel: '65%',
        status: 'Partial',
        priority: 'Core',
        evidenceFound: 'Found in frontend portfolio and build toolchain.',
        missingNotes: 'TypeScript static typing evidence not yet detected.',
      },
      {
        name: 'React Ecosystem',
        requiredLevel: '75%',
        detectedLevel: '60%',
        status: 'Partial',
        priority: 'Core',
        evidenceFound: 'Functional components and basic hooks in client repository.',
        missingNotes: 'State management architecture (Context / Redux) not extensively verified.',
      },
      {
        name: 'Node.js & Express.js',
        requiredLevel: '70%',
        detectedLevel: '35%',
        status: 'Gap',
        priority: 'High',
        evidenceFound: 'Express scaffolding found in server root.',
        missingNotes: 'Production API middleware, auth flows, and schema validation needed.',
      },
    ],
  },
};

const SkillGaps = () => {
  const [selectedRoleKey, setSelectedRoleKey] = useState('java-backend');
  const role = ROLE_DEFINITIONS[selectedRoleKey];

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-header__title">Skill Gaps Analysis</h1>
        <p className="page-header__subtitle">
          Benchmark your demonstrated GitHub evidence against industry expectations for your targeted engineering role.
        </p>
      </div>

      {/* Role Selector Controls */}
      <div className="card mb-6" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div style={{ flex: 1, minWidth: '260px' }}>
          <label htmlFor="role-select" className="form-label" style={{ marginBottom: 'var(--space-2)' }}>
            Selected Target Career Role:
          </label>
          <select
            id="role-select"
            className="form-select"
            value={selectedRoleKey}
            onChange={(e) => setSelectedRoleKey(e.target.value)}
            style={{ fontWeight: 'var(--fw-semibold)' }}
          >
            <option value="java-backend">Java Backend Developer (Primary Track)</option>
            <option value="fullstack-javascript">Full Stack JavaScript Developer</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: '2px', fontWeight: 'var(--fw-bold)' }}>
              Calculated Role Readiness
            </p>
            <p style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--fw-bold)', color: 'var(--color-accent)', margin: 0 }}>
              {role.overallMatch}
            </p>
          </div>
        </div>
      </div>

      {/* Important Nuance Clarification Banner */}
      <div
        className="card mb-6"
        style={{
          borderLeft: '4px solid var(--color-warning)',
          backgroundColor: 'var(--color-warning-light)',
          padding: 'var(--space-5) var(--space-6)',
        }}
      >
        <span style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-md)', color: 'var(--color-warning)' }}>
          Note Regarding Missing Evidence:
        </span>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: '4px', marginBottom: 0 }}>
          A skill classified as <strong>"Missing Evidence"</strong> or <strong>"Gap"</strong> means there is currently no tangible artifact (such as a manifest, test fixture, or source file) in your scanned public repositories. <em>It does not necessarily mean you do not know the technology.</em> Adding a small demonstration commit or sample project is the fastest way to verify and close these gaps!
        </p>
      </div>

      {/* Skill Comparison Table */}
      <section aria-labelledby="gaps-table-heading">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 id="gaps-table-heading" className="section-heading" style={{ marginBottom: '2px' }}>
              Required Competencies vs. Scanned Evidence
            </h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
              {role.description}
            </p>
          </div>
          <span className="badge badge--blue">{role.skills.length} role requirements</span>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '22%' }}>Skill Requirement</th>
                <th style={{ width: '12%' }}>Target Level</th>
                <th style={{ width: '12%' }}>Scanned Level</th>
                <th style={{ width: '12%' }}>Status</th>
                <th style={{ width: '10%' }}>Priority</th>
                <th style={{ width: '32%' }}>Evidence Assessment & Recommendations</th>
              </tr>
            </thead>
            <tbody>
              {role.skills.map((item) => (
                <tr key={item.name}>
                  <td>
                    <span style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-base)', color: 'var(--color-text-primary)' }}>
                      {item.name}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 'var(--fw-medium)', color: 'var(--color-text-secondary)' }}>
                      {item.requiredLevel}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 'var(--fw-bold)', color: 'var(--color-text-primary)' }}>
                      {item.detectedLevel}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        item.status === 'Met'
                          ? 'badge--green'
                          : item.status === 'Partial'
                          ? 'badge--blue'
                          : 'badge--red'
                      }`}
                    >
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
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', marginBottom: '3px' }}>
                      {item.evidenceFound}
                    </p>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                      <strong style={{ color: 'var(--color-text-disabled)' }}>Action:</strong> {item.missingNotes}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppLayout>
  );
};

export default SkillGaps;
