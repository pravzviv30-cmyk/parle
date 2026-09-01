/**
 * What the gate can honestly check about a live harness.
 *
 * The harness itself talks to LiveKit, spawns three processes and takes ninety
 * seconds, so it is not a unit test and must never become one — a suite that
 * dials a vendor is a suite that goes red when a vendor has a bad afternoon.
 * What *is* checkable here is the harness's honesty: that its inventory is
 * complete, that a check which did not run cannot read as one that passed, that
 * the allowance it seeds really does land the agent's hard stop inside the
 * budget, and that nothing it prints is a credential.
 *
 * The live numbers live in the run output and in the evidence matrix. These
 * tests exist so that a green gate cannot be mistaken for a green run.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { MIN_VIABLE_SESSION_SEC } from '@luvani/core';
import {
  HARD_STOP_CEILING_SEC,
  LIFECYCLE_CHECKS,
  LIVE_BUDGET_SEC,
  estimateVendorSpend,
  foreignAgentWorkers,
  grantedHardStopFloorSec,
  parseOptions,
  redactCredentials,
  refuseForeignWorker,
  seedForHardStop,
  summariseRun,
  ttlSecondsOf,
  type CheckResult,
} from './voiceLifecycle.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const HARNESS_SOURCE = readFileSync(join(HERE, 'voiceLifecycle.ts'), 'utf8');
const AGENT_SOURCE = readFileSync(resolve(HERE, '..', 'agent.ts'), 'utf8');

/** A run in which every check answered the way a clean run answers. */
function cleanRun(): CheckResult[] {
  return LIFECYCLE_CHECKS.map((check) => ({
    id: check.id,
    status: check.kind === 'assert' ? ('pass' as const) : ('recorded' as const),
    ms: 10,
    detail: 'measured',
  }));
}

/**
 * The code inside a snippet, with the prose taken out.
 *
 * Naming a credential's env var in a blocked message is the point of a blocked
 * message; interpolating its value is the leak. So string literals are dropped
 * and only the expressions survive — the `${...}` holes in a template and the
 * bare arguments beside it.
 */
function expressionsIn(snippet: string): string {
  let out = '';
  for (let i = 0; i < snippet.length; i += 1) {
    const ch = snippet[i]!;
    if (ch === "'" || ch === '"') {
      for (i += 1; i < snippet.length; i += 1) {
        if (snippet[i] === '\\') i += 1;
        else if (snippet[i] === ch) break;
      }
      continue;
    }
    if (ch === '`') {
      for (i += 1; i < snippet.length; i += 1) {
        if (snippet[i] === '\\') {
          i += 1;
          continue;
        }
        if (snippet[i] === '`') break;
        if (snippet[i] === '$' && snippet[i + 1] === '{') {
          let depth = 0;
          const start = i + 2;
          for (i += 1; i < snippet.length; i += 1) {
            if (snippet[i] === '{') depth += 1;
            else if (snippet[i] === '}') {
              depth -= 1;
              if (depth === 0) break;
            }
          }
          out += ` ${snippet.slice(start, i)} `;
        }
      }
      continue;
    }
    out += ch;
  }
  return out;
}

