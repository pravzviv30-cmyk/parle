/**
 * Who is allowed to spend someone else's minutes.
 *
 * /session/end is the one endpoint with no learner bearer token in the path: the
 * caller is the tutor agent, server side, using the identity it read out of a
 * signed join credential. That is a good reason for the endpoint to trust its
 * body, and no reason at all for it to trust the network — without a shared
 * secret, anything that can reach the port can drain any account by name.
 *
 * Production boot requires the secret. The unconfigured branch exists only for
 * the server's explicit local-development compatibility mode.
 */
import { timingSafeEqual } from 'node:crypto';

export function agentDebitAllowed(secret: string | undefined, presented: string | string[] | undefined): boolean {
  if (!secret) return true;
  // A header can arrive repeated. One correct value among several is somebody
  // probing, not the agent.
  if (typeof presented !== 'string') return false;
  const expected = Buffer.from(secret);
  const supplied = Buffer.from(presented);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
