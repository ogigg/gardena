import type { AppConfig } from '../config/env';
import type { LngLat } from '../geo/types';

/**
 * Imagery providers. Each one documents why its licence permits the
 * trace-and-save workflow (see docs/provider-research.md). Adding a provider
 * means adding an entry here — no other module knows provider URLs.
 */
export interface ImageryProvider {
  id: string;
  name: string;
  /** XYZ tile URL templates ({z}/{x}/{y}). */
  tiles: string[];
  tileSize: number;
  maxZoom: number;
  attribution: string;
  /** Rough coverage box [w, s, e, n]; undefined = global. */
  coverage?: [number, number, number, number];
  licenceNote: string;
}

/** Poland's national orthophoto (GUGiK). Free of charge, no key, attribution required. */
export const GUGIK_ORTHO: ImageryProvider = {
  id: 'gugik-orto',
  name: 'Geoportal.gov.pl orthophoto (Poland)',
  tiles: [
    'https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMTS/StandardResolution?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTOFOTOMAPA&STYLE=default&FORMAT=image/jpeg&TILEMATRIXSET=EPSG:3857&TILEMATRIX=EPSG:3857:{z}&TILEROW={y}&TILECOL={x}',
  ],
  tileSize: 256,
  maxZoom: 19,
  attribution: 'Ortofotomapa © Główny Urząd Geodezji i Kartografii',
  coverage: [14.07, 49.0, 24.15, 54.84],
  licenceNote: 'Polish state geodetic data, released free of charge (art. 40a Prawo geodezyjne i kartograficzne).',
};

export function esriWorldImagery(apiKey: string): ImageryProvider {
  return {
    id: 'esri-world-imagery',
    name: 'Esri World Imagery',
    tiles: [
      `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${encodeURIComponent(apiKey)}`,
    ],
    tileSize: 256,
    maxZoom: 19,
    attribution: 'Powered by Esri | Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    licenceNote: 'Opt-in. Tracing rights for this workflow must be confirmed with Esri before production.',
  };
}

export function availableImagery(cfg: AppConfig): ImageryProvider[] {
  const list: ImageryProvider[] = [GUGIK_ORTHO];
  if (cfg.enableEsriImagery && cfg.arcgisKey) list.push(esriWorldImagery(cfg.arcgisKey));
  if (cfg.customImagery) {
    list.push({
      id: 'custom',
      name: cfg.customImagery.name,
      tiles: [cfg.customImagery.url],
      tileSize: 256,
      maxZoom: cfg.customImagery.maxZoom,
      attribution: cfg.customImagery.attribution,
      licenceNote: 'Configured by the app operator, who is responsible for its licence.',
    });
  }
  return list;
}

export function covers(p: ImageryProvider, at: LngLat): boolean {
  if (!p.coverage) return true;
  const [w, s, e, n] = p.coverage;
  return at[0] >= w && at[0] <= e && at[1] >= s && at[1] <= n;
}

/** Best provider for a location: a regional one that covers it, otherwise a global one. */
export function pickImagery(list: ImageryProvider[], at: LngLat): ImageryProvider | undefined {
  return list.find((p) => p.coverage && covers(p, at)) ?? list.find((p) => !p.coverage);
}
