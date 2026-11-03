import type { LngLat } from '../../domain/garden/types';
import { GeocodeError, getJson, type FetchLike, type GeocodeResult, type Geocoder } from './types';

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
