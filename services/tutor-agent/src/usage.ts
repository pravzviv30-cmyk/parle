/**
 * Reporting consumed minutes back to the token server.
 *
 * Debiting happens here, in the agent, rather than in the app. The app can be killed
 * mid-session — a commute ends, a call comes in — and a learner who closes the app to
 * avoid being charged is not a scenario worth designing around, but a learner whose
 * train arrives is. The agent knows how long the room was actually live.
 */

const TOKEN_SERVER = process.env.TOKEN_SERVER_URL ?? 'http://localhost:8787';

export interface UsageReport {
  userId: string;
  seconds: number;
  utterancesScored: number;
}

/**
 * Never throws.
 *
 * A failed debit is a billing discrepancy to reconcile later; a thrown error here
 * would take down the end of a session the learner just finished successfully. The
 * log line is deliberately greppable — if these start appearing, minutes are being
 * given away.
 */
export async function reportUsage(report: UsageReport): Promise<void> {
  if (report.seconds <= 0) return;

  try {
    const res = await fetch(`${TOKEN_SERVER}/session/end`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: report.userId, seconds: report.seconds }),
    });
    if (!res.ok) {
      console.error(`[parle] USAGE_NOT_DEBITED user=${report.userId} seconds=${report.seconds} status=${res.status}`);
      return;
    }
    const body = (await res.json()) as { secondsRemaining?: number };
    console.log(`[parle] debited ${report.seconds}s for ${report.userId}, ${body.secondsRemaining ?? '?'}s left`);
  } catch (err) {
    console.error(`[parle] USAGE_NOT_DEBITED user=${report.userId} seconds=${report.seconds}`, err);
  }
}
