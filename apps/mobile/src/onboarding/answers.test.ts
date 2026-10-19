import { evidence } from '../../test/evidence.ts';
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

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  AGE_CONFIRM,
  AGE_DENY,
  AGE_QUESTION,
  AGE_REFUSAL,
  AGE_REFUSAL_EXIT,
  AGE_RETURN_NOTE,
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
import { CONSENT_HINT, CONSENT_ROW, CONSENT_SUB } from '../analytics/consent.ts';
import { PRE_ACCOUNT_PAGES, freshPreAccountDraft, loadPreAccountDraft } from './preAccountDraft.ts';
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
const PRE_ACCOUNT_FLOW = stripComments(read('./PreAccountOnboarding.tsx'));
/** The pre-account page list lives with the draft that resumes on it. */
const PRE_ACCOUNT_DRAFT = stripComments(read('./preAccountDraft.ts'));
const RULES = stripComments(read('./answers.ts'));
const AGE_GATE = stripComments(read('./AgeGateScreen.tsx'));
const REFUSAL = stripComments(read('./AgeRefusal.tsx'));
// P2 (2026-10-19): the speaking target is set on Learning preferences, one row from Profile.
const PROFILE_TAB = stripComments(read('../settings/LearningPreferencesScreen.tsx'));
/** The one file that decides what is written, and in what order. */
const APP = stripComments(read('../../App.tsx'));
const DOC = read('../../../../docs/ONBOARDING.md');

