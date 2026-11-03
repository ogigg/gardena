import type { LngLat } from '../../domain/garden/types';

/**
 * Address search. Results are only used to move the camera; they are not
 * persisted (the garden record stores the user-drawn outline instead).
 */
export interface GeocodeResult {
  label: string;
  center: LngLat;
  bbox?: [number, number, number, number];
  source: string;
}

export class GeocodeError extends Error {
  constructor(
    message: string,
    public kind: 'network' | 'no-provider' | 'bad-response',
  ) {
    super(message);
  }
}

export interface Geocoder {
  id: string;
  name: string;
  attribution: string;
  search(query: string, signal?: AbortSignal): Promise<GeocodeResult[]>;
}

export type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal; headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export async function getJson(fetchImpl: FetchLike, url: string, signal?: AbortSignal): Promise<unknown> {
  let res;
  try {
    res = await fetchImpl(url, { signal, headers: { Accept: 'application/json' } });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    throw new GeocodeError('Could not reach the search service. Check your connection.', 'network');
  }
  if (!res.ok) throw new GeocodeError(`Search service answered ${res.status}.`, 'bad-response');
  try {
    return await res.json();
  } catch {
    throw new GeocodeError('Search service returned an unreadable answer.', 'bad-response');
  }
}
