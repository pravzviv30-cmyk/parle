/** Separate from the browser OAuth callback, whose auth session owns its code. */
export const NATIVE_EMAIL_CALLBACK = 'luvani://auth/email';
export const EMAIL_LINK_FAILED = 'This email link could not finish. Open it on the device where you requested it, or request a new link.';

type Links = {
  getInitialURL(): Promise<string | null>;
  addEventListener(type: 'url', callback: (event: { url: string }) => void): { remove(): void };
};

/** Only PKCE codes for our exact destination are accepted; never URL tokens. */
export function readEmailCallback(value: string): { code: string; flowId?: string } | null {
  if (value.split(/[?#]/, 1)[0] !== NATIVE_EMAIL_CALLBACK) return null;
  const url = new URL(value);
  const codes = url.searchParams.getAll('code');
  const flows = url.searchParams.getAll('sb_flow_id');
  if (url.hash || url.searchParams.has('error') || url.searchParams.has('error_code')
    || codes.length !== 1 || !codes[0]?.trim() || flows.length > 1
    || (flows.length === 1 && !flows[0]?.trim())) return null;
  return { code: codes[0], ...(flows[0] ? { flowId: flows[0] } : {}) };
}

/** Subscribe before reading the launch URL. Duplicate deliveries consume a code once. */
export function observeEmailCallbacks(
  links: Links,
  exchange: (code: string, options?: { flowId: string }) => Promise<{ error: unknown }>,
  failed: () => void,
): () => void {
  let active = true;
  const seen = new Set<string>();
  const handle = async (url: string | null) => {
    if (!active || !url || url.split(/[?#]/, 1)[0] !== NATIVE_EMAIL_CALLBACK || seen.has(url)) return;
    seen.add(url);
    // Keep callback material bounded and in memory only; never log or persist it.
    if (seen.size > 16) seen.delete(seen.values().next().value!);
    try {
      const callback = readEmailCallback(url);
      if (!callback) { if (active) failed(); return; }
      const result = await exchange(callback.code, callback.flowId ? { flowId: callback.flowId } : undefined);
      if (active && result.error) failed();
    } catch { if (active) failed(); }
  };
  const subscription = links.addEventListener('url', event => { void handle(event.url); });
  void links.getInitialURL().then(handle, () => { if (active) failed(); });
  return () => { active = false; subscription.remove(); seen.clear(); };
}
