/**
 * The test that holds the shape.
 *
 * F90 is not really a feature, it is a refusal, and a refusal needs a test or it decays
 * the first time somebody is debugging a sync bug at speed. So the first test here is
 * adversarial on purpose: it hands the recorder events with a learner's French, their
 * name, their email and a whole payload attached, and then goes looking for any of it
 * in every line that reaches the injected `log` and `alarm` sinks, which are the only
 * places the recorder sends anything.
 *
 * The rest is the ordinary contract — stable strings, never throws.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import type { SyncEvent } from './engine.ts';
import {
  SYNC_ALARM_PREFIX,
  SYNC_DIAGNOSTIC_FIELDS,
  SYNC_LOG_PREFIX,
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

/** The printed key for each `SyncDiagnostic` field, in print order. */
const PRINTED_KEYS: readonly string[] = ['ns', 'phase', 'status', 'attempt', 'rev', 'bytes', 'code', 'ms'];

/** A printed line back into its fields, so a test can check each one. */
function fieldsOf(line: string): Record<string, string> {
  const prefix = line.startsWith(`${SYNC_ALARM_PREFIX} `) ? SYNC_ALARM_PREFIX : SYNC_LOG_PREFIX;
  assert.equal(line.startsWith(`${prefix} `), true, `not a sync line: ${line}`);
  const fields: Record<string, string> = {};
  for (const part of line.slice(prefix.length + 1).split(' ')) {
    const at = part.indexOf('=');
    fields[part.slice(0, at)] = part.slice(at + 1);
  }
  return fields;
}

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

    // ── Wall two: what is handed over is not what is sent.
    const clock = stopwatch();
    const logged: string[] = [];
    const alarmed: string[] = [];
    const diagnostics = createSyncDiagnostics({
      now: clock.now,
      log: (line) => logged.push(line),
      alarm: (line) => alarmed.push(line),
    });

    // An event decorated the way a hurried debugging session decorates one, once for
    // each sink: an ordinary push goes to `log`, a refused one to `alarm`.
    const decorations = {
      transcript: 'je voudrais un café sil vous plait',
      payload: { phrases: [{ fr: 'je ne sais pas', seen: 4 }] },
      learner: { email: 'hello@thevisionarymedia.net', name: 'Marie Dubois' },
      detail: 'pronunciation 62% on "bonjour"',
      audio: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=',
    };
    diagnostics.record(event({ namespace: 'profile', status: 'pushed', bytes: 2_048, ...decorations }));
    diagnostics.record(event({ namespace: 'profile', status: 'refused', code: 'over-size-cap', ...decorations }));

    assert.equal(logged.length, 1, 'the decorated push was not sent to log');
    assert.equal(alarmed.length, 1, 'the decorated refusal was not sent to alarm');
    for (const line of [...logged, ...alarmed]) {
      for (const key of Object.keys(fieldsOf(line))) {
        assert.ok(PRINTED_KEYS.includes(key), `a sink received a key the record type does not declare: ${key}`);
      }
    }

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

    const dump = [...logged, ...alarmed].join('\n');
    for (const content of LEARNER_CONTENT) {
      assert.equal(dump.includes(content), false, `learner content survived: ${content}`);
      // Not just the whole string — the halves a partial scrub would leave behind.
      for (const word of content.split(/[^A-Za-z]+/).filter((w) => w.length >= 4)) {
        assert.equal(dump.includes(word), false, `a fragment of learner content survived: ${word}`);
      }
    }
    assert.equal(dump.includes('62'), false, 'a pronunciation score survived');

    // The refusal is total, not partial: every one of those became `?`.
    const aimed = logged.slice(1);
    assert.equal(aimed.length, LEARNER_CONTENT.length, 'an event aimed at the fields was not sent');
    for (const line of aimed) {
      const fields = fieldsOf(line);
      assert.equal(fields.ns, UNKNOWN_TOKEN);
      assert.equal(fields.phase, UNKNOWN_TOKEN);
      assert.equal(fields.status, UNKNOWN_TOKEN);
      assert.equal(fields.code, UNKNOWN_TOKEN);
      assert.equal('rev' in fields, false, 'a string reached a numeric field');
    }

    // ── And the standing invariant over everything either sink received: whole numbers
    // and short bare words. Nothing that has a space in it, an accent, an `@` or a quote.
    for (const line of [...logged, ...alarmed]) {
      for (const [field, value] of Object.entries(fieldsOf(line))) {
        if (/^-?\d+$/.test(value)) continue;
        assert.match(value, /^[A-Za-z0-9?][A-Za-z0-9._-]{0,31}$/, `${field} held free text`);
      }
    }

    // A legitimate value is untouched, or this would all be safe and useless.
    assert.equal(token('over-size-cap'), 'over-size-cap');
    assert.equal(token('soundChecks'), 'soundChecks');
    assert.equal(token(''), UNKNOWN_TOKEN);
    assert.equal(token(undefined), UNKNOWN_TOKEN);
  });

  test('every event prints one greppable line in the [luvani] house style', () => {
    const clock = stopwatch();
    const printed: string[] = [];
    const diagnostics = createSyncDiagnostics({ now: clock.now, log: (line) => printed.push(line) });

    clock.tick(412);
    diagnostics.record(event({ namespace: 'profile', phase: 'push', status: 'pushed', attempt: 1, revision: 7, bytes: 2_048 }));
    diagnostics.record(event({ namespace: 'topics', phase: 'cycle', status: 'unchanged' }));
    diagnostics.record(event({ namespace: 'drills', phase: 'push', status: 'conflict', attempt: 2, revision: 3, code: 'stale-revision' }));

    assert.deepEqual(printed, [
      '[luvani:sync] ns=profile phase=push status=pushed attempt=1 rev=7 bytes=2048 ms=412',
      '[luvani:sync] ns=drills phase=push status=conflict attempt=2 rev=3 code=stale-revision ms=412',
    ]);

    // `unchanged` is the common case and would drown the prefix fifteen times a launch,
    // so it stays off the console as noise.
    assert.equal(SYNC_LOG_PREFIX, '[luvani:sync]');

    // Absent facts are absent, never printed as a zero that looks measured.
    const line = formatSyncDiagnostic({
      namespace: token('topics'),
      phase: token('cycle'),
      status: token('unchanged'),
      attempt: 0,
      rev: null,
      bytes: null,
      code: null,
      ms: 412,
    });
    assert.equal(line, '[luvani:sync] ns=topics phase=cycle status=unchanged attempt=0 ms=412');
    assert.equal(line.includes('rev='), false);
    assert.equal(line.includes('bytes='), false);
    assert.equal(line.includes('code='), false);
    for (const each of printed) assert.equal(each.includes('\n'), false, 'a record printed over two lines');
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
      assert.equal(line.startsWith('[luvani] SYNC_NOT_CONVERGED '), true, `not the stable alarm string: ${line}`);
    }
    assert.equal(
      shouted[0],
      '[luvani] SYNC_NOT_CONVERGED ns=profile phase=push status=refused attempt=0 code=over-size-cap ms=0',
    );
    assert.equal(quiet.length, 2, 'a working-as-designed status was shouted about');
    for (const line of quiet) assert.equal(line.includes('SYNC_NOT_CONVERGED'), false);

    // The string itself is the interface. Changing it breaks whoever is grepping.
    assert.equal(SYNC_ALARM_PREFIX, '[luvani] SYNC_NOT_CONVERGED');
    const offline: SyncDiagnostic = {
      namespace: token('topics'),
      phase: token('cycle'),
      status: token('offline'),
      attempt: 0,
      rev: null,
      bytes: null,
      code: token('no-token'),
      ms: 0,
    };
    assert.equal(isSyncAlarm(offline), false);
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

    // The wiring App.tsx does: the sink handed straight to the engine, detached
    // from its object, which is why `record` is a closure and not a method.
    const sink: (e: SyncEvent) => void = diagnostics.record;
    sink(fromEngine);
    assert.deepEqual(lines, ['[luvani:sync] ns=missions phase=adopt status=adopted attempt=1 rev=12 bytes=640 ms=0']);

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
    assert.equal(lines.length, 1 + broken.length);

    for (const line of lines) {
      const entry = fieldsOf(line);
      assert.match(entry.attempt ?? '', /^\d+$/, 'attempt was not a whole count');
      assert.equal(entry.rev === undefined || /^-?\d+$/.test(entry.rev), true, 'rev was not a whole number or absent');
      assert.equal(entry.bytes === undefined || /^-?\d+$/.test(entry.bytes), true, 'bytes was not a whole number or absent');
      assert.match(entry.ms ?? '', /^\d+$/, 'ms was not a whole count');
      assert.equal((entry.ns ?? '').length <= 32, true, 'an unbounded string reached a sink');
    }

    // A sink that throws is contained too — the alarm below explodes, sync does not,
    // and the next event still prints.
    const after: string[] = [];
    const hostile = createSyncDiagnostics({
      now: stopwatch().now,
      log: (line) => after.push(line),
      alarm: () => {
        throw new Error('sink down');
      },
    });
    assert.doesNotThrow(() => hostile.record(event({ status: 'refused', code: 'over-size-cap' })));
    hostile.record(event({ status: 'pushed' }));
    assert.equal(after.length, 1, 'the recorder stopped working after a sink failed');
  });
});
