import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createDemoGarden, localBoundary, newObject } from '../src/garden/model';
import { GardenScene, SLAB_THICKNESS, toWorld } from '../src/three/GardenScene';
import { applyOrbit, northScreenAngle } from '../src/three/cameraRig';
import { sunVector } from '../src/sun/sun';

describe('3D scene', () => {
  it('builds a slab with the garden footprint, scale and north orientation', () => {
    const g = createDemoGarden();
    const s = new GardenScene({ lowDetail: true });
    s.setGarden(g);
    const slab = s.scene.getObjectByName('garden-slab') as THREE.Mesh;
    slab.geometry.computeBoundingBox();
    const bb = slab.geometry.boundingBox!;
    const local = localBoundary(g);
    const eRange = Math.max(...local.map((p) => p.e)) - Math.min(...local.map((p) => p.e));
    const nRange = Math.max(...local.map((p) => p.n)) - Math.min(...local.map((p) => p.n));
    expect(bb.max.x - bb.min.x).toBeCloseTo(eRange, 3); // east-west extent in metres
    expect(bb.max.z - bb.min.z).toBeCloseTo(nRange, 3); // north-south extent in metres
    expect(bb.max.y).toBeCloseTo(SLAB_THICKNESS, 6);
    // northernmost local point maps to the smallest z (north = −Z)
    const north = local.reduce((a, b) => (b.n > a.n ? b : a));
    expect(toWorld(north).z).toBeCloseTo(bb.min.z, 3);
    // the slab area equals the polygon area (top cap triangles)
    expect(g.stats.areaM2).toBeCloseTo(23 * 13 + 14 * 7, 0);
  });

  it('top-down home view has north up on screen; isometric view rotates the compass', () => {
    const s = new GardenScene({ lowDetail: true });
    s.setGarden(createDemoGarden());
    s.setAspect(0.6);
    s.applyOrbit(s.homeOrbit(0.6, true));
    expect(northScreenAngle(s.camera, s.orbit.target)).toBeCloseTo(0, 3);
    const iso = s.homeOrbit(0.6, false);
    s.applyOrbit(iso);
    expect(Math.abs(northScreenAngle(s.camera, s.orbit.target))).toBeGreaterThan(0.2);
  });

  it('top-down framing contains the whole outline', () => {
    const s = new GardenScene({ lowDetail: true });
    s.setGarden(createDemoGarden());
    s.setAspect(390 / 600);
    s.applyOrbit(s.homeOrbit(390 / 600, true));
    for (const [x, y] of s.boundaryScreenPoints(390, 600)) {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(390);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(600);
    }
  });

  it('picks objects and maps screen taps to ground metres', () => {
    const g = createDemoGarden();
    g.objects = [{ ...newObject('building', { e: 0, n: 0 }), width: 4, depth: 4, height: 3 }];
    const s = new GardenScene({ lowDetail: true });
    s.setGarden(g);
    s.setAspect(1);
    s.applyOrbit({ target: new THREE.Vector3(0, 0, 0), distance: 30, polar: 0.0001, azimuth: 0 });
    s.scene.updateMatrixWorld(true);
    expect(s.pick(new THREE.Vector2(0, 0))?.id).toBe(g.objects[0].id);
    expect(s.pick(new THREE.Vector2(0.9, 0.9))).toBeNull();
    const p = s.groundPoint(new THREE.Vector2(0, 0.5))!;
    expect(p.e).toBeCloseTo(0, 3);
    expect(p.n).toBeGreaterThan(0); // screen-up is north in plan view
  });

  it('places the sun light on the sun side and turns it off at night', () => {
    const s = new GardenScene({ lowDetail: true });
    s.setGarden(createDemoGarden());
    // sun in the south-west, 30° up
    s.setSun(sunVector({ azimuthDeg: 225, altitudeDeg: 30 }), true);
    const light = s.scene.children.find((c) => (c as THREE.DirectionalLight).isDirectionalLight) as THREE.DirectionalLight;
    expect(light.position.x).toBeLessThan(0); // west
    expect(light.position.z).toBeGreaterThan(0); // south (+Z)
    expect(light.intensity).toBeGreaterThan(1);
    s.setSun(sunVector({ azimuthDeg: 0, altitudeDeg: -10 }), false);
    expect(light.intensity).toBe(0);
    expect(light.castShadow).toBe(false);
  });

  it('only flags shadow recomputation for sun/geometry changes, not camera moves', () => {
    const g = createDemoGarden();
    const s = new GardenScene({ lowDetail: true });
    s.setGarden(g);
    s.shadowsDirty = false;
    s.applyOrbit({ ...s.orbit, azimuth: 1 });
    applyOrbit(s.camera, s.orbit);
    expect(s.shadowsDirty).toBe(false);
    s.setGarden(g); // same references → no rebuild
    expect(s.shadowsDirty).toBe(false);
    s.setGarden({ ...g, objects: [...g.objects] });
    expect(s.shadowsDirty).toBe(true);
  });
});
