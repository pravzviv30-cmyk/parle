/**
 * The split between Profile and Settings, read out of the files that draw it.
 *
 * ## Why this is a source walk and not a render
 *
 * apps/mobile has no renderer (docs/TESTING.md): fifty-odd components and not
 * one `.test.tsx`. The way a rule is defended here is that it is lifted out of
 * the screen into a plain module with its own suite, and the screen is then held
 * to *using* it. Every judgement on these two screens already lives in a module
 * — `subscriptionGroup`, `phoneRows`, `analyticsAllowed`, `companyLine`,
 * `contactRow`, `restoreTrouble`, `appVersionLine` — and every word lives in
 * `sections.ts` or one of its neighbours. What is left in the `.tsx` files is
 * layout and wiring, and wiring is what a walk over the source can actually see.
 *
 * Be exact about what that buys. These tests prove that Profile keeps the five
 * learning settings and the reminder and has exactly one row leading away, that
 * the row it leads to is a stack sibling with its own back, that no label on
 * either screen is written in JSX, and that no word on either counts anything.
 * They prove nothing about pixels, about VoiceOver, or about what a tap does on
 * a phone. Eight of those are `docs/DEVICE_VERIFICATION.md`'s Pass 7 rows, and
 * the last test here is what stops that section quietly claiming to be walked.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { guiltIn } from '../copy/guilt.ts';
import { withName } from '../profile/store.ts';
import {
  ABOUT_GROUP,
  ACCOUNT_GROUP,
  ACKNOWLEDGEMENTS_ROW,
  DELETE_ROW,
  DOWNLOAD_ROW,
  EMAIL_ROW,
  HELP_GROUP,
  PHONE_GROUP,
  PLAN_GROUP,
  PRIVACY_GROUP,
  PRIVACY_POLICY_ROW,
  SAVED_ROW,
  SETTINGS_COPY,
  SETTINGS_GROUPS,
  SETTINGS_ROW,
  SETTINGS_ROW_SUB,
  SETTINGS_TITLE,
  SIGN_OUT_ROW,
  SUBSCRIPTION_GROUP,
} from './sections.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const PROFILE = stripComments(read('../tabs/ProfileTab.tsx'));
const SETTINGS = stripComments(read('./SettingsScreen.tsx'));
const NAVIGATOR = stripComments(read('../nav/RootNavigator.tsx'));
const ROUTES = stripComments(read('../nav/types.ts'));
const RUNBOOK = read('../../../../docs/DEVICE_VERIFICATION.md');

/**
 * `first` is present, `second` is present, and `first` comes first.
 *
 * The two presence checks are the whole point. `indexOf` answers -1 for
 * something that was deleted and -1 sorts before every real position, so the
 * obvious spelling of an ordering check passes most confidently in the one case
 * it exists to catch. surfaceContract.test.ts writes the same trap down.
 */
function writtenBefore(source: string, first: string, second: string, why: string): void {
  const at = source.indexOf(first);
  const then = source.indexOf(second);
  assert.notEqual(at, -1, `${why}; \`${first}\` is not there at all`);
  assert.notEqual(then, -1, `${why}; \`${second}\` is not there at all`);
  assert.ok(at < then, `${why}; \`${first}\` comes after \`${second}\``);
}

/** Every `<SettingsRow … />` a screen draws, whole. */
function settingsRows(source: string): string[] {
  return source.match(/<SettingsRow[\s\S]*?\/>/g) ?? [];
}

