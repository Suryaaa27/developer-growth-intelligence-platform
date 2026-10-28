


import { useState } from 'react';
import AppLayout from '../components/AppLayout';

/* ── Initial Roadmap Tasks based on Java Backend gaps ── */
const INITIAL_TASKS = [
  {
    id: 'task-1',
    title: 'Containerize Spring Boot microservice with multi-stage Dockerfile',
    category: 'DevOps & Tooling',
    priority: 'High',
    effort: '3 hours',
    completed: true,
    description: 'Create an optimized Alpine JRE image using multi-stage builds. Add HEALTHCHECK instruction and non-root execution user.',
    deliverable: 'Dockerfile and docker-compose.yml in microservices-order-service',
  },
  {
    id: 'task-2',
    title: 'Implement unit and mock tests using JUnit 5 & Mockito',
    category: 'Testing & Quality',
    priority: 'High',
    effort: '4 hours',
    completed: false,
    description: 'Write comprehensive service-layer unit tests mocking repository dependencies. Target at least 70% branch coverage on business logic.',
    deliverable: 'OrderServiceTest.java with @ExtendWith(MockitoExtension.class)',
  },
  {
    id: 'task-3',
    title: 'Set up automated CI workflow with GitHub Actions',
    category: 'Automation',
    priority: 'Medium',
    effort: '2 hours',
    completed: false,
    description: 'Configure automated build, Maven test execution, and artifact verification on every pull request to main branch.',
    deliverable: '.github/workflows/ci.yml with actions/setup-java@v4',
  },
  {
    id: 'task-4',
    title: 'Implement Kafka event producer and consumer service',
    category: 'Architecture',
    priority: 'Medium',
    effort: '5 hours',
    completed: false,
    description: 'Build an asynchronous order notification publisher using Spring KafkaTemplate and consumer listener with error retry backoff.',
    deliverable: 'KafkaOrderEventProducer and KafkaOrderConsumer classes',
  },
  {
    id: 'task-5',
    title: 'Add database query performance indexing & benchmarks',
    category: 'Databases',
    priority: 'Low',
    effort: '3 hours',
    completed: false,
    description: 'Profile execution plans for high-cardinality queries using EXPLAIN ANALYZE in PostgreSQL and introduce composite indexes.',
    deliverable: 'V2__add_performance_indexes.sql flyway migration script',
  },
];

const LearningRoadmap = () => {
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [filter, setFilter] = useState('all');

  const toggleTaskCompletion = (taskId) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t))
    );
  };

  const completedCount = tasks.filter((t) => t.completed).length;
  const progressPercent = Math.round((completedCount / tasks.length) * 100);

  const filteredTasks = tasks.filter((task) => {
    if (filter === 'pending') return !task.completed;
    if (filter === 'completed') return task.completed;
    return true;
  });

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-header__title">Learning Roadmap</h1>
        <p className="page-header__subtitle">
          A personalized, actionable task backlog structured to close verified skill gaps for the Java Backend Developer benchmark.
        </p>
      </div>

      {/* Progress Metric Card */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-lg)', color: 'var(--color-text-primary)' }}>
              Roadmap Progress Overview
            </span>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
              {completedCount} of {tasks.length} targeted competencies evidenced & completed.
            </p>
          </div>
          <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--fw-bold)', color: 'var(--color-accent)' }}>
            {progressPercent}%
          </span>
        </div>

        <div className="progress-bar" style={{ height: '10px', marginTop: 'var(--space-2)' }}>
          <div
            className="progress-bar__fill"
            style={{ width: `${progressPercent}%`, backgroundColor: 'var(--color-accent)' }}
          />
        </div>
      </div>

      {/* Task Filters - GitHub tab bar style */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
        <div className="tab-bar" style={{ marginBottom: 0 }}>
          <button
            onClick={() => setFilter('all')}
            className={`tab-btn ${filter === 'all' ? 'active' : ''}`}
          >
            All Tasks
            <span className="tab-btn-count">{tasks.length}</span>
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`tab-btn ${filter === 'pending' ? 'active' : ''}`}
          >
            In Progress
            <span className="tab-btn-count">{tasks.length - completedCount}</span>
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`tab-btn ${filter === 'completed' ? 'active' : ''}`}
          >
            Completed
            <span className="tab-btn-count">{completedCount}</span>
          </button>
        </div>

        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-disabled)' }}>
          Click checkbox to mark as complete
        </span>
      </div>

      {/* Tasks List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {filteredTasks.map((task) => (
          <div
            key={task.id}
            className="card"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--space-4)',
              borderLeft: task.completed ? '4px solid var(--color-success)' : '4px solid var(--color-accent)',
              backgroundColor: task.completed ? 'var(--color-accent-light)' : 'var(--color-surface)',
            }}
          >
            <input
              type="checkbox"
              id={task.id}
              checked={task.completed}
              onChange={() => toggleTaskCompletion(task.id)}
              style={{
                width: '20px',
                height: '20px',
                marginTop: '4px',
                cursor: 'pointer',
                accentColor: 'var(--color-accent)',
              }}
            />

            <div style={{ flex: 1 }}>
              <div className="flex items-center justify-between mb-2" style={{ flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                <label
                  htmlFor={task.id}
                  style={{
                    fontSize: 'var(--text-md)',
                    fontWeight: 'var(--fw-semibold)',
                    color: task.completed ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
                    textDecoration: task.completed ? 'line-through' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  {task.title}
                </label>

                <div className="flex items-center gap-2">
                  <span className={`badge ${task.priority === 'High' ? 'badge--amber' : 'badge--blue'}`}>
                    {task.priority} Priority
                  </span>
                  <span className="badge badge--neutral">{task.category}</span>
                </div>
              </div>

              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
                {task.description}
              </p>

              <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-disabled)' }}>
                  Target Artifact: <strong style={{ color: 'var(--color-text-primary)' }}>{task.deliverable}</strong>
                </span>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-accent)' }}>
                  Est. Effort: {task.effort}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
};

export default LearningRoadmap;
