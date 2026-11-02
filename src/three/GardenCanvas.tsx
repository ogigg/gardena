import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { PanResponder, Platform, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import * as THREE from 'three';
import type { Garden, LocalPoint } from '../geo/types';
import type { GardenSunState } from '../sun/sun';
import { easeInOut, lerpOrbit, northScreenAngle, POLAR_MAX, POLAR_MIN, type OrbitState } from './cameraRig';
import { GardenScene, type PickResult } from './GardenScene';

export type CanvasMode = 'view' | 'arrange';

export interface GardenCanvasHandle {
  resetView(animate?: boolean): void;
  topDown(animate?: boolean): Promise<void>;
  /** Plays the outline → 3D intro (top-down → isometric). */
  playIntro(): void;
  boundaryScreenPoints(): [number, number][];
  /** Ground point in local metres at the centre of the view (for placing new objects). */
  viewCentre(): LocalPoint;
}

interface Props {
  garden: Garden;
  sun: GardenSunState;
  selectedId: string | null;
  mode: CanvasMode;
  lowDetail: boolean;
  reducedMotion: boolean;
  /** Start in top-down framing, waiting for playIntro(). */
  holdForIntro?: boolean;
  onReady?: () => void;
  onSelect: (p: PickResult | null) => void;
  onMoveObject: (id: string, p: LocalPoint) => void;
  onNorthAngle: (rad: number) => void;
  onError?: (msg: string) => void;
}

/** Minimal canvas stand-in so three.js can drive an expo-gl context on iOS/Android. */
function canvasShim(gl: ExpoWebGLRenderingContext) {
  return {
    width: gl.drawingBufferWidth,
    height: gl.drawingBufferHeight,
    style: {},
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    clientHeight: gl.drawingBufferHeight,
    getContext: () => gl,
  } as unknown as HTMLCanvasElement;
}

export const GardenCanvas = forwardRef<GardenCanvasHandle, Props>(function GardenCanvas(props, ref) {
  const propsRef = useRef(props);
  propsRef.current = props;
  const scene = useMemo(() => new GardenScene({ lowDetail: props.lowDetail }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const size = useRef({ width: 1, height: 1 });
  const glRef = useRef<ExpoWebGLRenderingContext | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const scheduled = useRef(false);
  const lastShadowAt = useRef(0);
  const lastNorth = useRef(99);
  const anim = useRef<{ from: OrbitState; to: OrbitState; start: number; dur: number; intro: boolean; done?: () => void } | null>(null);
  const interacting = useRef(false);
  const introPending = useRef(!!props.holdForIntro);

  // ------------------------------------------------------------------ render
  const renderNow = () => {
    scheduled.current = false;
    const gl = glRef.current;
    const renderer = rendererRef.current;
    if (!gl || !renderer) return;
    const now = Date.now();
    const a = anim.current;
    if (a) {
      const t = Math.min(1, (now - a.start) / a.dur);
      const k = easeInOut(t);
      scene.applyOrbit(lerpOrbit(a.from, a.to, k));
      if (a.intro) scene.setIntroProgress(k);
      if (t >= 1) {
        anim.current = null;
        a.done?.();
      } else requestRender();
    }
    if (scene.shadowsDirty) {
      // Throttle shadow-map passes while dragging/scrubbing; camera moves never trigger them.
      const minGap = propsRef.current.lowDetail ? 150 : 60;
      if (now - lastShadowAt.current >= minGap || (!interacting.current && !a)) {
        renderer.shadowMap.needsUpdate = true;
        scene.shadowsDirty = false;
        lastShadowAt.current = now;
      } else {
        setTimeout(requestRender, minGap);
      }
    }
    renderer.render(scene.scene, scene.camera);
    gl.endFrameEXP?.();
    const north = northScreenAngle(scene.camera, scene.orbit.target);
    if (Math.abs(north - lastNorth.current) > 0.005) {
      lastNorth.current = north;
      propsRef.current.onNorthAngle(north);
    }
  };
  const requestRender = () => {
    if (scheduled.current) return;
    scheduled.current = true;
    requestAnimationFrame(renderNow);
  };

  const aspect = () => size.current.width / Math.max(1, size.current.height);

  const animateTo = (to: OrbitState, dur: number, intro = false) =>
    new Promise<void>((resolve) => {
      if (propsRef.current.reducedMotion || dur <= 0) {
        anim.current = null;
        scene.applyOrbit(to);
        if (intro) scene.setIntroProgress(1);
        requestRender();
        resolve();
        return;
      }
      anim.current = {
        from: { ...scene.orbit, target: scene.orbit.target.clone() },
        to,
        start: Date.now(),
        dur,
        intro,
        done: resolve,
      };
      requestRender();
    });

  useImperativeHandle(ref, () => ({
    resetView(animate = true) {
      void animateTo(scene.homeOrbit(aspect(), false), animate ? 700 : 0);
    },
    topDown(animate = true) {
      return animateTo(scene.homeOrbit(aspect(), true), animate ? 650 : 0);
    },
    playIntro() {
      introPending.current = false;
      scene.applyOrbit(scene.homeOrbit(aspect(), true));
      scene.setIntroProgress(0);
      void animateTo(scene.homeOrbit(aspect(), false), 1700, true);
    },
    boundaryScreenPoints() {
      return scene.boundaryScreenPoints(size.current.width, size.current.height);
    },
    viewCentre() {
      return scene.groundPoint(new THREE.Vector2(0, 0)) ?? { e: 0, n: 0 };
    },
  }));

  // --------------------------------------------------------------- sync props
  useEffect(() => {
    scene.setGarden(props.garden);
    requestRender();
  }, [props.garden, scene]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    scene.setSun(props.sun.vector, props.sun.isUp);
    requestRender();
  }, [props.sun, scene]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    scene.setSelection(props.selectedId);
    requestRender();
  }, [props.selectedId, scene]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    scene.setLowDetail(props.lowDetail);
    requestRender();
  }, [props.lowDetail, scene]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(
    () => () => {
      scene.dispose();
      rendererRef.current?.dispose();
    },
    [scene],
  );

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    try {
      const webCanvas = (gl as unknown as { canvas?: HTMLCanvasElement }).canvas;
      const renderer = new THREE.WebGLRenderer({
        canvas: Platform.OS === 'web' && webCanvas ? webCanvas : canvasShim(gl),
        context: gl as unknown as WebGL2RenderingContext,
        antialias: !propsRef.current.lowDetail,
      });
      renderer.setPixelRatio(1);
      renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight, false);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = propsRef.current.lowDetail ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
      renderer.shadowMap.autoUpdate = false;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      glRef.current = gl;
      rendererRef.current = renderer;
      scene.setAspect(aspect());
      scene.setGarden(propsRef.current.garden);
      scene.setSun(propsRef.current.sun.vector, propsRef.current.sun.isUp);
      if (introPending.current) {
        scene.applyOrbit(scene.homeOrbit(aspect(), true));
        scene.setIntroProgress(0);
      } else {
        scene.applyOrbit(scene.homeOrbit(aspect(), false));
        scene.setIntroProgress(1);
      }
      requestRender();
      propsRef.current.onReady?.();
    } catch (e) {
      propsRef.current.onError?.(`3D view could not start: ${(e as Error).message}`);
    }
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    size.current = { width, height };
    scene.setAspect(aspect());
    const gl = glRef.current;
    if (gl && rendererRef.current) rendererRef.current.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight, false);
    requestRender();
  };

  // ----------------------------------------------------------------- gestures
  const g = useRef<{
    start: number;
    x0: number;
    y0: number;
    orbit0: OrbitState;
    moved: boolean;
    pinchDist?: number;
    mid0?: [number, number];
    dragId?: string;
    dragOffset?: LocalPoint;
    dragLast?: LocalPoint;
  } | null>(null);

  const ndcAt = (x: number, y: number) => new THREE.Vector2((x / size.current.width) * 2 - 1, -(y / size.current.height) * 2 + 1);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e: GestureResponderEvent) => {
          const { locationX: x, locationY: y } = e.nativeEvent;
          interacting.current = true;
          anim.current = null;
          const st: NonNullable<typeof g.current> = {
            start: Date.now(),
            x0: x,
            y0: y,
            orbit0: { ...scene.orbit, target: scene.orbit.target.clone() },
            moved: false,
          };
          if (propsRef.current.mode === 'arrange' && e.nativeEvent.touches.length <= 1) {
            const hit = scene.pick(ndcAt(x, y));
            if (hit?.type === 'object') {
              const o = propsRef.current.garden.objects.find((ob) => ob.id === hit.id);
              const gp = scene.groundPoint(ndcAt(x, y));
              if (o && gp) {
                st.dragId = o.id;
                st.dragOffset = { e: o.e - gp.e, n: o.n - gp.n };
                if (propsRef.current.selectedId !== o.id) propsRef.current.onSelect(hit);
              }
            }
          }
          g.current = st;
        },
        onPanResponderMove: (e: GestureResponderEvent, gs) => {
          const st = g.current;
          if (!st) return;
          if (Math.hypot(gs.dx, gs.dy) > 6) st.moved = true;
          const touches = e.nativeEvent.touches;
          if (touches.length >= 2) {
            const a = touches[0];
            const b = touches[1];
            const dist = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
            const mid: [number, number] = [(a.pageX + b.pageX) / 2, (a.pageY + b.pageY) / 2];
            if (!st.pinchDist) {
              st.pinchDist = dist;
              st.mid0 = mid;
              st.orbit0 = { ...scene.orbit, target: scene.orbit.target.clone() };
              st.dragId = undefined;
              return;
            }
            const distance = Math.min(scene.radius * 8 + 60, Math.max(3, st.orbit0.distance * (st.pinchDist / Math.max(1, dist))));
            // two-finger pan along the ground, scaled to the current zoom
            const k = (distance * 2 * Math.tan((scene.camera.fov * Math.PI) / 360)) / size.current.height;
            const dx = (mid[0] - st.mid0![0]) * k;
            const dy = (mid[1] - st.mid0![1]) * k;
            const az = st.orbit0.azimuth;
            const right = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az));
            const fwd = new THREE.Vector3(-Math.sin(az), 0, -Math.cos(az));
            const target = st.orbit0.target.clone().addScaledVector(right, -dx).addScaledVector(fwd, dy);
            scene.applyOrbit({ ...st.orbit0, distance, target });
            requestRender();
            return;
          }
          if (st.pinchDist) return;
          if (st.dragId) {
            const gp = scene.groundPoint(ndcAt(e.nativeEvent.locationX, e.nativeEvent.locationY));
            if (gp) {
              st.dragLast = { e: gp.e + st.dragOffset!.e, n: gp.n + st.dragOffset!.n };
              scene.moveObjectPreview(st.dragId, st.dragLast);
              requestRender();
            }
            return;
          }
          const polar = Math.min(POLAR_MAX, Math.max(POLAR_MIN, st.orbit0.polar - gs.dy * 0.006));
          scene.applyOrbit({ ...st.orbit0, azimuth: st.orbit0.azimuth - gs.dx * 0.008, polar });
          requestRender();
        },
        onPanResponderRelease: (e: GestureResponderEvent) => {
          const st = g.current;
          g.current = null;
          interacting.current = false;
          if (!st) return;
          if (st.dragId && st.dragLast) {
            propsRef.current.onMoveObject(st.dragId, st.dragLast);
          } else if (!st.moved && !st.pinchDist && Date.now() - st.start < 400) {
            propsRef.current.onSelect(scene.pick(ndcAt(st.x0, st.y0)));
          }
          requestRender();
        },
        onPanResponderTerminate: () => {
          g.current = null;
          interacting.current = false;
          requestRender();
        },
      }),
    [scene], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} {...responder.panHandlers}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} pointerEvents="none" />
    </View>
  );
});
