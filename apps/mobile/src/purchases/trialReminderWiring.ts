/**
 * When the trial-ending reminder is re-synced, with every moving part
 * injected so a Node test can drive it (`useTrialReminderSync.ts` binds the
 * real ones).
 *
 * Moments: start (launch, or a learner signing in), the app coming to the
 * foreground, every billing change (`refreshBilling` fires one after each
 * purchase settlement, restore and paywall recheck), and the store reporting
 * new customer info. No poll of its own.
 *
 * Reads only. The status and the store's facts are handed to the reminder and
 * nowhere else: nothing here grants, writes or changes a plan or minutes.
 */

import type { BillingStatus } from './billingStatus.ts';
import type { StoreTrialFacts } from '../reminders/trialReminder.ts';

export interface TrialWiringDeps {
  userId: string;
  /** False once the account or scope this loop was started for has gone. */
  isCurrent(): boolean;
  fetchStatus(userId: string): Promise<BillingStatus | null>;
  storeFacts(userId: string): Promise<StoreTrialFacts | null>;
  sync(facts: { status: BillingStatus | null; storeFacts: StoreTrialFacts | null; now: number }): Promise<unknown>;
  now(): number;
  onForeground(listener: () => void): () => void;
  onBillingChange(listener: (change: { userId: string }) => void): () => void;
  onStoreChange(listener: () => void): () => void;
}

export function startTrialReminderSync(deps: TrialWiringDeps): () => void {
  let stopped = false;
  let running = false;
  let again = false;
  const run = async (): Promise<void> => {
    if (stopped) return;
    if (running) { again = true; return; }
    running = true;
    try {
      do {
        again = false;
        const [status, storeFacts] = await Promise.all([
          deps.fetchStatus(deps.userId).catch(() => null),
          deps.storeFacts(deps.userId).catch(() => null),
        ]);
        if (stopped || !deps.isCurrent()) return;
        await deps.sync({ status, storeFacts, now: deps.now() }).catch(() => {});
      } while (again && !stopped);
    } finally {
      running = false;
    }
  };
  const offs = [
    deps.onForeground(() => void run()),
    deps.onBillingChange((change) => { if (change.userId === deps.userId) void run(); }),
    deps.onStoreChange(() => void run()),
  ];
  void run();
  return () => {
    stopped = true;
    for (const off of offs) off();
  };
}

/** A learner left (sign-out) or another took over (account switch). Signing in cancels nothing. */
export function accountLeft(was: string | null, now: string | null): boolean {
  return was !== null && was !== now;
}
