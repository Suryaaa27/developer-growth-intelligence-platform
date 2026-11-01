import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import { roadmapAPI } from '../services/api';

const LearningRoadmap = () => {
  const { user } = useAuth();
  const targetRole = user?.targetRole;
  const targetRoleId = user?.targetRoleId;

  const [roadmapData, setRoadmapData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [updatingTaskId, setUpdatingTaskId] = useState(null);
  const [filter, setFilter] = useState('all');

  // Fetch dynamic roadmap from backend
  const fetchRoadmap = useCallback(async () => {
    if (!targetRole && !targetRoleId) {
      setRoadmapData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const res = await roadmapAPI.getRoadmap();
      if (res?.success && res.data) {
        setRoadmapData(res.data);
      } else {
        setRoadmapData(null);
      }
    } catch (err) {
      console.error('[LearningRoadmap fetch error]:', err);
      setLoadError(err.message || 'Unable to load personalized learning roadmap.');
    } finally {
      setLoading(false);
    }
  }, [targetRole, targetRoleId]);

  useEffect(() => {
    fetchRoadmap();
  }, [fetchRoadmap]);

  // Handle task status update (toggle completion or change state)
  const handleStatusChange = async (task, newStatus) => {
    if (!task || updatingTaskId) return;

    setUpdatingTaskId(task.id);
    const oldStatus = task.status;
    const oldCompleted = task.completed;

    // Optimistic UI update
    setRoadmapData((prev) => {
      if (!prev) return prev;
      const updatedTasks = prev.tasks.map((t) => {
        if (t.id === task.id) {
          return {
            ...t,
            status: newStatus,
            completed: newStatus === 'COMPLETED',
            completedAt: newStatus === 'COMPLETED' ? new Date().toISOString() : null,
          };
        }
        return t;
      });

      const updatedStages = (prev.stages || []).map((s) => {
        const stageTasks = updatedTasks.filter((t) => t.stage === s.name);
        return {
          ...s,
          tasks: stageTasks,
          completedTasks: stageTasks.filter((t) => t.completed).length,
        };
      });

      const completedTasks = updatedTasks.filter((t) => t.completed).length;
      const inProgressTasks = updatedTasks.filter((t) => t.status === 'IN_PROGRESS').length;
      const completionPercentage =
        updatedTasks.length > 0 ? Math.round((completedTasks / updatedTasks.length) * 100) : 0;

      return {
        ...prev,
        tasks: updatedTasks,
        stages: updatedStages,
        stats: {
          ...prev.stats,
          completedTasks,
          inProgressTasks,
          completionPercentage,
        },
      };
    });

    try {
      const res = await roadmapAPI.updateTaskProgress(task.id, {
        roleId: roadmapData?.targetRoleId || targetRoleId,
        status: newStatus,
      });

      if (!res?.success) {
        throw new Error(res?.message || 'Failed to update progress on server');
      }
    } catch (err) {
      console.error('[LearningRoadmap updateTaskProgress error]:', err);
      // Revert optimistic update
      setRoadmapData((prev) => {
        if (!prev) return prev;
        const revertedTasks = prev.tasks.map((t) =>
          t.id === task.id ? { ...t, status: oldStatus, completed: oldCompleted } : t
        );
        return { ...prev, tasks: revertedTasks };
      });
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const tasks = roadmapData?.tasks || [];
  const stages = roadmapData?.stages || [];
  const stats = roadmapData?.stats || {
    totalTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    completionPercentage: 0,
    evidenceDetectedCount: 0,
    needsLearningCount: 0,
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filter === 'needs-learning') return t.evidenceStatus === 'Needs Learning';
      if (filter === 'in-progress') return t.status === 'IN_PROGRESS';
      if (filter === 'completed') return t.completed;
      return true;
    });
  }, [tasks, filter]);

  return (
    <AppLayout>
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <h1 className="page-header__title">Learning Roadmap</h1>
            <p className="page-header__subtitle">
              {targetRole
                ? `Personalized technical milestone plan structured to close verified skill gaps for the ${targetRole} benchmark.`
                : 'A personalized, actionable task backlog structured to close verified skill gaps against your engineering target.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/gaps" className="btn btn--secondary btn--sm">
              Skill Gap Analysis →
            </Link>
            <Link to="/profile" className="btn btn--secondary btn--sm">
              Profile Settings
            </Link>
          </div>
        </div>
      </div>

      {/* ── Target Role Status Card ─────────────────────────────────── */}
      {!targetRole || roadmapData?.roleUnavailable ? (
        <div
          className="card mb-6"
          style={{
            borderLeft: '4px solid var(--color-warning, #d29922)',
            backgroundColor: 'var(--color-surface)',
            padding: 'var(--space-5) var(--space-6)',
          }}
        >
          <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="badge badge--amber">
                  {roadmapData?.roleUnavailable ? 'Saved Role Unavailable' : 'No Target Role Selected'}
                </span>
                <span style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-md)', color: 'var(--color-text-primary)' }}>
                  {roadmapData?.roleUnavailable
                    ? 'Target Career Benchmark Unavailable'
                    : 'Configure Your Primary Career Benchmark'}
                </span>
              </div>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
                {roadmapData?.roleUnavailable
                  ? 'Your previously saved target role is no longer available in the active catalog. Please choose a new target role in your Profile.'
                  : 'Your learning roadmap is dynamically generated from your saved profile target role. Please select your target engineering role in your profile to generate targeted competency tasks.'}
              </p>
            </div>
            <Link to="/profile" className="btn btn--primary btn--sm" style={{ textDecoration: 'none' }}>
              Select Target Role in Profile →
            </Link>
          </div>
        </div>
      ) : (
        <div
          className="card mb-6"
          style={{
            borderLeft: '4px solid var(--color-accent)',
            backgroundColor: 'var(--color-surface)',
            padding: 'var(--space-4) var(--space-6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
          }}
        >
          <div className="flex items-center gap-3">
            <span className="badge badge--blue">Target Role</span>
            <div>
              <span style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-md)', color: 'var(--color-text-primary)' }}>
                {targetRole}
              </span>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                {roadmapData?.description || 'Standard industry career track technical specifications.'}
              </p>
            </div>
          </div>
          <Link to="/profile" className="btn btn--secondary btn--sm" style={{ textDecoration: 'none' }}>
            Change in Profile →
          </Link>
        </div>
      )}

      {/* ── Progress Metric Overview Cards ──────────────────────────── */}
      {targetRole && !roadmapData?.roleUnavailable && tasks.length > 0 && (
        <div className="grid-3 mb-6">
          <div className="stat-card">
            <p className="stat-card__label">Roadmap Completion</p>
            <div className="flex items-center gap-3" style={{ margin: '4px 0' }}>
              <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--fw-bold)', color: 'var(--color-accent)' }}>
                {stats.completionPercentage}%
              </span>
              <span className={`badge ${stats.completionPercentage >= 70 ? 'badge--green' : stats.completionPercentage >= 30 ? 'badge--blue' : 'badge--neutral'}`}>
                {stats.completedTasks} of {stats.totalTasks} completed
              </span>
            </div>
            <div className="progress-bar" style={{ height: '8px', marginTop: 'var(--space-2)' }}>
              <div
                className="progress-bar__fill"
                style={{ width: `${stats.completionPercentage}%`, backgroundColor: 'var(--color-accent)' }}
              />
            </div>
          </div>

          <div className="stat-card">
            <p className="stat-card__label">Repository Evidence Detected</p>
            <p className="stat-card__value" style={{ margin: '4px 0', color: 'var(--color-success)' }}>
              {stats.evidenceDetectedCount}
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', fontWeight: 'normal' }}>
                {' '}skills with code signals
              </span>
            </p>
            <p className="stat-card__meta">Signals observed in synchronized repositories</p>
          </div>

          <div className="stat-card">
            <p className="stat-card__label">Gaps Requiring Focus</p>
            <p className="stat-card__value" style={{ margin: '4px 0', color: 'var(--color-warning)' }}>
              {stats.needsLearningCount}
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', fontWeight: 'normal' }}>
                {' '}prioritized learning tasks
              </span>
            </p>
            <p className="stat-card__meta">Missing observable repository signals</p>
          </div>
        </div>
      )}

      {/* ── Loading & Error States ──────────────────────────────────── */}
      {loading ? (
        <div className="card p-6" style={{ opacity: 0.6, marginBottom: 'var(--space-6)' }}>
          <div style={{ height: '24px', width: '40%', backgroundColor: 'var(--color-surface-2)', borderRadius: '4px', marginBottom: '16px' }} />
          <div style={{ height: '14px', width: '70%', backgroundColor: 'var(--color-surface-2)', borderRadius: '4px', marginBottom: '8px' }} />
          <div style={{ height: '14px', width: '50%', backgroundColor: 'var(--color-surface-2)', borderRadius: '4px' }} />
        </div>
      ) : loadError ? (
        <div className="card p-6 mb-6" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--color-danger, #f85149)', fontSize: 'var(--text-md)', marginBottom: 'var(--space-3)' }}>
            {loadError}
          </p>
          <button type="button" onClick={fetchRoadmap} className="btn btn--primary btn--sm">
            Retry Loading Roadmap
          </button>
        </div>
      ) : tasks.length === 0 ? (
        <div className="card empty-state" style={{ padding: 'var(--space-8) var(--space-6)', textAlign: 'center' }}>
          <p className="empty-state__title" style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-semibold)' }}>
            {roadmapData?.roleUnavailable
              ? `Target Role "${targetRole || 'Saved Role'}" is Unavailable`
              : targetRole
              ? `No Roadmap Tasks Available for ${targetRole}`
              : 'No Target Role Selected'}
          </p>
          <p className="empty-state__desc" style={{ maxWidth: '480px', margin: '0 auto var(--space-4) auto', color: 'var(--color-text-secondary)' }}>
            {roadmapData?.roleUnavailable
              ? 'This role may have been updated or removed from the catalog. Please select an active target role from your Profile settings to generate your learning milestones.'
              : targetRole
              ? 'Could not locate required competency definitions for this role.'
              : 'Select your target engineering role in your profile to generate milestone tasks.'}
          </p>
          <Link to="/profile" className="btn btn--primary btn--sm" style={{ textDecoration: 'none', display: 'inline-block' }}>
            Go to Profile Settings →
          </Link>
        </div>
      ) : (
        <>
          {/* ── Filter Tabs ───────────────────────────────────────────── */}
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
                onClick={() => setFilter('needs-learning')}
                className={`tab-btn ${filter === 'needs-learning' ? 'active' : ''}`}
              >
                Needs Learning
                <span className="tab-btn-count">{stats.needsLearningCount}</span>
              </button>
              <button
                onClick={() => setFilter('in-progress')}
                className={`tab-btn ${filter === 'in-progress' ? 'active' : ''}`}
              >
                In Progress
                <span className="tab-btn-count">{stats.inProgressTasks}</span>
              </button>
              <button
                onClick={() => setFilter('completed')}
                className={`tab-btn ${filter === 'completed' ? 'active' : ''}`}
              >
                Completed
                <span className="tab-btn-count">{stats.completedTasks}</span>
              </button>
            </div>

            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
              Check off tasks to track progress. Evidence detected in repos does not automatically mark completed.
            </span>
          </div>

          {/* ── Stages and Tasks ──────────────────────────────────────── */}
          <div className="tab-content" key={filter}>
            {filter === 'all' ? (
              // Grouped by stage view
              stages.map((stage) => {
                const stageTasks = stage.tasks || [];
                if (stageTasks.length === 0) return null;

                return (
                  <div key={stage.name} className="reveal-on-scroll" style={{ marginBottom: 'var(--space-7)' }}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="badge badge--blue" style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase' }}>
                          {stage.name}
                        </span>
                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                          {stage.completedTasks} of {stage.totalTasks} tasks completed
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      {stageTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          updating={updatingTaskId === task.id}
                          onStatusChange={handleStatusChange}
                        />
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              // Flat filtered view
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginBottom: 'var(--space-7)' }}>
                {filteredTasks.length === 0 ? (
                  <div className="card p-6" style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    No tasks currently matching the selected filter ({filter}).
                  </div>
                ) : (
                  filteredTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      updating={updatingTaskId === task.id}
                      onStatusChange={handleStatusChange}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}
    </AppLayout>
  );
};

/**
 * TaskCard Component
 */
const TaskCard = ({ task, updating, onStatusChange }) => {
  const isCompleted = task.status === 'COMPLETED';
  const isInProgress = task.status === 'IN_PROGRESS';

  const toggleCheck = () => {
    const nextStatus = isCompleted ? 'NOT_STARTED' : 'COMPLETED';
    onStatusChange(task, nextStatus);
  };

  return (
    <div
      className="card roadmap-task"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-4)',
        borderLeft: isCompleted
          ? '4px solid var(--color-success)'
          : isInProgress
          ? '4px solid var(--color-accent)'
          : '4px solid var(--color-border)',
        backgroundColor: isCompleted
          ? 'rgba(46,160,67,0.06)'
          : isInProgress
          ? 'rgba(88,166,255,0.04)'
          : 'var(--color-surface)',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Checkbox for quick completion toggle */}
      <input
        type="checkbox"
        id={task.id}
        checked={isCompleted}
        disabled={updating}
        onChange={toggleCheck}
        style={{
          width: '20px',
          height: '20px',
          marginTop: '4px',
          cursor: updating ? 'wait' : 'pointer',
          accentColor: 'var(--color-success)',
        }}
        title="Mark as completed"
      />

      <div style={{ flex: 1 }}>
        {/* Title and Badges */}
        <div className="flex items-center justify-between mb-2" style={{ flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <div className="flex items-center gap-2">
            <label
              htmlFor={task.id}
              style={{
                fontSize: 'var(--text-md)',
                fontWeight: 'var(--fw-semibold)',
                color: isCompleted ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
                textDecoration: isCompleted ? 'line-through' : 'none',
                cursor: 'pointer',
                margin: 0,
              }}
            >
              {task.title}
            </label>
          </div>

          <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
            {/* Evidence Indicator */}
            {task.evidenceStatus === 'Evidence Detected' ? (
              <span className="badge badge--green" style={{ fontSize: '11px' }}>
                ✓ Evidence Detected
              </span>
            ) : (
              <span className="badge badge--amber" style={{ fontSize: '11px' }}>
                ⚠ Needs Learning
              </span>
            )}

            {/* Priority & Category */}
            <span className={`badge ${task.priority === 'Core' ? 'badge--blue' : 'badge--neutral'}`} style={{ fontSize: '11px' }}>
              {task.priority} Priority
            </span>
            <span className="badge badge--neutral" style={{ fontSize: '11px' }}>
              {task.category}
            </span>

            {/* Status Selector Dropdown */}
            <select
              value={task.status}
              disabled={updating}
              onChange={(e) => onStatusChange(task, e.target.value)}
              className="form-select"
              style={{
                padding: '2px 8px',
                fontSize: '11px',
                height: '26px',
                width: 'auto',
                fontWeight: 'var(--fw-medium)',
              }}
            >
              <option value="NOT_STARTED">Not Started</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
        </div>

        {/* Description */}
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>
          {task.description}
        </p>

        {/* Admin Curated Learning Guidance */}
        {task.learningGuidance && (
          <div
            style={{
              marginBottom: 'var(--space-3)',
              padding: 'var(--space-2) var(--space-3)',
              backgroundColor: 'rgba(88, 166, 255, 0.08)',
              borderLeft: '3px solid var(--color-accent)',
              borderRadius: '0 4px 4px 0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '2px' }}>
              <span style={{ fontSize: '11px', fontWeight: 'var(--fw-bold)', color: 'var(--color-accent)', textTransform: 'uppercase' }}>
                Curated Recommendation
              </span>
              {task.learningGuidance.priority && (
                <span className="badge badge--neutral" style={{ fontSize: '10px', padding: '1px 5px' }}>
                  {task.learningGuidance.priority}
                </span>
              )}
            </div>
            <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-text-primary)', margin: '0 0 2px 0' }}>
              {task.learningGuidance.title}
            </p>
            {task.learningGuidance.description && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.4 }}>
                {task.learningGuidance.description}
              </p>
            )}
          </div>
        )}

        {/* Deliverable & Learning Resources */}
        <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
            Target Deliverable: <strong style={{ color: 'var(--color-text-primary)' }}>{task.deliverable}</strong>
          </span>

          <div className="flex items-center gap-3">
            {task.resourceUrl && (
              <a
                href={task.resourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn--secondary btn--sm"
                style={{ padding: '2px 8px', fontSize: '11px', textDecoration: 'none' }}
              >
                Official Docs ↗
              </a>
            )}
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-accent)' }}>
              Est. Effort: {task.effort}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LearningRoadmap;
