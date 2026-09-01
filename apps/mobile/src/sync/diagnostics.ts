/**
 * What sync is doing, in a form that cannot embarrass the learner doing it.
 *
 * Sync is the subsystem most likely to make someone reach for "just log the blob". A
 * push failed, the merge looks wrong, and the fastest way to see why is to print what
 * was being pushed — which, in this app, is a beginner's French attempts, the phrases
 * they keep getting wrong, and their pronunciation scores. That never leaves the
 * device for observability, so the way to stop it is not a rule in a document. It is a
 * record type with nowhere to put it.
 *
 * ## The shape of the promise
 *
 * Three walls, and the third is the one that actually holds:
 *
 * 1. **No free-text field in the type.** namespace, phase, status, code — all four are
 *    `SyncToken`, a branded string you cannot make by writing a string literal. The
 *    only way to get one is `token()` below. attempt, rev, bytes and ms are numbers.
 *    There is no `detail`, no `message`, no `data`, and adding one is a visible edit to
 *    this file that `diagnostics.test.ts` fails on.
 * 2. **Rebuilt, not referenced.** `record` never keeps the object it was handed. It
 *    copies the eight fields it knows into a fresh record, so a caller who passes a fat
 *    event with a transcript hanging off it puts nothing in the buffer but the eight.
 * 3. **Normalised on the way in.** Every string is clamped to a short closed charset.
 *    A phrase, a name, an email address and a JSON fragment all contain characters the
 *    charset refuses, so each one becomes `?` rather than being trimmed into something
 *    still readable. `namespace` is the field that matters here: it originates in the
 *    persisted dirty-set, which is the one input to this module that has been on disk.
 *
 * ## The seam
 *
 * `log` and `alarm` are injected and default to the console. There is no error-tracking
 * or analytics SDK in this repo and this file does not add one; if one ever arrives, it
 * arrives here, as those two functions, and everything already routes through them.
 * What such a backend would be allowed to see is exactly what is in `SyncDiagnostic`:
 * classes, counts, timings and an opaque namespace. Nothing else exists to send.
 *
 * ## The house style
 *
 * One greppable line per event, in the shape services/tutor-agent already uses:
 *
 *   [luvani:sync] ns=profile phase=push status=pushed attempt=1 rev=7 bytes=2048 ms=412
 *   [luvani] SYNC_NOT_CONVERGED ns=profile phase=push status=refused code=over-size-cap ...
 *
 * `SYNC_NOT_CONVERGED` is an interface, the same way `USAGE_NOT_DEBITED` is: somebody
 * greps for it at two in the morning, so it does not get renamed. It means this device's
 * data is not reaching the account and retrying alone will not fix it.
 *
 * No react-native import, so this runs under plain node tests with the rest of sync/.
 */

import type { SyncEvent } from './engine.ts';

// ─────────────────────────────────────────────────────────────── the token type

declare const SYNC_TOKEN: unique symbol;

/**
 * A short word from a closed charset. The only kind of string this module stores.
 *
 * Branded so that a `SyncDiagnostic` cannot be assembled out of raw strings anywhere
 * else in the app: the brand is unforgeable outside this file, and `token()` is the
 * only thing that mints it. Reading one is unaffected — it is still a string.
 */
export type SyncToken = string & { readonly [SYNC_TOKEN]: 'sync' };

/** Letters, digits, dot, dash, underscore. No space, no accent, no quote, no `@`. */
const TOKEN_SHAPE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/;

/** Everything a value becomes when it is not token-shaped. Never a partial scrub. */
export const UNKNOWN_TOKEN = '?' as SyncToken;

/**
 * Normalise anything into a token.
 *
 * All-or-nothing on purpose. Stripping the offending characters out of
 * `je ne comprends pas` would leave `jenecomprendspas`, which is the learner's
 * sentence with the spaces removed — still their words, still in a log. A value that
 * is not already a short bare word is replaced whole.
 */
export function token(value: unknown): SyncToken {
  if (typeof value !== 'string') return UNKNOWN_TOKEN;
  return TOKEN_SHAPE.test(value) ? (value as SyncToken) : UNKNOWN_TOKEN;
}

/** Same, but a genuinely absent value stays absent instead of printing as `?`. */
function optionalToken(value: unknown): SyncToken | null {
  if (value === null || value === undefined) return null;
  return token(value);
}

const counter = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;

const optionalCounter = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : null;

// ──────────────────────────────────────────────────────────────── the record

