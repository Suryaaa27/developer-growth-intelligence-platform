import React from 'react';

/**
 * 16 cells in the DevGrowth contribution matrix (4x4)
 * Coordinates: x, y in a 100x100 viewBox
 * fill: cell background / fill color
 * stroke: cell border color (if outline)
 * filled: boolean indicating filled vs empty
 */
const CELLS = [
  // Row 0
  { x: 12, y: 12, fill: '#161b22', stroke: '#262c36', filled: false },
  { x: 32, y: 12, fill: '#161b22', stroke: '#262c36', filled: false },
  { x: 52, y: 12, fill: '#161b22', stroke: '#262c36', filled: false },
  { x: 72, y: 12, fill: '#79c0ff', stroke: null, filled: true }, // Sky blue peak

  // Row 1
  { x: 12, y: 32, fill: '#161b22', stroke: '#262c36', filled: false },
  { x: 32, y: 32, fill: '#161b22', stroke: '#262c36', filled: false },
  { x: 52, y: 32, fill: '#4ade80', stroke: null, filled: true }, // Bright green
  { x: 72, y: 32, fill: '#2ea043', stroke: null, filled: true }, // Medium green

  // Row 2
  { x: 12, y: 52, fill: '#161b22', stroke: '#262c36', filled: false },
  { x: 32, y: 52, fill: '#4ade80', stroke: null, filled: true }, // Bright green
  { x: 52, y: 52, fill: '#196c2e', stroke: null, filled: true }, // Dark green
  { x: 72, y: 52, fill: '#124f24', stroke: null, filled: true }, // Deep green

  // Row 3
  { x: 12, y: 72, fill: '#4ade80', stroke: null, filled: true }, // Bright green
  { x: 32, y: 72, fill: '#124f24', stroke: null, filled: true }, // Deep green
  { x: 52, y: 72, fill: '#124f24', stroke: null, filled: true }, // Deep green
  { x: 72, y: 72, fill: '#0e3a1d', stroke: null, filled: true }, // Darkest green
];

/**
 * DevGrowth Logo Component
 * Supports 'mark' (icon only) or 'full' (icon + DevGrowth text).
 * Automatically conforms to Light and Dark themes via CSS tokens.
 */
const Logo = ({
  variant = 'full',
  size = 32,
  animated = true,
  className = '',
  ...props
}) => {
  const isMarkOnly = variant === 'mark';
  const markSize = size;
  const textSize = Math.round(size * 0.72);

  const markSvg = (
    <svg
      width={markSize}
      height={markSize}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="devgrowth-mark-svg"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
      aria-hidden="true"
    >
      {/* Outer rounded container */}
      <rect
        width="100"
        height="100"
        rx="22"
        fill="#0d1117"
        className="logo-mark-bg"
      />
      {/* 4x4 Grid Cells */}
      {CELLS.map((cell, index) => (
        <rect
          key={index}
          x={cell.x}
          y={cell.y}
          width="16"
          height="16"
          rx="4"
          fill={cell.fill}
          stroke={cell.stroke || 'none'}
          strokeWidth={cell.stroke ? '1.5' : '0'}
          className={`logo-cell ${cell.filled ? 'logo-cell--filled' : 'logo-cell--empty'} ${
            animated ? 'logo-cell--animated' : ''
          }`}
          style={{ '--i': index }}
        />
      ))}
    </svg>
  );

  if (isMarkOnly) {
    return (
      <span className={`devgrowth-logo devgrowth-logo--mark ${className}`} {...props}>
        {markSvg}
      </span>
    );
  }

  return (
    <span
      className={`devgrowth-logo devgrowth-logo--full ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${Math.max(8, Math.round(size * 0.3))}px`,
        textDecoration: 'none',
        lineHeight: 1,
      }}
      {...props}
    >
      {markSvg}
      <span
        className="devgrowth-logo-text"
        style={{
          fontSize: `${textSize}px`,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: 'var(--color-fg-default)',
          whiteSpace: 'nowrap',
          userSelect: 'none',
        }}
      >
        Dev<span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>Growth</span>
      </span>
    </span>
  );
};

export default Logo;

