import type { LngLat } from '../geo/types';
import type { ImageryProvider } from '../providers/imagery';

export interface MapView {
  center: LngLat;
  zoom: number;
}

export interface MapSurfaceHandle {
  /** Geographic → view pixel coordinates (view-local, dp). */
  project(points: LngLat[]): Promise<[number, number][]>;
  unproject(px: [number, number]): Promise<LngLat>;
  flyTo(center: LngLat, zoom: number, animate?: boolean): void;
  fitBounds(bbox: [number, number, number, number], padding: number, animate?: boolean): void;
  getView(): Promise<MapView>;
}

export interface MapSurfaceProps {
  imagery?: ImageryProvider;
  initialView: MapView;
  /** When false the map ignores gestures (drawing mode). */
  interactive: boolean;
  /** Outline to show while the map is interactive (pan mode). */
  outline: LngLat[];
  closed: boolean;
  /** Fired when the camera settles. */
  onViewChange?: (v: MapView) => void;
  onError?: (message: string) => void;
}
