import earcut from 'earcut';
import { createLocalFrame, toLocal, vertexCentroid } from './projection';
import type { GardenStats, LngLat, LocalPoint } from './types';

export const MIN_AREA_M2 = 1;
/** Vertices closer than this (metres) are treated as the same point. */
export const DUPLICATE_TOLERANCE_M = 0.05;

export type BoundaryIssue = 'too-few-points' | 'zero-area' | 'self-intersection' | 'too-large';

export interface BoundaryValidation {
  ok: boolean;
  issues: BoundaryIssue[];
  /** Cleaned open ring (duplicates removed), original geographic coordinates. */
  cleaned: LngLat[];
  /** Index pairs of edges that cross (edge i runs from vertex i to i+1). */
  crossingEdges: [number, number][];
}

export const ISSUE_TEXT: Record<BoundaryIssue, string> = {
  'too-few-points': 'Add at least three distinct corners.',
  'zero-area': 'The outline has (almost) no area — spread the corners out.',
  'self-intersection': 'The outline crosses itself. Move a corner so edges do not cross.',
  'too-large': 'This outline is larger than 5 ha — the prototype is tuned for gardens.',
};

/** Signed shoelace area in m². Positive = counter-clockwise when east is x and north is y. */
export function signedArea(pts: LocalPoint[]): number {
  let s = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    s += pts[j].e * pts[i].n - pts[i].e * pts[j].n;
  }
  return s / 2;
}

export function perimeter(pts: LocalPoint[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += Math.hypot(b.e - a.e, b.n - a.n);
  }
  return s;
}

/** Returns a copy wound counter-clockwise (east-north frame). */
export function ensureCCW<T>(ring: T[], local: LocalPoint[]): T[] {
  return signedArea(local) < 0 ? [...ring].reverse() : [...ring];
}

function orient(a: LocalPoint, b: LocalPoint, c: LocalPoint): number {
  return (b.e - a.e) * (c.n - a.n) - (b.n - a.n) * (c.e - a.e);
}

function onSegment(a: LocalPoint, b: LocalPoint, p: LocalPoint, eps: number): boolean {
  return (
    Math.min(a.e, b.e) - eps <= p.e && p.e <= Math.max(a.e, b.e) + eps && Math.min(a.n, b.n) - eps <= p.n && p.n <= Math.max(a.n, b.n) + eps
  );
}

/** Segment intersection including touching and collinear overlap. */
export function segmentsIntersect(p1: LocalPoint, p2: LocalPoint, p3: LocalPoint, p4: LocalPoint, eps = 1e-9): boolean {
  const d1 = orient(p3, p4, p1);
  const d2 = orient(p3, p4, p2);
  const d3 = orient(p1, p2, p3);
  const d4 = orient(p1, p2, p4);
  if (((d1 > eps && d2 < -eps) || (d1 < -eps && d2 > eps)) && ((d3 > eps && d4 < -eps) || (d3 < -eps && d4 > eps))) {
    return true;
  }
  if (Math.abs(d1) <= eps && onSegment(p3, p4, p1, eps)) return true;
  if (Math.abs(d2) <= eps && onSegment(p3, p4, p2, eps)) return true;
  if (Math.abs(d3) <= eps && onSegment(p1, p2, p3, eps)) return true;
  if (Math.abs(d4) <= eps && onSegment(p1, p2, p4, eps)) return true;
  return false;
}

/** All pairs of non-adjacent edges of a closed ring that intersect. O(n²) — fine for hand-drawn outlines. */
export function findCrossingEdges(pts: LocalPoint[]): [number, number][] {
  const n = pts.length;
  const out: [number, number][] = [];
  if (n < 4) {
    // A triangle can only "self-intersect" if degenerate, which zero-area catches.
    return out;
  }
  for (let i = 0; i < n; i++) {
    const a1 = pts[i];
    const a2 = pts[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      // skip adjacent edges (they share a vertex)
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      const b1 = pts[j];
      const b2 = pts[(j + 1) % n];
      if (segmentsIntersect(a1, a2, b1, b2, 1e-6)) out.push([i, j]);
    }
  }
  return out;
}

/** Removes consecutive duplicate vertices (and a duplicated closing vertex). */
export function dedupeRing(points: LngLat[], toleranceM = DUPLICATE_TOLERANCE_M): LngLat[] {
  if (points.length === 0) return [];
  const frame = createLocalFrame(vertexCentroid(points));
  const out: LngLat[] = [];
  let last: LocalPoint | null = null;
  for (const p of points) {
    const l = toLocal(frame, p);
    if (last && Math.hypot(l.e - last.e, l.n - last.n) < toleranceM) continue;
    out.push(p);
    last = l;
  }
  while (out.length > 1) {
    const a = toLocal(frame, out[0]);
    const b = toLocal(frame, out[out.length - 1]);
    if (Math.hypot(a.e - b.e, a.n - b.n) < toleranceM) out.pop();
    else break;
  }
  return out;
}

