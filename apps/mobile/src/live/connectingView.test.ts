/**
 * The connect wait, and the two screens that draw it.
 *
 * Ceiling, stated plainly: apps/mobile has no renderer (docs/TESTING.md), so
 * the first two tests here call the view model directly and the third reads the
 * two `.tsx` files as text. The source walk cannot prove a pixel landed. It can
 * prove the branch calls the module, renders the module's answer and puts the
 * door inside the same branch, which is precisely the three things that were
 * wrong: the copy was a literal, it never changed, and there was no door.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { TUTOR_VOICES } from '@luvani/core';

import {
  CONNECTING_STAGES,
  CONNECTING_TICK_MS,
  CONNECTING_TITLE,
  LEAVE_LABEL,
  connectingBody,
  connectingTick,
  connectingView,
} from './connectingView.ts';
import { ONE_MOMENT, waitingNote } from '../tutor/waitingView.ts';

const SRC = new URL('..', import.meta.url).pathname;
const read = (name: string) => readFileSync(SRC + name, 'utf8');

/** The connecting branch itself, not merely the file it lives in. */
const branchOf = (source: string, opens: string): string => {
  const from = source.indexOf(opens);
  assert.notEqual(from, -1, `the branch opening "${opens}" is gone; this test is stale`);
  const to = source.indexOf('\n  }\n', from);
  assert.notEqual(to, -1, `the branch at "${opens}" no longer closes at component level`);
  return source.slice(from, to);
};

