import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

const server = readFileSync(path.join(import.meta.dirname, 'server.ts'), 'utf8');
const agent = readFileSync(path.resolve(import.meta.dirname, '..', '..', 'tutor-agent', 'src', 'agent.ts'), 'utf8');

describe('local mock identity wiring', () => {
  test('the resolver receives both sides of the exact non-production local opt-in', () => {
    assert.match(
      server,
      /createUserResolver\(\{[\s\S]*nodeEnv: process\.env\.NODE_ENV,[\s\S]*localDevelopment: process\.env\.LUVANI_LOCAL_DEVELOPMENT,[\s\S]*\}\)/,
      'server construction can no longer distinguish explicit local development from production',
    );
  });
});

describe('session lifecycle wiring — infrastructure must have callsites', () => {
  test('a successful start atomically acquires the learner lease before returning the token', () => {
    const acquire = server.indexOf('sessionLeases.acquire(');
    const response = server.indexOf('return json(res, 200, { ...result.grant, livekitUrl, plans: PLANS }');
    assert.ok(acquire > 0 && response > acquire);
    assert.match(server, /409,[\s\S]*session already active/);
  });

  test('the matching session id is required for debit and releases only after consumption', () => {
    const consume = server.indexOf('store.consume(userId, seconds, sessionId)');
    const release = server.indexOf('sessionLeases.release(', consume);
    assert.ok(consume > 0 && release > consume);
    assert.match(server, /sessionId[\s\S]*\^\[0-9a-f\]/i);
  });

  test('the agent binds identity once, filters data senders and has a real hard stop', () => {
    assert.match(agent, /source\.identity !== tutor\.learnerId/);
    assert.doesNotMatch(agent, /tutor\.learnerId = p\.identity/);
    assert.match(agent, /maximumSessionSec = Math\.min\(15 \* 60, allowanceRemaining\)/);
    assert.match(agent, /setTimeout\([\s\S]*tutor\.finish\(\)\.finally\(\(\) => ctx\.room\.disconnect\(\)\)/);
  });
});

describe('billing endpoint wiring — F248', () => {
  const webhookStart = server.indexOf("url.pathname === '/billing/webhook'");
  const refreshStart = server.indexOf("url.pathname === '/billing/refresh'");
  const webhook = server.slice(webhookStart, refreshStart);

  test('a webhook without the shared secret is refused before anything is read', () => {
    assert.ok(webhookStart > 0, 'the billing webhook route does not exist');
    const auth = webhook.indexOf('webhookAuthorised(');
    const read = webhook.indexOf('readJson(req)');
    assert.ok(auth >= 0 && read > auth, 'the webhook body is read before its shared secret is accepted');
    assert.match(webhook.slice(auth, read), /return json\(res, 401,/);
  });

  test('a replayed webhook is acknowledged without a second vendor fetch', () => {
    const dedupe = webhook.indexOf('store.billingEventComplete(');
    const replay = webhook.indexOf('if (complete)');
    const fetch = webhook.indexOf('refreshSubscriber(');
    assert.ok(dedupe >= 0 && replay > dedupe && fetch > replay);
    assert.match(webhook.slice(replay, fetch), /return json\(res, 200,[\s\S]*replay: true/);
  });

  test('the refresh endpoint authenticates and rate-limits the learner', () => {
    assert.ok(refreshStart > 0, 'the billing refresh route does not exist');
    const refresh = server.slice(refreshStart, server.indexOf('// What the app calls to begin', refreshStart));
    assert.match(refresh, /RATE_LIMITS\.billingRefreshIp/);
    assert.match(refresh, /users\.resolve\(req\.headers\.authorization, null\)/);
    assert.match(refresh, /RATE_LIMITS\.billingRefreshUser/);
    assert.match(refresh, /refreshSubscriber\(resolved\.userId/);
  });

  test('the account export endpoint takes its owner only from authentication and is bounded', () => {
    const pathname = server.indexOf("url.pathname === '/account/export'");
    const start = server.lastIndexOf('if (req.method', pathname);
    const end = server.indexOf("url.pathname === '/events'", pathname);
    assert.ok(start > 0 && end > start, 'the account export route is missing');
    const route = server.slice(start, end);
    assert.match(route, /req\.method === 'GET'/);
    assert.match(route, /RATE_LIMITS\.exportIp/);
    assert.match(route, /users\.resolve\(req\.headers\.authorization, null\)/);
    assert.match(route, /RATE_LIMITS\.exportUser/);
    assert.match(route, /exportRecentlyAuthenticatedAccountData\(supabaseUrl, serviceRoleKey, resolved\.userId, resolved\.authenticatedAt\)/);
    assert.doesNotMatch(route, /searchParams\.get\(['"]userId/);
    assert.doesNotMatch(route, /body\.userId/);
  });
});

describe('revisit source provenance on /conversation-packs/complete', () => {
  const start = server.indexOf("url.pathname === '/conversation-packs/complete'");
  const route = server.slice(start, server.indexOf("url.pathname === '/conversation-packs'", start + 1));

  test('the claimed link is stripped before validation and re-attached only through the owner lookup', () => {
    assert.ok(start > 0, 'the pack completion route does not exist');
    const strip = route.indexOf('withoutRevisionSource(body.pack)');
    const validate = route.indexOf('validConversationPackFor(incoming, userId, sessionId)');
    const verify = route.indexOf('withVerifiedRevisionSource(incoming, claimedSource');
    const lookup = route.indexOf('getConversationPack(supabaseUrl, serviceRoleKey, userId, sourceId)');
    assert.ok(strip > 0 && validate > strip && verify > validate && lookup > verify,
      'the revisit link must be taken off, the pack validated, then the source owner-checked');
  });

  test('both persistence paths store the verified pack, never the raw body', () => {
    assert.match(route, /practiceJobs\(supabaseUrl, serviceRoleKey\)\.receive\(pack, /);
    assert.match(route, /saveConversationPack\(supabaseUrl, serviceRoleKey, pack\)/);
    assert.doesNotMatch(route, /receive\(body\.pack|saveConversationPack\([^)]*body\.pack/);
  });
});


test('every write endpoint carries a rate limit', () => {
  const routes = [...server.matchAll(/if \(req\.method === '(POST|DELETE)' && url\.pathname === '([^']+)'\)/g)];
  assert.ok(routes.length >= 10);
  for (const match of routes) {
    const at = match.index!;
    const end = server.indexOf('if (req.method', at + match[0].length);
    const body = server.slice(at, end < 0 ? undefined : end);
    assert.match(body, /withinLimits\(|handleDrillJudge\(|handleDrillScore\(|handleDrillTranscribe\(/, `${match[2]} has no bounded handler`);
  }
});