/**
 * One thing that happened to one namespace.
 *
 * Read the field list as the whole permission grant. Adding a ninth field is adding a
 * new thing sync is allowed to say about a learner, and it belongs in review, not in a
 * hurry during an outage.
 */
export interface SyncDiagnostic {
  /** Which store, e.g. `profile`. A store suffix, never an identifier of a person. */
  readonly namespace: SyncToken;
  /** `pull` | `merge` | `adopt` | `push` | `cycle`, as the engine names them. */
  readonly phase: SyncToken;
  /** How that phase ended. */
  readonly status: SyncToken;
  /** Which compare-and-swap attempt this was, 0-based, as the engine counts. */
  readonly attempt: number;
  /** `learner_state.revision` involved, or null when no row was read or written. */
  readonly rev: number | null;
  /** Envelope size. A count, which is why it is allowed; it says nothing about content. */
  readonly bytes: number | null;
  /** The engine's closed reason word, or null when there is nothing to explain. */
  readonly code: SyncToken | null;
  /**
   * Milliseconds since this recorder was created — a stopwatch, not a wall clock and
   * not a measured phase duration. Two records subtract into the cost of what happened
   * between them; on its own it only orders things. Deliberately not a timestamp: a
   * wall clock in a log is one more thing that correlates a person across devices.
   */
  readonly ms: number;
}

/** Every key a `SyncDiagnostic` has, in print order. The test asserts this is exact. */
export const SYNC_DIAGNOSTIC_FIELDS = [
  'namespace',
  'phase',
  'status',
  'attempt',
  'rev',
  'bytes',
  'code',
  'ms',
] as const;

/**
 * What the engine hands over.
 *
 * Declared here rather than imported so that this module keeps working when the
 * engine's unions grow, and typed loosely because every field is re-validated below
 * anyway. The line under it is the compile-time proof that the two still agree: if
 * `SyncEvent` renames `revision`, this file stops compiling instead of quietly
 * printing `rev` as null in every line from then on.
 */
export interface SyncDiagnosticInput {
  readonly namespace: string;
  readonly phase: string;
  readonly status: string;
  readonly attempt: number;
  readonly revision: number | null;
  readonly bytes: number | null;
  readonly code: string | null;
}

const _acceptsEngineEvents: (event: SyncEvent) => void = (_: SyncDiagnosticInput): void => {};
void _acceptsEngineEvents;

// ──────────────────────────────────────────────────────────────── the alarm

/**
 * Statuses that mean the account is not getting this device's data, and waiting will
 * not change that.
 *
 * `offline` and `conflict` are deliberately absent: a phone in a tunnel and a
 * compare-and-swap that lost a race are both the system working. An alarm that fires
 * on those is an alarm people learn to ignore.
 */
const ALARM_STATUSES: ReadonlySet<string> = new Set(['refused', 'quarantined']);

/**
 * `quiet` is usually a designed pause, with one exception: a namespace held back
 * because the account carries a newer schema than this build understands stays held
 * back until the app is updated. That is a device that has silently stopped syncing,
 * which is exactly what an alarm is for.
 */
const ALARM_CODES: ReadonlySet<string> = new Set(['newer-schema']);

/** True when this record should be shouted rather than logged. */
export function isSyncAlarm(record: SyncDiagnostic): boolean {
  if (ALARM_STATUSES.has(record.status)) return true;
  return record.status === 'quiet' && record.code !== null && ALARM_CODES.has(record.code);
}

// ─────────────────────────────────────────────────────────────── the formatter

/** The stable prefix for the ordinary per-event line. */
export const SYNC_LOG_PREFIX = '[luvani:sync]';

/**
 * The stable alarm string. Renaming this breaks whoever is grepping for it during an
 * incident, which is the only time it matters.
 */
export const SYNC_ALARM_PREFIX = '[luvani] SYNC_NOT_CONVERGED';

/**
 * One line, prefix included, alarm or not.
 *
 * Null fields are omitted rather than printed as zero — timing.ts's rule. "There was no
 * revision" and "the revision was 0" are different facts, and a printed 0 hides one
 * behind the other.
 */
export function formatSyncDiagnostic(record: SyncDiagnostic): string {
  const parts = [
    `ns=${record.namespace}`,
    `phase=${record.phase}`,
    `status=${record.status}`,
    `attempt=${record.attempt}`,
  ];
  if (record.rev !== null) parts.push(`rev=${record.rev}`);
  if (record.bytes !== null) parts.push(`bytes=${record.bytes}`);
  if (record.code !== null) parts.push(`code=${record.code}`);
  parts.push(`ms=${record.ms}`);
  const prefix = isSyncAlarm(record) ? SYNC_ALARM_PREFIX : SYNC_LOG_PREFIX;
  return `${prefix} ${parts.join(' ')}`;
}

