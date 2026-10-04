/**
 * The drill scoring endpoint, held to F626: the learner's id and the line they
 * were saying never travel in a URL, because a URL is what proxies, access
 * logs and crash reports keep.
 */

import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { PhonemeObservation } from '@luvani/core';

import { DRILL_REFERENCE_HEADER, DRILL_USER_HEADER, handleDrillScore, type DrillScoreDeps } from './drillScore.ts';

const LEARNER = '6f1c2a4e-9b3d-4e8f-a1c2-7d5e3b9f0a12';
/** A corrected sentence, accents and all, which is what made the URL personal. */
const LINE = "J'ai déjà réservé une table près de la fenêtre.";
const AUDIO = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00]);
const OBSERVATIONS: PhonemeObservation[] = [{ ipa: 'y', score: 62, word: 'une' }];

/** A request as the server would hand it over: a URL, headers and an audio body. */
function request(url: string, headers: Record<string, string>, body: Uint8Array = AUDIO): IncomingMessage {
  const stream = Readable.from([Buffer.from(body)]) as unknown as IncomingMessage;
  stream.headers = { authorization: 'Bearer token', 'content-type': 'application/octet-stream', ...headers };
  stream.method = 'POST';
  stream.url = url;
  return stream;
}

/** The header form, encoded exactly as the app encodes it. */
function scoringHeaders(user = LEARNER, reference = LINE): Record<string, string> {
  return { [DRILL_USER_HEADER]: encodeURIComponent(user), [DRILL_REFERENCE_HEADER]: encodeURIComponent(reference) };
}

/** A response that records what it was told to say. */
function response(): { res: ServerResponse; status: () => number; body: () => Record<string, unknown> } {
  let status = 0;
  let payload = '';
  const res = Object.assign(new EventEmitter(), {
    writeHead(code: number) {
      status = code;
      return res;
    },
    end(text?: string) {
      payload = text ?? '';
    },
  }) as unknown as ServerResponse;
  return { res, status: () => status, body: () => (payload === '' ? {} : (JSON.parse(payload) as Record<string, unknown>)) };
}

/** Everything the handler is given, with a scorer that records and never reaches a vendor. */
function deps(): DrillScoreDeps & {
  seen: { limits: (string | null)[]; asserted: (string | null)[]; scored: { reference: string; audio: Uint8Array }[] };
} {
  const seen = {
    limits: [] as (string | null)[],
    asserted: [] as (string | null)[],
    scored: [] as { reference: string; audio: Uint8Array }[],
  };
  return {
    seen,
    users: {
      resolve: async (_authorization, asserted) => {
        seen.asserted.push(asserted);
        return { ok: true as const, userId: LEARNER };
      },
    },
    limits: async (_req, _res, userId) => {
      seen.limits.push(userId);
      return true;
    },
    score: async (scored) => {
      seen.scored.push(scored);
      return OBSERVATIONS;
    },
  };
}

const serverSource = readFileSync(path.join(import.meta.dirname, 'server.ts'), 'utf8');
const clientSource = readFileSync(
  path.resolve(import.meta.dirname, '..', '..', '..', 'apps', 'mobile', 'src', 'speech', 'scoreAttempt.ts'),
  'utf8',
);

