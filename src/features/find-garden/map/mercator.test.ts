import { describe, expect, it } from 'vitest';
import { fitZoom, metresPerPixel, project, unproject } from './mercator';

describe('web mercator viewport', () => {
  const vp = { center: [19.9366, 50.0614] as [number, number], zoom: 18, width: 400, height: 800 };
  it('projects the centre to the middle and round-trips', () => {
    expect(project(vp, vp.center)).toEqual([200, 400]);
    const ll = unproject(vp, [123, 456]);
    const px = project(vp, ll);
    expect(px[0]).toBeCloseTo(123, 6);
    expect(px[1]).toBeCloseTo(456, 6);
  });
  it('north is up and east is right', () => {
    const [x1, y1] = project(vp, [19.9366, 50.0624]);
    const [x2] = project(vp, [19.9376, 50.0614]);
    expect(y1).toBeLessThan(400);
    expect(x1).toBeCloseTo(200, 6);
    expect(x2).toBeGreaterThan(200);
  });
  it('metres per pixel matches the MapLibre 512-px convention (≈0.19 m/px at z18, 50°N)', () => {
    expect(metresPerPixel(50.0614, 18)).toBeCloseTo(0.192, 3);
  });
  it('fits a bbox inside the padded view', () => {
    const bbox: [number, number, number, number] = [19.93, 50.06, 19.94, 50.065];
    const f = fitZoom(bbox, 400, 800, 40);
    const v = { center: f.center, zoom: f.zoom, width: 400, height: 800 };
    const a = project(v, [bbox[0], bbox[3]]);
    const b = project(v, [bbox[2], bbox[1]]);
    expect(a[0]).toBeGreaterThanOrEqual(39.9);
    expect(b[0]).toBeLessThanOrEqual(360.1);
    expect(a[1]).toBeGreaterThanOrEqual(39.9);
    expect(b[1]).toBeLessThanOrEqual(760.1);
  });
});
