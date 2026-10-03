/** Public locators only. Vendor identities, prices and credentials stay server-side. */
export interface PhraseAudioSource { packId: string; kind: 'phrase' | 'correction'; index: number }
export function readPhraseAudioSource(raw: unknown): PhraseAudioSource | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (Object.keys(value).length !== 3 || typeof value.packId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.packId) ||
    (value.kind !== 'phrase' && value.kind !== 'correction') || !Number.isInteger(value.index) ||
    (value.index as number) < 0 || (value.index as number) > 63) return null;
  return { packId: value.packId.toLowerCase(), kind: value.kind, index: value.index as number };
}

/** Keep exact accents, case and punctuation; search/phrase keys are too broad. */
export function phraseAudioFrench(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.normalize('NFC').trim();
  return value.length > 0 && value.length <= 400 && !/[\u0000-\u001f\u007f]/.test(value) ? value : null;
}
