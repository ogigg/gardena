import { describe, expect, it } from 'vitest';
import { createDemoGarden } from '../../domain/garden/demoGarden';
import { createGarden, localBoundary, newObject, withBoundary } from '../../domain/garden/garden';
import { GardenRepository, memoryStore } from './gardenRepository';
import { createLocalFrame, toGeo } from '../../domain/geometry/projection';
import { signedArea } from '../../domain/geometry/polygon';

describe('garden records', () => {
  it('creates a CCW, validated garden with the location time zone', () => {
    const f = createLocalFrame([19.93, 50.06]);
    const cw = [
      { e: 0, n: 0 },
      { e: 0, n: 10 },
      { e: 10, n: 10 },
      { e: 10, n: 0 },
    ].map((p) => toGeo(f, p));
    const g = createGarden(cw);
    expect(signedArea(localBoundary(g))).toBeGreaterThan(0);
    expect(g.timezone).toBe('Europe/Warsaw');
    expect(g.stats.areaM2).toBeCloseTo(100, 1);
    expect(() => createGarden(cw.slice(0, 2))).toThrow();
  });

  it('demo garden is labelled and has only sample context', () => {
    const d = createDemoGarden();
    expect(d.isDemo).toBe(true);
    expect(d.name).toMatch(/sample/i);
    expect(d.context.status).toBe('sample');
    expect(d.context.buildings.every((b) => b.heightSource === 'sample')).toBe(true);
    expect(d.stats.areaM2).toBeCloseTo(23 * 13 + 14 * 7, 0);
  });

  it('editing the outline keeps origin, objects and sun settings', () => {
    const d = createDemoGarden();
    const f = createLocalFrame(d.origin);
    const bigger = [
      { e: -15, n: -12 },
      { e: 15, n: -12 },
      { e: 15, n: 14 },
      { e: -15, n: 14 },
    ].map((p) => toGeo(f, p));
    const e = withBoundary(d, bigger);
    expect(e.origin).toEqual(d.origin);
    expect(e.objects).toEqual(d.objects);
    expect(e.sun).toEqual(d.sun);
    expect(e.stats.areaM2).toBeCloseTo(30 * 26, 0);
  });
});

describe('local persistence', () => {
  it('saves and restores gardens with objects intact', async () => {
    const kv = memoryStore();
    const repo = new GardenRepository(kv);
    const d = createDemoGarden();
    d.objects.push({ ...newObject('tree', { e: 1, n: 2 }), height: 9.5, heightSource: 'manual' });
    await repo.save(d);
    // Simulate an app restart with a fresh repository over the same storage
    const reloaded = await new GardenRepository(kv).get(d.id);
    expect(reloaded).toEqual(d);
    expect((await repo.list()).length).toBe(1);
    await repo.save({ ...d, name: 'Renamed' });
    expect((await repo.list()).length).toBe(1);
    expect((await repo.get(d.id))?.name).toBe('Renamed');
    await repo.remove(d.id);
    expect(await repo.list()).toEqual([]);
  });

  it('ignores corrupt or future-schema records instead of crashing', async () => {
    const kv = memoryStore();
    const repo = new GardenRepository(kv);
    await kv.setItem('gardena:index:v1', JSON.stringify(['a', 'b']));
    await kv.setItem('gardena:garden:v1:a', '{not json');
    await kv.setItem('gardena:garden:v1:b', JSON.stringify({ schema: 99, garden: {} }));
    expect(await repo.list()).toEqual([]);
  });
});
