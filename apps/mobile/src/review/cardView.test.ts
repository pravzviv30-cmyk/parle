/**
 * What the deck is allowed to show, and when.
 *
 * The whole claim the review deck makes rests on one thing: that a "good" on a
 * due card means the learner produced the French before they saw it. A card
 * that can be turned over on sight makes that claim about an act of reading,
 * and no amount of scheduling arithmetic on top repairs it.
 *
 * Two of these carry the F126 names and are the ones the ledger reads. The rest
 * exist because the way to get this wrong is not to forget the gate, it is to
 * gate the wrong face: a vocabulary card fronts its French, so the retrieval it
 * needs runs backwards from the card it is, and a gate placed on the ordinary
 * flip would leave the answer sitting on the prompt.
 *
 * The last few read `ReviewScreen.tsx` rather than calling anything. There is no
 * renderer in this suite (docs/TESTING.md), so "the screen obeys the view" and
 * "no control is unlabelled" are asked of the file. That is a blunt tool and its
 * ceiling is honest: it proves the props are written down, never that VoiceOver
 * read them out.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyGrade, evidenceOf, presentationOf, type ReviewCard } from '@parle/core';

import { CARD_START, RETRIEVAL_ASK, SAID_IT, TYPE_IT, cardView, typedAttemptReady } from './cardView.ts';

const NOW = Date.parse('2026-08-20T12:00:00.000Z');
const DAY = 86_400_000;

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Comments may say anything; only what reaches glass is under test. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

/**
 * Every `<Tag ...>` in a file, whole, counting braces.
 *
 * The same walk `surfaceContract.test.ts` had to write, and for the same
 * reason: an `onPress={() => setTurn(...)}` carries a `>` that is not the end
 * of the tag, so a lazy regex stops on the arrow and reports every control that
 * takes a handler as having no role, which is all of them.
 */
function tags(body: string, tag: string): string[] {
  const found: string[] = [];
  for (const match of body.matchAll(new RegExp(`<${tag}\\b`, 'g'))) {
    let depth = 0;
    for (let i = match.index; i < body.length; i += 1) {
      const char = body[i]!;
      if (char === '{') depth += 1;
      else if (char === '}') depth -= 1;
      else if (char === '>' && depth === 0) {
        found.push(body.slice(match.index, i + 1));
        break;
      }
    }
  }
  return found;
}

/**
 * A vocabulary card the learner has recalled before and the scheduler wants
 * back. Its context and its IPA are both about the French, which is why they
 * are on this fixture: hiding the front while printing the sentence it came out
 * of would be the gate held open by its own help.
 */
function card(over: Partial<ReviewCard> = {}): ReviewCard {
  return {
    id: 'phrase:addition',
    kind: 'vocab',
    front: "l'addition, s'il vous plaît",
    back: 'the bill, please',
    context: "Je peux avoir l'addition, s'il vous plaît ?",
    ipa: 'ladisjɔ̃',
    addedAt: NOW - 30 * DAY,
    due: NOW - DAY,
    intervalDays: 6,
    ease: 2.5,
    reps: 3,
    lapses: 0,
    ...over,
  };
}

/** A turn card: the English ask on the front, the French it wants on the back. */
const turnCard = (over: Partial<ReviewCard> = {}): ReviewCard =>
  card({
    id: 'turn:addition',
    kind: 'turn',
    front: 'Ask for the bill',
    back: "l'addition, s'il vous plaît",
    context: 'At the end of a meal.',
    ipa: '',
    ...over,
  });

/** Every string this view would put on the screen, flattened. */
function everythingShown(view: ReturnType<typeof cardView>): string {
  return [
    view.tag,
    view.prompt,
    view.ask ?? '',
    view.answer?.text ?? '',
    view.answer?.context ?? '',
    view.answer?.ipa ?? '',
    view.hear ?? '',
    view.echo ?? '',
    view.announce ?? '',
  ].join(' | ');
}

