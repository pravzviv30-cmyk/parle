/** Deliver a completed, audio-free Conversation Pack to the durable server. */

import type { ConversationPack } from '@luvani/core';

const TOKEN_SERVER = process.env.TOKEN_SERVER_URL ?? 'http://localhost:8787';
const AGENT_SECRET = process.env.LUVANI_AGENT_SECRET;

export interface ConversationPackReportOptions {
  request?: typeof fetch;
  tokenServer?: string;
  agentSecret?: string;
  attempts?: number;
  phase?: 'baseline' | 'final';
  sleep?: (milliseconds: number) => Promise<void>;
}

/**
 * Bounded and non-throwing, like usage reporting. A tutor ending successfully
 * must never turn into an error screen because the storage service is briefly
 * unavailable. Upsert-by-session on the server makes every retry safe.
 */
export async function reportConversationPack(
  pack: ConversationPack,
  options: ConversationPackReportOptions = {},
): Promise<void> {
  if (pack.sessionId === '00000000-0000-4000-8000-000000000000') return;
  const request = options.request ?? fetch;
  const tokenServer = options.tokenServer ?? TOKEN_SERVER;
  const agentSecret = options.agentSecret ?? AGENT_SECRET;
  const attempts = Math.max(1, options.attempts ?? 3);
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  let lastFailure = 'request failed';

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await request(`${tokenServer}/conversation-packs/complete`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(agentSecret ? { 'x-luvani-agent': agentSecret } : {}),
        },
        signal: AbortSignal.timeout(5_000),
        body: JSON.stringify({ userId: pack.learnerId, sessionId: pack.sessionId, pack, phase: options.phase ?? 'final' }),
      });
      if (response.ok) {
        console.log(`[luvani] conversation pack recorded session=${pack.sessionId.slice(0, 8)} state=${pack.state}`);
        return;
      }
      lastFailure = `status=${response.status}`;
      if (response.status < 500 && response.status !== 429) break;
    } catch (error) {
      lastFailure = error instanceof Error ? error.name : 'network-error';
    }
    if (attempt < attempts) await sleep(100 * attempt);
  }
  console.error(`[luvani] CONVERSATION_PACK_NOT_RECORDED session=${pack.sessionId.slice(0, 8)} ${lastFailure}`);
}
