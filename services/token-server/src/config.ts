export interface ServerEnvironment {
  NODE_ENV?: string;
  PARLE_LOCAL_DEVELOPMENT?: string;
  LIVEKIT_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_JWT_SECRET?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  PARLE_AGENT_SECRET?: string;
  PARLE_ALLOWED_ORIGINS?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  PARLE_RATE_LIMIT_SALT?: string;
  ENTITLEMENT_STORE_PATH?: string;
}

function secureUrl(value: string | undefined, protocol: 'https:' | 'wss:'): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === protocol && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

function exactHttpsOrigin(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && parsed.origin === value && !value.includes('*');
  } catch {
    return false;
  }
}

/** Unsafe fallbacks exist only behind an explicit local supervisor flag. */
export function productionConfigurationProblems(env: ServerEnvironment): string[] {
  if (env.PARLE_LOCAL_DEVELOPMENT === '1' && env.NODE_ENV !== 'production') return [];
  const problems: string[] = [];
  if (env.NODE_ENV !== 'production') problems.push('NODE_ENV=production or PARLE_LOCAL_DEVELOPMENT=1');
  if (!secureUrl(env.SUPABASE_URL, 'https:')) problems.push('HTTPS Supabase JWKS authentication');
  if (!secureUrl(env.LIVEKIT_URL, 'wss:')) problems.push('secure WSS LiveKit URL');
  if (!env.PARLE_AGENT_SECRET) problems.push('PARLE_AGENT_SECRET');
  const origins = (env.PARLE_ALLOWED_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean);
  if (origins.length === 0) problems.push('PARLE_ALLOWED_ORIGINS');
  else if (origins.some((origin) => !exactHttpsOrigin(origin))) {
    problems.push('exact HTTPS origins');
  }
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) problems.push('distributed rate limiting');
  if (env.UPSTASH_REDIS_REST_URL && !secureUrl(env.UPSTASH_REDIS_REST_URL, 'https:')) {
    problems.push('HTTPS rate-limit store');
  }
  if (!env.PARLE_RATE_LIMIT_SALT || env.PARLE_RATE_LIMIT_SALT.length < 32) problems.push('PARLE_RATE_LIMIT_SALT');
  if (!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY)) problems.push('atomic Supabase entitlement storage');
  if (!!env.SUPABASE_SERVICE_ROLE_KEY !== !!env.SUPABASE_URL) {
    problems.push('complete Supabase service configuration');
  }
  return problems;
}
