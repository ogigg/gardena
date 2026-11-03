# Provider research: imagery, geocoding, sun and obstacle data

**Date checked:** 2026-11-02 (all links below).

**How this was researched:** this build ran in a sandbox whose network policy
blocked direct page loads from almost every provider domain (mapbox.com,
google.com, arcgis.com, maptiler.com, geoportal.gov.pl, openstreetmap.org and
others). The facts below come from web-search extracts of the official pages
listed, plus raw files on GitHub (for example osmlab/editor-layer-index). Each
row is labeled:

- **[D]** documented: an official page or document says it.
- **[S]** secondary: reported by a third party, or the official page was only seen
  as a search extract with ambiguous wording.
- **[A]** assumption: my own estimate.

Re-check every **[S]** item on the live page before launch. Prices change, and
some numbers here could not be cross-checked.

---

## 0. The workflow that has to be licensed

1. Show aerial or satellite imagery of the user's property.
2. The user **traces** the garden's outer boundary by tapping points on that imagery.
3. The app **stores** those coordinates locally and later on a server.
4. The app re-renders that geometry in a **separate custom 3D scene**, not the
   provider's map. The imagery itself is never copied into the scene.

Step 2 is "tracing / deriving data from the imagery". Most commercial map
licences address this directly, so it is the deciding constraint.

---

## A. Satellite imagery and address search

### A1. Renderer (not a data provider)

| Option | Licence | Cost | Expo fit | Notes |
|---|---|---|---|---|
| **MapLibre React Native** `@maplibre/maplibre-react-native` 11.5.1 | BSD-2 [D: npm] | $0 | Has an Expo config plugin. Needs a dev build; not in Expo Go [D: package `app.plugin.js`] | Renders any XYZ/WMTS raster source. **Chosen.** |
| `@rnmapbox/maps` 10.3.16 | SDK under Mapbox ToS | Billed by Mapbox MAU even with non-Mapbox tiles [S] | Dev build | Ties the app to Mapbox terms. |
| `react-native-maps` 1.29.11 | MIT | Google SDK on Android needs a key. Apple Maps on iOS. | Works in Expo Go | Google/Apple base imagery cannot be traced (see A2). Custom `UrlTile` overlays are possible but add complexity. |

MapLibre is only a renderer. Imagery and geocoding still need a licensed source.

### A2. Imagery providers

