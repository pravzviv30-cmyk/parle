/**
 * The test that holds the shape.
 *
 * F90 is not really a feature, it is a refusal, and a refusal needs a test or it decays
 * the first time somebody is debugging a sync bug at speed. So the first test here is
 * adversarial on purpose: it hands the recorder events with a learner's French, their
 * name, their email and a whole payload attached, and then goes looking for any of it
 * in the buffer, in the lines and in the JSON of both.
 *
 * The rest is the ordinary contract — bounded ring, stable strings, never throws.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import type { SyncEvent } from './engine.ts';
import {
  SYNC_ALARM_PREFIX,
  SYNC_DIAGNOSTIC_FIELDS,
  SYNC_LOG_PREFIX,
  SYNC_RING_CAPACITY,
  UNKNOWN_TOKEN,
  createSyncDiagnostics,
  formatSyncDiagnostic,
  isSyncAlarm,
  token,
  type SyncDiagnostic,
  type SyncDiagnosticInput,
} from './diagnostics.ts';

/** A clock that only moves when a test moves it. */
function stopwatch(): { now: () => number; tick: (ms: number) => void } {
  let at = 0;
  return {
    now: () => at,
    tick: (ms: number) => {
      at += ms;
    },
  };
}

/** Build an event, including fields no honest caller would send. */
const event = (fields: Record<string, unknown>): SyncDiagnosticInput =>
  ({
    namespace: 'profile',
    phase: 'push',
    status: 'pushed',
    attempt: 0,
    revision: null,
    bytes: null,
    code: null,
    ...fields,
  }) as unknown as SyncDiagnosticInput;

/**
 * Things a learner would be mortified to find in a log, in the shapes they actually
 * take in this app: a beginner's attempt, an accented word, a name, an email address,
 * a pronunciation score sentence, a serialised store blob, a chunk of base64 audio.
 */
const LEARNER_CONTENT = [
  'je voudrais un café sil vous plait',
  'fatigué',
  'Marie Dubois',
  'hello@thevisionarymedia.net',
  'pronunciation 62% on "bonjour"',
  '{"phrases":[{"fr":"je ne sais pas","seen":4}]}',
  'UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=',
] as const;

