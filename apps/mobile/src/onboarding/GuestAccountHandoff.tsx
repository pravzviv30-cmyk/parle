import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { phraseKeyOf, starterTasks } from '@luvani/core';
import { useAuth } from '../auth/useAuth.tsx';
import { useProfile } from '../app/ProfileContext.tsx';
import { Card, GhostButton, PillButton } from '../components.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { paper, type } from '../theme.ts';
import { addPhrases } from '../review/store.ts';
import { activeUserId, scopeGeneration, userKey, writeInUserScope } from '../storage/scope.ts';
import {
  adoptGuestUsage,
  clearGuestPractice,
  loadGuestPractice,
  type GuestPractice,
} from './guestPractice.ts';
import type { PreAccountOnboardingDraft } from './preAccountDraft.ts';
import { settleGuestHandoff } from '../game/guestHandoff.ts';
import { celebrationKey, publishCelebrations } from '../celebrate/events.ts';
import { fetchBillingStatus } from '../purchases/client.ts';
import type { BillingStatus } from '../purchases/billingStatus.ts';
import { keptPhrase, starterMinutes } from './guestProgress.ts';
import { tutorTimeLine } from './firstRun/copy.ts';
/**
 * The account keeps its own profile. Explicit adoption adds practice, never silently overwrites it.
 *
 * Come alive (README Part 5.C row 11): Keep this practice saves the natural
 * line (F757), says "Saved to your phrasebook." once the phrasebook write is
 * durable, settles the guest's finished days into the account's streak (F744),
 * and then says how much time with the tutor the server holds for this
 * account. `onDone(kept)` tells the app whether the practice was kept, which is
 * what opens the first-run offer once (App.tsx).
 */
