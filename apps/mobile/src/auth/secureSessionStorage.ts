/**
 * Encrypted native persistence for Supabase's session blob.
 *
 * SecureStore values are deliberately chunked. A Supabase session can exceed
 * the historical per-item limits of iOS keychain-backed storage, and a failed
 * write must not destroy the last usable session. Two generations let the
 * metadata pointer move only after every new chunk is durable.
 */

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

interface StoredMeta {
  version: 1;
  generation: 'a' | 'b';
  chunks: number;
}

const CHUNK_SIZE = 1_800;
const META_SUFFIX = '.luvani-secure-meta';

function metaKey(key: string): string {
  return `${key}${META_SUFFIX}`;
}

function chunkKey(key: string, generation: StoredMeta['generation'], index: number): string {
  return `${key}.luvani-secure-${generation}-${index}`;
}

function parseMeta(raw: string | null): StoredMeta | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const candidate = value as Partial<StoredMeta>;
    if (candidate.version !== 1) return null;
    if (candidate.generation !== 'a' && candidate.generation !== 'b') return null;
    if (!Number.isInteger(candidate.chunks) || (candidate.chunks ?? 0) < 1 || (candidate.chunks ?? 0) > 64) {
      return null;
    }
    return candidate as StoredMeta;
  } catch {
    return null;
  }
}

async function readSecure(secure: KeyValueStorage, key: string): Promise<string | null> {
  const meta = parseMeta(await secure.getItem(metaKey(key)));
  if (meta === null) return null;

  const chunks = await Promise.all(
    Array.from({ length: meta.chunks }, (_, index) => secure.getItem(chunkKey(key, meta.generation, index))),
  );
  if (chunks.some((chunk) => chunk === null)) return null;
  return chunks.join('');
}

async function removeGeneration(secure: KeyValueStorage, key: string, meta: StoredMeta | null): Promise<void> {
  if (meta === null) return;
  await Promise.all(
    Array.from({ length: meta.chunks }, (_, index) => secure.removeItem(chunkKey(key, meta.generation, index))),
  );
}

async function removeAllGenerations(secure: KeyValueStorage, key: string): Promise<void> {
  await Promise.all(
    (['a', 'b'] as const).flatMap((generation) =>
      Array.from({ length: 64 }, (_, index) => secure.removeItem(chunkKey(key, generation, index))),
    ),
  );
}

async function writeSecure(secure: KeyValueStorage, key: string, value: string): Promise<void> {
  const previous = parseMeta(await secure.getItem(metaKey(key)));
  const generation: StoredMeta['generation'] = previous?.generation === 'a' ? 'b' : 'a';
  const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, 'gs')) ?? [''];

  await Promise.all(chunks.map((chunk, index) => secure.setItem(chunkKey(key, generation, index), chunk)));
  await secure.setItem(metaKey(key), JSON.stringify({ version: 1, generation, chunks: chunks.length } satisfies StoredMeta));

  // The metadata already points at the complete new generation. Cleanup can
  // fail without making the session unreadable; the next write will try again.
  try {
    await removeGeneration(secure, key, previous);
  } catch {
    // Best-effort orphan cleanup only.
  }
}

/**
 * Supabase-compatible storage.
 *
 * A legacy AsyncStorage value is copied, read back through SecureStore's
 * committed metadata, and only then removed. If encrypted storage is
 * unavailable the plaintext bearer is removed and the learner signs in again.
 */
export function createSecureSessionStorage(secure: KeyValueStorage, legacy: KeyValueStorage): KeyValueStorage {
  return {
    async getItem(key) {
      try {
        const encrypted = await readSecure(secure, key);
        if (encrypted !== null) return encrypted;
      } catch {
        // Fall through to the migration source. Never erase the only session.
      }

      const oldValue = await legacy.getItem(key);
      if (oldValue === null) return null;
      try {
        await writeSecure(secure, key, oldValue);
        if ((await readSecure(secure, key)) === oldValue) {
          await legacy.removeItem(key);
          return oldValue;
        }
      } catch {
        // A bearer token must not remain an indefinitely readable plaintext
        // fallback. If encrypted persistence is unavailable, remove the old
        // copy and require a fresh sign-in when secure storage recovers.
      }
      await legacy.removeItem(key);
      return null;
    },

    async setItem(key, value) {
      await writeSecure(secure, key, value);
      // Supabase can write before it has ever read the legacy session. Remove
      // the obsolete plaintext copy only after the encrypted commit succeeds.
      await legacy.removeItem(key);
    },

    async removeItem(key) {
      try {
        // Remove the pointer first so a partial cleanup cannot resurrect a
        // signed-out or deleted account.
        await secure.removeItem(metaKey(key));
        await removeAllGenerations(secure, key);
      } finally {
        await legacy.removeItem(key);
      }
    },
  };
}
