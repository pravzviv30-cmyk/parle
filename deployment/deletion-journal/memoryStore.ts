/** In-memory JournalStore for tests. Mirrors d1.ts semantics: a sequence that never goes down for high water (AUTOINCREMENT), name order for listing. */
import { JOURNAL_KEEP_DAYS, SNAPSHOT_TTL_MS, sha256Names, type JournalStore, type Page, type Snapshot } from './store.ts';

type Row = { seq: number; name: string; body: string; completedAt: number | null };
export function memoryStore(now: () => number = Date.now): JournalStore & { rows: Row[]; sealsComputed: number } {
  const rows: Row[] = [];
  const snapshots = new Map<string, Snapshot>();
  let sequence = 0;
  const upTo = (highWater: number) => rows.filter(r => r.seq <= highWater).map(r => r.name).sort();
  return {
    rows,
    sealsComputed: 0,
    async insertOnce(name, body) {
      if (rows.some(r => r.name === name)) return 'exists';
      rows.push({ seq: ++sequence, name, body, completedAt: null }); return 'inserted';
    },
    async get(name) { return rows.find(r => r.name === name)?.body ?? null; },
    async complete(name) {
      const row = rows.find(r => r.name === name);
      if (!row) return 'missing';
      row.completedAt = now(); return 'completed';
    },
    async removeDue() {
      if ([...snapshots.values()].some(s => Date.parse(s.expiresAt) > now())) return 0;
      const cutoff = now() - JOURNAL_KEEP_DAYS * 24 * 60 * 60 * 1000;
      const before = rows.length;
      for (let i = rows.length - 1; i >= 0; i--) if (rows[i]!.completedAt !== null && rows[i]!.completedAt! <= cutoff) rows.splice(i, 1);
      return before - rows.length;
    },
    async seal(): Promise<Snapshot> {
      const highWater = rows.at(-1)?.seq ?? 0;
      const total = upTo(highWater).length;
      const reuse = [...snapshots.values()].filter(s => s.highWater === highWater && s.totalRecords === total && Date.parse(s.expiresAt) > now()).sort((a, b) => b.expiresAt.localeCompare(a.expiresAt))[0];
      if (reuse) return reuse;
      this.sealsComputed++;
      const names = upTo(highWater);
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
      const names = upTo(snapshot.highWater).filter(n => n > after);
      const keys = names.slice(0, limit);
      return { keys, nextCursor: names.length > limit ? keys.at(-1)! : null };
    },
  };
}
