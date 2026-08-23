/**
 * Who is really asking.
 *
 * Historically the server took `userId` from the request body on faith — fine
 * for keyless dev, an open door the day accounts exist. This resolver closes
 * it without breaking that dev mode:
 *
 *   SUPABASE_URL set        → verify against the project's asymmetric JWKS
 *   else JWT secret set     → verify HS256 in explicit legacy/local setups
 *   else                    → not configured: trust the asserted id, as before
 *
 * When configured, the verified token's `sub` IS the user id and whatever the
 * client asserted is ignored. When not, nothing about the old behaviour moves.
 */

import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export interface VerifierConfig {
  /** SUPABASE_JWT_SECRET — legacy/local HS256 fallback when no project URL exists. */
  jwtSecret?: string | undefined;
  /** SUPABASE_URL — the project base URL; its JWKS endpoint is derived. */
  supabaseUrl?: string | undefined;
}

export type ResolvedUser = { ok: true; userId: string } | { ok: false; status: number; message: string };

export interface UserResolver {
  /** True when tokens are being verified; false in trust-the-client dev mode. */
  configured: boolean;
  resolve(authorizationHeader: string | undefined, assertedUserId: string | null): Promise<ResolvedUser>;
}

const SIGN_IN_REQUIRED: ResolvedUser = { ok: false, status: 401, message: 'Sign in to use this.' };

export function createUserResolver(
  config: VerifierConfig,
  options: { getKey?: JWTVerifyGetKey } = {},
): UserResolver {
  let verify: ((token: string) => Promise<string | null>) | null = null;

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
        return typeof payload.sub === 'string' && payload.sub !== '' ? payload.sub : null;
      };
    }
  } else if (config.jwtSecret) {
    const secret = new TextEncoder().encode(config.jwtSecret);
    verify = async (token) => {
      const { payload } = await jwtVerify(token, secret);
      return typeof payload.sub === 'string' && payload.sub !== '' ? payload.sub : null;
    };
  }

  const active = verify;
  if (active === null) {
    return {
      configured: false,
      async resolve(_header, asserted) {
        // Dev mode: exactly the pre-auth contract, including its 400.
        return asserted
          ? { ok: true, userId: asserted }
          : { ok: false, status: 400, message: 'userId is required' };
      },
    };
  }

  return {
    configured: true,
    async resolve(header, _asserted) {
      const token = header !== undefined && /^bearer /i.test(header) ? header.slice(7).trim() : null;
      if (!token) return SIGN_IN_REQUIRED;
      try {
        const sub = await active(token);
        return sub === null ? SIGN_IN_REQUIRED : { ok: true, userId: sub };
      } catch {
        // Expired, malformed, wrong key — the reason is not the client's business.
        return SIGN_IN_REQUIRED;
      }
    },
  };
}
