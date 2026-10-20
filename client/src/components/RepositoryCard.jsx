/**
 * RepositoryCard — displays a GitHub repository summary card with interactive detail trigger
 */
const RepositoryCard = ({
  name = 'my-repository',
  description = 'No description provided.',
  language = 'Java',
  visibility = 'Public',
  stars = 0,
  forks = 0,
  updatedAt = 'Recently',
  onViewDetails,
}) => {
  const langColours = {
    Java: '#b07219',
    JavaScript: '#f1e05a',
    TypeScript: '#3178c6',
    Python: '#3572a5',
    Go: '#00add8',
    Kotlin: '#a97bff',
    HTML: '#e34c26',
    CSS: '#563d7c',
    default: '#6b7280',
  };

  const dotColour = langColours[language] || langColours.default;

  return (
    <div className="repo-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
          <span className="repo-card__name" style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--fw-semibold)' }}>
            {name}
          </span>
          <span className="badge badge--neutral" style={{ textTransform: 'capitalize' }}>
            {visibility}
          </span>
        </div>
        <p className="repo-card__desc" style={{ marginBottom: 'var(--space-4)' }}>
          {description}
        </p>
      </div>

      <div>
        <div className="repo-card__meta" style={{ marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
          {language && (
            <span className="flex items-center gap-2">
              <span
                className="repo-card__lang-dot"
                style={{ background: dotColour }}
                aria-hidden="true"
              />
              {language}
            </span>
          )}
          <span>&#9733; {stars}</span>
          <span>&#9877; {forks}</span>
          <span style={{ marginLeft: 'auto' }}>Updated {updatedAt}</span>
        </div>

        {onViewDetails && (
          <button
            onClick={() => onViewDetails(name)}
            className="btn btn--secondary btn--sm w-full"
            style={{ width: '100%' }}
          >
            View Repository Details
          </button>
        )}
      </div>
    </div>
  );
};

export default RepositoryCard;
