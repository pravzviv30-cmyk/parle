/** In-memory JournalStore for tests. Mirrors d1.ts semantics: rowid order for high water, name order for listing. */
import { SNAPSHOT_TTL_MS, sha256Names, type JournalStore, type Page, type Snapshot } from './store.ts';

export function memoryStore(now: () => number = Date.now): JournalStore & { rows: Array<{ name: string; body: string }>; sealsComputed: number } {
  const rows: Array<{ name: string; body: string }> = [];
  const snapshots = new Map<string, Snapshot>();
  return {
    rows,
    sealsComputed: 0,
    async insertOnce(name, body) {
      if (rows.some(r => r.name === name)) return 'exists';
      rows.push({ name, body }); return 'inserted';
    },
    async get(name) { return rows.find(r => r.name === name)?.body ?? null; },
    async seal(): Promise<Snapshot> {
      const highWater = rows.length;
      const reuse = [...snapshots.values()].filter(s => s.highWater === highWater && Date.parse(s.expiresAt) > now()).sort((a, b) => b.expiresAt.localeCompare(a.expiresAt))[0];
      if (reuse) return reuse;
      this.sealsComputed++;
      const names = rows.slice(0, highWater).map(r => r.name).sort();
      const snapshotId = crypto.randomUUID();
      const expiresAt = new Date(now() + SNAPSHOT_TTL_MS).toISOString();
      const snapshot = { snapshotId, highWater, totalRecords: names.length, keysSha256: await sha256Names(names), expiresAt };
      snapshots.set(snapshotId, snapshot);
      return snapshot;
    },
    async page(snapshotId, after, limit): Promise<Page | null | 'expired'> {
      const snapshot = snapshots.get(snapshotId);
      if (!snapshot) return null;
      if (Date.parse(snapshot.expiresAt) <= now()) return 'expired';
      const names = rows.slice(0, snapshot.highWater).map(r => r.name).filter(n => n > after).sort();
      const keys = names.slice(0, limit);
      return { keys, nextCursor: names.length > limit ? keys.at(-1)! : null };
    },
  };
}
