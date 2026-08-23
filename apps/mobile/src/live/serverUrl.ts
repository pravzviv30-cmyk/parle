/**
 * Where the token server lives.
 *
 * One home, because there were three: useLiveSession.ts, LiveContext.tsx and
 * DrillScreen.tsx each spelled out the same env lookup and the same localhost
 * default. Three copies that agree about everything are still three copies, and
 * the fourth one someone adds is the one that disagrees.
 *
 * Configurable per environment for device testing. Note the ceiling on that,
 * because it is not obvious and it costs an afternoon to rediscover: a LAN
 * address works for HTTP and not for the microphone. `navigator.mediaDevices`
 * is undefined outside a secure context, and http://192.168.x.x is not one, so
 * a phone on the same network needs https or a tunnel rather than an IP here.
 */
export interface TokenServerEnvironment {
  nodeEnv?: string;
  localDevelopment?: string;
  tokenServerUrl?: string;
}

export function selectTokenServerUrl(env: TokenServerEnvironment): string {
  const localDevelopment = env.localDevelopment === '1' && env.nodeEnv !== 'production';
  const value = env.tokenServerUrl ?? (localDevelopment ? 'http://localhost:8787' : null);
  if (!value) throw new Error('Parle refuses to run without a configured token server.');
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Parle token server URL is invalid.');
  }
  if (!localDevelopment && parsed.protocol !== 'https:') {
    throw new Error('Parle refuses a deployed token server that is not HTTPS.');
  }
  if (value.endsWith('/')) throw new Error('Parle token server URL must not end with a slash.');
  return value;
}

export const TOKEN_SERVER = selectTokenServerUrl({
  nodeEnv: process.env.NODE_ENV,
  localDevelopment: process.env.EXPO_PUBLIC_PARLE_LOCAL_DEVELOPMENT,
  tokenServerUrl: process.env.EXPO_PUBLIC_TOKEN_SERVER_URL,
});
