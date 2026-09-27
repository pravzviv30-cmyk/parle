import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildConversationPack, newCard, phraseKeyOf, type ConversationPack, type DrillExercise, type ReviewCard } from '@luvani/core';

import { practiceCard, practiceDoors } from './practiceCard.ts';
import { recommendation } from './recommendation.ts';
import { PRACTICE_ALTERNATIVES, PRACTICE_COPY, RECOMMENDED } from './copy.ts';
import { NEXT_STEP } from './nextStep.ts';
import { guiltIn } from '../copy/guilt.ts';
import { LESSON_MINUTES } from '../copy/access.ts';
import { SOUND_LEAD } from './soundLead.ts';

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;

const card = (fr: string, dueIn: number): ReviewCard =>
  ({ ...newCard({ id: phraseKeyOf(fr), kind: 'vocab', front: fr, back: `means ${fr}`, context: '', ipa: '' }, NOW - 10 * DAY), due: NOW + dueIn, reps: 2 });
const ex = (fr: string): DrillExercise =>
  ({ id: `ex:${fr}`, phraseKey: phraseKeyOf(fr), difficulty: 'production', kind: 'translate', fr, en: 'x', direction: 'en-fr', accepted: [fr] });
const pack = (id: string, lines: string[]): ConversationPack =>
  buildConversationPack({
    id, sessionId: id, learnerId: 'l', createdAt: new Date(NOW - DAY).toISOString(),
    title: { fr: `Titre ${id}`, en: `Title ${id}` }, summary: 's',
    keyPhrases: lines.map((fr) => ({ fr, frWritten: null, en: `means ${fr}` })),
  });