describe('Profile keeps who you are and how you learn — F473', () => {
  test('Profile keeps who you are and how you learn, and one row leads to the rest', () => {
    // What stays. The learner's own mark, the standing choices about how a
    // conversation goes, and the sheet the tutor's voice is chosen on: none of
    // them moved, and a check that only looked at what left would pass on a tab
    // that had lost half of this too.
    for (const kept of [
      'Monogram',
      'DAILY_GOAL_ROW',
      'STRICTNESS_ROW',
      'PREFER_TYPING_ROW',
      'PACE_ROW',
      'TUTOR_VOICE_OPTIONS',
      'withTutorVoice',
    ]) {
      assert.ok(PROFILE.includes(kept), `Profile no longer draws ${kept}, so the cut took a learning setting with it`);
    }

    // The header is the learner now (F576): centred on their own mark, with
    // their name as the title, rather than a subject line about an account that
    // is a screen away. `PROFILE_PURPOSE` rather than a literal, because a line
    // written in JSX is a line no sweep in this workspace can read back.
    assert.match(PROFILE, /<TabHeader\s+align="center"/, 'Profile opens with a left-aligned header like the four tabs that name a subject');
    assert.match(PROFILE, /title=\{profile\.name \?\? 'You'\}/, 'the header says something other than the learner');
    assert.match(PROFILE, /purpose=\{PROFILE_PURPOSE\}/, 'the line under the name is written in JSX, where no test can read it back');
    assert.ok(!PROFILE.includes('Your name and your tutor.'), 'the tab still says it is about the account, which is now a screen away');
    assert.ok(!PROFILE.includes('levelName'), 'the level line is back under the name, ranking somebody who came to change a setting');

    // What left, by the words it used to say. Each of these is drawn on
    // Settings now, and a copy left behind is a second one to keep in step.
    for (const gone of [
      "'Sign out'",
      '"Sign out"',
      'Delete account',
      'Download my data',
      'Saved conversations',
      'Our privacy policy',
      'Acknowledgements',
      'onSignOut',
      'onDeleteAccount',
      'downloadAccountData',
      'appVersionLine',
      'useAuth',
      // Three more went with revamp A (F576). On the reminder a copy left
      // behind is worse than a duplicate: two screens would each believe they
      // owned the switch, and the learner would be told two different things
      // about what the operating system had allowed.
      'PlanCard',
      'REMINDER_ROW',
      'REMINDERS_AVAILABLE',
      'TUTOR_INTRO_LINK',
    ]) {
      assert.ok(!PROFILE.includes(gone), `Profile still carries ${gone}, so it moved to Settings and stayed here too`);
    }

    // The tab takes nothing now, which is what lets the navigator register it
    // as a plain component rather than a children function.
    assert.match(PROFILE, /export function ProfileTab\(\) \{/, 'ProfileTab still takes props, so Tabs still has to thread them');
    assert.match(
      PROFILE,
      /type Sheet = 'none' \| 'name' \| 'tutorVoice';/,
      'the sheet union still names a sheet that moved to Settings, or lost one that did not',
    );

    // One row, last, and under no caps label. Three labels remain on this tab:
    // Your tutor, Your speaking rhythm and Your learning, each above a card
    // that needs naming. A fourth over a row that reads Settings would say the
    // same word twice.
    assert.match(PROFILE, /label=\{SETTINGS_ROW\}/, 'Profile draws no Settings row, so everything that moved is unreachable');
    assert.match(PROFILE, /value=\{SETTINGS_ROW_SUB\}/, 'the Settings row does not say what is behind it');
    assert.match(PROFILE, /onPress=\{\(\) => nav\.navigate\('Settings'\)\}/, 'the Settings row leads nowhere');
    assert.equal((PROFILE.match(/<Label>/g) ?? []).length, 3, 'Profile draws a caps label it did not before, or lost one');
    assert.match(PROFILE, /<Label>\{TUTOR_LABEL\}<\/Label>\s*<TutorMemoryCard onVoice=/, 'the tutor block lost its heading or its card');
    assert.match(PROFILE, /<Label>\{RHYTHM_LABEL\}<\/Label>\s*<FrenchLifeCard \/>/, 'the rhythm block lost its heading or its week');
    assert.ok(
      PROFILE.lastIndexOf('<Label>') < PROFILE.lastIndexOf('<Card'),
      'the Settings row has a caps label over it, which says the same word twice',
    );

    // Last on the screen, after the learning card. It is the way out of this
    // tab, and a way out drawn halfway up a list is a list somebody stops
    // reading at the interesting row.
    writtenBefore(PROFILE, 'title={PREFER_TYPING_ROW}', 'label={SETTINGS_ROW}', 'the Settings row is drawn above the learning card');
    assert.ok(
      PROFILE.indexOf('label={SETTINGS_ROW}') > PROFILE.lastIndexOf('<Label>'),
      'something is drawn under the Settings row, so it is no longer the last thing on the tab',
    );
    assert.equal(
      (PROFILE.match(/nav\.navigate\(/g) ?? []).length,
      1,
      'Profile leads somewhere other than Settings, so it is a list with two ways out again',
    );
  });

  test('the name is written through one named door', () => {
    // Every other field on the card goes through a `with*` helper and the name
    // did not: it spread the profile inline, which is a second write path for a
    // field the first run also sets. `profile/store.ts` says why that matters —
    // a field two places can set is a field that can disagree with itself.
    assert.deepEqual(
      withName({ name: 'Old', tutorVoice: null } as never, 'New'),
      { name: 'New', tutorVoice: null },
      'the door edits something other than the name, or drops what it was handed',
    );

    assert.match(
      PROFILE,
      /if \(next\.length > 0\) update\(withName\(profile, next\)\);/,
      'the name sheet still writes the profile itself instead of going through the door that owns this field',
    );
    assert.match(
      PROFILE,
      /import \{[^}]*\bwithName\b[^}]*\} from '\.\.\/profile\/store\.ts'/,
      'withName is not imported from the store, so the sheet is reaching for the field some other way',
    );
    assert.ok(
      !/\{ \.\.\.profile, name:/.test(PROFILE),
      'the inline spread is still in the file, so there are two ways for a name to be written',
    );
  });
});

describe('the Settings screen is one push away — F473', () => {
  test('the Settings screen is a stack sibling with its own back and answers the hardware back in place', () => {
    // A root-stack sibling ABOVE the tabs, which is what takes the tab bar away
    // while somebody is in their account, and what lets the delete sheet own
    // the whole screen while it asks.
    assert.match(ROUTES, /\n  Settings: undefined;/, 'the route map does not know about Settings');
    writtenBefore(
      NAVIGATOR,
      '<Stack.Screen name="Tabs"',
      '<Stack.Screen name="Settings">',
      'Settings is not registered above the tabs',
    );
    assert.match(
      NAVIGATOR,
      /<SettingsScreen onSignOut=\{onSignOut\} onDeleteAccount=\{onDeleteAccount\} \/>/,
      'Settings is registered without the two callbacks that used to reach Profile',
    );

    // Tabs takes nothing now, and Profile is a plain component again.
    assert.match(NAVIGATOR, /function Tabs\(\) \{/, 'Tabs still takes props it has nothing to do with');
    assert.match(NAVIGATOR, /<Stack\.Screen name="Tabs" component=\{Tabs\} \/>/, 'the tab navigator is still a children function');
    assert.match(NAVIGATOR, /<Tab\.Screen name="Profile" component=\{ProfileTab\} \/>/, 'Profile is still a children function');

    // Its own back, drawn in the screen. A native header would be a second,
    // duplicate way out, which is the whole reason every pushed screen here
    // inherits headerShown false.
    assert.match(
      SETTINGS,
      /nav\.canGoBack\(\) \? nav\.goBack\(\) : nav\.navigate\('Tabs'\)/,
      'Settings back has no safe route when the screen is opened from a direct web address',
    );
    assert.ok(!NAVIGATOR.includes('headerShown: true'), 'a pushed screen grew a native header back beside the in-screen one');

    // On the shared frame, and not under the tab bar: it is a push, so the bar
    // is gone and the bottom inset is the screen's own.
    assert.match(SETTINGS, /<ScrollScreen\b/, 'Settings is not built on the shared frame');
    assert.ok(!SETTINGS.includes('bottom="tab"'), 'Settings pays the tab bar an inset for a bar that is not there');

    // The two sheets it answers for itself, and the three that answer for
    // themselves. The full expression is pinned in surfaceContract.test.ts;
    // this is the half that says the hook exists at all.
    assert.match(SETTINGS, /useHardwareBack\(/, 'Settings opens sheets in place and never answers Android back');
    assert.match(SETTINGS, /if \(sheet === 'delete'\) \{/, 'the delete confirmation is not drawn here');
  });

  test('every Settings row label comes from the module, and none of them counts', () => {
    // The list is the whole surface, so a label added to sections.ts is scanned
    // the moment it is added rather than when somebody remembers to add it here.
    assert.ok(SETTINGS_COPY.length >= 20, 'the copy list is too short to be the whole surface');
    for (const heading of SETTINGS_GROUPS) {
      assert.ok(SETTINGS_COPY.includes(heading), `left out of the scanned list: ${heading}`);
    }
    assert.deepEqual(
      [...SETTINGS_GROUPS],
      // Seven since revamp A: the plan card moved off Profile into a group of
      // its own, above the store rows that are about it (F576).
      [ACCOUNT_GROUP, PLAN_GROUP, SUBSCRIPTION_GROUP, PRIVACY_GROUP, PHONE_GROUP, HELP_GROUP, ABOUT_GROUP],
      'the seven groups are no longer in the order the screen draws them',
    );
    assert.equal(SETTINGS_ROW, SETTINGS_TITLE, 'the row and the screen it opens are called two different things');
    // The row's second line is a promise about where a tap lands, so it names
    // the two groups that arrived with revamp A. A learner who set a reminder
    // on Profile has to be able to guess where it went.
    assert.equal(SETTINGS_ROW_SUB, 'Account, your plan, reminders and about Luvani');

    for (const line of SETTINGS_COPY) {
      assert.ok(line.trim().length > 0, 'a blank line reached the screen');
      assert.equal(guiltIn(line), undefined, `guilt in settings copy: ${line}`);
      assert.doesNotMatch(line, /—/, `em dash in settings copy: ${line}`);
      // F377. A digit in a settings label is a count, and the only counts this
      // app could show about speaking time are settled on a server the phone
      // cannot check. Both supplied mockups drew a minutes row; there is none.
      assert.doesNotMatch(line, /\d/, `a digit in settings copy: ${line}`);
      assert.doesNotMatch(line, /[$€£]/, `a currency in settings copy: ${line}`);
    }

    // And the screen draws them from the module rather than writing them in
    // JSX, where nothing in this suite could ever read them back.
    const rows = settingsRows(SETTINGS);
    // Exact, not a floor. Fourteen: four on Account, one per subscription
    // action, three under Data and privacy, the reminder's own time row and one
    // per refused permission under Phone, Contact and the intro under Help, and
    // three documents under About. A row added or lost is a change to what this
    // screen is, and it should be read here rather than slipping under a `>=`.
    assert.equal(rows.length, 14, `Settings draws ${rows.length} rows, which is not the shape the seven groups have`);
    for (const row of rows) {
      assert.doesNotMatch(row, /label="/, `a Settings row spells its label in JSX: ${row.split('\n')[0]}`);
      assert.match(row, /label=\{/, `a Settings row has no label at all: ${row.split('\n')[0]}`);
      assert.doesNotMatch(
        row,
        /minute|remaining|balance|left\b/i,
        `a Settings row counts speaking time, which F377 refuses: ${row.split('\n')[0]}`,
      );
    }
  });
});

describe('nothing on Settings fails in silence — F473', () => {
  /**
   * Every sentence this screen can say has somewhere to be said.
   *
   * Written after the first draft of this screen shared one `linkTrouble`
   * between the Phone rows and the Contact row, and drew it only inside the
   * Phone card. The Phone card is absent unless the OS has refused something,
   * which is nearly always, so a phone with no mail app set up answered a tap
   * with nothing at all: the tap that does nothing F239 refused, on the one row
   * whose whole job is to let somebody reach a human.
   *
   * The rule that fixes it is one line of state per door out of the app, drawn
   * in the same card as the control that sets it. This test states the first
   * half, which is what a walk can see: the names are pinned, so merging two
   * doors onto one line fails here rather than on somebody's phone.
   */
  test('every sentence Settings can say has its own line, and every line is drawn', () => {
    const states = [...SETTINGS.matchAll(/const \[(\w+), set\w+\] = useState<string \| null>\(null\)/g)].map(
      (m) => m[1]!,
    );
    assert.deepEqual(
      [...states].sort(),
      // `exportTrouble` joined them in F489. It used to be a sheet drawn under
      // the whole screen, which is the same silence by a longer route: the row
      // flipped back from Preparing and the reason was a screen and a half
      // down. One line per door, in the card the door is in.
      //
      // `reminderTrouble` joined them with revamp A, when the daily reminder
      // moved off Profile into the Phone group (F576). It is one door with two
      // ways to fail, which is why it is one piece of state holding whichever
      // sentence is true rather than two flags: the disk refusing the write and
      // the operating system refusing the alarm are different facts, and a
      // learner told the wrong one has been lied to about their own phone.
      ['consentTrouble', 'contactTrouble', 'deleteError', 'exportTrouble', 'phoneTrouble', 'reminderTrouble', 'storeMessage'],
      'two doors out of Settings share one line, so one of them can set a sentence in a card that is not on the page',
    );

    // And each of them reaches the screen, either drawn directly or through one
    // named value the render reads. A sentence written into state nothing draws
    // is the same silence by a shorter route.
    // Everything from the first early return onwards, which is every branch
    // this screen can draw: the intro, the three document sheets, the reminder
    // presets, the delete confirmation, and the list itself. Slicing at the
    // last `return (` would read the list alone and miss the sheet the delete
    // error is drawn in. The intro is first since revamp A moved it here from
    // Profile's Help row (F576).
    const from = SETTINGS.indexOf("  if (sheet === 'intro')");
    assert.notEqual(from, -1, 'the render branches start somewhere else now, so this is reading the wrong half of the file');
    assert.ok(
      from < SETTINGS.indexOf("  if (sheet === 'acknowledgements')"),
      'a branch is drawn above the one this slice starts at, so whatever it says would go unread here',
    );
    const render = SETTINGS.slice(from);
    for (const name of states) {
      const direct = render.includes(name);
      const viaConst = [...SETTINGS.matchAll(/const (\w+) =([^;]*);/g)]
        .filter((m) => new RegExp(`\\b${name}\\b`).test(m[2]!))
        .some((m) => render.includes(m[1]!));
      assert.ok(direct || viaConst, `${name} is written but never drawn, so whatever it says is said to nobody`);
    }

    // The two doors that leave the app each answer for themselves, so a refusal
    // is reported beside the row that was tapped.
    assert.match(SETTINGS, /setPhoneTrouble\(LINK_TROUBLE\)/, 'a phone that will not open its settings says nothing');
    assert.match(SETTINGS, /setContactTrouble\(LINK_TROUBLE\)/, 'a phone that will not open a mail app says nothing');
    // The address stays on screen either way, so somebody can still write it down.
    assert.match(SETTINGS, /value=\{contact\.address\}/, 'the Contact row hides the address it exists to give out');

    // And the reminder, which arrived with revamp A and has two ways to fail.
    // They are different facts: the disk refused the write, or the disk took it
    // and the operating system would not take the alarm. Telling somebody their
    // phone "did not save that" when it saved it perfectly well is a small lie
    // in the one place this screen has to be trusted, so there are two
    // sentences and they are held to being two.
    assert.match(SETTINGS, /setReminderTrouble\(REMINDER_SAVE_TROUBLE\)/, 'a disk that refused the reminder says nothing');
    assert.match(SETTINGS, /setReminderTrouble\(REMINDER_SCHEDULE_TROUBLE\)/, 'a phone that would not take the alarm says nothing');
    const saveLine = SETTINGS.match(/const REMINDER_SAVE_TROUBLE = '([^']+)';/)?.[1];
    const scheduleLine = SETTINGS.match(/const REMINDER_SCHEDULE_TROUBLE = '([^']+)';/)?.[1];
    assert.ok(saveLine != null && scheduleLine != null, 'one of the reminder sentences is not a plain literal this walk can read back');
    assert.notEqual(saveLine, scheduleLine, 'the two reminder failures say the same sentence, so one of them is a lie about what happened');
    for (const line of [saveLine!, scheduleLine!]) {
      assert.equal(guiltIn(line), undefined, `guilt in a reminder refusal: ${line}`);
      assert.doesNotMatch(line, /—/, `em dash in a reminder refusal: ${line}`);
      assert.doesNotMatch(line, /\d/, `a digit in a reminder refusal: ${line}`);
      // A refusal that leaves nowhere to go is the dead switch F239 refused.
      assert.match(line, /try again/, `a reminder refusal that leaves no way forward: ${line}`);
    }
  });
});

/**
 * Where a refusal is drawn, and whether anything says it out loud.
 *
 * Three defects with one root: a sentence written in state is only half a
 * sentence, and the other half is where and how it reaches a person.
 *
 * F489 drew the export refusal in a card at the very bottom of the file, after
 * the Phone group, the Help group, the About group, the company line and the
 * version line. About a screen and a half below the row that was tapped, on the
 * one control a learner exercises a legal right with, with the row flipping
 * back from `Preparing…` and nothing announcing anything. It also made the
 * hardware back active, so the next press was eaten closing a card nobody saw.
 *
 * F491 is the same silence in the delete sheet: a bare `Text`, no live region,
 * no alert role, nothing spoken, on a button the learner keeps pressing.
 *
 * F490 is the other end of the same sheet: the reason outliving the attempt, so
 * the next opening greeted somebody with a red accusation about a failure that
 * had not happened yet.
 */
describe('a refusal is drawn where it happened and said out loud — F489, F490, F491', () => {
  /** The list itself, which is everything after the last early return. */
  const LIST = SETTINGS.slice(SETTINGS.lastIndexOf('  return ('));
  /** Every `<Card>…</Card>` on that list, whole. None of them nests. */
  const CARDS = LIST.match(/<Card\b[\s\S]*?<\/Card>/g) ?? [];

  /**
   * Each line the screen can say, and the control in the same group that says it.
   *
   * `storeLine` is here too even though it is not always a refusal: it carries
   * the wait and the result of a restore as well, and the rule is about where a
   * group's own sentence is drawn rather than about the mood of it.
   */
  const LINES: readonly (readonly [string, string])[] = [
    ['storeLine', 'subscription.map('],
    ['consentTrouble', 'CONSENT_ROW'],
    ['exportTrouble', 'DOWNLOAD_ROW'],
    ['phoneTrouble', 'phone.map('],
    ['contactTrouble', 'contact.address'],
    // The reminder moved into the Phone group with revamp A (F576), and it
    // brought a refusal with it. The group is drawn on two conditions now, so
    // the sentence has to be in the same card as the switch that caused it or
    // it can land in a group that is not on the page at all.
    ['reminderTrouble', 'REMINDER_ROW'],
  ];

  test('every refusal on Settings is drawn in the group whose control caused it', () => {
    assert.equal(CARDS.length, 6, `Settings draws ${CARDS.length} cards; it should draw one per group`);

    for (const [line, control] of LINES) {
      const holding: string[] = CARDS.filter((card) => card.includes(line) && card.includes(control));
      assert.equal(
        holding.length,
        1,
        `${line} is not drawn in the same card as ${control}, so its sentence lands in a group the learner was not looking at`,
      );
      // Above the rows it is about, so it is read before the control is tapped
      // again rather than found underneath it.
      writtenBefore(
        holding[0]!,
        line,
        control,
        `${line} is drawn below ${control} inside its own card`,
      );
    }

    // And nothing says anything outside a card. The export refusal was a Card
    // of its own at the foot of the file, below the version line, which is how
    // a tap on the row above it read as dead.
    let loose = LIST;
    for (const card of CARDS) loose = loose.replace(card, '');
    for (const [line] of LINES) {
      assert.ok(
        !loose.includes(line),
        `${line} is drawn somewhere on Settings that is not the card its control is in`,
      );
    }

    // The export line clears before each new attempt, the way the two doors out
    // of the app already do. A stale reason over a fresh Preparing is a screen
    // reporting on the wrong tap.
    const ask = SETTINGS.slice(SETTINGS.indexOf('const askForMyData'), SETTINGS.indexOf('const writeTo'));
    writtenBefore(ask, 'setExportTrouble(null)', 'downloadAccountData(', 'the export refusal survives into the next attempt');
    assert.match(ask, /if \(!result\.ok\) setExportTrouble\(result\.message\)/, 'a refused export says nothing at all');
    assert.ok(!ask.includes('setSheet('), 'a refused export still opens a sheet instead of answering in its own card');
  });

  test('a refusal never leaves the hardware back holding a card nobody saw', () => {
    const union = SETTINGS.match(/type Sheet = ([^;]+);/)?.[1];
    assert.ok(union != null, 'the sheet union moved or was renamed; this test is reading nothing');
    const members = [...union.matchAll(/'(\w+)'/g)].map((m) => m[1]!);
    assert.deepEqual(
      members,
      // Six views that take the whole screen. Two arrived with revamp A: the
      // voice-circle intro, which was a row on Profile, and the reminder's four
      // presets, which were a sheet on Profile (F576). Both take the screen for
      // the same reason the other four do.
      ['none', 'acknowledgements', 'policy', 'terms', 'intro', 'reminderTime', 'delete'],
      'the sheet union names something other than the six views that take the whole screen',
    );
    assert.ok(!SETTINGS.includes('unavailable'), 'the export refusal is a sheet again, which is where F489 started');

    // Every member but `none` takes the screen over through an early return, so
    // there is no such thing as an open sheet the learner cannot see. That is
    // the fix by construction: a card drawn at the foot of a scroll could be
    // open and invisible, and an early return cannot.
    for (const member of members.filter((m) => m !== 'none')) {
      assert.ok(
        SETTINGS.includes(`if (sheet === '${member}')`),
        `the ${member} sheet is not an early return, so it can be open while the learner is looking at something else`,
      );
    }
    assert.doesNotMatch(
      LIST,
      /sheet === '/,
      'the settings list draws something on a sheet condition, so a sheet can be open below the fold',
    );

    // And the hardware back answers exactly the ones this screen draws itself.
    // The four that render their own screens answer their own press (F319), and
    // nothing else may be in the set: two handlers on one screen race, and the
    // loser closes the whole sheet from page two.
    const at = SETTINGS.indexOf('useHardwareBack(');
    const condition = SETTINGS.slice(at, SETTINGS.indexOf('closeCurrentSheet', at));
    const excluded = [...condition.matchAll(/sheet !== '(\w+)'/g)].map((m) => m[1]!);
    assert.deepEqual(
      members.filter((m) => !excluded.includes(m)),
      // The reminder presets joined the delete confirmation with revamp A. It
      // is an ordinary `ScrollScreen` drawn by this file with no hook of its
      // own, so this screen's hook is the only thing that can close it.
      ['reminderTime', 'delete'],
      'the hardware back is answered for a sheet this screen does not draw in place, so a press is eaten',
    );
    // The four that stand it down are exactly the four that bring their own
    // hook, which is the other half of F319 and the half a rename would break.
    assert.deepEqual(
      [...excluded].sort(),
      ['acknowledgements', 'intro', 'none', 'policy', 'terms'],
      'the hook stands down for a sheet that has no hook of its own, so Android back closes nothing at all in it',
    );
    for (const own of ['acknowledgements', 'policy', 'terms', 'intro']) {
      assert.match(
        SETTINGS,
        new RegExp(`if \\(sheet === '${own}'\\) return <`),
        `the ${own} sheet is drawn by this screen rather than rendering its own, so nothing answers the press`,
      );
    }
  });

  test('the delete sheet opens with no failure from a previous attempt', () => {
    // One door, so the draft cannot be half forgotten. The password was cleared
    // on the way out and the reason was not, which is exactly the shape two
    // separate lines produce.
    const door = SETTINGS.slice(
      SETTINGS.indexOf('const forgetDeleteDraft'),
      SETTINGS.indexOf('const closeCurrentSheet'),
    );
    assert.ok(door.length > 0, 'there is no single door that forgets the delete draft');
    assert.match(door, /setDeletePassword\(''\)/, 'the door leaves the typed password behind');
    assert.match(door, /setDeleteError\(null\)/, 'the door leaves the last failure behind, which is the whole of F490');

    // Nowhere else clears half of it.
    assert.equal(
      (SETTINGS.match(/setDeletePassword\(''\)/g) ?? []).length,
      1,
      'the password is cleared somewhere other than the one door, so the two halves can drift apart again',
    );
    assert.deepEqual(
      [...SETTINGS.matchAll(/setDeleteError\(([^)]*)\)/g)].map((m) => m[1]!).sort(),
      ['null', 'null', 'result.message'],
      'the delete failure is written or cleared somewhere unaccounted for',
    );

    // All three ways into and out of the sheet go through it: the row that
    // opens it, Keep my account, and Android's back.
    assert.equal(
      (SETTINGS.match(/forgetDeleteDraft\(\)/g) ?? []).length,
      3,
      'one of the three exits from the delete sheet does not forget the draft',
    );
    const row = SETTINGS.slice(SETTINGS.indexOf('label={DELETE_ROW}'));
    writtenBefore(
      row.slice(0, 300),
      'forgetDeleteDraft()',
      "setSheet('delete')",
      'the Delete account row opens the sheet without clearing what the last visit left in it',
    );
    const keep = SETTINGS.slice(SETTINGS.indexOf('label="Keep my account"'));
    writtenBefore(
      keep.slice(0, 300),
      'forgetDeleteDraft()',
      "setSheet('none')",
      'Keep my account closes the sheet without forgetting the draft',
    );
    const closer = SETTINGS.slice(SETTINGS.indexOf('const closeCurrentSheet'), SETTINGS.indexOf('useHardwareBack('));
    assert.match(
      closer,
      /case 'delete':\s*forgetDeleteDraft\(\);/,
      "Android's back closes the delete sheet and keeps the draft, so the next opening still accuses",
    );
  });

  test('the delete failure is announced, not only drawn', () => {
    const sheetBody = SETTINGS.slice(SETTINGS.indexOf("if (sheet === 'delete')"), SETTINGS.lastIndexOf('  return ('));
    assert.ok(sheetBody.length > 0, 'the delete sheet moved; this test is reading nothing');

    // The password branch is the only one whose failure the learner can fix, so
    // the reason belongs to the field they have to fix it in. `Field` marks the
    // input invalid, describes it by the reason on the web, gives Android a
    // live region, speaks it on iOS and repeats it when the field is refocused
    // — all of which surfaceContract.test.ts already holds it to.
    const field = sheetBody.slice(sheetBody.indexOf('<Field'), sheetBody.indexOf('/>', sheetBody.indexOf('<Field')));
    assert.match(field, /error=\{deleteError\}/, 'the wrong-password reason never reaches the field it is about');

    // Nothing draws it as a bare Text any more. That is the whole defect: a
    // line that changes pixels and says nothing.
    assert.doesNotMatch(
      sheetBody,
      /<Text[^>]*>\{deleteError\}/,
      'the delete failure is a bare Text again, which is silent to VoiceOver and TalkBack',
    );
    // The branches with no password to check still get the announcement, and
    // exactly one of the two is ever drawn.
    assert.match(
      sheetBody,
      /\{!hasPassword && deleteError !== null && <TroubleLine message=\{deleteError\} strong \/>\}/,
      'a Google, Apple or demo account meets a refusal nothing announces',
    );
    writtenBefore(sheetBody, '{hasPassword && (', '{!hasPassword &&', 'the two halves of the reason are no longer exclusive');

    // And the line itself carries all three mechanisms, because the three
    // platforms want three and no two of them share one.
    const LINE = stripComments(read('./TroubleLine.tsx'));
    assert.match(LINE, /role="alert"/, 'the web is not told the line is an alert');
    assert.match(LINE, /accessibilityLiveRegion="polite"/, 'Android is not told to read the line when it appears');
    assert.match(
      LINE,
      /AccessibilityInfo\.announceForAccessibility\(message\)/,
      'iOS, which has neither a live region nor an alert role, is left with a line nothing speaks',
    );
    assert.match(LINE, /Platform\.OS !== 'ios'/, 'the announcement is made twice on the platforms that already have one');
    // Words, held to the text floor rather than a mark's. F330.
    assert.match(LINE, /signal\.correspondance/, 'the refusal is set in something other than the word colour for a change');
    assert.ok(!LINE.includes('inkFaint'), 'a sentence a learner has to act on is set in the faint ink');
    for (const cap of ['numberOfLines', 'maxWidth', 'allowFontScaling', 'maxFontSizeMultiplier']) {
      assert.ok(!LINE.includes(cap), `the refusal caps its own text with ${cap}, so it clips at a large reading size`);
    }
  });
});

describe('the two documents are drawn from their modules and nothing clips them — F479', () => {
  /**
   * The longest text in the app, and the one screen where clipping it would be
   * a legal problem rather than a visual one.
   *
   * A privacy notice that cannot be read to the end has not been given. What a
   * source walk can see is the two ways it would happen: a cap on the text, and
   * the `flexGrow: 1` wrapper inside `ScrollScreen` that F383 records as the
   * cause of a whole tab disappearing at the largest reading size. Whether it
   * really reads end to end on a phone is P7-6 in the runbook, and it is `not
   * run`.
   */
  test('the privacy notice and the terms are drawn from their modules and capped nowhere', () => {
    const POLICY = stripComments(read('../legal/PolicyScreen.tsx'));
    const TERMS = stripComments(read('../legal/TermsScreen.tsx'));

    // Drawn from the data, not retyped. The same sections the hosted page is
    // rendered from, so the screen and the URL cannot say different things.
    assert.match(POLICY, /POLICY_SECTIONS\.map\(/, 'the policy screen writes a document of its own');
    assert.match(POLICY, /\{section\.heading\}/, 'the policy screen draws no section headings');
    assert.match(POLICY, /section\.body\.map\(/, 'the policy screen draws no section bodies');
    assert.match(TERMS, /TERMS_BODY\.map\(/, 'the terms screen writes its own words');
    assert.match(TERMS, /openLink\(APPLE_EULA_URL\)/, "the terms screen does not open Apple's own licence");
    assert.ok(!TERMS.includes('http'), 'the terms screen builds an address instead of using the one in the module');

    for (const [name, source] of [['PolicyScreen.tsx', POLICY], ['TermsScreen.tsx', TERMS]] as const) {
      for (const cap of ['numberOfLines', 'maxWidth', 'adjustsFontSizeToFit', 'maxFontSizeMultiplier', 'allowFontScaling']) {
        assert.ok(!source.includes(cap), `${name} caps its text with ${cap}; a document has to wrap and the column has to grow`);
      }
      // The wrapper F383 names. The frame's own ScrollView already carries the
      // flexGrow that keeps a short page filling the column; a second one
      // inside it is what swallows a tab below its subtitle.
      assert.ok(!source.includes('flexGrow'), `${name} puts its body in a flexGrow wrapper, which is the shape open defect F383 records`);
      assert.match(source, /<ScrollScreen\b/, `${name} is not built on the shared frame`);
      assert.match(source, /useHardwareBack\(true, onBack\)/, `${name} opens in place and never answers Android's back`);
      assert.match(source, /accessibilityRole="header"/, `${name} sets its title as plain text, so nothing announces it as a heading`);
      // Words, never the faint tertiary that only ever cleared as a mark (F330).
      assert.ok(!source.includes('inkFaint'), `${name} sets a line of a legal document in the faint ink`);
    }

    // And Settings is the only door to them, drawn in place rather than pushed,
    // so the whole document is one tap from the row that names it.
    for (const sheet of ["setSheet('policy')", "setSheet('terms')"]) {
      assert.ok(SETTINGS.includes(sheet), `Settings has no row that opens ${sheet}`);
    }
  });
});

describe('the device runbook carries the Pass 7 settings checks — F478', () => {
  test('the device runbook carries the Pass 7 settings checks', () => {
    // A source walk cannot open iOS Settings, the store's own subscription
    // sheet, a mail app or a hosted page, and it cannot read a long document at
    // the largest reading size. Those are a device's to prove, and every one of
    // them is `not run` until somebody walks it.
    assert.match(RUNBOOK, /## Pass 7 settings/, 'the runbook has no Pass 7 settings section');
    const section = RUNBOOK.slice(RUNBOOK.indexOf('## Pass 7 settings'));
    const rows = section.split('\n').filter((l) => /\|\s*P7-\d/.test(l));
    assert.equal(rows.length, 9, `the Pass 7 section names ${rows.length} rows; it should carry P7-1 through P7-9`);
    for (let i = 1; i <= 9; i += 1) {
      assert.match(section, new RegExp(`P7-${i}\\b`), `the Pass 7 runbook names no P7-${i} row`);
    }
    for (const row of rows) {
      assert.match(row, /not run/, `a Pass 7 row claims to be finished before a device walked it: ${row.trim()}`);
      const claimed = row.match(/\|\s*(pass|fail)\s*\|/g) ?? [];
      assert.equal(claimed.length, 0, `a Pass 7 row is marked without naming the platform it was walked on: ${row.trim()}`);
    }

    // The nine things this pass added that no test in this repository can see.
    for (const [what, pattern] of [
      // F489's own row. Where a line is drawn on a scroll, and what the next
      // back press does, are exactly what a source walk cannot see.
      ['a refused export saying why beside the row that was tapped', /Data and privacy card/],
      ['the microphone row appearing after a refusal in iOS Settings', /Microphone row/],
      ['the notifications row doing the same', /Notifications row/],
      ['both rows going away on the walk back', /walk back/],
      ['the store opening its own subscription sheet', /subscription sheet/],
      ['a restore on a fresh install', /fresh install/],
      ['the privacy screen read end to end at the largest text size', /largest text size/],
      ['Contact us opening a mail app', /Mail/],
      ['the consent switch surviving a relaunch and going with the account', /relaunch/],
    ] as const) {
      assert.match(section, pattern, `the Pass 7 section never asks anyone to check ${what}`);
    }
  });

  /**
   * A runbook step that names a control which is not there is a walk nobody can
   * complete, and these rows are the evidence a release decision is made on.
   *
   * F473 moved the account, the two documents, the export and Sign out one push
   * further in, and the runbook kept saying "Profile → Delete account" in four
   * places, including the two deletion walks D9 and D10. Somebody following it
   * on a phone arrives at a Profile tab that has no Account group and stops.
   */
  test('the device runbook routes every settings check through the screen that holds it', () => {
    // Every hop out of Profile lands on Settings, because the Settings row is
    // the only row on Profile that leads anywhere at all. `SETTINGS_ROW` rather
    // than the literal, so the day the row is renamed the runbook has to follow.
    const hops = [...RUNBOOK.matchAll(/Profile → (\S+)/g)].map((m) => m[1]!);
    assert.ok(hops.length >= 6, `only ${hops.length} runbook steps walk out of Profile; this test is reading nothing`);
    for (const hop of hops) {
      assert.equal(
        hop.replace(/[.,)]$/, ''),
        SETTINGS_ROW,
        `the runbook walks Profile → ${hop}, and the only row on Profile that leads anywhere is ${SETTINGS_ROW}`,
      );
    }

    // And no step names a control that moved while still routing through the
    // tab it moved off. One line at a time, because that is the unit a person
    // reads and follows.
    const MOVED = [
      DELETE_ROW,
      SIGN_OUT_ROW,
      DOWNLOAD_ROW,
      SAVED_ROW,
      EMAIL_ROW,
      PRIVACY_POLICY_ROW,
      ACKNOWLEDGEMENTS_ROW,
    ];
    for (const line of RUNBOOK.split('\n')) {
      if (!/\bProfile\b/.test(line)) continue;
      for (const control of MOVED) {
        if (!line.includes(control)) continue;
        assert.match(
          line,
          new RegExp(`Profile → ${SETTINGS_ROW}`),
          `the runbook routes ${control} through Profile, and it is one push further in now: ${line.trim()}`,
        );
      }
    }

    // The two deletion walks by name, because they are the pair F494 was filed
    // about and a sweep that stopped catching them would still pass above.
    assert.ok(
      (RUNBOOK.match(new RegExp(`Profile → ${SETTINGS_ROW} → ${DELETE_ROW}`, 'g')) ?? []).length >= 3,
      'the runbook no longer walks anybody to the delete row where it actually lives',
    );

    // And the sweep did not overshoot in either direction. The monogram and the
    // five learning settings stayed on Profile, so a step naming them there is
    // right and must not be rewritten to say Settings; the reminder went the
    // other way with F576 and is under Phone on Settings, so a step naming it on
    // Profile is a walk that now ends nowhere. Both are pinned, because the
    // runbook drifting either way sends a tester to the wrong screen.
    assert.match(
      RUNBOOK,
      /reminder row under Phone on Settings/,
      'the runbook still looks for the reminder on Profile, and it lives under Phone on Settings now',
    );
    assert.match(
      RUNBOOK,
      /its disc on Profile/,
      'the monogram was moved off Profile in the runbook and not in the app',
    );
  });
});
