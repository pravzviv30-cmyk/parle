/**
 * The three questions, the two that are no longer asked, and the order.
 *
 * Half of this suite is behaviour and half is a source read, which is the
 * `labels.test.ts` and `nav/wiring.test.ts` idiom and is deliberate: apps/mobile
 * has no renderer, so "the flow does not ask for a date of birth" and "the goal
 * is asked in Profile" are claims about what a screen puts on glass, and the
 * only honest way to hold them here is to read the file. A tripwire that
 * catches the mistake anyone actually makes is worth more than a proof nobody
 * can run.
 *
 * One test reads a document instead of a screen. `docs/ONBOARDING.md` counts the
 * screens a new learner crosses, and a count in prose rots the moment somebody
 * adds a page, so the count is held to `PAGES` the same way everything else here
 * is held to the code.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  AGE_CONFIRM,
  AGE_DENY,
  AGE_QUESTION,
  AGE_REFUSAL,
  AGE_REFUSAL_EXIT,
  AGE_SUB,
  NAME_LABEL,
  NAME_QUESTION,
  NAME_SKIP_HINT,
  PAGES,
  ageGate,
  answersFrom,
  needsOnboarding,
  nameFrom,
  pageAfter,
  pageBefore,
} from './answers.ts';
import { createStoredProfile, completeProfile } from '../profile/store.ts';
import { DAILY_GOAL_ROW } from '../profile/dailyGoal.ts';
import { upgradeStored } from '../profile/upgrade.ts';

/** A fixed clock, because a rule about who gets asked must not depend on today. */
const NOW = new Date(2026, 5, 1, 12).getTime();

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Comments may say anything; only what reaches glass is under test. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const FLOW = stripComments(read('./OnboardingFlow.tsx'));
const RULES = stripComments(read('./answers.ts'));
const AGE_GATE = stripComments(read('./AgeGateScreen.tsx'));
const REFUSAL = stripComments(read('./AgeRefusal.tsx'));
const PROFILE_TAB = stripComments(read('../tabs/ProfileTab.tsx'));
const DOC = read('../../../../docs/ONBOARDING.md');

