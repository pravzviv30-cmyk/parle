/**
 * Who is allowed to spend someone else's minutes.
 *
 * /session/end is the one endpoint with no learner bearer token in the path: the
 * caller is the tutor agent, server side, using the identity it read out of a
 * signed join credential. That is a good reason for the endpoint to trust its
 * body, and no reason at all for it to trust the network — without a shared
 * secret, anything that can reach the port can drain any account by name.
 *
 * Configured, it is required. Unconfigured, behaviour is exactly what it always
 * was, because the keyless local setup has to keep working; the server says so
 * once at boot rather than leaving it quiet.
 */
export function agentDebitAllowed(secret: string | undefined, presented: string | string[] | undefined): boolean {
  if (!secret) return true;
  // A header can arrive repeated. One correct value among several is somebody
  // probing, not the agent.
  if (typeof presented !== 'string') return false;
  return presented === secret;
}
