/**
 * F152 — the lease a learner can give back.
 *
 * A grant takes a thirty-minute lease so one account cannot run two sessions at
 * once. Only /session/end returns it, and only the tutor agent calls that, so an
 * agent that never joins leaves the lease standing and the learner is refused
 * their own next attempt by a session that never happened.
 *
 * Two halves, and both are needed. The store half runs the real
 * `MemorySessionLeaseStore` to prove that a matched release is what unsticks the
 * next start and that an unmatched one is not. The source half pins the endpoint
 * to that mechanism, because server.ts boots as it is imported — it reads the
 * environment, exits on missing configuration and binds a port — so there is no
 * honest way to call the handler in process. That is the same bargain
 * serverSecurityContract.test.ts strikes over the debit path.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import { MemorySessionLeaseStore, privateSignal } from './rateLimit.ts';

const server = readFileSync(path.join(import.meta.dirname, 'server.ts'), 'utf8');

/** The body of one endpoint in the router-free `if` chain, up to the next one. */
function handler(pathname: string): string {
  const opens = server.indexOf(`url.pathname === '${pathname}'`);
  assert.ok(opens > 0, `there is no ${pathname} handler in server.ts`);
  const next = [server.indexOf('\n    if (req.method', opens), server.indexOf('\n    return json(res, 404', opens)]
    .filter((at) => at > 0)
    .sort((a, b) => a - b)[0];
  assert.ok(next !== undefined && next > opens, `the ${pathname} handler has no end`);
  return server.slice(opens, next);
}

const HALF_AN_HOUR = 30 * 60;
const SALT = 'a'.repeat(48);

describe('a learner whose tutor never turned up is not locked out by their own lease', () => {
  test('an abandoned grant releases the lease so the next start succeeds', async () => {
    const leases = new MemorySessionLeaseStore();
    const learner = privateSignal(SALT, 'user', 'learner-a');
    const stranger = privateSignal(SALT, 'user', 'learner-b');
    const grant = '8c4b2d1e-5f6a-4b3c-9d8e-1a2b3c4d5e6f';
    const nextGrant = '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d';

    assert.equal(await leases.acquire(learner, grant, HALF_AN_HOUR), true, 'the start takes the lease');
    assert.equal(
      await leases.acquire(learner, nextGrant, HALF_AN_HOUR),
      false,
      'this is the half-hour lockout: the learner taps Back, tries again, and is refused by a session that never began',
    );

    // Somebody else's abandon frees nothing, in either of the two ways it could
    // be somebody else's. The account is one lock and the sessionId is the
    // other, and the second is the one that holds when the first cannot.
    await leases.release(stranger, grant);
    assert.equal(
      await leases.acquire(learner, nextGrant, HALF_AN_HOUR),
      false,
      'a lease is freed by the account that holds it or not at all',
    );
    await leases.release(learner, '00000000-0000-4000-8000-000000000000');
    assert.equal(
      await leases.acquire(learner, nextGrant, HALF_AN_HOUR),
      false,
      'the sessionId match is what stops a caller freeing a lease that is not the one they were granted',
    );

    // And the abandon itself, which is the whole point.
    await leases.release(learner, grant);
    assert.equal(
      await leases.acquire(learner, nextGrant, HALF_AN_HOUR),
      true,
      'the learner tries again and gets a session instead of half an hour of nothing',
    );

    // Now the endpoint, held to exactly that mechanism.
    const abandon = handler('/session/abandon');

    assert.match(
      abandon,
      /sessionLeases\.release\(privateSignal\(rateLimitSalt, 'user', userId\), sessionId\)/,
      'the key comes from the caller the auth layer verified and the release is matched on the sessionId, which is what stops one caller freeing another’s lease',
    );
    assert.match(abandon, /const userId = resolved\.userId/, 'userId must be the resolved caller, never a value read back out of the body');
    assert.match(abandon, /users\.resolve\(req\.headers\.authorization/, 'this one is client-callable, so it is authenticated as the account');
    assert.ok(
      abandon.indexOf('users.resolve(') < abandon.indexOf('sessionLeases.release('),
      'nothing is released before the caller is known',
    );

    // The agent secret is the wrong door. It authenticates the debit path, and a
    // client that held it would hold that too.
    assert.doesNotMatch(abandon, /agentDebitAllowed|x-parle-agent|AGENT_SECRET/, 'an agent-authenticated abandon could not be called by the learner who needs it');

    // Releases only. Every one of these would be a second thing this endpoint
    // does, and a client-callable endpoint that debits or mints is a different
    // and much worse endpoint.
    for (const forbidden of ['store.consume', 'store.claimTrial', 'store.get', 'grantSession', 'sessionLeases.acquire', 'secondsRemaining']) {
      assert.ok(!abandon.includes(forbidden), `/session/abandon must never ${forbidden}: it releases a lease and does nothing else`);
    }

    // Validated before it is allowed to act, and refused before the release runs
    // rather than after it.
    assert.match(abandon, /sessionIdPattern\.test\(sessionId\)/, 'the sessionId is checked against the same shape the debit path insists on');
    assert.ok(
      abandon.indexOf("json(res, 400, { error: 'sessionId is required' })") < abandon.indexOf('sessionLeases.release('),
      'an unshaped sessionId is refused before anything is released',
    );

    // One definition of what a session id is. Two endpoints now decide something
    // on the strength of it, and a shape checked on only one of them is a shape
    // that will drift.
    assert.equal(
      (server.match(/\^\[0-9a-f\]\{8\}/g) ?? []).length,
      1,
      'the session id shape is declared once and shared, not copied per endpoint',
    );
    assert.match(handler('/session/end'), /sessionIdPattern\.test\(sessionId\)/, 'the debit path still checks the same shape');
  });

  test('abandoning is budgeted like the start it follows', async () => {
    const abandon = handler('/session/abandon');

    // No new rule, and not the debit budget either. An abandon can only follow a
    // start, so the session budget already bounds how often it can be reached,
    // and a caller cannot free leases faster than it can be granted them.
    assert.match(abandon, /ipCheck\(req, RATE_LIMITS\.sessionIp\)/, 'the per-address session budget still applies before any body is read');
    assert.match(abandon, /\[RATE_LIMITS\.sessionUser, 'user', userId\]/, 'and the per-account one applies once the caller is known');
    assert.doesNotMatch(abandon, /RATE_LIMITS\.debit/, 'this endpoint does not debit, so it must not borrow the budget named for debiting');
    assert.ok(
      abandon.indexOf('withinLimits(') < abandon.indexOf('readJson('),
      'the address budget is spent before the body is read, as it is on every other endpoint here',
    );

    // The answer says nothing about whether a lease was there. A 404 for "no
    // such lease" would make this an oracle for whether an account has a session
    // open, and there is nobody it would help.
    assert.match(abandon, /return json\(res, 200, \{ ok: true \}\)/, 'the same honest answer whichever way the store went');
    assert.doesNotMatch(abandon, /json\(res, 404/, 'a missing lease is not an error the learner did anything about');
    assert.doesNotMatch(abandon, /released: true/, 'the store’s release reports nothing back, so claiming a release happened would be inventing the fact');
  });
});
