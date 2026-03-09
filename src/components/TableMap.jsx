import { useState, useRef, useEffect } from "react";
import render from "../assets/Render_Amok_V3.png";
import "./TableMap.css";
import { initialTables, initialSections } from "./mapData";
import {
  pointInPolygon,
  polygonBounds,
  polygonCentroid,
  insertPointToPoints,
} from "./mapGeometry";
import SectionIndicator from "./SectionIndicator";
import TableMarker from "./TableMarker";
import BookingModal from "./BookingModal";

/* initialTables moved to ./mapData */

export default function TableMap() {
  const [tables, setTables] = useState(initialTables);
  const [selected, setSelected] = useState(null);
  const [booking, setBooking] = useState(null);
  const [customer, setCustomer] = useState("");
  // viewBox for SVG zooming (x, y, width, height)
  const BASE_W = 1000;
  const BASE_H = 600;
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: BASE_W, h: BASE_H });
  const rafRef = useRef(null);

  function openForBooking(table) {
    // zoom in on the table and open booking
    zoomTo(table.x, table.y, 2.2, 300);
    setTablesVisible(true);
    setSelected(table);
    setCustomer("");
  }

  function confirmBooking() {
    if (!selected) return;
    setTables((prev) =>
      prev.map((t) =>
        t.id === selected.id ? { ...t, status: "reserved" } : t,
      ),
    );
    if (selected.url) {
      window.open(selected.url, "_blank");
    }
    setSelected(null);
    setCustomer("");
    alert(`Booked ${selected.label} for ${customer || "a guest"}`);
    // hide tables after finishing booking
    setTablesVisible(false);
    setBooking(false);
  }

  function cancelBooking() {
    setSelected(null);
    setBooking(false);
    setCustomer("");
    // hide tables when user closes the booking dialog
    setTablesVisible(false);
  }

  // animate viewBox from current to target over duration(ms).
  // Accepts optional onComplete callback called after animation ends.
  function animateViewBox(to, duration = 300, onComplete) {
    const from = { ...viewBox };
    let start = null;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    function step(now) {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / duration);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOutQuad-ish
      const next = {
        x: from.x + (to.x - from.x) * eased,
        y: from.y + (to.y - from.y) * eased,
        w: from.w + (to.w - from.w) * eased,
        h: from.h + (to.h - from.h) * eased,
      };
      setViewBox(next);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else {
        rafRef.current = null;
        if (typeof onComplete === "function") onComplete();
      }
    }

    rafRef.current = requestAnimationFrame(step);
  }

  function clampViewBox(vb) {
    const w = Math.min(vb.w, BASE_W);
    const h = Math.min(vb.h, BASE_H);
    let x = Math.max(0, Math.min(vb.x, BASE_W - w));
    let y = Math.max(0, Math.min(vb.y, BASE_H - h));
    return { x, y, w, h };
  }

  // zoom to a center point (cx, cy) with scale (e.g., 2.0 means zoom in 2x)
  function zoomTo(cx, cy, scale = 2, duration = 300) {
    const targetW = BASE_W / scale;
    const targetH = BASE_H / scale;
    const tx = cx - targetW / 2;
    const ty = cy - targetH / 2;
    const target = clampViewBox({ x: tx, y: ty, w: targetW, h: targetH });
    animateViewBox(target, duration);
  }

  function resetZoom(duration = 300, onComplete) {
    animateViewBox({ x: 0, y: 0, w: BASE_W, h: BASE_H }, duration, onComplete);
  }

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // initial sections imported from mapData
  const [sections, setSections] = useState(initialSections);

  // localStorage key for persisting section polygons
  const SECTIONS_LS_KEY = "silence_club_sections_v1";
  const TABLES_LS_KEY = "silence_club_tables_v1";

  // Load persisted sections from localStorage on mount (if available)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SECTIONS_LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // defer to avoid calling setState synchronously inside the effect
          setTimeout(() => setSections(parsed), 0);
        }
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  // Load persisted tables from localStorage on mount (if available)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(TABLES_LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // defer to avoid calling setState synchronously inside the effect
          setTimeout(() => setTables(parsed), 0);
        }
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  // Persist sections to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(SECTIONS_LS_KEY, JSON.stringify(sections));
    } catch {
      // ignore quota errors
    }
  }, [sections]);

  // Persist tables to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(TABLES_LS_KEY, JSON.stringify(tables));
    } catch {
      // ignore
    }
  }, [tables]);

  const [activeSection, setActiveSection] = useState(null);
  // persist tables visibility once user has zoomed/acted
  const [tablesVisible, setTablesVisible] = useState(false);

  // Edit tables mode: add/drag/remove tables and assign to sections
  const [editTablesMode, setEditTablesMode] = useState(false);
  const tableDraggingRef = useRef({ id: null, offsetX: 0, offsetY: 0 });
  const lastTableDragAtRef = useRef(0);

  // --- editing helpers ---
  const [editMode, setEditMode] = useState(false);
  const svgRef = useRef(null);
  const draggingRef = useRef({ sectionId: null, pointIndex: -1 });

  // Detect dev mode (Vite exposes import.meta.env.DEV)
  const isDev =
    typeof import.meta !== "undefined" &&
    Boolean(import.meta.env && import.meta.env.DEV);

  // helper: convert client coordinates to SVG viewBox coordinates
  function clientToSvgCoords(clientX, clientY) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const x = viewBox.x + ((clientX - rect.left) / rect.width) * viewBox.w;
    const y = viewBox.y + ((clientY - rect.top) / rect.height) * viewBox.h;
    return { x, y };
  }

  function startDragPoint(sectionId, pointIndex, ev) {
    ev.stopPropagation();
    draggingRef.current = { sectionId, pointIndex };
    try {
      svgRef.current.setPointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
  }

  // ---- table dragging / editing ----
  function startTableDrag(table, ev) {
    ev.stopPropagation();
    const { x, y } = clientToSvgCoords(ev.clientX, ev.clientY);
    tableDraggingRef.current = {
      id: table.id,
      offsetX: x - table.x,
      offsetY: y - table.y,
    };
    try {
      svgRef.current.setPointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
  }

  function onPointerMove(ev) {
    // table dragging has priority
    if (tableDraggingRef.current.id) {
      const { x, y } = clientToSvgCoords(ev.clientX, ev.clientY);
      const { id, offsetX, offsetY } = tableDraggingRef.current;
      setTables((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, x: x - offsetX, y: y - offsetY } : t,
        ),
      );
      return;
    }

    if (!draggingRef.current.sectionId) return;
    const { x, y } = clientToSvgCoords(ev.clientX, ev.clientY);
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== draggingRef.current.sectionId) return s;
        const pts = s.points.map((p, i) =>
          i === draggingRef.current.pointIndex ? [x, y] : p,
        );
        return { ...s, points: pts };
      }),
    );
  }

  function endDragPoint(ev) {
    // finish table drag
    if (tableDraggingRef.current.id) {
      try {
        svgRef.current.releasePointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
      // assign to section if dropped inside one
      const tId = tableDraggingRef.current.id;
      const table = tables.find((x) => x.id === tId);
      if (table) {
        const s = sections.find((sec) =>
          pointInPolygon(table.x, table.y, sec.points),
        );
        if (s) {
          setTables((prev) =>
            prev.map((tt) => (tt.id === tId ? { ...tt, section: s.id } : tt)),
          );
        } else {
          setTables((prev) =>
            prev.map((tt) => (tt.id === tId ? { ...tt, section: null } : tt)),
          );
        }
      }
      tableDraggingRef.current = { id: null, offsetX: 0, offsetY: 0 };
      // store the event timestamp so we can ignore the subsequent click
      lastTableDragAtRef.current = ev.timeStamp || 0;
      return;
    }

    if (draggingRef.current.sectionId) {
      try {
        svgRef.current.releasePointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
    }
    draggingRef.current = { sectionId: null, pointIndex: -1 };
  }

  function addTableAt(svgX, svgY) {
    // derive next numeric id from existing tables to avoid id collisions
    const max = tables.reduce((m, t) => {
      if (t && typeof t.id === "string") {
        const mId = t.id.match(/^T(\d+)$/);
        return Math.max(m, mId ? Number(mId[1]) : 0);
      }
      return m;
    }, 0);
    const id = `T${max + 1}`;
    const newTable = {
      id,
      x: svgX,
      y: svgY,
      r: 10,
      label: id,
      status: "free",
      section: null,
    };
    // assign to section if inside one
    const s = sections.find((sec) => pointInPolygon(svgX, svgY, sec.points));
    if (s) newTable.section = s.id;
    setTables((prev) => [...prev, newTable]);
  }

  function removeTable(tableId) {
    setTables((prev) => prev.filter((t) => t.id !== tableId));
  }

  function removePointFromSection(sectionId, pointIndex) {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        if (s.points.length <= 3) return s; // keep at least 3
        const pts = s.points.filter((_, i) => i !== pointIndex);
        return { ...s, points: pts };
      }),
    );
  }

  

  // Geometry helpers moved to ./mapGeometry (pointInPolygon, polygonBounds, polygonCentroid, insertPointToPoints)

  // Export current sections to a JSON file (also attempts to copy to clipboard)
  function exportSections() {
    try {
      const data = JSON.stringify(sections, null, 2);
      // trigger download
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sections.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      // copy to clipboard if available (non-blocking)
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(data).catch(() => {});
      }
    } catch {
      // ignore
    }
  }

  function handleSectionClick(section) {
    // zoom to the polygon bounding box, then mark active
    const bounds = polygonBounds(section.points, 0.08);
    const target = clampViewBox(bounds);
    // don't trigger zoom when editing polygons
    if (editMode) {
      setActiveSection(section);
      return;
    }
    animateViewBox(target, 360, () => setActiveSection(section));
    // set immediately for quicker UI response
    setActiveSection(section);
    setTablesVisible(true);
  }

  function closeSection() {
    // clear any active selection/booking and close the active section
    setActiveSection(null);
    setSelected(null);
    setBooking(false);
    setCustomer("");
    // reset zoom and hide tables after the animation finishes
    resetZoom(320, () => setTablesVisible(false));
  }

  return (
    <div className="table-map-root">
      <h2>Amok - Interactive Floor Map Demo</h2>
      <div className="table-map-wrapper">
        <div className="table-map">
          <svg
            ref={svgRef}
            onPointerMove={onPointerMove}
            onPointerUp={endDragPoint}
            onPointerCancel={endDragPoint}
            onClick={(ev) => {
              // when in table-edit mode, clicking (not ctrl) adds a new table
              if (editTablesMode && !ev.ctrlKey) {
                // ignore clicks that immediately follow a drag (they generate click after pointerup)
                if (
                  lastTableDragAtRef.current &&
                  ev.timeStamp - lastTableDragAtRef.current < 350
                ) {
                  // clear the marker and ignore
                  lastTableDragAtRef.current = 0;
                  return;
                }
                const { x, y } = clientToSvgCoords(ev.clientX, ev.clientY);
                addTableAt(x, y);
                return;
              }
              // ctrl+click while editing sections -> add vertex to polygon under cursor
              if (editMode && ev.ctrlKey) {
                const { x, y } = clientToSvgCoords(ev.clientX, ev.clientY);
                // find section containing the clicked point (or the nearest whose boundary is close)
                const targetSection = sections.find((s) =>
                  pointInPolygon(x, y, s.points),
                );
                if (targetSection) {
                  setSections((prev) =>
                    prev.map((s) =>
                      s.id === targetSection.id
                        ? { ...s, points: insertPointToPoints(s.points, x, y) }
                        : s,
                    ),
                  );
                }
                return;
              }

              // if click is outside any section while a section is active, close it (zoom out)
              const { x, y } = clientToSvgCoords(ev.clientX, ev.clientY);
              const insideAny = sections.some((s) =>
                pointInPolygon(x, y, s.points),
              );
              if (!insideAny && activeSection && !editMode && !editTablesMode) {
                closeSection();
              }
            }}
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
            preserveAspectRatio="xMidYMid meet"
          >
            {/* defs for blur used by spotlight */}
            <defs>
              <filter
                id="spotBlur"
                x="-50%"
                y="-50%"
                width="200%"
                height="200%"
              >
                <feGaussianBlur stdDeviation="8" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* background floor plan image */}
            <image href={render} x="0" y="0" width="1000" height="600" />

            {/* sections (clickable) */}
            {sections.map((s) => (
              <g key={s.id} className="section-group">
                <polygon
                  points={s.points.map((p) => p.join(",")).join(" ")}
                  className={`section ${activeSection && activeSection.id === s.id ? "active" : ""}`}
                  onClick={() => handleSectionClick(s)}
                  style={{ cursor: editMode ? "crosshair" : "pointer" }}
                />
                {/* label placed at first point + small offset */}
                <text
                  x={s.points[0][0] + 8}
                  y={s.points[0][1] + 18}
                  className="section-label"
                >
                  {s.name}
                </text>

                {/* vertex handles (edit mode) */}
                {editMode &&
                  s.points.map((p, idx) => (
                    <g key={s.id + "-pt-" + idx}>
                      <circle
                        cx={p[0]}
                        cy={p[1]}
                        r={6}
                        className="vertex-handle"
                        onPointerDown={(ev) => startDragPoint(s.id, idx, ev)}
                      />
                      <text x={p[0] + 8} y={p[1] - 8} className="vertex-label">
                        {idx}
                      </text>
                      <rect
                        x={p[0] + 10}
                        y={p[1] - 16}
                        width={18}
                        height={18}
                        className="vertex-remove"
                        onClick={() => removePointFromSection(s.id, idx)}
                      />
                    </g>
                  ))}
                {/* show section indicator when nothing is selected (default map) */}
                {!activeSection &&
                  !selected &&
                  !editMode &&
                  (() => {
                    const centroid = polygonCentroid(s.points);
                    const freeCount = tables.filter(
                      (t) => t.section === s.id && t.status === "free",
                    ).length;
                    const color = freeCount > 0 ? "#2ecc71" : "#e74c3c"; // green if free, red otherwise
                    return (
                      <SectionIndicator key={s.id + "-indicator"} centroid={centroid} freeCount={freeCount} color={color} />
                    );
                  })()}
              </g>
            ))}

            {/* tables as circles (only visible when zoomed/active) */}
            {tables.map((t) => {
              const inActiveSection = activeSection ? t.section === activeSection.id : false;
              const visible = editTablesMode || inActiveSection;
              return (
                <TableMarker
                  key={t.id}
                  t={t}
                  inActiveSection={inActiveSection}
                  visible={visible}
                  selected={selected}
                  editTablesMode={editTablesMode}
                  startTableDrag={startTableDrag}
                  removeTable={removeTable}
                  openForBooking={openForBooking}
                />
              );
            })}
          </svg>
        </div>

        <div className="legend">
          <div>
            <span className="legend-dot free" /> Free
          </div>
          <div>
            <span className="legend-dot reserved" /> Reserved
          </div>
          <div className="legend-controls">
            {isDev && (
              <>
                <button
                  onClick={() => setEditMode((v) => !v)}
                  className="btn-muted"
                >
                  {editMode ? "Exit edit" : "Edit sections"}
                </button>
                <button
                  onClick={() => {
                    setEditTablesMode((v) => {
                      const next = !v;
                      if (next) setEditMode(false); // avoid conflicting edit modes
                      return next;
                    });
                  }}
                  className="btn-muted"
                >
                  {editTablesMode ? "Exit table edit" : "Edit tables"}
                </button>
                <button onClick={exportSections} className="btn-muted">
                  Export JSON
                </button>
              </>
            )}
            <button
              onClick={() => {
                // close any open dialog/section immediately
                setSelected(null);
                setActiveSection(null);
                setBooking(false);
                setCustomer("");
                // animate zoom out and hide tables when done
                resetZoom(320, () => setTablesVisible(false));
              }}
              className="btn-muted"
            >
              Reset zoom
            </button>
          </div>
        </div>
        {/* booking bar: appears when a table is selected */}
        {selected && (
          <div className="booking-bar">
            <div>
              <strong>{selected.id}</strong> — {selected.label}
            </div>
            <button className="btn-book" onClick={() => setBooking(true)}>
              Book now
            </button>
            <button className="btn-muted" onClick={() => setSelected(null)}>
              Cancel
            </button>
          </div>
        )}
      </div>


  <BookingModal booking={booking} selected={selected} customer={customer} setCustomer={setCustomer} onConfirm={confirmBooking} onCancel={cancelBooking} />
    </div>
  );
}
