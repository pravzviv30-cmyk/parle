/**
 * The week, read where the learner goes looking — F233 moved here with F561.
 *
 * `progress/story.ts` decides everything about the week and this card draws
 * it. So the positive half is small on purpose: four reads, a gate, a map, a
 * rail. Every assertion with weight in it is about what the card must *not*
 * have grown, and about "only": every non-test file under `src/` is read,
 * comments stripped, and the set of files that import `progress/story.ts` has
 * to be exactly one. That proves no other module in the app can see the week,
 * so nothing scheduled, backgrounded or notified can carry it anywhere. The
 * other half of "never pushed" is enforced from the far side, by
 * `reminders/reminder.test.ts` refusing any module under `reminders/` the
 * ability to import `progress/`. Neither test alone is the promise; the pair is.
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

describe("the week on Profile — F561, and F233's importer count", () => {
  test('the Profile card is the one importer of the story, and the rhythm rail names no number', () => {
    // Where the learner went looking. Profile is a tab you open, and the story
    // is drawn in it from the module that owns every word of it.
    const imported = FLAT.match(/import \{([^}]*)\} from '\.\.\/progress\/story\.ts'/);
    assert.ok(imported, 'the card never imports the week story, so there is nothing here to show');
    for (const name of ['storyFrom', 'hasStory']) {
      assert.ok(imported[1]!.includes(name), `the card imports the story module without ${name}`);
    }

    // All four inputs, whole, with a passed clock. Narrowing is the module's
    // job, and doing it here is how the no-delta guarantee gets bypassed one
    // commit later.
    for (const load of ['loadHistory()', 'loadActivity()', 'loadConversationPacks()', 'loadMissionCompletions()']) {
      assert.ok(FLAT.includes(load), `the card never reads ${load}, so the story is built from less than the week`);
    }
    assert.match(
      FLAT,
      /storyFrom\(\{ sessions: history, activity, packs, completions, now \}\)/,
      'the story is not built from the four loaded inputs and a passed clock; `now` is required, not defaulted',
    );
    for (const input of ['history', 'activity', 'packs', 'completions']) {
      assert.doesNotMatch(
        FLAT,
        new RegExp(`${input}\\s*\\.\\s*(filter|slice|sort|reverse)\\b`),
        `the card narrows ${input} before storyFrom sees it; narrowing is that module's job and its guarantee`,
      );
    }

    // Drawn as it arrives, ordered and capped by the module. A card that
    // sorts or slices is a second opinion about a week.
    assert.match(CARD, /story\.sentences\.map\(/, 'the card never draws the sentences the module built');
    for (const meddling of ['.sort(', '.slice(', '.reverse(', '.join(', '.filter(', '.length']) {
      assert.ok(!CARD.includes(`story.sentences${meddling}`), `the card writes story.sentences${meddling}`);
    }
    assert.ok(!CARD.includes('[...story.sentences]'), 'the card copies the sentences, which is only ever done to reorder or trim them');
    for (const owned of ['unassistedRate', 'wordsProduced', 'MAX_STORY_SENTENCES', 'DAYS_IN_THE_STORY']) {
      assert.ok(!CARD.includes(owned), `the card names ${owned} itself; what a week contained is story.ts's judgement`);
    }

    // Nothing on a quiet week but an invitation: the gate is on the block it
    // holds back, and the other branch is the start line, not a nought.
    const drawn = CARD.indexOf('story.sentences.map(');
    const gate = CARD.lastIndexOf('hasStory(story)', drawn);
    assert.notEqual(gate, -1, 'the sentences are drawn with nothing holding them back');
    assert.ok(drawn - gate < 160, 'the hasStory gate is somewhere else on the card, not on the block it is meant to hold back');
    assert.match(FLAT, /\{WEEK_START\}/, 'a quiet week draws nothing, where an invitation belongs');

    // The rhythm is the shared rail, read from the same log Home reads, and it
    // names no number: seven marks, a picture, no count and no words on it.
    assert.match(FLAT, /<WeekRail week=\{rail\} \/>/, 'the card does not draw the shared week rail');
    assert.match(FLAT, /setRail\(weekRailFrom\(activity, now\)\)/, "the rail is not the momentum module's own week");
    const rail = RAIL.slice(RAIL.indexOf('export function WeekRail('), RAIL.indexOf('\nconst s = StyleSheet.create'));
    assert.ok(rail.length > 0, 'components.tsx no longer exports WeekRail');
    assert.doesNotMatch(rail, /<Text/, 'the rail draws words, so it can say a number');
    assert.doesNotMatch(rail, /\d/, 'the rail types a digit of its own');
    assert.match(rail, /accessibilityElementsHidden/, 'the rail reaches a screen reader as seven unnamed views');
    assert.match(RAIL, /markDone: \{ backgroundColor: signal\.good \}/, 'a day that happened is not a filled green mark');
    assert.match(RAIL, /markWaiting: \{ borderWidth: HAIRLINE \+ 0\.4, borderColor: paper\.line \}/, 'a day that has not happened is filled in');

    // And "only". One file in the whole app can see the week.
    const storyModule = join('progress', 'story.ts');
    const readers = sourceFiles(SRC)
      .filter((path) => !path.endsWith(storyModule))
      .filter((path) => /from '[^']*progress\/story\.ts'/.test(stripComments(readFileSync(path, 'utf8'))))
      .map((path) => path.slice(SRC.length));
    assert.deepEqual(
      readers,
      ['profile/FrenchLifeCard.tsx'],
      'something other than the Profile card can read the week, so the story has a second way to reach a learner',
    );
    assert.doesNotMatch(FLAT, /from '\.\.\/reminders\//, 'the card reaches into the reminders layer');
    assert.doesNotMatch(FLAT, /expo-notifications/, 'the card reaches for the notification API');

    // Words a learner reads: ink, no digit typed here, no banned word, no em
    // dash, and the block says what it is to assistive tech.
    assert.match(CARD, /accessibilityRole="summary"/, 'the week arrives at a screen reader as an unnamed group of views');
    assert.doesNotMatch(FLAT.replace(/space\([\d.]+\)/g, ''), /\d/, 'the card types a number of its own; every digit in the story comes from story.ts');
    for (const line of FRENCH_LIFE_COPY) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries "${guiltIn(line)}"`);
      assert.doesNotMatch(line, /\d|—|day/i, `"${line}" counts, dashes or names a day`);
    }
    assert.ok(!CARD.includes('inkFaint'), 'a sentence a learner reads is set in the faint ink');
  });
});
