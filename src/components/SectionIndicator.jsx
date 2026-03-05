import React from "react";

export default function SectionIndicator({ centroid, freeCount, color }) {
  const lineStartY = centroid.y - 8;
  const lineEndY = centroid.y - 48;
  const overlayW = 100;
  const overlayH = 22;
  const overlayX = centroid.x - overlayW / 2;
  const overlayY = lineEndY - overlayH - 8;
  return (
    <g className="section-indicator" pointerEvents="none">
      <circle
        cx={centroid.x}
        cy={centroid.y}
        r={8}
        style={{ fill: color, stroke: "#ffffff", strokeWidth: 1.2 }}
        className="indicator-dot"
      />
      <line
        x1={centroid.x}
        y1={lineStartY}
        x2={centroid.x}
        y2={lineEndY}
        stroke={color}
        className="indicator-line"
      />
      <rect
        x={overlayX}
        y={overlayY}
        width={overlayW}
        height={overlayH}
        className="indicator-overlay"
        rx={6}
        ry={6}
      />
      <text
        x={centroid.x}
        y={overlayY + overlayH / 2}
        className="indicator-overlay-text"
      >
        {freeCount} free tables
      </text>
    </g>
  );
}