describe('the wait before the room opens — F151', () => {
  test('the connect wait changes its words as it grows old', () => {
    // The bug: one sentence for up to twenty five seconds, so a slow start and
    // a dead server looked exactly alike. The opening line is unchanged, because
    // at zero seconds nothing has gone wrong.
    assert.equal(connectingView(0).headline, 'Reaching the server…');
    assert.equal(connectingView(2000).headline, connectingView(0).headline, 'the words moved before anything was slow');

    const early = connectingView(0).headline;
    const middle = connectingView(7000).headline;
    const late = connectingView(20000).headline;
    assert.notEqual(middle, early, 'six seconds in, the wait is still saying its first sentence');
    assert.notEqual(late, middle, 'twelve seconds in, the wait has nothing new to say');

    // The last stage is the one a learner reads when this attempt is more likely
    // to fail than to land, so it is the one that names the way out.
    assert.match(late, /leave/i, 'the oldest wait never mentions the door beside it');

    // House copy rules, walked over every stage rather than the one that
    // happened to be written last. No numbers mid-session, no em dash, no
    // remark about how long anybody has been waiting.
    for (const stage of CONNECTING_STAGES) {
      assert.ok(!/\d/.test(stage.headline), `"${stage.headline}" carries a number`);
      assert.ok(!/—/.test(stage.headline), `"${stage.headline}" carries an em dash`);
      assert.ok(stage.headline.length <= 70, `"${stage.headline}" is too long to read on a phone at a glance`);
      assert.ok(
        !/sorry|apolog|unfortunately|still waiting for you|taking (?:so )?long/i.test(stage.headline),
        `"${stage.headline}" apologises or remarks on the wait`,
      );
    }

    // Stage boundaries are read the way a clock produces them, and a clock that
    // returns nonsense reads as the start rather than crashing the branch that
    // is the learner's only way out.
    assert.equal(connectingView(-1).headline, early, 'a clock that ran backwards loses the wait its words');
    assert.equal(connectingView(Number.NaN).headline, early, 'a broken clock blanks the only line on the screen');
    assert.equal(connectingView(Number.MAX_SAFE_INTEGER).headline, late);
  });

  test('every connecting stage keeps a way out', () => {
    // The rule, and the reason this is a view model at all: a stage that could
    // return no door is a stage somebody can add without noticing. There is one
    // way to ask what this state shows, and the answer always carries the door.
    assert.ok(CONNECTING_STAGES.length >= 3, 'the wait no longer stages its copy');
    for (const stage of CONNECTING_STAGES) {
      const view = connectingView(stage.atMs);
      assert.equal(view.leaveLabel, LEAVE_LABEL, `the wait at ${stage.atMs}ms strands the learner`);
      assert.ok(view.headline.length > 0, `the wait at ${stage.atMs}ms says nothing`);
    }
    // Including between stages and beyond the last one, which is where a
    // twenty five second cold start actually sits.
    for (const at of [0, 1, 5999, 6000, 11999, 12000, 25000, 60000]) {
      assert.equal(connectingView(at).leaveLabel, LEAVE_LABEL, `there is no way out ${at}ms in`);
    }

    // The stages are ordered and distinct, so the screen cannot show the same
    // sentence twice and call it progress.
    const heads = CONNECTING_STAGES.map((s) => s.headline);
    assert.equal(new Set(heads).size, heads.length, 'two stages say the same thing');
    for (let i = 1; i < CONNECTING_STAGES.length; i++) {
      assert.ok(CONNECTING_STAGES[i]!.atMs > CONNECTING_STAGES[i - 1]!.atMs, 'the stages are out of order');
    }
  });

  test('a one second tick only redraws when the words change', () => {
    // The screen ticks every second and the copy moves twice. Handing back the
    // previous number is what keeps a twenty five second wait at two renders.
    assert.equal(CONNECTING_TICK_MS, 1000);
    assert.equal(connectingTick(1000, 2000), 1000, 'the same stage still redrew the screen');
    assert.equal(connectingTick(0, 6000), 6000, 'the screen never noticed its words changed');
    assert.equal(connectingTick(6000, 12000), 12000, 'the last stage never arrives');
    assert.equal(connectingTick(12000, 30000), 12000, 'the screen keeps redrawing after the copy has settled');
  });

  test('both live screens draw the connecting wait from the view model, door included', () => {
    for (const [name, file, opens] of [
      ['the lesson', 'LiveSessionScreen.tsx', "if (live.status.phase === 'connecting'"],
      ['the conversation', 'ConvoScreen.tsx', "if (live.status.phase === 'connecting'"],
    ] as const) {
      const source = read(file);
      const body = branchOf(source, opens);

      assert.match(body, /connectingView\(/, `${name} still writes its connect copy into the branch by hand`);
      assert.match(body, /\{connecting\.headline\}/, `${name} draws a line the view model did not give it`);
      assert.doesNotMatch(body, /Reaching the server/, `${name} kept the hard-coded line the view model replaced`);
      assert.match(body, /<RoomWait\b/, `${name} has no shared waiting page`);
      assert.match(body, /leaveLabel=\{connecting\.leaveLabel\}/, `${name} leaves a learner in the connect wait with no door`);
      assert.match(body, /onLeave=\{leaveNow\}/, `${name} draws a door that goes somewhere other than the exit`);
      const page = read('live/RoomWait.tsx');
      assert.match(page, /<GhostButton label=\{leaveLabel\} onPress=\{onLeave\}/, 'the shared waiting page drops the leave action');
      assert.match(page, /accessibilityLiveRegion="polite"/, 'the stage line is never announced');

      // The clock, and the promise that it stops. An interval started in the
      // connecting branch and never cleared outlives the screen.
      assert.match(source, /CONNECTING_TICK_MS/, `${name} invents its own tick instead of the module's`);
      // The handle is captured and named, because `clearInterval(` on its own
      // is satisfied by clearing nothing.
      const handle = source.match(/const (\w+) = setInterval\(/);
      assert.ok(handle, `${name} starts its tick without holding on to it, so nothing can ever stop it`);
      assert.match(
        source,
        new RegExp(`const ${handle![1]!} = setInterval\\([\\s\\S]{0,400}?return \\(\\) => clearInterval\\(${handle![1]!}\\)`),
        `${name} starts a one second tick it never clears, so the timer outlives the screen`,
      );
      assert.match(
        source,
        /connectingTick\(/,
        `${name} redraws itself once a second to show a sentence that has not changed`,
      );
    }
  });

  test('both live screens hand the view model the elapsed clock, not a constant', () => {
    // The test above proves the branch calls the module. It cannot prove what
    // the module is called with, and `connectingView(0)` keeps every one of its
    // assertions green while the learner reads the stage zero sentence for the
    // full twenty five seconds. That is F151 verbatim with a module bolted to
    // the side of it, so the argument is pinned here the way recapWait.test.ts
    // pins its own, and then followed back to the clock that moves it.
    for (const [name, file, opens] of [
      ['the lesson', 'LiveSessionScreen.tsx', "if (live.status.phase === 'connecting'"],
      ['the conversation', 'ConvoScreen.tsx', "if (live.status.phase === 'connecting'"],
    ] as const) {
      const source = read(file);
      const body = branchOf(source, opens);

      // Every call in the branch, so a second one added later cannot quietly be
      // the frozen one.
      const clocks = [...body.matchAll(/connectingView\(([^()]*)\)/g)].map((m) => m[1]!.trim());
      assert.ok(clocks.length > 0, `${name} hands connectingView nothing this test can read; check the branch by hand`);
      assert.equal(new Set(clocks).size, 1, `${name} draws its wait from two different clocks: ${clocks.join(', ')}`);

      const clock = clocks[0]!;
      assert.match(
        clock,
        /^[A-Za-z_$][A-Za-z0-9_$]*$/,
        `${name} draws the wait from connectingView(${clock}), a value that cannot change, so the copy never does`,
      );

      // A name is not a clock. This one has to be state the screen holds, or
      // `const elapsed = 0` passes the check above.
      const held = source.match(new RegExp(`const \\[${clock}, (\\w+)\\] = useState\\(`));
      assert.ok(held, `${name} passes \`${clock}\`, which is not state, so nothing can move it while the learner waits`);
      const setter = held![1]!;

      // And that state has to be set from a real reading of a real clock, once
      // a second, through the module's own tick rather than a number the screen
      // invented.
      const timer = source.match(/setInterval\(([\s\S]*?),\s*CONNECTING_TICK_MS\)/);
      assert.ok(timer, `${name} has no one second tick behind the wait, so the words have nothing to move them`);
      const ticking = timer![1]!;
      assert.ok(
        ticking.includes(`${setter}(`),
        `${name} ticks something other than the clock its copy is drawn from`,
      );
      assert.match(ticking, /connectingTick\(/, `${name} decides for itself when the wait's words change`);
      assert.match(
        ticking,
        /Date\.now\(\)\s*-\s*\w+/,
        `${name} counts ticks instead of measuring from when the wait began`,
      );

      // A second attempt opens on the first sentence. Without this the quiet
      // door's reconnect inherits the oldest line before it has waited at all.
      assert.match(
        source,
        new RegExp(`${setter}\\(0\\)`),
        `${name} reuses the last attempt's clock, so a retry starts on the oldest sentence`,
      );
    }
  });

  // Revamp B (F603). Connecting and waiting become one full page each, with a
  // headline that says what is opening and one sentence under it. These are
  // the words; the page that draws them is RoomWait. Two rules carry over from
  // the stages above: nothing is invented (no tick for a step the client never
  // observes, no number) and nothing remarks on anybody's time.
  test('the waiting pages say what is opening and that nothing is counted until the chosen tutor joins', () => {
    assert.equal(CONNECTING_TITLE, 'Opening your conversation…');
    assert.ok(
      !CONNECTING_STAGES.some((stage) => stage.headline === CONNECTING_TITLE),
      'the page headline is one of the stage lines, so the fixed line and the moving one say the same thing',
    );

    const names = Object.values(TUTOR_VOICES).map((voice) => voice.persona.name);
    assert.ok(new Set(names).size > 1, 'the catalogue has one tutor, so this cannot tell a name from a constant');
    for (const name of names) {
      assert.equal(connectingBody(name), `This takes a few seconds. Nothing is counted until ${name} joins.`);
      assert.equal(waitingNote(name), `Nothing is counted until ${name} joins.`);
      // Both pages promise the same thing in the same words.
      assert.ok(connectingBody(name).endsWith(waitingNote(name)), 'the two waits say different things about what is counted');
    }
    assert.notEqual(waitingNote(names[0]!), waitingNote(names[1]!), 'the note names one tutor whoever the learner chose');

    // The waiting state has no clock, so its note says nothing about time.
    for (const name of names) {
      assert.doesNotMatch(waitingNote(name), /second|minute|moment|long|while|soon|quick/i, 'the waiting note talks about time');
    }

    for (const line of [CONNECTING_TITLE, connectingBody(names[0]!), waitingNote(names[0]!), ONE_MOMENT]) {
      assert.doesNotMatch(line, /[✓✔☑]|\bdone\b/i, `"${line}" ticks off a step nobody saw`);
      assert.doesNotMatch(line, /\d/, `"${line}" carries a number`);
      assert.doesNotMatch(line, /[·—–]/, `"${line}" carries a middot or a dash`);
      assert.doesNotMatch(
        line,
        /sorry|apolog|unfortunately|take your time|no rush|still waiting for you|taking (?:so )?long/i,
        `"${line}" apologises or remarks on the wait`,
      );
    }
  });
});
