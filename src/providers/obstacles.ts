import type { ContextBuilding, HeightSource, LngLat, ObstacleContext } from '../geo/types';
import { createLocalFrame, toLocal } from '../geo/projection';

/**
 * Surrounding-building context from OpenStreetMap via the Overpass API.
 *
 * - The public overpass-api.de instance is a shared community service: fine for
 *   development, NOT for production traffic. Point EXPO_PUBLIC_OVERPASS_URL at a
 *   self-hosted instance or replace this module with pre-extracted tiles.
 * - OSM heights are sparse. Every height is labelled with its source; buildings
 *   without data get an ASSUMED default, never a precise-looking number.
 * - Data © OpenStreetMap contributors, ODbL.
 */
export const DEFAULT_BUILDING_HEIGHT_M = 6;
export const METRES_PER_LEVEL = 3;
export const CONTEXT_RADIUS_M = 80;
export const MAX_CONTEXT_BUILDINGS = 120;
export const OSM_ATTRIBUTION = 'Buildings © OpenStreetMap contributors (ODbL)';

/** Parses OSM height strings like "12", "12.5 m", "12m", "40'", "40 ft". Returns metres or null. */
export function parseOsmHeight(raw: string | undefined): number | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase().replace(',', '.');
  const ft = s.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft|feet)$/);
  if (ft) return Number(ft[1]) * 0.3048;
  const ftIn = s.match(/^(\d+)'\s*(\d+)"$/);
  if (ftIn) return Number(ftIn[1]) * 0.3048 + Number(ftIn[2]) * 0.0254;
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(?:m|metres|meters)?$/);
  if (m) {
    const v = Number(m[1]);
    return v > 0 && v < 1000 ? v : null;
  }
  return null;
}

export function heightFromTags(tags: Record<string, string> | undefined): {
  height: number;
  source: HeightSource;
  levels?: number;
} {
  const h = parseOsmHeight(tags?.height ?? tags?.['building:height']);
  if (h !== null) return { height: h, source: 'tagged' };
  const lv = Number(tags?.['building:levels']);
  if (isFinite(lv) && lv > 0 && lv < 200) {
    const roof = Number(tags?.['roof:levels']);
    const total = lv + (isFinite(roof) && roof > 0 ? roof * 0.5 : 0);
    return { height: Math.round(total * METRES_PER_LEVEL * 10) / 10, source: 'levels', levels: lv };
  }
  return { height: DEFAULT_BUILDING_HEIGHT_M, source: 'assumed' };
}

export function buildOverpassQuery(center: LngLat, radiusM: number): string {
  const [lon, lat] = center;
  const r = Math.round(radiusM);
  return `[out:json][timeout:20];(way["building"](around:${r},${lat},${lon});relation["building"]["type"="multipolygon"](around:${r},${lat},${lon}););out geom 400;`;
}

interface OverpassElement {
  type: 'way' | 'relation' | 'node';
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
  members?: { role: string; type: string; geometry?: { lat: number; lon: number }[] }[];
}

export function parseOverpass(json: unknown, center: LngLat, maxCount = MAX_CONTEXT_BUILDINGS): ContextBuilding[] {
  const els = (json as { elements?: OverpassElement[] })?.elements;
  if (!Array.isArray(els)) throw new Error('Unexpected Overpass response');
  const frame = createLocalFrame(center);
  const out: (ContextBuilding & { dist: number })[] = [];
  for (const el of els) {
    let ring: { lat: number; lon: number }[] | undefined;
    if (el.type === 'way') ring = el.geometry;
    else if (el.type === 'relation') ring = el.members?.find((m) => m.role === 'outer' && m.geometry)?.geometry;
    if (!ring || ring.length < 4) continue;
    let pts: LngLat[] = ring.map((g) => [g.lon, g.lat]);
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) pts = pts.slice(0, -1);
    if (pts.length < 3) continue;
    const { height, source, levels } = heightFromTags(el.tags);
    const local = pts.map((p) => toLocal(frame, p));
    const dist = Math.min(...local.map((p) => Math.hypot(p.e, p.n)));
    out.push({
      id: `osm-${el.type}-${el.id}`,
      footprint: pts,
      height,
      heightSource: source,
      levels,
      sourceRef: `osm:${el.type}/${el.id}`,
      dist,
    });
  }
  out.sort((a, b) => a.dist - b.dist);
  return out.slice(0, maxCount).map(({ dist: _d, ...b }) => b);
}

export async function fetchOsmContext(
  overpassUrl: string,
  center: LngLat,
  radiusM = CONTEXT_RADIUS_M,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ObstacleContext> {
  const base: Omit<ObstacleContext, 'status' | 'buildings'> = {
    source: 'OpenStreetMap (Overpass)',
    attribution: OSM_ATTRIBUTION,
    radiusM,
    fetchedAt: new Date().toISOString(),
  };
  try {
    const res = await fetchImpl(overpassUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: `data=${encodeURIComponent(buildOverpassQuery(center, radiusM))}`,
      signal,
    });
    if (!res.ok) {
      return {
        ...base,
        status: 'failed',
        buildings: [],
        message: `Building service answered ${res.status}. Shadows only include objects you add.`,
      };
    }
    const buildings = parseOverpass(await res.json(), center);
    if (buildings.length === 0) {
      return {
        ...base,
        status: 'empty',
        buildings,
        message: `No mapped buildings within ${radiusM} m. Missing buildings will not cast shadows — add them manually if needed.`,
      };
    }
    const assumed = buildings.filter((b) => b.heightSource === 'assumed').length;
    return {
      ...base,
      status: 'loaded',
      buildings,
      message:
        assumed > 0
          ? `${buildings.length} buildings loaded; ${assumed} have no height data and use an assumed ${DEFAULT_BUILDING_HEIGHT_M} m. Trees and unmapped structures are not included.`
          : `${buildings.length} buildings loaded. Trees and unmapped structures are not included.`,
    };
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    return {
      ...base,
      status: 'failed',
      buildings: [],
      message: 'Could not load surrounding buildings. Shadows only include objects you add.',
    };
  }
}