describe('the deck asks before it tells — F126', () => {
  test('a due production item requires retrieval before its answer is revealed', () => {
    const due = card();
    assert.equal(presentationOf(due, NOW), 'retrieval', 'core no longer calls this card a retrieval; the fixture is stale');

    const asked = cardView(due, NOW, CARD_START);
    assert.equal(asked.revealed, false, 'a due card opened with its answer already on it');
    assert.equal(asked.answer, null, 'the answer face is built before anybody attempted anything');
    assert.equal(asked.hear, null, 'the French can be played on the prompt, which is the answer arriving through the ear');
    assert.equal(asked.grades, false, 'the learner can grade a card they have not answered');
    assert.equal(asked.flippable, false, 'the card can still be turned over, so the gate is decoration');
    assert.equal(asked.asksForAttempt, true, 'nothing on screen asks for the attempt the gate is waiting on');
    assert.equal(asked.ask, RETRIEVAL_ASK);

    // And the attempt is what opens it. Either attempt: one tap for the
    // learner on a bus, typing for the one who wants to check their spelling.
    for (const attempt of ['said', 'typed'] as const) {
      const answered = cardView(due, NOW, { ...CARD_START, attempt, typed: 'ladition' });
      assert.equal(answered.revealed, true, `a ${attempt} attempt did not open the card`);
      assert.equal(answered.answer?.text, due.front, `a ${attempt} attempt revealed something other than the French`);
      assert.equal(answered.hear, due.front, 'the French can be heard once it has been asked for');
      assert.equal(answered.grades, true, 'there is no way to say how it went');
      assert.equal(answered.asksForAttempt, false, 'the card goes on asking for an attempt it already had');
    }
  });

  test('a genuinely new card keeps its scaffolded introduction', () => {
    // Asking somebody to produce a phrase they have never once recalled is a
    // test with no teaching in it. Nothing about this path changed, and this
    // is the test that says so.
    const fresh = card({ reps: 0, due: NOW, intervalDays: 0 });
    const met = cardView(fresh, NOW, CARD_START);

    assert.equal(met.mode, 'introduction');
    assert.equal(met.prompt, fresh.front, 'a new word is met by seeing it');
    assert.equal(met.ask, null, 'a first meeting demands an attempt');
    assert.equal(met.asksForAttempt, false, 'a first meeting demands an attempt');
    assert.equal(met.flippable, true, 'the card cannot be turned over any more');
    assert.equal(met.hear, fresh.front, 'a new word cannot be heard while it is being met');
    assert.equal(met.grades, false, 'the grades are on screen before the card was turned over');

    const turned = cardView(fresh, NOW, { ...CARD_START, flipped: true });
    assert.equal(turned.revealed, true);
    assert.equal(turned.answer?.text, fresh.back, 'the back of an introduction is its gloss');
    assert.equal(turned.answer?.context, fresh.context);
    assert.equal(turned.answer?.ipa, fresh.ipa);
    assert.equal(turned.grades, true);
    assert.equal(turned.announce, null, 'a flip the learner performed themselves is not news');
  });
});

describe('which face is hidden — the inversion F120 was filed about', () => {
  test('a vocab card in retrieval never shows its French before the attempt', () => {
    // The trap: a vocabulary card fronts the French. Gating "the back" on this
    // card would hide the English gloss and print the very phrase being asked
    // for, which is the bug wearing the fix's clothes.
    const due = card();
    const asked = cardView(due, NOW, CARD_START);

    assert.equal(asked.prompt, due.back, 'the prompt is not the English side, so the card is asking with its own answer');
    const shown = everythingShown(asked);
    for (const giveaway of [due.front, due.context, due.ipa]) {
      assert.ok(!shown.includes(giveaway), `the card is showing "${giveaway}" while it asks for it: ${shown}`);
    }

    const answered = cardView(due, NOW, { ...CARD_START, attempt: 'said' });
    assert.equal(answered.answer?.text, due.front);
    assert.equal(answered.answer?.context, due.context, 'the sentence it came out of arrives with the answer');
    assert.equal(answered.answer?.ipa, due.ipa);
  });

  test('a turn card in retrieval never plays or shows its French before the attempt', () => {
    // The other way round: a turn card already asks in English and keeps its
    // French on the back, so retrieval adds the gate and inverts nothing.
    const due = turnCard();
    const asked = cardView(due, NOW, CARD_START);

    assert.equal(asked.mode, 'retrieval');
    assert.equal(asked.prompt, due.front, 'the English ask is the prompt');
    assert.equal(asked.hear, null, 'Hear it would say the answer out loud before the learner tried');
    const shown = everythingShown(asked);
    assert.ok(!shown.includes(due.back), `the card is showing "${due.back}" while it asks for it: ${shown}`);

    const answered = cardView(due, NOW, { ...CARD_START, attempt: 'typed', typed: "l'addition" });
    assert.equal(answered.answer?.text, due.back);
    assert.equal(answered.hear, due.back, 'the French is what may be heard, on either kind of card');
  });

  test('a sound card is never asked for an attempt it cannot make', () => {
    // A sound is listened to and copied, never produced from an English
    // prompt, so a phoneme card is an introduction however overdue it is.
    const sound = card({
      id: 'phoneme:ʁ',
      kind: 'phoneme',
      front: 'ʁ',
      back: 'the French r',
      context: 'rouge',
      ipa: 'ʁ',
      reps: 9,
      due: NOW - 40 * DAY,
    });
    const met = cardView(sound, NOW, CARD_START);

    assert.equal(met.mode, 'introduction');
    assert.equal(met.asksForAttempt, false, 'a listening exercise was turned into a production test');
    assert.equal(met.flippable, true);
    assert.equal(met.hear, 'rouge', 'the example word is the whole point of a sound card');
  });

  test('a card seen before its due date is a look rather than a test', () => {
    // Browsing the deck early must never demand an attempt. That is core's
    // rule; this is the screen honouring it rather than keeping its own.
    const early = card({ due: NOW + 3 * DAY });
    const met = cardView(early, NOW, CARD_START);

    assert.equal(met.mode, 'introduction');
    assert.equal(met.asksForAttempt, false);
    assert.equal(met.hear, early.front, 'a look at a card the learner already knows may be heard');
  });
});

