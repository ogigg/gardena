import type { LngLat } from '../../domain/garden/types';
import type { AppConfig } from '../../shared/config/env';
import { geoapifyGeocoder } from './geoapify';
import { gugikGeocoder } from './gugik';
import type { FetchLike, GeocodeResult, Geocoder } from './types';

export { geoapifyGeocoder } from './geoapify';
export { gugikGeocoder, puwg1992ToWgs84 } from './gugik';
export { GeocodeError, type GeocodeResult, type Geocoder } from './types';

/** Parses "52.2297, 21.0122" or "52.2297 21.0122" (lat, lon). */
export function parseCoordinates(q: string): LngLat | null {
  const m = q.trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return [lon, lat];
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
