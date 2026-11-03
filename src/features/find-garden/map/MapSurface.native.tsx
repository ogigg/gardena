import { Camera, GeoJSONSource, Layer, Map, type CameraRef, type MapRef, type StyleSpecification } from '@maplibre/maplibre-react-native';
import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LngLat } from '../../../domain/garden/types';
import { colors } from '../../../shared/ui/theme';
import { GridSurface } from './GridSurface';
import type { MapSurfaceHandle, MapSurfaceProps } from './types';

export const SUPPORTS_IMAGERY = true;

/**
 * Native map: MapLibre renders licensed raster imagery; it is only a renderer
 * (no vendor account, no usage billing). Without a licensed imagery source for
 * the area we fall back to the metric grid surface.
 */
export const MapSurface = forwardRef<MapSurfaceHandle, MapSurfaceProps>(function MapSurface(props, ref) {
  if (!props.imagery) return <GridSurface ref={ref} {...props} />;
  return <MapLibreSurface ref={ref} {...props} />;
});

const MapLibreSurface = forwardRef<MapSurfaceHandle, MapSurfaceProps>(function MapLibreSurface(
  { imagery, initialView, interactive, outline, closed, onViewChange, onError },
  ref,
) {
  const mapRef = useRef<MapRef>(null);
  const camRef = useRef<CameraRef>(null);

  useImperativeHandle(ref, () => ({
    async project(points) {
      const m = mapRef.current;
      if (!m) return points.map(() => [0, 0] as [number, number]);
      return Promise.all(points.map((p) => m.project(p))) as Promise<[number, number][]>;
    },
    async unproject(px) {
      const m = mapRef.current;
      if (!m) throw new Error('Map not ready');
      return (await m.unproject(px)) as LngLat;
    },
    flyTo(center, zoom, animate = true) {
      camRef.current?.flyTo({ center, zoom, bearing: 0, pitch: 0, duration: animate ? 1200 : 0 });
    },
    fitBounds(bbox, padding, animate = true) {
      camRef.current?.fitBounds(bbox, {
        padding: { top: padding, bottom: padding, left: padding, right: padding },
        bearing: 0,
        pitch: 0,
        duration: animate ? 600 : 0,
      });
    },
    async getView() {
      const vs = await mapRef.current!.getViewState();
      return { center: vs.center as LngLat, zoom: vs.zoom };
    },
  }));

  const style = useMemo<StyleSpecification>(
    () => ({
      version: 8,
      sources: {
        imagery: {
          type: 'raster',
          tiles: imagery!.tiles,
          tileSize: imagery!.tileSize,
          maxzoom: imagery!.maxZoom,
          attribution: imagery!.attribution,
        },
      },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': '#DCE2D6' } },
        { id: 'imagery', type: 'raster', source: 'imagery', paint: { 'raster-fade-duration': 150 } },
      ],
    }),
    [imagery],
  );

  const geojson = useMemo<GeoJSON.FeatureCollection>(() => {
    const features: GeoJSON.Feature[] = [];
    if (outline.length >= 3 && closed) {
      features.push({
        type: 'Feature',
        properties: { kind: 'area' },
        geometry: { type: 'Polygon', coordinates: [[...outline, outline[0]]] },
      });
    }
    if (outline.length >= 2) {
      const line = closed ? [...outline, outline[0]] : outline;
      features.push({ type: 'Feature', properties: { kind: 'edge' }, geometry: { type: 'LineString', coordinates: line } });
    }
    outline.forEach((p, i) =>
      features.push({ type: 'Feature', properties: { kind: 'vertex', i }, geometry: { type: 'Point', coordinates: p } }),
    );
    return { type: 'FeatureCollection', features };
  }, [outline, closed]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <Map
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        mapStyle={style}
        dragPan={interactive}
        touchZoom={interactive}
        doubleTapZoom={interactive}
        doubleTapHoldZoom={interactive}
        // Keep north up and the view flat so drawn geometry, overlay maths and
        // the 3D scene all share one orientation.
        touchRotate={false}
        touchPitch={false}
        compass={false}
        logo={false}
        attribution
        attributionPosition={{ bottom: 8, right: 8 }}
        scaleBar
        scaleBarPosition={{ top: 8, left: 8 }}
        tintColor={colors.leafDark}
        onRegionDidChange={(e) => onViewChange?.({ center: e.nativeEvent.center as LngLat, zoom: e.nativeEvent.zoom })}
        onDidFailLoadingMap={() => onError?.('The imagery map could not load. Check your connection.')}
      >
        <Camera ref={camRef} initialViewState={{ center: initialView.center, zoom: initialView.zoom }} maxZoom={imagery!.maxZoom + 2} />
        {interactive ? (
          <GeoJSONSource id="outline" data={geojson}>
            <Layer
              id="outline-fill"
              type="fill"
              filter={['==', ['get', 'kind'], 'area']}
              paint={{ 'fill-color': colors.outline, 'fill-opacity': 0.25 }}
            />
            <Layer
              id="outline-edge"
              type="line"
              filter={['==', ['get', 'kind'], 'edge']}
              paint={{ 'line-color': colors.outlineStroke, 'line-width': 3 }}
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            />
            <Layer
              id="outline-vertex"
              type="circle"
              filter={['==', ['get', 'kind'], 'vertex']}
              paint={{
                'circle-radius': 5,
                'circle-color': '#ffffff',
                'circle-stroke-color': colors.outlineStroke,
                'circle-stroke-width': 2,
              }}
            />
          </GeoJSONSource>
        ) : null}
      </Map>
    </View>
  );
});
