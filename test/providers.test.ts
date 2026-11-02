import { describe, expect, it } from 'vitest';
import ref from './fixtures/geo-reference.json';
import {
  availableGeocoders,
  geoapifyGeocoder,
  gugikGeocoder,
  parseCoordinates,
  puwg1992ToWgs84,
  searchAddress,
} from '../src/providers/geocoding';
import { availableImagery, GUGIK_ORTHO, pickImagery } from '../src/providers/imagery';
import {
  buildOverpassQuery,
  DEFAULT_BUILDING_HEIGHT_M,
  fetchOsmContext,
  heightFromTags,
  parseOsmHeight,
  parseOverpass,
} from '../src/providers/obstacles';
import { readConfig } from '../src/config/env';

const jsonResponse = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });

describe('coordinates and Polish grid conversion', () => {
  it('parses typed lat/lon', () => {
    expect(parseCoordinates('50.0614, 19.9366')).toEqual([19.9366, 50.0614]);
    expect(parseCoordinates('50.0614 19.9366')).toEqual([19.9366, 50.0614]);
    expect(parseCoordinates('-33.86,151.2')).toEqual([151.2, -33.86]);
    expect(parseCoordinates('95, 10')).toBeNull();
    expect(parseCoordinates('Kraków')).toBeNull();
  });

  it('converts EPSG:2180 to WGS84 within 1 m of pyproj', () => {
    for (const p of ref.puwg1992) {
      const [lon, lat] = puwg1992ToWgs84(p.easting, p.northing);
      expect(Math.abs(lat - p.lat) * 111_000, p.name).toBeLessThan(1);
      expect(Math.abs(lon - p.lon) * 111_000 * Math.cos((p.lat * Math.PI) / 180), p.name).toBeLessThan(1);
    }
  });
});

describe('geocoders', () => {
  it('maps Geoapify results', async () => {
    const g = geoapifyGeocoder('k', () =>
      jsonResponse({
        results: [
          { lat: 50.06, lon: 19.93, formatted: 'Rynek Główny, Kraków', bbox: { lon1: 19.94, lat1: 50.07, lon2: 19.92, lat2: 50.05 } },
        ],
      }),
    );
    const r = await g.search('rynek');
    expect(r[0].center).toEqual([19.93, 50.06]);
    expect(r[0].bbox).toEqual([19.92, 50.05, 19.94, 50.07]);
  });

  it('maps GUGiK UUG results from PUWG 1992 WKT', async () => {
    const pk = ref.puwg1992[0];
    const g = gugikGeocoder(() =>
      jsonResponse({
        results: { '1': { city: 'Warszawa', street: 'plac Defilad', number: '1', geometry_wkt: `POINT(${pk.easting} ${pk.northing})` } },
      }),
    );
    const r = await g.search('Warszawa plac Defilad 1');
    expect(r[0].center[1]).toBeCloseTo(pk.lat, 4);
    expect(r[0].label).toContain('Defilad');
  });

  it('falls through providers and reports failures', async () => {
    const failing = { id: 'x', name: 'Broken', attribution: '', search: () => Promise.reject(new Error('offline')) };
    const empty = { id: 'y', name: 'Empty', attribution: '', search: () => Promise.resolve([]) };
    const r = await searchAddress([failing, empty], 'nowhere');
    expect(r.results).toEqual([]);
    expect(r.errors[0]).toContain('Broken');
  });

  it('typed coordinates bypass the network', async () => {
    const r = await searchAddress([], '50.1, 19.9');
    expect(r.results[0].source).toBe('coordinates');
  });

  it('surfaces HTTP and network errors as friendly messages', async () => {
    await expect(gugikGeocoder(() => jsonResponse({}, 503)).search('a')).rejects.toThrow('503');
    await expect(gugikGeocoder(() => Promise.reject(new TypeError('fail'))).search('a')).rejects.toThrow('connection');
  });

  it('works with no credentials (GUGiK only) and adds Geoapify when a key exists', () => {
    expect(availableGeocoders(readConfig()).map((g) => g.id)).toEqual(['gugik-uug']);
    expect(availableGeocoders({ ...readConfig(), geoapifyKey: 'abc' }).map((g) => g.id)).toEqual(['geoapify', 'gugik-uug']);
  });
});

