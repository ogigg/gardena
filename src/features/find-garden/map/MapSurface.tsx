// Web / fallback entry. Native builds resolve MapSurface.native.tsx (MapLibre) instead.
export { GridSurface as MapSurface } from './GridSurface';
/** Raster imagery needs the native MapLibre renderer; web/fallback draws on the metric grid. */
export const SUPPORTS_IMAGERY = false;
