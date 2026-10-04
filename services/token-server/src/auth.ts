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

export type ResolvedUser = { ok: true; userId: string; authenticatedAt?: number; authSessionId?: string } | { ok: false; status: number; message: string };

export interface UserResolver {
  /** True when a token verifier exists; asserted local identity is a separate opt-in. */
  configured: boolean;
  resolve(authorizationHeader: string | undefined, assertedUserId: string | null): Promise<ResolvedUser>;
}

const SIGN_IN_REQUIRED: ResolvedUser = { ok: false, status: 401, message: 'Sign in to use this.' };

export function createUserResolver(
  config: VerifierConfig,
  options: {
    getKey?: JWTVerifyGetKey;
    /** Live auth session/account check. No cache: sign-out/deletion must fence costly work. */
    isIdentityActive?: (userId: string, sessionId: string) => Promise<boolean>;
  } = {},
): UserResolver {
  const production = config.nodeEnv === 'production';
  const issuer = config.supabaseUrl ? `${config.supabaseUrl.replace(/\/+$/, '')}/auth/v1` : undefined;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  let verify: ((token: string) => Promise<{ userId: string; sessionId?: string; authenticatedAt?: number } | null>) | null = null;

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
        if (production && !issuer) return null;
        const { payload } = await jwtVerify(token, getKey, production ? {
          issuer, audience: 'authenticated', algorithms: ['ES256', 'RS256'],
          requiredClaims: ['sub', 'iss', 'aud', 'exp', 'iat', 'role', 'session_id'],
          clockTolerance: 5,
        } : { algorithms: ['ES256', 'RS256'] });
        if (typeof payload.sub !== 'string' || !payload.sub) return null;
        if (production && (
          !uuid.test(payload.sub) || payload.role !== 'authenticated' || payload.is_anonymous === true ||
          typeof payload.session_id !== 'string' || !uuid.test(payload.session_id) ||
          typeof payload.iat !== 'number' || !Number.isSafeInteger(payload.iat) ||
          typeof payload.exp !== 'number' || !Number.isSafeInteger(payload.exp) || payload.exp <= payload.iat ||
          payload.iat > Math.floor(Date.now() / 1000) + 5
        )) return null;
        const at = verifiedAuthenticationAt(payload);
        return { userId: payload.sub, ...(production ? { sessionId: payload.session_id as string } : {}), ...(at === null ? {} : { authenticatedAt: at }) };
      };
    }
  } else if (config.jwtSecret && !production) {
    const secret = new TextEncoder().encode(config.jwtSecret);
    verify = async (token) => {
      const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
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
        if (!token || token.length > 16 * 1024 || active === null) return SIGN_IN_REQUIRED;
        let identity;
        try {
          identity = await active(token);
        } catch {
          // Expired, malformed, wrong key — the reason is not the client's business.
          return SIGN_IN_REQUIRED;
        }
        if (identity === null) return SIGN_IN_REQUIRED;
        if (production) {
          if (!options.isIdentityActive || !identity.sessionId) return { ok: false, status: 503, message: 'Sign-in verification is temporarily unavailable.' };
          try {
            if (!await options.isIdentityActive(identity.userId, identity.sessionId)) return SIGN_IN_REQUIRED;
          } catch {
            return { ok: false, status: 503, message: 'Sign-in verification is temporarily unavailable.' };
          }
        }
        const { sessionId, ...publicIdentity } = identity;
        return { ok: true, ...publicIdentity, ...(sessionId ? { authSessionId: sessionId } : {}) };
      }

      if (!trustsAssertedIdentity) return SIGN_IN_REQUIRED;
      return asserted
        ? { ok: true, userId: asserted }
        : { ok: false, status: 400, message: 'userId is required' };
    },
  };
}
