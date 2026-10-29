/**
 * A rebuild the app caused itself (Speak in a typed start, F903) asks for a
 * new grant while its own typed session is still closing: the token server
 * answers 409 until the old agent has debited. That is not another device.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { OWN_LEASE_BACKOFF_MS, OWN_LEASE_CLOSING, ownLeaseRetry } from './ownLease.ts';
import { classifyFailure, failureCopy, TokenServerError } from './failure.ts';

const read = (r: string): string => readFileSync(new URL(r, import.meta.url), 'utf8');

describe('switching waits for its own lease — F903', () => {
  test('switching to voice waits for its own typed session to close instead of reporting another device', () => {
    // About twenty seconds, in growing steps.
    assert.deepEqual(OWN_LEASE_BACKOFF_MS, [1000, 2000, 3000, 4000, 5000, 5000]);
    const total = OWN_LEASE_BACKOFF_MS.reduce((a, b) => a + b, 0);
    assert.ok(total >= 15_000 && total <= 25_000);
    // Its own rebuild, refused as already active: wait and ask again, for the whole window.
    OWN_LEASE_BACKOFF_MS.forEach((ms, attempt) => assert.equal(ownLeaseRetry({ status: 409, ownRebuild: true, attempt }), ms));
    assert.equal(ownLeaseRetry({ status: 409, ownRebuild: true, attempt: OWN_LEASE_BACKOFF_MS.length }), null, 'the wait never ends');
    // An ordinary start keeps today's answer: a 409 there can really be another device.
    assert.equal(ownLeaseRetry({ status: 409, ownRebuild: false, attempt: 0 }), null);
    for (const status of [200, 402, 429, 500]) assert.equal(ownLeaseRetry({ status, ownRebuild: true, attempt: 0 }), null);

    // Run out, and the learner is told the truth, never "another device".
    assert.equal(classifyFailure(new TokenServerError(409, 'own-session-closing')), 'own-session-closing');
    assert.equal(classifyFailure(new TokenServerError(409)), 'session-elsewhere');
    assert.deepEqual(OWN_LEASE_CLOSING, { title: 'Still closing your typed session', body: 'Give it a moment, then tap Try again.', retry: 'Try again', leave: 'Leave' });
    assert.doesNotMatch(failureCopy('own-session-closing').message, /another device|—/);

    // The hook retries inside the start, behind the generation guard, and the switch asks for it.
    const hook = read('./useLiveSession.ts');
    assert.match(hook, /const wait = ownLeaseRetry\(\{ status: res\.status, ownRebuild: ownLeaseRetryRef\.current, attempt \}\);/);
    assert.match(hook, /await new Promise\(\(resolve\) => setTimeout\(resolve, wait\)\);\s*if \(await abandoned\(\)\) return;/);
    assert.match(hook, /throw new TokenServerError\(409, 'own-session-closing'\)/);
    // It never cancels the closing session by id: that would disturb the typed agent's own settlement.
    const rebuild = hook.slice(hook.indexOf('const leaveForRebuild = useCallback('), hook.indexOf('}, [leave]);', hook.indexOf('const leaveForRebuild = useCallback(')));
    assert.match(rebuild, /ownLeaseRetryRef\.current = true;\s*await leave\(\);\s*$/);
    assert.doesNotMatch(rebuild, /abandonSession/);
    const screen = read('../ConvoScreen.tsx');
    assert.match(screen, /void live\.leaveForRebuild\(\)\.finally\(/, 'the switch tears down as an ordinary leave, so its own 409 reads as another device');
    assert.match(screen, /live\.status\.failure === 'own-session-closing'/);
    assert.match(screen, /<OwnLeaseClosing onRetry=\{live\.start\} onLeave=\{leaveNow\} \/>/);
  });
});
