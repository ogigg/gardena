import * as Location from 'expo-location';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Polygon, Polyline, Text as SvgText } from 'react-native-svg';
import { config } from '../config/env';
import { createGarden, withBoundary } from '../garden/model';
import { bboxOf, computeStats, findCrossingEdges, ISSUE_TEXT, validateBoundary } from '../geo/polygon';
import { createLocalFrame, toLocal, vertexCentroid } from '../geo/projection';
import type { Garden, LngLat } from '../geo/types';
import { MapSurface, SUPPORTS_IMAGERY } from '../map/MapSurface';
import type { MapSurfaceHandle, MapView } from '../map/types';
import { availableGeocoders, searchAddress, type GeocodeResult } from '../providers/geocoding';
import { availableImagery, pickImagery } from '../providers/imagery';
import { Banner, Button, Segmented } from '../ui/controls';
import { colors, radius, space, TOUCH, type } from '../ui/theme';
import { usePanResponder } from '../ui/usePanResponder';

type Mode = 'pan' | 'draw';
type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'results'; results: GeocodeResult[]; attribution?: string }
  | { status: 'empty'; errors: string[] }
  | { status: 'error'; message: string };

interface Snapshot {
  points: LngLat[];
  closed: boolean;
}

const POLAND_VIEW: MapView = { center: [19.4, 52.05], zoom: 5.3 };
const HANDLE_HIT = 26;

export interface ConfirmInfo {
  garden: Garden;
  /** Outline vertices in window coordinates at the moment of confirmation. */
  windowPoints: [number, number][];
}

