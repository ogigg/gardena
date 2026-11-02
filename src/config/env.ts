/**
 * Runtime configuration. Only EXPO_PUBLIC_* variables are inlined into the app
 * bundle by Expo — they are therefore PUBLIC. Put only restricted, client-safe
 * keys here (referrer/bundle-restricted map keys). Never put server secrets in
 * EXPO_PUBLIC_* variables.
 *
 * Expo requires literal `process.env.EXPO_PUBLIC_X` access for inlining, so each
 * variable is read explicitly.
 */
function clean(v: string | undefined): string | undefined {
  const t = v?.trim();
  return t ? t : undefined;
}

export interface AppConfig {
  geoapifyKey?: string;
  arcgisKey?: string;
  /** Esri World Imagery tracing terms are ambiguous for this workflow — opt-in only. */
  enableEsriImagery: boolean;
  customImagery?: { url: string; attribution: string; name: string; maxZoom: number };
  /** Overpass endpoint for OSM building context. Public instance = development use only. */
  overpassUrl?: string;
  enableOsmContext: boolean;
}

export function readConfig(): AppConfig {
  const customUrl = clean(process.env.EXPO_PUBLIC_CUSTOM_IMAGERY_URL);
  return {
    geoapifyKey: clean(process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY),
    arcgisKey: clean(process.env.EXPO_PUBLIC_ARCGIS_API_KEY),
    enableEsriImagery: clean(process.env.EXPO_PUBLIC_ENABLE_ESRI_IMAGERY) === 'true',
    customImagery: customUrl
      ? {
          url: customUrl,
          attribution: clean(process.env.EXPO_PUBLIC_CUSTOM_IMAGERY_ATTRIBUTION) ?? 'Custom imagery',
          name: clean(process.env.EXPO_PUBLIC_CUSTOM_IMAGERY_NAME) ?? 'Custom imagery',
          maxZoom: Number(clean(process.env.EXPO_PUBLIC_CUSTOM_IMAGERY_MAXZOOM) ?? 19),
        }
      : undefined,
    overpassUrl: clean(process.env.EXPO_PUBLIC_OVERPASS_URL) ?? 'https://overpass-api.de/api/interpreter',
    enableOsmContext: clean(process.env.EXPO_PUBLIC_ENABLE_OSM_CONTEXT) !== 'false',
  };
}

export const config = readConfig();
