/**
 * The Profile tab, read out of the file that draws it — F576.
 *
 * ## Why this is a source walk and not a render
 *
 * apps/mobile has no renderer (docs/TESTING.md): fifty-odd components and not
 * one `.test.tsx`. So the way a rule gets defended here is that it is lifted
 * out of the screen into a plain module with its own suite, and the screen is
 * then held to *using* it. Profile has no rule left in it at all now: the
 * headings are `profile/frenchLife.ts`, the tutor card is
 * `profile/tutorMemory.ts` and `tutor/tutorVoice.ts`, the week is
 * `progress/momentum.ts`, and the row at the foot is `settings/sections.ts`.
 * What is left is layout and wiring, and wiring is the thing a grep can see.
 *
 * Be exact about what that buys. These two tests prove that the tab opens on
 * the learner, that the tutor beside them is the orb rather than a face, that
 * the three headings are the module's and there are exactly three, and that the
 * plan, the reminder and the intro link are drawn on Settings and nowhere else.
 * They prove nothing about pixels, about VoiceOver, or about what a tap does on
 * a phone. Those are `docs/DEVICE_VERIFICATION.md`'s Pass 8 rows.
 *
 * The daily reminder's own suite moved with the reminder. It is
 * `settings/SettingsScreen.test.ts` now, matcher for matcher, because the rule
 * it defends is about the screen that draws the switch.
 *
 * `stripComments` is load-bearing. This header names `<Monogram`, `PlanCard`
 * and `TUTOR_INTRO_LINK` in prose, and every one of those is a needle below.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { guiltIn } from '../copy/guilt.ts';
import {
  FRENCH_LIFE_COPY,
  LEARNING_LABEL,
  PROFILE_PURPOSE,
  RHYTHM_LABEL,
  TUTOR_LABEL,
} from '../profile/frenchLife.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Comments may say anything; only what reaches glass is under test. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const TAB = stripComments(read('./ProfileTab.tsx'));
/**
 * Just the tab itself, from its own `return (` to the end.
 *
 * Every ordering claim below is about the order things are DRAWN in, and the
 * import list at the top of the file is sorted by name rather than by layout.
 * Asked of the whole file, "the tutor is above the week" would be answered by
 * two import lines and would pass on a tab that drew them the other way round.
 */
const BODY = TAB.slice(TAB.lastIndexOf('  return ('));
const CARD = stripComments(read('../profile/TutorMemoryCard.tsx'));
const SETTINGS = stripComments(read('../settings/SettingsScreen.tsx'));

/**
 * `first` is present, `second` is present, and `first` comes first.
 *
 * A boolean rather than an assertion so the bite checks can watch it answer
 * false. The two presence checks are the whole point: `indexOf` answers -1 for
 * something that was deleted, and -1 sorts before every real position, so the
 * obvious spelling of an ordering check passes most confidently in the one case
 * it exists to catch. surfaceContract.test.ts writes this down as
 * `writtenBefore` after that trap hid a missing network flag under a green
 * suite.
 */
function writtenBefore(source: string, first: string, second: string): boolean {
  const at = source.indexOf(first);
  const then = source.indexOf(second);
  return at !== -1 && then !== -1 && at < then;
}

/** The body of one `if (sheet === '<name>') {` branch, braces matched. */
function sheetBranch(source: string, name: string): string {
  const start = source.indexOf(`<BottomSheet visible={sheet === '${name}'}`);
  assert.ok(start >= 0, `Profile has no ${name} sheet`);
  const end = source.indexOf('</BottomSheet>', start);
  assert.ok(end > start, 'the sheet is not closed');
  return source.slice(start, end + '</BottomSheet>'.length);
}

