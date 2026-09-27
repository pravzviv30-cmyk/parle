/**
 * The week on Profile, and the story inline on Home — F233, F561, F576, F577.
 *
 * ## The name on the front of this test
 *
 * It is byte-identical to the one three ticked ledger entries name (F233, F348,
 * F561), and `scripts/gate.mjs` refuses a tick whose named test did not run, so
 * it cannot be changed from here. The title names an older placement. The story
 * now belongs to Home: Home loads the four inputs and ProgressScreen.tsx exports
 * its inline disclosure component, not a navigation destination. Those two
 * files are the only permitted story importers. The privacy and no-delta rules
 * the ledger entries were filed for are still checked on their actual owners.
 *
 * ## What is checked, and why it is split over two files
 *
 * `progress/story.ts` decides everything about the week and something has to
 * draw it. The positive half is small on purpose: four reads, a gate, a map.
 * Every assertion with weight in it is about what the drawing surface must
 * *not* have grown, and about "only": every non-test file under `src/` is read,
 * comments stripped, and the set of files that import `progress/story.ts` has
 * to be exactly Home and its inline disclosure. That proves no other module can see the week,
 * so nothing scheduled, backgrounded or notified can carry it anywhere. The
 * other half of "never pushed" is enforced from the far side, by
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
const STORY_DETAILS = stripComments(read('../progress/ProgressScreen.tsx'));
const STORY_SCREEN = `${STORY_HOME}\n${STORY_DETAILS}`;
const STORY_FLAT = STORY_SCREEN.replace(/\s+/g, ' ');
const RAIL = stripComments(read('../components.tsx'));

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
    // One surface draws it, and the module that owns every word of it is
    // imported whole, with both of its doors.
    assert.match(STORY_HOME, /import \{[^}]*storyFrom[^}]*\} from '\.\.\/progress\/story\.ts'/);
    assert.match(STORY_DETAILS, /import \{[^}]*hasStory[^}]*\} from '\.\/story\.ts'/);

    // All four inputs, whole, with a passed clock. Narrowing is the module's
    // job, and doing it here is how the no-delta guarantee gets bypassed one
    // commit later.
    for (const load of ['loadHistory()', 'loadActivity()', 'loadConversationPacks()', 'loadMissionCompletions()']) {
      assert.ok(STORY_FLAT.includes(load), `the screen never reads ${load}, so the story is built from less than the week`);
    }
    assert.match(
      STORY_FLAT,
      /storyFrom\(\{ sessions: history, activity, packs, completions, now \}\)/,
      'the story is not built from the four loaded inputs and a passed clock; `now` is required, not defaulted',
    );
    for (const input of ['history', 'activity', 'packs', 'completions']) {
      assert.doesNotMatch(
        STORY_FLAT,
        new RegExp(`${input}\\s*\\.\\s*(filter|slice|sort|reverse)\\b`),
        `the screen narrows ${input} before storyFrom sees it; narrowing is that module's job and its guarantee`,
      );
    }

    // Drawn as it arrives, ordered and capped by the module. A surface that
    // sorts or slices is a second opinion about a week.
    assert.match(STORY_SCREEN, /story\.sentences\.map\(/, 'the screen never draws the sentences the module built');
    for (const meddling of ['.sort(', '.slice(', '.reverse(', '.join(', '.filter(', '.length']) {
      assert.ok(!STORY_SCREEN.includes(`story.sentences${meddling}`), `the screen writes story.sentences${meddling}`);
    }
    assert.ok(
      !STORY_SCREEN.includes('[...story.sentences]'),
      'the screen copies the sentences, which is only ever done to reorder or trim them',
    );
    for (const owned of ['unassistedRate', 'wordsProduced', 'MAX_STORY_SENTENCES', 'DAYS_IN_THE_STORY']) {
      assert.ok(!STORY_SCREEN.includes(owned), `the screen names ${owned} itself; what a week contained is story.ts's judgement`);
    }

    // Nothing at all on a quiet week. The gate is on the block it holds back,
    // and there is no other branch: a surface that can render empty is a quota,
    // and a quota nobody met is guilt. F55's spirit, and the reason the old
    // invitation line left with the sentences rather than following them.
    assert.match(STORY_DETAILS, /const hasWeek = story !== null && hasStory\(story\)/);
    assert.match(STORY_DETAILS, /\{hasWeek && <TintPanel[^]*story\.sentences\.map\(/,
      'the inline story must still be gated by a nonempty week');
    assert.match(STORY_DETAILS, /\{expanded && <View/,
      'the full story only appears when the learner asks for it');
    assert.doesNotMatch(
      STORY_FLAT,
      /hasStory\(story\)[\s\S]{0,400}\) : \(/,
      'a quiet week draws something else in the story block, so the block is a slot that can read as empty',
    );

    // Neither surface can carry the week anywhere. The path ban is the half
    // `reminders/reminder.test.ts` cannot see from its own side.
    for (const [name, source] of [['the Profile card', FLAT], ['the Progress screen', STORY_FLAT]] as const) {
      assert.doesNotMatch(source, /from '[^']*\/reminders\//, `${name} reaches into the reminders layer`);
      assert.doesNotMatch(source, /expo-notifications/, `${name} reaches for the notification API`);
    }

    // And "only". Home and its inline disclosure, never a background reader.
    const storyModule = join('progress', 'story.ts');
    const readers = sourceFiles(SRC)
      .filter((path) => !path.endsWith(storyModule))
      .filter((path) => /from '[^']*progress\/story\.ts'|from '\.\/story\.ts'/.test(stripComments(readFileSync(path, 'utf8'))))
      .map((path) => path.slice(SRC.length));
    assert.deepEqual(
      readers,
      ['progress/ProgressScreen.tsx', 'tabs/HomeTab.tsx'],
      'only Home and its inline detail component may read the story; no background or notification importer',
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

    // The rail itself, still in components.tsx for the screens that have not
    // yet dropped it: seven marks, a picture, no count and no words of its own.
    const rail = RAIL.slice(RAIL.indexOf('export function WeekRail('), RAIL.indexOf('export function TintRow('));
    assert.ok(rail.length > 0, 'components.tsx no longer exports WeekRail');
    // The rail draws day names now (F577) and nothing else. Every Text in it is
    // the caller's own label, so the rail still holds no sentence of its own and
    // still cannot say a count: a word it writes itself is a word nobody passed it.
    for (const text of rail.match(/<Text[\s\S]*?<\/Text>/g) ?? []) {
      assert.match(text, /\{labels\[index\]\}/, `the rail writes words of its own: ${text.replace(/\s+/g, ' ')}`);
    }
    assert.doesNotMatch(rail, /\d/, 'the rail types a digit of its own');
    assert.match(rail, /accessibilityElementsHidden/, 'the rail reaches a screen reader as seven unnamed views');
    // Violet, and deliberately so: the founder chose the identity colour for the
    // calendar record (F577). A day already spent is a diary entry, not a state
    // being reported, so the rule that no state mark is violet is not bent here.
    assert.match(RAIL, /markDone: \{ backgroundColor: accent\.primary \}/, 'a day that happened is not the filled violet mark the founder chose for the calendar');
    // The waiting day is an empty slot, drawn as the mockup's outline dot: the
    // card's own white under a hairline ring. The white is not a signal, it is
    // the paper a card is made of, and it is what makes the dot visible on this
    // card's lilac panel at all. A hairline ring alone sat at a hair's contrast
    // from the tint and seven days of the week were simply not on screen.
    assert.match(
      RAIL,
      /markWaiting: \{ backgroundColor: paper\.card, borderWidth: HAIRLINE \+ 0\.4, borderColor: paper\.line \}/,
      'a day that has not happened is filled with a colour that means something, or has no paper under it on the tint',
    );

    // Words a learner reads: ink, no digit typed here, no banned word, no em
    // dash, and nothing on the card counting anything.
    assert.doesNotMatch(FLAT.replace(/space\([\d.]+\)/g, ''), /\d/, 'the card types a number of its own; every digit about a week comes from a module');
    for (const line of FRENCH_LIFE_COPY) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries "${guiltIn(line)}"`);
      assert.doesNotMatch(line, /\d|%|—/, `"${line}" counts, marks a percentage or dashes`);
      // A weekday belongs to the rail's labels, which are passed in. A heading
      // or a caption naming one is this card having an opinion about a day.
      assert.doesNotMatch(
        line,
        /\b(mon|tue|wed|thu|fri|sat|sun)(day|sday|nesday|rsday|urday)?s?\b/i,
        `"${line}" names a day of the week, which is the rail's to label and not the card's to say`,
      );
    }
    assert.ok(!CARD.includes('inkFaint'), 'a sentence a learner reads is set in the faint ink');
  });
});
