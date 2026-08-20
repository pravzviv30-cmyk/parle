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
export const TOKEN_SERVER = process.env.EXPO_PUBLIC_TOKEN_SERVER_URL ?? 'http://localhost:8787';
