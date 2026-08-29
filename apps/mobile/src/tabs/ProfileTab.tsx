/**
 * Profile — who you are, what the app knows, and the ways out.
 *
 * Structure follows the reference screenshots: an ACCOUNT group, a SUPPORT
 * group, sign out, then a legal footer. The visual translation is the whole
 * job — the reference is a dark sheet of full-bleed rows, and this world is
 * pale paper with white cards and hairline rules, so the groups become Cards
 * and the section heads become the one place caps live in this system.
 *
 * A real Delete account is wired through the authenticated token server. The
 * database rows cascade from auth.users and the app clears the device scope
 * before signing out, so the row now means exactly what it says.
 *
 * ## The daily reminder decides nothing here
 *
 * The reminder group is the one place on this screen that draws a state the
 * operating system owns, and every judgement about it lives in
 * `reminders/reminder.ts`. This file asks `reminderRow` what to draw, asks it
 * again against a freshly read permission before it writes anything down, and
 * shows the sentence it is handed. There is no conditional here about what
 * granted, denied or undetermined mean, and there must not be: a permission was
 * revoked in Settings a month ago and the only way this screen finds out is by
 * asking on the way in. A row that trusted the stored flag would be a switch
 * sitting proudly on over a channel that has been shut since April.
 *
 * The same idea decides what goes on disk when the OS refuses a change. The
 * store must record what the phone will actually do, so a `failed` from
 * `scheduleReminder` puts the previous value back rather than leaving
 * `enabled: true` over a notification that was never scheduled. Permission gets
 * to be reconciled on the next focus because it can be re-read; whether
 * something is scheduled cannot be, so a wrong value written here is wrong
 * forever and no later render could repair it.
 */

import { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Switch } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { accent, paper, signal, space, type, radius, HAIRLINE, HIT } from '../theme.ts';
import { Card, Label, OptionCard, OutlineButton, Field } from '../components.tsx';
import { OnboardClock } from '../illustrations.tsx';
import { SettingsRow } from '../settings/SettingsRow.tsx';
import { Acknowledgements } from '../legal/Acknowledgements.tsx';
import { useAuth } from '../auth/useAuth.tsx';
import { useProfile } from '../app/ProfileContext.tsx';
import { TutorIntro } from '../tutor/TutorIntro.tsx';
import { TUTOR_INTRO_LINK } from '../tutor/gate.ts';
import { withDailyGoal } from '../profile/store.ts';
import {
  STRICTNESS_OPTIONS,
  STRICTNESS_ROW,
  STRICTNESS_SUB,
  STRICTNESS_TITLE,
  strictnessLabel,
  strictnessOf,
  withStrictness,
} from '../tutor/strictness.ts';
import {
  REMINDER_ROW,
  REMINDER_TIMES,
  REMINDER_TIME_SUB,
  REMINDER_TIME_TITLE,
  reminderRow,
  reminderTime,
  type ReminderPermission,
  type ReminderTimeId,
  type StoredReminder,
} from '../reminders/reminder.ts';
import { loadReminder, saveReminder } from '../reminders/store.ts';
import {
  REMINDERS_AVAILABLE,
  askReminderPermission,
  cancelReminder,
  reminderPermission,
  scheduleReminder,
} from '../reminders/schedule.ts';
import type { AuthResult } from '../auth/types.ts';

/**
 * How much a day, asked here instead of on the way to a first conversation.
 *
 * It was the fourth onboarding page, which put a preference between a new
 * account and the first French sentence. Nothing in the app reads it yet, so
 * asking it before any value had been delivered was pure friction.
 */
const GOALS = [
  { minutes: 5, label: 'Five minutes', gloss: 'A gentle start' },
  { minutes: 10, label: 'Ten minutes', gloss: 'The steady middle' },
  { minutes: 15, label: 'Fifteen minutes', gloss: 'Serious momentum' },
] as const;

type Sheet =
  | 'none'
  | 'name'
  | 'goal'
  | 'strictness'
  | 'reminderTime'
  | 'intro'
  | 'acknowledgements'
  | 'delete'
  | 'unavailable';

