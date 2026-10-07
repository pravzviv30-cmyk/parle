/**
 * The answer sheet, per verdict (F759; README Part 5.E "Answer sheet", the
 * core-loop review's finding 1 and founder decision D21).
 *
 * The verdicts are core's own, from a real `answerCurrent` on a real sitting,
 * so a change in what core hands over on a first miss (nothing, by design) is
 * met here rather than assumed. The sheet's model is pure and runs; the screen
 * and the sheet component are read as text, because this workspace has no
 * renderer (docs/TESTING.md).
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { answerCurrent, type DrillExercise, type DrillFeedback, type DrillSessionState } from '@luvani/core';

import { streakGuiltIn } from '../copy/guilt.ts';
import type { SfxId } from '../sound/sfxIds.ts';
import {
  GOOD_LINES,
  RUN_LINES,
  SAID_IT_LINE,
  SHEET_AUTO_MS,
  SHEET_COPY,
  continueName,
  ownWordsLook,
  sheetArrival,
  sheetFor,
  type AnswerSheetModel,
  type SheetHaptic,
} from './answerSheet.ts';
import { comboAfter } from './combo.ts';
import { fireSheet } from './sheetEffects.ts';

const NOW = new Date(2026, 9, 6, 12).getTime();

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);

const listen = (over: Partial<DrillExercise> = {}): DrillExercise =>
  ({ id: 'gen:listen', phraseKey: 'phrase:ça marche', kind: 'listen-type', difficulty: 'production', fr: 'Ça marche', accepted: ['ça marche'], ...over }) as DrillExercise;

const sitting = (queue: DrillExercise[]): DrillSessionState => ({ queue, missesById: {}, answered: [], startedAt: NOW, finished: false });

/** Core's feedback for one answer, then the sheet the drill draws for it. */
function sheetOf(fb: DrillFeedback, kind: DrillExercise['kind'], screenReader: boolean | null, combo = 1, turn = 0): AnswerSheetModel {
  return sheetFor({ verdict: fb.verdict, closest: fb.closest, advanced: fb.advanced, kind, combo, turn, screenReader });
}

function feedback(state: DrillSessionState, answer: string): { state: DrillSessionState; fb: DrillFeedback } {
  const { state: next, feedback: fb } = answerCurrent(state, answer);
  assert.ok(fb !== null, 'core gave no feedback for a settled answer');
  return { state: next, fb };
}

/** Every line a sheet can say: plain English, no digit, no dash or middot, no guilt, no French praise. */
function assertWarm(line: string): void {
  assert.doesNotMatch(line, /\d/, `"${line}" carries a digit mid-sitting`);
  assert.doesNotMatch(line, /[—–·]/, `"${line}" carries a dash or a middot`);
  assert.equal(streakGuiltIn(line), undefined, `"${line}" scolds or threatens`);
  assert.doesNotMatch(line, /\b(wrong|incorrect|bad|failed|nickel|bravo|parfait|presque)\b/i, `"${line}" scolds or praises in French`);
}