export function validateBoundary(points: LngLat[]): BoundaryValidation {
  const cleaned = dedupeRing(points);
  const issues: BoundaryIssue[] = [];
  if (cleaned.length < 3) {
    return { ok: false, issues: ['too-few-points'], cleaned, crossingEdges: [] };
  }
  const frame = createLocalFrame(vertexCentroid(cleaned));
  const local = cleaned.map((p) => toLocal(frame, p));
  const area = Math.abs(signedArea(local));
  if (area < MIN_AREA_M2) issues.push('zero-area');
  const crossingEdges = findCrossingEdges(local);
  if (crossingEdges.length > 0) issues.push('self-intersection');
  if (area > 50_000) issues.push('too-large');
  return { ok: issues.length === 0, issues, cleaned, crossingEdges };
}

/** Triangulates a simple (possibly concave) polygon. Returns vertex index triples into `pts`. */
export function triangulate(pts: LocalPoint[]): number[] {
  const flat: number[] = [];
  for (const p of pts) flat.push(p.e, p.n);
  return earcut(flat, undefined, 2);
}

function convexHull(pts: LocalPoint[]): LocalPoint[] {
  const s = [...pts].sort((a, b) => a.e - b.e || a.n - b.n);
  if (s.length < 3) return s;
  const lower: LocalPoint[] = [];
  for (const p of s) {
    while (lower.length >= 2 && orient(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: LocalPoint[] = [];
  for (let i = s.length - 1; i >= 0; i--) {
    const p = s[i];
    while (upper.length >= 2 && orient(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/** Minimum-area bounding rectangle via hull edge directions. */
export function minimumBoundingRect(pts: LocalPoint[]): { length: number; width: number; bearingDeg: number } {
  const hull = convexHull(pts);
  let best = { area: Infinity, length: 0, width: 0, bearingDeg: 0 };
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const ang = Math.atan2(b.n - a.n, b.e - a.e);
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    let minU = Infinity,
      maxU = -Infinity,
      minV = Infinity,
      maxV = -Infinity;
    for (const p of hull) {
      const u = p.e * c + p.n * s;
      const v = -p.e * s + p.n * c;
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
    }
    const du = maxU - minU;
    const dv = maxV - minV;
    const area = du * dv;
    if (area < best.area - 1e-9) {
      // long axis direction as a compass bearing (clockwise from north)
      const longAng = du >= dv ? ang : ang + Math.PI / 2;
      let bearing = 90 - (longAng * 180) / Math.PI;
      bearing = ((bearing % 180) + 180) % 180;
      best = { area, length: Math.max(du, dv), width: Math.min(du, dv), bearingDeg: bearing };
    }
  }
  return { length: best.length, width: best.width, bearingDeg: best.bearingDeg };
}

export function computeStats(boundary: LngLat[], origin?: LngLat): GardenStats {
  const frame = createLocalFrame(origin ?? vertexCentroid(boundary));
  const local = boundary.map((p) => toLocal(frame, p));
  const mbr = minimumBoundingRect(local);
  return {
    areaM2: Math.abs(signedArea(local)),
    perimeterM: perimeter(local),
    lengthM: mbr.length,
    widthM: mbr.width,
    orientationDeg: mbr.bearingDeg,
  };
}

export function pointInPolygon(p: LocalPoint, ring: LocalPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (a.n > p.n !== b.n > p.n && p.e < ((b.e - a.e) * (p.n - a.n)) / (b.n - a.n) + a.e) inside = !inside;
  }
  return inside;
}

export function bboxOf(points: LngLat[]): [number, number, number, number] {
  let w = Infinity,
    s = Infinity,
    e = -Infinity,
    n = -Infinity;
  for (const p of points) {
    w = Math.min(w, p[0]);
    e = Math.max(e, p[0]);
    s = Math.min(s, p[1]);
    n = Math.max(n, p[1]);
  }
  return [w, s, e, n];
}

export function compassLabel(bearingDeg: number): string {
  const names = ['N–S', 'NNE–SSW', 'NE–SW', 'ENE–WSW', 'E–W', 'ESE–WNW', 'SE–NW', 'SSE–NNW'];
  return names[Math.round((((bearingDeg % 180) + 180) % 180) / 22.5) % 8];
}