describe('onboarding — three questions, and nothing that has to be answered', () => {
  test('a skipped name is stored as null, not as an empty string', () => {
    // An empty string is a name somebody typed. Null is a question they
    // declined, and the difference is what stopped Home greeting "Bonjour, ".
    assert.equal(nameFrom(''), null);
    assert.equal(nameFrom('   '), null, 'whitespace is not a name');
    assert.equal(nameFrom('  Camille '), 'Camille', 'a real name still arrives trimmed');

    const skipped = answersFrom({ name: '  ', ageConfirmed: true, motivation: null , tutorVoice: null });
    assert.equal(skipped.name, null, 'the assembled answers carry the skip, not an empty string');
    assert.equal(skipped.motivation, null, 'a question nobody is asked is null, never a reason invented for them');

    // And the flow delegates rather than assembling its own: this rule used to
    // live inline as `name: name.trim()`, where nothing could reach it.
    assert.match(FLOW, /answersFrom\(/, 'the flow assembles its answers somewhere no test can see');
    assert.doesNotMatch(FLOW, /name:\s*name\.trim\(\)/, 'the empty-string name is back in the screen');
    assert.doesNotMatch(FLOW, /motivation\s*\?\?\s*'/, 'the flow is inventing a reason for a learner again');
  });

  test('onboarding never asks for a date of birth', () => {
    assert.deepEqual([...PAGES], ['age', 'name', 'meet', 'voice'], 'the pages are the four that are left');

    for (const forbidden of [
      'DD/MM/YYYY',
      'When were you born',
      'isoFromDobInput',
      'formatDobInput',
      'dobText',
      'dobError',
    ]) {
      assert.ok(!FLOW.includes(forbidden), `onboarding still reaches for a date of birth: ${forbidden}`);
    }
    assert.doesNotMatch(FLOW, /\bdob\b/, 'the flow still handles a date of birth');
    assert.doesNotMatch(FLOW, /keyboardType="number-pad"/, 'onboarding still asks somebody to type a date');
  });

  test('a learner who cannot confirm their age is told plainly and is not let through', () => {
    const refused = ageGate(false);
    assert.equal(refused.go, false, 'the confirmation is the only way past');
    assert.equal(refused.refusal, AGE_REFUSAL);
    assert.equal(ageGate(true).go, true, 'and a learner who confirms is not stopped');
    assert.equal(ageGate(true).refusal, null, 'nobody who was let through is shown a refusal');

    // Plainly: it says who the product is for, without scolding and without a
    // number, and it does not pretend to be a retry.
    assert.ok(AGE_REFUSAL.length > 0);
    assert.ok(!/—/.test(AGE_REFUSAL), 'the refusal carries an em dash');
    assert.ok(!/\d/.test(AGE_REFUSAL), 'a refusal reads better in words than in digits');
    assert.ok(!/\b(sorry|wrong|cannot|denied|error)\b/i.test(AGE_REFUSAL), 'the refusal apologises or scolds');

    // The screen asks the question as one tap, and offers the honest no.
    assert.ok(FLOW.includes('AGE_CONFIRM'), 'the age page lost its confirmation');
    assert.ok(FLOW.includes('AGE_DENY'), 'a learner who is not old enough has no way to say so');
    assert.ok(FLOW.includes('ageGate('), 'the age page decides for itself again');
    assert.equal(AGE_CONFIRM, 'I am 13 or older');
    assert.ok(AGE_DENY.length > 0);
  });

  test('the daily goal is asked in profile and nowhere in onboarding', () => {
    for (const forbidden of ['dailyGoalMin', 'How much time each day', 'Five minutes', 'GOALS']) {
      assert.ok(!FLOW.includes(forbidden), `the goal question is back on the way to a first conversation: ${forbidden}`);
    }
    assert.ok(!PAGES.includes('goal' as never), 'the goal is a page again');

    assert.ok(PROFILE_TAB.includes('withDailyGoal'), 'profile has no way to set the goal, so nowhere asks it');
    // The words are in `profile/dailyGoal.ts` now and the screen imports them,
    // which is the rule the reminder row already keeps: a name spelled in two
    // places is a name that comes to mean two things. So the claim splits in
    // two, and together they are the same claim as before.
    assert.equal(DAILY_GOAL_ROW, 'Daily goal', 'the goal row has no name a learner could find it by');
    assert.ok(
      PROFILE_TAB.includes('DAILY_GOAL_ROW'),
      'profile spells the row name itself, or has no row for the goal at all',
    );
  });

  test('the why question is gone from the flow and not from the record', () => {
    // Dropped because nothing read the answer. The FIELD stays, because stored
    // records carry one and the profile blob syncs whole: a flow that hardcoded
    // null here would quietly erase a value on the one path that re-onboards
    // somebody who already has a record.
    assert.ok(!PAGES.includes('why' as never), 'the why page is back');
    for (const forbidden of ['MOTIVATIONS', 'WHY_QUESTION', 'WHY_SKIP', 'Why are you learning']) {
      assert.ok(!FLOW.includes(forbidden), `onboarding is asking why again: ${forbidden}`);
    }

    // `OptionCard` used to be on that list, because a list of tappable options
    // in this flow could only have been the why page. It is not a proxy for the
    // why question any more: the voice step draws one card per catalogue voice
    // with the same component the Profile sheet uses. So the guard is re-pointed
    // at the fact that still carries it — every option card in this flow belongs
    // to the voice step, and none of them asks a question about the learner.
    const cards = [...FLOW.matchAll(/<OptionCard/g)].map((m) => m.index ?? -1);
    const voicePageAt = FLOW.indexOf("{page === 'voice' && (");
    assert.ok(voicePageAt > 0, 'the voice step is no longer rendered by name');
    for (const index of cards) {
      assert.ok(index > voicePageAt, 'onboarding offers a list of options somewhere other than the voice step');
    }

    const existing = createStoredProfile(answersFrom({ name: 'Ada', ageConfirmed: true, motivation: 'work' , tutorVoice: null }), NOW);
    assert.equal(existing.motivation, 'work', 'the stored record stopped carrying the field at all');

    const reonboarded = completeProfile(
      existing,
      answersFrom({ name: 'Ada', ageConfirmed: true, motivation: existing.motivation , tutorVoice: null }),
      NOW,
    );
    assert.equal(reonboarded.motivation, 'work', 'walking the flow again threw away a stored answer');
    assert.match(
      FLOW,
      /motivation:\s*existing\?\.motivation\s*\?\?\s*null/,
      'the flow no longer hands back what the record already carried',
    );
  });
});

describe('onboarding — the shape of the walk', () => {
  test('every page has somewhere to go, and the first has nothing behind it', () => {
    assert.equal(pageBefore('age'), null, 'there is nothing behind the first question');
    assert.equal(pageAfter('age'), 'name');
    assert.equal(pageAfter('name'), 'meet');
    assert.equal(pageAfter('meet'), 'voice');
    assert.equal(pageAfter('voice'), null, 'the last page finishes rather than advancing');
    assert.equal(pageBefore('meet'), 'name');
    assert.equal(pageBefore('voice'), 'meet', 'the back chevron out of the voice step goes nowhere');
  });

  test('age is asked before any personal question', () => {
    // Minimisation, in the only form that survives a screen reorder: do not
    // take a detail from somebody you are about to turn away. The gate used to
    // be second, so a learner who said they were younger than thirteen had
    // already typed their name into an app that then refused them. Nothing was
    // ever persisted, and the question had still been asked.
    assert.equal(PAGES[0], 'age', 'the gate is not the first thing asked');
    assert.ok(PAGES.indexOf('name') > PAGES.indexOf('age'), 'the name is asked before the gate');
    assert.match(FLOW, /useState<Page>\('age'\)/, 'the flow opens on a page that is not the gate');

    // And on glass, in the order the pages are rendered: the one text field in
    // the flow sits between the gate and the last page.
    const agePage = FLOW.indexOf("page === 'age' &&");
    const namePage = FLOW.indexOf("page === 'name' &&");
    const meetPage = FLOW.indexOf("page === 'meet' &&");
    const voicePage = FLOW.indexOf("page === 'voice' &&");
    assert.ok(agePage >= 0 && namePage > agePage, 'the gate is rendered after a personal question');
    assert.ok(meetPage > namePage, 'the disclosure is not after the questions');
    assert.ok(voicePage > meetPage, 'the voices are met before the app says what they are');
    assert.equal((FLOW.match(/<Field/g) ?? []).length, 1, 'onboarding grew a second thing to type into');
    const field = FLOW.indexOf('<Field');
    assert.ok(field > namePage && field < meetPage, 'the text field is not on the name page');

    // Nothing before the last page can finish, so a refused learner cannot be
    // written to disk on the way past.
    //
    // This used to read the one line carrying `onPress={finish}` and check that
    // the same line named the page. The last page has two ways out now, the pill
    // and the skip beside it — `complete(voice)` and `complete(null)` — and both
    // are several lines from the branch that renders them. So the guard is
    // re-pointed at the fact that still carries it: every call that completes
    // onboarding sits after the last page's branch opens, which is the thing
    // "a page before the last one cannot finish" means.
    const lastPageAt = FLOW.indexOf("{page === 'voice' && (");
    assert.ok(lastPageAt > 0, 'the last page is not rendered by name any more');
    const finishers = [...FLOW.matchAll(/\bcomplete\(/g)].map((m) => m.index ?? -1);
    assert.ok(finishers.length > 0, 'nothing finishes onboarding at all');
    for (const index of finishers) {
      assert.ok(index > lastPageAt, 'a page before the last one finishes onboarding');
    }
    assert.equal(ageGate(false).go, false, 'and the refusal is still a full stop');
  });

  test('the name is asked with a label a learner and a screen reader can both read', () => {
    // It was a placeholder and nothing else, which vanishes the moment somebody
    // types and was the only name assistive tech had for the input.
    assert.equal(NAME_LABEL, 'Your name');
    assert.match(FLOW, /label=\{NAME_LABEL\}/, 'the name field lost its visible label');
    assert.doesNotMatch(FLOW, /placeholder="Your name"/, 'the label is back to being a placeholder');
  });

  test('nothing onboarding says to a learner carries an em dash or a scolding', () => {
    for (const line of [AGE_QUESTION, AGE_SUB, AGE_CONFIRM, AGE_DENY, NAME_QUESTION, NAME_LABEL, NAME_SKIP_HINT, AGE_REFUSAL_EXIT]) {
      assert.ok(!/[—–]/.test(line), `"${line}" carries an em dash`);
      assert.ok(!/\b(wrong|bad|failed|must)\b/i.test(line), `"${line}" scolds`);
    }
  });
});

describe('a refused learner has a way out, and hears the refusal — F356', () => {
  test('a refused learner is offered a sign out on both gate surfaces, and hears the refusal — F356', () => {
    // One component draws the refusal on both doors into the one gate, so the
    // sign-out exit and the spoken refusal cannot be on one surface and not the
    // other. Both screens render it, and hand it the same sign-out door.
    for (const [where, src] of [['the first run', FLOW], ['the return gate', AGE_GATE]] as const) {
      assert.match(
        src,
        /<AgeRefusal\s+text=\{refusal\}\s+onSignOut=\{onSignOut\}/,
        `${where} does not render the shared refusal with a sign out`,
      );
    }

    // The refusal is spoken, not merely drawn: the alert role and a polite live
    // region cover Android and the web, and iOS is told out loud on mount — the
    // same trio Field uses for an error the eye cannot see change.
    assert.match(REFUSAL, /accessibilityRole="alert"/, 'the refusal is not announced as an alert');
    assert.match(REFUSAL, /accessibilityLiveRegion="polite"/, 'Android is not told to read the refusal when it appears');
    assert.match(
      REFUSAL,
      /AccessibilityInfo\.announceForAccessibility\(text\)/,
      'iOS, which has neither the role nor the live region, is left with a refusal nothing speaks',
    );

    // And the only way off it is a sign out, never a pill: the account exists
    // before the gate, so the honest exit is out, and a solid pill under a
    // refusal reads as a second chance the boundary is not offering.
    assert.match(REFUSAL, /<GhostButton\s+label=\{AGE_REFUSAL_EXIT\}/, 'the refusal offers no way out');
    assert.ok(!REFUSAL.includes('PillButton'), 'the refusal is a full stop and must not offer a pill');
    assert.equal(AGE_REFUSAL_EXIT, 'Sign out');
  });

  test('the way through disappears once the learner says they are younger — F356', () => {
    // Tapping "I am younger than that" sets oldEnough false, and the deny ghost
    // is gated on it, so the honest refusal is never shown with the way to say
    // it again still sitting under it. Held on both gate surfaces.
    for (const [where, src] of [['the first run', FLOW], ['the return gate', AGE_GATE]] as const) {
      assert.match(
        src,
        /oldEnough !== false &&[\s\S]{0,160}GhostButton label=\{AGE_DENY\}/,
        `${where} leaves the deny ghost tappable after the learner has already said they are younger`,
      );
    }
  });
});

describe('the Meet page reads as a paragraph, not a plaque — F359', () => {
  test('the Meet page sets its lines left, as a paragraph — F359', () => {
    // Four multi-sentence lines set centred read as fine print. Left-set under
    // the centred title and art, they read as reassurance. Only the lines move;
    // the title stays centred.
    assert.match(
      FLOW,
      /line:\s*\{[^}]*textAlign:\s*'left'/,
      'the Meet lines are still centred, so the disclosure reads as a plaque',
    );
    assert.match(
      FLOW,
      /question:\s*\{[^}]*textAlign:\s*'center'/,
      'the Meet title stopped being centred, which was never the ask',
    );
  });
});

describe('leaving onboarding — the journey, not the field', () => {
  // Driven through the real constructors rather than hand-built objects. The
  // defect this pins came from a guard reading a field that a different function
  // was allowed to leave null, so a test that fabricates its own profile would
  // reproduce the author's assumption instead of the app's behaviour.

  test('a learner who skips their name is not sent back to page one', () => {
    // The trap: the name became optional, the guard still read the name, and the
    // learner was returned to onboarding on that launch and every launch after.
    const stored = createStoredProfile(answersFrom({ name: '   ', ageConfirmed: true, motivation: null , tutorVoice: null }), NOW);

    assert.equal(stored.name, null, 'a skipped name is still stored as null, which is the honest value');
    assert.equal(
      needsOnboarding(stored),
      false,
      'they answered every question they were required to answer, so nothing may ask them again',
    );
  });

  test('a learner who gave their name is not asked again either', () => {
    const stored = createStoredProfile(answersFrom({ name: 'Sam', ageConfirmed: true, motivation: 'trip' , tutorVoice: null }), NOW);
    assert.equal(needsOnboarding(stored), false);
  });

  test('a learner who has never seen the age question is still asked', () => {
    // The case the old guard actually existed for: a version-1 record, from
    // before either question was asked. Migrating one must not smuggle it past.
    const migrated = upgradeStored({ version: 1, motivation: 'work', onboardedAt: NOW - 1000, brain: {} }, NOW);

    assert.ok(migrated, 'a v1 record still upgrades');
    assert.equal(migrated.ageConfirmed, null, 'nothing in a v1 record can answer the age question');
    assert.equal(needsOnboarding(migrated), true, 'so they have to be asked, exactly as before');
  });

  test('a learner whose stored date of birth already answered it is left alone', () => {
    // They answered this question years ago in a different shape. Asking again
    // because the shape changed would be the app forgetting its own learner.
    const migrated = upgradeStored({ version: 3, name: 'Ada', dob: '1990-04-02', motivation: 'want', dailyGoalMin: 10, onboardedAt: NOW - 1000, username: null, brain: {} }, NOW);

    assert.ok(migrated);
    assert.equal(migrated.ageConfirmed, true);
    assert.equal(needsOnboarding(migrated), false, 'a dob that already proves thirteen is an answer, not a gap');
    assert.equal(migrated.dob, '1990-04-02', 'and nothing of theirs was thrown away to reach that conclusion');
  });

  test('nobody at all is asked', () => {
    assert.equal(needsOnboarding(null), true);
  });

  test('a returning learner is never sent back through onboarding', () => {
    // Reordering the pages is exactly the kind of change that could quietly
    // re-onboard everybody, so this holds the rule from both ends: the people
    // who must never see it again, and the fact that the rule cannot see the
    // pages at all.
    const finished = createStoredProfile(answersFrom({ name: 'Camille', ageConfirmed: true, motivation: null , tutorVoice: null }), NOW);
    assert.equal(needsOnboarding(finished), false, 'somebody who just finished the new flow is asked again');

    // The same record after a round trip through the pre-account upgrade path,
    // which is what a returning learner's stored profile goes through on launch.
    const upgraded = upgradeStored({ ...finished }, NOW);
    assert.ok(upgraded, 'a current record no longer upgrades');
    assert.equal(needsOnboarding(upgraded), false, 'a launch upgrade re-opens onboarding for a finished learner');

    // And the one this phase could most easily have broken: a learner who
    // signed in on a new phone, whose profile arrived from the account rather
    // than from this flow. Phase 2's freshDevice rule waits for exactly this
    // record; onboarding must not run on top of it.
    const adopted = upgradeStored(JSON.parse(JSON.stringify(finished)), NOW);
    assert.ok(adopted);
    assert.equal(needsOnboarding(adopted), false, 'a profile adopted from the account still opens onboarding');
    assert.equal(adopted.name, 'Camille', 'and it arrives with what the account was holding');

    // The rule names no page, which is what makes all of the above stable under
    // a reorder. A guard that mentioned a page would be a guard the next flow
    // change silently rewrites.
    const guard = RULES.slice(RULES.indexOf('export function needsOnboarding'));
    for (const page of PAGES) {
      assert.ok(!guard.includes(`'${page}'`), `the leaving rule depends on the page named ${page}`);
    }
    assert.ok(guard.includes('ageConfirmed'), 'the leaving rule stopped reading the one question nobody may decline');
  });
});

describe('the age gate is a gate on screen, not only in the rule', () => {
  test('the way through disappears once the learner says they are younger', () => {
    // A tripwire, in this file's own idiom. `ageGate(false).go === false` was
    // already true and already tested, and the screen showed the refusal with
    // the confirm pill still rendered and enabled underneath it. The rule said
    // no and the glass said yes, and only the rule was under test.
    const guarded = FLOW.match(/\{page === 'age' &&[^}]*PillButton[^}]*\}/);
    assert.ok(guarded, 'the age page still offers a way through');
    assert.match(
      guarded[0],
      /oldEnough !== false/,
      'and it has to be gone once they have answered, or the refusal is a suggestion with a button under it',
    );
  });
});

describe('the onboarding doc counts the screens the code shows', () => {
  test('the onboarding doc claims the same page count the flow renders', () => {
    // A count written in prose rots the first time somebody adds a page, and a
    // document that miscounts the flow is worse than no document: it is read
    // instead of the code.
    const claim = DOC.match(/Onboarding renders \*\*(\d+) pages\*\*: ([^.]+)\./);
    assert.ok(claim, 'docs/ONBOARDING.md no longer says how many pages onboarding renders');
    assert.equal(Number(claim[1]), PAGES.length, `the doc claims ${claim[1]} pages and PAGES holds ${PAGES.length}`);
    assert.deepEqual(
      [...(claim[2] ?? '').matchAll(/`([a-z]+)`/g)].map((m) => m[1]),
      [...PAGES],
      'the doc names different pages, or names them in a different order',
    );

    // The screens either side of onboarding are the welcome, the sign-up and the
    // chooser, so the total moves with the page count and cannot drift alone.
    const screens = DOC.match(/crosses \*\*(\d+) screens\*\*/);
    assert.ok(screens, 'the doc stopped counting the screens before the first scene');
    assert.equal(
      Number(screens[1]),
      PAGES.length + 3,
      'the doc counts screens that no longer match the pages plus the welcome, the sign-up and the chooser',
    );

    // And it stays honest about what the count is standing in for. Wall-clock
    // time to first French is F114's device pass, not a claim this repo may make.
    assert.match(DOC, /cannot be produced on the machine/, 'the doc stopped saying the stopwatch is not run here');
    assert.match(DOC, /F114/, 'the doc no longer names who owns the measurement it is standing in for');
  });
});