describe('onboarding — three questions, and nothing that has to be answered', () => {
  test('a skipped name is stored as null, not as an empty string', () => {
    // An empty string is a name somebody typed. Null is a question they
    // declined, and the difference is what stopped Home greeting "Bonjour, ".
    assert.equal(nameFrom(''), null);
    assert.equal(nameFrom('   '), null, 'whitespace is not a name');
    assert.equal(nameFrom('  Camille '), 'Camille', 'a real name still arrives trimmed');

    const skipped = answersFrom({ name: '  ', ageConfirmed: true, motivation: null , tutorVoice: null, analyticsConsent: null });
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
    assert.match(FLOW, /TermsAcceptance context="repair"/);
    assert.match(FLOW, /label="Continue" onPress=\{confirmAge\}/);
    assert.doesNotMatch(FLOW, /\{AGE_QUESTION\}|\{AGE_CONFIRM\}|\{AGE_DENY\}/);
    assert.ok(AGE_GATE.includes('AGE_CONFIRM') && AGE_GATE.includes('AGE_DENY'), 'the known-under-age return restriction keeps explicit eligible and refusal choices');
    assert.ok(FLOW.includes('ageGate('), 'the age page decides for itself again');
    assert.equal(AGE_CONFIRM, 'I am 13 or older');
    assert.ok(AGE_DENY.length > 0);
  });

  test('the speaking target is asked in profile and nowhere in onboarding', () => {
    for (const forbidden of ['dailyGoalMin', 'How much time each day', 'Five minutes', 'GOALS']) {
      assert.ok(!FLOW.includes(forbidden), `the goal question is back on the way to a first conversation: ${forbidden}`);
    }
    assert.ok(!PAGES.includes('goal' as never), 'the goal is a page again');

    assert.ok(PROFILE_TAB.includes('withDailyGoal'), 'profile has no way to set the goal, so nowhere asks it');
    // The words are in `profile/dailyGoal.ts` now and the screen imports them,
    // which is the rule the reminder row already keeps: a name spelled in two
    // places is a name that comes to mean two things. So the claim splits in
    // two, and together they are the same claim as before.
    assert.equal(DAILY_GOAL_ROW, 'Flexible practice routine', 'the routine row has no plain name a learner could find it by');
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
    const cards = [...FLOW.matchAll(/<OptionRow/g)].map((m) => m.index ?? -1);
    const voicePageAt = FLOW.indexOf("{page === 'voice' && (");
    assert.ok(voicePageAt > 0, 'the voice step is no longer rendered by name');
    for (const index of cards) {
      assert.ok(index > voicePageAt, 'onboarding offers a list of options somewhere other than the voice step');
    }

    const existing = createStoredProfile(answersFrom({ name: 'Ada', ageConfirmed: true, motivation: 'work' , tutorVoice: null, analyticsConsent: null }), NOW);
    assert.equal(existing.motivation, 'work', 'the stored record stopped carrying the field at all');

    const reonboarded = completeProfile(
      existing,
      answersFrom({ name: 'Ada', ageConfirmed: true, motivation: existing.motivation , tutorVoice: null, analyticsConsent: null }),
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
    assert.match(AGE_GATE, /oldEnough !== false &&[\s\S]{0,160}GhostButton label=\{AGE_DENY\}/);
    assert.match(FLOW, /page === 'age' && oldEnough !== false && <View/);
    assert.match(FLOW, /if \(oldEnough === false \|\| !loaded \|\| submission\.current \|\| pageMotion\.locked\.current\) return false;/);
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
      /question:\s*\{[^}]*\.\.\.type\.title/,
      'the recovery question must use the shared working title',
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
    const stored = createStoredProfile(answersFrom({ name: '   ', ageConfirmed: true, motivation: null , tutorVoice: null, analyticsConsent: null }), NOW);

    assert.equal(stored.name, null, 'a skipped name is still stored as null, which is the honest value');
    assert.equal(
      needsOnboarding(stored),
      false,
      'they answered every question they were required to answer, so nothing may ask them again',
    );
  });

  test('a learner who gave their name is not asked again either', () => {
    const stored = createStoredProfile(answersFrom({ name: 'Sam', ageConfirmed: true, motivation: 'trip' , tutorVoice: null, analyticsConsent: null }), NOW);
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
    const finished = createStoredProfile(answersFrom({ name: 'Camille', ageConfirmed: true, motivation: null , tutorVoice: null, analyticsConsent: null }), NOW);
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
    const guarded = FLOW.match(/\{page === 'age' && oldEnough !== false && <View[\s\S]*?<PillButton label="Continue" onPress=\{confirmAge\}/);
    assert.ok(guarded, 'the age page still offers a way through');
    assert.match(
      guarded[0],
      /oldEnough !== false/,
      'and it has to be gone once they have answered, or the refusal is a suggestion with a button under it',
    );
  });
});

describe('the return gate is drawn as a working screen — F601', () => {
  test('the age check is a working title, a quiet line, the link above one ink pill, and a refusal still has a way out', () => {
    // A working title on paper, not a display headline: this is a check, not a story page.
    assert.match(AGE_GATE, /question: \{ \.\.\.type\.title, color: paper\.ink/, 'the age check title is not a working title');
    assert.doesNotMatch(AGE_GATE, /type\.display/, 'the age check still sets its title at display size');

    // One quiet line says how much is being asked, and says nothing about why.
    assert.equal(AGE_RETURN_NOTE, 'It is one question.');
    assert.match(AGE_GATE, /<QuietLine>\{AGE_RETURN_NOTE\}<\/QuietLine>/, 'the quiet line is not on the age check');
    assert.doesNotMatch(AGE_RETURN_NOTE, /[—–·]/, 'the quiet line carries a dash or a middot');
    assert.doesNotMatch(AGE_RETURN_NOTE, /\b(said|told|heard|caught|because|sorry|wrong|must)\b/i, 'the quiet line says what happened, or scolds');

    // Both answers ride in the footer, the quiet no above the one ink pill,
    // and both go once the learner has said they are younger.
    const answers = AGE_GATE.slice(AGE_GATE.indexOf('const answers = '), AGE_GATE.indexOf('return ('));
    assert.match(answers, /^const answers = oldEnough !== false && \(/, 'the answers do not leave once the learner says they are younger');
    const deny = answers.indexOf('<GhostButton label={AGE_DENY}');
    const confirm = answers.indexOf('<PillButton');
    assert.ok(deny > 0 && confirm > deny, 'the quiet no is not above the one ink pill');
    assert.match(answers.slice(confirm), /label=\{AGE_CONFIRM\}/, 'the pill is not the confirmation');
    assert.match(AGE_GATE, /<OnboardingLayout page="age" progress=\{onboardingProgress\(\{ page: 'age', eligibilityOnly: true \}\)\} footer=\{answers \|\| undefined\}>/, 'the return eligibility check must show its one actual step and pin its answers in the shared footer');
    assert.equal((AGE_GATE.match(/<PillButton\b/g) ?? []).length, 1, 'the age check offers more than one pill');

    // The refusal is unchanged: no footer, and the one way out is sign out.
    assert.match(AGE_GATE, /\{refusal !== null && <AgeRefusal text=\{refusal\} onSignOut=\{onSignOut\} \/>\}/, 'a refused learner has no way out');
    assert.ok(!REFUSAL.includes('PillButton'), 'the refusal offers a second chance');
  });

  test("the age check's quiet line is true whichever answer the learner gives", () => {
    // F636. The line used to read "One question, then you carry on where you
    // were." A learner who taps "I am younger than that" does not carry on: the
    // refusal comes and the only way out is sign out. So the line was false on
    // the very screen that refused them, and before the answer it told a child
    // which answer lets them through, which leans on a question that has to be
    // neutral. The quiet line says how much is asked and nothing about after.
    assert.doesNotMatch(AGE_RETURN_NOTE, /carry on|then you|continue|where you were/i, 'the quiet line says which answer carries on');

    // And once they have said they are younger it leaves with the answers, so
    // the refusal is the only line under the sub.
    const note = AGE_GATE.match(/\{(oldEnough !== false) && \(\s*<View style=\{st\.note\}>\s*<QuietLine>\{AGE_RETURN_NOTE\}<\/QuietLine>/);
    assert.ok(note, 'the quiet line stays on screen above the refusal');
  });
});

describe('the onboarding doc counts the screens the code shows', () => {
  test("the documented setup count matches the runtime order rather than historical disk pages", () => { const order = evidence('apps/mobile/src/onboarding/flow.ts'); const doc = evidence('docs/ONBOARDING.md'); assert.match(doc, /8 setup pages/); assert.match(order, /FULL_SETUP: readonly PreAccountPage\[\] = \[ ?'hear-it', 'reason', 'interests', 'start-level', 'confidence', 'focus', 'time', 'plan'\]/); assert.equal(PRE_ACCOUNT_PAGES.length, 18); assert.match(doc, /Historical draft routes repair through the existing resume model/); assert.match(doc, /Historical native correction checks, before this redesign/); assert.match(doc, /F114/); assert.match(doc, /cannot be produced on the machine/); });
});

/**
 * The usage-data question: asked once, off to start with, and never asked of
 * somebody who has already answered it. F472.
 *
 * The behaviour half is `answersFrom` and the pre-account draft, both of which
 * are values a test can hold. The rest is glass and ordering, so it is read out
 * of the three files that carry it, in this suite's own idiom. The ordering one
 * matters most and is the least visible: an event that overtakes the write it
 * depends on fails silently, for the learners who said yes and for nobody else.
 */
describe('the first run asks about usage data once, and off is the answer until they say otherwise — F472', () => {
  test("usage consent is asked once before processing and learning memory is a separate off-by-default choice", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); assert.equal(freshPreAccountDraft().analyticsConsent, false); assert.equal(freshPreAccountDraft().rememberLearning, false); assert.equal((screen.match(/title="Share usage analytics"/g) ?? []).length, 1); assert.match(screen, /const consentVisible/); assert.match(screen, /STARTER_LOCAL/); assert.match(screen, /Your words and audio are excluded/); assert.match(screen, /title="Remember my learning"/); const service = evidence('apps/mobile/src/onboarding/guestPractice.ts'); assert.match(service, /if \(!plan\.eligibilityConfirmed\) throw/); });

  test('the draft carries the answer and a missing one reads as no', async () => {
    // The consent is given before there is an account to key it to, so it rides
    // the pre-account draft across sign-up. The version stays at 1 on purpose:
    // a blob written before the question existed is a learner nobody asked, and
    // an absence repairs forward to false rather than throwing away a perfectly
    // good voice and age answer.
    const map = new Map<string, string>();
    const shared = AsyncStorage as unknown as Record<string, unknown>;
    shared.getItem = (key: string): Promise<string | null> => Promise.resolve(map.get(key) ?? null);
    shared.setItem = (key: string, value: string): Promise<void> => {
      map.set(key, value);
      return Promise.resolve();
    };
    const KEY = '@luvani/pre-account-onboarding/v1';
    const stored = (extra: object) => JSON.stringify({ version: 1, ageConfirmed: true, tutorVoice: 'luc', ...extra });

    map.set(KEY, stored({}));
    assert.equal((await loadPreAccountDraft())?.analyticsConsent, false, 'a draft from before the question read as a yes');

    map.set(KEY, stored({ analyticsConsent: true }));
    assert.equal((await loadPreAccountDraft())?.analyticsConsent, true, 'a learner who said yes was carried across as a no');

    map.set(KEY, stored({ analyticsConsent: false }));
    assert.equal((await loadPreAccountDraft())?.analyticsConsent, false, 'a learner who said no was carried across as a yes');

    // Only a literal true is agreement. Everything else a disk can hand back in
    // that slot is somebody who did not say yes.
    for (const junk of ['true', 1, null, {}, []]) {
      map.set(KEY, stored({ analyticsConsent: junk }));
      assert.equal((await loadPreAccountDraft())?.analyticsConsent, false, `read as agreement: ${JSON.stringify(junk)}`);
    }

    // And on the other path, the recovery flow's answers carry it out whole.
    // False is a switch left where it starts, not a question nobody asked, and
    // turning one into the other is what the third state exists to prevent.
    const base = { name: 'Ada', ageConfirmed: true, motivation: null, tutorVoice: null };
    assert.equal(answersFrom({ ...base, analyticsConsent: false }).analyticsConsent, false, 'a no became something else');
    assert.equal(answersFrom({ ...base, analyticsConsent: true }).analyticsConsent, true, 'a yes did not survive the hand-off');
    assert.equal(answersFrom({ ...base, analyticsConsent: null }).analyticsConsent, null, 'a page that did not ask invented an answer');
  });

  test('the answer is written before the completion event is sent', async () => {
    // The whole reason `onboarding_completed` left the flow. Every product
    // event reads the stored consent at the moment it is sent, so an event that
    // overtakes the write is dropped, and the only learners it is dropped for
    // are the ones who had just agreed to be counted. There is no error and no
    // retry: the funnel simply under-reports the people who said yes.
    assert.ok(!FLOW.includes('trackProductEvent'), 'the flow sends the completion event itself again, ahead of the write');
    assert.ok(!FLOW.includes('analytics/track'), 'the flow still reaches for the analytics door');
    assert.match(APP, /import \{ trackProductEvent \} from '\.\/src\/analytics\/track\.ts'/, 'nothing sends the completion event');
    assert.match(APP, /import \{ saveConsent \} from '\.\/src\/analytics\/consentStore\.ts'/, 'nothing writes the answer down');
    assert.equal(
      (APP.match(/onboarding_completed/g) ?? []).length,
      1,
      'the completion event is sent from more than one place, so one of them is unordered',
    );

    // The pre-account path: the answer is on the disk before `done` releases
    // the app, so nothing a learner does in the next seconds is counted against
    // an answer that has not landed.
    const preWrite = APP.indexOf('await saveConsent({ allowed: draft.analyticsConsent })');
    const release = APP.indexOf('done(built, startPractice)');
    assert.ok(preWrite > 0, 'the pre-account bootstrap never writes the usage-data answer');
    assert.ok(release > preWrite, 'the app is released before the answer reaches the disk');

    // The recovery path: the write is awaited, and the event follows it.
    const write = APP.indexOf('await saveConsent({ allowed: answers.analyticsConsent })');
    const event = APP.indexOf("name: 'onboarding_completed'");
    assert.ok(write > 0, 'the flow’s answers are never written to the consent store');
    assert.ok(event > write, 'the completion event is sent before the answer it is gated on reaches the disk');
    assert.match(
      APP,
      /personalisedGreeting: answers\.name !== null/,
      'the event reports a greeting from something other than the name it was given',
    );
  });

  test('a learner who already answered is not asked again', () => {
    // One switch, drawn only for a learner with no record at all. Anyone else
    // answered this on their own first run, or in Settings, and owns it there.
    // A flow they were sent back through by some unrelated new question has no
    // business taking the answer again, and no business writing one.
    assert.equal((FLOW.match(/<SwitchRow/g) ?? []).length, 1, 'the recovery flow asks twice, or never');
    const gate = FLOW.indexOf('{existing === null && (');
    const row = FLOW.indexOf('<SwitchRow');
    const voicePage = FLOW.indexOf("{page === 'voice' && (");
    assert.ok(gate > 0, 'the switch is drawn for everybody, including the learners who already answered');
    assert.ok(row > gate, 'the switch sits outside the guard that decides who is asked');
    assert.ok(voicePage > row, 'the switch left the Meet page, so it is no longer under the lines about what is kept');

    // The value has to agree with the render, or the screen asks nothing while
    // the answers still say no. Null from the start for anyone with a record.
    assert.match(
      FLOW,
      /useState<boolean \| null>\(existing === null \? false : null\)/,
      'a learner who is never asked still leaves with a false, which withdraws a consent they gave elsewhere',
    );
    assert.match(FLOW, /analyticsConsent,/, 'the flow hands its answers back without the usage-data answer');

    // Null travels all the way. `answersFrom` keeps it, and App.tsx writes
    // nothing for it.
    const untouched = answersFrom({ name: 'Ada', ageConfirmed: true, motivation: null, tutorVoice: null, analyticsConsent: null });
    assert.equal(untouched.analyticsConsent, null, 'a question nobody was asked became an answer on their behalf');
    assert.match(
      APP,
      /if \(answers\.analyticsConsent !== null && \(await saveConsent\(\{ allowed: answers\.analyticsConsent \}\)\) !== 'durable'\) return false;/,
      'App.tsx writes a consent for a page that never asked, which is how a stored yes is silently withdrawn',
    );
  });
});

 test("the recovery route's tutor cards keep independent selection and preview state", () => {
  assert.match(FLOW, /<TutorSelection chosen=\{voice\} preview=\{preview\} onChoose=\{setVoice\}/);
  assert.match(FLOW, /useTutorPreview\(\{ active: loaded && page === 'voice' \}\)/);
  assert.match(FLOW, /question: \{ \.\.\.type.title/);
  assert.match(FLOW, /<OnboardingLayout/);
  assert.doesNotMatch(FLOW, /back=|icon="back"/);
});
