import React, { useLayoutEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polygon, Polyline, Text as SvgText } from 'react-native-svg';
import type { LngLat } from '../../../domain/garden/types';
import { usePanResponder } from '../../../shared/hooks/usePanResponder';
import { colors } from '../../../shared/ui/theme';
import type { Snapshot } from '../hooks/useBoundaryDraft';
import type { MapSurfaceHandle } from '../map/types';

type Px = [number, number];
const HANDLE_HIT = 26;

function nearest(x: number, y: number, pts: Px[], max: number) {
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
}

function midpoints(pts: Px[]): Px[] {
  return pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length];
    return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  });
}

/**
 * Touch layer shown in "Draw outline" mode while the map is locked.
 * Tap adds a corner, tapping the first corner closes the outline, dragging a
 * corner moves it, dragging a "+" inserts a corner on that edge.
 */
export function DrawingOverlay({
  snap,
  screenPts,
  onScreenPtsChange,
  surface,
  commit,
  onHint,
  size,
  valid,
  crossing,
}: {
  snap: Snapshot;
  /** Current outline vertices projected to view pixels. */
  screenPts: Px[];
  onScreenPtsChange: (pts: Px[]) => void;
  surface: () => MapSurfaceHandle | null;
  commit: (next: Snapshot) => void;
  onHint: (hint: string | undefined) => void;
  size: { width: number; height: number };
  valid: boolean;
  crossing: [number, number][];
}) {
  const [drag, setDrag] = useState<{ index: number; x: number; y: number } | null>(null);
  const stateRef = useRef({ snap, screenPts });
  useLayoutEffect(() => {
    stateRef.current = { snap, screenPts };
  }, [snap, screenPts]);
  const gesture = useRef<{ x0: number; y0: number; t0: number; index: number | null; moved: boolean; base: Snapshot } | null>(null);

  const responder = usePanResponder({
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
          const insertAt = m + 1;
          const tmpPts = [...pts.slice(0, insertAt), midpoints(pts)[m], ...pts.slice(insertAt)];
          onScreenPtsChange(tmpPts);
          stateRef.current.screenPts = tmpPts;
          const a = s.points[m];
          const b = s.points[(m + 1) % s.points.length];
          const geoMid: LngLat = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
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
    onRelease: (_e, gs) => void finish(gs.dx, gs.dy),
  });

  const finish = async (dx: number, dy: number) => {
    const g = gesture.current;
    gesture.current = null;
    const s = surface();
    if (!g || !s) return;
    const pts = stateRef.current.screenPts;
    const cur = g.base;
    if (g.index !== null) {
      setDrag(null);
      if (!g.moved) {
        // tap on the first vertex closes the outline
        if (!cur.closed && g.index === 0 && cur.points.length >= 3) {
          commit({ points: cur.points, closed: true });
          onHint(undefined);
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
      onHint('Outline is closed. Drag a corner to move it, or drag a small + to add a corner.');
      return;
    }
    if (cur.points.length >= 3 && pts.length > 0 && Math.hypot(pts[0][0] - g.x0, pts[0][1] - g.y0) < HANDLE_HIT) {
      commit({ points: cur.points, closed: true });
      return;
    }
    const ll = await s.unproject([g.x0, g.y0]);
    commit({ points: [...cur.points, ll], closed: false });
    onHint(undefined);
  };

  const overlayPts = screenPts.map((p, i) => (drag && drag.index === i ? ([drag.x, drag.y] as Px) : p));
  const ptsStr = overlayPts.map((p) => `${p[0]},${p[1]}`).join(' ');
  const crossingSet = new Set(crossing.flat());

  return (
    <View style={StyleSheet.absoluteFill} {...responder.panHandlers} accessibilityLabel="Drawing area. Tap to add a boundary corner.">
      <Svg width={size.width} height={size.height} pointerEvents="none">
        {overlayPts.length >= 3 && snap.closed ? (
          <Polygon
            points={ptsStr}
            fill={colors.outline}
            fillOpacity={0.3}
            stroke={valid ? colors.outlineStroke : colors.danger}
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
  );
}
