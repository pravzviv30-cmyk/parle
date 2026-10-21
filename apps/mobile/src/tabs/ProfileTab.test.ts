/**
 * The Profile tab, read out of the file that draws it (F576, P2 2026-10-19).
 *
 * apps/mobile has no renderer (docs/TESTING.md), so the rules are lifted into
 * plain modules (`settings/profileView.ts` and its suite) and the screen is
 * held to using them. What these two tests prove: the tab opens on a large
 * title with the gear, then the learner's own sun disc and name, then the
 * Learning, Your French and Plan groups; the tutor is the orb; and every
 * control that used to be inline arrived on Learning preferences rather than
 * being lost. They prove nothing about pixels, VoiceOver or a tap on a phone.
 *
 * `stripComments` is load-bearing: prose may name anything a needle looks for.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { guiltIn } from '../copy/guilt.ts';
import { FRENCH_LIFE_COPY } from '../profile/frenchLife.ts';

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
// 2026-10-20 UI-008: from the screen's own return (a hook below it also returns).
const BODY = TAB.slice(TAB.indexOf('<SettingsAppearance b>'));
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

const LEARNING = stripComments(read('../settings/LearningPreferencesScreen.tsx'));

describe('the tab that is a person — P2, 2026-10-19', () => {
  test('profile opens on the learner and draws its tutor as the orb, never a face', () => {
    // 2026-10-20 UI-008, artboard B-Profile. The page has no "Profile" title:
    // the learner's name is its heading. Back and the gear lead the page, then
    // the identity row, the stats card, the plan card and three groups.
    const PARTS = stripComments(read('../settings/ProfileParts.tsx'));
    assert.match(TAB, /<IconDisc onPress=\{\(\) => nav\.navigate\('Settings'\)\} label=\{SETTINGS_ROW\}/, 'the gear does not lead to Settings, or is unnamed');
    assert.match(PARTS, /disc: \{ width: HIT, height: HIT/, 'the gear sits under the touch floor');
    assert.match(PARTS, /<Text accessibilityRole="header" style=\{\[s\.name/, 'the learner name is not the page heading');
    assert.ok(writtenBefore(BODY, '<IconDisc', '<Identity'), 'the gear is not first');

    // ───────────────────────────────────── the learner, by their own initial
    assert.equal((TAB.match(/initialOf\(profile\.name\)/g) ?? []).length, 1, 'the learner initial is drawn more than once, or not at all');
    assert.match(PARTS, /avatar: \{ width: 76, height: 76, borderRadius: 38, backgroundColor: t\.sun/, 'the avatar is not the 76pt sun disc');
    assert.match(TAB, /name=\{profile\.name \?\? NAME_UNSET\}/, 'the header says something other than the learner, or spells the fallback itself');
    assert.match(PARTS, /since !== null \? <Text/, 'the since line is drawn when the date is unknown');
    assert.ok(!TAB.includes('levelName'), 'the level line is back under the name, ranking somebody who came to change a setting');
    assert.doesNotMatch(TAB, /<HeaderArt/, 'art must not overlap the profile identity panel');
    assert.match(TAB, /setDraftName\(profile\.name \?\? ''\); setSheet\('name'\);/, 'Edit does not open the name sheet on the stored name');
    assert.match(PARTS, /edit: \{ minHeight: HIT, minWidth: HIT/, 'Edit sits under the touch floor');

    // ─────────────────────────────── the tutor is the orb, never a face
    assert.match(TAB, /label=\{YOUR_TUTOR_ROW\} sub=\{tutor\} lead=\{<RowArt round size=\{40\}><BArt name="tutor-orb"/, 'the tutor is drawn as something other than the orb');
    assert.match(TAB, /onPress=\{\(\) => setSheet\('tutorVoice'\)\}/, 'the tutor row cannot open the voice sheet');
    assert.match(TAB, /label=\{memoryRowTitle\(tutor\)\}/, 'the memory row spells the tutor name itself');
    assert.match(TAB, /tapThrough\(locks\.access, 'tutorMemory', locks\.open, \(\) => nav\.navigate\('TutorMemory'\)\)/, 'the memory row skips the lock seam, or leads nowhere');
    assert.match(TAB, /badge=\{memoryLocked \? <LockBadge form="round" \/> : null\}/, 'the memory lock is not the seam\'s');
    assert.match(TAB, /const memoryLocked = locks\.access\('tutorMemory'\) === 'locked';/);
    assert.match(TAB, /const soundsLocked = locks\.access\('sounds'\) === 'locked';/);

    // ───────────────────────────── stats, plan, three groups, the tab bar
    for (const [first, second] of [
      ['<Identity', '<StatsCard'],
      ['<StatsCard', '<PlanBanner'],
      ['<PlanBanner', '<SettingsGroup first title={LEARNING_GROUP}>'],
      ['<SettingsGroup first title={LEARNING_GROUP}>', '<SettingsGroup first title={YOUR_FRENCH_GROUP}>'],
      ['<SettingsGroup first title={YOUR_FRENCH_GROUP}>', '<SettingsGroup first title={MORE_GROUP}>'],
      ['</ScrollScreen>', '<DetachedTabBar onTab={openTab} />'],
    ] as const) {
      assert.ok(writtenBefore(BODY, first, second), `${first} is not drawn before ${second}`);
    }
    assert.match(TAB, /stat\.route === 'Streak' \? nav\.navigate\('Streak'\) : openMyFrench\(\)/, 'the stats cells do not open Streak and Journey');
    assert.match(TAB, /planView\.target === 'Wall' \? nav\.navigate\('Wall', \{ entry: 'settings' \}\) : nav\.navigate\('Subscription'\)/, 'See plans does not open the plans');
    assert.match(TAB, /label=\{LEARNING_PREFERENCES_ROW\} sub=\{preferences\} onPress=\{\(\) => nav\.navigate\('LearningPreferences'\)\}/);
    assert.match(TAB, /label=\{JOURNEY_ROW\} sub=\{JOURNEY_SUB\} onPress=\{\(\) => openMyFrench\(\)\}/);
    assert.match(TAB, /label=\{SAVED_PHRASES_ROW\} sub=\{savedCount\(evidence\.saved\) \?\? undefined\} onPress=\{\(\) => nav\.navigate\('Phrasebook'\)\}/);
    assert.match(TAB, /sub=\{soundsLine\(evidence\.soundJourney\) \?\? undefined\}/, 'the sounds line is not the journey\'s');
    assert.match(TAB, /label=\{FRIENDS_ROW\} sub=\{FRIENDS_SUB\} onPress=\{\(\) => nav\.navigate\('Friends'\)\}/, 'Friends was dropped from Profile');
    assert.match(TAB, /label=\{PRIVACY_ROW\} sub=\{PRIVACY_SUB\} onPress=\{\(\) => nav\.navigate\('Policy'\)\}/);
    assert.match(TAB, /\{contact !== null && <SettingsRow label=\{HELP_FEEDBACK_ROW\}/, 'Help and feedback is drawn with no address behind it');
    assert.match(stripComments(read('../nav/LuvaniTabBar.tsx')), /focused: false,/, 'the detached bar selects a tab');
    for (const spelled of ['Your tutor', 'Learning preferences', 'Your French', '>Plan<', '>Edit<']) {
      assert.ok(!TAB.includes(spelled), `Profile writes "${spelled}" in JSX, so the copy sweeps cannot read it`);
    }

    // The words themselves, held to the bar the whole surface keeps.
    for (const line of FRENCH_LIFE_COPY) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries a word Luvani does not say to learners`);
      assert.doesNotMatch(line, /[—–]/, `"${line}" carries an em dash`);
    }

    // ─────────────────────────────────────────────── the checks bite
    assert.equal(writtenBefore('<B /><A />', '<A', '<B'), false, 'the ordering check passes on the order it exists to catch');
    assert.equal(writtenBefore('<A />', '<A', '<gone'), false, 'a deleted second needle passes the ordering check');
    assert.equal(writtenBefore('<A /><B />', '<A', '<B'), true);
  });

  test('the plan, the reminder and the intro link live in settings', () => {
    // What left Profile, by the names it drew them with.
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
      'withDailyGoal',
      'withStrictness',
      'withPreferTyping',
      'withPace',
      'PACE_ROW',
      'STRICTNESS_ROW',
      'PREFER_TYPING_ROW',
      'DAILY_GOAL_ROW',
    ]) {
      assert.ok(!TAB.includes(gone), `Profile still carries ${gone}, so a control has two homes`);
    }
    // And where each one arrived.
    for (const arrived of ['DAILY_GOAL_ROW', 'title={STRICTNESS_ROW}', 'title={PACE_ROW}', 'title={PREFER_TYPING_ROW}', 'withStatedLevel(']) {
      assert.ok(LEARNING.includes(arrived), `Learning preferences does not carry ${arrived}, so a control was lost in the move`);
    }
    assert.match(
      TAB,
      /type Sheet = 'none' \| 'name' \| 'tutorVoice';/,
      'the sheet union names a sheet Profile does not draw, or lost one that it does',
    );
    assert.match(TAB, /useHardwareBack\(sheet !== 'none', closeCurrentSheet\)/, 'Profile answers the hardware back for a sheet it does not draw, or for none');

    // The plan, the reminder and the intro are Settings'.
    assert.match(SETTINGS, /<SettingsGroup title=\{SUBSCRIPTION_GROUP\}>[\s\S]*?label=\{PLAN_ROW\}[\s\S]*?onPress=\{\(\) => nav\.navigate\('Subscription'\)\}/, 'the plan row is not in the Subscription group on Settings');
    assert.match(SETTINGS, /title=\{REMINDER_ROW\}/, 'the daily reminder switch is on neither screen now');
    assert.match(SETTINGS, /REMINDERS_AVAILABLE && row !== null/, 'the reminder is drawn on a build that cannot schedule anything');
    assert.match(SETTINGS, /label=\{CONNECTION_HELP_ROW\}/, 'nothing on Settings opens the one page that teaches the circle');
    assert.match(SETTINGS, /<TutorIntro onDone=\{\(\) => setSheet\('none'\)\} \/>/, 'Settings links to an intro it never renders');
    assert.ok(
      writtenBefore(SETTINGS, '<SettingsGroup\n        title={HELP_GROUP}', 'label={CONNECTION_HELP_ROW}'),
      'the intro link is drawn outside the Help group',
    );

    // The voice sheet holds the voices and nothing else now: Simpler French is
    // a Learning preference, and a second switch here would be two for one value.
    const voice = sheetBranch(TAB, 'tutorVoice');
    assert.match(voice, /TUTOR_VOICE_OPTIONS\.map\(/, 'the voice sheet lost the catalogue');
    assert.ok(!voice.includes('PACE_ROW'), 'the pace switch is on the voice sheet as well as on Learning preferences');
  });
});
