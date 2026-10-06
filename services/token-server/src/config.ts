export interface ServerEnvironment {
  NODE_ENV?: string;
  LUVANI_LOCAL_DEVELOPMENT?: string;
  LIVEKIT_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_JWT_SECRET?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  LUVANI_AGENT_SECRET?: string;
  LUVANI_METRICS_SECRET?: string;
  LUVANI_BRAIN?: string;
  LUVANI_SCORING_VENDOR?: string;
  SPEECHACE_API_KEY?: string;
  TONEPERFECT_API_KEY?: string;
  FISH_API_KEY?: string;
  LUVANI_TTS_VENDOR?: string;
  TUTOR_LLM?: string;
  LUVANI_ALLOWED_ORIGINS?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  LUVANI_RATE_LIMIT_SALT?: string;
  ENTITLEMENT_STORE_PATH?: string;
  REVENUECAT_SECRET_API_KEY?: string;
  LUVANI_REVENUECAT_WEBHOOK_SECRET?: string;
  REVENUECAT_ENTITLEMENT_ID?: string;
  REVENUECAT_STARTER_PRODUCT_ID?: string;
  REVENUECAT_REGULAR_PRODUCT_ID?: string;
  REVENUECAT_STARTER_YEARLY_PRODUCT_ID?: string;
  REVENUECAT_REGULAR_YEARLY_PRODUCT_ID?: string;
}

function secureUrl(value: string | undefined, protocol: 'https:' | 'wss:'): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === protocol && !parsed.username && !parsed.password && !parsed.search && !parsed.hash;
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
  if (env.LUVANI_LOCAL_DEVELOPMENT === '1' && env.NODE_ENV !== 'production') return [];
  const problems: string[] = [];
  if (env.NODE_ENV !== 'production') problems.push('NODE_ENV=production or LUVANI_LOCAL_DEVELOPMENT=1');
  if (!secureUrl(env.SUPABASE_URL, 'https:')) problems.push('HTTPS Supabase JWKS authentication');
  if (!secureUrl(env.LIVEKIT_URL, 'wss:')) problems.push('secure WSS LiveKit URL');
  if (!env.LUVANI_AGENT_SECRET || env.LUVANI_AGENT_SECRET.length < 32) problems.push('LUVANI_AGENT_SECRET');
  if (env.LUVANI_METRICS_SECRET && env.LUVANI_METRICS_SECRET.length < 32) problems.push('strong LUVANI_METRICS_SECRET');
  if (env.LUVANI_LOCAL_DEVELOPMENT === '1') problems.push('local development disabled');
  if (env.LUVANI_BRAIN && !['anthropic','openai'].includes(env.LUVANI_BRAIN)) problems.push('hosted API brain');
  if (env.TUTOR_LLM && !['anthropic','openai'].includes(env.TUTOR_LLM.trim().toLowerCase())) problems.push('hosted TUTOR_LLM brain');
  if (env.TONEPERFECT_API_KEY || env.FISH_API_KEY || env.LUVANI_TTS_VENDOR && env.LUVANI_TTS_VENDOR !== 'elevenlabs') problems.push('unsupported production paid adapter');
  if (env.LUVANI_SCORING_VENDOR && env.LUVANI_SCORING_VENDOR !== 'speechace' || env.SPEECHACE_API_KEY && env.LUVANI_SCORING_VENDOR !== 'speechace' || env.LUVANI_SCORING_VENDOR === 'speechace' && !env.SPEECHACE_API_KEY?.trim()) problems.push('explicit supported Speechace scoring');
  const origins = (env.LUVANI_ALLOWED_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean);
  if (origins.length === 0) problems.push('LUVANI_ALLOWED_ORIGINS');
  else if (origins.some((origin) => !exactHttpsOrigin(origin))) {
    problems.push('exact HTTPS origins');
  }
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) problems.push('distributed rate limiting');
  if (env.UPSTASH_REDIS_REST_URL && !secureUrl(env.UPSTASH_REDIS_REST_URL, 'https:')) {
    problems.push('HTTPS rate-limit store');
  }
  if (!env.LUVANI_RATE_LIMIT_SALT || env.LUVANI_RATE_LIMIT_SALT.length < 32) problems.push('LUVANI_RATE_LIMIT_SALT');
  if (!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY)) problems.push('atomic Supabase entitlement storage');
  if (!!env.SUPABASE_SERVICE_ROLE_KEY !== !!env.SUPABASE_URL) {
    problems.push('complete Supabase service configuration');
  }
  const billing = [
    env.REVENUECAT_SECRET_API_KEY,
    env.LUVANI_REVENUECAT_WEBHOOK_SECRET,
    env.REVENUECAT_ENTITLEMENT_ID,
    env.REVENUECAT_STARTER_PRODUCT_ID,
    env.REVENUECAT_REGULAR_PRODUCT_ID,
  ];
  const billingValues = billing.filter(Boolean).length;
  // The two yearly ids are optional on their own (D16), but either one without
  // the five above is a partial configuration like any other.
  const yearlyValues = [env.REVENUECAT_STARTER_YEARLY_PRODUCT_ID, env.REVENUECAT_REGULAR_YEARLY_PRODUCT_ID].filter(Boolean).length;
  if ((billingValues > 0 || yearlyValues > 0) && billingValues !== billing.length) {
    problems.push('complete RevenueCat billing configuration');
  }
  return problems;
}
