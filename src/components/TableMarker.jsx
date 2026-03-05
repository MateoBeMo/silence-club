import React from "react";

export default function TableMarker({
  t,
  inActiveSection,
  visible,
  selected,
  editTablesMode,
  startTableDrag,
  removeTable,
  openForBooking,
}) {
  const visibleClass = visible ? "visible" : "";
  const selectedClass = selected && selected.id === t.id ? "selected" : "";
  return (
    <g
      key={t.id}
      className={`table ${t.status} ${inActiveSection ? "in-section" : ""} ${visibleClass} ${selectedClass}`}
      onClick={(ev) => {
        if (editTablesMode) {
          ev.stopPropagation();
          return;
        }
        if (t.status === "free") openForBooking(t);
      }}
      style={{
        cursor: editTablesMode ? "move" : t.status === "free" ? "pointer" : "not-allowed",
      }}
    >
      {/* spotlight ellipse under selected table */}
      {selected && selected.id === t.id && (
        <ellipse
          cx={t.x}
          cy={t.y + t.r * 1.8}
          rx={t.r * 1.8}
          ry={t.r * 0.9}
          className="spotlight"
          filter="url(#spotBlur)"
        />
      )}
      <circle
        cx={t.x}
        cy={t.y}
        r={t.r}
        onPointerDown={(ev) => {
          if (editTablesMode) startTableDrag(t, ev);
        }}
      />
      <text x={t.x} y={t.y + 4} textAnchor="middle" className="table-label">
        {t.id}
      </text>
      {editTablesMode && (
        <g>
          <rect
            x={t.x + t.r + 6}
            y={t.y - 10}
            width={20}
            height={20}
            className="table-remove"
            onClick={(ev) => {
              ev.stopPropagation();
              removeTable(t.id);
            }}
            rx={4}
            ry={4}
          />
          <text x={t.x + t.r + 16} y={t.y + 0} className="table-remove-label">
            ✕
          </text>
        </g>
      )}
    </g>
  );
}
