import { createLocalFrame, toGeo, toLocal } from '../geometry/projection';
import { createGarden, localFrameOf, newObject } from './garden';
import type { ContextBuilding, Garden, LngLat, LocalPoint } from './types';

/** A sample suburban plot near Kraków. Outline and buildings are invented for demonstration. */
const DEMO_ORIGIN: LngLat = [19.9002, 50.0868];
const DEMO_OUTLINE_LOCAL: LocalPoint[] = [
  { e: -11, n: -9 },
  { e: 12, n: -9 },
  { e: 12, n: 4 },
  { e: 3, n: 4 },
  { e: 3, n: 11 },
  { e: -11, n: 11 },
];

function demoBuilding(id: string, cx: number, cn: number, w: number, d: number, h: number): ContextBuilding {
  const f = createLocalFrame(DEMO_ORIGIN);
  const pts: LocalPoint[] = [
    { e: cx - w / 2, n: cn - d / 2 },
    { e: cx + w / 2, n: cn - d / 2 },
    { e: cx + w / 2, n: cn + d / 2 },
    { e: cx - w / 2, n: cn + d / 2 },
  ];
  return { id, footprint: pts.map((p) => toGeo(f, p)), height: h, heightSource: 'sample', sourceRef: 'sample' };
}

export function createDemoGarden(nowMs?: number): Garden {
  const f = createLocalFrame(DEMO_ORIGIN);
  const g = createGarden(
    DEMO_OUTLINE_LOCAL.map((p) => toGeo(f, p)),
    { name: 'Demo garden (sample data)', isDemo: true, imagery: { providerId: 'none', attribution: 'No imagery — demo' }, nowMs },
  );
  const lf = localFrameOf(g);
  const shift = (p: LocalPoint) => toLocal(lf, toGeo(f, p));
  const bed1 = shift({ e: -6, n: -4 });
  const bed2 = shift({ e: -6, n: 0 });
  const tree = shift({ e: 8, n: -5 });
  const shed = shift({ e: -7.5, n: 8 });
  return {
    ...g,
    objects: [
      { ...newObject('bed', bed1), label: 'Vegetable bed' },
      { ...newObject('bed', bed2), label: 'Herb bed', width: 1.8 },
      { ...newObject('tree', tree), label: 'Apple tree', height: 4.5, canopyRadius: 2 },
      { ...newObject('building', shed), label: 'Garden shed', width: 3, depth: 2.4, height: 2.4 },
    ],
    context: {
      status: 'sample',
      source: 'Sample data',
      attribution: 'Invented sample buildings — not real geographic data',
      buildings: [
        demoBuilding('sample-house', 0, -17, 11, 9, 8.5),
        demoBuilding('sample-neighbour', 22, 2, 9, 12, 7),
        demoBuilding('sample-block', -24, 6, 10, 26, 12),
      ],
      message: 'Sample buildings are invented to demonstrate shadows. They are not real.',
      radiusM: 80,
    },
  };
}