describe('imagery selection', () => {
  it('uses GUGiK in Poland and nothing global unless Esri is explicitly enabled', () => {
    const cfg = readConfig();
    expect(pickImagery(availableImagery(cfg), [19.93, 50.06])?.id).toBe('gugik-orto');
    expect(pickImagery(availableImagery(cfg), [2.35, 48.85])).toBeUndefined();
    const withKeyOnly = availableImagery({ ...cfg, arcgisKey: 'k' });
    expect(withKeyOnly.map((p) => p.id)).toEqual(['gugik-orto']);
    const optIn = availableImagery({ ...cfg, arcgisKey: 'k', enableEsriImagery: true });
    expect(pickImagery(optIn, [2.35, 48.85])?.id).toBe('esri-world-imagery');
    expect(GUGIK_ORTHO.tiles[0]).toContain('TILEMATRIXSET=EPSG:3857');
  });
});

describe('OSM obstacle context', () => {
  it('parses height tags conservatively', () => {
    expect(parseOsmHeight('12')).toBe(12);
    expect(parseOsmHeight('12.5 m')).toBe(12.5);
    expect(parseOsmHeight('7,5')).toBe(7.5);
    expect(parseOsmHeight("40'")).toBeCloseTo(12.19, 2);
    expect(parseOsmHeight('tall')).toBeNull();
    expect(heightFromTags({ height: '9' })).toEqual({ height: 9, source: 'tagged' });
    expect(heightFromTags({ 'building:levels': '3' })).toEqual({ height: 9, source: 'levels', levels: 3 });
    expect(heightFromTags({ building: 'yes' })).toEqual({ height: DEFAULT_BUILDING_HEIGHT_M, source: 'assumed' });
  });

  it('builds a bounded query and parses ways and multipolygons', () => {
    expect(buildOverpassQuery([19.9, 50.08], 80)).toContain('around:80,50.08,19.9');
    const square = (lon: number, lat: number) => [
      { lat, lon },
      { lat, lon: lon + 0.0001 },
      { lat: lat + 0.0001, lon: lon + 0.0001 },
      { lat: lat + 0.0001, lon },
      { lat, lon },
    ];
    const b = parseOverpass(
      {
        elements: [
          { type: 'way', id: 1, tags: { building: 'house', 'building:levels': '2' }, geometry: square(19.9001, 50.0801) },
          {
            type: 'relation',
            id: 2,
            tags: { building: 'yes' },
            members: [{ role: 'outer', type: 'way', geometry: square(19.9005, 50.0805) }],
          },
          { type: 'way', id: 3, tags: { building: 'yes' }, geometry: [{ lat: 1, lon: 1 }] },
        ],
      },
      [19.9, 50.08],
    );
    expect(b.map((x) => x.id)).toEqual(['osm-way-1', 'osm-relation-2']);
    expect(b[0].footprint.length).toBe(4);
    expect(b[0].heightSource).toBe('levels');
    expect(b[1].heightSource).toBe('assumed');
  });

  it('degrades gracefully when the building service is unavailable', async () => {
    const down = (() => Promise.reject(new TypeError('network'))) as unknown as typeof fetch;
    const r1 = await fetchOsmContext('https://x', [19.9, 50.08], 80, down);
    expect(r1.status).toBe('failed');
    expect(r1.message).toMatch(/only include objects you add/);
    const busy = (() => jsonResponse({}, 429)) as unknown as typeof fetch;
    expect((await fetchOsmContext('https://x', [19.9, 50.08], 80, busy)).status).toBe('failed');
    const none = (() => jsonResponse({ elements: [] })) as unknown as typeof fetch;
    const r3 = await fetchOsmContext('https://x', [19.9, 50.08], 80, none);
    expect(r3.status).toBe('empty');
    expect(r3.message).toMatch(/will not cast shadows/);
  });
});
