import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { starterTasks } from '@luvani/core';
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
/** The account keeps its own profile. Explicit adoption adds practice, never silently overwrites it. */
export function GuestAccountHandoff({
  draft,
  onDone,
  children,
}: {
  draft: PreAccountOnboardingDraft | null;
  onDone: () => void;
  children: React.ReactNode;
}) {
  const { user, adapter } = useAuth();
  const [guest, setGuest] = useState<GuestPractice | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState<number | null>(null);
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
        guest.plan.minutes ?? 5,
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
          return task
            ? {
                fr: a.feedback.accepted ? a.reply : a.feedback.model,
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
      const key = userKey('onboarding-practice');
      if (
        !(await writeInUserScope(owner, () =>
          AsyncStorage.setItem(key, JSON.stringify({ ...guest, token: null, completed: true })),
        ))
      )
        throw new Error('Your practice could not be saved.');
      setRemaining(balance);
      setSaved(true);
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
      onDone();
    } catch {
      if (owner === scopeGeneration())
        setError('Your minutes could not be checked. Try again. Your practice is still here.');
    } finally {
      if (owner === scopeGeneration()) setBusy(false);
    }
  };
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
        <Text style={type.heading}>
          {guest.attempts.at(-1)?.feedback.accepted
            ? guest.attempts.at(-1)?.reply
            : (guest.attempts.at(-1)?.feedback.model ?? 'Your starting plan')}
        </Text>
        <Text style={type.body}>
          {saved
            ? 'Your phrase is in Practice. Your account can sync it to another device.'
            : 'Keep the phrase from this phone. Your account’s existing learning and preferences stay yours.'}
        </Text>
        {remaining !== null && (
          <Text style={type.bodyStrong}>
            {Math.floor(remaining / 60)} minutes {remaining % 60} seconds remaining.
          </Text>
        )}
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
      {error && (
        <Text
          accessibilityLiveRegion="polite"
          style={[type.body, { color: paper.ink, marginTop: 20 }]}
        >
          {error}
        </Text>
      )}
    </ScrollScreen>
  );
}
