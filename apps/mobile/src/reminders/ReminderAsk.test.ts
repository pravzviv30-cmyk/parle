/**
 * The one reminder ask (come alive, README Part 5.C row 9; F754).
 *
 * Two promises. The system's notification dialog is raised only by the
 * learner's own tap on "Remind me", never on arrival or from an effect, and in
 * the first run the ask appears only once a finished practice is on the phone.
 * And the ask's words keep the house rules for reminder copy: warm, plain, no
 * dash, nothing a streak could nag with, the chosen tutor named.
 *
 * The screen and the card are read as source, because there is no renderer in
 * this suite (docs/TESTING.md); where the rule is a value (where a resumed first
 * run opens, which days count) it is run. The ask's words are run as written:
 * `REMINDER_ASK_COPY` is plain strings, so the block evaluates as it stands.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { addDays, checkStarter, starterTasks, tutorVoice } from '@luvani/core';
import { evidence } from '../../test/evidence.ts';
import { streakGuiltIn } from '../copy/guilt.ts';
import { finishGuestPractice, guestPracticeDays, type GuestPractice } from '../onboarding/guestModel.ts';
import { GUEST_PAGES, resumePage } from '../onboarding/guestProgress.ts';
import { freshPreAccountDraft } from '../onboarding/preAccountDraft.ts';
import { TUTOR_NAME } from '../tutor/tutorName.ts';
import { emptyLog, planReminders, type Calendar } from './plan.ts';
import { REMINDER_REFUSED, REMINDER_TIMES } from './reminder.ts';

const ASK = 'apps/mobile/src/reminders/ReminderAsk.tsx';
const SCREEN = 'apps/mobile/src/onboarding/PreAccountOnboarding.tsx';

/** A source file with comments gone, lines kept, for slicing out one function. */
function code(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/** The ask's words, run as written. */
function askCopy(): Record<string, string> {
  const source = readFileSync(new URL('./ReminderAsk.tsx', import.meta.url), 'utf8');
  const start = source.indexOf('export const REMINDER_ASK_COPY = {');
  assert.ok(start >= 0, 'ReminderAsk.tsx no longer keeps its words in REMINDER_ASK_COPY, so this reads nothing');
  const open = source.indexOf('{', start);
  const end = source.indexOf('} as const;', open);
  assert.ok(end > open, 'REMINDER_ASK_COPY is no longer one plain block');
  return new Function(`return (${source.slice(open, end + 1)});`)() as Record<string, string>;
}

/** Each `useEffect(` body in a source, from the call to its dependency list. */
function effects(source: string): string[] {
  const out: string[] = [];
  for (let at = source.indexOf('useEffect('); at >= 0; at = source.indexOf('useEffect(', at + 1)) {
    out.push(source.slice(at, source.indexOf('}, [', at) + 4));
  }
  return out;
}

const utcDay = (at: number): string => new Date(at).toISOString().slice(0, 10);

describe('the reminder ask — F754', () => {
  test('the reminder is asked only after a finished practice and only on a real tap', () => {
    // Only after a finished practice. A resumed first run reaches day one, and
    // the ask on it, only with a finish day on this phone; replies alone, or a
    // record from before finishes were kept, are not one.
    const [first] = starterTasks('food', 'coffee', 5);
    assert.ok(first);
    const at = Date.UTC(2026, 9, 5, 9);
    const plan = { ...freshPreAccountDraft(), eligibilityConfirmed: true, reason: 'food' as const, drink: 'coffee' as const, minutes: 5 as const };
    const replied: GuestPractice = {
      version: 2, token: null, id: null, expiresAt: 0, secondsUsed: 0, kept: false, completed: true, plan,
      attempts: [{ taskId: first.id, reply: first.model, feedback: checkStarter(first, first.model, 'typed'), at, offline: true }],
    };
    const today = utcDay(at);
    assert.equal(resumePage('remind', true, guestPracticeDays(replied, utcDay), today), 'plan', 'day one opened on replies with no finished practice');
    assert.equal(resumePage('keep', true, guestPracticeDays(replied, utcDay), today), 'plan', 'the save card opened with no finished practice');
    const finished = finishGuestPractice(replied, at, utcDay);
    assert.equal(resumePage('remind', true, guestPracticeDays(finished, utcDay), today), 'remind');
    assert.equal(resumePage('remind', false, guestPracticeDays(finished, utcDay), today), 'plan', 'day one opened with no guest record');
    // A run that has since lapsed has no day one to show: the save card opens.
    assert.equal(resumePage('remind', true, guestPracticeDays(finished, utcDay), utcDay(at + 3 * 86_400_000)), 'keep');
    // The guest home, whose Set a reminder opens the same ask, needs a finish
    // too. A record the previous build saved as { ...guest, completed: true }
    // holds no finish day, so it opens the win, whose Continue finishes it.
    assert.equal(resumePage('home', true, guestPracticeDays(replied, utcDay), today), 'recap', 'the guest home opened with no finished practice on the phone');
    assert.equal(resumePage('home', true, guestPracticeDays(finished, utcDay), today), 'home');
    assert.equal(resumePage('home', false, guestPracticeDays(finished, utcDay), today), 'plan');
    for (const page of ['hear-it', 'reason', 'plan'] as const) assert.equal(resumePage(page, false, [], today), page);
    assert.ok(GUEST_PAGES.includes('remind') && GUEST_PAGES.includes('keep'), 'day one or the save card can open without a guest record');

    // Onboarding no longer asks for reminders or runs a guest Home. Existing
    // account recap remains the explicit optional reminder door.
    const screen = evidence(SCREEN);
    assert.doesNotMatch(screen, /<ReminderAsk|askReminderPermission|scheduleReminder|requestPermissionsAsync/);
    assert.match(screen, /<FirstSessionSummary/);
    assert.match(evidence('apps/mobile/src/RecapScreen.tsx'), /<ReminderAsk/);

    // The ask: the dialog only inside the tap, then the plan, never from an effect.
    // (Phase 4: the plan is `turnOnReminder`, which replaced `scheduleReminder`.)
    const ask = code('./ReminderAsk.tsx');
    assert.equal((ask.match(/askReminderPermission\(/g) ?? []).length, 1, 'the dialog can be raised from more than one place');
    assert.equal((ask.match(/turnOnReminder\(/g) ?? []).length, 1);
    const handler = ask.slice(ask.indexOf('const remind = async () => {'), ask.indexOf('const gloss ='));
    assert.ok(handler.length > 0, 'the tap handler moved; this check reads nothing');
    assert.ok(handler.includes('askReminderPermission()'), 'the dialog is raised outside the tap handler');
    assert.ok(handler.indexOf('askReminderPermission()') < handler.indexOf('turnOnReminder('), 'the reminder is planned before permission is asked');
    assert.match(handler, /if \(permission !== 'granted'\) \{/, 'a refused permission still schedules');
    assert.match(handler, /if \(outcome !== 'done'\) \{/, 'a refused schedule is reported as on');
    assert.ok(handler.indexOf("outcome !== 'done'") < handler.indexOf('answer({ enabled: true'), 'the answer says on before the OS took it');
    assert.equal((ask.match(/\bremind\(\)/g) ?? []).length, 1, 'the handler is called from somewhere other than the tap');
    assert.match(ask, /onPress=\{\(\) => void remind\(\)\}/, 'Remind me does not raise the dialog');
    for (const effect of effects(ask)) {
      assert.doesNotMatch(effect, /askReminderPermission|turnOnReminder|remind\(\)/, 'an effect raises the dialog nobody tapped for');
    }
    // No reminder to give, no card; one answer, once.
    assert.match(ask, /if \(!REMINDERS_AVAILABLE\) return null;/, 'the web shows an ask it cannot keep');
    assert.match(
      evidence(ASK),
      // Phase 4: the answer may carry the smart mode when the ask was offered it.
      /const answer = \(value: ReminderAnswer<T \| ReminderTimeId>\) => \{ if \(answered\.current\) return; answered\.current = true; onDone\(value\); \};/,
      'the ask can answer twice',
    );
  });

  test('a reminder the first run set leaves the phone with the plan it belongs to', () => {
    // An under-13 answer clears the draft and the guest record, and a reminder
    // set on day one goes with them: in the start sheet, and in the launch's
    // own refusal, whichever hears it first. Both only when one was set.
    const screen = evidence(SCREEN);
    const refusal = screen.slice(screen.indexOf('if (!refused) return;'), screen.indexOf('const showPage ='));
    assert.ok(refusal.length > 0, 'the known-refusal cleanup must remain mounted');
    assert.match(refusal, /if \(draftRef\.current\.reminderEnabled === true\) void cancelReminder\(\);/);
    assert.ok(refusal.indexOf('cancelReminder()') < refusal.indexOf('setDraft(fresh)'));
    assert.equal((screen.match(/cancelReminder\(/g) ?? []).length, 1, 'the first run takes a reminder away somewhere other than the refusal');
    const app = evidence('apps/mobile/App.tsx');
    const refuse = app.slice(app.indexOf('const refusePreAccount = useCallback('), app.indexOf('const deleteAccount'));
    assert.match(refuse, /if \(preAccountDraft\?\.reminderEnabled === true\) void cancelReminder\(\); discardPreAccountDraft\(\); \}, \[discardPreAccountDraft, preAccountDraft\]\);/, 'the launch\'s refusal clears the draft and leaves its reminder running');
    // Create one on a returning sign-in screen starts a fresh draft, so the old
    // draft's reminder goes too.
    const flow = evidence('apps/mobile/src/auth/AuthFlow.tsx');
    const newAccount = flow.slice(flow.indexOf('const newAccount = async () => {'), flow.indexOf('const acceptAccountTerms ='));
    assert.match(newAccount, /await clearGuestPractice\(\);/);
    assert.match(newAccount, /initialDraft\?\.reminderEnabled === true && \(await cancelReminder\(\)\) === 'failed'/, 'a fresh introduction must check native cancellation failure');
    assert.ok(newAccount.indexOf('await clearGuestPractice()') < newAccount.indexOf('await cancelReminder()'));
    assert.ok(newAccount.indexOf('await cancelReminder()') < newAccount.indexOf('onDiscardDraft()'), 'the owning plan must remain until reminder cleanup settles');
    assert.match(newAccount, /catch[\s\S]*setRestartError\(true\)/, 'failed cleanup must retain a retry');
  });

  test('the reminder ask speaks plainly and names the chosen tutor', () => {
    const copy = askCopy();
    const fill = (line: string, values: Record<string, string>) => line.replace(/\{(\w+)\}/g, (_m, key: string) => values[key] ?? `{${key}}`);
    const lines = [
      ...Object.values(copy).flatMap((line) => REMINDER_TIMES.map((time) => fill(line, { tutor: TUTOR_NAME, time: time.gloss }))),
      REMINDER_REFUSED,
    ];
    for (const line of lines) {
      assert.ok(line.trim().length > 0);
      assert.doesNotMatch(line, /\{\w+\}/, `"${line}" has a slot nothing fills`);
      assert.equal(streakGuiltIn(line), undefined, `"${line}" nags or scolds (${streakGuiltIn(line)})`);
      assert.doesNotMatch(line, /[—–·!]/, `"${line}" has a dash, a middot or a shout`);
    }
    // The words the brief chose, and the evening first until there is history.
    assert.equal(copy.title, 'A daily nudge from {tutor}?');
    assert.equal(copy.body, 'One a day at about {time}, and never on a day you have already practised.');
    assert.equal(copy.changeTime, 'Change time');
    assert.equal(copy.notNow, 'Not now');
    const ask = evidence(ASK);
    assert.match(ask, /said\(REMINDER_ASK_COPY\.title, \{ tutor \}\)/, 'the ask does not name the tutor it was given');
    const screen = evidence(SCREEN);
    assert.match(screen, /const tutorName = tutorVoice\(draft\.tutorVoice\)\.persona\.name;/, 'the first run names a tutor other than the chosen one');
    assert.doesNotMatch(screen, /<ReminderAsk/, 'the retired guest reminder ask returned');
    // Every control has words a screen reader can say: the pill, the link and the time rows.
    assert.match(ask, /<PillButton label=\{said\(REMINDER_ASK_COPY\.remindMe, \{ time: gloss \}\)\}/);
    assert.match(ask, /<GhostButton label=\{REMINDER_ASK_COPY\.notNow\}/);
    assert.match(ask, /accessibilityRole="radiogroup"/);
    assert.doesNotMatch(ask, /numberOfLines|allowFontScaling=\{false\}|maxFontSizeMultiplier/, 'the ask caps its text');
  });
});

/** A calendar with no time zone, so the test reads the same anywhere. */
const UTC: Calendar = {
  dayOf: utcDay,
  minuteOf: (at) => new Date(at).getUTCHours() * 60 + new Date(at).getUTCMinutes(),
  at: (day, hour, minute) => Date.parse(`${day}T00:00:00Z`) + (hour * 60 + minute) * 60_000,
};

describe('the ask keeps its promise — F774', () => {
  test('the reminder ask promises a skipped practised day only when the scheduler skips it, guest finish days included', () => {
    // The promise, as the ask says it.
    assert.match(askCopy().body ?? '', /never on a day you have already practised/);

    // A guest who never makes an account, who finished a practice this morning.
    // The plan, fed exactly what the guest planner reads (the finish days and
    // the draft's tutor), skips today and names the tutor the ask named.
    const [first] = starterTasks('food', 'coffee', 5);
    assert.ok(first);
    const morning = Date.UTC(2026, 9, 7, 9);
    const today = utcDay(morning);
    const draft = { ...freshPreAccountDraft(), eligibilityConfirmed: true, reason: 'food' as const, drink: 'coffee' as const, minutes: 5 as const, tutorVoice: 'marie' as const, reminderEnabled: true, reminderTime: 'evening' as const };
    const replied: GuestPractice = {
      version: 2, token: null, id: null, expiresAt: 0, secondsUsed: 0, kept: false, completed: false, plan: draft,
      attempts: [{ taskId: first.id, reply: first.model, feedback: checkStarter(first, first.model, 'typed'), at: morning, offline: true }],
    };
    const finished = finishGuestPractice(replied, morning, utcDay);
    const tutor = tutorVoice(draft.tutorVoice).persona.name;
    const plan = (guest: GuestPractice) =>
      planReminders({
        now: morning + 60_000,
        calendar: UTC,
        choice: { enabled: true, time: draft.reminderTime },
        practiceDays: guestPracticeDays(guest, utcDay),
        finishes: guest.finishedAt ?? [],
        covers: [],
        tutor,
        log: emptyLog(),
        guest: true,
      });
    const afterFinish = plan(finished);
    assert.ok(afterFinish.length > 0);
    assert.ok(!afterFinish.some((slot) => slot.day === today), 'a guest who finished today is reminded today');
    assert.equal(afterFinish[0]?.day, addDays(today, 1));
    for (const slot of afterFinish) assert.ok(`${slot.title} ${slot.body}`.includes(tutor), `"${slot.title} / ${slot.body}" does not name ${tutor}, the tutor the ask named`);
    // Replies alone are not a finish: today is still reminded. The skip is the finish's doing.
    assert.equal(plan(replied)[0]?.day, today);

    // On a phone: the ask hands the planner the tutor it named, and a guest's
    // yes is planned from the guest's finish days and the draft's tutor.
    const ask = code('./ReminderAsk.tsx');
    assert.match(ask, /const outcome = await turnOnReminder\(at, tutor\);/, 'the ask plans a reminder that may name someone else');
    const planner = code('./ReminderPlanner.tsx');
    assert.match(planner, /if \(activeUserId\(\) === null\) return replanReminders\(\{ choice: \{ enabled: true, time \}, tutor, resume: true \}\);/);
    assert.match(planner, /practiceDays: guestPracticeDays\(guest\), covers: \[\], finishes: guest\?\.finishedAt \?\? \[\]/);
    assert.match(planner, /const tutor = options\.tutor \?\? tutorVoice\(draft\?\.tutorVoice \?\? DEFAULT_TUTOR_VOICE\)\.persona\.name;/, 'a later plan names a tutor other than the one the first run named');
    assert.match(evidence(SCREEN), /const tutorName = tutorVoice\(draft\.tutorVoice\)\.persona\.name;/);
    // Planned again whenever the draft moves, which it does once a finish is on
    // the disk (the finish saves, then turns to day one), and on the way in and
    // out of the app. The guest planner is mounted wherever nobody is signed in.
    assert.match(planner, /useEffect\(\(\) => \{\s*void replanReminders\(\{ draft: draftRef\.current \}\);\s*\}, \[moved\]\);/);
    assert.match(planner, /draft\?\.page \?\? null/, 'a finish (which turns the page) does not re-plan');
    assert.match(evidence(SCREEN), /if \(!refused\) \{ onDraftChange\(persisted\)/);
    const app = code('../../App.tsx');
    assert.match(app, /<GuestReminderPlanner draft=\{preAccountDraft\} \/>/);
    assert.match(app, /onDraftChange=\{keepPreAccountDraft\}/);
    // An account's practice re-plans after every settled sitting.
    assert.match(planner, /const offSettled = onSettled\(replanThenHear\);/);
    assert.match(app, /<ReminderPlanner \/>/);
    // And the scheduler can skip a day, because nothing it schedules repeats.
    const native = code('./schedule.native.ts');
    assert.doesNotMatch(native, /SchedulableTriggerInputTypes\.(?:DAILY|WEEKLY)/, 'a repeating trigger fires on the day the guest practised');
    assert.match(native, /SchedulableTriggerInputTypes\.DATE/);
  });

  test('the notification permission is asked only when the learner accepts the reminder offer', () => {
    // Moved from RecapScreen.test.ts with its title (Come alive Phase 4, README
    // Part 7): the recap's reminder is the one shared ask now.
    const recap = code('../RecapScreen.tsx');
    // Offered only after a win, from facts already read: read on the way in, never asked.
    assert.match(recap, /const won = lines\.length > 0 \|\| keptPhrase !== null;/, 'the offer is not gated on the first win');
    assert.match(recap, /const offer = reminderOffer\(\{ available: REMINDERS_AVAILABLE, won, stored, permission \}\);/);
    assert.match(recap, /Promise\.all\(\[loadReminder\(\{ strict: true \}\), reminderPermission\(\)\]\)/, 'the recap does not read the permission it offers against');
    assert.doesNotMatch(recap, /askReminderPermission|requestPermissionsAsync|turnOnReminder|schedulePlan|saveReminder/, 'the recap raises the dialog or plans outside the one ask');
    // The ask, once, at the learner's time or their own rhythm, naming their tutor.
    assert.equal((recap.match(/<ReminderAsk\b/g) ?? []).length, 1);
    assert.match(recap, /<ReminderAsk\s+time=\{offer\.choice\}\s+tutor=\{tutorNameOf\(profile\)\}/);
    assert.match(recap, /setReminder\(answer\.enabled \? \{ on: answer\.time \} : 'declined'\);/);
    assert.match(recap, /reminderAnswerLine\('on', \{ choice: reminder\.on, time: reminderTime\(reminder\.on\) \}\)/, 'the answer is not said once the learner has chosen');
    // Inside the ask: the dialog only on the tap, the times to choose from, and a quiet way to say no.
    const ask = code('./ReminderAsk.tsx');
    assert.match(ask, /onPress=\{\(\) => void remind\(\)\}/);
    assert.match(ask, /REMINDER_TIMES\.map\(/);
    assert.match(ask, /\{time === 'smart' \? \(\s*<Choice/, 'the learner\'s own rhythm is not offered first');
    assert.match(ask, /<GhostButton label=\{REMINDER_ASK_COPY\.notNow\}/, 'there is no quiet way to say no');
  });

  test('the ask says the phone will ask before it does, and only when it will', () => {
    // retention-paywall.md section 4.6: one line, only while the permission is
    // undecided, because a dialog that arrives unannounced is one most people
    // decline and iOS never shows twice.
    assert.equal(askCopy().asks, 'Your phone will ask to allow notifications.');
    const ask = code('./ReminderAsk.tsx');
    assert.match(ask, /asks\?: boolean;/);
    assert.match(ask, /const dialogComing = asks \?\? undecided;/, 'the line ignores what the caller read');
    assert.match(ask, /\{dialogComing \? <Text style=\{\[type\.small, st\.soft\]\}>\{REMINDER_ASK_COPY\.asks\}<\/Text> : null\}/);
    assert.equal((ask.match(/REMINDER_ASK_COPY\.asks/g) ?? []).length, 1, 'the dialog line is drawn somewhere it was not decided');
    // Drawn with the ask's own words, before Remind me, and gone once it is answered.
    const asking = ask.slice(ask.indexOf('{settled ? ('), ask.indexOf('<View style={st.actions}>'));
    assert.ok(asking.indexOf('REMINDER_ASK_COPY.body') < asking.indexOf('REMINDER_ASK_COPY.asks') && asking.indexOf('REMINDER_ASK_COPY.asks') < asking.indexOf('REMINDER_ASK_COPY.changeTime'), 'the dialog line is not with the ask');
    // A caller that has not read the permission leaves it to the card, which reads and never asks.
    const read = effects(ask).find((effect) => effect.includes('reminderPermission()'));
    assert.ok(read !== undefined, 'the card never reads whether a dialog is coming');
    assert.match(read, /if \(asks !== undefined\) return;/, 'the card second-guesses what the caller read');
    assert.match(read, /setUndecided\(permission === 'undetermined'\)/, 'the line is shown over a permission already decided');
    // The recap hands it what it read, so the offer's own fact is the one shown.
    const recap = code('../RecapScreen.tsx');
    assert.match(recap, /<ReminderAsk\s+time=\{offer\.choice\}\s+tutor=\{tutorNameOf\(profile\)\}\s+asks=\{offer\.asks\}/, 'the recap no longer says a dialog is coming');
  });
});

describe('the ask, step 2: your talk days (T1.4, Direction A, founder 2026-11-19)', () => {
  const ask = () => code('./ReminderAsk.tsx');
  const handler = () => ask().slice(ask().indexOf('const remind = async () => {'), ask().indexOf('const gloss ='));

  test('step 2 follows only a reminder that was set, for an account with a known plan', () => {
    const remind = handler();
    // Only after the OS took the plan: never on a refusal or a failure, which return first.
    assert.ok(remind.indexOf("outcome !== 'done'") < remind.indexOf("setStep('days')"), 'step 2 shows before the reminder is on');
    assert.ok(remind.indexOf("permission !== 'granted'") < remind.indexOf("setStep('days')"));
    assert.match(remind, /if \(twoSteps && alive\.current\) \{\s*kept\.current = at;\s*setStep\('days'\);\s*return;\s*\}\s*answer\(\{ enabled: true, time: at \}\);/, 'a one-step ask does not answer at once');
    // Offered only when the planner holds a known plan for a signed-in account.
    assert.match(ask(), /const \[twoSteps\] = useState\(talkDaysOffered\);/);
    const planner = code('./ReminderPlanner.tsx');
    assert.match(planner, /export function talkDaysOffered\(\): boolean \{\s*return activeUserId\(\) !== null && freeRefill !== null && freeRefill\.owner === scopeGeneration\(\) && freeRefill\.talk !== undefined;\s*\}/, 'a guest or an unknown plan is offered talk days');
    // And the plan reads the talk facts for its own account only.
    assert.match(planner, /const talk = freeRefill !== null && freeRefill\.owner === owner \? freeRefill\.talk : undefined;/);
    assert.match(planner, /\.\.\.\(talk !== undefined \? \{ talk \} : \{\}\),/);
  });

  test('Not now keeps the reminder, onDone fires once, and the sound and haptic play once', () => {
    const source = ask();
    assert.match(source, /<GhostButton label=\{REMINDER_ASK_COPY\.notNow\} disabled=\{saving\} onPress=\{onKeep\} \/>/, 'step 2 has no quiet way out');
    assert.match(source, /const keep = \(\) => answer\(\{ enabled: true, time: kept\.current as T \| ReminderTimeId \}\);/, 'Not now turns the reminder off');
    assert.equal((source.match(/onDone\(/g) ?? []).length, 1, 'onDone is called from more than the one guarded answer');
    assert.equal((source.match(/playSfx\('save'\)/g) ?? []).length, 1, 'the save sound plays twice');
    assert.equal((source.match(/arrived\(\)/g) ?? []).length, 1, 'the haptic plays twice');
    const use = source.slice(source.indexOf('const useDays = async () => {'), source.indexOf('const pressDay ='));
    assert.ok(use.length > 0, 'the Use these days handler moved; this reads nothing');
    assert.doesNotMatch(use, /playSfx|arrived|askReminderPermission|turnOnReminder/, 'Use these days plays again or asks again');
    assert.match(use, /await chooseTalkDays\(picked, tutor\);\s*keep\(\);/, 'the chosen days are not saved before the answer');
    // keep() runs after the await, so chooseTalkDays must never reject (pinned in plan.test.ts) or the card holds.
    const planner = readFileSync(new URL('./ReminderPlanner.tsx', import.meta.url), 'utf8');
    assert.match(planner, /export async function chooseTalkDays\([^)]*\): Promise<ScheduleOutcome> \{\s*(?:\/\/[^\n]*\s*)?const owner = scopeGeneration\(\);\s*try \{/, 'a rejection leaves the card saving forever');
  });

  test('the saved days preselect, else Mon, Wed and Fri, read without a dialog', () => {
    const source = ask();
    assert.match(source, /useState<number\[\]>\(\(\) => \[\.\.\.DEFAULT_TALK_DAYS\]\)/);
    const read = effects(source).find((effect) => effect.includes('loadReminder('));
    assert.ok(read !== undefined, 'the saved talk days are never read');
    assert.match(read, /setPicked\(talkDaysPicked\(saved\?\.talkDays\)\)/);
    assert.doesNotMatch(read, /askReminderPermission|turnOnReminder|chooseTalkDays/);
  });

  test('blocked chips stay focusable, ignore the press, and speak their reason', () => {
    // The chips are drawn by TalkDayChips, shared with the Settings sheet.
    const chips = code('./TalkDayChips.tsx');
    const source = ask() + chips;
    const press = source.slice(source.indexOf('const pressDay = (day: number) => {'), source.indexOf('const gloss ='));
    assert.match(press, /if \(talkDayBlocked\(picked, day\)\) \{/, 'a blocked chip takes the press');
    assert.match(press, /AccessibilityInfo\.announceForAccessibility\(/, 'a blocked press says nothing');
    // Never disabled (which would leave the focus order), and said in words.
    assert.match(source, /accessibilityLabel=\{talkDayLabel\(picked, day\)\}/);
    assert.match(source, /const blocked = talkDayBlocked\(picked, day\);/);
    assert.match(source, /accessibilityState=\{\{ selected: chosen, disabled: blocked \}\}/);
    const card = source.slice(source.indexOf('function TalkDaysCard('), source.indexOf('function makeSt('));
    assert.ok(card.length > 0, 'step 2 moved; this reads nothing');
    const chip = card.slice(0, card.indexOf('<View style={st.actions}>'));
    assert.doesNotMatch(chip, /\bdisabled=\{/, 'a chip is disabled and leaves the focus order');
    assert.match(chip, /<TalkDayChips picked=\{picked\} onPressDay=\{onPressDay\} \/>/, 'step 2 draws its own chips');
    assert.doesNotMatch(chips, /\bdisabled=\{/, 'a chip is disabled and leaves the focus order');
    // Press skips its haptic only when onPress returns false: the reason is still said, with no tick.
    assert.match(chips, /onPress=\{\(\) => \{\s*onPressDay\(day\);\s*return blocked \? false : undefined;\s*\}\}/, 'a blocked chip still ticks');
    assert.match(source, /talkDayReason\(picked, day\)/, 'the reason is not under the day');
    assert.match(source, /<Icon name="check"/, 'a chosen chip says so by colour alone');
    // The one line under the chips is live.
    assert.match(source, /<Text accessibilityLiveRegion="polite" style=\{\[type\.small, st\.soft\]\}>\{talkDaysLine\(picked, limitTapped\)\}<\/Text>/);
  });

  test('a chip row is one height, the head wraps, the words centre, and a chosen chip pops', () => {
    const chips = code('./TalkDayChips.tsx');
    const style = (name: string) => chips.match(new RegExp(`\\b${name}: \\{([^}]*)\\}`))?.[1] ?? '';
    // Press draws style on an inner view; the chip must fill its stretched cell.
    assert.match(style('chip'), /\bflex(Grow)?: 1\b/, 'a chip does not fill its cell, so a row is uneven');
    assert.match(style('chip'), /minHeight: HIT/, 'a chip lost its touch floor');
    assert.match(style('chipHead'), /flexWrap: 'wrap'/, 'the tick and day cannot wrap at 320');
    assert.match(style('chipHead'), /justifyContent: 'center'/);
    assert.match(chips, /<Text style=\{\[type\.button, \{ textAlign: 'center',/, 'the day is not centred');
    assert.match(chips, /<Text style=\{\[bType\.bold12, st\.soft, \{ textAlign: 'center' \}\]\}>\{reason\}/, 'the reason wraps left-aligned');
    assert.match(chips, /selected=\{chosen\}/, 'a chosen chip has no selection pop');
  });

  test('Use these days is off with none picked; the step labels and the words are the spec\'s', () => {
    const source = ask() + code('./TalkDayChips.tsx');
    assert.match(source, /<PillButton label=\{TALK_DAYS_COPY\.use\} disabled=\{picked\.length === 0 \|\| saving\} onPress=\{onUse\} \/>/);
    assert.match(source, /twoSteps && !settled \? <Text style=\{\[type\.small, st\.soft\]\}>\{TALK_DAYS_COPY\.step1\}<\/Text> : null/, 'Step 1 of 2 shows only when step 2 follows');
    assert.match(source, /\{TALK_DAYS_COPY\.step2\}/);
    // DESIGN.md's eyebrow rule (2026-11-19): the step joins the meta line under the heading, never an eyebrow over it.
    assert.doesNotMatch(source, /type\.eyebrow/);
    assert.ok(source.indexOf('{TALK_DAYS_COPY.step1}') > source.indexOf('REMINDER_ASK_COPY.title'), 'Step 1 of 2 sits under the heading');
    assert.ok(source.indexOf('{TALK_DAYS_COPY.step2}') > source.indexOf('TALK_DAYS_COPY.title'), 'Step 2 of 2 sits under the heading');
    assert.match(source, /onUse=\{\(\) => void useDays\(\)\} onKeep=\{keep\}/, 'step 2 is not wired to its handlers');
    assert.match(source, /said\(TALK_DAYS_COPY\.title, \{ tutor \}\)/);
    assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}\b/, 'a raw hex colour');
    assert.doesNotMatch(source, /letterSpacing/, 'a heading with extra letter-spacing');
    assert.doesNotMatch(source, /numberOfLines|allowFontScaling=\{false\}|maxFontSizeMultiplier/);
    assert.match(source, /minHeight: (HIT|52)/, 'the chips have a fixed height that clips');
  });
});