/**
 * Said when the disk refuses a two-field write, and only then.
 *
 * `saveReminder` answers `failed` on a full phone. A row that moved anyway
 * would be a switch that reverts silently at the next launch, so the row stays
 * where it was and this says why. It blames the device, which is what actually
 * happened, and it asks for nothing: no retry loop, no apology, no number. The
 * one sentence on this screen that reminder.ts does not own, because it is
 * about this phone rather than about the reminder.
 */
const REMINDER_SAVE_TROUBLE = 'Your phone did not save that. The reminder is unchanged, and you can try again.';

/**
 * Said when the write landed and the operating system would not take the alarm.
 *
 * A different fact from the one above, so a different sentence. The choice did
 * reach the disk; what refused was `scheduleReminder`, and telling somebody
 * their phone "did not save that" when it saved it perfectly well is a small
 * lie in the one place this screen has to be trusted.
 *
 * Three things it has to do. It puts the refusal on the phone, because that is
 * where it happened and the learner did nothing wrong. It leaves a way forward,
 * which here is simply flipping the switch again, and "just now" says the state
 * is a moment rather than a verdict. And it is silent about what is on disk,
 * because the rollback below can itself be refused by the same full phone, and
 * a sentence that claimed "nothing has changed" would be the second lie.
 *
 * Deliberately direction-neutral. It is shown when the OS refuses to schedule
 * and when it refuses to cancel, and a learner who was turning the reminder off
 * must not read a line about setting one. "Change" covers both, so nothing here
 * branches on which way the switch was going.
 */
const REMINDER_SCHEDULE_TROUBLE = 'Your phone would not change the reminder just now. You can try again.';

