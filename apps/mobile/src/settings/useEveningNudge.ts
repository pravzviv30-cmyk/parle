/**
 * The Evening nudge's state on the Streak screen (2026-10-20 UI-008, artboard
 * B-Streak): the daily reminder, read on focus and written through the same
 * doors Settings uses. Every decision is `streakNudge.ts`'s; this is wiring.
 *
 * Null on a build that cannot schedule anything, and while the first read has
 * not landed or could not be read: the row is absent rather than a switch that
 * could lie. Bound to the account that read it.
 */

import { useCallback, useEffect, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';

import type { ReminderPermission, StoredReminder } from '../reminders/reminder.ts';
import { loadReminder, saveReminder } from '../reminders/store.ts';
import { REMINDERS_AVAILABLE, askReminderPermission, reminderPermission } from '../reminders/schedule.ts';
import { replanReminders } from '../reminders/ReminderPlanner.tsx';
import { scopeGeneration } from '../storage/scope.ts';
import { NUDGE_COPY, nudgeRow, nudgeWrite } from './streakNudge.ts';

export interface EveningNudge {
  on: boolean;
  note: string;
  busy: boolean;
  trouble: string | null;
  toggle: (next: boolean) => void;
}

export function useEveningNudge(): EveningNudge | null {
  const focused = useIsFocused();
  const [read, setRead] = useState<{ stored: StoredReminder | null; permission: ReminderPermission; scope: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [trouble, setTrouble] = useState<string | null>(null);

  useEffect(() => {
    if (!focused || !REMINDERS_AVAILABLE) return;
    let cancelled = false;
    const owner = scopeGeneration();
    setTrouble(null);
    void Promise.all([loadReminder({ strict: true }), reminderPermission()]).then(
      ([stored, permission]) => {
        if (!cancelled && owner === scopeGeneration()) setRead({ stored, permission, scope: owner });
      },
      () => {
        // Unread is not Off: the row stays away until a read lands.
        if (!cancelled) setRead(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [focused]);

  const toggle = useCallback(
    (next: boolean) => {
      if (read === null || busy) return;
      const owner = read.scope;
      const owned = () => owner === scopeGeneration();
      const before = nudgeRow(read.stored, read.permission);
      setBusy(true);
      setTrouble(null);
      void (before.asks ? askReminderPermission() : reminderPermission())
        .then(async (fresh) => {
          if (!owned()) return;
          const { wanted, reverted } = nudgeWrite(read.stored, before, next, fresh);
          const ack = await saveReminder(wanted);
          if (!owned()) return;
          if (ack === 'failed') {
            setRead({ ...read, permission: fresh });
            setTrouble(NUDGE_COPY.trouble);
            return;
          }
          const outcome = await replanReminders({ choice: wanted });
          if (!owned()) return;
          if (outcome === 'failed') {
            await saveReminder(reverted);
            if (!owned()) return;
            setRead({ ...read, permission: fresh });
            setTrouble(NUDGE_COPY.scheduleTrouble);
            return;
          }
          setRead({ stored: wanted, permission: fresh, scope: owner });
        })
        .catch(() => {
          if (owned()) setTrouble(NUDGE_COPY.trouble);
        })
        .finally(() => {
          if (owned()) setBusy(false);
        });
    },
    [read, busy],
  );

  if (!REMINDERS_AVAILABLE || read === null || read.scope !== scopeGeneration()) return null;
  const row = nudgeRow(read.stored, read.permission);
  return { on: row.on, note: row.note, busy, trouble, toggle };
}