| Provider | Useful resolution | Poland | Wider coverage | Imagery age | Tracing user boundaries + saving + reuse in own 3D | Production free tier | Verdict |
|---|---|---|---|---|---|---|---|
| **GUGiK Geoportal ORTO** (Polish national orthophoto). WMTS `…/PZGIK/ORTO/WMTS/StandardResolution`, layer `ORTOFOTOMAPA`, `EPSG:3857` matrix [D: [editor-layer-index entry](https://github.com/osmlab/editor-layer-index/blob/gh-pages/sources/europe/pl/Geoportal2Orthophotomap(aerialimage)_WMTS.geojson); [Geoportal ORTO page](https://www.geoportal.gov.pl/en/data/orthophotomap-orto/)] | Aerial. 25 cm national, 5–10 cm in many cities [S]. The StandardResolution cache goes to about 0.6 m/px (z18) [S: [MapServer#7359](https://github.com/mapserver/mapserver/issues/7359)], with HighResolution endpoints for finer pixels [D] | Full | Poland only | Updated in rolling campaigns, usually 1–3 years old [S] | Released free of charge with no licence document since 2020 (art. 40a Prawo geodezyjne) [D: [GUGiK news 23.06.2020](http://www.gugik.gov.pl/aktualnosci/2021/23.06.2020-zawieszenie-pobierania-oplat-za-udostepnianie-ortofotomapy); [GUGiK free-data list](https://www.gov.pl/web/gugik/dane-udostepniane-bez-platnie-do-pobrania-z-serwisu-wwwgeoportalgovpl)]. Attribution "Główny Urząd Geodezji i Kartografii" required [D: ELI]. No restriction on deriving vectors found [S] | Unlimited, $0. No SLA [A] | **Chosen for Poland** |
| **Esri World Imagery** via ArcGIS Location Platform | Up to 15 cm (Vivid Premium, select metros), 30 cm in 1,000+ metros [D: [World Imagery item](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9)] | Partial high-res; aerial for 100+ Polish sites added in 2025 [S] | Global | Per-tile capture date in metadata [D] | Item page allows "data collection and editing" **in ArcGIS apps** [D/S]. The explicit tracing grant ([OSM wiki/Esri](https://wiki.openstreetmap.org/wiki/Esri); ELI `permission_osm: explicit`) is aimed at OSM. An Esri blog says derivatives are "non-commercial within ArcGIS" [S: [Esri blog](https://www.esri.com/arcgis-blog/products/arcgis-living-atlas/imagery/learn-to-use-ai-to-extract-information-from-world-imagery)]. **Ambiguous for a MapLibre-based commercial app.** | 2M basemap tiles/mo free, then $0.15/1k; or 1,000 sessions/mo free, then $4/1k (12-hour session, Basemap Styles only) [D: [pricing](https://location.arcgis.com/pricing/), [sessions blog](https://www.esri.com/arcgis-blog/products/platform/announcements/basemap-sessions)] | Best global candidate. **Implemented but off by default** until Esri confirms in writing |
| **Mapbox Satellite** | Up to about 30–50 cm in many cities [S] | Yes | Global | Varies | "Customer shall not trace or otherwise derive or extract…" except non-commercial use or OSM. Commercial tracing needs a separate *Commercial Satellite* licence [D: [Product Terms 2025-04](https://cdn.prod.website-files.com/609ed46055e27a02ffc0749b/67fd8d3325f4dfaf2f5145ef_Mapbox%20Product%20Terms%20(2025-04-14).pdf), [imagery page](https://www.mapbox.com/imagery)] | 25,000 mobile MAU free [S: [pricing guide](https://docs.mapbox.com/accounts/guides/pricing/) defers to the pricing page] | Cheapest on paper, but **not licensed for this workflow** |
| **Google** (Maps SDK, Map Tiles) | High | Yes | Global | Varies | "Customer will not create content based on Google Maps Content, including tracing, digitizing…" [S: quoted in [OSM wiki/Google](https://wiki.openstreetmap.org/wiki/Google), [Cesium Google terms](https://cesium.com/legal/terms-for-google/)] | Maps SDK for Android/iOS free and unlimited since March 2025 [S: [Android usage & billing](https://developers.google.com/maps/documentation/android-sdk/usage-and-billing)] | **Prohibited** |
| **MapTiler Satellite** | High-res in Europe [S] | Yes | Global | — | Terms: "shall not trace, derive or extract… except as expressly permitted" [D: [Server & Data terms](https://www.maptiler.com/terms/server-data/)]. No express permission found | Free plan is non-commercial. Flex about $25–30/mo [S] | Not explicitly licensed. Excluded |
| National open orthophotos elsewhere (NL PDOK, ES PNOA, FR IGN, US NAIP…) | 8–60 cm | — | Per country | Varies | Open licences (CC BY / CC0 / public domain) [A: check each] | $0 | Add later through the same provider interface |
| EOX Sentinel-2 cloudless | 10 m | Yes | Global | Annual | 2018+ is CC BY-NC-SA [S] | — | Too coarse for a garden |

### A3. Address search and geocoding

The app stores the **user-drawn polygon**, not the geocoder result. The search
result only moves the camera. Storage terms still matter because a provider
could treat even caching the label as storage, so the prototype does not persist
geocoder output.

| Provider | Coverage | Cost | Storage / display rules | Verdict |
|---|---|---|---|---|
| **Geoapify** | Global (OSM-based) | Free plan: 3,000 credits/day, commercial use allowed with attribution. Paid from $59/mo (10k/day) [D: [pricing FAQ](https://geoapify.com/pricing)] | "Free to download and store" results, with OSM attribution [D] | **Chosen** (global, needs a key) |
| **GUGiK UUG** `services.gugik.gov.pl/uug` | Poland address points (PRG) | Free, no key [S: used by [rgugik](https://rdrr.io/cran/rgugik/src/R/geocodePL_get.R)] | PRG is open data. Service ToS not found [S] | **Fallback for Poland** when there is no Geoapify key. No SLA |
| Esri Geocoding | Global | 20k/mo free (not stored), then $0.50/1k. Stored geocoding billed separately [D: [geocode docs](https://developers.arcgis.com/rest/geocode/)] | Non-stored results must not be persisted [D] | Good alternative |
| Mapbox Geocoding v6 | Global | Temporary: 100k/mo free [S], then $0.75/1k. Permanent: about $5/1k [S] | Temporary results cannot be cached or stored [D: [temp vs permanent](https://docs.mapbox.com/help/dive-deeper/understand-temporary-vs-permanent-geocoding/)] | OK for display, but adds a Mapbox account |
| Google Geocoding | Global | 10k/mo free, then $5/1k [S] | Results are tied to Google Maps display; caching limited [S] | Excluded (map is not Google) |
| Nominatim (OSMF public) | Global | Free | Usage policy: per-app traffic cap, no bulk, attribution [D: [policy](https://operations.osmfoundation.org/policies/nominatim/)] | Not for production |
| Coordinates typed by the user | — | $0 | — | Always available, offline |

### A4. Monthly cost estimates

**Assumptions:**

- Base case: 4 map sessions and 2 submitted searches per MAU per month.
- Tiles per session **[A]:** 60–400. A phone screen at z18–19 shows about 15–30
  tiles; a search fly-in plus drawing touches 2–4 screens on the low end,
  exploratory panning reaches the high end.
- Heavy case **[A]:** 12 sessions, 6 searches, 600 tiles per session, and
  type-ahead autocomplete at about 6 requests per search (36 geocode
  requests/MAU).

**Volumes:**

| MAU | Sessions | Tiles (low–high) | Submitted searches | Heavy: sessions / tiles / geocode requests |
|---|---|---|---|---|
| 100 | 400 | 24k–160k | 200 | 1.2k / 720k / 3.6k |
| 1,000 | 4,000 | 240k–1.6M | 2,000 | 12k / 7.2M / 36k |
| 10,000 | 40,000 | 2.4M–16M | 20,000 | 120k / 72M / 360k |

**Imagery cost:**

| Provider | 100 MAU | 1,000 MAU | 10,000 MAU | Heavy, 10k MAU |
|---|---|---|---|---|
| GUGiK ORTO (Poland) | $0 | $0 | $0 | $0 |
| Esri, tile billing | $0 | $0 (≤1.6M < 2M free) | (2.4M−2M)×$0.15/1k = **$60** to (16M−2M)×$0.15/1k = **$2,100** | (72M−2M)×0.15/1k = $10,500 |
| Esri, session billing | $0 | (4,000−1,000)×$4/1k = **$12** | (40,000−1,000)×$4/1k = **$156** | (120k−1k)×4/1k = **$476** |
| Mapbox (*not licensed for tracing*) | $0 | $0 | $0 (<25k MAU) [S] | $0 |
| Google (*tracing prohibited*) | $0 | $0 | $0 | $0 |
| MapTiler (*not licensed*) | Flex about $25 | $25 to about $135 (overage unverified) | Unlimited about $295, plus unknown overage | Unknown |

**Geocoding cost:**

| Provider | 100 | 1,000 | 10,000 | Heavy, 10k (autocomplete) |
|---|---|---|---|---|
| Geoapify | $0 | $0 | $0 (20k/mo ≈ 667/day < 3,000/day) | 360k/mo ≈ 12k/day. Exceeds the $59 tier, next tier unverified |
| GUGiK UUG (PL) | $0 | $0 | $0 | $0 (capacity unknown) |
| Esri | $0 | $0 | $0 (= 20k free) | (360k−20k)×$0.50/1k = $170. Submit-only: $20 |
| Mapbox temporary | $0 | $0 | $0 | (360k−100k)×$0.75/1k = $195 |
| Google | $0 | $0 | (20k−10k)×$5/1k = $50 | $250 for 60k submitted, plus Places Autocomplete (separate SKU) |

**Selected stack cost:**

- In Poland: **$0/month at 100, 1,000 and 10,000 MAU** (GUGiK imagery,
  Geoapify free tier or GUGiK UUG).
- With Esri enabled for imagery outside Poland: up to about $12 (1k MAU) or
  about $156 (10k MAU) on session billing. Session billing applies only if the
  MapLibre integration can create sessions natively (unverified for React
  Native).
- Geoapify autocomplete is the first thing that would force a paid plan.

**Spending caps:**

- Esri Location Platform has a pay-as-you-go account; budget alerts exist [S],
  no hard cap verified.
- Google and Mapbox need a billing account for production. Neither offers a
  true hard cap; Google supports quotas [S].
- Geoapify's free plan stops at its quota [S].
- GUGiK needs no account.

---

## B. Sun position, sunlight and shade

| Need | Approach | Paid API needed? |
|---|---|---|
| Sun azimuth and elevation for a location and instant | **Local calculation.** `suncalc` v2.1.1 (maintained by Volodymyr Agafonkin, 2026-10 release, degrees, north-based azimuth, refraction-corrected altitude) [D: npm, package typings] | No |
| Geometric shadows of modeled obstacles | three.js directional light and shadow map, recomputed only when the sun or objects change | No |
| Daily potential direct-sun hours | Sample the sun every 10–15 min and ray-test against the model. Cheap per point; a full heatmap is a later step | No |
| Weather-adjusted light reaching plants | Needs cloud and irradiance data (for example satellite irradiance products) | Yes, or an open weather API. **Out of scope** |

**Accuracy check:**

- `suncalc` was tested against NREL's SPA (via `pvlib` 0.16.1, an independent
  implementation) over 33 daytime cases in Kraków, Gdańsk, Sydney, Reykjavík,
  Quito and New York. Measured maximum error: **0.007° altitude, 0.013°
  azimuth**. Sunrise, sunset and solar noon are within 2 minutes of SPA. See
  `src/domain/sun/sun.test.ts` and `tests/fixtures/spa-reference.json`.
- At a 10 m obstacle, 0.013° moves a shadow tip by millimetres, far below the
  error of the modeled geometry itself.

**Timezones:**

- `@photostructure/tz-lookup` 11.7.0 gives the IANA zone from coordinates,
  offline.
- `Intl.DateTimeFormat` with `timeZone` turns garden-local wall time into UTC,
  including DST gaps and overlaps.
- Garden time is always shown with its zone and offset. Phone time is shown
  separately when it differs.
- Hermes `Intl` time-zone support on device could not be confirmed from the
  docs [S], so the app checks for it at runtime and shows a warning if it is
  missing.

**Services considered:**

- **ShadeMap:** global building, tree and terrain shadow simulation. Base data
  free, high-res sold per km² [S: [Bellingcat toolkit](https://bellingcat.gitbook.io/toolkit/more/all-tools/shademap)]. No public API price found. Not needed for the
  prototype.
- **Google Solar API:** Poland covered since Nov 2023 [D: [release notes](https://developers.google.com/maps/documentation/solar/release-notes)]. It is built
  for **rooftops** (building insights, DSM and flux layers). Ground-level garden
  shade is not its purpose, and its Maps Platform terms restrict derived
  content. Not used.

---

## C. Nearby buildings, trees and terrain

| Source | Coverage | Height | Freshness / precision | Licence | Retrieval / hosting | 3D use |
|---|---|---|---|---|---|---|
| **OpenStreetMap** (Overpass API) | Global footprints, quality varies | `height` tag (provenance unknown), `building:levels` (storeys, inferred about 3 m each), often **absent**. Under ~1.5–11% in US samples [S] | Edited continuously | ODbL. Attribution "© OpenStreetMap contributors". Share-alike if the derived DB is published [D] | Public Overpass is a shared community service, **not for production** [A]. Self-host or pre-extract | Raw polygons. **Used in prototype (opt-in, labeled)** |
| **Overture Maps buildings** (release 2026-10-21.0) | Global (OSM, Esri Community Maps, Microsoft, Google Open Buildings and more) | `height` / `num_floors` optional. About 8% of buildings have height, mostly ML estimates [S: [Overture buildings guide](https://docs.overturemaps.org/guides/buildings/)] | Monthly releases | ODbL (theme) [D] | GeoParquet on S3/Azure, no query API. Needs a small pipeline (DuckDB → PMTiles/GeoJSON on object storage, a few $/mo) [A] | Raw polygons. Recommended for production context |
| **GUGiK 3D building models** LoD1 (all of Poland) / LoD2 (partial) | Poland | Derived from airborne laser scanning. `measuredHeight` attribute since 2025 [D: [Geoportal 3D models](https://www.geoportal.gov.pl/en/data/other-data/3d-models-of-building/), [GUGiK update](https://www.gov.pl/web/gugik/aktualizacja-modeli-3d-budynkow-w-standardzie-lod1)] | LoD1 versions 2019/21/22/24 | Free of charge, free to use [D] | CityGML per county download. Needs preprocessing into tiles | Best measured heights for Poland. **Recommended for Poland production** |
| GUGiK NMT / NMPT (LiDAR DTM / DSM) | Poland | Measured surface heights, including trees | Campaign-dependent | Free (art. 40a) [D/S] | Large rasters. Needs a backend sampler | Terrain plus tree heights |
| Copernicus DEM GLO-30 | Global | Terrain only (30 m) | 2011–2015 | Free licence [S] | COG on AWS | Slope context only |
| Meta/WRI canopy height 1 m | Global | ML-estimated canopy height | Snapshot | CC BY 4.0 [D: [AWS registry](https://registry.opendata.aws/dataforgood-fb-forests/)] | COGs on S3. Needs a backend | Approximate tree shade |
| Google Solar DSM / Mapbox building tiles | — | Yes | — | Extraction or reuse restricted [D/S] | — | **Excluded** |

**Prototype policy:**

- Obstacles near the garden are fetched (optional, about 80 m radius, outside
  the boundary too) and kept in a **separate context layer**.
- Each height is labeled `tagged` (OSM `height`), `from storeys` (×3 m) or
  `default 6 m (assumed)`. The user can edit every height, and edited heights
  become `manual`.
- If retrieval fails, the user sees "No surrounding buildings loaded. Shadows
  only include objects you add".
- Demo mode uses obviously labeled **sample** buildings.

---

## Recommendation

| Layer | Prototype | Production next step |
|---|---|---|
| Renderer | MapLibre React Native (dev build) | Same |
| Imagery | GUGiK ORTO (Poland, no key). Esri World Imagery available behind `EXPO_PUBLIC_ENABLE_ESRI_IMAGERY=true` plus an API key, **pending written Esri confirmation**. A custom open XYZ source can be set by env | Add national open orthophotos per country. Esri for the rest if confirmed |
| Geocoding | Geoapify (key) → GUGiK UUG (Poland) → typed coordinates | Small proxy only if the Geoapify key needs hiding |
| Sun | suncalc locally, tz-lookup, Intl | Add a direct-sun-hours sampler |
| Obstacles | Manual objects plus optional OSM Overpass context (labeled) | Overture or GUGiK LoD1 pre-extracted tiles on object storage |

## Unresolved questions and fallbacks

1. **Esri**: does the Location Platform licence allow end users to trace
   boundaries over World Imagery in a non-Esri (MapLibre) app, and store them
   commercially? Ask Esri in writing. Fallback: national open orthophotos.
2. **GUGiK capacity / fair use**: there is no published SLA for the WMTS or UUG.
   For production, consider a caching proxy (allowed for open data) and contact
   GUGiK.
3. **Geoapify key exposure**: mobile keys are extractable. Restrict the key
   (Geoapify supports key restrictions [S]) or add a proxy at scale.
4. **Hermes `Intl` time zones**: verify on real iOS and Android builds. The app
   warns if unsupported.
5. **Mapbox / Google**: could be used if a commercial satellite licence or
   written exception is obtained. That would change the cost picture (Mapbox is
   $0 to 25k MAU).
6. **Tile counts** per session are estimates. Measure them in a beta with
   `NetworkManager` logging before choosing Esri tile vs session billing.
