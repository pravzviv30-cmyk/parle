import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

const server = readFileSync(path.join(import.meta.dirname, 'server.ts'), 'utf8');
const agent = readFileSync(path.resolve(import.meta.dirname, '..', '..', 'tutor-agent', 'src', 'agent.ts'), 'utf8');

describe('session lifecycle wiring — infrastructure must have callsites', () => {
  test('a successful start atomically acquires the learner lease before returning the token', () => {
    const acquire = server.indexOf('sessionLeases.acquire(');
    const response = server.indexOf('return json(res, 200, { ...result.grant, livekitUrl }');
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
