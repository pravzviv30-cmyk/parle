export interface ProductEvent {
  name: string;
  properties: Record<string, string | number | boolean | null>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function missionId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9:._-]{1,64}$/.test(value);
}

/** A tier somebody can actually buy. The trial is not one, and never rides a purchase event. */
function paidPlan(value: unknown): value is 'starter' | 'regular' {
  return value === 'starter' || value === 'regular';
}

function allowedEnum(value: unknown, choices: readonly string[]): boolean {
  return typeof value === 'string' && choices.includes(value);
}

function nonNegativeCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100_000;
}

/**
 * Every door the subscription wall can be entered by. 'launch' is the wall
 * shown on app open and 'locked' a tap on a locked feature (D24, 2026-10-20);
 * the database trigger accepts exactly this list (20261020140000).
 */
const WALL_DOORS = ['path-complete', 'refused', 'settings', 'recap', 'launch', 'locked'] as const;

function boundedCount(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;
}

/** Analytics is an allowlist of product facts, never learner content. */
export const SERVER_EVENT_NAMES = ['trial_started', 'minutes_refused'] as const;

export function parseProductEvent(value: unknown, source: 'client' | 'server' = 'client'): ProductEvent | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.properties !== 'object' || candidate.properties === null || Array.isArray(candidate.properties)) return null;
  const properties = candidate.properties as Record<string, unknown>;

  if (candidate.name === 'onboarding_completed') {
    // `motivationAnswered` left with the why page. The allowlist stays exact rather
    // than becoming a subset check: an event still carrying the old key is refused,
    // not quietly trimmed, because a client sending it is a client out of contract
    // and the point of this layer is to say so rather than to store something the
    // database trigger will reject a moment later anyway.
    if (!exactKeys(properties, ['personalisedGreeting'])) return null;
    if (typeof properties.personalisedGreeting !== 'boolean') return null;
  } else if (candidate.name === 'mission_started') {
    if (!exactKeys(properties, ['missionId', 'entry'])) return null;
    if (!missionId(properties.missionId) || !allowedEnum(properties.entry, ['chooser', 'home', 'my-french'])) return null;
  } else if (candidate.name === 'mission_completed') {
    if (!exactKeys(properties, ['missionId', 'rung'])) return null;
    if (
      !missionId(properties.missionId) ||
      typeof properties.rung !== 'number' ||
      ![1, 2, 3, 4].includes(properties.rung)
    ) return null;
  } else if (candidate.name === 'sound_check_completed') {
    if (!exactKeys(properties, ['missionId', 'kind'])) return null;
    if (
      !missionId(properties.missionId) ||
      !allowedEnum(properties.kind, ['assessed-clear', 'assessed-focus', 'self-guided', 'unavailable'])
    ) return null;
  } else if (candidate.name === 'my_french_opened') {
    if (!exactKeys(properties, ['situationsDone', 'linesKept'])) return null;
    if (!nonNegativeCount(properties.situationsDone) || !nonNegativeCount(properties.linesKept)) return null;
  } else if (candidate.name === 'wall_shown') {
    if (!exactKeys(properties, ['entry', 'pages'])) return null;
    if (
      !allowedEnum(properties.entry, WALL_DOORS) ||
      !nonNegativeCount(properties.pages)
    ) return null;
  } else if (candidate.name === 'wall_page_seen') {
    if (!exactKeys(properties, ['page', 'index'])) return null;
    if (
      !allowedEnum(properties.page, ['map', 'french', 'yours', 'plans']) ||
      !nonNegativeCount(properties.index)
    ) return null;
  } else if (candidate.name === 'plan_selected') {
    if (!exactKeys(properties, ['plan'])) return null;
    if (!paidPlan(properties.plan)) return null;
  } else if (candidate.name === 'purchase_started') {
    if (!exactKeys(properties, ['plan'])) return null;
    if (!paidPlan(properties.plan)) return null;
  } else if (candidate.name === 'purchase_settled') {
    if (!exactKeys(properties, ['plan', 'outcome'])) return null;
    if (
      !paidPlan(properties.plan) ||
      !allowedEnum(properties.outcome, ['done', 'nothing-granted', 'cancelled', 'awaiting-approval', 'store-trouble', 'refresh-trouble'])
    ) return null;
  } else if (candidate.name === 'restore_started' || candidate.name === 'restore_settled') {
    const settled = candidate.name === 'restore_settled';
    if (!exactKeys(properties, settled ? ['entry', 'outcome'] : ['entry'])) return null;
    if (!allowedEnum(properties.entry, ['settings', 'wall', 'inline'])) return null;
    if (settled && !allowedEnum(properties.outcome, ['done', 'nothing-granted', 'cancelled', 'awaiting-approval', 'store-trouble', 'refresh-trouble'])) return null;
  } else if (candidate.name === 'wall_left') {
    if (!exactKeys(properties, ['entry', 'outcome', 'destination'])) return null;
    if (!allowedEnum(properties.entry, WALL_DOORS) || !allowedEnum(properties.outcome, ['granted', 'unchanged']) || !allowedEnum(properties.destination, ['back', 'speak'])) return null;
  } else if (candidate.name === 'live_session_finished') {
    // Counts and closed choices only; see apps/mobile/src/analytics/sessionFinished.ts.
    if (!exactKeys(properties, ['kind', 'voice', 'turns', 'rescues', 'unassistedPct', 'replyLatencyMs'])) return null;
    if (
      !allowedEnum(properties.kind, ['lesson', 'convo']) ||
      typeof properties.voice !== 'boolean' ||
      !boundedCount(properties.turns, 1_000) ||
      !boundedCount(properties.rescues, 1_000) ||
      !boundedCount(properties.unassistedPct, 100) ||
      !(properties.replyLatencyMs === null || boundedCount(properties.replyLatencyMs, 30_000))
    ) return null;
  } else if (candidate.name === 'trial_started') {
    if (source !== 'server' || !exactKeys(properties, [])) return null;
  } else if (candidate.name === 'minutes_refused') {
    if (source !== 'server' || !exactKeys(properties, ['plan', 'reason'])) return null;
    if (!allowedEnum(properties.plan, ['trial', 'starter', 'regular']) || !allowedEnum(properties.reason, ['exhausted', 'insufficient-for-session'])) return null;
  } else {
    return null;
  }

  return { name: candidate.name, properties: properties as ProductEvent['properties'] };
}

export async function insertProductEvent(
  baseUrl: string,
  serviceRoleKey: string,
  userId: string,
  event: ProductEvent,
  request: typeof fetch = fetch,
): Promise<void> {
  const response = await request(`${baseUrl.replace(/\/+$/, '')}/rest/v1/product_events`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
      Prefer: 'return=minimal',
    },
    signal: AbortSignal.timeout(5_000),
    body: JSON.stringify({ user_id: userId, name: event.name, properties: event.properties }),
  });
  if (!response.ok) throw new Error(`product event write failed (${response.status})`);
}
