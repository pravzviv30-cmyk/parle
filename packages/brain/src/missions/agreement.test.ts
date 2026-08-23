/**
 * The pin between core's mission catalogue and brain's mission frames.
 *
 * A mission is deliberately stored in two places: the progression metadata in
 * `@parle/core`, the French in this package, because core cannot import brain
 * and `ScenarioFrameSchema` cannot live anywhere but here. That split is only
 * safe while something reads both sides, which is what this file is. It is the
 * same move `palette.test.ts` makes for the colour table and `drill/fixtures.ts`
 * makes for the scene phrases: repeat the data, then make drift fail a test.
 *
 * Brain may import core. Core may never import brain. That is why this test
 * lives on this side of the line.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { MISSIONS, phraseKeyOf } from '@parle/core';

import { MISSION_FRAMES, missionFrame } from './frames.ts';
import { ScenarioFrameSchema } from '../contract/schemas.ts';
import { copyViolations } from '../copy.ts';
import { createConversation, integrateTurn } from '../engine/conversation.ts';
import { sampleTurn } from '../contract/samples.ts';

describe('a mission cannot drift apart from its own scene', () => {
  test('every core phrase key has a matching goal phrase in its frame', () => {
    for (const mission of MISSIONS) {
      const frame = MISSION_FRAMES[mission.id];
      const offered = new Set(frame.goalPhrases.map((phrase) => phraseKeyOf(phrase.fr)));

      for (const key of mission.phraseKeys) {
        assert.ok(
          offered.has(key),
          `${mission.id} says it practises ${key}, but its scene never offers that line. ` +
            `The learner would be drilled on French the tutor did not teach them.`,
        );
      }
    }
  });

  test('every core beat id appears in its frame, in the same order', () => {
    for (const mission of MISSIONS) {
      const frame = MISSION_FRAMES[mission.id];
      assert.deepEqual(
        [...mission.beatIds],
        frame.beats.map((beat) => beat.id),
        `${mission.id}'s beats disagree with its scene. The engine keys "done" on the frame's ids, ` +
          `so a catalogue that names different ones describes a mission nobody can finish.`,
      );
    }
  });

  test("every reference phrase is one of its frame's own goal phrases", () => {
    for (const mission of MISSIONS) {
      const frame = MISSION_FRAMES[mission.id];
      const spoken = new Set(frame.goalPhrases.map((phrase) => phrase.fr));

      for (const reference of mission.referencePhrases) {
        assert.ok(
          spoken.has(reference),
          `${mission.id} would score "${reference}" against audio, and its scene never says that line. ` +
            `A pronunciation score is only ever measured against a line the learner actually met.`,
        );
      }
    }
  });

  test('a reference phrase never competes with a written form the learner might say instead', () => {
    // Found by reading the six missions side by side, which is the only place it
    // is visible. A goalPhrase whose `frWritten` differs from its spoken `fr` has
    // TWO correct deliveries: "j'ai pas arrêté" and "je n'ai pas arrêté" are both
    // right, and a learner who says the second would be scored against a
    // reference they never chose. PEDAGOGY.md is unambiguous that a pronunciation
    // score is never invented or implied, and scoring the wrong line is a way of
    // inventing one. Everything here is still practised; it is only never scored.
    for (const mission of MISSIONS) {
      const frame = MISSION_FRAMES[mission.id];
      for (const reference of mission.referencePhrases) {
        const phrase = frame.goalPhrases.find((g) => g.fr === reference);
        assert.ok(phrase, `${mission.id}: "${reference}" is not one of its goal phrases`);
        assert.equal(
          phrase.frWritten,
          null,
          `${mission.id} would score "${reference}" against audio, but "${phrase.frWritten}" is an equally correct ` +
            `way to say it. A learner who chose the other one would be marked against a line they did not say.`,
        );
      }
    }
  });

  test('no two missions say the same thing at the moment the learner finishes', () => {
    // K2 filed a ledger entry because every session opened on the same three
    // words. The win line is the same hazard one field over, and it lands at the
    // moment a beginner is deciding whether any of this is working. Both ends are
    // held: an opening template and a closing template are equally a formula.
    const wins = MISSIONS.map((mission) => mission.winEn);

    const openings = wins.map((w) => w.split(/\s+/).slice(0, 3).join(' ').toLowerCase());
    assert.equal(new Set(openings).size, openings.length, `two wins open on the same words: ${openings.join(' | ')}`);

    const closings = wins.map((w) => w.replace(/[.!]+$/, '').split(/\s+/).slice(-2).join(' ').toLowerCase());
    assert.equal(new Set(closings).size, closings.length, `two wins end on the same words: ${closings.join(' | ')}`);
  });

  test('every mission has a frame, and no frame is orphaned', () => {
    const catalogued = new Set<string>(MISSIONS.map((mission) => mission.id));
    const framed = new Set<string>(Object.keys(MISSION_FRAMES));

    for (const id of catalogued) assert.ok(framed.has(id), `${id} is in the catalogue with no scene to play`);
    for (const id of framed) assert.ok(catalogued.has(id), `${id} has a scene and no mission points at it`);
  });

  test('an id this worker has never heard of degrades instead of throwing', () => {
    // The app and the agent ship independently. An unknown mission must open the
    // ordinary choosing question, never take the session down and never quietly
    // substitute a different scene than the one the learner picked.
    assert.equal(missionFrame('mission:nope'), undefined);
    assert.equal(missionFrame('__proto__'), undefined, 'a prototype key is not a mission');
    assert.equal(missionFrame(''), undefined);
    assert.ok(missionFrame('mission:cafe'), 'a real id still resolves');
  });
});

describe('the authored scenes hold to the contract a generated one is held to', () => {
  test('every mission frame parses through the scenario frame schema untouched', () => {
    for (const [id, frame] of Object.entries(MISSION_FRAMES)) {
      const parsed = ScenarioFrameSchema.safeParse(frame);
      assert.ok(parsed.success, `${id} does not satisfy the contract: ${parsed.error?.message ?? ''}`);
      assert.deepEqual(parsed.data, frame, `${id} was changed by parsing, so what ships is not what was authored`);
    }
  });

  test("no mission frame's English copy violates the copy rules", () => {
    for (const [id, frame] of Object.entries(MISSION_FRAMES)) {
      const plain: [string, string][] = [
        ['titleEn', frame.titleEn],
        ['setting', frame.setting],
        ['learnerRole', frame.learnerRole],
        ['registerGuidance', frame.registerGuidance],
        ['openingNarration.en', frame.openingNarration.en],
        ['openingSupport.hintEn', frame.openingSupport.hintEn],
        ...frame.beats.map((beat): [string, string] => [`beat ${beat.id}`, beat.goalEn]),
        ...frame.goalPhrases.map((phrase): [string, string] => [`phrase ${phrase.fr}`, phrase.en]),
        ...frame.cultureNotes.map((note, i): [string, string] => [`cultureNotes[${i}]`, note]),
      ];

      for (const [where, text] of plain) {
        assert.deepEqual(copyViolations(text), [], `${id} ${where} breaks a copy rule: "${text}"`);
      }

      // A character speaking a price is speech, not a score, so digits are
      // allowed inside a line somebody says out loud.
      assert.deepEqual(
        copyViolations(frame.openingLine.en, { allowDigits: true }),
        [],
        `${id} openingLine breaks a copy rule: "${frame.openingLine.en}"`,
      );
    }
  });

  test('every mission frame opens with support already in hand', () => {
    // Turn zero must cost no model call, or the whole point of authoring the
    // scene is given back at the first thing the learner sees.
    for (const [id, frame] of Object.entries(MISSION_FRAMES)) {
      const support = frame.openingSupport;

      assert.ok(support.fullLine.fr.trim().length > 0, `${id} opens with no line to hand a frozen learner`);
      assert.ok(support.options.length >= 2, `${id} offers fewer than two ways to answer, which is not a choice`);
      assert.ok(support.hintEn.trim().length > 0, `${id} has no English hint, so rung three has nothing to show`);

      assert.notEqual(
        support.fullLine.fr.trim().toLowerCase(),
        frame.openingLine.fr.trim().toLowerCase(),
        `${id} hands the learner the character's own line back as their reply. ` +
          `Echo means repeat the line you are being handed, not the line you just heard.`,
      );
    }
  });

  test('an opening narration starts on something concrete, not a stock phrase', () => {
    // K2: every session used to open on the same three words, because the
    // scenario prompt's own worked example taught the model to write them.
    for (const [id, frame] of Object.entries(MISSION_FRAMES)) {
      assert.doesNotMatch(
        frame.openingNarration.en,
        /^\s*imagine the scene/i,
        `${id} opens on the one phrase the product went out of its way to stop repeating`,
      );
      assert.doesNotMatch(
        frame.openingNarration.en,
        /\b(café|s'il vous plaît|bonjour|merci|voilà)\b/i,
        `${id}'s narration is spoken aloud in English and must carry no French words`,
      );
    }

    const openings = Object.values(MISSION_FRAMES).map((frame) =>
      frame.openingNarration.en.trim().split(/\s+/).slice(0, 3).join(' ').toLowerCase(),
    );
    assert.equal(
      new Set(openings).size,
      openings.length,
      `two missions open on the same three words: ${openings.join(' | ')}`,
    );
  });
});

describe('every authored mission is playable, not merely well formed', () => {
  test('each of the six opens, runs its beats, and hands back a win', () => {
    // The schema proves a frame is shaped right. It does not prove the engine can
    // get a learner through it, and those are different failures: a frame whose
    // beat ids the engine cannot key on, or whose opening support collapses into
    // the character's own line, parses perfectly and then strands somebody.
    //
    // So this walks all six the way a learner would, on the same engine the live
    // agent uses, and asserts the two things the mission format promises: the
    // beats complete, and finishing them opens a win rather than a door.
    for (const mission of MISSIONS) {
      const frame = MISSION_FRAMES[mission.id];

      let state = createConversation(
        frame,
        { cefr: 'A0', confidence: 'low', watchFor: [], lastRung: null, sessions: 0, name: null },
        { strictness: 'balanced', maxTurns: 40, mission: true },
        1_000,
      );

      assert.equal(state.currentBeat, frame.beats[0]!.id, `${mission.id} does not open on its own first beat`);
      assert.ok(
        state.lastSupport.fullLine.fr.trim().length > 0,
        `${mission.id} opens with nothing to hand a learner who freezes on turn zero`,
      );

      let view = integrateTurn(state, { type: 'spoke', text: 'Bonjour.' }, sampleTurn()).view;
      for (const beat of frame.beats) {
        const done = integrateTurn(
          state,
          { type: 'spoke', text: 'Oui, bien sûr.' },
          sampleTurn({ scene: { beat: beat.id, beatDone: true, sceneDone: false } }),
        );
        state = done.state;
        view = done.view;
      }

      assert.equal(view.missionDone, true, `${mission.id} finished every beat and never told the learner so`);
      assert.equal(
        view.recapDue,
        false,
        `${mission.id} ends the session on the turn the learner earned their win, which takes it away in the same breath`,
      );
      assert.ok(view.rung >= 1 && view.rung <= 4, `${mission.id} left the ladder somewhere impossible`);
    }
  });

  test('a mission never opens by handing the learner the character’s own line', () => {
    // learnerSideSupport exists because a model did exactly this once. An
    // authored frame can make the same mistake by hand, and it is invisible
    // until a learner is told to say the barista's half of the exchange.
    for (const mission of MISSIONS) {
      const frame = MISSION_FRAMES[mission.id];
      const state = createConversation(
        frame,
        { cefr: 'A0', confidence: 'low', watchFor: [], lastRung: null, sessions: 0, name: null },
        { strictness: 'balanced', maxTurns: 40, mission: true },
        1_000,
      );
      assert.notEqual(
        state.lastSupport.fullLine.fr.trim().toLowerCase(),
        frame.openingLine.fr.trim().toLowerCase(),
        `${mission.id} would tell the learner to repeat the line that was just said TO them`,
      );
    }
  });
});