describe('drill scoring keeps the learner and the line out of the URL — F626', () => {
  test('a drill score request carries no learner id or line in its URL', async () => {
    // 1. The header form scores. The line arrives decoded, accents intact, and
    //    the claimed learner reaches identity resolution exactly as the query
    //    value used to.
    {
      const { res, status, body } = response();
      const d = deps();
      await handleDrillScore(request('/drill/score', scoringHeaders()), res, d);

      assert.equal(status(), 200);
      assert.deepEqual(body().observations, OBSERVATIONS);
      assert.equal(typeof body().report, 'object', 'the response keeps its shape: observations and one report');
      assert.equal(d.seen.scored.length, 1);
      assert.equal(d.seen.scored[0]?.reference, LINE);
      assert.deepEqual(Buffer.from(d.seen.scored[0]?.audio ?? []), AUDIO);
      assert.deepEqual(d.seen.asserted, [LEARNER]);
      assert.deepEqual(d.seen.limits, [null, LEARNER], 'the address is limited first, then the learner');
    }

    // 2. The query form is refused, alone or beside the new headers, so an old
    //    client cannot quietly keep putting the line in a log.
    for (const url of [
      `/drill/score?userId=${encodeURIComponent(LEARNER)}&reference=${encodeURIComponent(LINE)}`,
      `/drill/score?reference=${encodeURIComponent(LINE)}`,
      `/drill/score?userId=${encodeURIComponent(LEARNER)}`,
    ]) {
      for (const headers of [{}, scoringHeaders()]) {
        const { res, status, body } = response();
        const d = deps();
        await handleDrillScore(request(url, headers), res, d);

        assert.equal(status(), 400, `the old form must be refused: ${url.slice(0, 40)}`);
        assert.deepEqual(d.seen.scored, [], 'a refused request never reaches a vendor we pay');
        assert.deepEqual(d.seen.asserted, []);
        assert.ok(!JSON.stringify(body()).includes('fenêtre'), 'and the refusal does not echo the line back');
      }
    }

    // 3. A missing reference header is a 400: there is nothing to score against.
    const withoutReference: Record<string, string>[] = [
      { [DRILL_USER_HEADER]: encodeURIComponent(LEARNER) },
      { [DRILL_USER_HEADER]: encodeURIComponent(LEARNER), [DRILL_REFERENCE_HEADER]: '' },
    ];
    for (const headers of withoutReference) {
      const { res, status, body } = response();
      const d = deps();
      await handleDrillScore(request('/drill/score', headers), res, d);

      assert.equal(status(), 400);
      assert.equal(body().error, 'reference is required');
      assert.deepEqual(d.seen.scored, []);
    }

    // 4. The app builds its URL with no query string at all, and sends both
    //    values in the headers the server reads, encoded. Read as text, because
    //    the app's fetch cannot run under node.
    const scoreFetch = clientSource.match(/fetch\(\s*`([^`]*\/drill\/score[^`]*)`/);
    assert.ok(scoreFetch, 'the drill score fetch is no longer a template literal this test can read');
    assert.equal(scoreFetch[1], '${TOKEN_SERVER}/drill/score');
    assert.ok(!scoreFetch[1]?.includes('?'), 'the drill score URL carries a query string again');
    assert.doesNotMatch(clientSource, /[?&](userId|reference)=/);
    assert.match(clientSource, new RegExp(`'${DRILL_USER_HEADER}': encodeURIComponent\\(userId\\)`));
    assert.match(clientSource, new RegExp(`'${DRILL_REFERENCE_HEADER}': encodeURIComponent\\(reference\\)`));
  });

  test('a scoring header that does not decode is a 400, not a crash', async () => {
    for (const headers of [
      { [DRILL_USER_HEADER]: encodeURIComponent(LEARNER), [DRILL_REFERENCE_HEADER]: '%E0%A4%A' },
      { [DRILL_USER_HEADER]: '%', [DRILL_REFERENCE_HEADER]: encodeURIComponent(LINE) },
    ]) {
      const { res, status, body } = response();
      const d = deps();
      await handleDrillScore(request('/drill/score', headers), res, d);

      assert.equal(status(), 400);
      assert.equal(body().error, 'a scoring header is not valid percent-encoding');
      assert.deepEqual(d.seen.scored, []);
      assert.deepEqual(d.seen.asserted, [], 'an unreadable claim never reaches identity resolution');
    }
  });

  test('a browser preflight allows both scoring headers', () => {
    // A web drill whose preflight does not list a header cannot send it, and a
    // drill that cannot send its line is never scored.
    const listed = serverSource.match(/'access-control-allow-headers':\s*[`'"]([^`'"]*)[`'"]/);
    assert.ok(listed, 'the preflight allow-list is missing');
    const allowed = (listed[1] ?? '')
      .replaceAll('${DRILL_USER_HEADER}', DRILL_USER_HEADER)
      .replaceAll('${DRILL_REFERENCE_HEADER}', DRILL_REFERENCE_HEADER)
      .split(',')
      .map((name) => name.trim());
    for (const name of ['content-type', 'authorization', 'x-luvani-installation', DRILL_USER_HEADER, DRILL_REFERENCE_HEADER]) {
      assert.ok(allowed.includes(name), `the preflight does not allow ${name}`);
    }
  });

  test('the route is wired to the handler behind the scoring limits', () => {
    const route = serverSource.indexOf("url.pathname === '/drill/score'");
    assert.ok(route > 0, 'POST /drill/score is not wired');
    const block = serverSource.slice(route, serverSource.indexOf("url.pathname === '/drill/judge'", route));
    assert.match(block, /handleDrillScore\(req, res,/);
    assert.match(block, /RATE_LIMITS\.scoringIp/);
    assert.match(block, /RATE_LIMITS\.scoringUser/);
    assert.match(block, /RATE_LIMITS\.scoringInstallation/);
    assert.match(block, /scoreUtterance\(request,\s*\{timeoutMs:10000,signal/);
    assert.match(block, /decodeAudio\(request\.audio,\{signal\}\)/);
    assert.match(block, /paid\.apiTransport\(user,'api-score',signal\)/);
    assert.doesNotMatch(block, /searchParams/, 'the server reads the learner or the line from the URL again');
  });
});
