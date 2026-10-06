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
import { checkStarter, starterTasks } from '@luvani/core';
import { evidence } from '../../test/evidence.ts';
import { streakGuiltIn } from '../copy/guilt.ts';
import { finishGuestPractice, guestPracticeDays, type GuestPractice } from '../onboarding/guestModel.ts';
import { GUEST_PAGES, resumePage } from '../onboarding/guestProgress.ts';
import { freshPreAccountDraft } from '../onboarding/preAccountDraft.ts';
import { TUTOR_NAME } from '../tutor/tutorName.ts';
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
    // The ask is drawn on day one and in the guest home's sheet, and nowhere else.
    assert.equal((screen.match(/<ReminderAsk\b/g) ?? []).length, 2);
    const remind = screen.slice(screen.indexOf("{page === 'remind' && ("), screen.indexOf("{page === 'keep' && ("));
    assert.match(remind, /\{askShown \? \( <ReminderAsk/, 'day one draws the ask without asking whether it may');
    assert.match(screen, /const askShown = REMINDERS_AVAILABLE && draft\.reminderEnabled !== true && !reminderAnswered;/);
    const sheet = screen.slice(screen.indexOf("{surface === 'reminder' && ("));
    assert.match(sheet, /^\{surface === 'reminder' && \( <ReminderAsk/, 'the guest home\'s sheet draws something other than the one ask');
    assert.match(screen, /<IconAction icon="bell" label=\{FIRST_RUN_COPY\.setReminder\} onPress=\{\(\) => open\('reminder'\)\} \/>/, 'the sheet opens on something other than a tap');
    // Answered: on only once the OS took it, every day.
    assert.match(screen, /if \(answer\.enabled\) patch\(\{ reminderEnabled: true, reminderTime: answer\.time, reminderDays: \[\] \}\);/);

    // The ask: the dialog only inside the tap, then the schedule, never from an effect.
    const ask = code('./ReminderAsk.tsx');
    assert.equal((ask.match(/askReminderPermission\(/g) ?? []).length, 1, 'the dialog can be raised from more than one place');
    assert.equal((ask.match(/scheduleReminder\(/g) ?? []).length, 1);
    const handler = ask.slice(ask.indexOf('const remind = async () => {'), ask.indexOf('const gloss ='));
    assert.ok(handler.length > 0, 'the tap handler moved; this check reads nothing');
    assert.ok(handler.includes('askReminderPermission()'), 'the dialog is raised outside the tap handler');
    assert.ok(handler.indexOf('askReminderPermission()') < handler.indexOf('scheduleReminder('), 'the reminder is scheduled before permission is asked');
    assert.match(handler, /if \(permission !== 'granted'\) \{/, 'a refused permission still schedules');
    assert.match(handler, /if \(outcome !== 'done'\) \{/, 'a refused schedule is reported as on');
    assert.ok(handler.indexOf("outcome !== 'done'") < handler.indexOf('answer({ enabled: true'), 'the answer says on before the OS took it');
    assert.equal((ask.match(/\bremind\(\)/g) ?? []).length, 1, 'the handler is called from somewhere other than the tap');
    assert.match(ask, /onPress=\{\(\) => void remind\(\)\}/, 'Remind me does not raise the dialog');
    for (const effect of effects(ask)) {
      assert.doesNotMatch(effect, /askReminderPermission|scheduleReminder|remind\(\)/, 'an effect raises the dialog nobody tapped for');
    }
    // No reminder to give, no card; one answer, once.
    assert.match(ask, /if \(!REMINDERS_AVAILABLE\) return null;/, 'the web shows an ask it cannot keep');
    assert.match(
      evidence(ASK),
      /const answer = \(value: ReminderAnswer\) => \{ if \(answered\.current\) return; answered\.current = true; onDone\(value\); \};/,
      'the ask can answer twice',
    );
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
    assert.equal((screen.match(/time=\{draft\.reminderTime \?\? DEFAULT_REMINDER_TIME\}/g) ?? []).length, 2, 'the ask offers a time other than the learner\'s or the evening');
    // Every control has words a screen reader can say: the pill, the link and the time rows.
    assert.match(ask, /<PillButton label=\{said\(REMINDER_ASK_COPY\.remindMe, \{ time: gloss \}\)\}/);
    assert.match(ask, /<GhostButton label=\{REMINDER_ASK_COPY\.notNow\}/);
    assert.match(ask, /accessibilityRole="radiogroup"/);
    assert.doesNotMatch(ask, /numberOfLines|allowFontScaling=\{false\}|maxFontSizeMultiplier/, 'the ask caps its text');
  });
});
