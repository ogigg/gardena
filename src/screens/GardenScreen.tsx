import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polygon } from 'react-native-svg';
import { config } from '../config/env';
import { newObject } from '../garden/model';
import { compassLabel } from '../geo/polygon';
import type { ContextBuilding, Garden, GardenObject, HeightSource, LocalPoint, ObjectKind } from '../geo/types';
import { CONTEXT_RADIUS_M, fetchOsmContext } from '../providers/obstacles';
import { compassPoint, gardenSun } from '../sun/sun';
import {
  addDays,
  deviceTimezone,
  formatClock,
  formatOffset,
  offsetMinutesAt,
  parseDate,
  prettyDate,
  supportsIntlTimeZones,
  todayInZone,
  utcToZoned,
  zonedToUtc,
} from '../sun/time';
import { GardenCanvas, type CanvasMode, type GardenCanvasHandle } from '../three/GardenCanvas';
import type { PickResult } from '../three/GardenScene';
import { Banner, Button, Chip, IconButton, ScrubBar, Segmented, Stepper } from '../ui/controls';
import { colors, radius, space, TOUCH, type } from '../ui/theme';
import { useReducedMotionSetting } from '../ui/useReducedMotion';

type Tab = 'sun' | 'add' | 'edit' | 'info';

const HEIGHT_LABEL: Record<HeightSource, string> = {
  manual: 'set by you',
  default: 'app default — adjust to match reality',
  tagged: 'from OpenStreetMap height tag',
  levels: 'estimated from storey count (3 m per storey)',
  assumed: 'ASSUMED — no height data available',
  sample: 'sample data — not real',
};

