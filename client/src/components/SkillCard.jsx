/**
 * SkillCard — displays a detected skill with a labelled progress bar
 * Colour-codes by proficiency level: high (green) / medium (blue) / low (amber)
 */
const SkillCard = ({
  skillName = 'Java',
  level = 75,
  category = 'Language',
}) => {
  const fillClass =
    level >= 75
      ? 'skill-card__bar-fill--high'
      : level >= 45
      ? 'skill-card__bar-fill--medium'
      : 'skill-card__bar-fill--low';

  return (
    <div className="skill-card">
      <div className="skill-card__header">
        <span className="skill-card__name">{skillName}</span>
        <span className="skill-card__pct">{level}%</span>
      </div>

      <div className="skill-card__bar-track">
        <div
          className={`skill-card__bar-fill ${fillClass}`}
          style={{ width: `${level}%` }}
          role="progressbar"
          aria-valuenow={level}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${skillName} proficiency`}
        />
      </div>

      <p className="skill-card__category">{category}</p>
    </div>
  );
};

export default SkillCard;
