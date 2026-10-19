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
const STORY_HOME = stripComments(read('../progress/WeekWrappedScreen.tsx'));
/** The one module Home hands the story to, which never imports it. */
const STORY_LINES = '';
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
    // M2/M3 puts the full story behind the learner-opened weekly route.
    // Its evidence/privacy rule remains one owner, whole inputs and no push.
    assert.match(STORY_HOME, /import \{[^}]*storyFrom[^}]*\} from '\.\/story\.ts'/);
    for (const load of ['loadHistory()', 'loadActivity({ strict: true })', 'loadConversationPacks()', 'loadMissionCompletions()']) {
      assert.ok(STORY_FLAT.includes(load), `the story never reads ${load}`);
    }
    assert.match(STORY_FLAT, /storyFrom\(\{sessions,activity,packs,completions,now\}\)/);
    for (const input of ['sessions', 'activity', 'packs', 'completions']) {
      assert.doesNotMatch(STORY_FLAT, new RegExp(`${input}\\s*\\.\\s*(filter|slice|sort|reverse)\\b`));
    }
    // The first sentence and the remaining sentences are shown in module order.
    assert.match(STORY_HOME, /model.story.sentences\[0\]/);
    assert.match(STORY_HOME, /model.story.sentences.slice\(1\).map/);
    assert.doesNotMatch(STORY_HOME, /story.sentences\.(sort|reverse|filter|join)\(/);
    for (const owned of ['unassistedRate', 'wordsProduced', 'MAX_STORY_SENTENCES', 'DAYS_IN_THE_STORY']) assert.ok(!STORY_HOME.includes(owned), owned);
    assert.match(STORY_FLAT, /const populated=current && model!==null && hasStory\(model.story\)/);
    assert.match(STORY_HOME, /if \(!live \|\| owner !== scopeGeneration\(\)\) return/);
    assert.match(STORY_HOME, /readOwner===scopeGeneration\(\)/);
    assert.match(read('../tabs/MyFrenchTab.tsx'), /navigate\('WeekWrapped'\)/);
    for (const [name, source] of [['Profile', FLAT], ['weekly route', STORY_FLAT]] as const) {
      assert.doesNotMatch(source, /from '[^']*\/reminders\//, name);
      assert.doesNotMatch(source, /expo-notifications|scheduleNotification|sendEmail/, name);
    }
    const storyModule = join('progress', 'story.ts');
    const readers = sourceFiles(SRC)
      .filter(path => !path.endsWith(storyModule))
      .filter(path => { const source = stripComments(readFileSync(path, 'utf8')); return /from '[^']*progress\/story\.ts'/.test(source) || (path.includes(join('progress', '')) && /from '\.\/story\.ts'/.test(source)); })
      .map(path => path.slice(SRC.length));
    assert.deepEqual(readers, ['progress/WeekWrappedScreen.tsx'], 'the full week belongs only to its learner-opened route, never a background sender');
    assert.ok(!CARD.includes('storyFrom') && !CARD.includes('hasStory'));

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
