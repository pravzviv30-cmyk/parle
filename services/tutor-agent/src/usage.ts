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
  sessionId: string;
  seconds: number;
  utterancesScored: number;
}

export interface UsageReportOptions {
  request?: typeof fetch;
  tokenServer?: string;
  agentSecret?: string;
  attempts?: number;
  sleep?: (milliseconds: number) => Promise<void>;
}

/**
 * Never throws.
 *
 * A failed debit is a billing discrepancy to reconcile later; a thrown error here
 * would take down the end of a session the learner just finished successfully. The
 * log line is deliberately greppable — if these start appearing, minutes are being
 * given away.
 */
export async function reportUsage(report: UsageReport, options: UsageReportOptions = {}): Promise<void> {
  // Direct unit tests construct tutors without a signed room. The worker never
  // does: agent.ts refuses metadata without a real session id before starting.
  if (report.sessionId === '00000000-0000-4000-8000-000000000000') return;
  if (!Number.isInteger(report.seconds) || report.seconds < 0 || report.seconds > 900) {
    console.error(`[parle] USAGE_NOT_DEBITED session=${report.sessionId.slice(0, 8)} reason=invalid-seconds`);
    return;
  }

  const request = options.request ?? fetch;
  const tokenServer = options.tokenServer ?? TOKEN_SERVER;
  const agentSecret = options.agentSecret ?? AGENT_SECRET;
  const attempts = Math.max(1, options.attempts ?? 3);
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  let lastFailure = 'request failed';

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await request(`${tokenServer}/session/end`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(agentSecret ? { 'x-parle-agent': agentSecret } : {}),
        },
        signal: AbortSignal.timeout(5_000),
        body: JSON.stringify({
          userId: report.userId,
          sessionId: report.sessionId,
          seconds: report.seconds,
          utterancesScored: report.utterancesScored,
        }),
      });
      if (res.ok) {
        const body = (await res.json()) as { secondsRemaining?: number };
        console.log(
          `[parle] usage recorded session=${report.sessionId.slice(0, 8)} seconds=${report.seconds} ` +
            `remaining=${body.secondsRemaining ?? '?'}`,
        );
        return;
      }
      lastFailure = `status=${res.status}`;
      if (res.status < 500 && res.status !== 429) break;
    } catch (error) {
      lastFailure = error instanceof Error ? error.name : 'network-error';
    }
    if (attempt < attempts) await sleep(100 * attempt);
  }

  // No raw account id in logs. The random session prefix is enough to match
  // this line to the token-server request without creating identity telemetry.
  console.error(`[parle] USAGE_NOT_DEBITED session=${report.sessionId.slice(0, 8)} ${lastFailure}`);
}