export function GardenScreen({
  garden,
  onChange,
  onBack,
  onEditOutline,
  introFrom,
  onDelete,
}: {
  garden: Garden;
  onChange: (g: Garden, opts?: { immediate?: boolean }) => void;
  onBack: () => void;
  onEditOutline: () => void;
  introFrom?: [number, number][];
  onDelete: () => void;
}) {
  const insets = useSafeAreaInsets();
  const motionSetting = useReducedMotionSetting();
  const reducedMotion = motionSetting ?? true;
  const canvasRef = useRef<GardenCanvasHandle>(null);
  const canvasWrap = useRef<React.ComponentRef<typeof View>>(null);
  const [tab, setTab] = useState<Tab>('sun');
  const [mode, setMode] = useState<CanvasMode>('view');
  const [rawSelected, setSelected] = useState<PickResult | null>(null);
  const [north, setNorth] = useState(0);
  const [lowDetail, setLowDetail] = useState(false);
  const [glError, setGlError] = useState<string>();
  const [minutes, setMinutes] = useState(garden.sun.minutes);
  const [loadingContext, setLoadingContext] = useState(false);
  const gardenRef = useRef(garden);
  useLayoutEffect(() => {
    gardenRef.current = garden;
  }, [garden]);

  const update = useCallback(
    (fn: (g: Garden) => Garden, immediate = false) => {
      const next = { ...fn(gardenRef.current), updatedAt: new Date().toISOString() };
      gardenRef.current = next;
      onChange(next, { immediate });
    },
    [onChange],
  );

  // ---------------------------------------------------------------- sun
  const lat = garden.origin[1];
  const lon = garden.origin[0];
  const tz = garden.timezone;
  const sun = useMemo(() => gardenSun(lat, lon, tz, garden.sun.date, minutes), [lat, lon, tz, garden.sun.date, minutes]);
  const phoneTz = deviceTimezone();
  const intlOk = supportsIntlTimeZones();
  const janOffset = offsetMinutesAt(tz, zonedToUtc(tz, `${parseDate(garden.sun.date).year}-01-15`, 720).utcMs);
  const isSummerTime = sun.instant.offsetMinutes !== janOffset;
  const phoneTime = utcToZoned(phoneTz, sun.instant.utcMs);

  const setDate = (date: string) => update((g) => ({ ...g, sun: { ...g.sun, date } }), true);
  const commitMinutes = (m: number) => update((g) => ({ ...g, sun: { ...g.sun, minutes: m } }));
  const toMinutes = (v: number) => Math.min(1435, Math.round((v * 1440) / 5) * 5);

  // ---------------------------------------------------------------- intro hand-off
  const [morph, setMorph] = useState<{ from: [number, number][]; to: [number, number][]; t: number } | null>(null);
  const [overlayOpacity] = useState(() => new Animated.Value(introFrom && introFrom.length > 2 ? 1 : 0));
  const introStarted = useRef(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const startIntro = (reducedMotion: boolean) => {
    if (!introFrom || introFrom.length < 3) {
      canvasRef.current?.playIntro();
      return;
    }
    canvasWrap.current?.measureInWindow((x, y) => {
      const local = canvasRef.current?.boundaryScreenPoints() ?? [];
      const to = local.map((p) => [p[0] + x, p[1] + y] as [number, number]);
      if (reducedMotion || to.length !== introFrom.length) {
        overlayOpacity.setValue(0);
        canvasRef.current?.playIntro();
        return;
      }
      // Stage 1: glide the drawn outline from its map position onto the plan view.
      const start = Date.now();
      const dur = 550;
      const step = () => {
        const t = Math.min(1, (Date.now() - start) / dur);
        setMorph({ from: introFrom, to, t: 1 - Math.pow(1 - t, 3) });
        if (t < 1) requestAnimationFrame(step);
        else {
          // Stage 2: the outline becomes the 3D surface while the camera tilts.
          canvasRef.current?.playIntro();
          Animated.timing(overlayOpacity, { toValue: 0, duration: 450, useNativeDriver: true }).start(() => setMorph(null));
        }
      };
      requestAnimationFrame(step);
    });
  };

  // Start only once both the GL scene and the OS reduce-motion setting are known.
  useEffect(() => {
    if (!canvasReady || motionSetting === null || introStarted.current) return;
    introStarted.current = true;
    startIntro(motionSetting);
  });

  // ---------------------------------------------------------------- objects
  const selectedObject = rawSelected?.type === 'object' ? garden.objects.find((o) => o.id === rawSelected.id) : undefined;
  const selectedContext = rawSelected?.type === 'context' ? garden.context.buildings.find((b) => b.id === rawSelected.id) : undefined;
  // A selection whose object was deleted simply stops being a selection.
  const selected = selectedObject || selectedContext ? rawSelected : null;

  const onSelect = (p: PickResult | null) => {
    setSelected(p);
    if (p) setTab('edit');
    else if (tab === 'edit') setTab('sun');
  };
  const addObject = (kind: ObjectKind) => {
    const c: LocalPoint = canvasRef.current?.viewCentre() ?? { e: 0, n: 0 };
    const o = newObject(kind, c);
    update((g) => ({ ...g, objects: [...g.objects, o] }), true);
    setSelected({ type: 'object', id: o.id });
    setMode('arrange');
    setTab('edit');
  };
  const patchObject = (id: string, patch: Partial<GardenObject>) =>
    update((g) => ({ ...g, objects: g.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));
  const patchContext = (id: string, patch: Partial<ContextBuilding>) =>
    update((g) => ({ ...g, context: { ...g.context, buildings: g.context.buildings.map((b) => (b.id === id ? { ...b, ...patch } : b)) } }));
  const deleteSelected = () => {
    if (!selected) return;
    if (selected.type === 'object') update((g) => ({ ...g, objects: g.objects.filter((o) => o.id !== selected.id) }), true);
    else update((g) => ({ ...g, context: { ...g.context, buildings: g.context.buildings.filter((b) => b.id !== selected.id) } }), true);
    setSelected(null);
    setTab('sun');
  };

  const loadContext = async () => {
    if (!config.overpassUrl) return;
    setLoadingContext(true);
    update((g) => ({ ...g, context: { ...g.context, status: 'loading' } }));
    const ctx = await fetchOsmContext(config.overpassUrl, garden.origin, CONTEXT_RADIUS_M);
    update((g) => ({ ...g, context: ctx }), true);
    setLoadingContext(false);
  };

  const editOutline = async () => {
    await canvasRef.current?.topDown(!reducedMotion);
    onEditOutline();
  };

  // ---------------------------------------------------------------- render
  const tabs: { value: Tab; label: string }[] = [
    { value: 'sun', label: '☀ Sun' },
    { value: 'add', label: '+ Add' },
    ...(selected ? [{ value: 'edit' as Tab, label: '✎ Edit' }] : []),
    { value: 'info', label: 'ⓘ Garden' },
  ];
  const sunMarkers = [
    ...(sun.sunriseMin !== null ? [{ at: sun.sunriseMin / 1440, label: '↑' + formatClock(sun.sunriseMin) }] : []),
    ...(sun.sunsetMin !== null ? [{ at: sun.sunsetMin / 1440, label: '↓' + formatClock(sun.sunsetMin) }] : []),
  ];
  const today = todayInZone(tz).date;
  const year = parseDate(garden.sun.date).year;
  const presets = [
    { label: 'Today', date: today },
    { label: '21 Mar', date: `${year}-03-21` },
    { label: '21 Jun', date: `${year}-06-21` },
    { label: '23 Sep', date: `${year}-09-23` },
    { label: '21 Dec', date: `${year}-12-21` },
  ];
  const contextNote =
    garden.context.status === 'not-loaded'
      ? 'Surrounding buildings are not loaded — shadows only include objects you add.'
      : garden.context.message;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to gardens" onPress={onBack} style={styles.back} hitSlop={8}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={type.heading} numberOfLines={1}>
            {garden.name}
          </Text>
          <Text style={type.tiny}>
            {Math.round(garden.stats.areaM2)} m² · {garden.stats.lengthM.toFixed(1)} × {garden.stats.widthM.toFixed(1)} m
            {garden.isDemo ? ' · DEMO' : ''}
          </Text>
        </View>
        <Button
          label="Edit outline"
          variant="secondary"
          compact
          onPress={editOutline}
          accessibilityHint="Return to the top-down map to change the boundary"
        />
      </View>

      <View style={styles.canvasWrap} ref={canvasWrap} collapsable={false}>
        {glError ? (
          <View style={styles.glError}>
            <Text style={type.body}>{glError}</Text>
          </View>
        ) : (
          <GardenCanvas
            ref={canvasRef}
            garden={garden}
            sun={sun}
            selectedId={selected?.type === 'object' ? selected.id : null}
            mode={mode}
            lowDetail={lowDetail}
            reducedMotion={reducedMotion}
            holdForIntro
            onReady={() => setCanvasReady(true)}
            onSelect={onSelect}
            onMoveObject={(id, p) => patchObject(id, { e: p.e, n: p.n })}
            onNorthAngle={setNorth}
            onError={setGlError}
          />
        )}

        <View style={styles.topOverlay} pointerEvents="box-none">
          <Segmented
            style={{ flex: 1, marginRight: space.s }}
            value={mode}
            onChange={setMode}
            options={[
              { value: 'view', label: 'Orbit', hint: 'Drag to orbit, pinch to zoom, two fingers to pan' },
              { value: 'arrange', label: 'Move objects', hint: 'Drag beds, trees and buildings to move them' },
            ]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`North indicator. Tap to reset the view.`}
            onPress={() => canvasRef.current?.resetView(!reducedMotion)}
            style={styles.compass}
          >
            <View style={{ transform: [{ rotate: `${north}rad` }], alignItems: 'center' }}>
              <Text style={styles.compassN}>N</Text>
              <Text style={styles.compassArrow}>▲</Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.sideButtons} pointerEvents="box-none">
          <IconButton glyph="⟲" label="Reset camera" onPress={() => canvasRef.current?.resetView(!reducedMotion)} />
          <IconButton
            glyph="⊡"
            label="Top-down view"
            onPress={() => void canvasRef.current?.topDown(!reducedMotion)}
            style={{ marginTop: space.s }}
          />
        </View>

        <View style={styles.bottomOverlay} pointerEvents="none">
          {garden.isDemo ? <Banner tone="demo">Demo garden · sample buildings are invented, not real data</Banner> : null}
          {mode === 'arrange' ? (
            <Banner tone="info" style={{ marginTop: space.xs }}>
              Drag an object to move it · drag empty space to orbit
            </Banner>
          ) : null}
          {garden.objects.length === 0 && !garden.isDemo ? (
            <Banner tone="info" style={{ marginTop: space.xs }}>
              Your garden is empty. Use “+ Add” for a bed, a tree or a building.
            </Banner>
          ) : null}
        </View>

        {morph ? (
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: overlayOpacity }]}>
            <MorphOutline morph={morph} offset={canvasWrap} />
          </Animated.View>
        ) : introFrom && introFrom.length > 2 ? (
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.introBackdrop, { opacity: overlayOpacity }]} />
        ) : null}
      </View>

      <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, space.s) }]}>
        <Segmented value={tab} onChange={setTab} options={tabs} />
        <ScrollView style={styles.panelBody} contentContainerStyle={{ paddingBottom: space.m }} keyboardShouldPersistTaps="handled">
          {tab === 'sun' ? (
            <View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: space.m }}>
                {presets.map((p) => (
                  <Chip key={p.label} label={p.label} active={garden.sun.date === p.date} onPress={() => setDate(p.date)} />
                ))}
              </ScrollView>
              <View style={styles.dateRow}>
                <IconButton glyph="‹" label="Previous day" onPress={() => setDate(addDays(garden.sun.date, -1))} />
                <Text style={[type.heading, { flex: 1, textAlign: 'center' }]}>{prettyDate(garden.sun.date)}</Text>
                <IconButton glyph="›" label="Next day" onPress={() => setDate(addDays(garden.sun.date, 1))} />
              </View>
              <ScrubBar
                value={minutes / 1440}
                markers={sunMarkers}
                onChange={(v) => setMinutes(toMinutes(v))}
                onCommit={(v) => commitMinutes(toMinutes(v))}
                step={15 / 1440}
                accessibilityLabel="Time of day in garden time"
                accessibilityValue={formatClock(minutes)}
              />
              <Text style={type.heading}>
                {formatClock(utcToZoned(tz, sun.instant.utcMs).hour * 60 + utcToZoned(tz, sun.instant.utcMs).minute)}{' '}
                <Text style={type.small}>
                  garden time · {tz} ({formatOffset(sun.instant.offsetMinutes)}
                  {isSummerTime ? ', summer time' : ''})
                </Text>
              </Text>
              {phoneTz !== tz ? (
                <Text style={type.small}>
                  Your phone: {formatClock(phoneTime.hour * 60 + phoneTime.minute)} ({phoneTz})
                </Text>
              ) : null}
              {sun.instant.nonexistent ? (
                <Text style={[type.small, { color: colors.warn }]}>{formatClock(minutes)} is skipped by the clock change that day.</Text>
              ) : null}
              <Text style={[type.body, { marginTop: space.s }]}>
                {sun.isUp
                  ? `Sun ${sun.position.altitudeDeg.toFixed(0)}° above the horizon, from the ${compassPoint(sun.position.azimuthDeg)} (${sun.position.azimuthDeg.toFixed(0)}°).`
                  : sun.alwaysUp
                    ? 'Midnight sun today.'
                    : 'Sun below the horizon — no direct sunlight.'}
              </Text>
              {!intlOk ? (
                <Banner tone="warn" style={{ marginTop: space.s }}>
                  This device cannot convert time zones; times are shown in UTC.
                </Banner>
              ) : null}
              <Banner tone="sun" style={{ marginTop: space.s }}>
                Modelled sunlight: sun geometry and the shapes in this scene only. Not measured — ignores weather, terrain and anything not
                modelled. Tree shadows are approximate.
              </Banner>
            </View>
          ) : null}

          {tab === 'add' ? (
            <View style={{ marginTop: space.m }}>
              <Text style={type.small}>New objects are placed in the middle of the view. Switch to “Move objects” to drag them.</Text>
              <View style={styles.addRow}>
                <AddTile glyph="▭" label="Raised bed" onPress={() => addObject('bed')} />
                <AddTile glyph="🌳" label="Tree" onPress={() => addObject('tree')} />
                <AddTile glyph="⌂" label="Building" onPress={() => addObject('building')} />
              </View>
            </View>
          ) : null}

          {tab === 'edit' && selectedObject ? (
            <ObjectEditor o={selectedObject} onPatch={(p) => patchObject(selectedObject.id, p)} onDelete={deleteSelected} />
          ) : null}
          {tab === 'edit' && selectedContext ? (
            <View style={{ marginTop: space.m }}>
              <Text style={type.heading}>{selectedContext.heightSource === 'sample' ? 'Sample building' : 'Nearby building'}</Text>
              <Text style={type.small}>
                {selectedContext.sourceRef === 'sample'
                  ? 'Invented for the demo'
                  : `${garden.context.source ?? ''} · ${selectedContext.sourceRef ?? ''}`}
              </Text>
              <Stepper
                label="Height"
                value={selectedContext.height}
                unit="m"
                step={0.5}
                min={1}
                max={150}
                note={HEIGHT_LABEL[selectedContext.heightSource]}
                onChange={(height) => patchContext(selectedContext.id, { height, heightSource: 'manual' })}
              />
              <Button label="Remove from scene" variant="danger" onPress={deleteSelected} />
            </View>
          ) : null}

          {tab === 'info' ? (
            <View style={{ marginTop: space.m }}>
              <InfoRow k="Area" v={`${garden.stats.areaM2.toFixed(1)} m² (approx.)`} />
              <InfoRow k="Size" v={`${garden.stats.lengthM.toFixed(1)} × ${garden.stats.widthM.toFixed(1)} m (bounding rectangle)`} />
              <InfoRow
                k="Long axis"
                v={`${garden.stats.orientationDeg.toFixed(0)}° from north (${compassLabel(garden.stats.orientationDeg)})`}
              />
              <InfoRow k="Perimeter" v={`${garden.stats.perimeterM.toFixed(1)} m · ${garden.boundary.length} corners`} />
              <InfoRow k="Location" v={`${lat.toFixed(5)}, ${lon.toFixed(5)}${garden.isDemo ? ' (sample)' : ''}`} />
              <InfoRow k="Time zone" v={tz} />
              <InfoRow k="Outline drawn on" v={garden.imagery?.attribution ?? '—'} />
              <Stepper
                label="Ground reference"
                value={garden.groundLevelM}
                unit="m"
                step={0.5}
                min={-500}
                max={5000}
                note="Manual elevation above sea level; terrain and slope are not modelled."
                onChange={(groundLevelM) => update((g) => ({ ...g, groundLevelM }))}
              />
              <View style={styles.sectionTitle}>
                <Text style={type.heading}>Surroundings</Text>
              </View>
              <Text style={type.small}>{contextNote}</Text>
              {garden.context.attribution ? <Text style={type.tiny}>{garden.context.attribution}</Text> : null}
              {!garden.isDemo && config.enableOsmContext ? (
                <Button
                  label={
                    garden.context.status === 'loaded'
                      ? 'Reload nearby buildings'
                      : `Load buildings within ${CONTEXT_RADIUS_M} m (OpenStreetMap)`
                  }
                  variant="secondary"
                  loading={loadingContext}
                  onPress={loadContext}
                  style={{ marginTop: space.s }}
                />
              ) : null}
              {!garden.isDemo ? (
                <Text style={type.tiny}>
                  Uses the public Overpass API — development use only. Heights are labelled by source and editable.
                </Text>
              ) : null}
              <View style={styles.switchRow}>
                <Text style={[type.body, { flex: 1 }]}>Lower detail (faster, softer shadows)</Text>
                <Switch value={lowDetail} onValueChange={setLowDetail} accessibilityLabel="Lower detail rendering" />
              </View>
              <Button label="Delete this garden" variant="danger" onPress={onDelete} style={{ marginTop: space.m }} />
            </View>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

function MorphOutline({
  morph,
}: {
  morph: { from: [number, number][]; to: [number, number][]; t: number };
  offset: React.RefObject<React.ComponentRef<typeof View> | null>;
}) {
  // Coordinates are in window space; the overlay sits inside the canvas, so subtract its origin.
  const [origin, setOrigin] = useState<[number, number] | null>(null);
  const ref = useRef<React.ComponentRef<typeof View>>(null);
  useEffect(() => {
    ref.current?.measureInWindow((x, y) => setOrigin([x, y]));
  }, []);
  const o = origin ?? [0, 0];
  const pts = morph.from
    .map((p, i) => {
      const q = morph.to[i];
      return `${p[0] + (q[0] - p[0]) * morph.t - o[0]},${p[1] + (q[1] - p[1]) * morph.t - o[1]}`;
    })
    .join(' ');
  return (
    <View ref={ref} style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(233,239,230,${1 - morph.t * 0.6})` }]} collapsable={false}>
      {origin ? (
        <Svg width="100%" height="100%">
          <Polygon points={pts} fill={colors.outline} fillOpacity={0.35 + 0.4 * morph.t} stroke={colors.outlineStroke} strokeWidth={3} />
        </Svg>
      ) : null}
    </View>
  );
}

function AddTile({ glyph, label, onPress }: { glyph: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Add ${label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.addTile, pressed && { opacity: 0.7 }]}
    >
      <Text style={{ fontSize: 28 }}>{glyph}</Text>
      <Text style={[type.small, { color: colors.ink, marginTop: space.xs }]}>{label}</Text>
    </Pressable>
  );
}

function ObjectEditor({ o, onPatch, onDelete }: { o: GardenObject; onPatch: (p: Partial<GardenObject>) => void; onDelete: () => void }) {
  const h = (height: number) => onPatch({ height, heightSource: 'manual' });
  return (
    <View style={{ marginTop: space.m }}>
      <Text style={type.heading}>{o.label}</Text>
      <Stepper
        label="Height"
        value={o.height}
        unit="m"
        step={o.kind === 'bed' ? 0.05 : 0.25}
        min={0.1}
        max={60}
        decimals={2}
        note={HEIGHT_LABEL[o.heightSource]}
        onChange={h}
      />
      {o.kind === 'tree' ? (
        <Stepper
          label="Canopy radius"
          value={o.canopyRadius ?? 2}
          unit="m"
          step={0.25}
          min={0.3}
          max={15}
          decimals={2}
          onChange={(canopyRadius) => onPatch({ canopyRadius })}
          note="Canopy shadow is approximate."
        />
      ) : (
        <>
          <Stepper
            label="Width"
            value={o.width}
            unit="m"
            step={0.1}
            min={0.2}
            max={60}
            decimals={1}
            onChange={(width) => onPatch({ width })}
          />
          <Stepper
            label="Depth"
            value={o.depth}
            unit="m"
            step={0.1}
            min={0.2}
            max={60}
            decimals={1}
            onChange={(depth) => onPatch({ depth })}
          />
          <Stepper
            label="Rotation"
            value={o.rotationDeg}
            unit="°"
            step={15}
            min={-180}
            max={180}
            decimals={0}
            onChange={(rotationDeg) => onPatch({ rotationDeg })}
          />
        </>
      )}
      <Text style={type.tiny}>
        Position: {o.e.toFixed(1)} m east, {o.n.toFixed(1)} m north of the garden reference point.
      </Text>
      <Button label="Delete object" variant="danger" onPress={onDelete} style={{ marginTop: space.s }} />
    </View>
  );
}

function InfoRow({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={[type.small, { width: 120 }]}>{k}</Text>
      <Text style={[type.body, { flex: 1 }]}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.m, paddingVertical: space.s },
  back: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 34, color: colors.leafDark, marginTop: -4 },
  canvasWrap: { flex: 1, backgroundColor: '#E9EFE6', overflow: 'hidden' },
  glError: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  topOverlay: { position: 'absolute', top: space.m, left: space.m, right: space.m, flexDirection: 'row', alignItems: 'center' },
  compass: {
    width: TOUCH + 4,
    height: TOUCH + 4,
    borderRadius: (TOUCH + 4) / 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compassN: { fontSize: 11, fontWeight: '800', color: colors.danger, lineHeight: 12 },
  compassArrow: { fontSize: 16, color: colors.danger, lineHeight: 18 },
  sideButtons: { position: 'absolute', right: space.m, top: space.m + TOUCH + 16 },
  bottomOverlay: { position: 'absolute', left: space.m, right: space.m, bottom: space.m },
  introBackdrop: { backgroundColor: '#E9EFE6' },
  panel: {
    backgroundColor: colors.surface,
    paddingHorizontal: space.l,
    paddingTop: space.m,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    height: 330,
  },
  panelBody: { flex: 1 },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.s },
  addRow: { flexDirection: 'row', marginTop: space.m },
  addTile: {
    flex: 1,
    minHeight: 96,
    marginRight: space.s,
    borderRadius: radius.l,
    backgroundColor: colors.leafSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRow: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  sectionTitle: { marginTop: space.l, marginBottom: space.xs },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.m, minHeight: TOUCH },
});
