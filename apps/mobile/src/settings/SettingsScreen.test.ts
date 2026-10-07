/**
 * The daily reminder, read out of the file that draws it.
 *
 * It was Profile's until revamp A (F576) and it is Settings' now, beside the
 * two rows about the phone's own permissions, because a reminder is something
 * the operating system does rather than something about this learner's French.
 * This file is `tabs/ProfileTab.test.ts`'s reminder half, moved with it,
 * matcher for matcher: the rule did not change, only the screen that keeps it.
 *
 * The two test names are unchanged on purpose. `docs/KNOWN_ISSUES.md` names
 * both of them as the evidence for F231 and F239, and the gate only counts a
 * ticked box when the test it names actually passed.
 *
 * ## Why this is a source walk and not a render
 *
 * apps/mobile has no renderer (docs/TESTING.md): fifty-odd components and not
 * one `.test.tsx`. So the way a rule gets defended here is that it is lifted
 * out of the screen into a plain module with its own suite, and the screen is
 * then held to *using* it. `reminders/reminder.ts` is the module, and every
 * decision this row makes already lives there behind `reminderRow`. What is
 * left in `SettingsScreen.tsx` is layout and wiring, and wiring is the thing a
 * grep can actually see.
 *
 * Be exact about what that buys. These tests prove that the screen asks
 * `reminderRow` and writes what it answered, that the explaining sentence is
 * written above the control that raises the dialog, and that nothing is put on
 * disk or handed to the OS that the module did not approve. They prove nothing
 * about pixels, about VoiceOver, or about a notification arriving on a phone.
 *
 * ## The two halves of the pinned name
 *
 * **Explains the ask first.** A permission dialog that arrives with no warning
 * is a dialog most people decline, and iOS never offers it twice. So the
 * sentence has to be on screen before the switch can be touched, and it has to
 * be the module's sentence rather than a second copy written here, which is how
 * the screen and the notification would come to promise different things.
 *
 * **A refusal leaves no dead switch.** A dead switch is one that reads on over
 * a channel the OS closed in Settings last month: the learner believes a
 * reminder is coming, none comes, and nothing ever says so. The defence is that
 * permission is read fresh on the way in and re-read on every flip, and that
 * the value written to disk is `reminderRow`'s answer rather than the position
 * the learner's thumb left the switch in.
 *
 * Both halves are proved to bite in the test below this one, by running the
 * same matchers over sources that break them.
 *
 * `stripComments` is load-bearing. This header names `row.note`, `<SwitchRow`
 * and `saveReminder` in prose, and every one of those is a needle the
 * structural scan looks for.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { guiltIn } from '../copy/guilt.ts';
import {
  REMINDER_EXPLAIN,
  REMINDER_OFF,
  REMINDER_REFUSED,
  REMINDER_ROW,
  reminderRow,
} from '../reminders/reminder.ts';
// The web half of the platform pair, which node can execute. Imported to prove
// the one thing the F239 outcome decision rests on: the build that answers
// `unavailable` is a build whose row can never be on.
import { REMINDERS_AVAILABLE } from '../reminders/schedule.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Comments may say anything; only what reaches glass is under test. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const TAB = stripComments(read('./SettingsScreen.tsx'));

/**
 * Just the Phone card, from its heading to the end of the Card.
 *
 * Every claim in this file is about that one group. The screen has switches in
 * two other places — the consent row above it, and the pace row is Profile's —
 * and a whole-file scan would happily answer "the explaining sentence is above
 * a switch" about the wrong one. The region is bounded once, here, and used by
 * both the tests that need it.
 */
const REMINDER_CARD = (() => {
  const start = TAB.indexOf('<Label>{PHONE_GROUP}</Label>');
  const end = TAB.indexOf('</Card>', start);
  assert.ok(start !== -1 && end > start, 'the reminder group is not a card on this screen');
  return TAB.slice(start, end);
})();

/**
 * `first` is present, `second` is present, and `first` comes first.
 *
 * A boolean rather than an assertion so the mutation test can watch it answer
 * false. The two presence checks are the whole point: `indexOf` answers -1 for
 * something that was deleted, and -1 sorts before every real position, so the
 * obvious spelling of an ordering check passes most confidently in the one case
 * it exists to catch. surfaceContract.test.ts writes this down as `writtenBefore`
 * after that trap hid a missing network flag under a green suite.
 */
