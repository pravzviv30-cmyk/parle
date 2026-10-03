/**
 * The own-words judge endpoint, held to the three things it must never do:
 * invent a verdict, keep the attempt, or let an unauthenticated caller spend
 * the brain.
 */

import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { JevFirstBrainClient, MockLlmClient, OwnWordsVerdictSchema, type JevAnswer } from '@luvani/brain/llm';

import { handleDrillJudge, judgeUsageLine, JUDGE_BODY_LIMIT_BYTES, type DrillJudgeDeps } from './drillJudge.ts';

const ATTEMPT = 'Un café pour moi, merci beaucoup.';

const CARD = {
  fr: "Je voudrais un café, s'il vous plaît.",
  en: 'I would like a coffee, please.',
  situation: 'ordering at the counter of a small Paris café',
  mustKeep: ['asking for a coffee', 'staying polite'],
  attempt: ATTEMPT,
  cefr: 'A2',
};

const VERDICT = {
  meaningKept: true,
  comprehensible: true,
  natural: 'awkward',
  betterLine: 'Un café, merci.',
  note: 'Both would be understood at the counter.',
};

/** A request carrying one JSON body, as the server would hand it over. */
function request(body: unknown, headers: Record<string, string> = {}): IncomingMessage {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  const stream = Readable.from([Buffer.from(text, 'utf8')]) as unknown as IncomingMessage;
  stream.headers = { authorization: 'Bearer token', ...headers };
  stream.method = 'POST';
  return stream;
}

/** A response that records what it was told to say. */
function response(): { res: ServerResponse; status: () => number; body: () => Record<string, unknown> } {
  let status = 0;
  let payload = '';
  const res = {
    writeHead(code: number) {
      status = code;
      return res;
    },
    end(text?: string) {
      payload = text ?? '';
    },
  } as unknown as ServerResponse;
  return { res, status: () => status, body: () => (payload === '' ? {} : (JSON.parse(payload) as Record<string, unknown>)) };
}

/** Everything the handler is given, with a brain it can be told how to answer. */
function deps(overrides: Partial<DrillJudgeDeps> = {}): DrillJudgeDeps & { seen: { limits: (string | null)[]; usage: unknown[] } } {
  const seen = { limits: [] as (string | null)[], usage: [] as unknown[] };
  return {
    seen,
    users: { resolve: async () => ({ ok: true as const, userId: 'learner-1' }) },
    limits: async (_req, _res, userId) => {
      seen.limits.push(userId);
      return true;
    },
    client: { judge: async () => ({ verdict: VERDICT, usage: { inputTokens: 40, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0 } }) },
    usage: (usage) => seen.usage.push(usage),
    ...overrides,
  };
}

