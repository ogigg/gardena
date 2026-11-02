import type { LngLat, LocalPoint } from './types';

// WGS84 ellipsoid
const A = 6378137.0;
const F = 1 / 298.257223563;
const E2 = F * (2 - F);
const DEG = Math.PI / 180;

/**
 * Local tangent-plane projection around an origin. For a garden-sized area
 * (< 1 km) the error of this ellipsoidal equirectangular approximation is far
 * below a centimetre, and it keeps true north as +n and true scale in metres.
 */
export interface LocalFrame {
  origin: LngLat;
  /** Metres per degree of longitude at the origin latitude. */
  mPerDegLon: number;
  /** Metres per degree of latitude at the origin latitude. */
  mPerDegLat: number;
}

export function createLocalFrame(origin: LngLat): LocalFrame {
  const phi = origin[1] * DEG;
  const s = Math.sin(phi);
  const w = 1 - E2 * s * s;
  const N = A / Math.sqrt(w); // prime vertical radius
  const M = (A * (1 - E2)) / Math.pow(w, 1.5); // meridional radius
  return {
    origin,
    mPerDegLon: N * Math.cos(phi) * DEG,
    mPerDegLat: M * DEG,
  };
}

export function toLocal(frame: LocalFrame, p: LngLat): LocalPoint {
  return {
    e: (p[0] - frame.origin[0]) * frame.mPerDegLon,
    n: (p[1] - frame.origin[1]) * frame.mPerDegLat,
  };
}

export function toGeo(frame: LocalFrame, p: LocalPoint): LngLat {
  return [frame.origin[0] + p.e / frame.mPerDegLon, frame.origin[1] + p.n / frame.mPerDegLat];
}

/** Great-circle (haversine) distance in metres — used as an independent scale check. */
export function haversineM(a: LngLat, b: LngLat): number {
  const R = 6371008.8;
  const dLat = (b[1] - a[1]) * DEG;
  const dLon = (b[0] - a[0]) * DEG;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * DEG) * Math.cos(b[1] * DEG) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Simple centroid of vertices — good enough as a local-frame origin. */
export function vertexCentroid(points: LngLat[]): LngLat {
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p[0];
    y += p[1];
  }
  return [x / points.length, y / points.length];
}
