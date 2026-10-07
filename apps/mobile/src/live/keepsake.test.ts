/**
 * The recap as a keepsake — notebook Phase 4 (B1), report change 19.
 *
 * The end of a conversation is the moment a learner decides whether to come
 * back, so it is kept and not scored: the lines they said, one phrase kept, one
 * sound, and "Next time" naming the spine's next scene. Only after all of that
 * does the recap offer a daily reminder at the time they chose, and the phone's
 * notification dialog is raised only when they accept that offer: never before
 * the first win, and never by a screen merely opening.
 *
 * Every decision is here, where it can be asked; RecapScreen.test.ts holds the
 * screen to asking it.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { FIRST_MISSION, SCENE_SPINE, getMission, missionStates } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { REMINDER_REFUSED, reminderTime, type ReminderPermission, type StoredReminder } from '../reminders/reminder.ts';
import {
  KEEPSAKE_COPY,
  MAX_KEEPSAKE_LINES,
  acceptReminderOffer,
  keepsakeLines,
  nextTimeLine,
  reminderAnswerLine,
  reminderOffer,
  type ReminderOffer,
} from './keepsake.ts';

const NOW = new Date(2026, 8, 27, 18, 0, 0).getTime();

const turn = (who: 'tutor' | 'learner' | 'narration', fr: string) => ({ who, fr });

describe('your lines', () => {
  test('are the learner\'s own French, the last few said, in the order they were said', () => {
    const lines = keepsakeLines([
      turn('narration', 'Un petit café.'),
      turn('tutor', 'Bonjour ! Qu’est-ce que je vous sers ?'),
      turn('learner', 'Bonjour, je vais prendre un café.'),
      turn('tutor', 'Sur place ou à emporter ?'),
      turn('learner', '  Sur place, s’il vous plaît.  '),
      turn('learner', 'Sur place, s’il vous plaît.'),
      turn('learner', ''),
      turn('learner', 'Je vous dois combien ?'),
      turn('learner', 'Merci, bonne journée.'),
    ]);
    assert.equal(MAX_KEEPSAKE_LINES, 3);
    assert.deepEqual(lines, ['Sur place, s’il vous plaît.', 'Je vous dois combien ?', 'Merci, bonne journée.']);
    assert.deepEqual(keepsakeLines([turn('tutor', 'Bonjour !')]), [], 'a line the tutor said was kept as the learner\'s');
  });
});

describe('next time', () => {
  test('names the spine\'s next scene, and nothing once every scene is earned', () => {
    const first = missionStates([{ id: FIRST_MISSION, at: NOW - 1000, rung: 4 }], [], NOW);
    assert.equal(nextTimeLine(first), `Next time: ${getMission(SCENE_SPINE[1]!)!.titleEn}`);
    assert.equal(nextTimeLine(missionStates([], [], NOW)), `Next time: ${getMission(FIRST_MISSION)!.titleEn}`);
    const all = missionStates(SCENE_SPINE.map((id, i) => ({ id, at: NOW - 1000 - i, rung: 4 as const })), [], NOW);
    assert.equal(nextTimeLine(all), null, 'a finished path still promises a next scene');
  });
});

describe('the reminder offer', () => {
  const base = { available: true, won: true, stored: null as StoredReminder | null, permission: 'undetermined' as ReminderPermission | null };

  test('comes only after a win, on a phone that can remind, and never over a refusal or a reminder already on', () => {
    assert.equal(reminderOffer({ ...base, won: false }), null, 'the reminder was offered before the first win');
    assert.equal(reminderOffer({ ...base, available: false }), null, 'a build with no scheduler offered a reminder');
    assert.equal(reminderOffer({ ...base, permission: null }), null, 'the offer was drawn before the permission was even read');
    assert.equal(reminderOffer({ ...base, permission: 'denied' }), null, 'the offer argues with a refusal');
    assert.equal(reminderOffer({ ...base, permission: 'granted', stored: { enabled: true, time: 'night' } }), null, 'a reminder already on was offered again');
    assert.equal(reminderOffer({ ...base, permission: 'granted', stored: { enabled: true, time: 'smart', paused: true } }), null, 'a reminder that paused itself was offered again after it said it would stop');
    // Nobody has chosen a time yet: the offer follows the learner's own rhythm.
    assert.equal(reminderOffer(base)?.choice, 'smart');
  });

  test('is at the learner\'s chosen time, and says a dialog is coming only when one is', () => {
    const chosen = reminderOffer({ ...base, stored: { enabled: false, time: 'morning' } })!;
    assert.equal(chosen.time.value, 'morning', 'the offer ignores the time the learner picked in their plan');
    assert.equal(chosen.choice, 'morning', 'the offer plans a time other than the learner\'s');
    assert.equal(chosen.asks, true);
    // The words are the one ask's own (ReminderAsk.test.ts pins that the recap
    // hands it `asks` and that it says a dialog is coming only then).
    assert.deepEqual(Object.keys(chosen).sort(), ['asks', 'choice', 'time'], 'the offer carries words nothing on the recap draws');

    const fallback = reminderOffer(base)!;
    assert.equal(fallback.time.value, reminderTime(undefined).value, 'no stored time does not fall back to the default preset');

    const granted = reminderOffer({ ...base, permission: 'granted', stored: { enabled: false, time: 'lunch' } })!;
    assert.equal(granted.asks, false, 'a phone that already allows notifications is told a dialog is coming');
  });
});

describe('accepting the offer', () => {
  function phone(answer: ReminderPermission, opts: { save?: 'durable' | 'failed'; schedule?: 'done' | 'failed' | 'unavailable'; throws?: boolean } = {}) {
    const calls: string[] = [];
    const saved: StoredReminder[] = [];
    return {
      calls,
      saved,
      deps: {
        ask: async () => {
          calls.push('ask');
          if (opts.throws) throw new Error('the platform threw');
          return answer;
        },
        read: async () => {
          calls.push('read');
          return answer;
        },
        save: async (reminder: StoredReminder) => {
          calls.push('save');
          saved.push(reminder);
          return opts.save ?? 'durable';
        },
        schedule: async (time: StoredReminder['time']) => {
          calls.push(`schedule:${time}`);
          return opts.schedule ?? 'done';
        },
      },
    };
  }
  const offerAt = (permission: ReminderPermission): ReminderOffer =>
    reminderOffer({ available: true, won: true, stored: { enabled: false, time: 'evening' }, permission })!;

  test('raises the notification dialog only here, then saves and schedules at the chosen time', async () => {
    const p = phone('granted');
    assert.equal(await acceptReminderOffer(offerAt('undetermined'), p.deps), 'on');
    assert.deepEqual(p.calls, ['ask', 'save', 'schedule:evening']);
    assert.deepEqual(p.saved, [{ enabled: true, time: 'evening' }]);

    // Already allowed: the phone is read, never asked a second time.
    const q = phone('granted');
    assert.equal(await acceptReminderOffer(offerAt('granted'), q.deps), 'on');
    assert.deepEqual(q.calls, ['read', 'save', 'schedule:evening']);
  });

  test('a refusal writes nothing, and a phone that will not schedule is put back to off', async () => {
    const refused = phone('denied');
    assert.equal(await acceptReminderOffer(offerAt('undetermined'), refused.deps), 'refused');
    assert.deepEqual(refused.calls, ['ask'], 'a refused dialog still wrote or scheduled a reminder');

    const full = phone('granted', { save: 'failed' });
    assert.equal(await acceptReminderOffer(offerAt('undetermined'), full.deps), 'failed');
    assert.ok(!full.calls.some((c) => c.startsWith('schedule')), 'a reminder was scheduled that the disk does not know about');

    const stubborn = phone('granted', { schedule: 'failed' });
    assert.equal(await acceptReminderOffer(offerAt('undetermined'), stubborn.deps), 'failed');
    assert.deepEqual(stubborn.saved.at(-1), { enabled: false, time: 'evening' }, 'the store says on over a reminder the phone refused');

    const threw = phone('granted', { throws: true });
    assert.equal(await acceptReminderOffer(offerAt('undetermined'), threw.deps), 'failed');
  });

  test('a pending permission or save cannot schedule a reminder for the next account', async () => {
    for (const boundary of ['permission', 'save'] as const) {
      let owned = true;
      const p = phone('granted');
      const originalSave = p.deps.save;
      const deps = { ...p.deps, owns: () => owned,
        ask: async () => { const answer = await p.deps.ask(); if (boundary === 'permission') owned = false; return answer; },
        save: async (value: StoredReminder) => { const ack = await originalSave(value); if (boundary === 'save') owned = false; return ack; },
      };
      assert.equal(await acceptReminderOffer(offerAt('undetermined'), deps), 'failed');
      assert.ok(!p.calls.some(call => call.startsWith('schedule')));
      assert.equal(p.saved.length, boundary === 'save' ? 1 : 0);
    }
  });

  test('every answer is said plainly', () => {
    const offer = offerAt('undetermined');
    assert.equal(reminderAnswerLine('refused', offer), REMINDER_REFUSED);
    assert.match(reminderAnswerLine('on', offer), /6:00 pm/);
    assert.match(reminderAnswerLine('failed', offer), /Settings/);
  });
});

describe('the keepsake\'s words', () => {
  test('are warm, plain, and carry no guilt, no score and no em dash', () => {
    const offer = reminderOffer({ available: true, won: true, stored: null, permission: 'granted' })!;
    const lines = [
      ...Object.values(KEEPSAKE_COPY),
      reminderAnswerLine('on', offer),
      reminderAnswerLine('failed', offer),
    ];
    for (const line of lines) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries "${guiltIn(line)}"`);
      assert.doesNotMatch(line, /—|%|streak|score/i, `"${line}" scores the learner or carries an em dash`);
    }
    assert.deepEqual(
      [KEEPSAKE_COPY.lines, KEEPSAKE_COPY.kept, KEEPSAKE_COPY.sound],
      ['Your lines', 'One phrase kept', 'One sound'],
    );
  });
});
