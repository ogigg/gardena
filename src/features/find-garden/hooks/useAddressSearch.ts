import { useMemo, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { availableGeocoders, searchAddress, type GeocodeResult } from '../../../services/geocoding';
import { config } from '../../../shared/config/env';

export type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'results'; results: GeocodeResult[]; attribution?: string }
  | { status: 'empty'; errors: string[] }
  | { status: 'error'; message: string };

/** Address search with loading / empty / error states; aborts a previous search when a new one starts. */
export function useAddressSearch() {
  const geocoders = useMemo(() => availableGeocoders(config), []);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<SearchState>({ status: 'idle' });
  const abort = useRef<AbortController | null>(null);

  const run = async () => {
    const q = query.trim();
    if (!q) return;
    Keyboard.dismiss();
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setSearch({ status: 'loading' });
    try {
      const r = await searchAddress(geocoders, q, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (r.results.length === 0) setSearch({ status: 'empty', errors: r.errors });
      else setSearch({ status: 'results', results: r.results, attribution: r.usedGeocoder?.attribution });
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      setSearch({ status: 'error', message: (e as Error).message });
    }
  };

  return {
    query,
    setQuery,
    search,
    run,
    clear: () => setSearch({ status: 'idle' }),
    showError: (message: string) => setSearch({ status: 'error', message }),
  };
}
