import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, test } from 'node:test';

import { guiltIn, streakGuiltIn } from '../copy/guilt.ts';
import { PAID_PLANS } from './adapter.ts';
import { billingStatusIn } from './billingStatus.ts';
import { CAPABILITY_COPY, INCLUSIONS, LOCKED_FEATURES, capabilitiesFor, planInclusions } from './capabilities.ts';
import { isFreeExploreContent } from './exploreAccess.ts';

const SRC = fileURLToPath(new URL('..', import.meta.url));

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

describe('the D24 locks each plan opens', () => {
  test('free, unknown and lapsed open none; Core opens all but the two Max doors; Max opens all', () => {
    const keys = ['fixes', 'thenAndNow', 'conversationPractice', 'sounds', 'realMoment', 'continueArc', 'fullJourney', 'tutorMemory'];
    assert.deepEqual([...LOCKED_FEATURES], keys, 'the locks are not direction B\'s eight, in its order');
    for (const plan of ['trial', 'starter', 'regular', 'unknown'] as const) {
      for (const lapsed of [false, true]) assert.deepEqual(Object.keys(capabilitiesFor(plan, lapsed).unlocks), keys);
    }
    for (const [plan, lapsed] of [['trial', false], ['trial', true], ['unknown', false], ['starter', true], ['regular', true]] as const) {
      assert.ok(Object.values(capabilitiesFor(plan, lapsed).unlocks).every((open) => open === false), `${plan}${lapsed ? ' (lapsed)' : ''} opened a lock`);
    }
    const core = capabilitiesFor('starter').unlocks;
    for (const key of keys) assert.equal(core[key as keyof typeof core], key !== 'realMoment' && key !== 'continueArc', `Core: ${key}`);
    assert.equal(core.realMoment, capabilitiesFor('starter').customRehearsal, 'the real moment lock and the Max door disagree');
    assert.equal(core.continueArc, capabilitiesFor('starter').continueArc);
    assert.ok(Object.values(capabilitiesFor('regular').unlocks).every((open) => open === true));
  });
});

