import type { IncomingMessage, ServerResponse } from 'node:http';

const DEVELOPMENT_ORIGINS = [
  'http://localhost:8081',
  'http://localhost:8090',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:8090',
] as const;

export interface OriginPolicy {
  production: boolean;
  allowed: ReadonlySet<string>;
}

export function parseAllowedOrigins(value: string | undefined): string[] {
  if (!value) return [];
  return [...new Set(value.split(',').map((origin) => origin.trim()).filter(Boolean))];
}

export function createOriginPolicy(env: { NODE_ENV?: string; PARLE_ALLOWED_ORIGINS?: string }): OriginPolicy {
  const production = env.NODE_ENV === 'production';
  const configured = parseAllowedOrigins(env.PARLE_ALLOWED_ORIGINS);
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
  if (policy.production) {
    res.setHeader('strict-transport-security', 'max-age=31536000; includeSubDomains');
  }

  if (origin !== null && policy.allowed.has(origin)) {
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('timing-allow-origin', origin);
  }
  return originAllowed(policy, origin);
}
