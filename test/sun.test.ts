import { afterEach, describe, expect, it } from 'vitest';
import spa from './fixtures/spa-reference.json';
import ref from './fixtures/geo-reference.json';
import { gardenSun, shadowRatio, sunPosition, sunVector } from '../src/sun/sun';
import {
  deviceTimezone,
  formatClock,
  formatOffset,
  offsetMinutesAt,
  supportsIntlTimeZones,
  timezoneForLocation,
  utcToZoned,
  zonedToUtc,
} from '../src/sun/time';

const angDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

describe('sun position vs NREL SPA (pvlib) reference', () => {
  it('stays within 0.3° altitude and 0.5° azimuth', () => {
    let maxAlt = 0;
    let maxAz = 0;
    let night = 0;
    for (const r of spa.rows) {
      const p = sunPosition(Date.parse(r.utc), r.lat, r.lon);
      if (r.elevation < -1) {
        // Night: only the sign matters for shading; refraction models diverge below the horizon.
        expect(p.altitudeDeg, `${r.name} ${r.local}`).toBeLessThan(0);
        night++;
        continue;
      }
      const altErr = Math.abs(p.altitudeDeg - r.apparentElevation);
      const azErr = angDiff(p.azimuthDeg, r.azimuth);
      maxAlt = Math.max(maxAlt, altErr);
      maxAz = Math.max(maxAz, azErr);
      expect(altErr, `${r.name} ${r.local}`).toBeLessThan(0.3);
      expect(azErr, `${r.name} ${r.local}`).toBeLessThan(0.5);
    }
    expect(night).toBeLessThan(spa.rows.length / 2);
    console.log(
      `suncalc vs SPA: max |Δalt| = ${maxAlt.toFixed(3)}°, max |Δaz| = ${maxAz.toFixed(3)}° over ${spa.rows.length - night} daytime cases`,
    );
  });

  it('sun vector points south and up at Kraków solar noon in June', () => {
    const r = spa.rows.find((x) => x.name === 'Krakow' && x.local === '2026-06-21T12:00')!;
    const v = sunVector(sunPosition(Date.parse(r.utc), r.lat, r.lon));
    expect(v.n).toBeLessThan(0); // sun is to the south
    expect(v.u).toBeGreaterThan(0.85); // ~62° elevation (12:00 CEST is before solar noon at 12:42)
    expect(Math.hypot(v.e, v.n, v.u)).toBeCloseTo(1, 9);
  });

  it('shadow ratio is 1 at 45° and infinite at night', () => {
    expect(shadowRatio(45)).toBeCloseTo(1, 9);
    expect(shadowRatio(-2)).toBe(Infinity);
  });

  it('sunrise/sunset/transit within 2 minutes of SPA', () => {
    for (const r of ref.sunTimes) {
      const s = gardenSun(r.lat, r.lon, r.tz, r.date, 12 * 60);
      expect(Math.abs(s.sunriseMin! - r.sunriseMin), `${r.name} ${r.date} sunrise`).toBeLessThan(2);
      expect(Math.abs(s.sunsetMin! - r.sunsetMin), `${r.name} ${r.date} sunset`).toBeLessThan(2);
      expect(Math.abs(s.solarNoonMin! - r.transitMin), `${r.name} ${r.date} noon`).toBeLessThan(2);
    }
  });
});

describe('garden time zones', () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it('the engine supports Intl time zones', () => {
    expect(supportsIntlTimeZones()).toBe(true);
  });

  it('looks up the garden zone from coordinates', () => {
    expect(timezoneForLocation(50.0614, 19.9366)).toBe('Europe/Warsaw');
    expect(timezoneForLocation(-33.8688, 151.2093)).toBe('Australia/Sydney');
    expect(timezoneForLocation(40.7128, -74.006)).toBe('America/New_York');
  });

  it('converts garden wall time to UTC exactly as Python zoneinfo does', () => {
    for (const r of spa.rows) {
      const [date, hm] = r.local.split('T');
      const [h, m] = hm.split(':').map(Number);
      const z = zonedToUtc(r.tz, date, h * 60 + m);
      expect(new Date(z.utcMs).toISOString(), `${r.tz} ${r.local}`).toBe(new Date(r.utc).toISOString());
      expect(z.offsetMinutes).toBe(r.offsetMinutes);
    }
  });

  it('handles DST gaps and overlaps (Warsaw, Sydney, New York)', () => {
    for (const d of ref.dst) {
      const z = zonedToUtc(d.tz, d.date, d.minutes);
      expect(new Date(z.utcMs).toISOString(), `${d.tz} ${d.date} ${formatClock(d.minutes)}`).toBe(new Date(d.utc).toISOString());
      const back = utcToZoned(d.tz, z.utcMs);
      expect(formatClock(back.hour * 60 + back.minute)).toBe(d.wallBack);
      expect(back.offsetMinutes).toBe(d.offsetMinutes);
    }
    expect(zonedToUtc('Europe/Warsaw', '2026-03-29', 150).nonexistent).toBe(true);
    expect(zonedToUtc('Europe/Warsaw', '2026-10-25', 150).ambiguous).toBe(true);
    expect(zonedToUtc('Europe/Warsaw', '2026-07-01', 600).ambiguous).toBe(false);
  });

  it('does not depend on the phone time zone', () => {
    const results: number[] = [];
    for (const tz of ['America/Los_Angeles', 'Asia/Tokyo', 'UTC']) {
      process.env.TZ = tz;
      expect(deviceTimezone()).toBe(tz);
      const s = gardenSun(50.0614, 19.9366, 'Europe/Warsaw', '2026-06-21', 12 * 60);
      results.push(s.instant.utcMs);
      expect(s.position.azimuthDeg).toBeGreaterThan(150); // SE–S before solar noon
      expect(s.position.azimuthDeg).toBeLessThan(170);
    }
    expect(new Set(results).size).toBe(1);
  });

  it('formats offsets including half/quarter hours', () => {
    expect(formatOffset(120)).toBe('UTC+2');
    expect(formatOffset(345)).toBe('UTC+5:45');
    expect(formatOffset(-210)).toBe('UTC−3:30');
    expect(offsetMinutesAt('Asia/Kathmandu', Date.UTC(2026, 5, 1))).toBe(345);
  });

  it('reports polar day and night', () => {
    const summer = gardenSun(78.22, 15.65, 'Arctic/Longyearbyen', '2026-06-21', 720);
    expect(summer.alwaysUp).toBe(true);
    const winter = gardenSun(78.22, 15.65, 'Arctic/Longyearbyen', '2026-12-21', 720);
    expect(winter.alwaysDown).toBe(true);
    expect(winter.isUp).toBe(false);
  });
});