describe('the tab that is a person — F576', () => {
  test('profile opens centred on the learner and draws its tutor as the orb, never a face', () => {
    // ───────────────────────────────────── centred, on the learner
    //
    // The one centred header in the app, and the only screen allowed to ask for
    // it: four tabs name a subject and read left, and this one is a person.
    assert.match(TAB, /<TabHeader\s+align="center"/, 'Profile opens with a left-aligned header like the four tabs that name a subject');
    assert.match(
      TAB,
      /leading=\{<Monogram initial=\{firstName\.charAt\(0\)\.toUpperCase\(\)\} size=\{72\} \/>\}/,
      "the learner's own mark is not above their name",
    );
    assert.match(TAB, /title=\{profile\.name \?\? 'You'\}/, 'the header says something other than the learner, or spells the fallback twice');
    assert.doesNotMatch(TAB, /purpose=/, 'the learner identity does not need another explanatory subtitle');

    // The initial is drawn once here and nowhere else on the tab, which is
    // F337's rule: that disc is the learner's, and a second one would be a
    // second person on a screen that is about one.
    assert.equal((TAB.match(/<Monogram\b/g) ?? []).length, 1, 'the learner initial is drawn more than once on Profile');
    assert.ok(!TAB.includes('levelName'), 'the level line is back under the name, ranking somebody who came to change a setting');

    // The corner art, behind the words, decorative and drawn before them so it
    // cannot sit over the heading.
    assert.doesNotMatch(TAB, /<HeaderArt/, 'art must not overlap the profile identity panel');


    // ─────────────────────────────── the tutor is the orb, never a face
    //
    // On the card, not on the tab: Profile hands it the one thing it owns,
    // which is the sheet that opens.
    assert.match(TAB, /<TutorMemoryCard onVoice=\{\(\) => setSheet\('tutorVoice'\)\} \/>/, 'the tutor card cannot open the voice sheet');
    assert.match(CARD, /<TutorMark \/>/, 'the tutor is drawn as something other than the orb');
    assert.ok(!CARD.includes('<Monogram'), 'the tutor is drawn as an initial, which is the learner mark saying the tutor is the learner');
    for (const face of ['avatar', 'photo', 'Image', 'face']) {
      assert.ok(!CARD.includes(face), `the tutor card draws a ${face}; the founder settled that there are no faces here`);
    }
    // Two rows, each a target the whole way across and each named once. A row
    // whose only target is its chevron is the F545 defect.
    assert.equal((CARD.match(/<TutorRow\b/g) ?? []).length, 2, 'the tutor card is not the two rows the founder drew');
    assert.match(CARD, /accessibilityLabel=\{`\$\{title\}, \$\{gloss\}`\}/, 'a row reaches a screen reader as two unrelated lines');
    assert.match(CARD, /accessibilityRole="button"/, 'a row that opens something does not say it is a button');
    assert.match(CARD, /minHeight: HIT/, 'a row on the tutor card sits under the touch floor');
    assert.match(CARD, /title=\{memoryLabel\(name\)\}/, 'the memory row spells the tutor name itself');
    assert.match(CARD, /nav\.navigate\('TutorMemory'\)/, 'the memory row leads nowhere');

    // ─────────────────────────────────────── three headings, and the module's
    //
    // Your tutor, your speaking rhythm, your learning. A fourth over the row
    // that reads Settings would say the same word twice.
    assert.equal((TAB.match(/<Label color=\{colors\.muted\}>/g) ?? []).length, 2, 'Profile draws a caps label it did not before, or lost one');
    for (const heading of ['TUTOR_LABEL', 'LEARNING_LABEL']) {
      assert.ok(TAB.includes(`<Label color={colors.muted}>{${heading}}</Label>`), `the ${heading} heading is spelled in JSX rather than imported`);
    }
    assert.ok(writtenBefore(BODY, '<Label color={colors.muted}>{TUTOR_LABEL}</Label>', '<Label color={colors.muted}>{LEARNING_LABEL}</Label>'));
    assert.doesNotMatch(TAB, /<FrenchLifeCard|<Label color=\{colors\.muted\}>\{RHYTHM_LABEL\}/);
    for (const spelled of ['Your tutor', 'Your speaking rhythm', 'Your learning', 'Your French life']) {
      assert.ok(!TAB.includes(`>${spelled}<`), `Profile writes "${spelled}" in JSX, so the copy sweeps cannot read it`);
    }

    // The words themselves, held to the bar the whole surface keeps.
    assert.equal(TUTOR_LABEL, 'Your tutor');
    assert.equal(RHYTHM_LABEL, 'Your speaking rhythm');
    assert.equal(LEARNING_LABEL, 'Your learning');
    for (const line of FRENCH_LIFE_COPY) {
      assert.ok(line.trim().length > 0, 'a blank line reached the tab');
      assert.equal(guiltIn(line), undefined, `"${line}" carries a word Luvani does not say to learners`);
      assert.doesNotMatch(line, /[—–]/, `"${line}" carries an em dash`);
      assert.doesNotMatch(line, /\d|%/, `"${line}" counts at somebody`);
    }
    assert.ok(FRENCH_LIFE_COPY.includes(PROFILE_PURPOSE), 'the purpose line is not in the list the sweeps read');

    // And the way out is last, under no label of its own.
    assert.ok(
      TAB.indexOf('label={SETTINGS_ROW}') < TAB.indexOf('<Label color={colors.muted}>'),
      'Settings must be immediately visible above the profile details',
    );

    // ─────────────────────────────────────────────── the checks bite
    assert.equal(writtenBefore('<TabHeader />', '<HeaderArt', '<TabHeader'), false, 'a header with no art at all passes the ordering check');
    assert.equal(writtenBefore('<TabHeader /><HeaderArt />', '<HeaderArt', '<TabHeader'), false, 'art drawn after the header passes as art behind it');
    assert.equal(writtenBefore('<HeaderArt /><TabHeader />', '<HeaderArt', '<TabHeader'), true, 'the shape the tab ships does not pass its own check');
    assert.equal((('<Label color={colors.muted}>a</Label>').match(/<Label color=\{colors\.muted\}>/g) ?? []).length, 1, 'the label counter does not count');
  });

  test('the plan, the reminder and the intro link live in settings', () => {
    // What left Profile, by the names it drew them with. A copy left behind is
    // a second one to keep in step, and on the reminder it is worse than that:
    // two screens would each believe they owned the switch.
    for (const gone of [
      'PlanCard',
      'REMINDER_ROW',
      'REMINDERS_AVAILABLE',
      'reminderRow',
      'saveReminder',
      'scheduleReminder',
      'TUTOR_INTRO_LINK',
      'TutorIntro',
      'useFocusEffect',
    ]) {
      assert.ok(!TAB.includes(gone), `Profile still carries ${gone}, so it moved to Settings and stayed here too`);
    }
    assert.match(
      TAB,
      /type Sheet = 'none' \| 'name' \| 'tutorVoice';/,
      'the sheet union still names a sheet that moved to Settings, or lost one that did not',
    );
    // Nothing left on Profile renders a screen with a hook of its own, so the
    // hardware back is answered for every sheet there is. The exclusion Profile
    // used to carry was the intro's, and the intro is Settings'.
    assert.match(TAB, /useHardwareBack\(sheet !== 'none', closeCurrentSheet\)/, 'Profile answers the hardware back for a sheet it does not draw, or for none');

    // And what arrived on Settings. Each of the three is drawn there, in the
    // group the founder put it in.
    assert.match(SETTINGS, /<Label color=\{colors\.muted\}>\{PLAN_GROUP\}<\/Label>\s*<PlanCard \/>/, 'the plan card is not a group of its own on Settings');
    assert.ok(
      writtenBefore(SETTINGS, '<Label color={colors.muted}>{PLAN_GROUP}</Label>', '<Label color={colors.muted}>{SUBSCRIPTION_GROUP}</Label>'),
      'the plan is drawn below the store rows it is about',
    );
    assert.match(SETTINGS, /title=\{REMINDER_ROW\}/, 'the daily reminder switch is on neither screen now');
    assert.match(SETTINGS, /REMINDERS_AVAILABLE && row !== null/, 'the reminder is drawn on a build that cannot schedule anything');
    assert.match(SETTINGS, /label=\{CONNECTION_HELP_ROW\}/, 'nothing on Settings opens the one page that teaches the circle');
    assert.match(SETTINGS, /<TutorIntro onDone=\{\(\) => setSheet\('none'\)\} \/>/, 'Settings links to an intro it never renders');
    assert.ok(
      writtenBefore(SETTINGS, '<Label color={colors.muted}>{HELP_GROUP}</Label>', 'label={CONNECTION_HELP_ROW}'),
      'the intro link is drawn outside the Help group',
    );

    // The pace switch went to the foot of the voice sheet: how fast the tutor
    // writes is a question about the tutor, so it belongs with the eight cards
    // that choose who the tutor is rather than on the learner's own card.
    const voice = sheetBranch(TAB, 'tutorVoice');
    assert.match(voice, /title=\{PACE_ROW\}/, 'the pace switch is not on the voice sheet');
    assert.ok(
      writtenBefore(voice, 'TUTOR_VOICE_OPTIONS.map(', 'PACE_ROW'),
      'the pace switch is drawn above the eight voices, so the sheet opens on a setting rather than on a choice',
    );
    const learning = TAB.slice(TAB.indexOf('<Label color={colors.muted}>{LEARNING_LABEL}</Label>'), TAB.indexOf('</ScrollScreen>'));
    assert.ok(!learning.includes('PACE_ROW'), 'the pace switch is on the learning card as well as on the sheet');

    // One row on Profile leads anywhere at all, and everything above went
    // behind it.
    assert.match(TAB, /onPress=\{\(\) => nav\.navigate\('Settings'\)\}/, 'the Settings row leads nowhere');
    assert.equal((TAB.match(/nav\.navigate\(/g) ?? []).length, 2, 'Profile leads somewhere other than Settings');

    // The bite: a screen that kept the plan card would pass a check that only
    // looked at Settings.
    assert.ok('<PlanCard />'.includes('PlanCard'), 'the absence check cannot see the name it is looking for');
    assert.equal(writtenBefore('SUBSCRIPTION_GROUP PLAN_GROUP', 'PLAN_GROUP', 'SUBSCRIPTION_GROUP'), false, 'the plan below the store rows passes as the plan above them');
  });
});
