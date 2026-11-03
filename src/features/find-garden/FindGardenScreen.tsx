import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createGarden, withBoundary } from '../../domain/garden/garden';
import type { Garden } from '../../domain/garden/types';
import { bboxOf } from '../../domain/geometry/polygon';
import { vertexCentroid } from '../../domain/geometry/projection';
import type { GeocodeResult } from '../../services/geocoding';
import { availableImagery, pickImagery } from '../../services/imagery/providers';
import { config } from '../../shared/config/env';
import { Banner } from '../../shared/ui/Banner';
import { ScreenHeader } from '../../shared/ui/ScreenHeader';
import { colors, space } from '../../shared/ui/theme';
import { DrawingOverlay } from './components/DrawingOverlay';
import { drawingHelpText, DrawingToolbar, type DrawMode } from './components/DrawingToolbar';
import { SearchBar } from './components/SearchBar';
import { SearchResults } from './components/SearchResults';
import { useAddressSearch } from './hooks/useAddressSearch';
import { useBoundaryDraft } from './hooks/useBoundaryDraft';
import { MapSurface, SUPPORTS_IMAGERY } from './map/MapSurface';
import type { MapSurfaceHandle, MapView } from './map/types';

const POLAND_VIEW: MapView = { center: [19.4, 52.05], zoom: 5.3 };

export interface ConfirmInfo {
  garden: Garden;
  /** Outline vertices in window coordinates at the moment of confirmation. */
  windowPoints: [number, number][];
}

