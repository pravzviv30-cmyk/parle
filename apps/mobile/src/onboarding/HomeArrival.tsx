import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Modal, View } from 'react-native';
import { dayKeyOf } from '@luvani/core';
import { useIsFocused } from '@react-navigation/native';
import { loadArrival, saveArrival, type Arrival } from './arrival.ts';
import { guestStreak } from './guestProgress.ts';
import { StreakCelebrationScreen } from './firstRun/StreakCelebrationScreen.tsx';
import { scopeGeneration } from '../storage/scope.ts';
import { Sheet } from '../components.tsx';
import { ReminderAsk } from '../reminders/ReminderAsk.tsx';
import { REMINDERS_AVAILABLE } from '../reminders/schedule.ts';
export const HomeArrivalAllowed = createContext(true);
export const HOME_ARRIVAL_DELAY = 1500;
/** Starts only after Home has loaded and the welcome has left the foreground. */
export function HomeArrival({ ready, tutorName = 'your tutor' }: { ready: boolean; tutorName?: string }) {
  const allowed = useContext(HomeArrivalAllowed), focused = useIsFocused();
  const [arrival, setArrival] = useState<Arrival | null>(null);
  const [reminding, setReminding] = useState(false);
  const consumed = useRef(false);
  useEffect(() => {
    if (!ready || !allowed || !focused || consumed.current) return;
    let visit = 0;
    let current = true, timer: ReturnType<typeof setTimeout> | undefined;
    const owner = scopeGeneration();
    const schedule = () => {
      const ticket = ++visit;
      if (timer) clearTimeout(timer);
      if (AppState.currentState === 'background' || AppState.currentState === 'inactive') return;
      timer = setTimeout(() => {
        void (async () => {
          const value = await loadArrival();
          if (!current || visit !== ticket || owner !== scopeGeneration() || !value || value.streakSeen || !value.welcomeSeen || !value.finishedAt.length) return;
          // Persist before presenting: effect replay/restarts cannot celebrate twice.
          await saveArrival({ ...value, streakSeen: true });
          if (!current || visit !== ticket || owner !== scopeGeneration()) return;
          consumed.current = true; setArrival(value);
        })().catch(() => { /* Keep the durable receipt pending for the next Home focus. */ });
      }, HOME_ARRIVAL_DELAY);
    };
    schedule();
    const sub = AppState.addEventListener('change', () => { if (timer) clearTimeout(timer); schedule(); });
    return () => { current = false; if (timer) clearTimeout(timer); sub.remove(); };
  }, [ready, allowed, focused]);
  if (!arrival) return null;
  const today = dayKeyOf(Date.now()), streak = guestStreak(arrival.finishedAt.map(dayKeyOf), today);
  if (!streak) return null;
  return <Modal visible animationType="fade" onRequestClose={() => setArrival(null)}>
    <View style={{ flex: 1 }}><StreakCelebrationScreen design="bold-rhythm" streak={streak} today={today} moment={arrival.sessionId}
      active={!reminding} onReminder={REMINDERS_AVAILABLE ? () => setReminding(true) : undefined}
      onContinue={() => setArrival(null)} />
      <Sheet visible={reminding} title="A little nudge for tomorrow?" onClose={() => setReminding(false)}>
        {reminding && <ReminderAsk time="evening" tutor={tutorName} onDone={() => { setReminding(false); setArrival(null); }} />}
      </Sheet>
    </View>
  </Modal>;
}
