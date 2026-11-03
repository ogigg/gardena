/** Geographic coordinate as [longitude, latitude] in WGS84 degrees (GeoJSON order). */
export type LngLat = [number, number];

/**
 * Local planar coordinate in meters relative to a garden origin.
 * e = metres east, n = metres north. Never mixes with screen or 3D axes.
 */
export interface LocalPoint {
  e: number;
  n: number;
}

export type ObjectKind = 'bed' | 'tree' | 'building';

/** Where a height value came from. Shown to the user so defaults never look measured. */
export type HeightSource =
  | 'manual' // user typed/adjusted it
  | 'default' // app default for a newly added object
  | 'tagged' // OpenStreetMap `height` tag (provenance unknown)
  | 'levels' // inferred from storey count
  | 'assumed' // no data at all — fixed fallback value
  | 'sample'; // demo data, not real

export interface GardenObject {
  id: string;
  kind: ObjectKind;
  label: string;
  /** Centre position in local metres. */
  e: number;
  n: number;
  /** Clockwise rotation from north, degrees. */
  rotationDeg: number;
  /** Footprint along the object's local x (east when rotation = 0), metres. */
  width: number;
  /** Footprint along the object's local y (north when rotation = 0), metres. */
  depth: number;
  /** Total height above the garden ground reference, metres. */
  height: number;
  heightSource: HeightSource;
  /** Trees only: canopy radius in metres. */
  canopyRadius?: number;
}

export interface ContextBuilding {
  id: string;
  /** Footprint ring in geographic coordinates (open ring). */
  footprint: LngLat[];
  height: number;
  heightSource: HeightSource;
  levels?: number;
  /** Provider reference, e.g. "osm:way/123". */
  sourceRef?: string;
}

export type ContextStatus = 'not-loaded' | 'loading' | 'loaded' | 'empty' | 'failed' | 'sample';

export interface ObstacleContext {
  status: ContextStatus;
  buildings: ContextBuilding[];
  source?: string;
  attribution?: string;
  radiusM?: number;
  fetchedAt?: string;
  message?: string;
}

export interface GardenStats {
  areaM2: number;
  perimeterM: number;
  /** Long side of the minimum-area bounding rectangle, metres. */
  lengthM: number;
  /** Short side of the minimum-area bounding rectangle, metres. */
  widthM: number;
  /** Bearing of the long axis, degrees clockwise from north, in [0, 180). */
  orientationDeg: number;
}

export interface SunSetting {
  /** Garden-local calendar date, YYYY-MM-DD. */
  date: string;
  /** Garden-local minutes after midnight (0..1439). */
  minutes: number;
}

export interface Garden {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  /** Demo gardens are not real places; the UI labels them everywhere. */
  isDemo: boolean;
  /** Fixed reference for the local metric frame. Never moves after creation so object positions stay put. */
  origin: LngLat;
  /** Outer boundary as drawn (open ring, original coordinates). */
  boundary: LngLat[];
  /** IANA timezone for the garden location (not the phone's). */
  timezone: string;
  /** Ground reference height in metres (manual; terrain is not modelled). */
  groundLevelM: number;
  stats: GardenStats;
  imagery?: { providerId: string; attribution: string };
  objects: GardenObject[];
  context: ObstacleContext;
  sun: SunSetting;
}