describe('what a plan opens, said in one place (F564, F565)', () => {
  test('each plan lists only what capabilities.ts opens, and nothing gates packs, phrases or missions', () => {
    for (const plan of ['trial', 'starter', 'regular'] as const) {
      const opened = capabilitiesFor(plan);
      // Earned learning is never gated, on any plan, lapsed or not.
      assert.equal(opened.packs, true);
      assert.equal(opened.savedPhrases, true);
      assert.equal(opened.missions, true);
      assert.equal(opened.memory, true);
      assert.deepEqual(capabilitiesFor(plan, true).packs, true);
    }
    assert.equal(capabilitiesFor('regular').customRehearsal, true);
    assert.equal(capabilitiesFor('regular').continueArc, true);
    assert.equal(capabilitiesFor('starter').customRehearsal, false);
    assert.equal(capabilitiesFor('regular', true).customRehearsal, false, 'a lapsed Max keeps a Max door');

    // The inclusions say only what the table opens, and the two Max lines
    // appear on Max alone.
    const starter = planInclusions('starter');
    const max = planInclusions('regular');
    assert.ok(max.length > starter.length, 'Max lists nothing Starter does not');
    for (const line of starter) assert.ok(max.includes(line), `Starter lists "${line}" and Max does not`);
    for (const line of max) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries "${guiltIn(line)}"`);
      assert.doesNotMatch(line, /\d|—|%/, `"${line}" carries a digit, an em dash or a percentage`);
    }
    assert.deepEqual(planInclusions('trial'), starter, 'the trial and Starter open different learning, and they do not');

    // Nothing that draws earned learning asks this table: the tabs, the
    // drills, the review and the packs open for everyone. Only the two Max
    // doors may read it.
    const askers = sourceFiles(SRC)
      .filter((file) => readFileSync(file, 'utf8').includes('capabilitiesFor('))
      .map((file) => file.slice(SRC.length))
      .sort();
    // Two named additions, neither a screen: the tutor revisit offered from
    // Practice and from the conversation library asks the same continueArc rule
    // the Tutor tab does, through one file; and the game view reads streak
    // protection (founder decision D4: freezes and repair come with a plan).
    assert.deepEqual(
      askers,
      // D24 (2026-10-20): featureLocks.ts is the one owner of the locks and reads `unlocks` alone.
      ['game/view.ts', 'purchases/capabilities.ts', 'purchases/exploreAccess.ts', 'purchases/featureLocks.ts', 'purchases/useContinueArc.ts', 'tabs/TutorTab.tsx', 'tutor/RealMomentScreen.tsx'],
      `something else gates on the plan: ${askers.join(', ')}`,
    );
    assert.ok(askers.includes('tutor/RealMomentScreen.tsx'), 'the real moment no longer asks the plan');

    // The new authored conversation collection reads paid standing through
    // this owner. Existing local and earned practice retain their access.
    const explore = readFileSync(join(SRC, 'purchases/exploreAccess.ts'), 'utf8');
    assert.match(explore, /capabilitiesFor\(status\?\.plan \?\? 'unknown', status\?\.lapsed \?\? true\)\.liveMinutes !== 'trial'/);
    assert.equal(isFreeExploreContent({ kind: 'daily', id: 'kept-phrase' }), true);
    assert.equal(isFreeExploreContent({ kind: 'mission', id: 'mission:cafe' }), true);
    assert.doesNotMatch(explore, /\.packs|\.savedPhrases|\.missions|\.memory/);

    // The game view reads streak protection and nothing else from the plan.
    const view = readFileSync(join(SRC, 'game/view.ts'), 'utf8');
    assert.match(view, /capabilitiesFor\(billing\.plan, billing\.lapsed\)\.streakProtection/, 'the game view reads something other than streak protection');
    for (const earned of ['.packs', '.savedPhrases', '.missions', '.memory', '.customRehearsal', '.continueArc']) {
      assert.ok(!view.includes(earned), `the game view gates ${earned}, which it was not added for`);
    }

    // The lock owner reads `unlocks` and nothing else.
    const locks = readFileSync(join(SRC, 'purchases/featureLocks.ts'), 'utf8');
    assert.match(locks, /capabilitiesFor\(status\.plan, status\.lapsed\)\.unlocks\[feature\]/, 'the lock owner reads something other than unlocks');
    for (const other of ['.packs', '.savedPhrases', '.missions', '.memory', '.customRehearsal', '.continueArc', '.streakProtection', '.liveMinutes']) {
      assert.ok(!locks.includes(other), `the lock owner gates ${other}, which it was not added for`);
    }

    // The helper reads the one Max door it exists for, and nothing else.
    const helper = readFileSync(join(SRC, 'purchases/useContinueArc.ts'), 'utf8');
    assert.match(helper, /capabilitiesFor\(status\.plan, status\.lapsed\)\.continueArc/, 'the helper reads something other than continueArc');
    assert.match(helper, /setAllowed\(status !== null && /, 'a status nobody could read opens the revisit door');
    for (const earned of ['.packs', '.savedPhrases', '.missions', '.memory', '.customRehearsal']) {
      assert.ok(!helper.includes(earned), `the helper gates ${earned}, which it was not added for`);
    }
    // And exactly the two doors it was added for use it.
    const users = sourceFiles(SRC)
      .filter((file) => readFileSync(file, 'utf8').includes('useContinueArc('))
      .map((file) => file.slice(SRC.length))
      .filter((file) => file !== 'purchases/useContinueArc.ts')
      .sort();
    assert.deepEqual(users, ['conversationPacks/ConversationsScreen.tsx', 'tabs/PracticeTab.tsx'], `the revisit gate is read by an unexpected screen: ${users.join(', ')}`);
    for (const line of CAPABILITY_COPY) assert.equal(guiltIn(line), undefined);
  });

  test('a learner on the trial meets an honest line and a door to plans, and an unknown plan reads as the trial', () => {
    // An unknown plan reads as the free plan, except that it holds no freeze (D23).
    assert.deepEqual({ ...capabilitiesFor('unknown'), streakProtection: null }, { ...capabilitiesFor('trial'), streakProtection: null }, 'a plan nobody could read opens a door the free plan does not');
    assert.deepEqual(capabilitiesFor('unknown').streakProtection, { freezes: 0, repair: false });
    assert.equal(capabilitiesFor('trial').customRehearsal, false);
    const screen = readFileSync(join(SRC, 'tutor', 'RealMomentScreen.tsx'), 'utf8');
    assert.match(screen, /status === null \? null : capabilitiesFor\(status\.plan, status\.lapsed\)\.customRehearsal/, 'an unread plan cannot be treated as an upgrade opportunity');
    assert.match(screen, /\{allowed === false && \([\s\S]*?\{MAX_ONLY_LINE\}[\s\S]*?<OutlineButton label=\{SEE_PLANS\} onPress=\{onSeePlans\}/, 'a gated learner is not told plainly, or has no way to the plans');
    assert.match(screen, /\{allowed === true && \([\s\S]*?<PillButton label=\{checking \? 'Connecting…' : REHEARSE_ACTION\}/, 'an allowed learner has no way to rehearse');
    assert.match(screen, /allowed === null && <Text accessibilityLiveRegion="polite"/, 'plan loading or failure is explained');
  });

  test('two freezes and the repair come with a paid plan; the free plan holds one freeze (D23)', () => {
    // D4 (2026-10-05): two freezes and the one-tap repair on either paid tier.
    // D23 (2026-10-20): the free plan, and so a lapsed plan, holds one freeze and
    // no repair. A plan nobody could read holds none: a freeze that applied
    // because a check failed would be a perk the plan may not hold.
    for (const plan of ['starter', 'regular'] as const) {
      assert.deepEqual(capabilitiesFor(plan).streakProtection, { freezes: 2, repair: true }, `${plan} holds no streak protection`);
      assert.deepEqual(capabilitiesFor(plan, true).streakProtection, { freezes: 1, repair: false }, `a lapsed ${plan} kept its paid protection, or lost the free freeze`);
    }
    assert.deepEqual(capabilitiesFor('trial').streakProtection, { freezes: 1, repair: false });
    assert.deepEqual(capabilitiesFor('trial', true).streakProtection, { freezes: 1, repair: false });
    assert.deepEqual(capabilitiesFor('unknown').streakProtection, { freezes: 0, repair: false }, 'an unread plan was given a freeze');

    // A store free trial is answered by the server as the plan itself, unlapsed,
    // with a week of minutes, so the trial holds the perk as D4 says it should.
    const storeTrial = billingStatusIn({
      plan: 'starter', secondsRemaining: 42 * 60, periodEnd: '2026-10-12T09:00:00.000Z', lapsed: false, canStart: true, reason: null,
    });
    assert.ok(storeTrial, 'a store trial status did not read');
    assert.deepEqual(capabilitiesFor(storeTrial.plan, storeTrial.lapsed).streakProtection, { freezes: 2, repair: true });

    // Each answer is its own: one caller cannot spend another caller's freezes.
    const held = capabilitiesFor('regular');
    held.streakProtection.freezes = 0;
    assert.equal(capabilitiesFor('regular').streakProtection.freezes, 2);
  });

  test('the plans page names streak protection on both paid plans', () => {
    // F734 (7 October 2026): F718 retired "streak" from the shared ban, so the
    // plans page can say what D4 gives every paid plan. One line, written here
    // where what a plan opens is said, and true of every plan the page sells:
    // both tiers, monthly or yearly, during the store's free trial too.
    assert.equal(INCLUSIONS.streak, 'Every plan includes a second streak freeze and a one-tap repair.');
    assert.ok(CAPABILITY_COPY.includes(INCLUSIONS.streak), 'the streak line escapes the copy sweeps');
    assert.equal(guiltIn(INCLUSIONS.streak), undefined);
    assert.equal(streakGuiltIn(INCLUSIONS.streak), undefined, 'the streak line threatens');
    assert.doesNotMatch(INCLUSIONS.streak, /\d|—|–|·|%/);
    for (const plan of PAID_PLANS) {
      const protection = capabilitiesFor(plan).streakProtection;
      assert.ok(protection.freezes > 0 && protection.repair, `the plans page promises ${plan} a protection it does not hold`);
    }
    // The free plan holds one freeze and no repair, so the line is never one of its own.
    assert.equal(capabilitiesFor('trial').streakProtection.repair, false);
    assert.ok(capabilitiesFor('trial').streakProtection.freezes < capabilitiesFor('starter').streakProtection.freezes, 'a "second" freeze is not more than the free plan holds');
    for (const plan of ['trial', 'starter', 'regular'] as const) {
      assert.ok(!planInclusions(plan).includes(INCLUSIONS.streak), 'the streak line is listed per plan, where the free minutes share Starter\'s list');
    }

    // The page says it once, after every plan's rows, so it is said of both
    // plans and never of one, with the freeze mark beside it.
    const page = readFileSync(join(SRC, 'wall', 'WallPlansPage.tsx'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    assert.equal((page.match(/\{INCLUSIONS\.streak\}/g) ?? []).length, 1, 'the streak line is not said on the plans page, or is said twice');
    assert.ok(page.indexOf('{INCLUSIONS.streak}') > page.lastIndexOf('row.offers.map('), 'the streak line sits inside one plan\'s rows');
    assert.match(page, /<Sheet reading surface=\{colors\.surface\} ink=\{colors\.text\} visible=\{comparing\}/);
  });
});
