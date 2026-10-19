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
 * While notifications are denied the switch reads off whatever is stored,
 * because nothing can be sent, and an Open Settings row sits under it
 * (`trialReminderRowView`, review P2 #3). A tap then saves nothing; the
 * stored preference comes back once permission does.
 *
 * Its own file so Settings keeps exactly one place that raises the daily
 * reminder's dialog (`settings/phone.test.ts`).
 */

import { useState } from 'react';

import { askReminderPermission } from '../reminders/schedule.ts';
import { TRIAL_REMINDER_OPEN_SETTINGS, TRIAL_REMINDER_ROW, trialReminderRowView, trialReminderTap } from '../reminders/trialReminder.ts';
import { trialReminderState } from '../reminders/trialReminderSync.ts';
import type { UseTrialReminder } from '../reminders/useTrialReminder.ts';
import { openPhoneSettings } from './phoneSettings.ts';
import { CONSENT_SAVE_TROUBLE, LINK_TROUBLE } from './sections.ts';
import { SettingsRow } from './SettingsRow.tsx';
import { SwitchRow } from './SwitchRow.tsx';
import { TroubleLine } from './TroubleLine.tsx';

export function TrialReminderRow({ trial, first = false }: { trial: UseTrialReminder; first?: boolean }) {
  const [pending, setPending] = useState<boolean | null>(null);
  const [trouble, setTrouble] = useState<string | null>(null);
  const view = trialReminderRowView({ enabled: trial.enabled, permission: trial.permission, available: trial.available });

  const change = (next: boolean) => {
    if (pending !== null) return;
    const tap = trialReminderTap({ next, permission: trial.permission });
    // Nothing can be sent: the row already says so and points to Settings.
    if (tap === 'blocked') return;
    setPending(next);
    setTrouble(null);
    void (async () => {
      if (tap === 'ask') {
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

  const walkToSettings = () => {
    setTrouble(null);
    void openPhoneSettings().then((outcome) => {
      if (outcome !== 'done') setTrouble(LINK_TROUBLE);
    });
  };

  return (
    <>
      {trouble !== null && <TroubleLine message={trouble} />}
      <SwitchRow
        first={first && trouble === null}
        title={TRIAL_REMINDER_ROW}
        sub={view.sub}
        value={pending ?? view.value}
        disabled={pending !== null}
        onChange={change}
        accessibilityLabel={TRIAL_REMINDER_ROW}
      />
      {view.blocked ? <SettingsRow label={TRIAL_REMINDER_OPEN_SETTINGS} onPress={walkToSettings} /> : null}
    </>
  );
}