export function ProfileTab({
  onSignOut,
  onResetProgress,
  onDeleteAccount,
}: {
  onSignOut: () => void;
  onResetProgress: () => void;
  onDeleteAccount: (reauthentication?: string) => Promise<AuthResult>;
}) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { profile, update } = useProfile();
  const [sheet, setSheet] = useState<Sheet>('none');
  const [draftName, setDraftName] = useState(profile.name ?? '');
  const [armed, setArmed] = useState(false);
  const [unavailable, setUnavailable] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');

  // Null until the first read comes back, because a guess would flash the wrong
  // sentence: defaulting to denied would show "notifications are turned off"
  // for a frame to somebody who has never been asked.
  const [stored, setStored] = useState<StoredReminder | null>(null);
  const [permission, setPermission] = useState<ReminderPermission | null>(null);
  const [reminderBusy, setReminderBusy] = useState(false);
  // The line to show, rather than a flag, because there are two of them and
  // which one is shown is the whole of what this state says.
  const [reminderTrouble, setReminderTrouble] = useState<string | null>(null);

  /**
   * Both halves of the row, read again every time this tab comes forward.
   *
   * On focus rather than on mount, and that is the whole defence against a dead
   * switch. Notification permission is per install and can be turned off in
   * Settings months later without the app hearing a word about it, so a value
   * captured once at launch is a value that goes stale and takes the row with
   * it. It also means the walk back from Settings is enough: the learner turns
   * notifications on there, returns, and the row already knows.
   *
   * `loadReminder` throws rather than resolving when nobody is signed in, the
   * way `loadTopics` does. Behind the auth gate that cannot happen, but a
   * sign-out can land between focus and read, so the throw is caught and the
   * row simply does not draw rather than taking the screen down with it.
   */
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const [saved, allowed] = await Promise.all([loadReminder(), reminderPermission()]);
        if (cancelled) return;
        setStored(saved);
        setPermission(allowed);
      })().catch(() => {
        // Nobody signed in, or storage unavailable. Nothing to draw and nothing
        // to say: the reminder is the one thing on this screen that can wait.
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const firstName = (profile.name ?? '').split(' ')[0] || 'you';
  // Only an email sign-up has a password to change; Google and the device-local
  // demo account have nothing this screen could edit.
  const hasPassword = user?.provider === 'password';

  // What the learner asked for, crossed with what the OS will allow. Every
  // judgement in it belongs to reminder.ts; nothing below re-decides any of it.
  const row = permission === null ? null : reminderRow(stored, permission);
  // The preset behind the row. `reminderTime` repairs a mangled or missing id
  // to the default, so there is no second opinion here about which hour is
  // which, and no throw on a byte that came back wrong from disk.
  const chosen = reminderTime(stored?.time);

  /**
   * The switch, which asks the OS before it believes the learner's thumb.
   *
   * One shape for all four states, because the module already told us which one
   * we are in. `row.asks` is true in exactly the state where a dialog belongs;
   * everywhere else this is a plain re-read that raises nothing, which is how a
   * permission changed in Settings reaches the row without anybody being asked
   * twice. iOS will not show that dialog a second time anyway, so a re-ask
   * would be a control that silently does nothing.
   *
   * Then `reminderRow` decides again, against the answer that just came back.
   * A refusal turns what the learner asked for into an off row and an honest
   * line, and the value that goes to disk is that answer rather than the
   * position the switch was left in. Turning off keeps the chosen preset, so
   * turning it back on months later restores the part of the day they picked.
   */
  const toggleReminder = (next: boolean) => {
    if (row === null || reminderBusy) return;
    setReminderBusy(true);
    setReminderTrouble(null);
    void (row.asks ? askReminderPermission() : reminderPermission())
      .then(async (fresh) => {
        setPermission(fresh);
        const honest = reminderRow({ enabled: next, time: chosen.value }, fresh);
        const wanted: StoredReminder = { enabled: honest.on, time: chosen.value };
        // What the phone is doing already, in the shape the store writes. Built
        // from `row.on`, which is reminderRow's answer for the state the row is
        // in, so putting the disk back is the module's value and never a
        // negation worked out here.
        const reverted: StoredReminder = { enabled: row.on, time: chosen.value };
        const ack = await saveReminder(wanted);
        if (ack === 'failed') {
          setReminderTrouble(REMINDER_SAVE_TROUBLE);
          return;
        }
        const outcome = honest.on ? await scheduleReminder(wanted.time) : await cancelReminder();
        if (outcome === 'failed') {
          await saveReminder(reverted);
          setReminderTrouble(REMINDER_SCHEDULE_TROUBLE);
          return;
        }
        setStored(wanted);
      })
      // The platform pair catches its own failures and answers in a word, so
      // the only way here is a sign-out landing between the tap and the write,
      // where `saveReminder` throws the way `loadTopics` does. The row stays
      // where it was and says so: a flip that changed nothing and explained
      // nothing is the dead switch this whole entry exists to prevent.
      .catch(() => setReminderTrouble(REMINDER_SAVE_TROUBLE))
      .finally(() => setReminderBusy(false));
  };

  /**
   * A different part of the day, through the same door as the switch.
   *
   * Reached only from an on row, so the intent is `enabled: true`, and it still
   * goes through `reminderRow` against a freshly read permission: a learner can
   * revoke notifications and come back to this sheet in the same minute. The
   * read raises no dialog, which keeps the no-re-ask rule intact.
   */
  const chooseReminderTime = (value: ReminderTimeId) => {
    setSheet('none');
    if (row === null) return;
    setReminderTrouble(null);
    void (async () => {
      const fresh = await reminderPermission();
      setPermission(fresh);
      const honest = reminderRow({ enabled: true, time: value }, fresh);
      const wanted: StoredReminder = { enabled: honest.on, time: value };
      const reverted: StoredReminder = { enabled: row.on, time: chosen.value };
      const ack = await saveReminder(wanted);
      if (ack === 'failed') {
        setReminderTrouble(REMINDER_SAVE_TROUBLE);
        return;
      }
      const outcome = honest.on ? await scheduleReminder(wanted.time) : await cancelReminder();
      if (outcome === 'failed') {
        await saveReminder(reverted);
        setReminderTrouble(REMINDER_SCHEDULE_TROUBLE);
        return;
      }
      setStored(wanted);
    })().catch(() => setReminderTrouble(REMINDER_SAVE_TROUBLE));
  };

  if (sheet === 'acknowledgements') return <Acknowledgements onBack={() => setSheet('none')} />;

  // Demoted, not deleted: the intro is still the only place that teaches what
  // the three colours of the circle mean, and it is one tap from here.
  if (sheet === 'intro') return <TutorIntro onDone={() => setSheet('none')} />;

  if (sheet === 'delete') {
    return (
      <View style={[st.root, { paddingTop: insets.top + space(6) }]}>
        <Text style={[type.display, { color: paper.ink }]}>Delete your account?</Text>
        <Text style={[type.body, { color: paper.inkSoft, marginTop: space(3) }]}>
          This permanently removes your sign-in, conversations turned into practice, progress, and remaining minutes. It cannot be undone.
        </Text>
        {hasPassword && (
          <View style={{ marginTop: space(5) }}>
            <Field
              label="Confirm with your password"
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder="Your password"
              secure
              autoComplete="current-password"
            />
          </View>
        )}
        {user?.provider === 'google' && (
          <Text style={[type.body, { color: paper.inkSoft, marginTop: space(4) }]}>
            Google will ask you to sign in again before anything is deleted.
          </Text>
        )}
        {deleteError && <Text style={[type.bodyStrong, { color: signal.correspondance, marginTop: space(4) }]}>{deleteError}</Text>}
        <View style={{ marginTop: space(7), gap: space(3) }}>
          <OutlineButton
            label={deleting ? 'Verifying…' : 'Verify and delete permanently'}
            disabled={deleting || (hasPassword && deletePassword.length === 0)}
            onPress={() => {
              if (deleting) return;
              setDeleting(true);
              setDeleteError(null);
              void onDeleteAccount(hasPassword ? deletePassword : undefined).then((result) => {
                if (!result.ok) {
                  setDeleteError(result.message);
                  setDeleting(false);
                }
              });
            }}
          />
          <OutlineButton
            label="Keep my account"
            disabled={deleting}
            onPress={() => {
              setDeletePassword('');
              setSheet('none');
            }}
          />
        </View>
      </View>
    );
  }

  if (sheet === 'goal') {
    return (
      <View style={[st.root, { paddingTop: insets.top + space(6) }]}>
        <View style={{ alignItems: 'center', marginBottom: space(5) }}>
          <OnboardClock width={150} />
        </View>
        <Text style={[type.display, { color: paper.ink }]}>How much time each day?</Text>
        <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>
          Small and daily beats big and rare. Change it whenever you like.
        </Text>
        <View style={{ marginTop: space(6), gap: space(3) }}>
          {GOALS.map((g) => (
            <OptionCard
              key={g.minutes}
              text={g.label}
              gloss={g.gloss}
              selected={profile.dailyGoalMin === g.minutes}
              onPress={() => {
                update(withDailyGoal(profile, g.minutes));
                setSheet('none');
              }}
            />
          ))}
        </View>
        <View style={{ marginTop: space(6) }}>
          <OutlineButton label="Cancel" onPress={() => setSheet('none')} />
        </View>
      </View>
    );
  }

  /**
   * How much the tutor corrects, which the learner has never been able to say.
   *
   * The three policies have been in the brain since the engine was written and
   * the eval measures all three, but the field was overwritten by every session
   * that finished, so it was a log rather than a preference and nothing offered
   * it. Same shape as the goal sheet, because it is the same kind of question:
   * three options, one tap, and nothing to fail.
   */
  if (sheet === 'strictness') {
    return (
      <View style={[st.root, { paddingTop: insets.top + space(6) }]}>
        <Text style={[type.display, { color: paper.ink }]}>{STRICTNESS_TITLE}</Text>
        <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>{STRICTNESS_SUB}</Text>
        <View style={{ marginTop: space(6), gap: space(3) }}>
          {STRICTNESS_OPTIONS.map((option) => (
            <OptionCard
              key={option.value}
              text={option.label}
              gloss={option.gloss}
              selected={strictnessOf(profile) === option.value}
              onPress={() => {
                update(withStrictness(profile, option.value));
                setSheet('none');
              }}
            />
          ))}
        </View>
        <View style={{ marginTop: space(6) }}>
          <OutlineButton label="Cancel" onPress={() => setSheet('none')} />
        </View>
      </View>
    );
  }

  /**
   * Which part of the day, not which minute.
   *
   * Four presets in the shape the goal and strictness sheets already use. A
   * real picker would mean a second native dependency to answer a question
   * nobody is asking: the interesting choice is morning or evening, and a
   * preset at 18:07 is a time picker that has been hidden rather than removed.
   */
  if (sheet === 'reminderTime') {
    return (
      <View style={[st.root, { paddingTop: insets.top + space(6) }]}>
        <Text style={[type.display, { color: paper.ink }]}>{REMINDER_TIME_TITLE}</Text>
        <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>{REMINDER_TIME_SUB}</Text>
        <View style={{ marginTop: space(6), gap: space(3) }}>
          {REMINDER_TIMES.map((option) => (
            <OptionCard
              key={option.value}
              text={option.label}
              gloss={option.gloss}
              selected={chosen.value === option.value}
              onPress={() => chooseReminderTime(option.value)}
            />
          ))}
        </View>
        <View style={{ marginTop: space(6) }}>
          <OutlineButton label="Cancel" onPress={() => setSheet('none')} />
        </View>
      </View>
    );
  }

  if (sheet === 'name') {
    return (
      <View style={[st.root, { paddingTop: insets.top + space(6) }]}>
        <Text style={[type.display, { color: paper.ink }]}>Your name</Text>
        <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>
          What your tutor calls you at the start of a session.
        </Text>
        <View style={{ marginTop: space(6) }}>
          <Field label="Your name" value={draftName} onChangeText={setDraftName} placeholder="Your name" />
        </View>
        <View style={{ marginTop: space(6), gap: space(3) }}>
          <OutlineButton
            label="Save"
            onPress={() => {
              const next = draftName.trim();
              if (next.length > 0) update({ ...profile, name: next });
              setSheet('none');
            }}
          />
          <OutlineButton label="Cancel" onPress={() => { setDraftName(profile.name ?? ''); setSheet('none'); }} />
        </View>
      </View>
    );
  }

  return (
    <View style={[st.root, { paddingTop: insets.top + space(4) }]}>
      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
        <View style={st.identity}>
          <View style={st.ring}>
            <Text style={[type.title, { color: paper.ink }]}>{firstName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={[type.title, { color: paper.ink, marginTop: space(3) }]}>{profile.name ?? 'You'}</Text>
        </View>

        <Label>Account</Label>
        <Card style={{ marginTop: space(2.5) }}>
          <SettingsRow first label="Name" value={profile.name ?? 'Not set'} onPress={() => setSheet('name')} />
          <SettingsRow
            label="Daily goal"
            value={profile.dailyGoalMin === null ? 'Not set' : `${profile.dailyGoalMin} minutes a day`}
            onPress={() => setSheet('goal')}
          />
          <SettingsRow label={STRICTNESS_ROW} value={strictnessLabel(profile)} onPress={() => setSheet('strictness')} />
          <SettingsRow label="Email" value={user?.email ?? 'Signed in'} />
          {hasPassword && (
            <SettingsRow
              label="Password"
              value="Change it"
              onPress={() => {
                setUnavailable('Changing your password needs the account server, which is not running yet.');
                setSheet('unavailable');
              }}
            />
          )}
          {user?.provider === 'google' && <SettingsRow label="Signed in with" value="Google" />}
          {user?.provider === 'mock' && <SettingsRow label="Account" value="Demo, stored on this device only" />}
          <SettingsRow
            label="Delete account"
            destructive
            onPress={() => setSheet('delete')}
          />
        </Card>

        {/* The reminder. Its own group, because the sentence above the switch
            needs a heading to be about something, and because the whole block
            is absent on a build with no scheduler rather than sitting there
            disabled. `REMINDERS_AVAILABLE` is the platform pair saying so; the
            refusal line names phone settings and would be a lie on a laptop. */}
        {REMINDERS_AVAILABLE && row !== null && (
          <View style={{ marginTop: space(6) }}>
            <Label>{REMINDER_ROW}</Label>
            <Card style={{ marginTop: space(2.5) }}>
              {row.note.length > 0 && (
                <Text style={[type.small, { color: paper.inkSoft, marginBottom: space(3) }]}>{row.note}</Text>
              )}
              {reminderTrouble !== null && (
                <Text style={[type.small, { color: signal.correspondance, marginBottom: space(3) }]}>
                  {reminderTrouble}
                </Text>
              )}
              <View style={st.switchRow}>
                {/* Ink, not the faint tertiary the settings rows use for a
                    value. This is the only place the row states what will
                    happen, so it is words and clears the 4.5 words are held to
                    rather than the 3 a mark gets. */}
                <Text style={[type.bodyStrong, { color: paper.ink, flex: 1 }]}>{row.value}</Text>
                <Switch
                  value={row.on}
                  onValueChange={toggleReminder}
                  disabled={reminderBusy}
                  accessibilityLabel={REMINDER_ROW}
                  trackColor={{ true: accent.primary, false: paper.groundDeep }}
                  thumbColor={paper.card}
                />
              </View>
              {row.on && <SettingsRow label={REMINDER_TIME_TITLE} onPress={() => setSheet('reminderTime')} />}
            </Card>
          </View>
        )}

        <View style={{ marginTop: space(6) }}>
          <Label>Support</Label>
          <Card style={{ marginTop: space(2.5) }}>
            <SettingsRow first label={TUTOR_INTRO_LINK} onPress={() => setSheet('intro')} />
            <SettingsRow
              label="Help"
              onPress={() => {
                setUnavailable('There is no help centre yet. When there is, this is where it will be.');
                setSheet('unavailable');
              }}
            />
            <SettingsRow
              label="Send feedback"
              onPress={() => {
                setUnavailable('Feedback needs somewhere to go. Add an address and this will send there.');
                setSheet('unavailable');
              }}
            />
          </Card>
        </View>

        <View style={{ marginTop: space(6) }}>
          <OutlineButton label="Sign out" onPress={onSignOut} />
        </View>

        <Pressable
          onPress={() => {
            if (!armed) {
              setArmed(true);
              return;
            }
            onResetProgress();
          }}
          accessibilityRole="button"
          accessibilityLabel={armed ? 'Press again to erase progress' : 'Reset progress'}
          style={({ pressed }) => [st.reset, armed && st.resetArmed, pressed && { opacity: 0.7 }]}
        >
          <Text style={[type.bodyStrong, { color: armed ? paper.onInk : signal.correspondance }]}>
            {armed ? 'Press again to erase everything' : 'Reset progress'}
          </Text>
          {!armed && (
            <Text style={[type.small, { color: paper.inkFaint, marginTop: space(0.5) }]}>
              Erases lessons, phrases and the tutor's memory of you.
            </Text>
          )}
        </Pressable>

        {/* The legal footer. Terms and a privacy policy are content someone has
            to write and have reviewed; the app has neither, and inventing them
            would be worse than their absence. Acknowledgements is real today. */}
        <View style={st.legal}>
          <Pressable
            onPress={() => setSheet('acknowledgements')}
            accessibilityRole="button"
            style={({ pressed }) => [st.legalItem, pressed && { opacity: 0.6 }]}
          >
            <Text style={[type.label, { color: paper.inkSoft }]}>Acknowledgements</Text>
          </Pressable>
          <Text style={[type.small, { color: paper.inkFaint, marginTop: space(3) }]}>
            Terms and a privacy policy are not written yet. Parle records your email, your name, and that you said you are
            old enough, then sends what you say to speech and language services so the tutor can answer. If you joined
            when Parle asked for a date of birth, that date is still on file and is still yours. Nothing is shared with
            anyone else.
          </Text>
        </View>

        {sheet === 'unavailable' && (
          <Card style={{ marginTop: space(5) }}>
            <Text style={[type.bodyStrong, { color: paper.ink }]}>{unavailable}</Text>
            <View style={{ marginTop: space(3) }}>
              <OutlineButton label="Close" onPress={() => setSheet('none')} />
            </View>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: paper.ground, paddingHorizontal: space(5) },
  scroll: { flexGrow: 1, paddingTop: space(4), paddingBottom: space(6) },
  identity: { alignItems: 'center', marginBottom: space(6) },
  ring: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reset: {
    minHeight: HIT,
    marginTop: space(3),
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space(2),
    paddingHorizontal: space(4),
    borderRadius: radius.pill,
    borderWidth: HAIRLINE,
    borderColor: 'transparent',
  },
  // The switch keeps the 44pt floor the settings rows keep, so the control is
  // the same size to a thumb as everything above it.
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: HIT },
  resetArmed: { backgroundColor: signal.correspondance },
  legal: { marginTop: space(8), alignItems: 'center' },
  legalItem: { minHeight: HIT, justifyContent: 'center' },
});