describe('the Practice card and its quiet doors', () => {
  test('a conversation-backed sitting names that conversation, previews none of its own targets, and promises no duration', () => {
    const lines = ['Sur place', 'Un café'];
    const packs = [pack('p1', lines)];
    const deck = lines.map((fr) => card(fr, 3 * DAY));
    const rec = recommendation({ resumable: null, deck, bank: lines.map(ex), packs, now: NOW });
    const c = practiceCard({ rec, deck, packs, now: NOW, resuming: [] });

    assert.equal(c.action.kind, 'practice');
    assert.equal(c.action.label, RECOMMENDED.start);
    assert.equal(c.source, `${RECOMMENDED.fromConversation} Title p1`);
    // Both lines are in the sitting, so neither may be shown above it.
    assert.ok(!lines.includes(c.phrase.fr), `the card previews "${c.phrase.fr}", which the sitting then asks for`);
    assert.equal(c.noMinutes, RECOMMENDED.noMinutes);
    if (c.action.kind === 'practice') {
      // Flat strings only: the address bar is what carries these on the web.
      assert.deepEqual(c.action.params, { practice: 'recommended' }, 'a cold recommended sitting carries more than its kind');
      for (const value of Object.values(c.action.params)) assert.equal(typeof value, 'string', 'an object went into the route');
    }
    for (const line of PRACTICE_COPY) assert.ok(!/\bmin(ute)?s?\b.*\d|\d.*\bmin/i.test(line), `"${line}" promises a duration`);
  });

  test('review alone says review, never a conversation', () => {
    const deck = [card('Merci', -DAY)];
    const rec = recommendation({ resumable: null, deck, bank: [ex('Merci')], packs: [pack('p1', ['Rien'])], now: NOW });
    const c = practiceCard({ rec, deck, packs: [pack('p1', ['Rien'])], now: NOW, resuming: [] });
    assert.equal(c.source, RECOMMENDED.fromReview);
    assert.notEqual(c.phrase.fr, 'Merci', 'the card previews the one phrase the review sitting then asks for');
  });

  test('a waiting sitting is resumed, and the card says so rather than starting another', () => {
    const packs = [pack('p1', ['Bonjour'])];
    const rec = recommendation({ resumable: { packId: 'p1', remaining: 1 }, deck: [], bank: [ex('Bonjour')], packs, now: NOW });
    const c = practiceCard({ rec, deck: [], packs, now: NOW, resuming: [phraseKeyOf('Bonjour')] });
    assert.equal(c.action.kind, 'resume');
    assert.equal(c.action.label, RECOMMENDED.resume);
    assert.equal(c.noMinutes, RECOMMENDED.noMinutes);
  });

  /**
   * Exposure honesty (whole-app phase 2).
   *
   * The card sets a French line large, with its meaning, directly above the
   * button that opens a sitting of English-to-French asks. When that line is
   * one of the sitting's own targets, the learner reads the answer and then is
   * credited with recalling it cold. The smallest correct rule is here, in the
   * view model: the preview is never a phrase the sitting (new or resumed) is
   * about to ask for. It prefers another line from the same conversation, then
   * a phrase the learner already holds and is not due, then the café lesson.
   */
  test('the card never previews a French line the sitting is about to ask for', () => {
    // A conversation with a line the bank cannot drill: that line is not a
    // target, so it is the honest preview, and it stays on topic.
    const lines = ['Un café', 'Sur place', 'Trois croissants'];
    const packs = [pack('p1', lines)];
    const start = recommendation({ resumable: null, deck: [], bank: [ex('Un café'), ex('Sur place')], packs, now: NOW });
    assert.equal(start.kind, 'start');
    const targets = new Set(start.kind === 'start' ? start.selection.targets.map((t) => t.phraseKey) : []);
    const onTopic = practiceCard({ rec: start, deck: [], packs, now: NOW, resuming: [] });
    assert.ok(!targets.has(phraseKeyOf(onTopic.phrase.fr)), 'the preview is one of the sitting\'s own targets');
    assert.deepEqual(onTopic.phrase, { fr: 'Trois croissants', en: 'means Trois croissants' }, 'the preview left the conversation it names');

    // Review only: a phrase the learner already holds and is not due is theirs
    // to see, and is not in this sitting.
    const deck = [card('Merci', -DAY), card('Salut', 5 * DAY)];
    const review = recommendation({ resumable: null, deck, bank: [ex('Merci')], packs: [], now: NOW });
    const settled = practiceCard({ rec: review, deck, packs: [], now: NOW, resuming: [] });
    assert.deepEqual(settled.phrase, { fr: 'Salut', en: 'means Salut' });

    // A resumed sitting avoids the phrases it was saved with, which the card
    // is told because the recommendation itself does not carry them.
    const saved = [pack('p2', ['Bonjour', 'Merci beaucoup'])];
    const resume = recommendation({ resumable: { packId: 'p2', remaining: 1 }, deck: [], bank: [], packs: saved, now: NOW });
    const resumed = practiceCard({ rec: resume, deck: [], packs: saved, now: NOW, resuming: [phraseKeyOf('Bonjour')] });
    assert.deepEqual(resumed.phrase, { fr: 'Merci beaucoup', en: 'means Merci beaucoup' });

    // Every candidate taken: the café lesson still offers a line outside the
    // sitting, because a sitting is capped well below the lesson's length.
    const all = ['Bonjour', "Un café, s'il vous plaît"];
    const allPacks = [pack('p2', all)];
    const resumeAll = recommendation({ resumable: { packId: 'p2', remaining: 1 }, deck: [], bank: [], packs: allPacks, now: NOW });
    const cafe = practiceCard({ rec: resumeAll, deck: [], packs: allPacks, now: NOW, resuming: all.map(phraseKeyOf) });
    assert.ok(!all.includes(cafe.phrase.fr), 'every fallback was one the resumed sitting asks for');
    assert.ok(cafe.phrase.fr.length > 0 && cafe.phrase.en.length > 0);
  });

  test('with nothing playable on day one the card is the bonjour sound lesson, with its live-minutes line — notebook Phase 3', () => {
    // 2026-09-27: day one on Practice is the guided pronunciation lesson that
    // opens on "Bonjour", not a first conversation (Today owns that start).
    const rec = recommendation({ resumable: null, deck: [], bank: [], packs: [], now: NOW });
    const c = practiceCard({ rec, deck: [], packs: [], now: NOW, resuming: [] });
    assert.equal(c.action.kind, 'lesson');
    assert.equal(c.action.label, SOUND_LEAD.lesson);
    assert.notEqual(c.action.label, NEXT_STEP.first, 'day one on Practice still offers a first conversation');
    assert.equal(c.noMinutes, null, 'the lesson runs live while a tutor is connected and was labelled as using no minutes');
    assert.equal(c.liveMinutes, LESSON_MINUTES, 'the lesson does not say it uses live minutes while the tutor is connected');
    // Every other card says nothing about live minutes of its own.
    const talk = practiceCard({ rec: { kind: 'none', fallback: 'talk' }, deck: [], packs: [], now: NOW, resuming: [] });
    assert.equal(talk.liveMinutes, null);
  });

  test('a learner who already has a conversation is never told to start their first — whole-app phase 2 review', () => {
    // Fable repro: recommendation says `none/talk` for a learner whose
    // conversations left nothing playable, and the card used to collapse that
    // into "Start your first conversation". Each such state gets its own words.
    const building = { ...pack('g1', ['Bonjour']), state: 'generating' as const };
    const failed = { ...pack('f1', ['Bonjour']), state: 'failed' as const };
    const emptyReady = pack('r1', []);
    for (const packs of [[building], [failed], [emptyReady]]) {
      const rec = recommendation({ resumable: null, deck: [], bank: [], packs, now: NOW });
      assert.deepEqual(rec, { kind: 'none', fallback: 'talk' }, 'the fixture is not the talk state it means to test');
      const c = practiceCard({ rec, deck: [], packs, now: NOW, resuming: [] });
      assert.equal(c.action.kind, 'talk', `state ${packs[0]!.state} is shown as a first conversation`);
      assert.equal(c.action.label, RECOMMENDED.talk);
      assert.notEqual(c.action.label, NEXT_STEP.first);
      assert.equal(c.noMinutes, null, 'a live conversation was labelled as using no minutes');
    }
    // A conversation still being turned into practice says so, and only then.
    const generating = practiceCard({ rec: { kind: 'none', fallback: 'talk' }, deck: [], packs: [building], now: NOW, resuming: [] });
    assert.equal(generating.source, RECOMMENDED.preparing);
    const nothingPlayable = practiceCard({ rec: { kind: 'none', fallback: 'talk' }, deck: [], packs: [emptyReady], now: NOW, resuming: [] });
    assert.equal(nothingPlayable.source, null, 'a conversation with nothing to drill was said to be in preparation');
  });

  test('the quiet doors appear only when each has something behind it, and the revisit follows the plan', () => {
    const packs = [pack('p1', ['Bonjour'])];
    const none = practiceDoors({ deck: [], packs: [], now: NOW, revisitAllowed: true, revisitPackId: null });
    assert.deepEqual(none, { review: null, choose: null, revisit: null });

    const doors = practiceDoors({ deck: [card('Merci', -DAY)], packs, now: NOW, revisitAllowed: true, revisitPackId: 'p1' });
    assert.equal(doors.review, PRACTICE_ALTERNATIVES.review);
    assert.equal(doors.choose, PRACTICE_ALTERNATIVES.choose);
    assert.deepEqual(doors.revisit, { label: PRACTICE_ALTERNATIVES.revisit, uses: PRACTICE_ALTERNATIVES.revisitUses, packId: 'p1' });

    // Not on this plan: the door is absent, never shown and then refused.
    assert.equal(practiceDoors({ deck: [], packs, now: NOW, revisitAllowed: false, revisitPackId: 'p1' }).revisit, null);
    // A pack that has gone cannot be revisited.
    assert.equal(practiceDoors({ deck: [], packs, now: NOW, revisitAllowed: true, revisitPackId: 'gone' }).revisit, null);
  });

  test('every new line is warm, dash-free and counts nothing', () => {
    for (const line of [...Object.values(RECOMMENDED), ...Object.values(PRACTICE_ALTERNATIVES)]) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries a banned word`);
      assert.ok(!line.includes('—'), `"${line}" has an em dash`);
      assert.ok(!/\d/.test(line), `"${line}" counts at the learner`);
    }
  });
});