describe('what an attempt is worth', () => {
  test('a typed attempt and a said attempt each reach the deck as the attempt it was', () => {
    for (const attempt of ['typed', 'said'] as const) {
      const view = cardView(card(), NOW, { ...CARD_START, attempt, typed: 'ladition' });
      assert.deepEqual(view.gradeContext, { attempt }, `a ${attempt} attempt reached the store as something else`);

      // And the deck records it, because that is the whole point of carrying
      // the context: a good grade that followed a required attempt is the one
      // kind of rep this app is allowed to call recall.
      const graded = applyGrade(card(), 'good', NOW, view.gradeContext);
      assert.equal(evidenceOf(graded).retrievals, 1, `a ${attempt} attempt raised no recall evidence`);
    }
  });

  test('an introduction claims nothing about how the learner got there', () => {
    // A card turned over on sight and graded "Easy" is evidence of nothing,
    // and an empty context is how this screen says so out loud.
    const view = cardView(card({ reps: 0, due: NOW }), NOW, { ...CARD_START, flipped: true });
    assert.deepEqual(view.gradeContext, {});
    assert.equal(evidenceOf(applyGrade(card({ reps: 0 }), 'easy', NOW, view.gradeContext)).retrievals, 0);
  });

  test('saying again after an attempt raises no recall evidence', () => {
    // Forgetting is rescheduling, not failing, and it is equally not proof of
    // anything. The counters record what came out right.
    const view = cardView(card(), NOW, { ...CARD_START, attempt: 'said' });
    const lapsed = applyGrade(card(), 'again', NOW, view.gradeContext);

    assert.equal(evidenceOf(lapsed).retrievals, 0, 'a missed card counted as a retrieval');
    assert.equal(lapsed.lapses, 1, 'the card was not rescheduled at all; this test is reading the wrong thing');
  });
});

describe('typing, and what the app refuses to say about it', () => {
  test('the typed answer comes back with no verdict attached to it', () => {
    const view = cardView(card(), NOW, { ...CARD_START, attempt: 'typed', typed: '  ladition  ' });

    assert.equal(view.echo, 'ladition', 'what the learner typed is not given back to them');
    assert.equal(view.answer?.text, "l'addition, s'il vous plaît", 'the French is there to compare it against');

    // The app does not mark French. Not a tick, not a word, not a colour: a
    // missed accent is not a wrong answer, and a machine deciding it was is a
    // pronunciation score in a different coat.
    const shown = everythingShown(view);
    assert.doesNotMatch(
      shown,
      /\b(correct|incorrect|wrong|almost|nice try|well done|perfect|match(ed)?)\b/i,
      `the card attached a verdict to what the learner typed: ${shown}`,
    );
    for (const key of Object.keys(view)) {
      assert.ok(
        !/verdict|score|correct|colou?r|marked/i.test(key),
        `\`${key}\` is the deck starting to mark French, which is the thing it may not do`,
      );
    }
  });

  test('an empty box is not an attempt, and saying it is always there instead', () => {
    // Revealing on a keystroke would hand out the French for free. Nobody is
    // stuck behind it: "I said it" covers out loud and in the head, on one tap.
    assert.equal(typedAttemptReady(''), false);
    assert.equal(typedAttemptReady('   '), false);
    assert.equal(typedAttemptReady('l'), true);

    const blank = cardView(card(), NOW, { ...CARD_START, attempt: 'typed', typed: '   ' });
    assert.equal(blank.echo, null, 'an empty field was echoed back as though it were an answer');
    assert.equal(blank.revealed, true, 'the attempt still happened; only the echo has nothing to say');
  });
});