export function GuestAccountHandoff({
  draft,
  onDone,
  children,
}: {
  draft: PreAccountOnboardingDraft | null;
  /** Called once the hand-off is over: true when the practice was kept, false for Start fresh. */
  onDone: (kept: boolean) => void;
  children: React.ReactNode;
}) {
  const { user, adapter } = useAuth();
  const [guest, setGuest] = useState<GuestPractice | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState<number | null>(null);
  // The server's answer about the account, read once the practice is saved.
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let active = true;
    void loadGuestPractice().then((value) => {
      if (active) setGuest(value);
    });
    return () => {
      active = false;
    };
  }, []);
  if (guest === null) return <>{children}</>;
  if (guest === undefined) return <View />;
  const keep = async () => {
    if (!user || busy) return;
    setBusy(true);
    setError('');
    const owner = scopeGeneration();
    const uid = user.id;
    try {
      const balance = await adoptGuestUsage(guest, uid);
      if (owner !== scopeGeneration() || activeUserId() !== uid) return;
      const tasks = starterTasks(
        guest.plan.reason,
        guest.plan.drink ?? 'coffee',
        starterMinutes(guest.plan.minutes),
      );
      const phrases = guest.attempts
        .filter(
          (a, index) =>
            a.feedback.accepted ||
            a.kept === true ||
            (guest.kept && index === guest.attempts.length - 1),
        )
        .map((a) => {
          const task = tasks.find((t) => t.id === a.taskId);
          // The natural line, never the learner's unchecked spelling (F757).
          return task
            ? {
                fr: keptPhrase(task),
                frWritten: null,
                en: task.meaning,
                enLiteral: null,
                register: 'courant' as const,
                note: null,
              }
            : null;
        })
        .filter(
          (
            p,
          ): p is {
            fr: string;
            frWritten: null;
            en: string;
            enLiteral: null;
            register: 'courant';
            note: null;
          } => p !== null,
        );
      if ((await addPhrases(phrases)) !== 'durable')
        throw new Error('Your phrase could not be saved. Try again.');
      // Said only now that the phrasebook write is durable: one toast for the
      // phrase kept last, keyed by the stored phrase, never the learner's text.
      const newest = phrases[phrases.length - 1];
      if (newest !== undefined && owner === scopeGeneration()) {
        const phraseKey = phraseKeyOf(newest.fr);
        publishCelebrations([{ type: 'phrase-saved', key: celebrationKey.saved(phraseKey), origin: 'account', at: Date.now(), data: { phraseKey } }]);
      }
      const key = userKey('onboarding-practice');
      if (
        !(await writeInUserScope(owner, () =>
          AsyncStorage.setItem(key, JSON.stringify({ ...guest, token: null, completed: true })),
        ))
      )
        throw new Error('Your practice could not be saved.');
      // The guest's finished days become the account's, once, and day one
      // never lights a second time (F744). Nothing to record is not a failure.
      if ((await settleGuestHandoff(guest)).ack !== 'durable') throw new Error('Your practice could not be saved.');
      setRemaining(balance);
      setSaved(true);
      // Free or on a plan: the server says, after the claim above has spent the
      // guest's seconds. Read in the background, so nothing waits on it; until
      // it answers, and if it cannot, the claim's own balance is said plainly.
      void fetchBillingStatus(uid).then((answer) => {
        if (owner === scopeGeneration() && activeUserId() === uid) setStatus(answer);
      });
    } catch (cause) {
      if (owner === scopeGeneration())
        setError(cause instanceof Error ? cause.message : 'Your practice could not be linked yet.');
    } finally {
      if (owner === scopeGeneration()) setBusy(false);
    }
  };
  const finish = async () => {
    if (!user || busy) return;
    const owner = scopeGeneration();
    setBusy(true);
    setError('');
    try {
      // The usage transfer is required even when the learner declines to import
      // their phrase. Declining an import cannot reset a one-time allowance.
      if (!saved) await adoptGuestUsage(guest, user.id);
      if (owner !== scopeGeneration()) return;
      await clearGuestPractice();
      setGuest(null);
      onDone(saved);
    } catch {
      if (owner === scopeGeneration())
        setError('Your minutes could not be checked. Try again. Your practice is still here.');
    } finally {
      if (owner === scopeGeneration()) setBusy(false);
    }
  };
  // The time with the tutor, once saved: free on the free allowance (and on a
  // lapsed plan, which the server holds as that), on a plan otherwise, and in
  // plain minutes when only the claim's balance is known.
  const timeLine = !saved
    ? null
    : status !== null
      ? tutorTimeLine(status.secondsRemaining, status.plan === 'trial' || status.lapsed)
      : remaining !== null
        ? tutorTimeLine(remaining, null)
        : null;
  return (
    <ScrollScreen
      header={<ScreenHeader title={saved ? 'Your phrase is saved.' : 'Keep this practice?'} />}
      footer={
        <PillButton
          label={saved ? 'Continue' : busy ? 'Saving…' : 'Keep this practice'}
          disabled={busy}
          onPress={() => {
            void (saved ? finish() : keep());
          }}
        />
      }
    >
      <Text style={type.body}>Signed in as {user?.email ?? 'your account'}.</Text>
      <Card style={{ marginTop: 20, gap: 16 }}>
        <Text style={type.heading}>{guest.attempts.at(-1)?.feedback.model ?? 'Your starting plan'}</Text>
        <Text style={type.body}>
          {saved
            ? 'Your phrase is in Practice. Your account can sync it to another device.'
            : 'Keep the phrase from this phone. Your account’s existing learning and preferences stay yours.'}
        </Text>
        {timeLine !== null && <Text style={type.bodyStrong}>{timeLine}</Text>}
      </Card>
      {!saved && (
        <GhostButton
          label="Start fresh"
          disabled={busy}
          onPress={() => {
            void finish();
          }}
        />
      )}
      <GhostButton
        label="Sign out"
        disabled={busy}
        onPress={() => {
          void adapter.signOut();
        }}
      />
      {error !== '' ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[type.body, { color: paper.ink, marginTop: 20 }]}
        >
          {error}
        </Text>
      ) : null}
    </ScrollScreen>
  );
}