function writtenBefore(source: string, first: string, second: string): boolean {
  const at = source.indexOf(first);
  const then = source.indexOf(second);
  return at !== -1 && then !== -1 && at < then;
}

/**
 * The argument text of every `callee(...)` in a source, parens counted.
 *
 * Counted rather than matched with a lazy regex, for the reason cardView's tag
 * walk gives: `saveReminder({ enabled: honest.on, time: chosen.value })` has a
 * `)` inside it the moment anything nests, and a regex that stops at the first
 * one reports an argument list nobody wrote.
 */
function callArguments(source: string, callee: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(new RegExp(`\\b${callee}\\(`, 'g'))) {
    const start = match.index;
    if (start === undefined) continue;
    const open = start + match[0].length - 1;
    let depth = 0;
    for (let i = open; i < source.length; i += 1) {
      const char = source[i];
      if (char === '(') depth += 1;
      else if (char === ')') {
        depth -= 1;
        if (depth === 0) {
          found.push(source.slice(open + 1, i).trim());
          break;
        }
      }
    }
  }
  return found;
}

/**
 * The body of `const name = ... { ... }`, braces counted.
 *
 * Per-handler rather than whole-file, because "the write is checked before the
 * row moves" has to hold in each handler separately. Asked of the file as a
 * whole it would pass on the first handler's ordering while the second wrote
 * blind.
 */
function braceBlockAfter(source: string, needle: string): string | null {
  const at = source.indexOf(needle);
  if (at === -1) return null;
  const open = source.indexOf('{', at);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const char = source[i];
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  return null;
}

function bodyOf(source: string, name: string): string {
  const body = braceBlockAfter(source, `const ${name} =`);
  assert.notEqual(body, null, `${name} is not in the screen at all, or its body is never closed`);
  return body ?? '';
}

/** The two sentences this screen writes for itself, and the facts they separate. */
const SAVE_TROUBLE = 'Your phone did not save that. The reminder is unchanged, and you can try again.';
const SCHEDULE_TROUBLE = 'Your phone would not change the reminder just now. You can try again.';

/** The two handlers that are allowed to change what the row says. */
const HANDLERS = ['toggleReminder', 'chooseReminderTime'] as const;

