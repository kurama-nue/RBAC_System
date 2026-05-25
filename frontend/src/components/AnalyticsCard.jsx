/**
 * @component AnalyticsCard
 * Reusable metric display card for the analytics grid.
 *
 * @prop {string}  label   - Metric name (e.g., "Total Users")
 * @prop {number}  value   - Numeric value to display
 * @prop {string}  icon    - Emoji or icon character
 * @prop {string}  [trend] - Optional trend text (e.g., "+12 today")
 * @prop {boolean} [trendUp] - If true, trend text is colored green
 * @prop {string}  [accentColor] - CSS custom property override for card accent
 * @prop {string}  [accentBg]    - Background for the icon container
 * @prop {string}  [accentBorder] - Border for the icon container
 */

const AnalyticsCard = ({
  label,
  value,
  icon,
  trend,
  trendUp = true,
  accentColor = 'rgba(99, 102, 241, 0.15)',
  accentBg = 'rgba(99, 102, 241, 0.15)',
  accentBorder = 'rgba(99, 102, 241, 0.2)',
}) => {
  const displayValue = value === undefined || value === null ? '—' : value.toLocaleString();

  return (
    <article
      className="stat-card"
      style={{
        '--card-accent': accentColor,
        '--card-accent-bg': accentBg,
        '--card-accent-border': accentBorder,
      }}
      aria-label={`${label}: ${displayValue}`}
    >
      <div className="stat-card-icon" aria-hidden="true">
        {icon}
      </div>

      <div className="stat-card-value" id={`metric-${label.toLowerCase().replace(/\s+/g, '-')}`}>
        {displayValue}
      </div>

      <div className="stat-card-label">{label}</div>

      {trend && (
        <div className={`stat-card-trend ${trendUp ? 'up' : 'neutral'}`}>
          <span aria-hidden="true">{trendUp ? '↑' : '→'}</span>
          <span>{trend}</span>
        </div>
      )}
    </article>
  );
};

export default AnalyticsCard;
