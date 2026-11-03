import { getPosition, getTimes } from 'suncalc';
import { offsetMinutesAt, utcToZoned, zonedToUtc, type ZonedToUtcResult } from './gardenTime';

/**
 * Local astronomical sun position (no network, no API cost).
 * suncalc v2 returns degrees, azimuth clockwise from north, refraction-corrected altitude.
 */
export interface SunPosition {
  azimuthDeg: number;
  altitudeDeg: number;
}

export interface SunVector {
  /** Unit vector pointing from the ground TOWARD the sun. */
  e: number;
  n: number;
  u: number;
}

export function sunPosition(utcMs: number, lat: number, lon: number): SunPosition {
  const p = getPosition(new Date(utcMs), lat, lon);
  return { azimuthDeg: ((p.azimuth % 360) + 360) % 360, altitudeDeg: p.altitude };
}

export function sunVector(pos: SunPosition): SunVector {
  const az = (pos.azimuthDeg * Math.PI) / 180;
  const alt = (pos.altitudeDeg * Math.PI) / 180;
  return { e: Math.sin(az) * Math.cos(alt), n: Math.cos(az) * Math.cos(alt), u: Math.sin(alt) };
}

/** Horizontal shadow length per metre of obstacle height (∞ when the sun is down). */
export function shadowRatio(altitudeDeg: number): number {
  if (altitudeDeg <= 0) return Infinity;
  return 1 / Math.tan((altitudeDeg * Math.PI) / 180);
}

export interface GardenSunState {
  instant: ZonedToUtcResult;
  position: SunPosition;
  vector: SunVector;
  isUp: boolean;
  /** Garden-local minutes for sunrise / sunset / solar noon (null in polar day/night). */
  sunriseMin: number | null;
  sunsetMin: number | null;
  solarNoonMin: number | null;
  alwaysUp: boolean;
  alwaysDown: boolean;
}

function localMinutes(tz: string, d: Date | null): number | null {
  if (!d || isNaN(d.getTime())) return null;
  const p = utcToZoned(tz, d.getTime());
  return p.hour * 60 + p.minute;
}

export function gardenSun(lat: number, lon: number, tz: string, date: string, minutes: number): GardenSunState {
  const instant = zonedToUtc(tz, date, minutes);
  const position = sunPosition(instant.utcMs, lat, lon);
  // Civil day in the garden zone: anchor at local noon and pass the zone offset.
  const noon = zonedToUtc(tz, date, 12 * 60);
  const times = getTimes(new Date(noon.utcMs), lat, lon, 0, offsetMinutesAt(tz, noon.utcMs));
  return {
    instant,
    position,
    vector: sunVector(position),
    isUp: position.altitudeDeg > 0,
    sunriseMin: localMinutes(tz, times.sunrise),
    sunsetMin: localMinutes(tz, times.sunset),
    solarNoonMin: localMinutes(tz, times.solarNoon),
    alwaysUp: !!times.alwaysUp,
    alwaysDown: !!times.alwaysDown,
  };
}

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export function compassPoint(azimuthDeg: number): string {
  return POINTS[Math.round((((azimuthDeg % 360) + 360) % 360) / 45) % 8];
}
