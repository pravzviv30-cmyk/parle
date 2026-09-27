import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildConversationPack, phraseKeyOf, type DrillExercise, type ReviewCard } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import type { SoundCheckEvidence } from '../soundcheck/model.ts';
import { withMark } from '../conversationPacks/marks.ts';
import { MADE_FROM_COPY, alternativesSource, madeFromConversations, madeFromSource, soundToTune } from './madeFrom.ts';
import { STARTER_COPY, starterFrom } from './starter.ts';

const NOW = Date.parse('2026-09-12T20:00:00.000Z');
const FR = ['Le code wifi, s’il vous plaît', 'Je peux avoir la clé ?', 'Bonne soirée'];

function pack(withRepair = true) {
  return buildConversationPack({
    id: 's1', sessionId: 's1', learnerId: 'l', createdAt: new Date(NOW - 60_000).toISOString(),
    title: { fr: 'Le code wifi', en: 'The wifi password' }, summary: 's',
    keyPhrases: FR.map((fr, i) => ({ fr, frWritten: null, en: `English ${i}` })),
    corrections: withRepair ? [{ quote: 'je veux le wifi', better: 'Je voudrais le code wifi', betterEn: 'I would like the wifi password', why: 'Softer.' }] : [],
  });
}

function card(fr: string, due: number): ReviewCard {
  return { id: phraseKeyOf(fr), kind: 'turn', front: fr, back: 'x', context: '', ipa: '', addedAt: NOW - 86_400_000, due, intervalDays: 1, ease: 2.5, reps: 1, lapses: 0 };
}

/** The bank a real pack leaves behind: one exercise per phrase and one for its better line. */
const exercise = (fr: string): DrillExercise =>
  ({ id: `ex:${fr}`, phraseKey: phraseKeyOf(fr), difficulty: 'production', kind: 'translate', fr, en: 'x', direction: 'en-fr', accepted: [fr] });
const BANK: DrillExercise[] = [...FR, 'Je voudrais le code wifi'].map(exercise);

const CHECK: SoundCheckEvidence ={ missionId: 'mission:hotel', reference: 'x', at: NOW - 1000, kind: 'assessed-focus', focus: 'Round your lips more.', phoneme: 'y' };

