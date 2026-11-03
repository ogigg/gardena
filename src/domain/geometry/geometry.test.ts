import { describe, expect, it } from 'vitest';
import { createLocalFrame, haversineM, toGeo, toLocal } from './projection';
import { computeStats, ensureCCW, findCrossingEdges, pointInPolygon, signedArea, triangulate, validateBoundary } from './polygon';
import type { LngLat, LocalPoint } from '../garden/types';
import ref from '../../../tests/fixtures/geo-reference.json';

const ORIGIN: LngLat = [19.9366, 50.0614]; // Kraków
const frame = createLocalFrame(ORIGIN);
const geo = (pts: LocalPoint[]) => pts.map((p) => toGeo(frame, p));

describe('local metric frame', () => {
  it('matches WGS84 geodesics (pyproj/Karney) to the centimetre', () => {
    for (const r of ref.geodesic) {
      const f = createLocalFrame([r.lon0, r.lat0]);
      const p = toLocal(f, [r.lon, r.lat]);
      const az = (r.azimuth * Math.PI) / 180;
      expect(Math.abs(p.e - r.distance * Math.sin(az))).toBeLessThan(0.01);
      expect(Math.abs(p.n - r.distance * Math.cos(az))).toBeLessThan(0.01);
    }
  });

  it('agrees with a spherical haversine distance within 0.5%', () => {
    for (const d of [10, 50, 200]) {
      for (const pt of [toGeo(frame, { e: d, n: 0 }), toGeo(frame, { e: 0, n: d })]) {
        expect(Math.abs(haversineM(ORIGIN, pt) - d) / d).toBeLessThan(0.005);
      }
    }
  });

  it('maps north to +n and east to +e', () => {
    const n = toLocal(frame, [ORIGIN[0], ORIGIN[1] + 0.001]);
    const e = toLocal(frame, [ORIGIN[0] + 0.001, ORIGIN[1]]);
    expect(n.n).toBeGreaterThan(100);
    expect(Math.abs(n.e)).toBeLessThan(1e-9);
    expect(e.e).toBeGreaterThan(60);
    expect(Math.abs(e.n)).toBeLessThan(1e-9);
    // 0.001° of latitude ≈ 111.2 m at 50°N; 0.001° of longitude ≈ 71.7 m
    expect(n.n).toBeCloseTo(111.2, 0);
    expect(e.e).toBeCloseTo(71.7, 0);
  });

  it('round-trips coordinates to sub-millimetre', () => {
    const p: LocalPoint = { e: 37.25, n: -12.5 };
    const back = toLocal(frame, toGeo(frame, p));
    expect(back.e).toBeCloseTo(p.e, 6);
    expect(back.n).toBeCloseTo(p.n, 6);
  });
});

const L_SHAPE: LocalPoint[] = [
  { e: 0, n: 0 },
  { e: 20, n: 0 },
  { e: 20, n: 8 },
  { e: 8, n: 8 },
  { e: 8, n: 15 },
  { e: 0, n: 15 },
];

describe('concave polygons', () => {
  it('computes the area of an L-shaped garden', () => {
    expect(signedArea(L_SHAPE)).toBeCloseTo(20 * 8 + 8 * 7, 6); // 216 m²
    const stats = computeStats(geo(L_SHAPE), ORIGIN);
    expect(stats.areaM2).toBeCloseTo(216, 1);
    expect(stats.perimeterM).toBeCloseTo(2 * (20 + 15), 1);
  });

  it('triangulates concave outlines without covering the notch', () => {
    const tris = triangulate(L_SHAPE);
    expect(tris.length / 3).toBe(L_SHAPE.length - 2);
    let sum = 0;
    for (let i = 0; i < tris.length; i += 3) {
      const t = [L_SHAPE[tris[i]], L_SHAPE[tris[i + 1]], L_SHAPE[tris[i + 2]]];
      sum += Math.abs(signedArea(t));
      const c = { e: (t[0].e + t[1].e + t[2].e) / 3, n: (t[0].n + t[1].n + t[2].n) / 3 };
      expect(pointInPolygon(c, L_SHAPE)).toBe(true);
    }
    expect(sum).toBeCloseTo(216, 6);
    expect(pointInPolygon({ e: 15, n: 12 }, L_SHAPE)).toBe(false); // the notch
  });

  it('triangulates a star (highly concave) polygon', () => {
    const star: LocalPoint[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 10 : 4;
      const a = (i / 10) * Math.PI * 2;
      star.push({ e: r * Math.cos(a), n: r * Math.sin(a) });
    }
    const tris = triangulate(star);
    let sum = 0;
    for (let i = 0; i < tris.length; i += 3) {
      sum += Math.abs(signedArea([star[tris[i]], star[tris[i + 1]], star[tris[i + 2]]]));
    }
    expect(sum).toBeCloseTo(Math.abs(signedArea(star)), 6);
    expect(validateBoundary(geo(star)).ok).toBe(true);
  });
});

