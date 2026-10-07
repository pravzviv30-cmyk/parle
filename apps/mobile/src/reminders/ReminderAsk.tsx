/**
 * The one reminder ask (come alive, README Part 5.C row 9 and Part 6
 * "Reminders": one shared `ReminderAsk`).
 *
 * A card that asks once whether the learner would like a daily nudge from
 * their tutor, at a time they can change, and does nothing until they tap. The
 * system's notification dialog is raised only inside the tap on "Remind me"
 * (F754): never on arrival, never from an effect. Granted, the reminder goes to
 * the one planner (`ReminderPlanner.tsx` `turnOnReminder`, Phase 4): one a day
 * at the chosen time, skipped on a day already practised, guest finish days
 * included, naming the tutor this card names. Then the `save` sound and the
 * `arrived()` haptic play once (README Part 5.A), and the answer goes to
 * `onDone`. Refused, or refused by the OS, the card says so in one calm line
 * and Continue answers. "Not now" answers at once and asks nothing.
 *
 * Offered `smart` (the recap, for a learner with no time chosen), the card
 * offers the learner's own rhythm first and the four presets under Change
 * time; offered a preset (the first run, whose draft keeps presets), only the
 * presets.
 *
 * When tapping Remind me will raise the phone's dialog, the card says so in
 * one line first (retention-paywall.md section 4.6), because a dialog that
 * arrives unannounced is one most people decline and iOS never shows twice.
 * The recap passes what it has already read (`asks`); a caller that has not
 * read it leaves it out and the card reads it itself, which raises nothing.
 *
 * `onDone` is called exactly once, with `enabled: true` only after the OS took
 * the schedule, so a caller that records the answer never records a reminder
 * that does not exist. On the web there is no reminder to give, so there is no
 * card.
 *
 * It reads nothing about practice itself: the planner does, and this card asks
 * it only for the smart time to show (`reminder.test.ts` holds the boundary).
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
import { REMINDER_REFUSED, REMINDER_SMART_LABEL, REMINDER_TIMES, SMART_FALLBACK, clockGloss, reminderTime, smartGloss, type ClockTime, type ReminderMode, type ReminderTimeId } from './reminder.ts';
import { smartReminderTime, turnOnReminder } from './ReminderPlanner.tsx';
import { REMINDERS_AVAILABLE, askReminderPermission, reminderPermission } from './schedule.ts';

/**
 * What the learner decided. `enabled` only once the OS has taken the plan. A
 * card offered a preset answers a preset; one offered `smart` may answer either.
 */
export type ReminderAnswer<T extends ReminderMode = ReminderTimeId> = { readonly enabled: true; readonly time: T } | { readonly enabled: false };

export const REMINDER_ASK_COPY = {
  title: 'A daily nudge from {tutor}?',
  body: 'One a day at about {time}, and never on a day you have already practised.',
  asks: 'Your phone will ask to allow notifications.',
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

export function ReminderAsk<T extends ReminderMode>({
  time,
  tutor,
  asks,
  onDone,
}: {
  /** The time offered first: the learner's own choice, or their own rhythm (`smart`). */
  time: T;
  /** The chosen tutor's name, which the reminders will name too. */
  tutor: string;
  /** Whether Remind me will raise the phone's dialog, when the caller has read it; the card reads it otherwise. */
  asks?: boolean;
  /** Called once, with what the learner decided. */
  onDone: (answer: ReminderAnswer<T | ReminderTimeId>) => void;
}): ReactElement | null {
  const [chosen, setChosen] = useState<T | ReminderTimeId>(time);
  // The smart time to show, read once; the evening until the rhythm shows.
  const [smart, setSmart] = useState<ClockTime | null>(null);
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
  // A read, never a dialog: the time the smart option would use today.
  useEffect(() => {
    if (time !== 'smart') return;
    let live = true;
    void smartReminderTime()
      .then((value) => {
        if (live) setSmart(value);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [time]);
  // A read, never a dialog: whether Remind me will raise one, when the caller did not say.
  const [undecided, setUndecided] = useState(false);
  useEffect(() => {
    if (asks !== undefined) return;
    let live = true;
    void reminderPermission()
      .then((permission) => {
        if (live) setUndecided(permission === 'undetermined');
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [asks]);
  // VoiceOver has no live region, so the one line that says what happened is announced.
  useEffect(() => {
    if (step === 'refused') AccessibilityInfo.announceForAccessibility(REMINDER_REFUSED);
    if (step === 'failed') AccessibilityInfo.announceForAccessibility(REMINDER_ASK_COPY.failed);
  }, [step]);

  if (!REMINDERS_AVAILABLE) return null;

  const answer = (value: ReminderAnswer<T | ReminderTimeId>) => {
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
    // Planned even if the card has gone meanwhile: the learner said yes and
    // the OS agreed, and the answer below tells the caller it is on. The plan
    // names the tutor this card named.
    const outcome = await turnOnReminder(at, tutor);
    if (outcome !== 'done') {
      if (alive.current) setStep('failed');
      return;
    }
    playSfx('save');
    arrived();
    answer({ enabled: true, time: at });
  };

  const gloss = chosen === 'smart' ? clockGloss(smart ?? SMART_FALLBACK) : reminderTime(chosen).gloss;
  const settled = step === 'refused' || step === 'failed';
  const dialogComing = asks ?? undecided;
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
          {dialogComing ? <Text style={[type.small, st.soft]}>{REMINDER_ASK_COPY.asks}</Text> : null}
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
              {time === 'smart' ? (
                <Choice
                  ground="card"
                  compact
                  title={REMINDER_SMART_LABEL}
                  detail={smartGloss(smart)}
                  selected={chosen === 'smart'}
                  onPress={() => {
                    if (!busy) setChosen(time);
                  }}
                />
              ) : null}
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
  soft: { color: paper.inkSoft },
  times: { gap: space(2) },
  actions: { gap: space(1), paddingTop: space(1) },
});
