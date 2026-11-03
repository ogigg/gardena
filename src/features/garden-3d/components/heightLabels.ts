import type { HeightSource } from '../../../domain/garden/types';

/** How each height source is described to the user, so defaults never look measured. */
export const HEIGHT_LABEL: Record<HeightSource, string> = {
  manual: 'set by you',
  default: 'app default — adjust to match reality',
  tagged: 'from OpenStreetMap height tag',
  levels: 'estimated from storey count (3 m per storey)',
  assumed: 'ASSUMED — no height data available',
  sample: 'sample data — not real',
};
