import React, { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polygon, Polyline } from 'react-native-svg';
import type { LngLat } from '../../../domain/garden/types';
import { colors } from '../../../shared/ui/theme';
import { fitZoom, lngLatToWorld, metresPerPixel, project, unproject, type Viewport } from './mercator';
import type { MapSurfaceHandle, MapSurfaceProps } from './types';

const SPACINGS = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];

/**
 * Imagery-free surface: a north-up metric grid with pan and pinch-zoom.
 * Used in demo mode, on web, and wherever no licensed imagery covers the area.
 */
export const GridSurface = forwardRef<MapSurfaceHandle, MapSurfaceProps>(function GridSurface(
  { initialView, interactive, outline, closed, onViewChange },
  ref,
) {
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [view, setView] = useState(initialView);
  const viewRef = useRef(view);
  viewRef.current = view;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const cbRef = useRef(onViewChange);
  cbRef.current = onViewChange;

  const vp = (): Viewport => ({ ...viewRef.current, ...sizeRef.current });

  const apply = (center: LngLat, zoom: number) => {
    const next = { center, zoom: Math.max(3, Math.min(22, zoom)) };
    viewRef.current = next;
    setView(next);
    cbRef.current?.(next);
  };

  useImperativeHandle(ref, () => ({
    async project(points) {
      return points.map((p) => project(vp(), p));
    },
    async unproject(px) {
      return unproject(vp(), px);
    },
    flyTo(center, zoom) {
      apply(center, zoom);
    },
    fitBounds(bbox, padding) {
      const f = fitZoom(bbox, sizeRef.current.width, sizeRef.current.height, padding);
      apply(f.center, f.zoom);
    },
    async getView() {
      return viewRef.current;
    },
  }));

  const interactiveRef = useRef(interactive);
  interactiveRef.current = interactive;
  const gesture = useRef<{ startView: typeof view; startDist?: number; startMid?: [number, number] } | null>(null);
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => interactiveRef.current,
        onMoveShouldSetPanResponder: () => interactiveRef.current,
        onPanResponderGrant: () => {
          gesture.current = { startView: viewRef.current };
        },
        onPanResponderMove: (e, g) => {
          const st = gesture.current;
          if (!st) return;
          const touches = e.nativeEvent.touches;
          const v0: Viewport = { ...st.startView, ...sizeRef.current };
          if (touches.length >= 2) {
            const a = touches[0];
            const b = touches[1];
            const dist = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
            if (!st.startDist) {
              st.startDist = dist;
              st.startView = viewRef.current;
              return;
            }
            const zoom = st.startView.zoom + Math.log2(dist / st.startDist);
            apply(st.startView.center, zoom);
            return;
          }
          if (st.startDist) return; // finger lifted after pinch: ignore residual pan
          const c = project(v0, st.startView.center);
          apply(unproject(v0, [c[0] - g.dx, c[1] - g.dy]), st.startView.zoom);
        },
        onPanResponderRelease: () => {
          gesture.current = null;
        },
      }),
    [],
  );
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    sizeRef.current = { width, height };
    setSize({ width, height });
  };

  const current: Viewport = { ...view, ...size };
  const mpp = metresPerPixel(view.center[1], view.zoom);
  const spacing = SPACINGS.find((s) => s / mpp >= 36) ?? 1000;
  const stepPx = spacing / mpp;
  const cw = lngLatToWorld(view.center, view.zoom);
  const offX = (((size.width / 2 - cw[0]) % stepPx) + stepPx) % stepPx;
  const offY = (((size.height / 2 - cw[1]) % stepPx) + stepPx) % stepPx;
  const lines: React.ReactNode[] = [];
  let k = 0;
  for (let x = offX; x < size.width; x += stepPx) {
    const idx = Math.round((x - size.width / 2 + cw[0]) / stepPx);
    lines.push(
      <Line key={`x${k++}`} x1={x} y1={0} x2={x} y2={size.height} stroke={idx % 5 === 0 ? '#C9C1AE' : '#E2DCCD'} strokeWidth={1} />,
    );
  }
  for (let y = offY; y < size.height; y += stepPx) {
    const idx = Math.round((y - size.height / 2 + cw[1]) / stepPx);
    lines.push(
      <Line key={`y${k++}`} x1={0} y1={y} x2={size.width} y2={y} stroke={idx % 5 === 0 ? '#C9C1AE' : '#E2DCCD'} strokeWidth={1} />,
    );
  }
  const pts = interactive ? outline.map((p) => project(current, p)) : [];
  const ptsStr = pts.map((p) => `${p[0]},${p[1]}`).join(' ');

  return (
    <View style={[StyleSheet.absoluteFill, styles.bg]} onLayout={onLayout} {...responder.panHandlers}>
      <Svg width={size.width} height={size.height} pointerEvents="none">
        {lines}
        {pts.length >= 3 && closed ? (
          <Polygon points={ptsStr} fill={colors.outline} fillOpacity={0.45} stroke={colors.outlineStroke} strokeWidth={3} />
        ) : pts.length >= 2 ? (
          <Polyline points={ptsStr} fill="none" stroke={colors.outlineStroke} strokeWidth={3} />
        ) : null}
        {pts.map((p, i) => (
          <Circle key={i} cx={p[0]} cy={p[1]} r={5} fill="#fff" stroke={colors.outlineStroke} strokeWidth={2} />
        ))}
      </Svg>
      <View pointerEvents="none" style={styles.scale}>
        <View style={[styles.scaleBar, { width: stepPx }]} />
        <Text style={styles.scaleText}>{spacing >= 1 ? `${spacing} m` : `${spacing * 100} cm`} per square · no imagery</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  bg: { backgroundColor: '#F1EDE2' },
  scale: { position: 'absolute', left: 12, top: 10, flexDirection: 'row', alignItems: 'center' },
  scaleBar: { height: 4, backgroundColor: colors.inkSoft, borderRadius: 2, marginRight: 8 },
  scaleText: { fontSize: 12, color: colors.inkSoft, backgroundColor: 'rgba(241,237,226,0.85)', paddingHorizontal: 4 },
});
