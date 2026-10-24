import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { skillsAPI, analysisAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * Format timestamp into human-readable date.
 */
const formatDate = (dateString) => {
  if (!dateString) return 'Recent';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return String(dateString);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(dateString);
  }
};

/**
 * Normalizes and formats evidence source type with clean badge styling.
 */
const formatEvidenceType = (type) => {
  switch (type) {
    case 'language_bytes':
      return { label: 'Code Volume', badgeClass: 'badge--blue' };
    case 'dependency':
      return { label: 'Dependency', badgeClass: 'badge--green' };
    case 'config_file':
      return { label: 'Configuration', badgeClass: 'badge--neutral' };
    default:
      return { label: type ? type.replace(/_/g, ' ') : 'Evidence', badgeClass: 'badge--neutral' };
  }
};

/**
 * Maps confidence score to an objective evidence strength label and color.
 * Explicitly avoids labeling confidence as developer proficiency.
 */
const getConfidenceRating = (score) => {
  const num = Number(score) || 0;
  if (num >= 75) {
    return {
      label: 'Strong Evidence',
      badgeClass: 'badge--green',
      barColor: 'var(--color-success)',
    };
  }
  if (num >= 45) {
    return {
      label: 'Moderate Evidence',
      badgeClass: 'badge--blue',
      barColor: 'var(--color-accent)',
    };
  }
  return {
    label: 'Initial Signal',
    badgeClass: 'badge--amber',
    barColor: 'var(--color-warning)',
  };
};

