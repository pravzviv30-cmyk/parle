/**
 * What a first-run guest has, as plain data (`guestProgress.ts`).
 *
 * Two rules here. A twenty-minute daily goal (founder decision D5) never
 * reaches the starter service, which validates 5, 10, 15 and "choose each
 * time". And a kept first-run phrase is the task's natural line (F757): the
 * check accepts a short list of authored answers without checking spelling, so
 * the learner's own words can carry a typo into the phrasebook and onto Home.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { checkStarter, starterTasks, tutorVoice, type StarterTask } from '@luvani/core';
import { evidence } from '../../test/evidence.ts';
import { streakGuiltIn } from '../copy/guilt.ts';
import { GAME_COPY } from '../game/copy.ts';
import { guestFinishes } from '../game/guestHandoff.ts';
import { finishGuestPractice, guestPracticeDays, offlineContinuation, repairGuestPractice, type GuestAttempt, type GuestPractice } from './guestModel.ts';
import { guestInvestment, guestStreak, keepFinishes, keptPhrase, starterMinutes } from './guestProgress.ts';
import { PLAN_MINUTES, freshPreAccountDraft } from './preAccountDraft.ts';
import { REASON_KEYS } from './preAccountDraft.ts';

const DAY = 86_400_000;
const utcDay = (at: number): string => new Date(at).toISOString().slice(0, 10);
const P = 'apps/mobile/src/onboarding/PreAccountOnboarding.tsx';

describe('the starter minutes', () => {
  test('a twenty-minute goal runs as fifteen at the starter and nothing chosen runs as five', () => {
    assert.deepEqual([...PLAN_MINUTES], [5, 10, 15, 20, 'none'], 'the daily goal lost or gained a tier');
    assert.equal(starterMinutes(20), 15);
    for (const minutes of [5, 10, 15, 'none'] as const) assert.equal(starterMinutes(minutes), minutes);
    assert.equal(starterMinutes(null), 5);
    assert.equal(starterMinutes(undefined), 5);
    // Twenty runs the same three exchanges fifteen does, on every route.
    for (const reason of REASON_KEYS) {
      assert.deepEqual(
        starterTasks(reason, 'coffee', starterMinutes(20)).map((t) => t.id),
        starterTasks(reason, 'coffee', 15).map((t) => t.id),
      );
    }
    // Every door that sends minutes or builds the starter goes through the one mapping.
    assert.match(evidence('apps/mobile/src/onboarding/guestPractice.ts'), /minutes: starterMinutes\(plan\.minutes\)/, 'a twenty can reach the starter service, which refuses it');
    for (const file of ['PreAccountOnboarding.tsx', 'guestModel.ts', 'GuestAccountHandoff.tsx', 'plan.ts']) {
      const source = evidence(`apps/mobile/src/onboarding/${file}`);
      assert.doesNotMatch(source, /starterTasks\([^)]*\.minutes \?\? 5\)/, `${file} builds the starter from a goal the starter does not know`);
    }
  });
});

describe('a kept first-run phrase — F757', () => {
  test("a kept first-run phrase is the natural line, never the learner's unchecked spelling", () => {
    // An accepted reply with no accents and no punctuation is still accepted,
    // and is still not how the phrase is written.
    const [drink] = starterTasks('food', 'coffee', 5);
    assert.ok(drink);
    const typed = 'bonjour je vais prendre un cafe';
    assert.equal(checkStarter(drink, typed, 'typed').accepted, true, 'core no longer accepts the unaccented reply this test relies on');
    assert.equal(keptPhrase(drink), drink.model);
    assert.notEqual(keptPhrase(drink), typed, 'the unchecked spelling would be kept');
    for (const reason of REASON_KEYS) {
      for (const task of starterTasks(reason, 'tea', 15)) assert.equal(keptPhrase(task), task.model, `${task.id} keeps something other than its natural line`);
    }

    // Every place a first-run phrase is kept or shown as kept.
    const handoff = evidence('apps/mobile/src/onboarding/GuestAccountHandoff.tsx');
    assert.match(handoff, /fr: keptPhrase\(task\),/, 'the hand-off keeps something other than the natural line');
    assert.doesNotMatch(handoff, /fr: a\.feedback\.accepted \? a\.reply/, 'the hand-off keeps the learner\'s spelling again');
    assert.doesNotMatch(handoff, /attempts\.at\(-1\)\?\.reply/, 'the hand-off shows the learner\'s spelling as the kept phrase');
    const home = evidence('apps/mobile/src/onboarding/StarterContinuation.tsx');
    assert.match(home, /fr: keptPhrase\(task\),/, 'Home keeps something other than the natural line');
    assert.doesNotMatch(home, /fr: reply\.trim\(\)/, 'Home keeps the learner\'s spelling again');
    const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx');
    assert.doesNotMatch(screen, /homePhrase|<StreakCard/);
    assert.match(screen, /<FirstSessionSummary record=\{guest\.live\}/);
  });
});

/** A reply the starter check really returned, at a fixed instant. */
function attempt(task: StarterTask, reply: string, evidence: 'typed' | 'spoken' | 'model', extra: Partial<GuestAttempt> = {}): GuestAttempt {
  return { taskId: task.id, reply, feedback: checkStarter(task, reply, evidence), at: Date.UTC(2026, 9, 5, 9), offline: false, ...extra };
}

