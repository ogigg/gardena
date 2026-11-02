import { createLocalFrame, toGeo, toLocal, vertexCentroid } from '../geo/projection';
import { computeStats, ensureCCW, validateBoundary } from '../geo/polygon';
import type { ContextBuilding, Garden, GardenObject, LngLat, LocalPoint, ObjectKind } from '../geo/types';
import { timezoneForLocation, todayInZone } from '../sun/time';

export function makeId(prefix = 'g'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function localFrameOf(g: Pick<Garden, 'origin'>) {
  return createLocalFrame(g.origin);
}

export function localBoundary(g: Pick<Garden, 'origin' | 'boundary'>): LocalPoint[] {
  const f = createLocalFrame(g.origin);
  return g.boundary.map((p) => toLocal(f, p));
}

/** Normalises winding to counter-clockwise (east/north frame) so triangulation and normals are consistent. */
export function normaliseBoundary(boundary: LngLat[], origin: LngLat): LngLat[] {
  const f = createLocalFrame(origin);
  return ensureCCW(
    boundary,
    boundary.map((p) => toLocal(f, p)),
  );
}

export function createGarden(
  boundary: LngLat[],
  opts: { name?: string; isDemo?: boolean; imagery?: Garden['imagery']; nowMs?: number } = {},
): Garden {
  const v = validateBoundary(boundary);
  if (!v.ok) throw new Error(`Invalid boundary: ${v.issues.join(', ')}`);
  const origin = vertexCentroid(v.cleaned);
  const ring = normaliseBoundary(v.cleaned, origin);
  const timezone = timezoneForLocation(origin[1], origin[0]);
  const now = new Date(opts.nowMs ?? Date.now()).toISOString();
  const today = todayInZone(timezone, opts.nowMs);
  return {
    id: makeId('garden'),
    name: opts.name ?? 'My garden',
    createdAt: now,
    updatedAt: now,
    isDemo: !!opts.isDemo,
    origin,
    boundary: ring,
    timezone,
    groundLevelM: 0,
    stats: computeStats(ring, origin),
    imagery: opts.imagery,
    objects: [],
    context: { status: 'not-loaded', buildings: [] },
    sun: { date: today.date, minutes: 14 * 60 },
  };
}

/** Replaces the outline but keeps origin, objects, context and sun settings. */
export function withBoundary(g: Garden, boundary: LngLat[]): Garden {
  const v = validateBoundary(boundary);
  if (!v.ok) throw new Error(`Invalid boundary: ${v.issues.join(', ')}`);
  const ring = normaliseBoundary(v.cleaned, g.origin);
  return { ...g, boundary: ring, stats: computeStats(ring, g.origin), updatedAt: new Date().toISOString() };
}

export const OBJECT_DEFAULTS: Record<ObjectKind, Omit<GardenObject, 'id' | 'e' | 'n'>> = {
  bed: { kind: 'bed', label: 'Raised bed', rotationDeg: 0, width: 2.4, depth: 1.2, height: 0.35, heightSource: 'default' },
  tree: { kind: 'tree', label: 'Tree', rotationDeg: 0, width: 0.4, depth: 0.4, height: 6, heightSource: 'default', canopyRadius: 2.2 },
  building: { kind: 'building', label: 'Shed / building', rotationDeg: 0, width: 4, depth: 3, height: 3, heightSource: 'default' },
};

export function newObject(kind: ObjectKind, at: LocalPoint): GardenObject {
  return { ...OBJECT_DEFAULTS[kind], id: makeId(kind), e: at.e, n: at.n };
}

// ---------------------------------------------------------------- demo garden

/** A sample suburban plot near Kraków. Outline and buildings are invented for demonstration. */
const DEMO_ORIGIN: LngLat = [19.9002, 50.0868];
const DEMO_OUTLINE_LOCAL: LocalPoint[] = [
  { e: -11, n: -9 },
  { e: 12, n: -9 },
  { e: 12, n: 4 },
  { e: 3, n: 4 },
  { e: 3, n: 11 },
  { e: -11, n: 11 },
];

function demoBuilding(id: string, cx: number, cn: number, w: number, d: number, h: number): ContextBuilding {
  const f = createLocalFrame(DEMO_ORIGIN);
  const pts: LocalPoint[] = [
    { e: cx - w / 2, n: cn - d / 2 },
    { e: cx + w / 2, n: cn - d / 2 },
    { e: cx + w / 2, n: cn + d / 2 },
    { e: cx - w / 2, n: cn + d / 2 },
  ];
  return { id, footprint: pts.map((p) => toGeo(f, p)), height: h, heightSource: 'sample', sourceRef: 'sample' };
}

export function createDemoGarden(nowMs?: number): Garden {
  const f = createLocalFrame(DEMO_ORIGIN);
  const g = createGarden(
    DEMO_OUTLINE_LOCAL.map((p) => toGeo(f, p)),
    { name: 'Demo garden (sample data)', isDemo: true, imagery: { providerId: 'none', attribution: 'No imagery — demo' }, nowMs },
  );
  const lf = localFrameOf(g);
  const shift = (p: LocalPoint) => toLocal(lf, toGeo(f, p));
  const bed1 = shift({ e: -6, n: -4 });
  const bed2 = shift({ e: -6, n: 0 });
  const tree = shift({ e: 8, n: -5 });
  const shed = shift({ e: -7.5, n: 8 });
  return {
    ...g,
    objects: [
      { ...newObject('bed', bed1), label: 'Vegetable bed' },
      { ...newObject('bed', bed2), label: 'Herb bed', width: 1.8 },
      { ...newObject('tree', tree), label: 'Apple tree', height: 4.5, canopyRadius: 2 },
      { ...newObject('building', shed), label: 'Garden shed', width: 3, depth: 2.4, height: 2.4 },
    ],
    context: {
      status: 'sample',
      source: 'Sample data',
      attribution: 'Invented sample buildings — not real geographic data',
      buildings: [
        demoBuilding('sample-house', 0, -17, 11, 9, 8.5),
        demoBuilding('sample-neighbour', 22, 2, 9, 12, 7),
        demoBuilding('sample-block', -24, 6, 10, 26, 12),
      ],
      message: 'Sample buildings are invented to demonstrate shadows. They are not real.',
      radiusM: 80,
    },
  };
}
