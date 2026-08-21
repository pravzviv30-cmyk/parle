/**
 * A real, microphone-free trip through the local tutor stack.
 *
 * This deliberately uses a fresh synthetic learner and an empty profile. It
 * proves token minting, LiveKit dispatch, the data protocol and the configured
 * model without reading or changing a developer's account.
 *
 *   npm run smoke:tutor
 */

import assert from 'node:assert/strict';

import { Room, RoomEvent, dispose } from '@livekit/rtc-node';
import { decodeServerMessage, encodeMessage, TOPIC_CLIENT, TOPIC_SERVER } from '@parle/core';

const tokenServer = process.env.PARLE_TOKEN_SERVER ?? 'http://127.0.0.1:8787';
const topic = 'speaking with my teacher at school about an assignment I do not understand';
const englishAttempt = 'I do not understand the homework and I need help.';
const smokeStartedAt = performance.now();

/** Wait for one matching server message, including one that already arrived. */
function messageInbox() {
  const messages = [];
  const listeners = new Set();
  return {
    messages,
    push(message) {
      messages.push(message);
      for (const listener of listeners) listener();
    },
    waitFor(predicate, after = 0, timeoutMs = 35_000) {
      return new Promise((resolve, reject) => {
        const inspect = () => {
          const found = messages.slice(after).find(predicate);
          if (found === undefined) return;
          clearTimeout(deadline);
          listeners.delete(inspect);
          resolve(found);
        };
        const deadline = setTimeout(() => {
          listeners.delete(inspect);
          reject(new Error(`Tutor smoke test timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        listeners.add(inspect);
        inspect();
      });
    },
  };
}

const response = await fetch(`${tokenServer}/session/start`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    userId: `codex-smoke-${Date.now()}`,
    lessonId: 'cafe-01',
    mode: 'convo-text',
  }),
});
if (!response.ok) throw new Error(`token server returned ${response.status}: ${await response.text()}`);
const grant = await response.json();
const tokenReadyAt = performance.now();
assert.equal(typeof grant.token, 'string');
assert.equal(typeof grant.livekitUrl, 'string');

const room = new Room();
const inbox = messageInbox();
room.on(RoomEvent.DataReceived, (payload, _participant, _kind, wireTopic) => {
  if (wireTopic !== TOPIC_SERVER) return;
  const message = decodeServerMessage(payload);
  if (message !== null) inbox.push(message);
});

const send = async (message) => {
  assert.ok(room.localParticipant, 'local participant is connected');
  await room.localParticipant.publishData(encodeMessage(message), { topic: TOPIC_CLIENT, reliable: true });
};

try {
  await room.connect(grant.livekitUrl, grant.token);
  const connectedAt = performance.now();
  await send({ t: 'ready' });

  const opening = await inbox.waitFor((message) => message.t === 'opening');
  const openingAt = performance.now();
  assert.match(opening.prompt.en, /what.*talk|talk.*about|scenario|practi[cs]e/i);

  const beforeScene = inbox.messages.length;
  await send({ t: 'say', text: topic });
  const scene = await inbox.waitFor((message) => message.t === 'convo', beforeScene);
  const sceneAt = performance.now();
  assert.equal(scene.view.supportView.kind, 'none', 'the opening must not reveal a hint or answer');
  assert.ok(scene.view.narration, 'the requested scenario has an opening narration');
  assert.ok(scene.view.sceneReply.fr.trim().length > 0, 'the teacher starts in French');

  const beforeAttempt = inbox.messages.length;
  await send({ t: 'say', text: englishAttempt });
  const coached = await inbox.waitFor((message) => message.t === 'convo', beforeAttempt);
  const coachedAt = performance.now();
  const recast = coached.view.coachNow.find((item) => item.kind === 'english-to-french');
  assert.ok(recast, 'an English attempt earns an English-to-French recast after the attempt');
  assert.ok(recast.better.trim().length > 0, 'the recast includes natural French');
  assert.equal(coached.view.supportView.kind, 'none', 'feedback must not pre-fill the learner\'s next reply');

  console.log('Tutor smoke test passed');
  console.log(`  topic kept: ${scene.view.beat.goalEn}`);
  console.log(`  teacher opened: ${scene.view.sceneReply.fr}`);
  console.log(`  correction after attempt: ${recast.better}`);
  const openTotal = openingAt - smokeStartedAt;
  const timing = (name, ms) => console.log(`  ${name}: ${Math.round(ms)} ms (${Math.round((ms / openTotal) * 100)}% of session open)`);
  console.log('Session-open network events');
  timing('token server', tokenReadyAt - smokeStartedAt);
  timing('LiveKit connect', connectedAt - tokenReadyAt);
  timing('agent opening', openingAt - connectedAt);
  console.log(`Action round trips\n  topic to scene: ${Math.round(sceneAt - openingAt)} ms\n  attempt to coaching: ${Math.round(coachedAt - sceneAt)} ms`);
} finally {
  if (room.isConnected) {
    await send({ t: 'leave' }).catch(() => {});
    await room.disconnect();
  }
  dispose();
}
