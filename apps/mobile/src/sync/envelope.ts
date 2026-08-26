/**
 * What a namespace looks like on the wire, and how it is read back safely.
 *
 * One shape for every synced store: `{ v, deviceId, savedAt, data }`, where `data` is
 * the store's own blob copied verbatim, carrying its own schema version inside it. That
 * is the rule `migrateLegacyStores` already follows — the payload version belongs to the
 * payload — and it is what lets a store change its own format without this file, the
 * engine or the server knowing anything about it.
 *
 * `revision` deliberately does **not** live in here. It is a column on `learner_state`,
 * written only by the database trigger, so there is exactly one ordering truth and no
 * way for a device to disagree with the server about which write came first. `savedAt`
 * is a tiebreak for merges, never an order.
 *
 * Everything here takes `unknown` and proves its way to a type. A blob read off the
 * network is not trusted input: it may have been written by a newer app, an older app, a
 * half-finished write, or an operator with a service-role key and a bad afternoon. So a
 * payload this file rejects is *quarantined* — reported, left where it is, and never
 * merged. The device's own data is never overwritten by something that failed to parse.
 *
 * No react-native import belongs in this directory. The sync engine has to run under
 * plain `node --test`, and it stays that way by taking storage, fetch, clock and randomness
 * from whoever starts it.
 */

/** The envelope format itself. Bumped only if the four outer fields change. */
export const ENVELOPE_VERSION = 1;

/**
 * The largest envelope this engine will send, JSON bytes, before compression.
 *
 * Every store already caps itself (fifty sessions, four hundred days, a bounded deck),
 * so a payload near this size means a cap has failed somewhere rather than that a
 * learner has been unusually diligent. The engine refuses it, says so, and parks that
 * one namespace. It never truncates: half a learner's deck pushed as if it were all of
 * it would converge every other device down to the same half.
 */
export const MAX_ENVELOPE_BYTES = 128 * 1024;

export interface SyncEnvelope<T = unknown> {
  readonly v: number;
  readonly deviceId: string;
  readonly savedAt: number;
  readonly data: T;
}

/** Why a payload could not be read. A closed set, so a diagnostic can carry it safely. */
export type EnvelopeRejection =
  | 'not-an-object'
  | 'unknown-envelope-version'
  | 'no-device-id'
  | 'no-saved-at'
  | 'no-data'
  | 'not-serialisable';

export type EnvelopeReading =
  | { readonly ok: true; readonly envelope: SyncEnvelope }
  | { readonly ok: false; readonly reason: EnvelopeRejection };

/** Wrap a store blob for the wire. `savedAt` is the caller's clock, injected. */
export function sealEnvelope(data: unknown, deviceId: string, savedAt: number): SyncEnvelope {
  return { v: ENVELOPE_VERSION, deviceId, savedAt, data };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Read a payload that came back from the server.
 *
 * Deliberately strict about the four outer fields and deliberately incurious about
 * `data`: the only thing this layer knows about a store's blob is that it exists and
 * survives a JSON round trip. Judging its contents is the merge policy's job, and a
 * check here would be a second opinion about a format this file does not own.
 */
export function readEnvelope(value: unknown): EnvelopeReading {
  if (!isRecord(value)) return { ok: false, reason: 'not-an-object' };
  if (value.v !== ENVELOPE_VERSION) return { ok: false, reason: 'unknown-envelope-version' };
  if (typeof value.deviceId !== 'string' || value.deviceId.length === 0) {
    return { ok: false, reason: 'no-device-id' };
  }
  if (typeof value.savedAt !== 'number' || !Number.isFinite(value.savedAt)) {
    return { ok: false, reason: 'no-saved-at' };
  }
  if (!('data' in value) || value.data === undefined) return { ok: false, reason: 'no-data' };
  if (serialise(value.data) === null) return { ok: false, reason: 'not-serialisable' };
  return {
    ok: true,
    envelope: { v: ENVELOPE_VERSION, deviceId: value.deviceId, savedAt: value.savedAt, data: value.data },
  };
}

/** `JSON.stringify`, or null when the value cannot survive the trip (cycles, BigInt). */
export function serialise(value: unknown): string | null {
  try {
    const text = JSON.stringify(value);
    return typeof text === 'string' ? text : null;
  } catch {
    return null;
  }
}

/** `JSON.parse`, or null. Used on both the disk blob and the network body. */
export function parseJson(text: string | null): unknown {
  if (text === null || text.length === 0) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/**
 * UTF-8 byte length, counted rather than measured with a Buffer or a TextEncoder.
 *
 * The size ceiling is a promise about what crosses the network, and `String.length`
 * counts UTF-16 units — which would under-count every accented French character in a
 * learner's phrases by a byte apiece, on exactly the payloads most likely to be near a
 * cap. This is a dozen lines and it is exact on both Node and Hermes.
 */
export function utf8Bytes(text: string): number {
  let bytes = 0;
  for (let at = 0; at < text.length; at += 1) {
    const code = text.charCodeAt(at);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && at + 1 < text.length) {
      const low = text.charCodeAt(at + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        // One astral code point, four bytes, two UTF-16 units.
        bytes += 4;
        at += 1;
        continue;
      }
      bytes += 3;
    } else bytes += 3;
  }
  return bytes;
}

/** The size of an envelope as the network will see it, or null if it cannot be sent. */
export function envelopeBytes(envelope: SyncEnvelope): number | null {
  const text = serialise(envelope);
  return text === null ? null : utf8Bytes(text);
}

/**
 * The schema version the store wrote inside its own blob, when it says one.
 *
 * The cross-cutting rule that needs this: a device must never push over a payload whose
 * inner version is newer than the version this build writes. An older app that merged a
 * newer app's blob would quietly delete every field it did not recognise, on every
 * device, permanently. Not every store versions itself — the review deck is a bare array
 * — so `null` means "no opinion" and the caller treats it as compatible.
 */
export function innerVersion(data: unknown): number | null {
  if (!isRecord(data)) return null;
  const version = data.version;
  return typeof version === 'number' && Number.isFinite(version) ? version : null;
}

/**
 * JSON with object keys in a fixed order, so two structurally equal blobs compare equal.
 *
 * The engine asks "did the merge change anything?" twice per namespace — once against
 * the device's copy to decide whether to adopt, once against the server's to decide
 * whether to push. A merge that rebuilt an object with its keys in a different order
 * would answer yes to both, and every idle launch would write to disk and to the network
 * for nothing, advancing the revision each time.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
  return `{${entries.join(',')}}`;
}

/** Structural equality for store blobs, key order and `undefined` fields ignored. */
export function sameData(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}