export function MapScreen({
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
  const geocoders = useMemo(() => availableGeocoders(config), []);

  const initialView = useMemo<MapView>(() => {
    if (!editing) return POLAND_VIEW;
    return { center: vertexCentroid(editing.boundary), zoom: 19 };
  }, [editing]);
  const [view, setView] = useState<MapView>(initialView);
  const imagery = useMemo(
    () => (editing?.isDemo || !SUPPORTS_IMAGERY ? undefined : pickImagery(imageryList, view.center)),
    [imageryList, view.center, editing],
  );

  const [mode, setMode] = useState<Mode>(editing ? 'draw' : 'pan');
  const [snap, setSnap] = useState<Snapshot>({ points: editing?.boundary ?? [], closed: !!editing });
  const history = useRef<Snapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [screenPts, setScreenPts] = useState<[number, number][]>([]);
  const [drag, setDrag] = useState<{ index: number; x: number; y: number } | null>(null);
  const [mapError, setMapError] = useState<string>();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<SearchState>({ status: 'idle' });
  const [locating, setLocating] = useState(false);
  const [hint, setHint] = useState<string>();
  const [size, setSize] = useState({ width: 1, height: 1 });
  const searchAbort = useRef<AbortController | null>(null);

  // Frame an existing outline once the surface exists.
  useEffect(() => {
    if (!editing) return;
    const t = setTimeout(() => surfaceRef.current?.fitBounds(bboxOf(editing.boundary), 70, false), 350);
    return () => clearTimeout(t);
  }, [editing]);

  const commit = useCallback((next: Snapshot) => {
    setSnap((prev) => {
      history.current.push(prev);
      if (history.current.length > 100) history.current.shift();
      return next;
    });
    setCanUndo(true);
  }, []);

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

  // ------------------------------------------------------------- validation
  const validation = useMemo(() => (snap.closed ? validateBoundary(snap.points) : null), [snap]);
  const liveStats = useMemo(() => {
    if (snap.points.length < 3) return null;
    try {
      return computeStats(snap.points);
    } catch {
      return null;
    }
  }, [snap.points]);
  const crossing = useMemo(() => {
    if (snap.points.length < 4) return [] as [number, number][];
    const f = createLocalFrame(vertexCentroid(snap.points));
    const local = snap.points.map((p) => toLocal(f, p));
    if (!snap.closed) {
      // open path: check edges excluding the closing one
      return findCrossingEdges(local).filter(([i, j]) => j !== local.length - 1 && i !== local.length - 1);
    }
    return findCrossingEdges(local);
  }, [snap]);

  // ------------------------------------------------------------- drawing input
  const stateRef = useRef({ snap, screenPts });
  useLayoutEffect(() => {
    stateRef.current = { snap, screenPts };
  }, [snap, screenPts]);
  const gesture = useRef<{ x0: number; y0: number; t0: number; index: number | null; moved: boolean; base: Snapshot } | null>(null);

  const nearest = (x: number, y: number, pts: [number, number][], max: number) => {
    let best = -1;
    let bestD = max;
    pts.forEach((p, i) => {
      const d = Math.hypot(p[0] - x, p[1] - y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  };
  const midpoints = (pts: [number, number][]): [number, number][] =>
    pts.map((p, i) => {
      const q = pts[(i + 1) % pts.length];
      return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    });

  const drawResponder = usePanResponder({
    onGrant: (e) => {
      const { locationX: x, locationY: y } = e.nativeEvent;
      const { snap: s, screenPts: pts } = stateRef.current;
      let index: number | null = nearest(x, y, pts, HANDLE_HIT);
      if (index < 0) index = null;
      let base: Snapshot = s;
      if (index === null && s.closed && pts.length >= 3) {
        const m = nearest(x, y, midpoints(pts), HANDLE_HIT - 4);
        if (m >= 0) {
          // insert a vertex on that edge and drag it
          const mids = midpoints(pts);
          const insertAt = m + 1;
          const tmpPts = [...pts.slice(0, insertAt), mids[m], ...pts.slice(insertAt)];
          setScreenPts(tmpPts);
          stateRef.current.screenPts = tmpPts;
          const geoMid: LngLat = [
            (s.points[m][0] + s.points[(m + 1) % s.points.length][0]) / 2,
            (s.points[m][1] + s.points[(m + 1) % s.points.length][1]) / 2,
          ];
          base = { points: [...s.points.slice(0, insertAt), geoMid, ...s.points.slice(insertAt)], closed: true };
          commit(base);
          index = insertAt;
        }
      }
      gesture.current = { x0: x, y0: y, t0: Date.now(), index, moved: false, base };
      if (index !== null) setDrag({ index, x, y });
    },
    onMove: (_e, gs) => {
      const g = gesture.current;
      if (!g) return;
      if (Math.hypot(gs.dx, gs.dy) > 8) g.moved = true;
      if (g.index !== null) setDrag({ index: g.index, x: g.x0 + gs.dx, y: g.y0 + gs.dy });
    },
    onRelease: (_e, gs) => void finishGesture(gs.dx, gs.dy),
  });

  const finishGesture = async (dx: number, dy: number) => {
    const g = gesture.current;
    gesture.current = null;
    const s = surfaceRef.current;
    if (!g || !s) return;
    const { screenPts: pts } = stateRef.current;
    const cur = g.base;
    if (g.index !== null) {
      setDrag(null);
      if (!g.moved) {
        // tap on the first vertex closes the outline
        if (!cur.closed && g.index === 0 && cur.points.length >= 3) {
          commit({ points: cur.points, closed: true });
          setHint(undefined);
        }
        return;
      }
      const ll = await s.unproject([g.x0 + dx, g.y0 + dy]);
      const points = cur.points.slice();
      points[g.index] = ll;
      commit({ points, closed: cur.closed });
      return;
    }
    if (g.moved || Date.now() - g.t0 > 600) return;
    if (cur.closed) {
      setHint('Outline is closed. Drag a corner to move it, or drag a small + to add a corner.');
      return;
    }
    if (cur.points.length >= 3 && pts.length > 0 && Math.hypot(pts[0][0] - g.x0, pts[0][1] - g.y0) < HANDLE_HIT) {
      commit({ points: cur.points, closed: true });
      return;
    }
    const ll = await s.unproject([g.x0, g.y0]);
    commit({ points: [...cur.points, ll], closed: false });
    setHint(undefined);
  };

  // ------------------------------------------------------------- actions
  const undo = () => {
    const prev = history.current.pop();
    if (prev) setSnap(prev);
    setCanUndo(history.current.length > 0);
  };
  const reset = () => commit({ points: [], closed: false });
  const close = () => {
    if (snap.points.length >= 3) commit({ points: snap.points, closed: true });
  };

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    Keyboard.dismiss();
    searchAbort.current?.abort();
    const ctrl = new AbortController();
    searchAbort.current = ctrl;
    setSearch({ status: 'loading' });
    try {
      const r = await searchAddress(geocoders, q, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (r.results.length === 0) setSearch({ status: 'empty', errors: r.errors });
      else setSearch({ status: 'results', results: r.results, attribution: r.usedGeocoder?.attribution });
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      setSearch({ status: 'error', message: (e as Error).message });
    }
  };

  const goTo = (r: GeocodeResult) => {
    setSearch({ status: 'idle' });
    setMode('pan');
    const s = surfaceRef.current;
    if (!s) return;
    if (r.bbox && r.bbox[2] - r.bbox[0] < 0.01) s.fitBounds(r.bbox, 60);
    else s.flyTo(r.center, 19);
  };

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setSearch({ status: 'error', message: 'Location permission was not granted. You can still search or pan the map.' });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setMode('pan');
      surfaceRef.current?.flyTo([pos.coords.longitude, pos.coords.latitude], 19);
    } catch {
      setSearch({ status: 'error', message: 'Could not get your location.' });
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

  // ------------------------------------------------------------- overlay drawing
  const overlayPts = screenPts.map((p, i) => (drag && drag.index === i ? ([drag.x, drag.y] as [number, number]) : p));
  const ptsStr = overlayPts.map((p) => `${p[0]},${p[1]}`).join(' ');
  const crossingSet = new Set(crossing.flat());
  const onLayout = (e: LayoutChangeEvent) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });

  const helper =
    mode === 'pan'
      ? snap.points.length === 0
        ? 'Find your garden, zoom in close, then switch to “Draw outline”.'
        : 'Map unlocked. Pan and zoom, then switch back to “Draw outline” to edit.'
      : !snap.closed
        ? snap.points.length < 3
          ? 'Tap each corner of your garden boundary. The map is locked while drawing.'
          : 'Keep tapping corners. Tap the first corner (or “Close shape”) to finish.'
        : validation?.ok
          ? 'Looks good. Drag corners to adjust, drag + to add a corner, then confirm.'
          : (validation?.issues.map((i) => ISSUE_TEXT[i]).join(' ') ?? '');

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.back} hitSlop={8}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={type.title}>{editing ? 'Edit the boundary' : 'Find your garden'}</Text>
      </View>

      {!editing ? (
        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={runSearch}
            placeholder="Address, place, or “lat, lon”"
            placeholderTextColor={colors.inkMuted}
            returnKeyType="search"
            style={styles.input}
            accessibilityLabel="Search for an address"
            autoCorrect={false}
          />
          <Button label="Search" onPress={runSearch} compact loading={search.status === 'loading'} style={{ marginLeft: space.s }} />
          <Button
            label="◎"
            onPress={useMyLocation}
            compact
            variant="secondary"
            loading={locating}
            style={{ marginLeft: space.s, width: TOUCH }}
            accessibilityHint="Centre the map on your current location"
          />
        </View>
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
          <View
            style={StyleSheet.absoluteFill}
            {...drawResponder.panHandlers}
            accessibilityLabel="Drawing area. Tap to add a boundary corner."
          >
            <Svg width={size.width} height={size.height} pointerEvents="none">
              {overlayPts.length >= 3 && snap.closed ? (
                <Polygon
                  points={ptsStr}
                  fill={colors.outline}
                  fillOpacity={0.3}
                  stroke={validation?.ok ? colors.outlineStroke : colors.danger}
                  strokeWidth={3}
                />
              ) : overlayPts.length >= 2 ? (
                <Polyline points={ptsStr} fill="none" stroke={colors.outlineStroke} strokeWidth={3} />
              ) : null}
              {crossing.map(([i, j]) => (
                <React.Fragment key={`${i}-${j}`}>
                  {[i, j].map((k) => {
                    const a = overlayPts[k];
                    const b = overlayPts[(k + 1) % overlayPts.length];
                    return a && b ? <Line key={k} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={colors.danger} strokeWidth={4} /> : null;
                  })}
                </React.Fragment>
              ))}
              {snap.closed
                ? midpoints(overlayPts).map((m, i) => (
                    <React.Fragment key={`m${i}`}>
                      <Circle cx={m[0]} cy={m[1]} r={9} fill="rgba(255,255,255,0.85)" stroke={colors.outlineStroke} strokeWidth={1.5} />
                      <SvgText x={m[0]} y={m[1] + 4} fontSize={12} fontWeight="700" fill={colors.leafDark} textAnchor="middle">
                        +
                      </SvgText>
                    </React.Fragment>
                  ))
                : null}
              {overlayPts.map((p, i) => (
                <Circle
                  key={i}
                  cx={p[0]}
                  cy={p[1]}
                  r={drag?.index === i ? 14 : i === 0 && !snap.closed && overlayPts.length >= 3 ? 13 : 10}
                  fill={i === 0 && !snap.closed ? colors.outlineStroke : '#fff'}
                  stroke={crossingSet.has(i) ? colors.danger : colors.leafDark}
                  strokeWidth={2.5}
                />
              ))}
            </Svg>
          </View>
        ) : null}

        <View style={styles.mapTop} pointerEvents="box-none">
          {search.status === 'results' ? (
            <View style={styles.results}>
              <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 240 }}>
                {search.results.map((r, i) => (
                  <Pressable key={i} onPress={() => goTo(r)} style={styles.resultItem} accessibilityRole="button">
                    <Text style={type.body} numberOfLines={2}>
                      {r.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              {search.attribution ? <Text style={[type.tiny, { padding: space.s }]}>{search.attribution}</Text> : null}
            </View>
          ) : null}
          {search.status === 'loading' ? (
            <View style={styles.pill}>
              <ActivityIndicator color={colors.leaf} />
              <Text style={[type.small, { marginLeft: space.s }]}>Searching…</Text>
            </View>
          ) : null}
          {search.status === 'empty' ? (
            <Banner tone="warn">
              No matches found. {search.errors.length ? `(${search.errors.join(' · ')}) ` : ''}
              {config.geoapifyKey ? '' : 'Without a Geoapify key only Polish addresses are searchable — or type “lat, lon”.'}
            </Banner>
          ) : null}
          {search.status === 'error' ? <Banner tone="warn">{search.message}</Banner> : null}
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

      <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, space.m) }]}>
        <Segmented
          value={mode}
          onChange={(m) => {
            setMode(m);
            setHint(undefined);
          }}
          options={[
            { value: 'pan', label: '✋  Move map', hint: 'Pan and zoom the map' },
            { value: 'draw', label: '✎  Draw outline', hint: 'Lock the map and place boundary corners' },
          ]}
        />
        {/* Fixed-height text rows: the map must not resize (and shift) while the user is placing corners. */}
        <Text style={[type.small, styles.helper]} accessibilityLiveRegion="polite" numberOfLines={3}>
          {hint ?? helper}
        </Text>
        <Text style={[type.small, styles.statsLine]} numberOfLines={1}>
          {liveStats ? (
            <>
              {snap.closed ? 'Area' : 'Area so far'} ≈{' '}
              <Text style={{ fontWeight: '700', color: colors.ink }}>{Math.round(liveStats.areaM2)} m²</Text> · {snap.points.length} corners ·{' '}
              {liveStats.lengthM.toFixed(1)} × {liveStats.widthM.toFixed(1)} m
            </>
          ) : (
            ' '
          )}
        </Text>
        <View style={styles.actions}>
          <Button label="Undo" variant="secondary" onPress={undo} disabled={!canUndo} style={styles.action} />
          <Button label="Reset" variant="secondary" onPress={reset} disabled={snap.points.length === 0} style={styles.action} />
          {snap.closed ? (
            <Button
              label={editing ? 'Save outline' : 'Confirm'}
              onPress={confirm}
              disabled={!validation?.ok}
              style={[styles.action, { flex: 1.4 }]}
            />
          ) : (
            <Button label="Close shape" onPress={close} disabled={snap.points.length < 3} style={[styles.action, { flex: 1.4 }]} />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.m, paddingVertical: space.s },
  back: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center', marginRight: space.xs },
  backText: { fontSize: 34, color: colors.leafDark, marginTop: -4 },
  searchRow: { flexDirection: 'row', paddingHorizontal: space.l, paddingBottom: space.m, alignItems: 'center' },
  input: {
    flex: 1,
    minHeight: TOUCH,
    borderRadius: radius.m,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: space.m,
    fontSize: 16,
    color: colors.ink,
  },
  mapWrap: { flex: 1, overflow: 'hidden', backgroundColor: '#DCE2D6' },
  mapTop: { position: 'absolute', left: space.m, right: space.m, top: space.m },
  results: { backgroundColor: colors.surface, borderRadius: radius.m, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  resultItem: {
    minHeight: TOUCH,
    paddingHorizontal: space.m,
    paddingVertical: space.s,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  pill: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: space.m,
    paddingVertical: space.s,
  },
  attrib: { position: 'absolute', left: space.s, bottom: space.s, right: 48, alignItems: 'flex-start' },
  attribText: { fontSize: 10, color: '#222', backgroundColor: 'rgba(255,255,255,0.8)', paddingHorizontal: 4, borderRadius: 3 },
  panel: {
    backgroundColor: colors.surface,
    paddingHorizontal: space.l,
    paddingTop: space.m,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  helper: { marginTop: space.s, marginBottom: space.xs, height: 54 },
  statsLine: { height: 20 },
  actions: { flexDirection: 'row', marginTop: space.s },
  action: { flex: 1, marginRight: space.s },
});