describe('a guest finish day — F751', () => {
  test('a guest who finishes a practice keeps that day through a new practice and the hand-off', () => {
    const at = Date.UTC(2026, 9, 5, 9);
    const plan = { ...freshPreAccountDraft(), eligibilityConfirmed: true, reason: 'food' as const, drink: 'coffee' as const, minutes: 5 as const };
    const [first] = starterTasks('food', 'coffee', 5);
    assert.ok(first);
    const practised: GuestPractice = {
      version: 2, token: 'a'.repeat(43), id: '00000000-0000-4000-8000-000000000001', expiresAt: at + DAY, speechAvailable: false,
      secondsUsed: 12, attempts: [attempt(first, first.model, 'typed')], kept: false, completed: false, plan,
    };

    // The first run saves the practice as finished, and its day is on the record.
    const finished = finishGuestPractice(practised, at, utcDay);
    assert.deepEqual(guestPracticeDays(finished, utcDay), ['2026-10-05']);

    // A new practice from the service replaces the record and keeps the day,
    // and nothing else of the old practice: not its replies, not its finish.
    const fresh: GuestPractice = {
      version: 2, token: 'b'.repeat(43), id: '00000000-0000-4000-8000-000000000002', expiresAt: at + 2 * DAY, speechAvailable: false,
      secondsUsed: 0, attempts: [], kept: false, completed: false, plan: { ...plan, reason: 'work' },
    };
    const started = keepFinishes(fresh, finished);
    assert.deepEqual(guestPracticeDays(started, utcDay), ['2026-10-05'], 'starting a new practice took the finished day away');
    assert.equal(started.completed, false, 'a carried day finished the new practice');
    assert.deepEqual(started.attempts, []);
    assert.equal(started.token, fresh.token);
    assert.deepEqual(guestPracticeDays(repairGuestPractice(JSON.parse(JSON.stringify(started))), utcDay), ['2026-10-05'], 'the carried day did not survive the disk');
    // Nothing is invented: no record before, or one with no finish, carries
    // nothing, and a record that holds its own days keeps them.
    assert.equal(keepFinishes(fresh, null).finishedAt, undefined);
    assert.equal(keepFinishes(fresh, practised).finishedAt, undefined, 'a practice never finished carried a day');
    assert.deepEqual(keepFinishes(finished, { finishedAt: [at + DAY] }).finishedAt, finished.finishedAt);
    // The offline route keeps it too.
    assert.deepEqual(guestPracticeDays(offlineContinuation({ ...plan, reason: 'trip' }, finished), utcDay), ['2026-10-05']);

    // Finishing the new practice the next day is a second day, and the
    // hand-off records both, each at its own finish. Without the carry it
    // would have seen one.
    const second = finishGuestPractice(started, at + DAY, utcDay);
    assert.deepEqual(guestFinishes(second, utcDay), [
      { day: '2026-10-05', at },
      { day: '2026-10-06', at: at + DAY },
    ]);
    assert.deepEqual(guestFinishes(finishGuestPractice(fresh, at + DAY, utcDay), utcDay).map((f) => f.day), ['2026-10-06']);

    // The wiring: the first run persists the finish with its day, hands the
    // record it replaces to the start, and the hand-off settles the record it
    // loaded, whose days are these.
    const screen = evidence(P);
    const live = evidence('apps/mobile/src/onboarding/FirstLivePractice.tsx');
    assert.match(live, /finishedAt: record\.outcome === 'completed' && record\.completedAt \? \[record\.completedAt\] : \[\]/);
    assert.ok(live.indexOf('await saveGuestPractice(next)') < live.indexOf('onFinished(next)'));
    assert.doesNotMatch(screen, /persist\(\{ \.\.\.guest, completed: true \}\)/, 'the first run saves a finish without its day');
    assert.match(screen, /await startGuestPractice\(acceptedDraft, guest\)/, 'a new practice from the service drops the finished days');
    assert.doesNotMatch(screen, /offlineContinuation\(/);
    assert.match(screen, /<FirstLivePractice/);
    const service = evidence('apps/mobile/src/onboarding/guestPractice.ts');
    assert.match(service, /export async function startGuestPractice\(plan: PreAccountOnboardingDraft, prior: GuestPractice \| null = null\)/);
    assert.match(service, /const valid = repairGuestPractice\(keepFinishes\(next, prior\)\);/);
    assert.match(service, /export function offlineGuestPractice\(plan: PreAccountOnboardingDraft, prior: GuestPractice \| null = null\)/);
    assert.match(service, /return keepFinishes\(local, prior\);/);
    assert.match(evidence('apps/mobile/src/onboarding/GuestAccountHandoff.tsx'), /settleGuestHandoff\(guest\)/);
    assert.match(evidence('apps/mobile/src/game/guestHandoff.ts'), /const days = guestPracticeDays\(practice, dayOf\);/, 'the hand-off takes its days from somewhere other than the finishes');
  });
});

describe('the save card — F754', () => {
  test('the save card lists only what this phone holds', () => {
    const today = '2026-10-05';
    const draft = freshPreAccountDraft();
    const tutor = tutorVoice(draft.tutorVoice).persona.name;

    // A phone that holds no practice holds the tutor it would use, and nothing more.
    assert.deepEqual(guestInvestment({ practice: null, days: [], today, draft }).map((row) => row.text), [`Your AI tutor: ${tutor}`]);

    // A phone that holds everything lists everything, in order.
    const plan = { ...draft, eligibilityConfirmed: true, reason: 'food' as const, drink: 'coffee' as const, minutes: 10 as const };
    const [a, b] = starterTasks('food', 'coffee', 10);
    assert.ok(a && b, 'a ten-minute food starter no longer has two exchanges');
    const practice = {
      attempts: [
        attempt(a, a.model, 'typed'),
        attempt(b, b.model, 'spoken', { kept: true }),
        // A played model is accepted and is nobody's reply; a miss is not one that works.
        attempt(a, a.model, 'model'),
        attempt(a, 'xyz', 'typed'),
      ],
      kept: true,
      plan,
    };
    assert.equal(practice.attempts[2]!.feedback.accepted, true, 'core no longer accepts a played model; this case tests nothing');
    assert.equal(practice.attempts[3]!.feedback.accepted, false);
    const full = guestInvestment({ practice, days: [today], today, draft: { ...draft, reminderEnabled: true, reminderTime: 'morning' } });
    assert.deepEqual(full.map((row) => row.key), ['streak', 'replies', 'kept', 'plan', 'tutor', 'reminder']);
    assert.deepEqual(full.map((row) => row.text), [
      'Day 1 of your streak',
      '2 French replies that work',
      // b's line, kept, and a's, the last reply's task in a practice kept as a whole.
      '2 phrases kept',
      `${a.title}, 10 minutes a day`,
      `Your AI tutor: ${tutor}`,
      'Reminder at about 8:00 am',
    ]);
    assert.equal(full[0]!.text, GAME_COPY.streak.dayOf(1), 'the streak row is not the game\'s own line');

    // Each row only when it is true.
    const keys = (input: Parameters<typeof guestInvestment>[0]) => guestInvestment(input).map((row) => row.key);
    // A reminder chosen and never scheduled is not one.
    assert.ok(!keys({ practice, days: [today], today, draft: { ...draft, reminderEnabled: false, reminderTime: 'morning' } }).includes('reminder'), 'a reminder the OS never took is listed');
    // A run that has lapsed is no streak, and never "Day 0".
    assert.ok(!keys({ practice, days: ['2026-10-01'], today, draft }).includes('streak'), 'a lapsed run is listed as a streak');
    assert.ok(!guestInvestment({ practice, days: [], today, draft }).some((row) => /Day 0/.test(row.text)));
    // A played model alone is no reply that works, and nothing kept is no phrase row.
    assert.deepEqual(keys({ practice: { attempts: [attempt(a, a.model, 'model')], kept: false, plan }, days: [], today, draft }), ['plan', 'tutor']);
    // Two days in a run say two.
    assert.equal(guestInvestment({ practice, days: ['2026-10-04', today], today, draft })[0]!.text, 'Day 2 of your streak');
    // Phrases kept are counted from the record, one per task: a kept phrase
    // is always its task's natural line, so keeping it twice is one phrase.
    const allKept = { ...practice, attempts: practice.attempts.map((x) => ({ ...x, kept: true })) };
    assert.equal(guestInvestment({ practice: allKept, days: [], today, draft }).find((row) => row.key === 'kept')?.text, '2 phrases kept');
    const keptRow = (input: Pick<GuestPractice, 'attempts' | 'kept' | 'plan'>) => guestInvestment({ practice: input, days: [], today, draft }).find((row) => row.key === 'kept')?.text;
    assert.equal(keptRow({ attempts: [attempt(a, a.model, 'typed', { kept: true }), attempt(a, a.model, 'typed', { kept: true })], kept: true, plan }), '1 phrase kept', 'one phrase kept twice is counted twice');
    // A practice kept as a whole keeps its last reply's task, once.
    assert.equal(keptRow({ attempts: [attempt(a, a.model, 'typed', { kept: true }), attempt(b, 'xyz', 'typed')], kept: true, plan }), '2 phrases kept');
    assert.equal(keptRow({ attempts: [attempt(a, a.model, 'typed'), attempt(b, 'xyz', 'typed')], kept: false, plan }), undefined, 'nothing kept is listed as kept');
    // A goal chosen each time names the practice alone.
    const each = { ...practice, plan: { ...plan, minutes: 'none' as const } };
    const [single] = starterTasks('food', 'coffee', starterMinutes('none'));
    assert.equal(guestInvestment({ practice: each, days: [], today, draft }).find((row) => row.key === 'plan')?.text, single!.title);

    // Every row keeps the copy rules.
    for (const row of full) {
      assert.equal(streakGuiltIn(row.text), undefined, `"${row.text}" nags or scolds`);
      assert.doesNotMatch(row.text, /[—–·!]/);
    }

    // The screen draws the rows from the guest record and its finish days, and the list draws only those.
    const screen = evidence(P);
    assert.match(screen, /<FirstSessionSummary record=\{guest\.live\}/);
    assert.match(evidence('apps/mobile/src/onboarding/FirstSessionResult.tsx'), /firstLiveSummary\(record\)/);
    const list = evidence('apps/mobile/src/onboarding/FirstSessionResult.tsx');
    assert.match(list, /view\.achievements\.map/);
    assert.match(list, /<RevealItem index=\{index\}/);
    assert.match(list, /accessibilityLabel=\{text\}/);
  });

  test('day one counts only finished days, from the run before, and never shows a lapsed run', () => {
    const today = '2026-10-05';
    assert.equal(guestStreak([], today), null);
    assert.equal(guestStreak(['2026-10-02'], today), null, 'a lapsed run shows a streak');
    const one = guestStreak([today], today);
    assert.ok(one);
    assert.deepEqual([one.current, one.before, one.todayPractised, one.title], [1, 0, true, GAME_COPY.streak.started]);
    const two = guestStreak(['2026-10-04', today], today);
    assert.deepEqual([two?.current, two?.before, two?.title], [2, 1, GAME_COPY.streak.line(2)]);
    // Yesterday's finish still counts until today is over, and nothing counts up.
    const waiting = guestStreak(['2026-10-04'], today);
    assert.deepEqual([waiting?.current, waiting?.before, waiting?.todayPractised, waiting?.title], [1, 1, false, GAME_COPY.streak.started]);
    // The strip begins today, then the next six days, with only today's real finish lit.
    assert.equal(one.week.length, 7);
    assert.deepEqual(one.week.filter((cell) => cell.state === 'practised').map((cell) => cell.day), [today]);
    assert.ok(!one.week.some((cell) => (cell.state as string) === 'missed'));
    assert.equal(one.week[0]!.day, today);
    assert.deepEqual(one.week.slice(1).map(cell => cell.state), Array(6).fill('ahead'));
    for (const day of ['2026-10-10', '2026-10-25', '2026-12-31', '2028-02-28']) {
      const rolling = guestStreak([day, '2099-01-01'], day)!;
      assert.equal(rolling.week[0]!.day, day);
      assert.equal(rolling.week[0]!.name, new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' }));
      assert.deepEqual(rolling.week.slice(1).map(cell => cell.state), Array(6).fill('ahead'));
    }
    assert.equal(guestStreak(['2026-12-31'], '2026-12-31')!.week[1]!.day, '2027-01-01');
    assert.equal(guestStreak(['2028-02-28'], '2028-02-28')!.week[2]!.day, '2028-03-01');
  });
});