describe('boundary validation', () => {
  it('requires three distinct points', () => {
    expect(
      validateBoundary(
        geo([
          { e: 0, n: 0 },
          { e: 5, n: 0 },
        ]),
      ).issues,
    ).toContain('too-few-points');
    const dup = geo([
      { e: 0, n: 0 },
      { e: 0.01, n: 0 },
      { e: 5, n: 0 },
      { e: 5, n: 0.02 },
    ]);
    expect(validateBoundary(dup).issues).toContain('too-few-points');
  });

  it('rejects zero-area (collinear) outlines', () => {
    const v = validateBoundary(
      geo([
        { e: 0, n: 0 },
        { e: 5, n: 0 },
        { e: 10, n: 0 },
      ]),
    );
    expect(v.ok).toBe(false);
    expect(v.issues).toContain('zero-area');
  });

  it('rejects a bow-tie self-intersection and reports the crossing edges', () => {
    const bow: LocalPoint[] = [
      { e: 0, n: 0 },
      { e: 10, n: 10 },
      { e: 10, n: 0 },
      { e: 0, n: 10 },
    ];
    const v = validateBoundary(geo(bow));
    expect(v.issues).toContain('self-intersection');
    expect(findCrossingEdges(bow)).toEqual([[0, 2]]);
  });

  it('rejects a vertex touching a non-adjacent edge', () => {
    const touch: LocalPoint[] = [
      { e: 0, n: 0 },
      { e: 10, n: 0 },
      { e: 10, n: 10 },
      { e: 5, n: 0 },
      { e: 0, n: 10 },
    ];
    expect(validateBoundary(geo(touch)).issues).toContain('self-intersection');
  });

  it('drops a duplicated closing vertex and consecutive duplicates', () => {
    const ring = geo([
      { e: 0, n: 0 },
      { e: 10, n: 0 },
      { e: 10, n: 0 },
      { e: 10, n: 10 },
      { e: 0, n: 0 },
    ]);
    const v = validateBoundary(ring);
    expect(v.ok).toBe(true);
    expect(v.cleaned.length).toBe(3);
  });

  it('accepts valid concave outlines', () => {
    expect(validateBoundary(geo(L_SHAPE)).ok).toBe(true);
  });
});

describe('winding and orientation', () => {
  it('normalises clockwise rings to counter-clockwise', () => {
    const cw = [...L_SHAPE].reverse();
    expect(signedArea(cw)).toBeLessThan(0);
    const fixed = ensureCCW(cw, cw);
    expect(signedArea(fixed)).toBeGreaterThan(0);
  });

  it('reports dimensions and long-axis bearing of a rotated rectangle', () => {
    // 20 m × 10 m rectangle whose long axis points 30° east of north.
    const b = (30 * Math.PI) / 180;
    const along = { e: Math.sin(b), n: Math.cos(b) };
    const across = { e: Math.cos(b), n: -Math.sin(b) };
    const rect: LocalPoint[] = [
      [-10, -5],
      [10, -5],
      [10, 5],
      [-10, 5],
    ].map(([u, v]) => ({ e: along.e * u + across.e * v, n: along.n * u + across.n * v }));
    const s = computeStats(geo(rect), ORIGIN);
    expect(s.lengthM).toBeCloseTo(20, 2);
    expect(s.widthM).toBeCloseTo(10, 2);
    expect(s.orientationDeg).toBeCloseTo(30, 1);
    expect(s.areaM2).toBeCloseTo(200, 1);
  });

  it('reports east–west gardens as 90°', () => {
    const rect: LocalPoint[] = [
      { e: 0, n: 0 },
      { e: 30, n: 0 },
      { e: 30, n: 6 },
      { e: 0, n: 6 },
    ];
    expect(computeStats(geo(rect), ORIGIN).orientationDeg).toBeCloseTo(90, 3);
  });
});
