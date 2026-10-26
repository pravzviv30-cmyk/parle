/** Storage contract for the deletion journal Worker. Implementations never overwrite or delete a record. */
export interface Snapshot { snapshotId: string; highWater: number; totalRecords: number; keysSha256: string; expiresAt: string }
export interface Page { keys: string[]; nextCursor: string | null }
export interface JournalStore {
  /** Append once. 'exists' when the name is already present; the stored body is never replaced. */
  insertOnce(name: string, body: string): Promise<'inserted' | 'exists'>;
  get(name: string): Promise<string | null>;
  /** Freeze the current high-water mark and hash the raw 32-byte names at or below it in ascending order. */
  seal(): Promise<Snapshot>;
  /** Names in the snapshot strictly greater than `after`, ascending. null when the snapshot is unknown; 'expired' when past expiry. */
  page(snapshotId: string, after: string, limit: number): Promise<Page | null | 'expired'>;
}
/** 24 h: long enough for a full replay; the client re-checks expiry before and after listing. */
export const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;

const NIBBLE = new Int8Array(128).fill(-1);
for (let i = 0; i < 10; i++) NIBBLE[48 + i] = i;
for (let i = 0; i < 6; i++) NIBBLE[97 + i] = 10 + i;
/** SHA-256 of the raw 32-byte names, already in ascending order, concatenated. One buffer, one digest. */
export async function sha256Names(names: readonly string[]): Promise<string> {
  const raw = new Uint8Array(names.length * 32);
  let at = 0;
  for (const name of names) {
    if (name.length !== 64) throw new Error('invalid-name');
    for (let c = 0; c < 64; c += 2) {
      const hi = NIBBLE[name.charCodeAt(c)] ?? -1, lo = NIBBLE[name.charCodeAt(c + 1)] ?? -1;
      if ((hi | lo) < 0) throw new Error('invalid-name');
      raw[at++] = (hi << 4) | lo;
    }
  }
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', raw)));
}
export function hex(bytes: Uint8Array): string { return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(''); }
