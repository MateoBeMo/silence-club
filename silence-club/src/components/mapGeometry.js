export function pointToSegmentDistance(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const c1 = vx * wx + vy * wy;
  const c2 = vx * vx + vy * vy;
  let t = c2 <= 0 ? 0 : c1 / c2;
  t = Math.max(0, Math.min(1, t));
  const projx = ax + t * vx;
  const projy = ay + t * vy;
  const dx = px - projx;
  const dy = py - projy;
  return Math.sqrt(dx * dx + dy * dy);
}

export function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i][0], yi = points[i][1];
    const xj = points[j][0], yj = points[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function polygonBounds(points, pad = 0) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [px, py] of points) {
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }
  const w = maxX - minX;
  const h = maxY - minY;
  const padX = w * pad;
  const padY = h * pad;
  return { x: minX - padX, y: minY - padY, w: w + padX * 2, h: h + padY * 2 };
}

export function polygonCentroid(points) {
  if (!points || points.length === 0) return { x: 0, y: 0 };
  let sumX = 0, sumY = 0;
  for (const [px, py] of points) {
    sumX += px;
    sumY += py;
  }
  return { x: sumX / points.length, y: sumY / points.length };
}

// returns a new points array with the inserted point near the nearest edge
export function insertPointToPoints(points, svgX, svgY) {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const d = pointToSegmentDistance(svgX, svgY, a[0], a[1], b[0], b[1]);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return [
    ...points.slice(0, bestIdx + 1),
    [svgX, svgY],
    ...points.slice(bestIdx + 1),
  ];
}
