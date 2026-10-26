/** D1 JournalStore. Prepared statements only. Append-only is enforced again by triggers in schema.sql. */
import { SNAPSHOT_TTL_MS, sha256Names, type JournalStore, type Page, type Snapshot } from './store.ts';

/** The slice of the D1 binding this store uses (structurally compatible with @cloudflare/workers-types). */
export interface D1Like {
  prepare(sql: string): { bind(...values: unknown[]): D1Bound };
}
interface D1Bound {
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes?: number } }>;
}

export function d1Store(db: D1Like, now: () => number = Date.now): JournalStore {
  return {
    async insertOnce(name, body) {
      const result = await db.prepare('INSERT INTO records (name, body) VALUES (?1, ?2) ON CONFLICT(name) DO NOTHING').bind(name, body).run();
      return result.meta.changes === 1 ? 'inserted' : 'exists';
    },
    async get(name) {
      const row = await db.prepare('SELECT body FROM records WHERE name = ?1').bind(name).first<{ body: string }>();
      return row?.body ?? null;
    },
    async seal(): Promise<Snapshot> {
      const top = await db.prepare('SELECT COALESCE(MAX(rowid), 0) AS hw FROM records').bind().first<{ hw: number }>();
      const highWater = top?.hw ?? 0;
      const nowIso = new Date(now()).toISOString();
      const reuse = await db.prepare('SELECT id, total, keys_sha256, expires_at FROM snapshots WHERE high_water = ?1 AND expires_at > ?2 ORDER BY expires_at DESC LIMIT 1')
        .bind(highWater, nowIso).first<{ id: string; total: number; keys_sha256: string; expires_at: string }>();
      if (reuse) return { snapshotId: reuse.id, highWater, totalRecords: reuse.total, keysSha256: reuse.keys_sha256, expiresAt: reuse.expires_at };
      // Read once per new high water, already sorted by SQL; hashed in one pass.
      const { results } = await db.prepare('SELECT name FROM records WHERE rowid <= ?1 ORDER BY name').bind(highWater).all<{ name: string }>();
      const names = results.map(r => r.name);
      const snapshotId = crypto.randomUUID();
      const expiresAt = new Date(now() + SNAPSHOT_TTL_MS).toISOString();
      const keysSha256 = await sha256Names(names);
      await db.prepare('INSERT INTO snapshots (id, high_water, total, keys_sha256, expires_at) VALUES (?1, ?2, ?3, ?4, ?5)')
        .bind(snapshotId, highWater, names.length, keysSha256, expiresAt).run();
      return { snapshotId, highWater, totalRecords: names.length, keysSha256, expiresAt };
    },
    async page(snapshotId, after, limit): Promise<Page | null | 'expired'> {
      const snapshot = await db.prepare('SELECT high_water, expires_at FROM snapshots WHERE id = ?1').bind(snapshotId).first<{ high_water: number; expires_at: string }>();
      if (!snapshot) return null;
      if (Date.parse(snapshot.expires_at) <= now()) return 'expired';
      const { results } = await db.prepare('SELECT name FROM records WHERE rowid <= ?1 AND name > ?2 ORDER BY name LIMIT ?3')
        .bind(snapshot.high_water, after, limit + 1).all<{ name: string }>();
      const keys = results.slice(0, limit).map(r => r.name);
      return { keys, nextCursor: results.length > limit ? keys.at(-1)! : null };
    },
  };
}
