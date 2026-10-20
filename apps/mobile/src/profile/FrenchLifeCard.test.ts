/**
 * The week on Profile, and the story inline on Home — F233, F561, F576, F577.
 *
 * ## The name on the front of this test
 *
 * It is byte-identical to the one three ticked ledger entries name (F233, F348,
 * F561), and `scripts/gate.mjs` refuses a tick whose named test did not run, so
 * it cannot be changed from here. The title names an older placement. The story
 * now belongs to Home alone: Home loads the four inputs, builds the story, and
 * hands it to `home/todayView.ts`, which turns it into at most two sentences.
 * (Until the notebook final sweep, 2026-09-27, `progress/ProgressScreen.tsx`
 * was a second permitted importer; it had had no renderer since the Phase 3
 * Today rebuild and is deleted.) The privacy and no-delta rules the ledger
 * entries were filed for are still checked on their actual owners.
 *
 * ## What is checked, and why it is split over two files
 *
 * `progress/story.ts` decides everything about the week and something has to
 * draw it. The positive half is small on purpose: four reads, one call, one
 * hand-off. Every assertion with weight in it is about what the drawing surface
 * must *not* have grown, and about "only": every non-test file under `src/` is
 * read, comments stripped, and the set of files that import `progress/story.ts`
 * has to be exactly Home. That proves no other module can see the week, so
 * nothing scheduled, backgrounded or notified can carry it anywhere. The other
 * half of "never pushed" is enforced from the far side, by
 * `reminders/reminder.test.ts` refusing any module under `reminders/` the
 * ability to import `progress/`. Neither test alone is the promise; the pair is.
 *
 * What is left on Profile is the week in one plain sentence (notebook Phase 4,
 * 2026-09-27; it was a seven-dot rail), with no number anywhere.
 * `FrenchLifeCard.tsx` kept its name because every test that reads it reads it
 * by name, and this is one of them.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { guiltIn } from '../copy/guilt.ts';
import { FRENCH_LIFE_COPY } from './frenchLife.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Comments may say anything; only what reaches glass is under test. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const CARD = stripComments(read('./FrenchLifeCard.tsx'));
const FLAT = CARD.replace(/\s+/g, ' ');
const STORY_HOME = stripComments(read('../tabs/HomeTab.tsx'));
/** The one module Home hands the story to, which never imports it. */
const STORY_LINES = stripComments(read('../home/todayView.ts'));
const STORY_SCREEN = `${STORY_HOME}\n${STORY_LINES}`;
const STORY_FLAT = STORY_SCREEN.replace(/\s+/g, ' ');
const COMPONENTS = stripComments(read('../components.tsx'));

/** src/, so "reached from one place" can be counted rather than asserted. */
const SRC = fileURLToPath(new URL('..', import.meta.url));

