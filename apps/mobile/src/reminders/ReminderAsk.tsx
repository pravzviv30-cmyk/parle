/**
 * The one reminder ask (come alive, README Part 5.C row 9 and Part 6
 * "Reminders": one shared `ReminderAsk`).
 *
 * A card that asks once whether the learner would like a daily nudge from
 * their tutor, at a time they can change, and does nothing until they tap. The
 * system's notification dialog is raised only inside the tap on "Remind me"
 * (F754): never on arrival, never from an effect. Granted, the reminder goes to
 * the existing scheduler (one a day at the chosen preset; Phase 4 replaces the
 * planner behind this card, so the interface stays three props), the `save`
 * sound and the `arrived()` haptic play once (README Part 5.A), and the answer
 * goes to `onDone`. Refused, or refused by the OS, the card says so in one calm
 * line and Continue answers. "Not now" answers at once and asks nothing.
 *
 * `onDone` is called exactly once, with `enabled: true` only after the OS took
 * the schedule, so a caller that records the answer never records a reminder
 * that does not exist. On the web there is no reminder to give, so there is no
 * card.
 *
 * It reads nothing about practice: like everything under `reminders/`, it
 * cannot see whether the learner practised (`reminder.test.ts`).
 *
 * The words are `REMINDER_ASK_COPY`, plain strings with `{tutor}` and `{time}`
 * slots; `ReminderAsk.test.ts` runs that block as written and holds every line
 * to the house rules, so keep it plain strings.
 */

import { useEffect, useRef, useState, type ReactElement } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { Choice, GhostButton, IconAction, PillButton, ROW_WORDS } from '../components.tsx';
import { IconTile } from '../icons/IconTile.tsx';
import { arrived } from '../motion/haptics.ts';
import { play as playSfx } from '../sound/sfx.ts';
import { paper, radius, space, type } from '../theme.ts';
import { REMINDER_REFUSED, REMINDER_TIMES, reminderTime, type ReminderTimeId } from './reminder.ts';
import { REMINDERS_AVAILABLE, askReminderPermission, scheduleReminder } from './schedule.ts';

/** What the learner decided. `enabled` only once the OS has taken the schedule. */
export type ReminderAnswer = { readonly enabled: true; readonly time: ReminderTimeId } | { readonly enabled: false };

export const REMINDER_ASK_COPY = {
  title: 'A daily nudge from {tutor}?',
  body: 'One a day at about {time}, and never on a day you have already practised.',
  changeTime: 'Change time',
  remindMe: 'Remind me at {time}',
  notNow: 'Not now',
  failed: 'The reminder could not be set this time. You can try again later.',
  continue: 'Continue',
} as const;

/** A line with its slots filled. */
function said(line: string, values: Readonly<Record<string, string>>): string {
  return line.replace(/\{(\w+)\}/g, (_match, key: string) => values[key] ?? '');
}

type Step = 'ask' | 'busy' | 'refused' | 'failed';

export function ReminderAsk({
  time,
  tutor,
  onDone,
}: {
  /** The time offered first: the learner's own choice, or the evening until there is history. */
  time: ReminderTimeId;
  /** The chosen tutor's name. */
  tutor: string;
  /** Called once, with what the learner decided. */
  onDone: (answer: ReminderAnswer) => void;
}): ReactElement | null {
  const [chosen, setChosen] = useState<ReminderTimeId>(time);
  const [changing, setChanging] = useState(false);
  const [step, setStep] = useState<Step>('ask');
  const answered = useRef(false);
  const asking = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  // VoiceOver has no live region, so the one line that says what happened is announced.
  useEffect(() => {
    if (step === 'refused') AccessibilityInfo.announceForAccessibility(REMINDER_REFUSED);
    if (step === 'failed') AccessibilityInfo.announceForAccessibility(REMINDER_ASK_COPY.failed);
  }, [step]);

  if (!REMINDERS_AVAILABLE) return null;

  const answer = (value: ReminderAnswer) => {
    if (answered.current) return;
    answered.current = true;
    onDone(value);
  };

  /** The learner's tap on "Remind me": the only place the system dialog is raised. */
  const remind = async () => {
    // A second tap before the first has redrawn asks nothing again.
    if (step !== 'ask' || answered.current || asking.current) return;
    asking.current = true;
    setStep('busy');
    const at = chosen;
    const permission = await askReminderPermission();
    if (permission !== 'granted') {
      if (alive.current) setStep('refused');
      return;
    }
    // Scheduled even if the card has gone meanwhile: the learner said yes and
    // the OS agreed, and the answer below tells the caller it is on.
    const outcome = await scheduleReminder(at);
    if (outcome !== 'done') {
      if (alive.current) setStep('failed');
      return;
    }
    playSfx('save');
    arrived();
    answer({ enabled: true, time: at });
  };

  const gloss = reminderTime(chosen).gloss;
  const settled = step === 'refused' || step === 'failed';
  const busy = step === 'busy';
  return (
    <View style={st.card}>
      <View style={st.head}>
        <IconTile name="bell" ground="sun" size={40} />
        <Text style={[type.heading, st.words]}>{said(REMINDER_ASK_COPY.title, { tutor })}</Text>
      </View>
      {settled ? (
        <Text accessibilityLiveRegion="polite" style={[type.body, st.ink]}>
          {step === 'refused' ? REMINDER_REFUSED : REMINDER_ASK_COPY.failed}
        </Text>
      ) : (
        <>
          <Text style={[type.body, st.ink]}>{said(REMINDER_ASK_COPY.body, { time: gloss })}</Text>
          <IconAction
            icon="clock"
            layout="inline"
            label={REMINDER_ASK_COPY.changeTime}
            selected={changing}
            disabled={busy}
            onPress={() => setChanging((open) => !open)}
          />
          {changing ? (
            <View accessibilityRole="radiogroup" style={st.times}>
              {REMINDER_TIMES.map((option) => (
                <Choice
                  key={option.value}
                  ground="card"
                  compact
                  title={option.label}
                  detail={option.gloss}
                  selected={chosen === option.value}
                  onPress={() => {
                    if (!busy) setChosen(option.value);
                  }}
                />
              ))}
            </View>
          ) : null}
        </>
      )}
      <View style={st.actions}>
        {settled ? (
          <PillButton label={REMINDER_ASK_COPY.continue} onPress={() => answer({ enabled: false })} />
        ) : (
          <>
            <PillButton label={said(REMINDER_ASK_COPY.remindMe, { time: gloss })} disabled={busy} onPress={() => void remind()} />
            <GhostButton label={REMINDER_ASK_COPY.notNow} disabled={busy} onPress={() => answer({ enabled: false })} />
          </>
        )}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: paper.card, borderRadius: radius.card, padding: space(5), gap: space(3) },
  head: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  words: { ...ROW_WORDS, color: paper.ink },
  ink: { color: paper.ink },
  times: { gap: space(2) },
  actions: { gap: space(1), paddingTop: space(1) },
});