describe('the own-words judge endpoint — F580', () => {
  test('a mismatched learner assertion cannot send another account’s attempt to the judge', async () => {
    let judged = 0;
    const d = deps({ client: { judge: async () => { judged++; throw new Error('must not run'); } } });
    const r = response();
    await handleDrillJudge(request({ ...CARD, userId: 'previous-learner' }), r.res, d);
    assert.equal(r.status(), 403);
    assert.equal(judged, 0);
    assert.deepEqual(d.seen.usage, []);
    assert.ok(!JSON.stringify(r.body()).includes(ATTEMPT));
  });
  test('an attempt is judged by the brain and the verdict is returned whole', async () => {
    const { res, status, body } = response();
    const d = deps();

    await handleDrillJudge(request(CARD), res, d);

    assert.equal(status(), 200);
    assert.deepEqual(body(), { verdict: VERDICT });
    // Whole means whole: every field the schema describes crosses the wire, so
    // the app can decide good, retry or reveal from the same evidence the
    // brain produced. Nothing here is a grade, and nothing here is a score.
    assert.equal(OwnWordsVerdictSchema.safeParse((body() as { verdict: unknown }).verdict).success, true);
    // The limits ran twice: once on the address before anyone was identified,
    // once on the learner afterwards. That is the scoring endpoint's shape.
    assert.deepEqual(d.seen.limits, [null, 'learner-1']);
  });

  test('a brain that will not answer is a 503, never an invented verdict', async () => {
    // Four ways for a judge to fail, and one answer to all of them, because a
    // learner cannot act on the difference and a default pass would tell them
    // their French was fine when nobody read it.
    const failures: DrillJudgeDeps['client'][] = [
      { judge: async () => { throw new Error('vendor is down'); } },
      { judge: async () => ({ verdict: { meaningKept: 'yes' }, usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 } }) },
      { judge: async () => ({ verdict: null, usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 } }) },
      { judge: () => new Promise(() => undefined) },
    ];

    for (const client of failures) {
      const { res, status, body } = response();
      await handleDrillJudge(request(CARD), res, deps({ client, timeoutMs: 10 }));

      assert.equal(status(), 503, 'a judge that could not answer must say so');
      assert.deepEqual(body(), { error: 'judge-unavailable' });
      assert.equal('verdict' in body(), false, 'and must not hand back anything a screen could read as a pass');
    }
  });

  test('the attempt is never written to the store or the usage log', async () => {
    const { res, body } = response();
    const written: string[] = [];
    const console_ = { log: console.log, info: console.info, warn: console.warn, error: console.error };
    for (const level of ['log', 'info', 'warn', 'error'] as const) {
      console[level] = (...args: unknown[]) => written.push(args.map((a) => String(a)).join(' '));
    }

    const d = deps({
      // A brain that fails after reading the attempt is the worst case: the
      // error itself carries the learner's sentence, and nothing may log it.
      client: { judge: async (req) => { throw new Error(`upstream rejected: ${req.request}`); } },
    });
    try {
      await handleDrillJudge(request(CARD), res, d);
      const clean = response();
      await handleDrillJudge(request(CARD), clean.res, d);
    } finally {
      Object.assign(console, console_);
    }

    // Everything this endpoint could possibly have persisted, in one string.
    const everything = [...written, JSON.stringify(d.seen.usage), JSON.stringify(body())].join(' ');
    assert.ok(!everything.includes(ATTEMPT), 'the learner’s own sentence must not survive the request');
    assert.ok(!everything.includes('café pour moi'), 'not in part either');
    // There is no store here to write to, and that is the design rather than an
    // omission: the handler is given a brain and a rate limiter, and nothing at
    // all that could keep a row.
    assert.deepEqual(Object.keys(deps()).filter((key) => /store|db|supabase|events/i.test(key)), []);
  });

  test('a body that is not a small judge request is refused before the brain is spent', async () => {
    const asked: number[] = [];
    const counting = { judge: async () => { asked.push(1); throw new Error('the brain must not have been asked'); } };

    for (const body of [
      'not json at all',
      JSON.stringify([CARD]),
      JSON.stringify({ ...CARD, fr: '' }),
      JSON.stringify({ ...CARD, en: 42 }),
      JSON.stringify({ ...CARD, situation: '   ' }),
      JSON.stringify({ ...CARD, attempt: '' }),
      JSON.stringify({ ...CARD, attempt: 'x'.repeat(5_000) }),
      JSON.stringify({ ...CARD, filler: 'y'.repeat(JUDGE_BODY_LIMIT_BYTES) }),
    ]) {
      const { res, status } = response();
      await handleDrillJudge(request(body), res, deps({ client: counting }));
      assert.equal(status(), 400, `this body must be refused: ${body.slice(0, 40)}`);
    }
    assert.deepEqual(asked, [], 'a malformed request never reaches a vendor we pay');
  });

  test('a learner who is not signed in is turned away before the brain is asked', async () => {
    const asked: number[] = [];
    const { res, status, body } = response();

    await handleDrillJudge(
      request(CARD),
      res,
      deps({
        users: { resolve: async () => ({ ok: false as const, status: 401, message: 'Sign in to use this.' }) },
        client: { judge: async () => { asked.push(1); throw new Error('unreachable'); } },
      }),
    );

    assert.equal(status(), 401);
    assert.equal(body().error, 'Sign in to use this.');
    assert.deepEqual(asked, [], 'an unauthenticated caller cannot spend the brain');
  });

  test('an odd hint is clamped rather than refused, so it never costs a learner their turn', async () => {
    let seen: string | undefined;
    const { res, status } = response();

    await handleDrillJudge(
      request({ ...CARD, cefr: 'Z9', mustKeep: ['asking for a coffee', 7, '', ...Array.from({ length: 20 }, () => 'padding')] }),
      res,
      deps({
        client: recordingBrain((request_) => {
          seen = request_;
        }),
      }),
    );

    assert.equal(status(), 200, 'a hint that arrives odd must not turn into a refusal');
    assert.match(seen ?? '', /LEARNER LEVEL: A2/, 'an unreadable level falls back rather than failing');
    assert.match(seen ?? '', /- asking for a coffee/);
    assert.ok((seen ?? '').split('- padding').length - 1 <= 8, 'and a long list is cut to what a prompt can hold');
  });

  test('the route sits beside drill scoring and shares its limits', () => {
    // Read as text, because the wiring is the part a unit test cannot see: an
    // endpoint that quietly used a looser rule than the scoring one beside it
    // would pass every test above.
    const server = readFileSync(new URL('./server.ts', import.meta.url), 'utf8');
    const route = server.indexOf("url.pathname === '/drill/judge'");
    assert.ok(route > 0, 'POST /drill/judge is not wired');
    const block = server.slice(route, route + 900);
    assert.match(block, /handleDrillJudge/);
    assert.match(block, /RATE_LIMITS\.scoringIp/);
    assert.match(block, /RATE_LIMITS\.scoringUser/);
    assert.match(block, /RATE_LIMITS\.scoringInstallation/);
    // One brain for the process, built on first use: a client per request would
    // be a new vendor connection for every learner pressing Check.
    assert.match(block, /judgeBrain\(\)/);
    assert.match(server, /brain \?\?= brainClientFromEnv\(process\.env\)/);
  });
});

