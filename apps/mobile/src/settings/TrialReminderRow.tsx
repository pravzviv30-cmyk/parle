/**
 * The trial-ending reminder switch, in Settings' Reminders group (2026-10-19).
 *
 * Drawn only when `showTrialReminder` says so: a build that can schedule one
 * and a store trial on record in the reminders module. The
 * switch moves first so the tap feels answered; when the learner turns it on
 * over a permission nobody has been asked for yet, the system dialog is raised
 * here, beside the row whose sentence says what it is for, and the state is
 * re-read before the choice is written. If the write did not land, the switch
 * goes back and says so in the same words the consent switch uses.
 *
 * Its own file so Settings keeps exactly one place that raises the daily
 * reminder's dialog (`settings/phone.test.ts`).
 */

import { useState } from 'react';

import { askReminderPermission } from '../reminders/schedule.ts';
import { TRIAL_REMINDER_ROW, TRIAL_REMINDER_ROW_SUB } from '../reminders/trialReminder.ts';
import { trialReminderState } from '../reminders/trialReminderSync.ts';
import type { UseTrialReminder } from '../reminders/useTrialReminder.ts';
import { CONSENT_SAVE_TROUBLE } from './sections.ts';
import { SwitchRow } from './SwitchRow.tsx';
import { TroubleLine } from './TroubleLine.tsx';

export function TrialReminderRow({ trial, first = false }: { trial: UseTrialReminder; first?: boolean }) {
  const [pending, setPending] = useState<boolean | null>(null);
  const [trouble, setTrouble] = useState<string | null>(null);

  const change = (next: boolean) => {
    if (pending !== null) return;
    setPending(next);
    setTrouble(null);
    void (async () => {
      if (next && trial.permission === 'undetermined') {
        await askReminderPermission();
        await trial.refresh();
      }
      await trial.setEnabled(next);
      const fresh = await trialReminderState();
      if (fresh.enabled !== next) setTrouble(CONSENT_SAVE_TROUBLE);
    })()
      .catch(() => setTrouble(CONSENT_SAVE_TROUBLE))
      .finally(() => setPending(null));
  };

  return (
    <>
      {trouble !== null && <TroubleLine message={trouble} />}
      <SwitchRow
        first={first && trouble === null}
        title={TRIAL_REMINDER_ROW}
        sub={TRIAL_REMINDER_ROW_SUB}
        value={pending ?? trial.enabled}
        disabled={pending !== null}
        onChange={change}
        accessibilityLabel={TRIAL_REMINDER_ROW}
      />
    </>
  );
}