describe('the daily reminder on Settings', () => {
  test('an unread choice stays unknown until an owned retry succeeds', () => {
    assert.match(TAB, /loadReminder\(\{ strict: true \}\)/, 'the screen uses a lenient read that can turn corrupt bytes into Off');
    assert.match(TAB, /const reminderOwned = storedOwner\?\.scope === currentReminderScope && storedOwner\.userId === currentReminderUser && storedOwner\.userId === activeUserId\(\)/);
    assert.match(TAB, /const reminderUnread = unreadReminderOwner\?\.scope === currentReminderScope && unreadReminderOwner\.userId === currentReminderUser && unreadReminderOwner\.userId === activeUserId\(\)/);
    assert.match(TAB, /const row = notifications === null \|\| !reminderOwned \? null : reminderRow\(stored, notifications\)/, 'the switch can show Off before the owned read succeeds');
    assert.match(REMINDER_CARD, /reminderUnknown && <View[\s\S]*?Reminder status could not be read\. Try again before changing it\./, 'an unread choice has no visible explanation');
    assert.match(REMINDER_CARD, /reminderUnread && <GhostButton label="Retry reminder status" onPress=\{\(\) => setReminderAttempt\(value => value \+ 1\)\}/, 'an unread choice has no retry');
    assert.match(TAB, /\}, \[user, reminderAttempt\]\)/, 'Retry cannot reread the owned value');
    for (const name of HANDLERS) {
      const body = bodyOf(TAB, name);
      assert.match(body, /if \(row === null[^\n]*!ownsReminderNow\(\)\) return;/, `${name} accepts a tap from an unknown or former owner`);
      assert.ok(writtenBefore(body, 'if (!ownsReminderNow()) return;', 'saveReminder(wanted)'), `${name} can write after a scope change during the permission read`);
      assert.ok(writtenBefore(body, 'if (!ownsReminderNow()) return;', 'replanReminders({ choice: wanted })'), `${name} can schedule after a scope change`);
    }
    assert.match(TAB, /<BottomSheet visible=\{sheet === 'reminderTime' && reminderOwned\}/, 'a former owner can expose the selected reminder time');
  });

  test('the profile reminder row explains the ask first and a refusal leaves no dead switch', () => {
    // ─────────────────────────────────────────── explains the ask first
    //
    // The module's half of it, restated here because the screen's contract is
    // with these exact values: an undecided permission is the one state that
    // carries the explaining sentence and the one state that raises a dialog.
    const undecided = reminderRow(null, 'undetermined');
    assert.equal(undecided.note, REMINDER_EXPLAIN, 'the undecided row stopped carrying the sentence that explains the ask');
    assert.equal(undecided.asks, true, 'the undecided row no longer says a dialog is coming');
    assert.equal(undecided.on, false, 'the row draws an on switch over a permission nobody has granted');

    // The screen's half. The note is written above the control, so the sentence
    // is read before the dialog can be raised. Bounded to the Phone card,
    // because the consent switch above it is not this switch and must not be
    // able to satisfy this claim on its behalf.
    assert.ok(REMINDER_CARD.includes('<SwitchRow'), 'the bounded block does not contain the switch, so it is scanning the wrong card');
    assert.ok(
      writtenBefore(REMINDER_CARD, 'row.note', '<SwitchRow'),
      'the explaining sentence is not written above the switch, so the system dialog can arrive unexplained',
    );

    // And it is the module's sentence, not a second copy. Two copies is how the
    // screen and the notification start promising different things.
    for (const fragment of ['Your phone will ask', 'one a day']) {
      assert.ok(
        !TAB.includes(fragment),
        `the screen writes its own version of the reminder copy ("${fragment}") instead of showing reminder.ts's`,
      );
    }
    assert.ok(TAB.includes('REMINDER_EXPLAIN') === false, 'the screen reaches past reminderRow for the sentence');

    // The dialog is raised in exactly one place, and only where the module said
    // one belongs. Anywhere else is the re-ask loop iOS will not honour anyway.
    assert.equal(
      callArguments(TAB, 'askReminderPermission').length,
      1,
      'the system dialog is raised from more than one place, or from none',
    );
    assert.ok(
      TAB.includes('row.asks ? askReminderPermission() : reminderPermission()'),
      'the screen decides for itself when to raise the dialog instead of obeying reminderRow',
    );

    // ────────────────────────────────── a refusal leaves no dead switch
    //
    // The module refuses whether the stored flag was on or off, because the
    // switch is just as dead before it is flipped as after.
    for (const stored of [{ enabled: true, time: 'morning' }, { enabled: false, time: 'morning' }] as const) {
      const refused = reminderRow(stored, 'denied');
      assert.equal(refused.on, false, `a refused permission still draws an on switch over stored ${String(stored.enabled)}`);
      assert.equal(refused.value, REMINDER_OFF, 'a refused row shows a time nothing will arrive at');
      assert.equal(refused.note, REMINDER_REFUSED, 'a refused row says nothing about where it can be changed');
      assert.equal(refused.asks, false, 'a refused row offers to ask again');
    }

    // A revocation that happened in the phone's own settings last month is only
    // visible if the OS is asked on the way in. Read on focus, not once at
    // mount, so the walk back from those settings is enough.
    const focus = callArguments(TAB, 'useFocusEffect');
    assert.equal(focus.length, 1, 'the screen reads permission on focus in more than one place, or in none');
    assert.ok(focus[0]?.includes('reminderPermission()'), 'the row is drawn from a permission the screen never re-read');
    assert.ok(focus[0]?.includes('loadReminder({ strict: true })'), 'the row is drawn from a stored value the screen never strictly re-read');

    // Nothing reaches the disk that the module did not approve. This is the
    // structural form of "no dead switch": the value written is reminderRow's
    // answer against a freshly read permission, never the switch's position.
    // Widened for F239's rollback write, which is new code rather than a
    // loosened rule: `reverted` is still a value reminderRow answered for, and
    // both names are now pinned to their own assembled shape below.
    const saved = callArguments(TAB, 'saveReminder');
    assert.ok(saved.length > 0, 'the screen never writes the choice down');
    for (const argument of saved) {
      assert.ok(
        argument === 'wanted' || argument === 'reverted',
        `saveReminder is handed ${argument} rather than a value reminderRow approved`,
      );
    }

    const wanted = TAB.match(/const wanted: StoredReminder = \{[^}]*\}/g) ?? [];
    assert.equal(wanted.length, saved.filter((a) => a === 'wanted').length, 'a write is assembled somewhere this scan cannot read');
    for (const line of wanted) {
      assert.match(line, /enabled: honest\.on/, `the screen writes the thumb's position rather than the honest one: ${line}`);
    }

    const honest = TAB.match(/const honest = [^;]+;/g) ?? [];
    assert.equal(honest.length, wanted.length, 'a written value is decided somewhere other than reminderRow');
    for (const line of honest) {
      assert.match(line, /reminderRow\(\{ enabled: [^}]*\}, fresh\)/, `the decision is made against a stale permission: ${line}`);
    }

    // A write that failed is a switch that reverts at next launch. Each handler
    // reads the ack before it moves the row, and before it touches the OS.
    for (const name of HANDLERS) {
      const body = bodyOf(TAB, name);
      assert.ok(body.includes("if (ack === 'failed')"), `${name} believes a write it never checked`);
      assert.ok(
        body.includes('setReminderTrouble(REMINDER_SAVE_TROUBLE)'),
        `${name} lets a write fail without telling anyone`,
      );
      assert.ok(
        writtenBefore(body, "ack === 'failed'", 'setStored(wanted)'),
        `${name} moves the row before it knows the write landed`,
      );
      assert.ok(
        writtenBefore(body, "ack === 'failed'", 'replanReminders('),
        `${name} schedules a notification the app may not remember asking for`,
      );
      assert.ok(body.includes('cancelReminder()'), `${name} can turn the row off without stopping the notification`);
    }

    // The OS is reached only through the platform pair F230 owns.
    assert.ok(!TAB.includes('expo-notifications'), 'the screen talks to the notification SDK behind the platform pair');
  });

  test('both halves of that check bite when the screen stops keeping them', () => {
    // A structural scan that matches nothing passes forever. Every claim above
    // is run here against a source that breaks it.

    // Half one. The -1 trap first: a deleted sentence must not read as written
    // before anything, which is the failure mode surfaceContract names.
    assert.equal(
      writtenBefore('<SwitchRow value={row.on} />', 'row.note', '<SwitchRow'),
      false,
      'a screen with no explaining sentence at all passes the ordering check',
    );
    assert.equal(
      writtenBefore('{row.note ? <Text>{row.note}</Text> : null}', 'row.note', '<SwitchRow'),
      false,
      'a screen with the sentence and no switch passes the ordering check',
    );
    assert.equal(
      writtenBefore('<SwitchRow value={row.on} />\n{row.note}', 'row.note', '<SwitchRow'),
      false,
      'the sentence written under the switch passes as if it were above it',
    );
    assert.equal(
      writtenBefore('{row.note ? <Text /> : null}\n<SwitchRow value={row.on} />', 'row.note', '<SwitchRow'),
      true,
      'the shape the screen actually ships does not pass its own check',
    );

    // Half two. The switch written straight from the thumb, which is the whole
    // defect: a learner flips it, the permission is denied, and the row says on.
    const naive = 'const wanted: StoredReminder = { enabled: next, time: chosen.value };';
    assert.doesNotMatch(naive, /enabled: honest\.on/, 'a value taken from the switch passes as one the module approved');
    const guarded = 'const wanted: StoredReminder = { enabled: honest.on, time: chosen.value };';
    assert.match(guarded, /enabled: honest\.on/, 'the shape the screen ships does not pass its own check');

    // A decision made against the permission the screen was holding rather than
    // the one it just read.
    assert.doesNotMatch(
      'const honest = reminderRow({ enabled: next, time: chosen.value }, permission);',
      /reminderRow\(\{ enabled: [^}]*\}, fresh\)/,
      'a stale permission passes as a fresh one',
    );

    // A handler that moves the row before it reads the ack.
    const eager = "{ const ack = await saveReminder(wanted); setStored(wanted); if (ack === 'failed') return; }";
    assert.equal(
      writtenBefore(eager, "ack === 'failed'", 'setStored(wanted)'),
      false,
      'a handler that writes the row before it checks the ack passes the ordering check',
    );

    // And the paren counter, which every one of those greps rests on.
    assert.deepEqual(callArguments('saveReminder(f(a, b));', 'saveReminder'), ['f(a, b)'], 'a nested call ends the argument early');
    assert.deepEqual(callArguments('x(1); saveReminder(wanted); saveReminder(other);', 'saveReminder'), ['wanted', 'other']);
    assert.deepEqual(callArguments('noSuchCall(1);', 'saveReminder'), [], 'the counter invents a call that is not there');
  });

  test('the reminder row borrows its words and invents only the one it has to', () => {
    // Every learner-facing string on this row comes from reminder.ts, where the
    // guilt scan already reads them as a list. The exception is the line for a
    // write that did not land, which is about this device rather than about the
    // reminder, so it is written here and held to the same bar.
    assert.ok(TAB.includes(SAVE_TROUBLE), 'the screen no longer says anything when the choice fails to save');
    assert.equal(guiltIn(SAVE_TROUBLE), undefined, `"${SAVE_TROUBLE}" carries a word Luvani does not say to learners`);
    assert.ok(!/[—–]/.test(SAVE_TROUBLE), 'the save line carries an em dash');
    assert.ok(!/\d/.test(SAVE_TROUBLE), 'the save line carries a number, and nothing on this row counts anything');
    assert.ok(!/\b(sorry|apolog|oops)/i.test(SAVE_TROUBLE), 'the save line apologises');

    // The module's own two sentences are what the row shows, and they are clean.
    // reminder.test.ts scans the whole list; this pins the two the row renders.
    assert.equal(guiltIn(REMINDER_EXPLAIN), undefined);
    assert.equal(guiltIn(REMINDER_REFUSED), undefined);

    // The row is named once, from the module, and the switch answers to that
    // name for anyone who cannot see it.
    assert.ok(TAB.includes('title={REMINDER_ROW}'), 'the reminder switch lost the name that says what it is');
    assert.ok(TAB.includes('accessibilityLabel={REMINDER_ROW}'), 'the switch reaches a screen reader unnamed');
    assert.ok(!TAB.includes("'Daily reminder'"), 'the screen spells the row name itself instead of importing it');
    assert.equal(REMINDER_ROW, 'Daily reminder');

    // Nothing on this row reports on the learner. No count, no percentage, and
    // no second opinion about when the reminder arrives. Bounded at the card it
    // draws, so the rest of the screen cannot lend it a pass or a failure.
    const block = REMINDER_CARD;
    assert.ok(block.includes('<SwitchRow'), 'the bounded block does not contain the switch, so it is scanning the wrong card');
    assert.ok(!/%/.test(block), 'the reminder row prints a percentage');
    assert.ok(!/\b(streak|practised|today)\b/i.test(block), 'the reminder row knows something about what the learner did');
  });
});