/** A brain that records the prompt it was handed and answers with the fixture. */
function recordingBrain(record: (request: string) => void): DrillJudgeDeps['client'] {
  return {
    judge: async (request_) => {
      record(request_.request);
      return { verdict: VERDICT, usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 } };
    },
  };
}

describe('the own-words judge with Jev in front', () => {
  /** Jev answers that clear every pass bar in jevJudge.ts. */
  const CLEAN: Record<string, JevAnswer> = {
    meaning_kept: { type: 'noul', noul: 0.97 },
    comprehensible: { type: 'noul', noul: 0.96 },
    in_french: { type: 'noul', noul: 0.99 },
    natural: { type: 'choice', choice: 'yes', probabilities: { yes: 0.95, awkward: 0.04, no: 0.01 }, confidence: 0.9 },
  };
  const JEV_USAGE = { inputTokens: 858, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0, model: 'jev-1.13.0' };

  test('a clean attempt is settled by Jev through the real handler, and the brain is never asked', async () => {
    const { res, status, body } = response();
    const brain = new MockLlmClient({ verdicts: [VERDICT] });
    const jev = { systemOne: async () => ({ model: 'jev-1.13.0', answers: CLEAN, usage: JEV_USAGE }) };
    const d = deps({ client: new JevFirstBrainClient({ brain, jev }) });

    await handleDrillJudge(request(CARD), res, d);

    assert.equal(status(), 200);
    assert.deepEqual(body(), {
      verdict: { meaningKept: true, comprehensible: true, natural: 'yes', betterLine: null, note: '' },
    });
    assert.equal(brain.judgeRequests.length, 0);
    assert.deepEqual(d.seen.usage, [JEV_USAGE], 'the meter learns Jev answered, and what it cost');
  });

  test('Jev being down leaves the learner with the brain’s verdict, not a 503', async () => {
    const { res, status, body } = response();
    const brain = new MockLlmClient({ verdicts: [VERDICT] });
    const jev = { systemOne: async () => Promise.reject(new Error('TypeSafe System One request failed with status 529')) };

    await handleDrillJudge(request(CARD), res, deps({ client: new JevFirstBrainClient({ brain, jev }) }));

    assert.equal(status(), 200);
    assert.deepEqual(body(), { verdict: VERDICT });
    assert.equal(brain.judgeRequests.length, 1);
  });

  test('the log line names who answered and what it cost, and carries nothing of the attempt', () => {
    const line = judgeUsageLine(JEV_USAGE);
    assert.equal(line, '[luvani:judge] answered by jev-1.13.0: 858 input, 20 output, $0.000036');
    assert.doesNotMatch(line, /café|merci/);
  });

  test('a usage with no model is logged as an estimate rather than priced quietly', () => {
    const line = judgeUsageLine({ inputTokens: 40, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0 });
    assert.match(line, /answered by an unnamed model/);
    assert.match(line, /\(estimated\)$/);
  });
});
