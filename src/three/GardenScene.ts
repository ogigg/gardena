import * as THREE from 'three';
import { createLocalFrame, toLocal } from '../geo/projection';
import type { ContextBuilding, Garden, GardenObject, LocalPoint } from '../geo/types';
import type { SunVector } from '../sun/sun';
import { applyOrbit, fitDistance, ISO_AZIMUTH, ISO_POLAR, POLAR_MIN, type OrbitState } from './cameraRig';

/** Local (east, north) metres → world vector. +X east, +Y up, −Z north. */
export function toWorld(p: LocalPoint, y = 0): THREE.Vector3 {
  return new THREE.Vector3(p.e, y, -p.n);
}
export function fromWorld(v: THREE.Vector3): LocalPoint {
  return { e: v.x, n: -v.z };
}

export const SLAB_THICKNESS = 0.12;

const PALETTE = {
  ground: 0xd8d4c4,
  grass: 0x86a85f,
  soilSide: 0x6f5238,
  bedFrame: 0xa07048,
  bedSoil: 0x5a4330,
  trunk: 0x7a5a3c,
  canopy: 0x5d8c4a,
  building: 0xe2d8c6,
  buildingRoof: 0xb9a68a,
  context: 0xbfb9ac,
  contextAssumed: 0xd6d1c6,
  select: 0xf2c14e,
  outline: 0xfff3c4,
  skyDay: 0xe9efe6,
  skyNight: 0x29313b,
};

export interface PickResult {
  type: 'object' | 'context';
  id: string;
}

export interface SceneOptions {
  lowDetail: boolean;
}

/**
 * Builds and updates the three.js scene for one garden. No GL context needed,
 * so geometry and picking can be tested in Node.
 */
