/**
 * SkillCard — displays a detected skill with an evidence-strength progress bar.
 *
 * Props:
 *   skillName       {string}  Canonical skill name (e.g. "JavaScript")
 *   confidenceScore {number}  Evidence strength 0-100 (NOT a proficiency rating)
 *   category        {string}  Skill category (e.g. "Language", "Framework")
 *   repositoryCount {number}  Number of repositories contributing evidence
 */
const SkillCard = ({
  skillName = 'Unknown',
  confidenceScore = 0,
  category = 'General',
  repositoryCount = 1,
  // Legacy prop alias accepted for backward compat — ignored in new label
  level,
}) => {
  const score = typeof confidenceScore === 'number' ? confidenceScore : Number(level) || 0;

  const fillClass =
    score >= 75
      ? 'skill-card__bar-fill--high'
      : score >= 45
      ? 'skill-card__bar-fill--medium'
      : 'skill-card__bar-fill--low';

  const strengthLabel =
    score >= 75 ? 'Strong Evidence' : score >= 45 ? 'Moderate Evidence' : 'Initial Signal';

  return (
    <div className="skill-card">
      <div className="skill-card__header">
        <span className="skill-card__name">{skillName}</span>
        <span className="skill-card__pct">{Math.round(score)}%</span>
      </div>

      <div className="skill-card__bar-track">
        <div
          className={`skill-card__bar-fill ${fillClass}`}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
          role="progressbar"
          aria-valuenow={Math.round(score)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${skillName} evidence strength`}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
        <p className="skill-card__category">{category}</p>
        <p
          className="skill-card__category"
          style={{ fontSize: 'var(--text-xs)', opacity: 0.7 }}
          title="Evidence strength — not a proficiency rating"
        >
          {strengthLabel}
          {repositoryCount > 0 && ` · ${repositoryCount} repo${repositoryCount !== 1 ? 's' : ''}`}
        </p>
      </div>
    </div>
  );
};

export default SkillCard;
