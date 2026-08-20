/**
 * The brain does not have to come from one place.
 *
 * routing.ts already splits calls by who is waiting: a realtime turn is on a
 * sub-second budget because the learner is standing in the silence it leaves,
 * while extraction, curation and drill authoring run once, after the session,
 * with nobody waiting at all. That difference is large enough that the two
 * halves can sensibly come from different providers, and this is where that is
 * pinned down.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { MockLlmClient } from './mock.ts';
import { SplitBrainClient } from './split.ts';
import { buildSystemBlocks } from '../prompt/system.ts';

const blocks = () => buildSystemBlocks();

/** Two mocks that can be told apart by which one recorded the call. */
function split() {
  const realtime = new MockLlmClient();
  const considered = new MockLlmClient();
  return { realtime, considered, client: new SplitBrainClient({ realtime, considered }) };
}

describe('SplitBrainClient — who answers what', () => {
  test('the realtime turn never goes to the command line brain', async () => {
    // The measurement behind this: `claude -p` costs between eight and nine
    // seconds a call, almost all of it process startup, against a turn budget
    // of well under a second. A tutor that pauses nine seconds after every
    // sentence is not a slow tutor, it is a broken one.
    const { realtime, considered, client } = split();

    await client.turn({ kind: 'turn', system: blocks(), messages: [{ role: 'user', text: 'Bonjour' }] });

    assert.equal(realtime.turnRequests.length, 1, 'the fast half answered');
    assert.equal(considered.turnRequests.length, 0, 'and the slow half was not asked');
  });

  test('the post-session calls go to Claude while the turn goes to Groq', async () => {
    const { realtime, considered, client } = split();

    await client.turn({ kind: 'turn', system: blocks(), messages: [] });
    await client.frame({ kind: 'frame', system: blocks(), request: 'a café' });
    await client.extract({ kind: 'extract', system: blocks(), request: 'what did we learn' });
    await client.curate({ kind: 'curate', system: blocks(), request: 'what is worth keeping' });
    await client.drills({ kind: 'drills', system: blocks(), request: 'author drills' });

    assert.equal(realtime.turnRequests.length, 1, 'turn is realtime');
    assert.equal(realtime.frameRequests.length, 1, 'so is the scene, the learner waits behind the bridge line');
    assert.equal(considered.extractRequests.length, 1, 'memory is considered');
    assert.equal(considered.curateRequests.length, 1, 'so is curation');
    assert.equal(considered.drillsRequests.length, 1, 'so is drill authoring');

    assert.equal(considered.turnRequests.length, 0);
    assert.equal(considered.frameRequests.length, 0);
    assert.equal(realtime.extractRequests.length, 0);
    assert.equal(realtime.curateRequests.length, 0);
    assert.equal(realtime.drillsRequests.length, 0);
  });

  test('the split matches the latency line routing.ts already draws', async () => {
    // If routing ever moves an activity across the waiting/not-waiting line,
    // this is the test that should be reconsidered with it rather than around it.
    const { realtime, considered, client } = split();
    for (const call of [
      () => client.turn({ kind: 'turn', system: blocks(), messages: [] }),
      () => client.frame({ kind: 'frame', system: blocks(), request: 'x' }),
      () => client.extract({ kind: 'extract', system: blocks(), request: 'x' }),
      () => client.drills({ kind: 'drills', system: blocks(), request: 'x' }),
      () => client.curate({ kind: 'curate', system: blocks(), request: 'x' }),
    ]) {
      await call();
    }
    const realtimeCalls = realtime.turnRequests.length + realtime.frameRequests.length;
    const consideredCalls = considered.extractRequests.length + considered.drillsRequests.length + considered.curateRequests.length;
    assert.equal(realtimeCalls, 2, 'exactly the two a learner waits through');
    assert.equal(consideredCalls, 3, 'exactly the three that run once with nobody waiting');
  });

  test('usage is reported by whichever half actually answered', async () => {
    const { client } = split();
    const { usage } = await client.turn({ kind: 'turn', system: blocks(), messages: [] });
    assert.equal(typeof usage.inputTokens, 'number', 'usage still crosses the seam intact');
  });
});