/** Every non-test source file under src/. Tests are not a way in for a learner. */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe("the week on Profile — F561, F577, and F233's importer count", () => {
  test('the Profile card is the one importer of the story, and the rhythm rail names no number', () => {
    // ─────────────────────────────── the story, on the screen that holds it now
    //
    // One surface builds it, from the module that owns every word of it, and
    // hands it on to the one function that turns it into lines. That function
    // states the story's shape itself rather than importing the module, so the
    // importer count below stays one.
    // 2026-10-20, B5, B-Today: Today no longer reads the week story. Its week
    // is the blue "Your week in French" card, two plain sums from saved
    // conversations and the deck (`weekInFrench` in home/todayView.ts), drawn
    // only when the week has evidence. The story's sentence rules stay with
    // its remaining readers, and todayView.ts still never imports it.
    assert.doesNotMatch(STORY_HOME, /from '[^']*progress\/story\.ts'|storyFrom\(/, 'Today reads the week story again');
    assert.doesNotMatch(STORY_LINES, /from '[^']*story\.ts'/, 'todayView.ts imports the story module');
    assert.match(STORY_FLAT, /setWeek\(weekInFrench\(\{ packs, deck, now \}\)\)/, "Today's week is not the two sums from the saved conversations and the deck");
    // 2026-10-20 UI-008, artboard B-Today: the blue card is the B WeekCard part.
    assert.match(STORY_FLAT, /\{week !== null && \( <WeekCard /, 'the week card is drawn on a week with no evidence');
    assert.doesNotMatch(STORY_FLAT, /week !== null \? /, 'a quiet week draws something else in the week slot');
    assert.ok(!STORY_HOME.includes('story.sentences'), 'Today reaches into the story sentences');

    // Neither surface can carry the week anywhere. The path ban is the half
    // `reminders/reminder.test.ts` cannot see from its own side.
    for (const [name, source] of [['the Profile card', FLAT], ['Today', STORY_FLAT]] as const) {
      assert.doesNotMatch(source, /from '[^']*\/reminders\//, `${name} reaches into the reminders layer`);
      assert.doesNotMatch(source, /expo-notifications/, `${name} reaches for the notification API`);
    }

    // And "only". Home, never a background reader. (The inline details
    // component that was the second importer left with the notebook final
    // sweep, 2026-09-27; nothing had rendered it since Phase 3.)
    const storyModule = join('progress', 'story.ts');
    const readers = sourceFiles(SRC)
      .filter((path) => !path.endsWith(storyModule))
      .filter((path) => { const source = stripComments(readFileSync(path, 'utf8')); return /from '[^']*progress\/story\.ts'/.test(source) || (path.includes(join('progress', '')) && /from '\.\/story\.ts'/.test(source)); })
      .map((path) => path.slice(SRC.length));
    assert.deepEqual(
      readers,
      // 2026-10-20, B4, B-Journey: Journey's view model reads the story's own
      // independence sentence for "Help you needed", on the same learner-opened tab.
      // 2026-10-20, B5, B-Today: Today left the list; its week card sums saved
      // conversations and the deck instead.
      ['journey/journeyView.ts', 'progress/WeekWrappedScreen.tsx', 'tabs/MyFrenchTab.tsx'],
      'the story is read only on learner-opened surfaces, never in notifications',
    );
    // Profile is not that file any more, and half a move is worse than either
    // end of it: two surfaces drawing one week are two weeks to keep in step.
    assert.ok(!CARD.includes('storyFrom') && !CARD.includes('hasStory'), 'the Profile card still builds the week story as well');

    // ───────────────────────────────────── the rhythm, on the card that is left
    //
    // Monday to Sunday, from the activity log, decided by the module and drawn
    // here. Which seven days count and which of them are done is
    // `calendarWeekFrom`'s judgement, and there is no second opinion on the card.
    assert.match(FLAT, /setWeek\(calendarWeekFrom\(activity, Date\.now\(\)\)\)/, "the week is not the momentum module's own calendar");
    // 2026-09-27, notebook Phase 4 (B2): the rail left Profile and the week is
    // one plain sentence, the module's own, on one white card. Stricter than
    // the pins it replaces: no rail, no tint, no caption, one line of words.
    assert.match(FLAT, /<Text style=\{st\.sentence\}>\{rhythmSentence\(week\)\}<\/Text>/, 'the week is not said as the momentum module\'s one sentence');
    assert.doesNotMatch(FLAT, /<WeekRail\b|<TintPanel\b|RHYTHM_TINT|WEEK_CAPTION|WEEKDAY_LABELS/, 'the week is still drawn as a rail, on a tint, or under a caption');
    assert.equal((CARD.match(/<Text\b/g) ?? []).length, 1, 'the week card says more than one thing');
    assert.match(FLAT, /if \(week === null\) return null;/, 'an unanswered read draws an empty week at somebody whose week is on its way');
    for (const meddling of ['.sort(', '.slice(', '.reverse(', '.filter(', '.length']) {
      assert.ok(!CARD.includes(`week${meddling}`), `the card writes week${meddling}`);
    }
    assert.doesNotMatch(
      FLAT,
      /activity\s*\.\s*(filter|slice|sort|reverse)\b/,
      "the card narrows the activity log before calendarWeekFrom sees it; which days count is that module's decision",
    );

    // The sentence is the module's, in words, and it is the same sentence a
    // screen reader hears: there is no hidden picture beside it any more.
    assert.ok(!CARD.includes('accessibilityLabel='), 'the card says one thing to the eye and another to a screen reader');

    // The rail itself is gone (notebook final sweep, 2026-09-27). Its last live
    // caller was the retired French wall page; the week is a sentence wherever
    // a learner meets it, so nothing may draw seven marks again.
    assert.doesNotMatch(COMPONENTS, /export function WeekRail\b/, 'components.tsx exports the week rail again');
    assert.doesNotMatch(COMPONENTS, /\bmarkDone\b|\bmarkWaiting\b/, 'the rail\'s mark styles are back in the sheet');

    // Words a learner reads: ink, no digit typed here, no banned word, no em
    // dash, and nothing on the card counting anything.
    assert.doesNotMatch(FLAT.replace(/space\([\d.]+\)/g, ''), /\d/, 'the card types a number of its own; every digit about a week comes from a module');
    for (const line of FRENCH_LIFE_COPY) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries "${guiltIn(line)}"`);
      assert.doesNotMatch(line, /\d|%|—/, `"${line}" counts, marks a percentage or dashes`);
      // A weekday is the momentum module's to name (`WEEKDAY_LABELS`), and the
      // sentence never names one. A heading or a caption naming a day is this
      // card having an opinion about it.
      assert.doesNotMatch(
        line,
        /\b(mon|tue|wed|thu|fri|sat|sun)(day|sday|nesday|rsday|urday)?s?\b/i,
        `"${line}" names a day of the week, which is the module's to name and not the card's to say`,
      );
    }
    assert.ok(!CARD.includes('inkFaint'), 'a sentence a learner reads is set in the faint ink');
  });
});
