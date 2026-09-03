/**
 * The ear on the transcript, and the name above it — F372.
 *
 * Replay has lived on the tutor's last bubble since the control row was cut to
 * five chips, and nothing on screen said so: the entire affordance was that the
 * bubble happened to be pressable. That is a control only somebody who already
 * knows about it can find, which for a "say that again" control is close to
 * nobody, because the learner who needs it is the one who did not catch the
 * line.
 *
 * Two halves, and both are pinned here. The ear is a rule over three inputs, so
 * it is a module with its own suite rather than a ternary inside a `.tsx`. The
 * name above each tutor bubble is layout, so it is read out of the source, and
 * both call sites are read too: a thread that names Luc over Celine's sentences
 * is worse than one that names nobody.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { replayEar, type ReplayEar } from './replayEar.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

/** Every combination of the three inputs, so nothing is checked by omission. */
const ALL = [false, true] as const;

describe('the ear on the tutor line — F372', () => {
  test('the ear on the last tutor line is hidden, quiet or sounding, and never on a learner line — F372', () => {
    // 1. The three states, one for each thing that is true.
    assert.equal(
      replayEar({ isLastTutorLine: true, canReplay: true, sounding: false }),
      'quiet',
      'the last tutor line has a line to hear and shows nothing that says so',
    );
    assert.equal(
      replayEar({ isLastTutorLine: true, canReplay: true, sounding: true }),
      'sounding',
      'the line is playing and the ear does not light, so a tap to stop looks like a tap to start',
    );
    assert.equal(
      replayEar({ isLastTutorLine: true, canReplay: false, sounding: false }),
      'hidden',
      'an ear is drawn on a bubble with no replay behind it, which is a control that lies about what it does',
    );

    // 2. Both halves are required, and `sounding` is not a way in. This is the
    //    whole of "never on a learner line": the transcript folds `who` into
    //    the first input, so a learner bubble arrives here as not-last, and it
    //    must stay hidden however loudly the tutor is talking over it.
    for (const canReplay of ALL) {
      for (const sounding of ALL) {
        assert.equal(
          replayEar({ isLastTutorLine: false, canReplay, sounding }),
          'hidden',
          `a line that is not the last tutor line drew an ear with canReplay=${canReplay} sounding=${sounding}`,
        );
      }
    }
    for (const isLastTutorLine of ALL) {
      for (const sounding of ALL) {
        assert.equal(
          replayEar({ isLastTutorLine, canReplay: false, sounding }),
          'hidden',
          `a screen with no replay to give drew an ear with isLastTutorLine=${isLastTutorLine} sounding=${sounding}`,
        );
      }
    }

    // 3. Three answers and no fourth, over every input there is.
    const seen = new Set<ReplayEar>();
    for (const isLastTutorLine of ALL) {
      for (const canReplay of ALL) {
        for (const sounding of ALL) {
          const state = replayEar({ isLastTutorLine, canReplay, sounding });
          assert.ok(['hidden', 'quiet', 'sounding'].includes(state), `the ear answered ${state}, which nothing draws`);
          seen.add(state);
        }
      }
    }
    assert.equal(seen.size, 3, 'one of the three states is unreachable, so something on the bubble can never be drawn');

    // 4. The bubble itself, read out of the file: there is no renderer here.
    const transcript = stripComments(read('./Transcript.tsx'));
    assert.match(transcript, /replayEar\(\{/, 'the transcript decides the ear for itself again');
    assert.match(transcript, /<EarGlyph/, 'the last tutor bubble carries no mark saying it can be played');
    assert.match(
      transcript,
      /isLastTutorLine: !learner && isLastTutorLine/,
      'the transcript can put an ear on a learner bubble',
    );

    // The whole bubble stays the press target with the label it already had. A
    // separate ear button would be a second control inside the first, which is
    // invalid on web and a worse target for one thumb.
    assert.match(
      transcript,
      /accessibilityLabel=\{`Hear that line again: \$\{turn\.fr\}`\}/,
      'the bubble lost the label that says what pressing it does',
    );
    const ear = transcript.slice(transcript.indexOf('<EarGlyph'));
    assert.match(
      ear.slice(0, ear.indexOf('/>')),
      /accent\.primary : paper\.ink/,
      'the ear is not ink when quiet and the accent when sounding, so it does not match the ear on an OptionCard',
    );
    assert.ok(
      transcript.includes("earSounding: { padding: space(1), backgroundColor: paper.groundDeep"),
      'a sounding ear no longer sits on the quiet disc OptionCard puts it on',
    );

    // Narration is not a speaker, so it has neither a name nor an ear.
    const narration = transcript.slice(transcript.indexOf("if (turn.who === 'narration')"));
    assert.ok(
      !narration.slice(0, narration.indexOf('const learner =')).includes('EarGlyph'),
      'the narrator was given a line to replay, and the narrator never spoke one',
    );
  });

  test('every tutor bubble is named, and both threads name the chosen tutor — F372', () => {
    const transcript = stripComments(read('./Transcript.tsx'));

    // The name sits above the bubble, on the tutor's side only: the learner's
    // own words on their own side need no label.
    assert.match(
      transcript,
      /\{learner \? null : \(\s*<View style=\{st\.speaker\}>\s*<Label>\{tutorName\}<\/Label>/,
      'the tutor bubbles are unnamed, or the learner side was given a name it does not need',
    );

    // Both call sites, and both with the chosen tutor rather than a constant.
    // F293 made the tutor per learner; a default fed in here would put Luc's
    // name over Celine's sentences.
    const convo = stripComments(read('../ConvoScreen.tsx'));
    const threads = convo.match(/<Transcript[\s\S]{0,320}?\/>/g) ?? [];
    assert.equal(threads.length, 2, 'the conversation no longer draws two threads; this test is stale');
    for (const thread of threads) {
      assert.match(thread, /tutorName=\{tutorNameOf\(profile\)\}/, `a thread names nobody: ${thread}`);
      assert.match(
        thread,
        /tutorSpeaking=\{live\.tutorSpeaking && !typing\}/,
        `a thread lights its ear from something other than the tutor's own voice: ${thread}`,
      );
    }
    assert.ok(
      !/tutorName="/.test(convo),
      'a thread is handed a written-out name rather than the one the learner chose',
    );
  });
});