/** Every `console.*` call in the harness, with its arguments, brackets balanced. */
function consoleCalls(source: string): string[] {
  const calls: string[] = [];
  let index = source.indexOf('console.');
  while (index >= 0) {
    const open = source.indexOf('(', index);
    if (open < 0) break;
    let depth = 0;
    let end = open;
    for (; end < source.length; end += 1) {
      if (source[end] === '(') depth += 1;
      else if (source[end] === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    calls.push(source.slice(open, end + 1));
    index = source.indexOf('console.', end + 1);
  }
  return calls;
}

describe('voice lifecycle harness', () => {
  it('the voice lifecycle harness fails the run when any lifecycle check is skipped', () => {
    assert.equal(summariseRun(cleanRun()).ok, true, 'a run where everything answered must be clean');

    for (const check of LIFECYCLE_CHECKS) {
      const skipped = cleanRun().map((result) =>
        result.id === check.id ? { ...result, status: 'skipped' as const, detail: 'no credential' } : result,
      );
      const summary = summariseRun(skipped);
      assert.equal(summary.ok, false, `${check.id} skipped must fail the run`);
      assert.equal(summary.skipped, 1);
      assert.ok(
        summary.reasons.some((reason) => reason.includes(check.id) && reason.includes('skipped')),
        `the reason must name ${check.id}`,
      );

      // Never running at all is the same lie told more quietly.
      const absent = cleanRun().filter((result) => result.id !== check.id);
      const absentSummary = summariseRun(absent);
      assert.equal(absentSummary.ok, false, `${check.id} missing must fail the run`);
      assert.ok(absentSummary.reasons.some((reason) => reason.includes(`${check.id} never ran`)));
    }
  });

  it('the harness seeds an allowance that lands the hard stop inside ninety seconds', () => {
    const seed = seedForHardStop();
    assert.equal(seed.maximumSessionSec, Math.min(HARD_STOP_CEILING_SEC, seed.allowanceSec));
    assert.ok(seed.maximumSessionSec <= 90, `seeded hard stop is ${seed.maximumSessionSec}s, over ninety`);
    assert.ok(seed.maximumSessionSec >= 60, `seeded hard stop is ${seed.maximumSessionSec}s, too short to tell a stall from a stop`);
    assert.ok(seed.maximumSessionSec <= LIVE_BUDGET_SEC);

    // The seed has to leave the room time to publish the summary, debit and
    // close, or the run measures a timeout instead of a hard stop.
    assert.ok(seed.allowanceSec + 20 <= LIVE_BUDGET_SEC, 'no room left in the budget for the session to end in');

    // A tighter budget shortens the allowance rather than blowing through it.
    for (const budget of [40, 60, 90, 120, 900]) {
      const tighter = seedForHardStop(budget);
      assert.ok(tighter.allowanceSec <= budget, `budget ${budget}s produced a ${tighter.allowanceSec}s allowance`);
      assert.ok(tighter.allowanceSec >= 1);
      assert.equal(tighter.maximumSessionSec, Math.min(HARD_STOP_CEILING_SEC, tighter.allowanceSec));
    }
  });

  it('the seeded hard stop is computed the way the agent computes it', () => {
    // If agent.ts changes its ceiling, the harness is seeding against a timer
    // that no longer exists and would still report a confident number.
    assert.match(AGENT_SOURCE, /maximumSessionSec = Math\.min\(15 \* 60, allowanceRemaining\)/);
    assert.match(AGENT_SOURCE, /}, maximumSessionSec \* 1_000\);/);
    assert.equal(HARD_STOP_CEILING_SEC, 15 * 60);
  });

  it('a real session grant cannot carry a hard stop shorter than the minimum viable session', () => {
    // Why the harness forges the metadata instead of asking for a short grant.
    assert.equal(grantedHardStopFloorSec(), MIN_VIABLE_SESSION_SEC);
    assert.ok(
      grantedHardStopFloorSec() > seedForHardStop().maximumSessionSec,
      'if a grant could go this low the harness should stop forging and just ask for one',
    );
  });

  it('the inventory names every lifecycle area exactly once', () => {
    const ids = LIFECYCLE_CHECKS.map((check) => check.id);
    assert.equal(new Set(ids).size, ids.length, 'a duplicated id would let one check answer for two');
    for (const area of [
      'insecure-livekit-url-refused-in-production',
      'join-token-expiry',
      'room-participant-cap',
      'concurrent-session-start-conflict',
      'lease-released-after-debit',
      'agent-secret-guards-the-debit',
      'used-room-debits-exactly-once',
      'never-joined-room-debits-nothing',
      'learner-departure-closes-the-room',
      'hard-stop-closes-a-live-session',
      'unusable-room-is-not-charged',
      'bearer-token-rejoin-inside-ttl',
      'empty-room-holds-the-agent',
    ]) {
      assert.ok(ids.includes(area), `${area} is missing from the inventory`);
    }
    for (const check of LIFECYCLE_CHECKS) {
      assert.ok(check.title.length > 20, `${check.id} needs a title that says what it catches`);
      assert.ok(['token-server', 'livekit', 'agent'].includes(check.needs));
    }
  });

  it('an assertion that comes back with a measurement is not counted as passing', () => {
    const assertion = LIFECYCLE_CHECKS.find((check) => check.kind === 'assert');
    assert.ok(assertion);
    const blurred = cleanRun().map((result) =>
      result.id === assertion.id ? { ...result, status: 'recorded' as const } : result,
    );
    const summary = summariseRun(blurred);
    assert.equal(summary.ok, false);
    assert.ok(summary.reasons.some((reason) => reason.includes('instead of a verdict')));
  });

  it('a measurement is never allowed to claim it passed', () => {
    const measurement = LIFECYCLE_CHECKS.find((check) => check.kind === 'record');
    assert.ok(measurement);
    const overclaimed = cleanRun().map((result) =>
      result.id === measurement.id ? { ...result, status: 'pass' as const } : result,
    );
    const summary = summariseRun(overclaimed);
    assert.equal(summary.ok, false);
    assert.ok(summary.reasons.some((reason) => reason.includes('must not claim')));
  });

  it('a failed check and an unknown check both fail the run', () => {
    const failed = summariseRun(
      cleanRun().map((result, index) => (index === 0 ? { ...result, status: 'fail' as const, detail: 'wrong' } : result)),
    );
    assert.equal(failed.ok, false);
    assert.equal(failed.failed, 1);
    assert.ok(failed.reasons.some((reason) => reason.includes('failed: wrong')));

    const invented = summariseRun([...cleanRun(), { id: 'made-up-check', status: 'pass', ms: 1, detail: 'nope' }]);
    assert.equal(invented.ok, false);
    assert.ok(invented.reasons.some((reason) => reason.includes('not in the inventory')));
  });

  it('the vendor cost record prices tutor-attended seconds and calls self-hosted transport free', () => {
    const attended = estimateVendorSpend({
      agentRoomSec: 90,
      learnerOnlyRoomSec: 40,
      transport: 'self-hosted',
      vendorProbes: 5,
    });
    const idle = estimateVendorSpend({
      agentRoomSec: 0,
      learnerOnlyRoomSec: 40,
      transport: 'self-hosted',
      vendorProbes: 5,
    });
    assert.ok(attended.usd > idle.usd, 'a tutor-attended minute has to cost more than an empty one');
    assert.ok(attended.usd > 0 && Number.isFinite(attended.usd));
    assert.ok(attended.lines.some((line) => line.includes('estimated vendor spend')));
    assert.ok(attended.lines.some((line) => line.includes('upper bound')), 'the record must say it is a ceiling');
    assert.ok(attended.lines.some((line) => line.includes('self-hosted') && line.includes('$0.0000')));

    const cloud = estimateVendorSpend({ agentRoomSec: 90, learnerOnlyRoomSec: 40, transport: 'cloud', vendorProbes: 5 });
    assert.ok(cloud.usd > attended.usd, 'cloud transport is not free');
    assert.ok(cloud.lines.some((line) => line.includes('estimated')));
  });

  it('the cost record cannot print a number a budget cannot read', () => {
    for (const input of [
      { agentRoomSec: 0, learnerOnlyRoomSec: 0, transport: 'self-hosted' as const, vendorProbes: 0 },
      { agentRoomSec: -5, learnerOnlyRoomSec: -5, transport: 'cloud' as const, vendorProbes: -1 },
      { agentRoomSec: 86_400, learnerOnlyRoomSec: 0, transport: 'cloud' as const, vendorProbes: 100 },
    ]) {
      const spend = estimateVendorSpend(input);
      assert.ok(Number.isFinite(spend.usd), `${JSON.stringify(input)} produced ${spend.usd}`);
      assert.ok(spend.usd >= 0);
      for (const line of spend.lines) assert.ok(!line.includes('NaN'), line);
    }
  });

  it('a token expiry is read from the credential without the credential being returned', () => {
    const now = 1_700_000_000_000;
    const claims = Buffer.from(JSON.stringify({ exp: now / 1_000 + 300 }), 'utf8').toString('base64url');
    assert.equal(ttlSecondsOf(`header.${claims}.signature`, now), 300);
    assert.throws(() => ttlSecondsOf('not-a-token'), /not a signed token|token carries no expiry/);
    const noExpiry = Buffer.from(JSON.stringify({ sub: 'x' }), 'utf8').toString('base64url');
    assert.throws(() => ttlSecondsOf(`header.${noExpiry}.signature`), /carries no expiry/);
  });

  it('the harness never prints a key, a secret or a signed token', () => {
    const banned = [
      'apiSecret',
      'agentSecret',
      'toJwt',
      'carry.token',
      'granted.body.token',
      'LIVEKIT_API_SECRET',
      'LUVANI_AGENT_SECRET',
      'SERVICE_ROLE',
      'process.env',
    ];
    const calls = consoleCalls(HARNESS_SOURCE);
    assert.ok(calls.length > 5, 'the harness is supposed to print its findings');
    for (const call of calls) {
      const code = expressionsIn(call);
      for (const needle of banned) {
        assert.ok(!code.includes(needle), `a console call interpolates ${needle}: ${call.slice(0, 120)}`);
      }
    }
    // The sanitiser has to be able to see a leak, or this test proves nothing.
    assert.ok(expressionsIn('(`url ${live.apiSecret} here`)').includes('apiSecret'));
    assert.ok(!expressionsIn("('needs LIVEKIT_API_SECRET')").includes('LIVEKIT_API_SECRET'));
    // And the secrets it does hold are generated per run, never read from a file.
    assert.match(HARNESS_SOURCE, /apiSecret = randomBytes\(/);
    assert.match(HARNESS_SOURCE, /agentSecret = randomBytes\(/);
  });

  it('a signed token quoted back by a vendor is redacted before it is printed', () => {
    // Verbatim shape of what LiveKit returns for an expired credential: the
    // rejection carries the whole credential, so the reason a join failed is
    // not safe to print until it has been through here.
    const jwt =
      'eyJhbGciOiJIUzI1NiJ9.eyJ2aWRlbyI6eyJyb29tIjoicGFybGUtdmVyaWZ5In0sImlzcyI6InB2YiJ9.xzQIiCS5UiyHuL0Mi9Ky8o2e'; // luvani-secret-scan: allow — fabricated fixture, not an issued credential
    const vendor = `engine: signal failure: client error: 401 Unauthorized - invalid token: ${jwt}, error: token is expired`;
    const clean = redactCredentials(vendor);
    assert.ok(!clean.includes(jwt), 'the credential survived redaction');
    assert.ok(!clean.includes('eyJ'), 'no part of a signed token may reach the output');
    assert.match(clean, /<redacted signed token>/);
    // The information that makes the line worth printing has to survive.
    assert.match(clean, /401 Unauthorized/);
    assert.match(clean, /token is expired/);
    assert.equal(redactCredentials('engine: handshake error: 500 Internal Server Error').includes('redacted'), false);

    // Every string the harness reports goes through it.
    assert.match(HARNESS_SOURCE, /detail: redactCredentials\(outcome\.detail\)/);
    assert.match(HARNESS_SOURCE, /live\.records\.push\(redactCredentials\(line\)\)/);
  });

  it('a tutor worker the harness did not start is spotted in the process table', () => {
    const ps = [
      '  501 /bin/zsh -l',
      ' 1234 node --experimental-strip-types src/agent.ts dev',
      ' 4321 node --experimental-strip-types services/tutor-agent/src/agent.ts start',
      ' 5555 node --experimental-strip-types src/server.ts',
      ' 6666 grep agent.ts',
    ].join('\n');
    assert.deepEqual(foreignAgentWorkers(ps), ['pid 1234', 'pid 4321']);
    assert.deepEqual(foreignAgentWorkers(ps, [1234, 4321]), [], 'workers this run started are not foreign');
    assert.deepEqual(foreignAgentWorkers(''), []);
  });

  it('a foreign tutor worker only blocks the run when it shares this run\'s LiveKit', () => {
    const foreign = ['pid 4321'];
    const shared = { agent: 'spawn' as const, transport: 'env' as const, allowForeignAgent: false };
    const refusal = refuseForeignWorker(shared, foreign);
    assert.ok(refusal, 'a second worker on one server has to stop the run');
    assert.match(refusal, /pid 4321/);
    assert.match(refusal, /coin toss/);

    // The private server this harness starts is invisible to that worker, so
    // isolation, not refusal, is the default answer.
    assert.equal(refuseForeignWorker({ ...shared, transport: 'spawn' }, foreign), null);
    assert.equal(refuseForeignWorker({ ...shared, agent: 'none' }, foreign), null);
    assert.equal(refuseForeignWorker({ ...shared, allowForeignAgent: true }, foreign), null);
    assert.equal(refuseForeignWorker(shared, []), null);
  });

  it('the harness defaults to opening every process it measures', () => {
    const defaults = parseOptions([]);
    assert.equal(defaults.agent, 'spawn');
    assert.equal(defaults.transport, 'spawn');
    assert.equal(defaults.mode, 'lesson-text');
    assert.equal(defaults.allowForeignAgent, false);
    assert.equal(defaults.budgetSec, LIVE_BUDGET_SEC);

    const narrowed = parseOptions(['--agent=none', '--transport', 'env', '--mode=lesson', '--allow-foreign-agent', '--budget=45']);
    assert.equal(narrowed.agent, 'none');
    assert.equal(narrowed.transport, 'env');
    assert.equal(narrowed.mode, 'lesson');
    assert.equal(narrowed.allowForeignAgent, true);
    assert.equal(narrowed.budgetSec, 45);

    // Nonsense never silently widens the budget.
    assert.equal(parseOptions(['--budget=abc']).budgetSec, LIVE_BUDGET_SEC);
    assert.equal(parseOptions(['--budget=-9']).budgetSec, LIVE_BUDGET_SEC);
  });

  it('running without a tutor worker skips the agent checks by name and fails the run', () => {
    const withoutAgent = LIFECYCLE_CHECKS.map((check) =>
      check.needs === 'agent'
        ? { id: check.id, status: 'skipped' as const, ms: 0, detail: 'the run was started with --agent none' }
        : { id: check.id, status: check.kind === 'assert' ? ('pass' as const) : ('recorded' as const), ms: 1, detail: 'measured' },
    );
    const summary = summariseRun(withoutAgent);
    assert.equal(summary.ok, false, '--agent none must never report a clean run');
    assert.equal(summary.skipped, LIFECYCLE_CHECKS.filter((check) => check.needs === 'agent').length);
    assert.ok(summary.skipped >= 3, 'the hard stop, the unusable room and the empty-room hold all need a worker');
    for (const reason of summary.reasons) assert.match(reason, /--agent none/);
  });
});