/** Step 1–2: find the garden (search / location / pan) and draw its boundary. */
export function FindGardenScreen({
  editing,
  onBack,
  onConfirmed,
}: {
  editing?: Garden;
  onBack: () => void;
  onConfirmed: (info: ConfirmInfo) => void;
}) {
  const insets = useSafeAreaInsets();
  const surfaceRef = useRef<MapSurfaceHandle>(null);
  const containerRef = useRef<React.ComponentRef<typeof View>>(null);
  const imageryList = useMemo(() => availableImagery(config), []);

  const initialView = useMemo<MapView>(() => (editing ? { center: vertexCentroid(editing.boundary), zoom: 19 } : POLAND_VIEW), [editing]);
  const [view, setView] = useState<MapView>(initialView);
  const imagery = useMemo(
    () => (editing?.isDemo || !SUPPORTS_IMAGERY ? undefined : pickImagery(imageryList, view.center)),
    [imageryList, view.center, editing],
  );

  const draft = useBoundaryDraft(editing?.boundary);
  const { snap, validation } = draft;
  const address = useAddressSearch();
  const [mode, setMode] = useState<DrawMode>(editing ? 'draw' : 'pan');
  const [screenPts, setScreenPts] = useState<[number, number][]>([]);
  const [mapError, setMapError] = useState<string>();
  const [locating, setLocating] = useState(false);
  const [hint, setHint] = useState<string>();
  const [size, setSize] = useState({ width: 1, height: 1 });

  // Frame an existing outline once the surface exists.
  useEffect(() => {
    if (!editing) return;
    const t = setTimeout(() => surfaceRef.current?.fitBounds(bboxOf(editing.boundary), 70, false), 350);
    return () => clearTimeout(t);
  }, [editing]);

  // Keep overlay handles in sync with geography while the map is locked.
  const reproject = useCallback(async () => {
    const s = surfaceRef.current;
    if (!s || mode !== 'draw') return;
    try {
      setScreenPts(await s.project(snap.points));
    } catch {
      setScreenPts([]);
    }
  }, [mode, snap.points]);
  useEffect(() => {
    void reproject();
  }, [reproject, size, view]);

  const goTo = (r: GeocodeResult) => {
    address.clear();
    setMode('pan');
    const s = surfaceRef.current;
    if (!s) return;
    if (r.bbox && r.bbox[2] - r.bbox[0] < 0.01) s.fitBounds(r.bbox, 60);
    else s.flyTo(r.center, 19);
  };

  const locate = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        address.showError('Location permission was not granted. You can still search or pan the map.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setMode('pan');
      surfaceRef.current?.flyTo([pos.coords.longitude, pos.coords.latitude], 19);
    } catch {
      address.showError('Could not get your location.');
    } finally {
      setLocating(false);
    }
  };

  const confirm = async () => {
    if (!validation?.ok) return;
    let garden: Garden;
    try {
      garden = editing
        ? withBoundary(editing, validation.cleaned)
        : createGarden(validation.cleaned, {
            imagery: imagery
              ? { providerId: imagery.id, attribution: imagery.attribution }
              : { providerId: 'none', attribution: 'No imagery (grid)' },
          });
    } catch (e) {
      setHint((e as Error).message);
      return;
    }
    // Hand the on-screen outline to the 3D screen so the transition starts where the user drew.
    const pts = await surfaceRef.current?.project(garden.boundary).catch(() => [] as [number, number][]);
    const offset = await new Promise<[number, number]>((resolve) => {
      const node = containerRef.current;
      if (!node) return resolve([0, 0]);
      node.measureInWindow((x, y) => resolve([x, y]));
    });
    onConfirmed({ garden, windowPoints: (pts ?? []).map((p) => [p[0] + offset[0], p[1] + offset[1]]) });
  };

  const onLayout = (e: LayoutChangeEvent) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader title={editing ? 'Edit the boundary' : 'Find your garden'} onBack={onBack} />

      {!editing ? (
        <SearchBar
          query={address.query}
          onChangeQuery={address.setQuery}
          onSubmit={address.run}
          searching={address.search.status === 'loading'}
          onLocate={locate}
          locating={locating}
        />
      ) : null}

      <View style={styles.mapWrap} ref={containerRef} onLayout={onLayout} collapsable={false}>
        <MapSurface
          key={imagery?.id ?? 'grid'}
          ref={surfaceRef}
          imagery={imagery}
          initialView={view}
          interactive={mode === 'pan'}
          outline={snap.points}
          closed={snap.closed}
          onViewChange={setView}
          onError={setMapError}
        />

        {mode === 'draw' ? (
          <DrawingOverlay
            snap={snap}
            screenPts={screenPts}
            onScreenPtsChange={setScreenPts}
            surface={() => surfaceRef.current}
            commit={draft.commit}
            onHint={setHint}
            size={size}
            valid={!!validation?.ok}
            crossing={draft.crossing}
          />
        ) : null}

        <View style={styles.mapTop} pointerEvents="box-none">
          <SearchResults search={address.search} onPick={goTo} hasGlobalGeocoder={!!config.geoapifyKey} />
          {!imagery ? (
            <Banner tone={editing?.isDemo ? 'demo' : 'info'} style={{ marginTop: space.s }}>
              {editing?.isDemo
                ? 'Demo garden: drawn on a metric grid, not on a real map.'
                : 'No licensed aerial imagery is configured for this area, so you are drawing on a metric grid. You can still enter an accurate outline using the scale.'}
            </Banner>
          ) : null}
          {mapError ? (
            <Banner tone="warn" style={{ marginTop: space.s }}>
              {mapError}
            </Banner>
          ) : null}
        </View>
        {imagery ? (
          <View style={styles.attrib} pointerEvents="none">
            <Text style={styles.attribText}>{imagery.attribution}</Text>
          </View>
        ) : null}
      </View>

      <DrawingToolbar
        mode={mode}
        onModeChange={(m) => {
          setMode(m);
          setHint(undefined);
        }}
        message={hint ?? drawingHelpText(mode, snap, validation)}
        snap={snap}
        stats={draft.liveStats}
        canUndo={draft.canUndo}
        canConfirm={!!validation?.ok}
        confirmLabel={editing ? 'Save outline' : 'Confirm'}
        onUndo={draft.undo}
        onReset={draft.reset}
        onClose={draft.close}
        onConfirm={confirm}
        bottomInset={insets.bottom}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  mapWrap: { flex: 1, overflow: 'hidden', backgroundColor: '#DCE2D6' },
  mapTop: { position: 'absolute', left: space.m, right: space.m, top: space.m },
  attrib: { position: 'absolute', left: space.s, bottom: space.s, right: 48, alignItems: 'flex-start' },
  attribText: { fontSize: 10, color: '#222', backgroundColor: 'rgba(255,255,255,0.8)', paddingHorizontal: 4, borderRadius: 3 },
});