/**
 * F239. The second, narrower route to the same dead switch.
 *
 * F231 made the row honest about permission and honest about the disk. It left
 * one gap: `saveReminder` can answer `durable` and the plan (`replanReminders`, which replaced `scheduleReminder`) can then
 * answer `failed`, and the row would sit on over a notification the OS never
 * accepted. Nobody could see it, because unlike permission there is no way to
 * ask the phone later whether a reminder exists — `reminderRow` takes a stored
 * value and a permission, and neither of them knows.
 *
 * That absence is what decides the two design questions this entry raises.
 *
 * **What the store holds.** It holds what the phone will actually do, so a
 * refusal puts the previous value back. Permission is allowed to be reconciled
 * on the next focus because it can be re-read; a schedule cannot, so a wrong
 * value written here is wrong forever.
 *
 * **Which outcomes are a refusal.** Only `failed`. `unavailable` is a build
 * with no scheduler, which is not a refusal and must not raise an alarming
 * line, and the test below proves it cannot reach a learner anyway.
 */
describe('a schedule the phone would not take', () => {
  test('a reminder the phone refused to schedule does not leave the row reading on', () => {
    for (const name of HANDLERS) {
      const body = bodyOf(TAB, name);

      // The OS is asked, and its answer is read. Both verbs go through the same
      // guard, because a cancel the phone refused is the same dead switch with
      // the sign flipped: the row would say Off while the notification kept
      // arriving daily, from the one control the learner would use to stop it.
      assert.ok(
        body.includes('honest.on ? await replanReminders({ choice: wanted }) : await cancelReminder()'),
        `${name} does not read what the OS answered`,
      );
      assert.ok(
        writtenBefore(body, 'replanReminders(', "outcome === 'failed'"),
        `${name} checks an outcome it has not asked for yet`,
      );
      assert.ok(
        writtenBefore(body, "outcome === 'failed'", 'setStored(wanted)'),
        `${name} moves the row before it knows the phone took the reminder`,
      );

      const refusal = braceBlockAfter(body, "if (outcome === 'failed')");
      assert.notEqual(refusal, null, `${name} does not branch on a refusal from the OS at all`);
      const refused = refusal ?? '';

      // The row does not move. This is the sentence in the pinned name.
      assert.ok(
        !refused.includes('setStored('),
        `${name} draws the row on over a reminder the phone refused: ${refused}`,
      );

      // And the disk is put back, so the next launch does not read the lie.
      assert.ok(refused.includes('saveReminder(reverted)'), `${name} leaves the store claiming a reminder that was never set`);
      assert.ok(
        body.includes('const reverted: StoredReminder = { ...stored, enabled: row.on,'),
        `${name} works out the rollback for itself instead of using the state reminderRow answered for`,
      );
      assert.ok(
        refused.includes('setReminderTrouble(REMINDER_SCHEDULE_TROUBLE)'),
        `${name} lets the phone refuse in silence`,
      );
    }

    // The words. A different fact from a write that did not land, so a
    // different sentence: saying "did not save that" when the save was durable
    // is a lie told in the one place this screen has to be trusted.
    assert.ok(TAB.includes(SCHEDULE_TROUBLE), 'the screen says nothing when the phone refuses to schedule');
    assert.notEqual(SCHEDULE_TROUBLE, SAVE_TROUBLE, 'two different facts are being told with one sentence');
    assert.equal(guiltIn(SCHEDULE_TROUBLE), undefined, `"${SCHEDULE_TROUBLE}" carries a word Luvani does not say to learners`);
    assert.ok(!/[—–]/.test(SCHEDULE_TROUBLE), 'the schedule line carries an em dash');
    assert.ok(!/\d/.test(SCHEDULE_TROUBLE), 'the schedule line carries a number');

    // It puts the refusal on the phone, where it happened.
    assert.match(SCHEDULE_TROUBLE, /^Your phone/, 'the line does not name the phone as the thing that refused');
    assert.ok(
      !/\byou (did|forgot|need|must|should|have to)\b/i.test(SCHEDULE_TROUBLE),
      'the line reads as something the learner did',
    );
    assert.ok(!/\b(sorry|apolog|oops|unfortunate)/i.test(SCHEDULE_TROUBLE), 'the line apologises');

    // It leaves somewhere to go, and it is silent about the disk, because the
    // rollback can be refused by the same full phone and a claim that nothing
    // changed would be the second lie.
    assert.match(SCHEDULE_TROUBLE, /try again/, 'the line leaves the learner nowhere to go');
    assert.ok(!/unchanged|nothing has changed/i.test(SCHEDULE_TROUBLE), 'the line promises a disk state it cannot check');

    // And it works in both directions, because one line is shown for a refused
    // schedule and a refused cancel and nothing here branches on which.
    assert.ok(!/\bset\b|\bturn(ed|s)? (on|off)\b/i.test(SCHEDULE_TROUBLE), 'the line only reads right in one direction');
  });

  test('the phone refusing is told apart from a build that has no scheduler', () => {
    // `unavailable` and `failed` are different facts and the screen treats them
    // differently. Only `failed` is a refusal.
    for (const name of HANDLERS) {
      const body = bodyOf(TAB, name);
      assert.ok(body.includes("outcome === 'failed'"), `${name} does not name the one outcome that is a refusal`);
      assert.ok(
        !body.includes("outcome !== 'done'"),
        `${name} sweeps every outcome that is not success into a refusal, which makes a build with no scheduler look broken`,
      );
      assert.ok(
        !body.includes("'unavailable'"),
        `${name} treats a build with no scheduler as something that went wrong`,
      );
    }

    // And it is not a judgement call: on the only half that answers
    // `unavailable`, the row can never be on in the first place, so
    // `replanReminders` is unreachable from it. Executed rather than read.
    assert.equal(REMINDERS_AVAILABLE, false, 'the half under test is not the one with no scheduler');
    assert.equal(reminderRow({ enabled: true, time: 'morning' }, 'denied').on, false);
    assert.ok(TAB.includes('REMINDERS_AVAILABLE && row !== null'), 'the group is drawn on a build that cannot schedule anything');
  });

  test('that check bites when the row moves over a schedule that was refused', () => {
    // The defect itself: the OS is asked, its answer is dropped, the row moves.
    const dropped = "{ const outcome = await replanReminders({ choice: wanted }); setStored(wanted); }";
    assert.equal(
      writtenBefore(dropped, "outcome === 'failed'", 'setStored(wanted)'),
      false,
      'a handler that never reads the outcome passes the ordering check',
    );
    assert.equal(braceBlockAfter(dropped, "if (outcome === 'failed')"), null, 'a missing refusal branch is found anyway');

    // A branch that exists and moves the row inside it, which is the same bug
    // wearing a guard.
    const stillStores = "if (outcome === 'failed') { setStored(wanted); setReminderTrouble(REMINDER_SCHEDULE_TROUBLE); }";
    const block = braceBlockAfter(stillStores, "if (outcome === 'failed')") ?? '';
    assert.ok(block.includes('setStored('), 'a refusal branch that still moves the row reads as clean');
    assert.ok(!block.includes('saveReminder(reverted)'), 'a refusal branch that never rolls back reads as clean');

    // The easy version of the outcome check, which makes a build with no
    // scheduler look like a phone that refused.
    const sweeping = "if (outcome !== 'done') { setReminderTrouble(REMINDER_SCHEDULE_TROUBLE); }";
    assert.ok(!sweeping.includes("outcome === 'failed'"), 'a sweeping guard passes as one that names the refusal');

    // A rollback worked out from the thumb rather than from reminderRow.
    const negated = 'const reverted: StoredReminder = { enabled: !next, time: chosen.value };';
    assert.ok(
      !negated.includes('const reverted: StoredReminder = { ...stored, enabled: row.on,'),
      'a rollback computed by negating the switch passes as a value the module answered for',
    );

    // And the shape the screen actually ships passes each of them.
    const shipped =
      "{ const outcome = honest.on ? await replanReminders({ choice: wanted }) : await cancelReminder();" +
      " if (outcome === 'failed') { await saveReminder(reverted); setReminderTrouble(REMINDER_SCHEDULE_TROUBLE); return; }" +
      ' setStored(wanted); }';
    assert.equal(writtenBefore(shipped, "outcome === 'failed'", 'setStored(wanted)'), true);
    const shippedBlock = braceBlockAfter(shipped, "if (outcome === 'failed')") ?? '';
    assert.ok(shippedBlock.includes('saveReminder(reverted)') && !shippedBlock.includes('setStored('));
  });
});