export class GardenScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 1, 0.1, 2000);
  readonly orbit: OrbitState = { target: new THREE.Vector3(), distance: 40, polar: ISO_POLAR, azimuth: ISO_AZIMUTH };

  private sunLight = new THREE.DirectionalLight(0xfff4e0, 2);
  private hemi = new THREE.HemisphereLight(0xf3f6ff, 0x8b7d63, 0.9);
  private ground: THREE.Mesh;
  private slab = new THREE.Group();
  private objectsGroup = new THREE.Group();
  private contextGroup = new THREE.Group();
  private selectionRing: THREE.Mesh;
  private sunMarker: THREE.Mesh;
  private outlineLine?: THREE.LineLoop;
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  private lastBoundary?: Garden['boundary'];
  private lastObjects?: Garden['objects'];
  private lastContext?: Garden['context']['buildings'];
  private local: LocalPoint[] = [];
  private sceneRadius = 30;
  private selectedId: string | null = null;
  private lowDetail: boolean;

  /** Set whenever shadows must be recomputed (sun or geometry changed). Camera moves don't set it. */
  shadowsDirty = true;

  constructor(opts: SceneOptions) {
    this.lowDetail = opts.lowDetail;
    this.scene.background = new THREE.Color(PALETTE.skyDay);
    this.scene.add(this.hemi);

    this.sunLight.castShadow = true;
    this.configureShadowMap();
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.ground = new THREE.Mesh(
      new THREE.CircleGeometry(400, 48),
      new THREE.MeshStandardMaterial({ color: PALETTE.ground, roughness: 1 }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.01;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    this.scene.add(this.slab, this.objectsGroup, this.contextGroup);

    this.selectionRing = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1, 48),
      new THREE.MeshBasicMaterial({ color: PALETTE.select, side: THREE.DoubleSide, transparent: true, opacity: 0.95, depthTest: false }),
    );
    this.selectionRing.rotation.x = -Math.PI / 2;
    this.selectionRing.renderOrder = 10;
    this.selectionRing.visible = false;
    this.scene.add(this.selectionRing);

    this.sunMarker = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
    this.scene.add(this.sunMarker);
  }

  setLowDetail(v: boolean) {
    if (v === this.lowDetail) return;
    this.lowDetail = v;
    this.configureShadowMap();
    this.shadowsDirty = true;
  }

  private configureShadowMap() {
    const size = this.lowDetail ? 1024 : 2048;
    this.sunLight.shadow.mapSize.set(size, size);
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.03;
    this.sunLight.shadow.map?.dispose();
    this.sunLight.shadow.map = null as unknown as THREE.WebGLRenderTarget;
  }

  get radius() {
    return this.sceneRadius;
  }

  /** Synchronises scene content with a garden record. Cheap when nothing changed. */
  setGarden(g: Garden) {
    if (g.boundary !== this.lastBoundary) {
      this.lastBoundary = g.boundary;
      const f = createLocalFrame(g.origin);
      this.local = g.boundary.map((p) => toLocal(f, p));
      this.buildSlab();
      this.shadowsDirty = true;
    }
    if (g.objects !== this.lastObjects) {
      this.lastObjects = g.objects;
      this.buildObjects(g.objects);
      this.shadowsDirty = true;
    }
    if (g.context.buildings !== this.lastContext) {
      this.lastContext = g.context.buildings;
      this.buildContext(g.context.buildings, g);
      this.shadowsDirty = true;
    }
    const groundY = 0;
    this.slab.position.y = groundY;
    this.updateSelectionRing();
  }

  private disposeGroup(group: THREE.Group) {
    group.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose?.();
    });
    group.clear();
  }

  private buildSlab() {
    this.disposeGroup(this.slab);
    if (this.local.length < 3) return;
    const shape = new THREE.Shape(this.local.map((p) => new THREE.Vector2(p.e, p.n)));
    const geom = new THREE.ExtrudeGeometry(shape, { depth: SLAB_THICKNESS, bevelEnabled: false });
    geom.rotateX(-Math.PI / 2);
    const top = new THREE.MeshStandardMaterial({ color: PALETTE.grass, roughness: 0.95 });
    const side = new THREE.MeshStandardMaterial({ color: PALETTE.soilSide, roughness: 1 });
    const mesh = new THREE.Mesh(geom, [top, side]);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.name = 'garden-slab';
    this.slab.add(mesh);

    const linePts = this.local.map((p) => toWorld(p, SLAB_THICKNESS + 0.02));
    this.outlineLine = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(linePts),
      new THREE.LineBasicMaterial({ color: PALETTE.outline }),
    );
    this.outlineLine.name = 'garden-outline';
    this.slab.add(this.outlineLine);

    let r = 0;
    for (const p of this.local) r = Math.max(r, Math.hypot(p.e, p.n));
    this.sceneRadius = Math.max(10, r);
  }

  private buildObjects(objects: GardenObject[]) {
    this.disposeGroup(this.objectsGroup);
    for (const o of objects) this.objectsGroup.add(makeObject(o));
  }

  private buildContext(buildings: ContextBuilding[], g: Garden) {
    this.disposeGroup(this.contextGroup);
    const f = createLocalFrame(g.origin);
    for (const b of buildings) {
      const pts = b.footprint.map((p) => toLocal(f, p));
      if (pts.length < 3) continue;
      const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.e, p.n)));
      const geom = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.5, b.height), bevelEnabled: false });
      geom.rotateX(-Math.PI / 2);
      const assumed = b.heightSource === 'assumed';
      const mat = new THREE.MeshStandardMaterial({
        color: assumed ? PALETTE.contextAssumed : PALETTE.context,
        roughness: 1,
        transparent: assumed,
        opacity: assumed ? 0.82 : 1,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { pickType: 'context', pickId: b.id };
      this.contextGroup.add(mesh);
      if (!this.lowDetail) {
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geom, 30), new THREE.LineBasicMaterial({ color: 0x8f897c }));
        this.contextGroup.add(edges);
      }
    }
  }

  setSelection(id: string | null) {
    this.selectedId = id;
    this.updateSelectionRing();
  }

  private updateSelectionRing() {
    const o = this.lastObjects?.find((x) => x.id === this.selectedId);
    if (!o) {
      this.selectionRing.visible = false;
      return;
    }
    const r = o.kind === 'tree' ? (o.canopyRadius ?? 2) : Math.hypot(o.width, o.depth) / 2;
    this.selectionRing.visible = true;
    this.selectionRing.scale.setScalar(r + 0.3);
    this.selectionRing.position.copy(toWorld(o, SLAB_THICKNESS + 0.03));
  }

  /** Fast path for dragging: moves one object's meshes without rebuilding. */
  moveObjectPreview(id: string, p: LocalPoint) {
    const m = this.objectsGroup.children.find((c) => c.userData.objectId === id);
    if (m) m.position.copy(toWorld(p, SLAB_THICKNESS));
    if (id === this.selectedId) this.selectionRing.position.copy(toWorld(p, SLAB_THICKNESS + 0.03));
    this.shadowsDirty = true;
  }

  setSun(v: SunVector, isUp: boolean) {
    const t = this.orbit.target;
    const R = Math.min(120, this.sceneRadius + 70);
    const dir = new THREE.Vector3(v.e, Math.max(v.u, 0.02), -v.n).normalize();
    this.sunLight.target.position.set(0, 0, 0);
    this.sunLight.position.copy(dir.clone().multiplyScalar(R * 2));
    const cam = this.sunLight.shadow.camera;
    cam.left = -R;
    cam.right = R;
    cam.top = R;
    cam.bottom = -R;
    cam.near = 1;
    cam.far = R * 4;
    cam.updateProjectionMatrix();
    const altitude = Math.asin(Math.max(-1, Math.min(1, v.u)));
    // Soft fade near the horizon; no direct light at night.
    const k = isUp ? Math.min(1, altitude / (10 * (Math.PI / 180))) : 0;
    this.sunLight.intensity = 2.3 * k;
    this.sunLight.castShadow = isUp;
    this.hemi.intensity = 0.35 + 0.6 * (isUp ? Math.max(0.35, k) : 0);
    (this.scene.background as THREE.Color).set(isUp ? PALETTE.skyDay : PALETTE.skyNight);
    this.sunMarker.visible = isUp;
    this.sunMarker.position.copy(t.clone().add(dir.clone().multiplyScalar(Math.min(70, this.orbit.distance * 0.9))));
    this.shadowsDirty = true;
  }

  /** Intro animation hook: 0 = flat outline only, 1 = full garden. */
  setIntroProgress(p: number) {
    const s = Math.max(0.001, p);
    this.slab.scale.set(1, s, 1);
    this.objectsGroup.scale.set(1, s, 1);
    this.contextGroup.scale.set(1, s, 1);
    this.objectsGroup.visible = p > 0.02;
    this.contextGroup.visible = p > 0.02;
    this.shadowsDirty = true;
  }

  /** Orbit states for top-down editing and the default isometric view, both north-aligned. */
  homeOrbit(aspect: number, topDown = false): OrbitState {
    let minE = Infinity,
      maxE = -Infinity,
      minN = Infinity,
      maxN = -Infinity;
    for (const p of this.local) {
      minE = Math.min(minE, p.e);
      maxE = Math.max(maxE, p.e);
      minN = Math.min(minN, p.n);
      maxN = Math.max(maxN, p.n);
    }
    if (!isFinite(minE)) {
      minE = -10;
      maxE = 10;
      minN = -10;
      maxN = 10;
    }
    const target = toWorld({ e: (minE + maxE) / 2, n: (minN + maxN) / 2 }, 0);
    const w = maxE - minE;
    const h = maxN - minN;
    const d = fitDistance(this.camera, w, h, aspect, topDown ? 0.14 : 0.05);
    return topDown
      ? { target, distance: d, polar: POLAR_MIN, azimuth: 0 }
      : { target, distance: d * 1.6, polar: ISO_POLAR, azimuth: ISO_AZIMUTH };
  }

  setAspect(aspect: number) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  applyOrbit(s: OrbitState) {
    this.orbit.target.copy(s.target);
    this.orbit.distance = s.distance;
    this.orbit.polar = s.polar;
    this.orbit.azimuth = s.azimuth;
    applyOrbit(this.camera, this.orbit);
    this.camera.far = Math.max(500, this.orbit.distance * 6);
    this.camera.updateProjectionMatrix();
  }

  pick(ndc: THREE.Vector2): PickResult | null {
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects([this.objectsGroup, this.contextGroup], true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.pickType) o = o.parent;
      if (o) return { type: o.userData.pickType, id: o.userData.pickId };
    }
    return null;
  }

  groundPoint(ndc: THREE.Vector2, height = SLAB_THICKNESS): LocalPoint | null {
    this.raycaster.setFromCamera(ndc, this.camera);
    this.groundPlane.constant = -height;
    const v = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.groundPlane, v) ? fromWorld(v) : null;
  }

  /** Boundary vertices in canvas pixels (for the map→3D outline hand-off). */
  boundaryScreenPoints(width: number, height: number): [number, number][] {
    return this.local.map((p) => {
      const v = toWorld(p, SLAB_THICKNESS).project(this.camera);
      return [((v.x + 1) / 2) * width, ((1 - v.y) / 2) * height];
    });
  }

  dispose() {
    this.disposeGroup(this.slab);
    this.disposeGroup(this.objectsGroup);
    this.disposeGroup(this.contextGroup);
  }
}

