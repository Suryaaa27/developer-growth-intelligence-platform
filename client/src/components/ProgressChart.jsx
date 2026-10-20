/**
 * ProgressChart — placeholder for chart area
 * Will be replaced with a Recharts/Chart.js component in Step 3
 */
const ProgressChart = ({ title = 'Readiness Score Over Time' }) => (
  <div className="card">
    <p className="section-heading">{title}</p>
    <div className="coming-soon">
      <span className="coming-soon__label">Coming in Step 3</span>
      <span>A line chart showing role readiness score improvements over time will appear here once GitHub analysis runs.</span>
    </div>
  </div>
);

export default ProgressChart;
