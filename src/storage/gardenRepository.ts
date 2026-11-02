import type { Garden } from '../geo/types';

/** Minimal key-value contract (AsyncStorage implements it; tests use a Map). */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const INDEX_KEY = 'gardena:index:v1';
const gardenKey = (id: string) => `gardena:garden:v1:${id}`;
export const SCHEMA_VERSION = 1;

interface StoredGarden {
  schema: number;
  garden: Garden;
}

/** Local-only persistence. One key per garden keeps writes small during frequent edits. */
export class GardenRepository {
  constructor(private kv: KeyValueStore) {}

  async listIds(): Promise<string[]> {
    const raw = await this.kv.getItem(INDEX_KEY);
    if (!raw) return [];
    try {
      const ids = JSON.parse(raw);
      return Array.isArray(ids) ? ids.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }

  async list(): Promise<Garden[]> {
    const ids = await this.listIds();
    const out: Garden[] = [];
    for (const id of ids) {
      const g = await this.get(id);
      if (g) out.push(g);
    }
    return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string): Promise<Garden | null> {
    const raw = await this.kv.getItem(gardenKey(id));
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as StoredGarden;
      if (parsed?.schema !== SCHEMA_VERSION || !parsed.garden?.boundary) return null;
      return parsed.garden;
    } catch {
      return null;
    }
  }

  async save(garden: Garden): Promise<void> {
    const payload: StoredGarden = { schema: SCHEMA_VERSION, garden };
    await this.kv.setItem(gardenKey(garden.id), JSON.stringify(payload));
    const ids = await this.listIds();
    if (!ids.includes(garden.id)) {
      ids.push(garden.id);
      await this.kv.setItem(INDEX_KEY, JSON.stringify(ids));
    }
  }

  async remove(id: string): Promise<void> {
    await this.kv.removeItem(gardenKey(id));
    const ids = (await this.listIds()).filter((x) => x !== id);
    await this.kv.setItem(INDEX_KEY, JSON.stringify(ids));
  }
}

export function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    async getItem(k) {
      return data.has(k) ? data.get(k)! : null;
    },
    async setItem(k, v) {
      data.set(k, v);
    },
    async removeItem(k) {
      data.delete(k);
    },
  };
}