const SkillAnalysis = () => {
  const { user } = useAuth();

  // Skills state from GET /api/skills
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Analysis run state for POST /api/analysis/run
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisAlert, setAnalysisAlert] = useState(null);

  // Category tab filtering & search
  const [selectedTab, setSelectedTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Granular evidence inspection state for GET /api/skills/:skillName
  const [inspectingSkill, setInspectingSkill] = useState(null);
  const [evidenceData, setEvidenceData] = useState(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState(null);

  // ── 1. Fetch Skills from Backend ──────────────────────────────────────────
  const fetchSkills = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
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
      console.error('[SkillAnalysis fetch error]:', err);
      setLoadError(err.message || 'Unable to connect to server to fetch skills.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  // ── 2. Run Skill Gap Analysis on Repositories ──────────────────────────────
  const handleRunAnalysis = async () => {
    setAnalyzing(true);
    setAnalysisAlert(null);

    try {
      const response = await analysisAPI.runAnalysis();
      const resultData = response?.data;

      if (response?.success) {
        const repoCount = resultData?.analyzedCount ?? 0;
        const evidenceCount = resultData?.evidenceCount ?? 0;
        const distinctCount = resultData?.distinctSkills?.length ?? 0;

        if (resultData?.totalRepositories === 0) {
          setAnalysisAlert({
            type: 'warning',
            message:
              'No synchronized repositories found. Please link your GitHub account and synchronize repositories first.',
            linkToRepos: true,
          });
        } else {
          setAnalysisAlert({
            type: 'success',
            message: `Analysis completed: analyzed ${repoCount} ${
              repoCount === 1 ? 'repository' : 'repositories'
            }, detected ${evidenceCount} evidence records across ${distinctCount} distinct skills.`,
          });
        }

        // Refresh live skills list
        await fetchSkills(true);
      } else {
        setAnalysisAlert({
          type: 'error',
          message: response?.message || 'Skill analysis failed to complete.',
        });
      }
    } catch (err) {
      console.error('[SkillAnalysis run error]:', err);
      setAnalysisAlert({
        type: 'error',
        message: err.message || 'Failed to run repository skill analysis.',
      });
    } finally {
      setAnalyzing(false);
    }
  };

  // ── 3. Inspect Granular Evidence for a Specific Skill ─────────────────────
  const handleInspectEvidence = async (skillName) => {
    setInspectingSkill(skillName);
    setEvidenceLoading(true);
    setEvidenceError(null);
    setEvidenceData(null);

    try {
      const response = await skillsAPI.getSkillEvidence(skillName);
      if (response?.success && response?.data) {
        setEvidenceData(response.data);
      } else {
        setEvidenceError(response?.message || `No evidence records found for ${skillName}.`);
      }
    } catch (err) {
      console.error(`[SkillAnalysis getSkillEvidence error for ${skillName}]:`, err);
      setEvidenceError(err.message || `Failed to retrieve evidence for ${skillName}.`);
    } finally {
      setEvidenceLoading(false);
    }
  };

  const handleCloseEvidenceModal = () => {
    setInspectingSkill(null);
    setEvidenceData(null);
    setEvidenceError(null);
  };

  // ── 4. Categorized Skills Grouping ─────────────────────────────────────────
  const uniqueCategories = useMemo(() => {
    const set = new Set();
    skills.forEach((s) => {
      if (s.category) set.add(s.category);
    });
    return Array.from(set).sort();
  }, [skills]);

  const filteredCategories = useMemo(() => {
    const lowerSearch = searchTerm.trim().toLowerCase();

    // Group skills by category
    const categoryMap = new Map();

    skills.forEach((skill) => {
      // Filter by search term
      if (lowerSearch && !skill.skillName.toLowerCase().includes(lowerSearch)) {
        return;
      }

      const catName = skill.category || 'Other Tools';
      if (!categoryMap.has(catName)) {
        categoryMap.set(catName, []);
      }
      categoryMap.get(catName).push(skill);
    });

    // Build structured category array
    const groups = Array.from(categoryMap.entries()).map(([category, catSkills]) => ({
      id: category.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      category,
      skills: catSkills.sort((a, b) => (b.confidenceScore || 0) - (a.confidenceScore || 0)),
    }));

    // Filter by tab
    if (selectedTab === 'all') {
      return groups;
    }
    return groups.filter(
      (g) => g.category.toLowerCase() === selectedTab.toLowerCase() || g.id === selectedTab
    );
  }, [skills, searchTerm, selectedTab]);

  return (
    <AppLayout>
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="page-header">
        <div
          className="flex items-center justify-between"
          style={{ flexWrap: 'wrap', gap: 'var(--space-4)' }}
        >
          <div>
            <h1 className="page-header__title">Skill Analysis</h1>
            <p className="page-header__subtitle">
              Objective technical skill evidence detected from repository code volume, dependency
              manifests, and build configurations.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchSkills(true)}
              className="btn btn--secondary btn--sm"
              disabled={loading || analyzing}
              title="Refresh skill evidence from database"
            >
              Refresh
            </button>
            <button
              onClick={handleRunAnalysis}
              className="btn btn--primary btn--sm"
              disabled={loading || analyzing}
            >
              {analyzing ? 'Analyzing Repositories...' : 'Run Skill Analysis'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Status / Result Notifications ────────────────────────── */}
      {analysisAlert && (
        <div
          className="card mb-6"
          style={{
            borderLeft: `4px solid ${
              analysisAlert.type === 'success'
                ? 'var(--color-success)'
                : analysisAlert.type === 'warning'
                ? 'var(--color-warning)'
                : 'var(--color-danger)'
            }`,
            backgroundColor: 'var(--color-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-4)',
            padding: 'var(--space-4) var(--space-5)',
          }}
        >
          <div className="flex items-center gap-3">
            <span
              style={{
                color:
                  analysisAlert.type === 'success'
                    ? 'var(--color-success)'
                    : analysisAlert.type === 'warning'
                    ? 'var(--color-warning)'
                    : 'var(--color-danger)',
                fontWeight: 'var(--fw-bold)',
                fontSize: '16px',
              }}
            >
              {analysisAlert.type === 'success' ? '✓' : analysisAlert.type === 'warning' ? '⚠' : '✕'}
            </span>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
              {analysisAlert.message}
              {analysisAlert.linkToRepos && (
                <Link
                  to="/repositories"
                  style={{
                    marginLeft: 'var(--space-2)',
                    color: 'var(--color-link)',
                    fontWeight: 'var(--fw-semibold)',
                  }}
                >
                  Manage Repositories →
                </Link>
              )}
            </div>
          </div>
          <button
            onClick={() => setAnalysisAlert(null)}
            className="btn btn--secondary btn--sm"
            style={{ padding: '2px 8px', lineHeight: 1 }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Evidence Transparency Banner ─────────────────────────── */}
      <div
        className="card mb-6"
        style={{
          borderLeft: '4px solid var(--color-accent)',
          backgroundColor: 'var(--color-surface)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
        }}
      >
        <span
          style={{
            fontWeight: 'var(--fw-semibold)',
            fontSize: 'var(--text-md)',
            color: 'var(--color-text-primary)',
          }}
        >
          Evidence Confidence & Signal Breakdown:
        </span>
        <p
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text-secondary)',
            margin: '0 0 var(--space-2) 0',
          }}
        >
          Confidence scores reflect observable code artifacts, manifest presence, and tooling
          configurations detected within your synchronized repositories. Scores indicate signal
          strength, not a subjective proficiency rating.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 'var(--space-3)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <div>
            <strong style={{ color: 'var(--color-success)' }}>• Strong Signal (75%+):</strong>{' '}
            Substantial repository byte volume, verified production manifests, or core Docker/CI configurations.
          </div>
          <div>
            <strong style={{ color: 'var(--color-accent)' }}>• Moderate Signal (45–74%):</strong>{' '}
            Secondary manifest dependencies, frameworks, or multi-repo corroborating evidence.
          </div>
          <div>
            <strong style={{ color: 'var(--color-warning)' }}>• Initial Signal (&lt;45%):</strong>{' '}
            Test-scope dependencies, minimal file footprints, or exploratory project artifacts.
          </div>
        </div>
      </div>

      {/* ── Category Tabs & Search Filter ────────────────────────── */}
      {skills.length > 0 && (
        <div
          className="flex items-center justify-between mb-6"
          style={{ flexWrap: 'wrap', gap: 'var(--space-4)' }}
        >
          <div className="tab-bar" style={{ marginBottom: 0 }}>
            <button
              onClick={() => setSelectedTab('all')}
              className={`tab-btn ${selectedTab === 'all' ? 'active' : ''}`}
            >
              All Categories
              <span className="tab-btn-count">{skills.length}</span>
            </button>
            {uniqueCategories.map((cat) => {
              const count = skills.filter((s) => s.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedTab(cat)}
                  className={`tab-btn ${selectedTab === cat ? 'active' : ''}`}
                >
                  {cat}
                  <span className="tab-btn-count">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="search-input-wrapper" style={{ minWidth: '220px', maxWidth: '320px' }}>
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M11.5 7a4.499 4.499 0 1 1-8.998 0A4.499 4.499 0 0 1 11.5 7zm-.82 4.74a6 6 0 1 0-1.06 1.06l3.04 3.04a.75.75 0 1 0 1.06-1.06l-3.04-3.04z" />
            </svg>
            <input
              type="text"
              className="form-input"
              placeholder="Filter detected skills..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ padding: '6px 12px 6px 36px', fontSize: 'var(--text-xs)' }}
            />
          </div>
        </div>
      )}

      {/* ── Main View: Loading / Error / Empty / Categorized Tables ─ */}
      {loading ? (
        <div className="card empty-state">
          <p className="empty-state__title">Scanning repository skill evidence...</p>
          <p className="empty-state__desc">
            Retrieving concrete skills, evidence traces, and confidence signals from database.
          </p>
        </div>
      ) : loadError ? (
        <div className="card empty-state" style={{ borderColor: 'var(--color-danger)' }}>
          <p className="empty-state__title" style={{ color: 'var(--color-danger)' }}>
            Failed to Load Skills
          </p>
          <p className="empty-state__desc">{loadError}</p>
          <button onClick={() => fetchSkills()} className="btn btn--secondary btn--sm mt-4">
            Retry Loading Skills
          </button>
        </div>
      ) : skills.length === 0 ? (
        /* Empty State: Zero Skills Detected */
        <div className="card empty-state">
          <p className="empty-state__title">No Technical Skills Detected Yet</p>
          <p className="empty-state__desc">
            DevGrowth extracts verifiable skill evidence from your synchronized GitHub repositories.
            Link your GitHub account, sync repositories, and run skill analysis to populate your
            profile.
          </p>
          <div className="flex items-center gap-3 mt-4" style={{ flexWrap: 'wrap' }}>
            {!user?.githubUsername ? (
              <Link to="/repositories" className="btn btn--primary">
                Link GitHub Account
              </Link>
            ) : (
              <button
                onClick={handleRunAnalysis}
                className="btn btn--primary"
                disabled={analyzing}
              >
                {analyzing ? 'Analyzing Repositories...' : 'Run Skill Analysis'}
              </button>
            )}
            <Link to="/repositories" className="btn btn--secondary">
              Go to Repositories
            </Link>
          </div>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="card empty-state">
          <p className="empty-state__title">No Matching Skills Found</p>
          <p className="empty-state__desc">
            No detected skills match your current search &quot;{searchTerm}&quot;.
          </p>
          <button onClick={() => setSearchTerm('')} className="btn btn--secondary btn--sm mt-4">
            Clear Search Filter
          </button>
        </div>
      ) : (
        /* Categorized Skill Evidence Tables */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
          {filteredCategories.map((group) => (
            <section key={group.id} aria-labelledby={`sec-${group.id}`}>
              <div className="flex items-center justify-between mb-4">
                <h2 id={`sec-${group.id}`} className="section-heading" style={{ marginBottom: 0 }}>
                  {group.category}
                </h2>
                <span className="badge badge--neutral">
                  {group.skills.length} {group.skills.length === 1 ? 'skill' : 'skills'}
                </span>
              </div>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '22%' }}>Skill Name</th>
                      <th style={{ width: '24%' }}>Evidence Strength</th>
                      <th style={{ width: '18%' }}>Signal Source</th>
                      <th style={{ width: '24%' }}>Contributing Repositories</th>
                      <th style={{ width: '12%', textAlign: 'right' }}>Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.skills.map((skill) => {
                      const rating = getConfidenceRating(skill.confidenceScore);
                      const typeInfo = formatEvidenceType(skill.evidenceType);
                      const repoList = Array.isArray(skill.contributingRepositories)
                        ? skill.contributingRepositories
                        : [];
                      const repoCount = skill.repositoryCount || repoList.length || 1;

                      return (
                        <tr key={skill.skillName}>
                          <td>
                            <div className="flex items-center gap-2">
                              <span
                                style={{
                                  fontWeight: 'var(--fw-semibold)',
                                  fontSize: 'var(--text-base)',
                                  color: 'var(--color-text-primary)',
                                }}
                              >
                                {skill.skillName}
                              </span>
                            </div>
                          </td>

                          {/* Evidence Strength / Confidence Score */}
                          <td>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-3)',
                              }}
                            >
                              <div
                                className="progress-bar"
                                style={{ width: '90px', height: '8px' }}
                              >
                                <div
                                  className="progress-bar__fill"
                                  style={{
                                    width: `${Math.min(100, Math.max(0, skill.confidenceScore || 0))}%`,
                                    backgroundColor: rating.barColor,
                                  }}
                                />
                              </div>
                              <span
                                style={{
                                  fontWeight: 'var(--fw-bold)',
                                  fontSize: 'var(--text-sm)',
                                  color: 'var(--color-text-primary)',
                                }}
                              >
                                {Math.round(skill.confidenceScore || 0)}%
                              </span>
                              <span
                                className={`badge ${rating.badgeClass}`}
                                style={{ fontSize: '11px', padding: '0 6px' }}
                              >
                                {rating.label}
                              </span>
                            </div>
                          </td>

                          {/* Primary Evidence Type Badge */}
                          <td>
                            <span className={`badge ${typeInfo.badgeClass}`}>
                              {typeInfo.label}
                            </span>
                          </td>

                          {/* Contributing Repositories */}
                          <td>
                            <p
                              style={{
                                fontSize: 'var(--text-sm)',
                                fontWeight: 'var(--fw-medium)',
                                color: 'var(--color-text-primary)',
                                margin: '0 0 2px 0',
                              }}
                            >
                              {repoCount} {repoCount === 1 ? 'repository' : 'repositories'}
                            </p>
                            <p
                              style={{
                                fontSize: 'var(--text-xs)',
                                color: 'var(--color-text-secondary)',
                                margin: 0,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: '240px',
                              }}
                              title={repoList.join(', ')}
                            >
                              {repoList.length > 0 ? repoList.join(', ') : 'Detected in codebase'}
                            </p>
                          </td>

                          {/* Action Button: Inspect Granular Evidence */}
                          <td style={{ textAlign: 'right' }}>
                            <button
                              onClick={() => handleInspectEvidence(skill.skillName)}
                              className="btn btn--secondary btn--sm"
                              title={`Inspect evidence items supporting ${skill.skillName}`}
                            >
                              View Evidence
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ── Granular Evidence Inspection Modal ───────────────────── */}
      {inspectingSkill && (
        <div
          className="custom-modal-backdrop"
          onClick={handleCloseEvidenceModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="evidence-modal-title"
        >
          <div
            className="custom-modal"
            style={{ maxWidth: '640px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="custom-modal__header">
              <div>
                <h3 id="evidence-modal-title" className="custom-modal__title">
                  {inspectingSkill} Evidence Breakdown
                </h3>
                <p className="custom-modal__subtitle">
                  Detailed repository artifacts and signals verifying this skill
                </p>
              </div>
              <button
                onClick={handleCloseEvidenceModal}
                className="custom-modal__close"
                aria-label="Close modal"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div
              className="custom-modal__body"
              style={{ overflowY: 'auto', flex: 1, padding: 'var(--space-5) var(--space-6)' }}
            >
              {evidenceLoading ? (
                <div style={{ padding: 'var(--space-6) 0', textAlign: 'center' }}>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                    Loading evidence records for {inspectingSkill}...
                  </p>
                </div>
              ) : evidenceError ? (
                <div
                  style={{
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--color-danger-light)',
                    color: 'var(--color-danger)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  {evidenceError}
                </div>
              ) : evidenceData ? (
                <div>
                  {/* Summary Metric Strip */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--space-3) var(--space-4)',
                      backgroundColor: 'var(--color-surface-2)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: 'var(--space-4)',
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--color-text-secondary)',
                          textTransform: 'uppercase',
                          fontWeight: 'var(--fw-semibold)',
                        }}
                      >
                        Category
                      </span>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 'var(--text-sm)',
                          fontWeight: 'var(--fw-semibold)',
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        {evidenceData.category || 'General'}
                      </p>
                    </div>

                    <div>
                      <span
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--color-text-secondary)',
                          textTransform: 'uppercase',
                          fontWeight: 'var(--fw-semibold)',
                        }}
                      >
                        Evidence Strength
                      </span>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 'var(--text-sm)',
                          fontWeight: 'var(--fw-bold)',
                          color: 'var(--color-accent)',
                        }}
                      >
                        {Math.round(evidenceData.confidenceScore || 0)}%
                      </p>
                    </div>

                    <div>
                      <span
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--color-text-secondary)',
                          textTransform: 'uppercase',
                          fontWeight: 'var(--fw-semibold)',
                        }}
                      >
                        Contributing Repos
                      </span>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 'var(--text-sm)',
                          fontWeight: 'var(--fw-semibold)',
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        {evidenceData.repositoryCount || evidenceData.evidence?.length || 1}
                      </p>
                    </div>
                  </div>

                  {/* Evidence Items List */}
                  <h4
                    style={{
                      fontSize: 'var(--text-sm)',
                      fontWeight: 'var(--fw-semibold)',
                      color: 'var(--color-text-primary)',
                      marginBottom: 'var(--space-3)',
                    }}
                  >
                    Verified Evidence Records ({evidenceData.evidence?.length || 0})
                  </h4>

                  {(!evidenceData.evidence || evidenceData.evidence.length === 0) ? (
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                      No granular records available.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                      {evidenceData.evidence.map((item, idx) => {
                        const typeBadge = formatEvidenceType(item.evidenceType);
                        return (
                          <div
                            key={item.id || idx}
                            style={{
                              padding: 'var(--space-3) var(--space-4)',
                              backgroundColor: 'var(--color-surface)',
                              border: '1px solid var(--color-border)',
                              borderRadius: 'var(--radius-md)',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: '4px',
                                gap: 'var(--space-2)',
                              }}
                            >
                              <span
                                style={{
                                  fontWeight: 'var(--fw-semibold)',
                                  fontSize: 'var(--text-sm)',
                                  color: 'var(--color-accent)',
                                }}
                              >
                                {item.repositoryFullName || item.fullName || item.repositoryName || 'Repository'}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className={`badge ${typeBadge.badgeClass}`} style={{ fontSize: '11px' }}>
                                  {typeBadge.label}
                                </span>
                                {item.confidenceScore != null && (
                                  <span
                                    style={{
                                      fontSize: '11px',
                                      color: 'var(--color-text-secondary)',
                                      fontWeight: 'var(--fw-semibold)',
                                    }}
                                  >
                                    Score: {Math.round(item.confidenceScore)}%
                                  </span>
                                )}
                              </div>
                            </div>

                            <p
                              style={{
                                fontSize: 'var(--text-xs)',
                                color: 'var(--color-text-primary)',
                                margin: '0 0 4px 0',
                                lineHeight: 'var(--leading-normal)',
                              }}
                            >
                              {item.evidenceDetails || 'Detected in repository analysis.'}
                            </p>

                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '11px',
                                color: 'var(--color-text-disabled)',
                              }}
                            >
                              {item.evidenceFilePath ? (
                                <span>File: <code>{item.evidenceFilePath}</code></span>
                              ) : (
                                <span />
                              )}
                              <span>Detected: {formatDate(item.detectedAt)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="custom-modal__footer">
              <button onClick={handleCloseEvidenceModal} className="btn btn--secondary btn--sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default SkillAnalysis;