describe('sync diagnostics — evidence, never content', () => {
  test('sync diagnostics never contain payload fields or learner text', () => {
    // ── Wall one: the type has nowhere to put a phrase.
    //
    // This is a compile-time assertion, not a runtime one. If somebody adds
    // `detail: string` or `data: unknown` to SyncDiagnostic, `Extract` stops being
    // `never`, `_NoFreeText` becomes `never`, and `true` is no longer assignable to
    // it — so the gate's typecheck fails before this test even runs.
    type FreeText =
      | 'detail'
      | 'message'
      | 'text'
      | 'transcript'
      | 'phrase'
      | 'phrases'
      | 'utterance'
      | 'french'
      | 'answer'
      | 'score'
      | 'name'
      | 'email'
      | 'payload'
      | 'data'
      | 'blob'
      | 'body'
      | 'error'
      | 'stack';
    type _NoFreeText = Extract<keyof SyncDiagnostic, FreeText> extends never ? true : never;
    const noFreeText: _NoFreeText = true;
    assert.equal(noFreeText, true);

    // And the runtime half of the same claim: eight fields, named, in one place.
    assert.deepEqual(
      [...SYNC_DIAGNOSTIC_FIELDS],
      ['namespace', 'phase', 'status', 'attempt', 'rev', 'bytes', 'code', 'ms'],
      'the permitted field list changed — that is a privacy decision, not a refactor',
    );

    // ── Wall two: what is handed over is not what is kept.
    const clock = stopwatch();
    const lines: string[] = [];
    const diagnostics = createSyncDiagnostics({
      now: clock.now,
      log: (line) => lines.push(line),
      alarm: (line) => lines.push(line),
    });

    // An event decorated the way a hurried debugging session decorates one.
    diagnostics.record(
      event({
        namespace: 'profile',
        status: 'pushed',
        bytes: 2_048,
        transcript: 'je voudrais un café sil vous plait',
        payload: { phrases: [{ fr: 'je ne sais pas', seen: 4 }] },
        learner: { email: 'hello@thevisionarymedia.net', name: 'Marie Dubois' },
        detail: 'pronunciation 62% on "bonjour"',
        audio: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=',
      }),
    );

    const kept = diagnostics.entries()[0];
    assert.ok(kept !== undefined, 'the event was not recorded at all');
    assert.deepEqual(
      Object.keys(kept).sort(),
      [...SYNC_DIAGNOSTIC_FIELDS].sort(),
      'the buffer kept a key the record type does not declare',
    );

    // ── Wall three: learner content aimed at the fields that *do* exist.
    //
    // The declared fields are the last way in, so each one is fed a phrase, a name and
    // an email in turn. None of them is a free-text field, so each value has to come
    // back as `?` rather than as a trimmed-down version of itself.
    for (const content of LEARNER_CONTENT) {
      diagnostics.record(
        event({ namespace: content, phase: content, status: content, code: content, revision: content }),
      );
    }

    const dump = JSON.stringify(diagnostics.entries()) + '\n' + diagnostics.lines().join('\n');
    for (const content of LEARNER_CONTENT) {
      assert.equal(dump.includes(content), false, `learner content survived: ${content}`);
      // Not just the whole string — the halves a partial scrub would leave behind.
      for (const word of content.split(/[^A-Za-z]+/).filter((w) => w.length >= 4)) {
        assert.equal(dump.includes(word), false, `a fragment of learner content survived: ${word}`);
      }
    }
    assert.equal(dump.includes('62'), false, 'a pronunciation score survived');

    // The refusal is total, not partial: every one of those became `?`.
    for (const entry of diagnostics.entries().slice(1)) {
      assert.equal(entry.namespace, UNKNOWN_TOKEN);
      assert.equal(entry.phase, UNKNOWN_TOKEN);
      assert.equal(entry.status, UNKNOWN_TOKEN);
      assert.equal(entry.code, UNKNOWN_TOKEN);
      assert.equal(entry.rev, null, 'a string reached a numeric field');
    }

    // ── And the standing invariant over everything in the ring: numbers, nulls, and
    // short bare words. Nothing that has a space in it, an accent, an `@` or a quote.
    for (const entry of diagnostics.entries()) {
      for (const [field, value] of Object.entries(entry)) {
        if (value === null || typeof value === 'number') continue;
        assert.equal(typeof value, 'string', `${field} held a ${typeof value}`);
        assert.match(String(value), /^[A-Za-z0-9?][A-Za-z0-9._-]{0,31}$/, `${field} held free text`);
      }
    }

    // A legitimate value is untouched, or this would all be safe and useless.
    assert.equal(token('over-size-cap'), 'over-size-cap');
    assert.equal(token('soundChecks'), 'soundChecks');
    assert.equal(token(''), UNKNOWN_TOKEN);
    assert.equal(token(undefined), UNKNOWN_TOKEN);
  });

  test('the ring buffer holds a fixed number of events and drops the oldest first', () => {
    const clock = stopwatch();
    const diagnostics = createSyncDiagnostics({ now: clock.now, capacity: 4, console: false });

    for (let i = 0; i < 10; i += 1) {
      clock.tick(5);
      diagnostics.record(event({ namespace: 'review', revision: i }));
    }

    const entries = diagnostics.entries();
    assert.equal(entries.length, 4, 'the ring grew past its capacity');
    assert.deepEqual(
      entries.map((e) => e.rev),
      [6, 7, 8, 9],
      'the ring dropped the newest instead of the oldest',
    );
    assert.equal(diagnostics.seen(), 10, 'the dropped events were not counted');

    // `ms` is a stopwatch from the recorder's first tick, so the gap between two
    // records is readable and nothing in the ring is a wall-clock timestamp.
    assert.deepEqual(
      entries.map((e) => e.ms),
      [35, 40, 45, 50],
    );

    diagnostics.clear();
    assert.deepEqual(diagnostics.entries(), []);
    assert.equal(diagnostics.seen(), 0);

    // A default recorder is bounded too, without being asked.
    assert.equal(createSyncDiagnostics({ console: false }).capacity, SYNC_RING_CAPACITY);
  });

  test('every event prints one greppable line in the [parle] house style', () => {
    const clock = stopwatch();
    const printed: string[] = [];
    const diagnostics = createSyncDiagnostics({ now: clock.now, log: (line) => printed.push(line) });

    clock.tick(412);
    diagnostics.record(event({ namespace: 'profile', phase: 'push', status: 'pushed', attempt: 1, revision: 7, bytes: 2_048 }));
    diagnostics.record(event({ namespace: 'topics', phase: 'cycle', status: 'unchanged' }));
    diagnostics.record(event({ namespace: 'drills', phase: 'push', status: 'conflict', attempt: 2, revision: 3, code: 'stale-revision' }));

    assert.deepEqual(printed, [
      '[parle:sync] ns=profile phase=push status=pushed attempt=1 rev=7 bytes=2048 ms=412',
      '[parle:sync] ns=drills phase=push status=conflict attempt=2 rev=3 code=stale-revision ms=412',
    ]);

    // `unchanged` is the common case and would drown the prefix twelve times a launch,
    // so it stays in the ring as evidence and off the console as noise.
    assert.equal(diagnostics.entries().length, 3);
    assert.equal(SYNC_LOG_PREFIX, '[parle:sync]');

    // Absent facts are absent, never printed as a zero that looks measured.
    const sparse = diagnostics.entries()[1];
    assert.ok(sparse !== undefined);
    const line = formatSyncDiagnostic(sparse);
    assert.equal(line, '[parle:sync] ns=topics phase=cycle status=unchanged attempt=0 ms=412');
    assert.equal(line.includes('rev='), false);
    assert.equal(line.includes('bytes='), false);
    assert.equal(line.includes('code='), false);
    for (const each of diagnostics.lines()) assert.equal(each.includes('\n'), false, 'a record printed over two lines');
  });

  test('a namespace that will not converge raises a stable alarm string', () => {
    const shouted: string[] = [];
    const quiet: string[] = [];
    const diagnostics = createSyncDiagnostics({
      now: stopwatch().now,
      log: (line) => quiet.push(line),
      alarm: (line) => shouted.push(line),
    });

    // Parked for being oversized, and an unreadable payload on the account: both mean
    // this device's data is not in the account and retrying will not change that.
    diagnostics.record(event({ namespace: 'profile', phase: 'push', status: 'refused', code: 'over-size-cap' }));
    diagnostics.record(event({ namespace: 'review', phase: 'pull', status: 'quarantined', code: 'not-an-object' }));
    // A build too old to understand the account's payload has stopped syncing silently.
    diagnostics.record(event({ namespace: 'drills', phase: 'merge', status: 'quiet', code: 'newer-schema' }));
    // These two are the system working, and an alarm on them is an alarm people mute.
    diagnostics.record(event({ namespace: 'topics', phase: 'cycle', status: 'offline', code: 'no-token' }));
    diagnostics.record(event({ namespace: 'history', phase: 'push', status: 'conflict', code: 'stale-revision' }));

    assert.equal(shouted.length, 3, 'the alarm fired on the wrong number of records');
    for (const line of shouted) {
      assert.equal(line.startsWith('[parle] SYNC_NOT_CONVERGED '), true, `not the stable alarm string: ${line}`);
    }
    assert.equal(
      shouted[0],
      '[parle] SYNC_NOT_CONVERGED ns=profile phase=push status=refused attempt=0 code=over-size-cap ms=0',
    );
    assert.equal(quiet.length, 2, 'a working-as-designed status was shouted about');
    for (const line of quiet) assert.equal(line.includes('SYNC_NOT_CONVERGED'), false);

    // The string itself is the interface. Changing it breaks whoever is grepping.
    assert.equal(SYNC_ALARM_PREFIX, '[parle] SYNC_NOT_CONVERGED');
    assert.equal(isSyncAlarm({ ...(diagnostics.entries()[3] as SyncDiagnostic) }), false);
  });

  test('the recorder accepts the engine event as it is and never throws on a broken one', () => {
    // The engine's own shape, typed as the engine types it. If SyncEvent renames a
    // field, this stops compiling here rather than printing nulls forever in the field.
    const fromEngine: SyncEvent = {
      namespace: 'missions',
      phase: 'adopt',
      status: 'adopted',
      attempt: 1,
      revision: 12,
      bytes: 640,
      code: null,
    };

    const lines: string[] = [];
    const diagnostics = createSyncDiagnostics({ now: stopwatch().now, log: (line) => lines.push(line), alarm: (line) => lines.push(line) });

    // The wiring App.tsx will do: the sink handed straight to the engine, detached
    // from its object, which is why `record` is a closure and not a method.
    const sink: (e: SyncEvent) => void = diagnostics.record;
    sink(fromEngine);
    assert.deepEqual(lines, ['[parle:sync] ns=missions phase=adopt status=adopted attempt=1 rev=12 bytes=640 ms=0']);

    // And everything a caller should never send, sent. None of it throws, because a
    // diagnostic that can fail a sync is worse than no diagnostic at all.
    const broken: unknown[] = [
      null,
      undefined,
      {},
      { namespace: 42, phase: {}, status: [], attempt: 'many', revision: NaN, bytes: Infinity, code: 0 },
      { namespace: 'x'.repeat(5_000), phase: 'push', status: 'pushed', attempt: -3, revision: 1.7, bytes: -1, code: null },
    ];
    for (const one of broken) {
      assert.doesNotThrow(() => diagnostics.record(one as SyncDiagnosticInput));
    }
    assert.equal(diagnostics.seen(), 1 + broken.length);

    for (const entry of diagnostics.entries()) {
      assert.equal(Number.isInteger(entry.attempt) && entry.attempt >= 0, true, 'attempt was not a whole count');
      assert.equal(entry.rev === null || Number.isInteger(entry.rev), true, 'rev was not a whole number or null');
      assert.equal(entry.bytes === null || Number.isInteger(entry.bytes), true, 'bytes was not a whole number or null');
      assert.equal(Number.isInteger(entry.ms) && entry.ms >= 0, true, 'ms was not a whole count');
      assert.equal(entry.namespace.length <= 32, true, 'an unbounded string reached the buffer');
    }

    // A sink that throws is contained too — the alarm below explodes, sync does not.
    const hostile = createSyncDiagnostics({
      now: stopwatch().now,
      alarm: () => {
        throw new Error('sink down');
      },
    });
    assert.doesNotThrow(() => hostile.record(event({ status: 'refused', code: 'over-size-cap' })));
    assert.equal(hostile.entries().length, 1, 'the record was lost when the sink failed');
  });
});