/**
 * The time preset sheet, which moved with the switch it belongs to.
 *
 * Four presets rather than a picker, drawn as `OptionCard`s the way every other
 * three-or-four-answer question in this app is, and it takes the whole screen
 * through an early return so there is no such thing as one open below the fold.
 */
describe('the part of the day the reminder lands in — F576', () => {
  test('the reminder time is chosen from the presets the module owns, on a sheet that takes the screen', () => {
    assert.match(TAB, /<BottomSheet visible=\{sheet === 'reminderTime' && reminderOwned\} title=\{REMINDER_TIME_TITLE\}/);
    assert.match(TAB, /REMINDER_TIMES.map\(/);
    assert.match(TAB, /selected=\{chosen.value === option.value\}/);
    assert.match(TAB, /onPress=\{\(\) => chooseReminderTime\(option.value\)\}/);
    assert.match(TAB, /footer=\{<PillButton label="Done" onPress=\{\(\) => setSheet\('none'\)\}/);
    const writer = TAB.slice(TAB.indexOf('const chooseReminderTime'), TAB.indexOf('const forgetDeleteDraft'));
    assert.doesNotMatch(writer, /setSheet\('none'\)/, 'choosing stays open until Done');
    assert.ok(writtenBefore(REMINDER_CARD, 'row.on && (', 'REMINDER_TIME_TITLE'));
  });
});
