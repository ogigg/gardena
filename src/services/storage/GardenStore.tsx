import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Garden } from '../../domain/garden/types';
import { GardenRepository, memoryStore, type KeyValueStore } from './gardenRepository';

interface StoreValue {
  ready: boolean;
  gardens: Garden[];
  /** Persistence problem shown to the user (we keep working in memory). */
  storageError?: string;
  get(id: string): Garden | undefined;
  /** Updates in memory immediately; writes to disk debounced. */
  upsert(g: Garden, opts?: { immediate?: boolean }): void;
  remove(id: string): Promise<void>;
}

const Ctx = createContext<StoreValue | null>(null);

function makeKv(): KeyValueStore {
  try {
    if (AsyncStorage && typeof AsyncStorage.getItem === 'function') return AsyncStorage as unknown as KeyValueStore;
  } catch {
    // fall through
  }
  return memoryStore();
}

export function GardenStoreProvider({ children, kv }: { children: React.ReactNode; kv?: KeyValueStore }) {
  const repo = useMemo(() => new GardenRepository(kv ?? makeKv()), [kv]);
  const [gardens, setGardens] = useState<Garden[]>([]);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string>();
  const pending = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    repo
      .list()
      .then((list) => setGardens(list))
      .catch(() => setStorageError('Saved gardens could not be read on this device.'))
      .finally(() => setReady(true));
  }, [repo]);

  const write = useCallback(
    (g: Garden) =>
      repo.save(g).then(
        () => setStorageError(undefined),
        () => setStorageError('Could not save changes on this device. They are kept until the app closes.'),
      ),
    [repo],
  );

  const upsert = useCallback(
    (g: Garden, opts?: { immediate?: boolean }) => {
      setGardens((prev) => {
        const i = prev.findIndex((x) => x.id === g.id);
        if (i < 0) return [g, ...prev];
        const next = prev.slice();
        next[i] = g;
        return next;
      });
      const t = pending.current.get(g.id);
      if (t) clearTimeout(t);
      if (opts?.immediate) {
        pending.current.delete(g.id);
        void write(g);
      } else {
        pending.current.set(
          g.id,
          setTimeout(() => {
            pending.current.delete(g.id);
            void write(g);
          }, 400),
        );
      }
    },
    [write],
  );

  const remove = useCallback(
    async (id: string) => {
      const t = pending.current.get(id);
      if (t) clearTimeout(t);
      pending.current.delete(id);
      setGardens((prev) => prev.filter((x) => x.id !== id));
      await repo.remove(id).catch(() => setStorageError('Could not delete the garden on this device.'));
    },
    [repo],
  );

  const value = useMemo<StoreValue>(
    () => ({ ready, gardens, storageError, get: (id) => gardens.find((g) => g.id === id), upsert, remove }),
    [ready, gardens, storageError, upsert, remove],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGardens(): StoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useGardens outside GardenStoreProvider');
  return v;
}