// ──────────────────────────────────────────────────────────── the ring buffer

/**
 * How many events are kept. Enough to hold a full launch reconcile of twelve
 * namespaces with several conflict retries each, and small enough that a device
 * syncing badly for an hour still costs a fixed, tiny amount of memory.
 */
export const SYNC_RING_CAPACITY = 96;

/**
 * Statuses recorded but not printed.
 *
 * `unchanged` is the common case — most namespaces are clean most cycles — and twelve
 * of those per launch is the noise that trains people to filter the prefix out. It
 * still goes in the ring, where it is evidence rather than chatter.
 */
const SILENT_STATUSES: ReadonlySet<string> = new Set(['unchanged', 'stopped']);

export interface SyncDiagnosticsOptions {
  /** Injected clock. `ms` is measured from the first call to this. */
  readonly now?: () => number;
  readonly capacity?: number;
  /** Where ordinary lines go. The seam: swap this, and nothing else changes. */
  readonly log?: (line: string) => void;
  /** Where `SYNC_NOT_CONVERGED` goes. */
  readonly alarm?: (line: string) => void;
  /** False keeps everything in the ring and prints nothing. */
  readonly console?: boolean;
}

export interface SyncDiagnostics {
  /**
   * Pass this straight to `createSyncEngine({ record })`. It is a closure, not a
   * method, so it survives being detached from the object.
   */
  readonly record: (event: SyncDiagnosticInput) => void;
  /** Oldest first. A copy: the caller cannot reach into the buffer. */
  readonly entries: () => readonly SyncDiagnostic[];
  /** Every line the ring would print, oldest first. For a support dump. */
  readonly lines: () => readonly string[];
  /** How many events have ever been recorded, including the ones dropped. */
  readonly seen: () => number;
  readonly clear: () => void;
  readonly capacity: number;
}

/**
 * A bounded ring of records, and one line per interesting one.
 *
 * Nothing in here throws. A diagnostics sink that can fail a sync is worse than no
 * diagnostics: the engine already wraps this call defensively, and this is the other
 * half of that agreement.
 */
export function createSyncDiagnostics(options: SyncDiagnosticsOptions = {}): SyncDiagnostics {
  const now = options.now ?? (() => Date.now());
  const capacity = Math.max(1, Math.trunc(options.capacity ?? SYNC_RING_CAPACITY));
  const toConsole = options.console ?? true;
  const log = options.log ?? ((line: string): void => console.log(line));
  const alarm = options.alarm ?? ((line: string): void => console.error(line));
  const started = now();

  const ring: (SyncDiagnostic | undefined)[] = new Array<SyncDiagnostic | undefined>(capacity);
  let written = 0;

  function elapsed(): number {
    const value = now() - started;
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  }

  function record(event: SyncDiagnosticInput): void {
    try {
      // Rebuilt field by field. Whatever else was hanging off `event` stays behind
      // here, which is the point: the buffer holds these eight or nothing.
      const entry: SyncDiagnostic = {
        namespace: token(event?.namespace),
        phase: token(event?.phase),
        status: token(event?.status),
        attempt: counter(event?.attempt),
        rev: optionalCounter(event?.revision),
        bytes: optionalCounter(event?.bytes),
        code: optionalToken(event?.code),
        ms: elapsed(),
      };

      ring[written % capacity] = entry;
      written += 1;

      if (!toConsole) return;
      if (isSyncAlarm(entry)) alarm(formatSyncDiagnostic(entry));
      else if (!SILENT_STATUSES.has(entry.status)) log(formatSyncDiagnostic(entry));
    } catch {
      // A sink that throws would turn a diagnostic into an outage.
    }
  }

  function entries(): readonly SyncDiagnostic[] {
    const out: SyncDiagnostic[] = [];
    const start = written > capacity ? written - capacity : 0;
    for (let at = start; at < written; at += 1) {
      const entry = ring[at % capacity];
      if (entry !== undefined) out.push(entry);
    }
    return out;
  }

  return {
    record,
    entries,
    lines: () => entries().map(formatSyncDiagnostic),
    seen: () => written,
    clear: () => {
      ring.fill(undefined);
      written = 0;
    },
    capacity,
  };
}
