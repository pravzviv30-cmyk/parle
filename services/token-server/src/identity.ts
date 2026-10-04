/** Never equate a still-valid JWT with a still-live account or auth session. */
export function liveIdentityVerifier(baseUrl: string, serviceKey: string, request: typeof fetch = fetch) {
  return async (userId: string, sessionId: string): Promise<boolean> => {
    const response = await request(`${baseUrl.replace(/\/+$/, '')}/rest/v1/rpc/active_tutor_identity_v1`, {
      method: 'POST', headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ p_user_id: userId, p_auth_session_id: sessionId }), signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) { await response.body?.cancel(); throw new Error('identity-unavailable'); }
    // This RPC returns only a boolean. Reject oversized/malformed provider responses.
    const reader = response.body?.getReader();
    if (!reader) throw new Error('identity-unavailable');
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.length;
        if (bytes > 32) { await reader.cancel(); throw new Error('identity-unavailable'); }
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (typeof value !== 'boolean') throw new Error('identity-unavailable');
    return value;
  };
}
