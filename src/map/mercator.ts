import type { LngLat } from '../geo/types';

/** Web Mercator with MapLibre's 512-px world at zoom 0. Used by the grid surface and overlay maths. */
export const TILE = 512;
const MAX_LAT = 85.0511287798;

export function lngLatToWorld([lon, lat]: LngLat, zoom: number): [number, number] {
  const size = TILE * Math.pow(2, zoom);
  const la = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const s = Math.sin((la * Math.PI) / 180);
  return [((lon + 180) / 360) * size, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * size];
}

export function worldToLngLat([x, y]: [number, number], zoom: number): LngLat {
  const size = TILE * Math.pow(2, zoom);
  const lon = (x / size) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / size;
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return [lon, lat];
}

export interface Viewport {
  center: LngLat;
  zoom: number;
  width: number;
  height: number;
}

export function project(vp: Viewport, p: LngLat): [number, number] {
  const c = lngLatToWorld(vp.center, vp.zoom);
  const w = lngLatToWorld(p, vp.zoom);
  return [w[0] - c[0] + vp.width / 2, w[1] - c[1] + vp.height / 2];
}

export function unproject(vp: Viewport, px: [number, number]): LngLat {
  const c = lngLatToWorld(vp.center, vp.zoom);
  return worldToLngLat([px[0] - vp.width / 2 + c[0], px[1] - vp.height / 2 + c[1]], vp.zoom);
}

/** Ground metres per screen pixel at a latitude. */
export function metresPerPixel(lat: number, zoom: number): number {
  return (Math.cos((lat * Math.PI) / 180) * 2 * Math.PI * 6378137) / (TILE * Math.pow(2, zoom));
}

export function fitZoom(
  bbox: [number, number, number, number],
  width: number,
  height: number,
  padding: number,
): { center: LngLat; zoom: number } {
  const [w, s, e, n] = bbox;
  const center: LngLat = [(w + e) / 2, (s + n) / 2];
  const a = lngLatToWorld([w, n], 0);
  const b = lngLatToWorld([e, s], 0);
  const dx = Math.max(1e-9, b[0] - a[0]);
  const dy = Math.max(1e-9, b[1] - a[1]);
  const zx = Math.log2(Math.max(1, width - 2 * padding) / dx);
  const zy = Math.log2(Math.max(1, height - 2 * padding) / dy);
  // centre in mercator space, not degrees, for exactness
  const cw = worldToLngLat([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], 0);
  return { center: [cw[0], cw[1] ?? center[1]], zoom: Math.min(zx, zy, 21) };
}
