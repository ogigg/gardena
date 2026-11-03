import * as THREE from 'three';

/**
 * Orbit camera around a target on the ground.
 * World axes: +X = east, +Y = up, −Z = north (so north is "up" on screen at azimuth 0).
 * polar = angle from straight down (0 = top-down plan view).
 * azimuth = rotation of the camera around the target; 0 = camera south of target looking north.
 */
export interface OrbitState {
  target: THREE.Vector3;
  distance: number;
  polar: number;
  azimuth: number;
}

export const POLAR_MIN = 0.0001;
export const POLAR_MAX = 1.35; // ~77°, keeps the horizon out of most views
export const ISO_POLAR = 0.95; // ~54° tilt
export const ISO_AZIMUTH = -0.55; // look from south-south-west

export function applyOrbit(cam: THREE.PerspectiveCamera, s: OrbitState): void {
  const sp = Math.sin(s.polar);
  const cp = Math.cos(s.polar);
  const sa = Math.sin(s.azimuth);
  const ca = Math.cos(s.azimuth);
  cam.position.set(s.target.x + s.distance * sp * sa, s.target.y + s.distance * cp, s.target.z + s.distance * sp * ca);
  // Screen-up is the tangent toward decreasing polar angle; well defined even top-down.
  cam.up.set(-cp * sa, sp, -cp * ca).normalize();
  cam.lookAt(s.target);
  cam.updateMatrixWorld();
}

/** Distance at which a ground rectangle (w × h metres) fits a view with the given padding fraction. */
export function fitDistance(cam: THREE.PerspectiveCamera, widthM: number, heightM: number, aspect: number, pad = 0.18): number {
  const vfov = (cam.fov * Math.PI) / 180;
  const visH = heightM / (1 - 2 * pad);
  const visW = widthM / (1 - 2 * pad);
  const dH = visH / (2 * Math.tan(vfov / 2));
  const dW = visW / (2 * Math.tan(vfov / 2) * aspect);
  return Math.max(dH, dW, 4);
}

export function lerpOrbit(a: OrbitState, b: OrbitState, t: number): OrbitState {
  return {
    target: a.target.clone().lerp(b.target, t),
    distance: a.distance + (b.distance - a.distance) * t,
    polar: a.polar + (b.polar - a.polar) * t,
    azimuth: a.azimuth + (b.azimuth - a.azimuth) * t,
  };
}

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Screen angle (radians, clockwise from screen-up) at which true north points. */
export function northScreenAngle(cam: THREE.PerspectiveCamera, target: THREE.Vector3): number {
  const a = target.clone().project(cam);
  const b = target
    .clone()
    .add(new THREE.Vector3(0, 0, -1))
    .project(cam);
  // NDC y is up; scale x by aspect so the angle is in true screen proportions
  return Math.atan2((b.x - a.x) * cam.aspect, b.y - a.y);
}
