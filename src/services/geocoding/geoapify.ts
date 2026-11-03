import type { LngLat } from '../../domain/garden/types';
import { GeocodeError, getJson, type FetchLike, type Geocoder } from './types';

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
