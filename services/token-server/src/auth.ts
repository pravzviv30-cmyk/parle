/**
 * Who is really asking.
 *
 * Historically the server took `userId` from the request body on faith — fine
 * for keyless dev, an open door the day accounts exist. This resolver closes
 * it without breaking the one deliberately insecure development mode:
 *
 *   bearer + SUPABASE_URL   → verify against the project's asymmetric JWKS
 *   bearer + JWT secret     → verify HS256 in explicit legacy/local setups
 *   explicit local mode     → with no bearer, trust the asserted mock identity
 *   everything else        → refuse the request
 *
 * A configured verifier still wins when a bearer is supplied in local mode:
 * its `sub` IS the user id and whatever the client asserted is ignored. An
 * invalid bearer never falls through to asserted identity. The exception is
 * exactly `LUVANI_LOCAL_DEVELOPMENT=1` outside production, so merely omitting
 * Supabase credentials can no longer open the trust-the-client path.
 */

import { verifiedAuthenticationAt } from '@luvani/core';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export interface VerifierConfig {
  /** SUPABASE_JWT_SECRET — legacy/local HS256 fallback when no project URL exists. */
  jwtSecret?: string | undefined;
  /** SUPABASE_URL — the project base URL; its JWKS endpoint is derived. */
  supabaseUrl?: string | undefined;
  /** NODE_ENV — production always refuses asserted identity. */
  nodeEnv?: string | undefined;
  /** LUVANI_LOCAL_DEVELOPMENT — only the exact value `1` opts into local trust. */
  localDevelopment?: string | undefined;
}

export type ResolvedUser = { ok: true; userId: string; authenticatedAt?: number } | { ok: false; status: number; message: string };

export interface UserResolver {
  /** True when a token verifier exists; asserted local identity is a separate opt-in. */
  configured: boolean;
  resolve(authorizationHeader: string | undefined, assertedUserId: string | null): Promise<ResolvedUser>;
}

const SIGN_IN_REQUIRED: ResolvedUser = { ok: false, status: 401, message: 'Sign in to use this.' };

export function createUserResolver(
  config: VerifierConfig,
  options: { getKey?: JWTVerifyGetKey } = {},
): UserResolver {
  let verify: ((token: string) => Promise<{ userId: string; authenticatedAt?: number } | null>) | null = null;

  if (config.supabaseUrl || options.getKey) {
    // The JWKS fetcher is injectable so tests can hand over a key without a
    // network; production derives it from the project URL.
    const getKey =
      options.getKey ??
      (config.supabaseUrl
        ? createRemoteJWKSet(
            new URL(`${config.supabaseUrl.replace(/\/+$/, '')}/auth/v1/.well-known/jwks.json`),
            { timeoutDuration: 5_000 },
          )
        : null);
    if (getKey) {
      verify = async (token) => {
        const { payload } = await jwtVerify(token, getKey);
        if (typeof payload.sub !== 'string' || !payload.sub) return null;
        const at = verifiedAuthenticationAt(payload);
        return { userId: payload.sub, ...(at === null ? {} : { authenticatedAt: at }) };
      };
    }
  } else if (config.jwtSecret) {
    const secret = new TextEncoder().encode(config.jwtSecret);
    verify = async (token) => {
      const { payload } = await jwtVerify(token, secret);
      if (typeof payload.sub !== 'string' || !payload.sub) return null;
        const at = verifiedAuthenticationAt(payload);
        return { userId: payload.sub, ...(at === null ? {} : { authenticatedAt: at }) };
    };
  }

  const active = verify;
  const trustsAssertedIdentity = config.localDevelopment === '1' && config.nodeEnv !== 'production';

  return {
    configured: active !== null,
    async resolve(header, asserted) {
      const token = header !== undefined && /^bearer /i.test(header) ? header.slice(7).trim() : null;
      // A supplied credential is never silently downgraded to a body assertion.
      // That matters in local mode too: a malformed or expired bearer must not
      // become a different identity merely because the request also has userId.
      if (header !== undefined && header.trim() !== '') {
        if (!token || active === null) return SIGN_IN_REQUIRED;
        try {
          const identity = await active(token);
          return identity === null ? SIGN_IN_REQUIRED : { ok: true, ...identity };
        } catch {
          // Expired, malformed, wrong key — the reason is not the client's business.
          return SIGN_IN_REQUIRED;
        }
      }

      if (!trustsAssertedIdentity) return SIGN_IN_REQUIRED;
      return asserted
        ? { ok: true, userId: asserted }
        : { ok: false, status: 400, message: 'userId is required' };
    },
  };
}
