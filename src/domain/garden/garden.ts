import { createLocalFrame, toLocal, vertexCentroid } from '../geometry/projection';
import { computeStats, ensureCCW, validateBoundary } from '../geometry/polygon';
import type { Garden, GardenObject, LngLat, LocalPoint, ObjectKind } from './types';
import { timezoneForLocation, todayInZone } from '../sun/gardenTime';

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
