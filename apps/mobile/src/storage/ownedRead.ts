/** Only a missing account key means no saved work. Unreadable bytes are unknown. */
export function readOwnedCache<T>(raw: string | null, accepts: (value: unknown) => value is T): T | null {
  if (raw === null) return null;
  const parsed: unknown = JSON.parse(raw);
  if (!accepts(parsed)) throw new Error('Saved material could not be read');
  return parsed;
}