describe('the answer sheet — F759', () => {
  test('a good answer, a typo and a miss each get their own sheet, and a screen reader never auto-advances', () => {
    // A pass: mint, a check, a warm line from the rotation, `correct` and
    // `arrived()`, and on by itself after the sheet's time.
    const good = sheetOf(feedback(sitting([listen()]), 'ça marche').fb, 'listen-type', false);
    assert.equal(good.tone, 'good');
    assert.ok((GOOD_LINES as readonly string[]).includes(good.headline), `"${good.headline}" is not one of the good lines`);
    assert.equal(good.mark, true);
    assert.equal(good.sound, 'correct');
    assert.equal(good.haptic, 'arrived');
    assert.equal(good.autoAdvanceMs, SHEET_AUTO_MS);
    assert.equal(SHEET_AUTO_MS, 1400);
    // The line rotates by the answer's place, deterministically, and a run of
    // three real passes rotates the run lines instead.
    const lines = new Set(GOOD_LINES.map((_, turn) => sheetOf(feedback(sitting([listen()]), 'ça marche').fb, 'listen-type', false, 1, turn).headline));
    assert.equal(lines.size, GOOD_LINES.length, 'the good line does not rotate through all six');
    assert.deepEqual([...GOOD_LINES], ['Nicely done.', "That's right.", 'Spot on.', 'Exactly.', "Yes, that's it.", 'Good one.']);
    assert.deepEqual([...RUN_LINES], ['On a roll.', "You're in the flow.", 'Smooth.']);
    const run = sheetOf(feedback(sitting([listen()]), 'ça marche').fb, 'listen-type', false, 3, 4);
    assert.ok((RUN_LINES as readonly string[]).includes(run.headline), 'a run of three still reads an ordinary good line');
    // A repeat-this is the learner's own word: "You said it.", never praise for accuracy.
    const repeat = listen({ id: 'gen:repeat', kind: 'repeat-this', reference: 'Ça marche', referenceEn: 'that works', ipa: null } as Partial<DrillExercise>);
    const said = sheetOf(feedback(sitting([repeat]), 'Ça marche').fb, 'repeat-this', false, 5);
    assert.equal(said.headline, SAID_IT_LINE);
    assert.equal(said.headline, 'You said it.');

    // A typo the drill accepted: sun, the check, the real spelling, `nearly` and `soft()`.
    const typo = sheetOf(feedback(sitting([listen()]), 'ça marchee').fb, 'listen-type', false);
    assert.equal(typo.tone, 'nearly');
    assert.equal(typo.headline, 'Nearly.');
    assert.equal(typo.detail, "It's spelt «ça marche». That one counts.");
    assert.equal(typo.mark, true);
    assert.equal(typo.sound, 'nearly');
    assert.equal(typo.haptic, 'soft');
    assert.ok(typo.autoAdvanceMs !== null);

    // A first miss: core hands nothing over, so the sheet says only that it comes round again.
    const first = feedback(sitting([listen()]), 'je ne sais pas');
    assert.equal(first.fb.closest, null, 'core handed the answer over on a first miss, so the retry tests nothing');
    assert.equal(first.fb.advanced, false);
    const firstSheet = sheetOf(first.fb, 'listen-type', false);
    assert.equal(firstSheet.tone, 'calm');
    assert.equal(firstSheet.headline, 'This one comes round again.');
    assert.equal(firstSheet.french, null, 'a first miss shows French it was never given');
    assert.equal(firstSheet.detail, null);
    assert.ok(firstSheet.autoAdvanceMs !== null, 'a first miss has nothing to read, so it has no reason to wait');

    // The second miss moves on, so now the form is shown, and it waits for Continue.
    const second = sheetOf(feedback(first.state, 'toujours pas').fb, 'listen-type', false);
    assert.equal(second.tone, 'calm');
    assert.equal(second.headline, "Here's how it goes.");
    assert.equal(second.french, 'ça marche');
    assert.equal(second.after, "It'll come back in your review.");
    assert.equal(second.autoAdvanceMs, null, 'the second miss moves on before the learner has read the French');

    // Own words, keyed on core's decision: "That works.", "Nearly there." in the nearly tone (D21), the reveal calm.
    assert.deepEqual(ownWordsLook('good'), { tone: 'good', headline: 'That works.', mark: true, sound: 'correct', haptic: 'arrived' });
    assert.deepEqual(ownWordsLook('retry'), { tone: 'nearly', headline: 'Nearly there.', mark: false, sound: 'nearly', haptic: 'soft' });
    assert.deepEqual(ownWordsLook('reveal'), { tone: 'calm', headline: "Here's one way to say it.", mark: false, sound: null, haptic: null });
    assert.deepEqual(ownWordsLook(null), { tone: null, headline: null, mark: false, sound: null, haptic: null });

    // A screen reader on, or not yet known to be off: nothing moves on by itself.
    for (const reader of [true, null] as const) {
      for (const sheet of [
        sheetOf(feedback(sitting([listen()]), 'ça marche').fb, 'listen-type', reader),
        sheetOf(feedback(sitting([listen()]), 'ça marchee').fb, 'listen-type', reader),
        sheetOf(first.fb, 'listen-type', reader),
        sheetOf(feedback(sitting([repeat]), 'Ça marche').fb, 'repeat-this', reader),
      ]) {
        assert.equal(sheet.autoAdvanceMs, null, `"${sheet.headline}" moved on by itself under a screen reader (${String(reader)})`);
      }
    }

    // Every line is warm plain English.
    for (const line of [...GOOD_LINES, ...RUN_LINES, SAID_IT_LINE, SHEET_COPY.typo, SHEET_COPY.typoDetail('x'), SHEET_COPY.firstMiss, SHEET_COPY.secondMiss, SHEET_COPY.secondMissAfter, SHEET_COPY.continue]) {
      assertWarm(line);
    }

    // The drill draws this model and nothing of its own: the sheet's pace is
    // the model's, read with the live screen reader answer, and a sheet that
    // waits carries its own Continue, so the drill's pill count is unchanged.
    const screen = stripComments(read('../DrillScreen.tsx')).replace(/\s+/g, ' ');
    assert.match(screen, /const screenReader = useScreenReader\(\);/, 'the drill does not watch the screen reader');
    assert.match(screen, /sheetFor\(\{ verdict: feedback\.verdict, closest: feedback\.closest, advanced: feedback\.advanced, \.\.\.sheetFacts, screenReader \}\)/, 'the sheet on screen is not the model read with the live screen reader');
    assert.match(screen, /const autoAdvanceMs = sheet\?\.autoAdvanceMs \?\? null;/);
    assert.match(screen, /if \(!feedback \|\| autoAdvanceMs === null\) return; const t = setTimeout\(advance, autoAdvanceMs\);/, 'the drill moves on by a clock of its own');
    assert.doesNotMatch(screen, /FEEDBACK_MS/, 'the old fixed beat is back beside the sheet');
    assert.match(screen, /<AnswerSheet key=\{beatRef\.current\} sheet=\{sheet\} note=\{focusLine\} onContinue=\{advance\} \/>/);
    const sheetFile = stripComments(read('./AnswerSheet.tsx')).replace(/\s+/g, ' ');
    assert.match(sheetFile, /const waits = sheet\.autoAdvanceMs === null;/);
    assert.match(sheetFile, /\{waits \? \( <> \{body\} <PillButton ref=\{continueRef\} label=\{SHEET_COPY\.continue\} accessibilityLabel=\{named\} onPress=\{onContinue\} \/> <\/> \)/, 'a sheet that waits has no Continue');
  });

  test('a miss draws no mark, plays no sound and fires no haptic', () => {
    const first = feedback(sitting([listen()]), 'je ne sais pas');
    const second = feedback(first.state, 'toujours pas');
    const heard: (SfxId | SheetHaptic)[] = [];
    const players = { play: (id: SfxId) => heard.push(id), haptic: (kind: SheetHaptic) => heard.push(kind) };

    for (const fb of [first.fb, second.fb]) {
      assert.equal(fb.verdict, 'miss');
      for (const reader of [false, true] as const) {
        const sheet = sheetOf(fb, 'listen-type', reader);
        assert.equal(sheet.mark, false, 'a miss draws a mark');
        assert.equal(sheet.sound, null, 'a miss plays a sound');
        assert.equal(sheet.haptic, null, 'a miss fires a haptic');
        assert.notEqual(sheet.tone, 'good');
        fireSheet(sheet, players);
      }
    }
    // The own-words reveal is a miss too.
    fireSheet(ownWordsLook('reveal'), players);
    assert.deepEqual(heard, [], `a miss reached the device: ${heard.join(', ')}`);

    // And a pass does reach it, so the silence above is the rule and not a dead seam.
    fireSheet(sheetOf(feedback(sitting([listen()]), 'ça marche').fb, 'listen-type', false), players);
    fireSheet(sheetOf(feedback(sitting([listen()]), 'ça marchee').fb, 'listen-type', false), players);
    assert.deepEqual(heard, ['correct', 'arrived', 'nearly', 'soft']);

    // A miss ends the run quietly.
    assert.equal(comboAfter(4, 'miss', 'listen-type'), 0);

    // The sheet draws its check only from the model, and the drill reaches
    // sound and haptics for an answer only through the sheet's own effects.
    const sheetFile = stripComments(read('./AnswerSheet.tsx'));
    assert.match(sheetFile, /\{sheet\.mark && \(/, 'the sheet draws its mark from something other than the model');
    assert.equal((sheetFile.match(/<CheckGlyph\b/g) ?? []).length, 1);
    assert.doesNotMatch(sheetFile, /from '\.\.\/sound\/sfx\.ts'|from '\.\.\/motion\/haptics\.ts'/, 'the sheet plays something itself');
    const screen = stripComments(read('../DrillScreen.tsx'));
    assert.doesNotMatch(screen, /\bplay\(|from '\.\/sound\/sfx\.ts'/, 'the drill plays a sound beside the sheet');
    assert.doesNotMatch(screen, /\b(arrived|soft|celebrate)\(\)/, 'the drill fires a haptic beside the sheet');
    const answer = screen.slice(screen.indexOf('const answer = useCallback('), screen.indexOf('const spoke = useCallback('));
    assert.match(answer, /fireSheet\(sheetFor\(/, 'an answer does not fire its sheet\'s effects');
    // The own-words card: no mark for a retry or a reveal.
    const view = screen.slice(screen.indexOf('function OwnWordsView('), screen.indexOf('export function DrillScreen('));
    assert.match(view, /\{look\.mark && \(/, 'the own-words card draws its mark from something other than the decision');
  });
});

describe('a waiting answer sheet takes the screen reader with it — F775', () => {
  test('a waiting answer sheet moves screen-reader focus to Continue', () => {
    const first = feedback(sitting([listen()]), 'je ne sais pas');
    const second = sheetOf(feedback(first.state, 'toujours pas').fb, 'listen-type', false);
    const good = sheetOf(feedback(sitting([listen()]), 'ça marche').fb, 'listen-type', false);
    assert.equal(second.autoAdvanceMs, null, 'the second miss no longer waits, so this reads nothing');
    assert.ok(good.autoAdvanceMs !== null);

    // On a phone, a sheet that waits moves the reader onto its Continue; one
    // that moves on by itself is said and leaves focus where it is.
    assert.equal(sheetArrival(second, false), 'focus-continue', 'the second miss leaves the reader on an answer that has gone');
    assert.equal(sheetArrival(good, false), 'announce');
    // A screen reader on, or not yet known to be off: every sheet waits, so every one takes focus to Continue.
    for (const reader of [true, null] as const) {
      for (const sheet of [
        sheetOf(feedback(sitting([listen()]), 'ça marche').fb, 'listen-type', reader),
        sheetOf(feedback(sitting([listen()]), 'ça marchee').fb, 'listen-type', reader),
        sheetOf(first.fb, 'listen-type', reader),
      ]) {
        assert.equal(sheetArrival(sheet, false), 'focus-continue', `"${sheet.headline}" leaves a screen reader behind (${String(reader)})`);
      }
    }
    // On the web nothing is moved: the live region speaks.
    for (const sheet of [second, good]) assert.equal(sheetArrival(sheet, true), 'live-region');

    // Continue carries the whole sheet, so landing on it says the sheet once,
    // in reading order, and then what the button does.
    const spoken = "Here's how it goes. ça marche It'll come back in your review.";
    assert.equal(continueName(spoken), `${spoken} Continue`);
    assertWarm(continueName("Here's how it goes. It'll come back in your review."));

    // The sheet does what the decision says: the waiting Continue holds a ref,
    // and on a phone, once the sheet has risen, focus is moved onto it through
    // its native handle. If there is no handle, the sheet is announced instead.
    const sheetFile = stripComments(read('./AnswerSheet.tsx')).replace(/\s+/g, ' ');
    assert.match(sheetFile, /const continueRef = useRef<View>\(null\);/, 'the sheet holds no ref to its Continue');
    assert.match(sheetFile, /const arrival = sheetArrival\(sheet, Platform\.OS === 'web'\);/, 'the sheet decides its arrival some other way');
    assert.match(sheetFile, /const named = continueName\(spoken\);/, 'Continue is not named for the sheet');
    assert.match(sheetFile, /<PillButton ref=\{continueRef\} label=\{SHEET_COPY\.continue\} accessibilityLabel=\{named\} onPress=\{onContinue\} \/>/, 'the waiting Continue cannot be focused, or is not named for the sheet');
    const effect = sheetFile.slice(sheetFile.indexOf('useEffect(() => {'), sheetFile.indexOf('}, [spoken, arrival]);'));
    assert.ok(effect.length > 0, 'the arrival effect moved; this test is stale');
    assert.match(effect, /if \(arrival === 'live-region'\) return undefined;/, 'the web moves focus or announces over its own live region');
    assert.match(
      effect,
      /if \(arrival === 'focus-continue' && !placed\.current\) \{ const timer = setTimeout\(\(\) => \{ placed\.current = true; const handle = findNodeHandle\(continueRef\.current\); if \(handle\) AccessibilityInfo\.setAccessibilityFocus\(handle\); else AccessibilityInfo\.announceForAccessibility\(spoken\); \}, DUR\.fast\); return \(\) => clearTimeout\(timer\); \}/,
      'a waiting sheet does not move the screen reader onto Continue once it has risen',
    );
    assert.ok(effect.indexOf('setAccessibilityFocus') < effect.lastIndexOf('AccessibilityInfo.announceForAccessibility(spoken); return undefined;'), 'a sheet that moves on by itself is no longer announced');
    // The tap-to-move-on sheet is named the same way, so both say the sheet before the word.
    assert.match(sheetFile, /<Pressable onPress=\{onContinue\} accessibilityRole="button" accessibilityLabel=\{named\}/, 'the tap-to-move-on sheet is named some other way');

    // PillButton hands the ref to its press, and the press to the pressable that a reader lands on.
    const components = stripComments(read('../components.tsx')).replace(/\s+/g, ' ');
    const pill = components.slice(components.indexOf('export function PillButton('), components.indexOf('export function OutlineButton('));
    assert.match(pill, /ref\?: Ref<View>;/, 'PillButton takes no ref');
    assert.match(pill, /<Press haptic="light"[^>]*ref=\{ref\}>/, 'PillButton does not hand its ref to the press');
    const pressProps = components.slice(components.indexOf('export type PressProps'), components.indexOf('export type Ground'));
    assert.match(pressProps, /ref\?: Ref<View>;/, 'Press drops a ref before it reaches the pressable');
    const press = components.slice(components.indexOf('export function Press('), components.indexOf('function SelectRing('));
    assert.match(press, /children, \.\.\.rest \}: PressProps\)/, 'the press no longer passes the rest of its props on');
    assert.match(press, /<Pressable accessibilityRole="button" \{\.\.\.rest\}/, 'the press does not pass the ref on to its pressable');
  });
});
