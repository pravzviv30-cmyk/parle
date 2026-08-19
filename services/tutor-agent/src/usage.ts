/**
 * Reporting consumed minutes back to the token server.
 *
 * Debiting happens here, in the agent, rather than in the app. The app can be killed
 * mid-session — a commute ends, a call comes in — and a learner who closes the app to
 * avoid being charged is not a scenario worth designing around, but a learner whose
 * train arrives is. The agent knows how long the room was actually live.
 */

const TOKEN_SERVER = process.env.TOKEN_SERVER_URL ?? 'http://localhost:8787';

/**
 * Proof that this debit came from the agent.
 *
 * There is no learner bearer token on this path — the agent knows who the
 * learner is because it read the identity out of a signed join credential — so
 * without a shared secret the endpoint takes any userId and any number of
 * seconds from anyone who can reach it. Unset in dev, where the server keeps its
 * old behaviour and says so at boot.
 */
const AGENT_SECRET = process.env.PARLE_AGENT_SECRET;

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
      headers: {
        'content-type': 'application/json',
        ...(AGENT_SECRET ? { 'x-parle-agent': AGENT_SECRET } : {}),
      },
      // utterancesScored has always been on this interface and never on the
      // wire, so the server could not tell a scored session from a silent one.
      body: JSON.stringify({ userId: report.userId, seconds: report.seconds, utterancesScored: report.utterancesScored }),
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
