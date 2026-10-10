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

    // The screen reaches day one from one place: the finish, once the finish
    // and its day are on the disk.
    const screen = evidence(SCREEN);
    const finish = screen.slice(screen.indexOf('const finish = async () => {'), screen.indexOf('const answerReminder ='));
    assert.ok(finish.length > 0, 'the finish moved; this check reads nothing');
    assert.match(finish, /const finished = finishGuestPractice\(guest, at\); if \(!\(await persist\(finished\)\)\) return;/, 'day one can come before the finish is saved');
    assert.ok(finish.indexOf('await persist(finished)') < finish.indexOf("go('remind')"), 'day one comes before the finish is on the disk');
    assert.equal((screen.match(/go\('remind'\)/g) ?? []).length, 1, 'day one is reached from somewhere other than the finish');
    // The first run asks nothing itself: no permission, no schedule.
    assert.doesNotMatch(screen, /askReminderPermission|scheduleReminder|requestPermissionsAsync/, 'the first run raises the dialog or schedules outside the one ask');
    // The revised streak screen has no reminder interruption. The historical
    // guest Home still opens the same optional ask on a deliberate tap.
    assert.equal((screen.match(/<ReminderAsk\b/g) ?? []).length, 1);
    const remind = screen.slice(screen.indexOf("{page === 'remind' && ("), screen.indexOf("{page === 'keep' && ("));
    assert.doesNotMatch(remind, /<ReminderAsk/, 'a reminder interruption reappeared on the achievement screen');
    assert.match(screen, /const askShown = REMINDERS_AVAILABLE && draft\.reminderEnabled !== true && !reminderAnswered;/);
    const sheet = screen.slice(screen.indexOf("{surface === 'reminder' && ("));
    assert.match(sheet, /^\{surface === 'reminder' && \( <ReminderAsk/, 'the guest home\'s sheet draws something other than the one ask');
    assert.match(screen, /<IconAction icon="bell" label=\{FIRST_RUN_COPY\.setReminder\} onPress=\{\(\) => open\('reminder'\)\} \/>/, 'the sheet opens on something other than a tap');
    // Answered: on only once the OS took it, every day.
    assert.match(screen, /if \(answer\.enabled\) patch\(\{ reminderEnabled: true, reminderTime: answer\.time, reminderDays: \[\] \}\);/);

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
    const younger = screen.slice(screen.indexOf('label="I am younger than that"'), screen.indexOf('/>', screen.indexOf('label="I am younger than that"')));
    assert.ok(younger.length > 0, 'the younger link moved; this check reads nothing');
    assert.match(younger, /if \(draftRef\.current\.reminderEnabled === true\) void cancelReminder\(\);/, 'an under-13 answer leaves the first run\'s reminder on the phone');
    assert.ok(younger.indexOf('cancelReminder()') < younger.indexOf('onRefuse?.()'));
    assert.equal((screen.match(/cancelReminder\(/g) ?? []).length, 1, 'the first run takes a reminder away somewhere other than the refusal');
    const app = evidence('apps/mobile/App.tsx');
    const refuse = app.slice(app.indexOf('const refusePreAccount = useCallback('), app.indexOf('const deleteAccount'));
    assert.match(refuse, /if \(preAccountDraft\?\.reminderEnabled === true\) void cancelReminder\(\); discardPreAccountDraft\(\); \}, \[discardPreAccountDraft, preAccountDraft\]\);/, 'the launch\'s refusal clears the draft and leaves its reminder running');
    // Create one on a returning sign-in screen starts a fresh draft, so the old
    // draft's reminder goes too.
    const flow = evidence('apps/mobile/src/auth/AuthFlow.tsx');
    const newAccount = flow.slice(flow.indexOf('const newAccount = () => {'), flow.indexOf('const signIn ='));
    assert.match(newAccount, /void clearGuestPractice\(\); if \(initialDraft\?\.reminderEnabled === true\) void cancelReminder\(\);/, 'a fresh introduction leaves the old draft\'s reminder on the phone');
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
    assert.equal((screen.match(/time=\{draft\.reminderTime \?\? DEFAULT_REMINDER_TIME\}/g) ?? []).length, 1, 'the ask offers a time other than the learner\'s or the evening');
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
    assert.match(planner, /const offSettled = onSettled\(\(\) => \{/);
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