describe('the review sitting on screen', () => {
  const screen = stripComments(read('../ReviewScreen.tsx'));

  test('the card the learner sees is the card core said to show', () => {
    // The rule lives in core and is read through one view. A screen that
    // recomputes any part of it is how a deck comes to reveal answers on one
    // surface and ask for them on another.
    assert.match(screen, /cardView\(card, dealtAt\.current, turn\)/, 'the screen no longer renders through the view');
    assert.doesNotMatch(screen, /presentationOf/, 'the screen decides presentation for itself');
    assert.doesNotMatch(screen, /card\.reps|card\.due|frenchSide\(/, 'the screen reads the card behind the view again');
    // The faces the screen prints come off the view and nowhere else.
    assert.doesNotMatch(screen, /\{card\.front\}|\{card\.back\}|card\.context !== ''/, 'the screen prints a card face directly');
  });

  test('a card that comes back in the same sitting is asked for in the same way', () => {
    // "Again" puts the card at the end of the queue with its old due date. A
    // fresh clock read at render would make that second meeting a retrieval or
    // an introduction depending on the minute, which is a coin toss deciding
    // whether the learner is asked to produce anything.
    assert.match(screen, /dealtAt\.current = now/, 'the sitting no longer pins the instant it was dealt');
    assert.match(screen, /dueCards\(deck, now\)/, 'the cards and their presentation are chosen against different clocks');
    const body = screen.slice(screen.indexOf('export function ReviewScreen'));
    assert.equal(
      (body.match(/Date\.now\(\)/g) ?? []).length,
      2,
      'the screen reads the clock somewhere other than the two places that deal the sitting',
    );
  });

  test('every control the attempt adds says what it is and what it does', () => {
    // Phase 3's contract, applied here rather than reinvented: a Pressable
    // with no role is reachable and unannounced, and a field with no name is
    // announced as "text field" and nothing else.
    const controls = tags(screen, 'Pressable');
    assert.ok(controls.length >= 6, `only ${controls.length} controls found; this test is reading the wrong thing`);
    for (const tag of controls) {
      assert.match(tag, /accessibilityRole=/, `a control on the review screen has no role: ${tag.replace(/\s+/g, ' ').slice(0, 80)}`);
      assert.match(tag, /accessibilityLabel=/, `a control on the review screen has no name: ${tag.replace(/\s+/g, ' ').slice(0, 80)}`);
    }
    const fields = tags(screen, 'TextInput');
    assert.equal(fields.length, 1, 'the review screen takes typing somewhere this test is not looking');
    assert.match(fields[0]!, /accessibilityLabel="Your answer in French"/, 'the typing field has no accessible name');
    assert.ok(screen.includes(`accessibilityLabel={TYPE_IT}`), 'the type-it control is not named after what it says');
    assert.ok(screen.includes(`accessibilityLabel={SAID_IT}`), 'the said-it control is not named after what it says');
    assert.equal(TYPE_IT, 'Type it');
    assert.equal(SAID_IT, 'I said it');
  });

  test('the answer is announced when it appears, not silently swapped in', () => {
    // The reveal is triggered by a button at the bottom of the screen and
    // changes a card in the middle of it. Nothing moves focus, so without this
    // the reveal did not happen at all for somebody who cannot see it.
    assert.match(
      screen,
      /AccessibilityInfo\.announceForAccessibility\(announce\)/,
      'the reveal changes the card under a screen reader in silence',
    );
    const revealed = cardView(card(), NOW, { ...CARD_START, attempt: 'said' });
    assert.equal(revealed.announce, "l'addition, s'il vous plaît", 'there is nothing for the screen to announce');
  });

  test('the review sitting has no microphone and takes no recording', () => {
    // Speech is invited and never captured. Recognising a spoken review answer
    // needs a network the deck must never need, and grading one is a
    // pronunciation score by another name. Both are forbidden here, so the
    // ways in are checked rather than trusted.
    for (const reach of [
      'scoreRecordedAttempt',
      'consumeRecording',
      'discardRecording',
      'expo-audio',
      'AudioModule',
      'useAudioRecorder',
      'requestRecordingPermissions',
      'fetch(',
    ]) {
      assert.ok(!screen.includes(reach), `the review screen reaches for ${reach}; the deck works on a plane and stays free`);
    }
    // And nothing on it turns the sitting into a score wall either.
    assert.doesNotMatch(screen, /ProgressBar|percent|streak/i, 'the review screen grew a progress surface');
  });
});
