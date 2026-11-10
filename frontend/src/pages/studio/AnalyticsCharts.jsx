import React, { useState } from 'react';

const WIDTH = 320;
const HEIGHT = 110;
const PAD = { top: 10, right: 10, bottom: 20, left: 34 };

const niceMax = (value) => {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((candidate) => candidate * magnitude >= value);
  return step * magnitude;
};

const shortDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** One measure, one chart: these have very different scales, so they never share an axis. */
const MiniChart = ({ title, series, field }) => {
  const [hover, setHover] = useState(null);
  const values = series.map((day) => Math.max(day[field], 0));
  const maxValue = niceMax(Math.max(...values, 1));
  const innerWidth = WIDTH - PAD.left - PAD.right;
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (index) => PAD.left + (series.length > 1 ? (index / (series.length - 1)) * innerWidth : innerWidth / 2);
  const y = (value) => PAD.top + innerHeight - (value / maxValue) * innerHeight;
  const points = values.map((value, index) => `${x(index)},${y(value)}`).join(' ');
  const total = values.reduce((sum, value) => sum + value, 0);

  const onMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (((event.clientX - rect.left) / rect.width) * WIDTH - PAD.left) / innerWidth;
    setHover(Math.max(0, Math.min(series.length - 1, Math.round(ratio * (series.length - 1)))));
  };

  return (
    <figure className="fw-chart">
      <figcaption>
        <span>{title}</span>
        <strong>{total.toLocaleString()}</strong>
      </figcaption>
      <div className="fw-chart-plot">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={`${title}: ${total} over ${series.length} days. See the table for daily values.`}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <line className="fw-chart-grid" x1={PAD.left} x2={WIDTH - PAD.right} y1={y(maxValue)} y2={y(maxValue)} />
          <line className="fw-chart-grid" x1={PAD.left} x2={WIDTH - PAD.right} y1={y(0)} y2={y(0)} />
          <text className="fw-chart-axis" x={PAD.left - 6} y={y(maxValue) + 3} textAnchor="end">{maxValue.toLocaleString()}</text>
          <text className="fw-chart-axis" x={PAD.left - 6} y={y(0) + 3} textAnchor="end">0</text>
          <text className="fw-chart-axis" x={PAD.left} y={HEIGHT - 5}>{shortDate(series[0].date)}</text>
          <text className="fw-chart-axis" x={WIDTH - PAD.right} y={HEIGHT - 5} textAnchor="end">{shortDate(series[series.length - 1].date)}</text>
          <polyline className="fw-chart-line" points={points} />
          {hover !== null && (
            <>
              <line className="fw-chart-cross" x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={y(0)} />
              <circle className="fw-chart-dot" cx={x(hover)} cy={y(values[hover])} r="4" />
            </>
          )}
        </svg>
        {hover !== null && (
          <div className="fw-chart-tip" style={{ left: `${(x(hover) / WIDTH) * 100}%` }} role="status">
            <span>{shortDate(series[hover].date)}</span>
            <strong>{values[hover].toLocaleString()}</strong>
          </div>
        )}
      </div>
    </figure>
  );
};

const AnalyticsCharts = ({ series }) => {
  const [showTable, setShowTable] = useState(false);
  if (!series?.length) return null;

  return (
    <div>
      <div className="fw-chart-row">
        <MiniChart title="Views" series={series} field="views" />
        <MiniChart title="Downloads" series={series} field="downloads" />
        <MiniChart title="Likes" series={series} field="likes" />
      </div>
      <button type="button" className="fw-link" onClick={() => setShowTable((value) => !value)} aria-expanded={showTable}>
        {showTable ? 'Hide daily table' : 'Show daily table'}
      </button>
      {showTable && (
        <div className="fw-table-wrap">
          <table className="fw-table">
            <thead>
              <tr><th scope="col">Date</th><th scope="col" className="fw-num">Views</th><th scope="col" className="fw-num">Downloads</th><th scope="col" className="fw-num">Likes</th></tr>
            </thead>
            <tbody>
              {[...series].reverse().map((day) => (
                <tr key={day.date}>
                  <td>{shortDate(day.date)}</td>
                  <td className="fw-num">{day.views}</td>
                  <td className="fw-num">{day.downloads}</td>
                  <td className="fw-num">{day.likes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AnalyticsCharts;
