import type { IncomingMessage, ServerResponse } from 'node:http';

import { APP_PORT } from '../../shared/devPlan.ts';

/**
 * The ports a browser can be serving this app from on a developer's machine, and
 * why they are computed rather than typed out.
 *
 * `APP_PORT` is where `npm run dev` puts the web app. It used to be absent from a
 * hand-written list here, so the repo's own one-command boot brought up an app
 * that this server answered `403 origin not allowed` to on every call, `/health`
 * included — which the app shows a learner as "Tutor unavailable" (F258). Reading
 * the same constant the dev script launches on is what keeps the pair honest; a
 * fifth literal would only have been correct until the next port move.
 *
 * 8081 is Expo's own default, for a Metro started by hand rather than by the
 * supervisor. 8090 predates both and is kept so an existing setup does not break.
 */
const DEVELOPMENT_PORTS = [...new Set([APP_PORT, 8081, 8090])];

const DEVELOPMENT_ORIGINS = DEVELOPMENT_PORTS.flatMap((port) => [
  `http://localhost:${port}`,
  `http://127.0.0.1:${port}`,
]);

export interface OriginPolicy {
  production: boolean;
  allowed: ReadonlySet<string>;
}

export function parseAllowedOrigins(value: string | undefined): string[] {
  if (!value) return [];
  return [...new Set(value.split(',').map((origin) => origin.trim()).filter(Boolean))];
}

export function createOriginPolicy(env: { NODE_ENV?: string; LUVANI_ALLOWED_ORIGINS?: string }): OriginPolicy {
  const production = env.NODE_ENV === 'production';
  const configured = parseAllowedOrigins(env.LUVANI_ALLOWED_ORIGINS);
  return {
    production,
    allowed: new Set(production ? configured : [...DEVELOPMENT_ORIGINS, ...configured]),
  };
}

export function requestOrigin(req: IncomingMessage): string | null {
  const header = req.headers.origin;
  return typeof header === 'string' && header.length > 0 ? header : null;
}

/** Native clients send no Origin. Browser clients must match exactly. */
export function originAllowed(policy: OriginPolicy, origin: string | null): boolean {
  return origin === null || policy.allowed.has(origin);
}

/**
 * Apply API and CORS headers before any endpoint writes its status. Timing is
 * visible only to an allowlisted web origin; wildcard disclosure is forbidden.
 */
export function applyHttpSecurity(req: IncomingMessage, res: ServerResponse, policy: OriginPolicy): boolean {
  const origin = requestOrigin(req);
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'no-referrer');
  res.setHeader('permissions-policy', 'camera=(), geolocation=(), microphone=()');
  res.setHeader('content-security-policy', "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
  res.setHeader('cross-origin-resource-policy', 'same-site');
  res.setHeader('vary', 'Origin');
  res.setHeader('access-control-expose-headers','Retry-After, X-Request-Id');
  if (policy.production) {
    res.setHeader('strict-transport-security', 'max-age=31536000; includeSubDomains');
  }

  if (origin !== null && policy.allowed.has(origin)) {
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('timing-allow-origin', origin);
  }
  return originAllowed(policy, origin);
}
