import type { AppConfig } from '../config/env';
import type { LngLat } from '../geo/types';

/**
 * Address search. Results are only used to move the camera; they are not
 * persisted (the garden record stores the user-drawn outline instead).
 */
export interface GeocodeResult {
  label: string;
  center: LngLat;
  bbox?: [number, number, number, number];
  source: string;
}

export class GeocodeError extends Error {
  constructor(
    message: string,
    public kind: 'network' | 'no-provider' | 'bad-response',
  ) {
    super(message);
  }
}

export interface Geocoder {
  id: string;
  name: string;
  attribution: string;
  search(query: string, signal?: AbortSignal): Promise<GeocodeResult[]>;
}

/** Parses "52.2297, 21.0122" or "52.2297 21.0122" (lat, lon). */
export function parseCoordinates(q: string): LngLat | null {
  const m = q.trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return [lon, lat];
}

type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal; headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

async function getJson(fetchImpl: FetchLike, url: string, signal?: AbortSignal): Promise<unknown> {
  let res;
  try {
    res = await fetchImpl(url, { signal, headers: { Accept: 'application/json' } });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    throw new GeocodeError('Could not reach the search service. Check your connection.', 'network');
  }
  if (!res.ok) throw new GeocodeError(`Search service answered ${res.status}.`, 'bad-response');
  try {
    return await res.json();
  } catch {
    throw new GeocodeError('Search service returned an unreadable answer.', 'bad-response');
  }
}

export function geoapifyGeocoder(apiKey: string, fetchImpl: FetchLike = fetch as unknown as FetchLike): Geocoder {
  return {
    id: 'geoapify',
    name: 'Geoapify',
    attribution: 'Powered by Geoapify · © OpenStreetMap contributors',
    async search(query, signal) {
      const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(query)}&format=json&limit=6&apiKey=${encodeURIComponent(apiKey)}`;
      const data = (await getJson(fetchImpl, url, signal)) as {
        results?: { lat: number; lon: number; formatted?: string; bbox?: { lon1: number; lat1: number; lon2: number; lat2: number } }[];
      };
      if (!data || !Array.isArray(data.results)) throw new GeocodeError('Unexpected search response.', 'bad-response');
      return data.results.map((r) => ({
        label: r.formatted ?? `${r.lat.toFixed(5)}, ${r.lon.toFixed(5)}`,
        center: [r.lon, r.lat] as LngLat,
        bbox: r.bbox
          ? ([
              Math.min(r.bbox.lon1, r.bbox.lon2),
              Math.min(r.bbox.lat1, r.bbox.lat2),
              Math.max(r.bbox.lon1, r.bbox.lon2),
              Math.max(r.bbox.lat1, r.bbox.lat2),
            ] as [number, number, number, number])
          : undefined,
        source: 'geoapify',
      }));
    },
  };
}

// --- EPSG:2180 (PUWG 1992) → WGS84, inverse transverse Mercator on GRS80 (Snyder 1987) ---
const GRS80_A = 6378137;
const GRS80_F = 1 / 298.257222101;

export function puwg1992ToWgs84(easting: number, northing: number): LngLat {
  const k0 = 0.9993;
  const lon0 = (19 * Math.PI) / 180;
  const x = easting - 500000;
  const y = northing + 5300000;
  const a = GRS80_A;
  const e2 = GRS80_F * (2 - GRS80_F);
  const ep2 = e2 / (1 - e2);
  const M = y / k0;
  const mu = M / (a * (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 * e2 * e2) / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 * e1) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const s = Math.sin(phi1);
  const c = Math.cos(phi1);
  const t = Math.tan(phi1);
  const C1 = ep2 * c * c;
  const T1 = t * t;
  const N1 = a / Math.sqrt(1 - e2 * s * s);
  const R1 = (a * (1 - e2)) / Math.pow(1 - e2 * s * s, 1.5);
  const D = x / (N1 * k0);
  const lat =
    phi1 -
    ((N1 * t) / R1) *
      ((D * D) / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6) / 720);
  const lon =
    lon0 + (D - ((1 + 2 * T1 + C1) * D ** 3) / 6 + ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5) / 120) / c;
  return [(lon * 180) / Math.PI, (lat * 180) / Math.PI];
}

/** Poland-only geocoder backed by the state address register (PRG) via GUGiK UUG. No key. */
export function gugikGeocoder(fetchImpl: FetchLike = fetch as unknown as FetchLike): Geocoder {
  return {
    id: 'gugik-uug',
    name: 'GUGiK address points (Poland)',
    attribution: 'Adresy: PRG © Główny Urząd Geodezji i Kartografii',
    async search(query, signal) {
      const url = `https://services.gugik.gov.pl/uug/?request=GetAddress&address=${encodeURIComponent(query)}`;
      const data = (await getJson(fetchImpl, url, signal)) as { results?: Record<string, Record<string, unknown>> | null };
      if (!data || typeof data !== 'object') throw new GeocodeError('Unexpected search response.', 'bad-response');
      const results = data.results ? Object.values(data.results) : [];
      const out: GeocodeResult[] = [];
      for (const r of results) {
        const wkt = typeof r.geometry_wkt === 'string' ? r.geometry_wkt : '';
        const m = wkt.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
        let e = m ? Number(m[1]) : Number(r.x);
        let n = m ? Number(m[2]) : Number(r.y);
        if (!isFinite(e) || !isFinite(n)) continue;
        // PUWG 1992 eastings are ~150k–870k, northings ~130k–780k; Polish "x" often means northing.
        let ll = puwg1992ToWgs84(e, n);
        if (ll[1] < 48.9 || ll[1] > 55) {
          [e, n] = [n, e];
          ll = puwg1992ToWgs84(e, n);
        }
        const label = [r.street ?? r.city, r.number, r.city && r.street ? r.city : undefined]
          .filter((v) => typeof v === 'string' && v.length > 0)
          .join(' ');
        out.push({ label: label || query, center: ll, source: 'gugik-uug' });
      }
      return out;
    },
  };
}

/** Geocoders in priority order. Coordinates typed by the user always work, offline. */
export function availableGeocoders(cfg: AppConfig, fetchImpl?: FetchLike): Geocoder[] {
  const list: Geocoder[] = [];
  if (cfg.geoapifyKey) list.push(geoapifyGeocoder(cfg.geoapifyKey, fetchImpl));
  list.push(gugikGeocoder(fetchImpl));
  return list;
}

/** Tries each geocoder in turn; returns the first non-empty result set. */
export async function searchAddress(
  geocoders: Geocoder[],
  query: string,
  signal?: AbortSignal,
): Promise<{ results: GeocodeResult[]; usedGeocoder?: Geocoder; errors: string[] }> {
  const coord = parseCoordinates(query);
  if (coord) {
    return { results: [{ label: `${coord[1].toFixed(5)}, ${coord[0].toFixed(5)}`, center: coord, source: 'coordinates' }], errors: [] };
  }
  const errors: string[] = [];
  for (const g of geocoders) {
    try {
      const results = await g.search(query, signal);
      if (results.length > 0) return { results, usedGeocoder: g, errors };
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') throw e;
      errors.push(`${g.name}: ${(e as Error).message}`);
    }
  }
  return { results: [], errors };
}