describe('practice, made from the learner’s own conversations (F554, F557, F558)', () => {
  test('names the real conversation that produced the personal rows', () => {
    const made = madeFromConversations({ packs: [pack()], marks: [], deck: [], checks: [], bank: BANK, now: NOW });
    assert.equal(madeFromSource(made), 'The wifi password');
    assert.equal(madeFromSource(null), null);
    assert.equal(madeFromSource({ replay: null, phrase: null, sound: soundToTune([CHECK]) }), null);
  });

  test('practice draws replay, make yours and tune the sound from the newest ready pack, and the starter set for a learner with none', () => {
    const made = madeFromConversations({ packs: [pack()], marks: [], deck: [], checks: [], bank: BANK, now: NOW });
    assert.ok(made !== null);
    assert.equal(made.replay!.quote, 'je veux le wifi');
    assert.equal(made.replay!.better, 'Je voudrais le code wifi');
    assert.equal(made.replay!.key, phraseKeyOf('Je voudrais le code wifi'), 'the replay opens on something other than the better line’s key');
    assert.equal(made.replay!.from, 'The wifi password');
    assert.equal(made.phrase!.fr, FR[0], 'the phrase is not the first one the deck does not hold');
    assert.equal(made.phrase!.saved, false);
    assert.equal(made.sound, null, 'a sound was named with nothing measured');

    // No correction: no replay, and nothing invented in its place.
    assert.equal(madeFromConversations({ packs: [pack(false)], marks: [], deck: [], checks: [], bank: BANK, now: NOW })!.replay, null);
  });

  test('Replay a moment can only start a sitting when its better line is new or due — whole-app phase 2 review', () => {
    // Fable repro on the labelled sample: the pack's phrases are banked with a
    // stagger, so the correction's card is held for a day. A scoped drill on a
    // held card queues nothing, and the row used to open "Nothing to review".
    // The row now says whether a sitting would have something in it, by the
    // same rule the phrase row already follows.
    const better = 'Je voudrais le code wifi';
    const notInDeck = madeFromConversations({ packs: [pack()], marks: [], deck: [], checks: [], bank: BANK, now: NOW })!;
    assert.equal(notInDeck.replay!.sayable, true, 'a correction the deck has never met is new material and can start');
    const heldADay = madeFromConversations({ packs: [pack()], marks: [], deck: [card(better, NOW + 86_400_000)], checks: [], bank: BANK, now: NOW })!;
    assert.equal(heldADay.replay!.sayable, false, 'a held correction was offered, and its sitting would be empty');
    const due = madeFromConversations({ packs: [pack()], marks: [], deck: [card(better, NOW - 1)], checks: [], bank: BANK, now: NOW })!;
    assert.equal(due.replay!.sayable, true, 'a due correction was withheld');
    // Provenance survives a held correction: the rows still know their conversation.
    assert.equal(madeFromSource(heldADay), 'The wifi password');
    // Fable re-check edge: the bank keeps a capped set of exercises, so an
    // older pack's repair exercise can be gone while its card is due. A due
    // card with nothing in the bank to drill it would still open an empty sitting.
    const evicted = BANK.filter((e) => e.phraseKey !== phraseKeyOf(better));
    const dueButEvicted = madeFromConversations({ packs: [pack()], marks: [], deck: [card(better, NOW - 1)], checks: [], bank: evicted, now: NOW })!;
    assert.equal(dueButEvicted.replay!.sayable, false, 'a due correction with no exercise left in the bank was offered');
    // No ready pack: null, and the starter set stands in from authored material.
    assert.equal(madeFromConversations({ packs: [], marks: [], deck: [], checks: [], bank: BANK, now: NOW }), null);
    const starter = starterFrom();
    assert.ok(starter.moment.fr.length > 0 && starter.moment.tutorFr.length > 0 && starter.phrase.fr.length > 0);
    assert.notEqual(starter.moment.fr, starter.moment.tutorFr, 'the first moment offers the tutor’s line as the learner’s');
    // A practised pack is still the newest ready pack: practising it does not
    // take the cards away, it only moves the next step on.
    assert.ok(madeFromConversations({ packs: [pack()], marks: withMark([], 's1', 'practisedAt', NOW), deck: [], checks: [], bank: BANK, now: NOW }) !== null);

    for (const line of [...MADE_FROM_COPY, ...STARTER_COPY]) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries "${guiltIn(line)}"`);
      assert.doesNotMatch(line, /—|\d|%/, `"${line}" carries an em dash, a digit or a percentage`);
    }
  });

  test('the rows name their conversation only when the card above has not already — whole-app phase 2', () => {
    // Source once per cluster. When the recommended card names the same
    // conversation, the rows under it say nothing more; when the card names
    // another, or none, the rows say where they are from, once.
    const made = madeFromConversations({ packs: [pack()], marks: [], deck: [], checks: [], bank: BANK, now: NOW });
    assert.equal(alternativesSource(made, 's1'), null, 'the rows repeat the conversation the card already names');
    assert.equal(alternativesSource(made, 'other'), 'From The wifi password');
    assert.equal(alternativesSource(made, null), 'From The wifi password');
    // A sound-only model has no conversation of its own to name.
    assert.equal(alternativesSource({ replay: null, phrase: null, sound: soundToTune([CHECK]) }, null), null);
    assert.equal(alternativesSource(null, null), null);
  });

  test('say it is offered only for a phrase the deck does not know or wants back', () => {
    // Unknown to the deck: sayable, a sitting has new material.
    const fresh = madeFromConversations({ packs: [pack()], marks: [], deck: [], checks: [], bank: BANK, now: NOW })!.phrase!;
    assert.equal(fresh.sayable, true);
    // Every phrase saved and none due: the first is offered to hear, not to say.
    const settled = FR.map((fr) => card(fr, NOW + 86_400_000));
    const held = madeFromConversations({ packs: [pack()], marks: [], deck: settled, checks: [], bank: BANK, now: NOW })!.phrase!;
    assert.equal(held.saved, true);
    assert.equal(held.sayable, false, 'say it opens an empty sitting on a saved phrase that is not due');
    // Every phrase saved and the second due: the due one is the phrase, and sayable.
    const due = FR.map((fr, i) => card(fr, i === 1 ? NOW - 1 : NOW + 86_400_000));
    const wanted = madeFromConversations({ packs: [pack()], marks: [], deck: due, checks: [], bank: BANK, now: NOW })!.phrase!;
    assert.equal(wanted.fr, FR[1]);
    assert.equal(wanted.sayable, true);
  });

  test('tune the sound reads the newest sound check and says what to do when there is none', () => {
    assert.equal(soundToTune([]), null);
    const older: SoundCheckEvidence = { ...CHECK, at: NOW - 5000, phoneme: 'ʁ', missionId: 'mission:cafe' };
    const tuned = soundToTune([older, CHECK]);
    assert.ok(tuned !== null);
    assert.equal(tuned.missionId, 'mission:hotel', 'the sound is not the newest check’s');
    assert.match(tuned.acoustic.heading, /y/);
    assert.ok(Array.isArray(tuned.steps));
    // A check that named no sound is not a sound to tune.
    assert.equal(soundToTune([{ ...CHECK, phoneme: null, kind: 'assessed-clear', focus: null }]), null);
    const made = madeFromConversations({ packs: [pack()], marks: [], deck: [], checks: [CHECK], bank: BANK, now: NOW })!;
    assert.equal(made.sound!.missionId, 'mission:hotel');
  });
});
