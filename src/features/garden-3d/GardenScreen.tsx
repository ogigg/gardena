import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { newObject } from '../../domain/garden/garden';
import type { ContextBuilding, Garden, GardenObject, LocalPoint, ObjectKind } from '../../domain/garden/types';
import { gardenSun } from '../../domain/sun/sunPosition';
import { CONTEXT_RADIUS_M, fetchOsmContext } from '../../services/obstacles/overpass';
import { config } from '../../shared/config/env';
import { useReducedMotionSetting } from '../../shared/hooks/useReducedMotion';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { IconButton } from '../../shared/ui/IconButton';
import { ScreenHeader } from '../../shared/ui/ScreenHeader';
import { Segmented } from '../../shared/ui/Segmented';
import { colors, space, TOUCH, type } from '../../shared/ui/theme';
import { AddObjectPanel } from './components/AddObjectPanel';
import { CompassButton } from './components/CompassButton';
import { ContextBuildingEditor } from './components/ContextBuildingEditor';
import { GardenInfoPanel } from './components/GardenInfoPanel';
import { ObjectEditor } from './components/ObjectEditor';
import { OutlineMorph, type Morph } from './components/OutlineMorph';
import { SunPanel } from './components/SunPanel';
import { GardenCanvas, type CanvasMode, type GardenCanvasHandle } from './scene/GardenCanvas';
import type { PickResult } from './scene/GardenScene';

type Tab = 'sun' | 'add' | 'edit' | 'info';

/** Step 3–5: the 3D garden with sun controls, objects and garden info. */
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

  const [lon, lat] = garden.origin;
  const tz = garden.timezone;
  const sun = useMemo(() => gardenSun(lat, lon, tz, garden.sun.date, minutes), [lat, lon, tz, garden.sun.date, minutes]);

  // ---------------------------------------------------------------- map → 3D hand-off
  const [morph, setMorph] = useState<Morph | null>(null);
  const [overlayOpacity] = useState(() => new Animated.Value(introFrom && introFrom.length > 2 ? 1 : 0));
  const introStarted = useRef(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const startIntro = (reduce: boolean) => {
    if (!introFrom || introFrom.length < 3) {
      canvasRef.current?.playIntro();
      return;
    }
    canvasWrap.current?.measureInWindow((x, y) => {
      const local = canvasRef.current?.boundaryScreenPoints() ?? [];
      const to = local.map((p) => [p[0] + x, p[1] + y] as [number, number]);
      if (reduce || to.length !== introFrom.length) {
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

  const tabs: { value: Tab; label: string }[] = [
    { value: 'sun', label: '☀ Sun' },
    { value: 'add', label: '+ Add' },
    ...(selected ? [{ value: 'edit' as Tab, label: '✎ Edit' }] : []),
    { value: 'info', label: 'ⓘ Garden' },
  ];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={garden.name}
        subtitle={`${Math.round(garden.stats.areaM2)} m² · ${garden.stats.lengthM.toFixed(1)} × ${garden.stats.widthM.toFixed(1)} m${garden.isDemo ? ' · DEMO' : ''}`}
        onBack={onBack}
        backLabel="Back to gardens"
        right={
          <Button
            label="Edit outline"
            variant="secondary"
            compact
            onPress={editOutline}
            accessibilityHint="Return to the top-down map to change the boundary"
          />
        }
      />

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
          <CompassButton northAngleRad={north} onPress={() => canvasRef.current?.resetView(!reducedMotion)} />
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
            <OutlineMorph morph={morph} />
          </Animated.View>
        ) : introFrom && introFrom.length > 2 ? (
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.introBackdrop, { opacity: overlayOpacity }]} />
        ) : null}
      </View>

      <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, space.s) }]}>
        <Segmented value={tab} onChange={setTab} options={tabs} />
        <ScrollView style={styles.panelBody} contentContainerStyle={{ paddingBottom: space.m }} keyboardShouldPersistTaps="handled">
          {tab === 'sun' ? (
            <SunPanel
              timezone={tz}
              date={garden.sun.date}
              minutes={minutes}
              sun={sun}
              onDateChange={(date) => update((g) => ({ ...g, sun: { ...g.sun, date } }), true)}
              onMinutesChange={setMinutes}
              onMinutesCommit={(m) => update((g) => ({ ...g, sun: { ...g.sun, minutes: m } }))}
            />
          ) : null}
          {tab === 'add' ? <AddObjectPanel onAdd={addObject} /> : null}
          {tab === 'edit' && selectedObject ? (
            <ObjectEditor o={selectedObject} onPatch={(p) => patchObject(selectedObject.id, p)} onDelete={deleteSelected} />
          ) : null}
          {tab === 'edit' && selectedContext ? (
            <ContextBuildingEditor
              building={selectedContext}
              sourceName={garden.context.source}
              onPatch={(p) => patchContext(selectedContext.id, p)}
              onRemove={deleteSelected}
            />
          ) : null}
          {tab === 'info' ? (
            <GardenInfoPanel
              garden={garden}
              onGroundLevelChange={(groundLevelM) => update((g) => ({ ...g, groundLevelM }))}
              onLoadContext={loadContext}
              loadingContext={loadingContext}
              lowDetail={lowDetail}
              onLowDetailChange={setLowDetail}
              onDelete={onDelete}
            />
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  canvasWrap: { flex: 1, backgroundColor: '#E9EFE6', overflow: 'hidden' },
  glError: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  topOverlay: { position: 'absolute', top: space.m, left: space.m, right: space.m, flexDirection: 'row', alignItems: 'center' },
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
});