function makeObject(o: GardenObject): THREE.Group {
  const g = new THREE.Group();
  g.position.copy(toWorld(o, SLAB_THICKNESS));
  g.rotation.y = (-o.rotationDeg * Math.PI) / 180; // compass clockwise → three CCW-positive
  g.userData = { pickType: 'object', pickId: o.id, objectId: o.id };
  const std = (color: number, flat = false) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: flat });

  if (o.kind === 'bed') {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(o.width, o.height, o.depth), std(PALETTE.bedFrame));
    frame.position.y = o.height / 2;
    const soil = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(0.05, o.width - 0.14), 0.02, Math.max(0.05, o.depth - 0.14)),
      std(PALETTE.bedSoil),
    );
    soil.position.y = o.height + 0.005;
    for (const m of [frame, soil]) {
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }
  } else if (o.kind === 'tree') {
    const trunkH = Math.max(0.5, o.height * 0.38);
    const trunkR = Math.max(0.08, 0.06 * Math.sqrt(o.height));
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(trunkR * 0.8, trunkR, trunkH, 10), std(PALETTE.trunk));
    trunk.position.y = trunkH / 2;
    const canopyHalf = Math.max(0.3, (o.height - trunkH) / 2 + 0.25);
    const r = o.canopyRadius ?? 2;
    const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), std(PALETTE.canopy, true));
    canopy.scale.set(r, canopyHalf, r);
    canopy.position.y = o.height - canopyHalf;
    for (const m of [trunk, canopy]) {
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(o.width, o.height, o.depth), std(PALETTE.building));
    body.position.y = o.height / 2;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(o.width + 0.2, 0.12, o.depth + 0.2), std(PALETTE.buildingRoof));
    roof.position.y = o.height + 0.06;
    for (const m of [body, roof]) {
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }
  }
  return g;
}
