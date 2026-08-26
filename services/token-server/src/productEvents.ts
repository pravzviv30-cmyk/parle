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

function nonNegativeCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100_000;
}

/** Analytics is an allowlist of product facts, never learner content. */
export function parseProductEvent(value: unknown): ProductEvent | null {
  if (typeof value !== 'object' || value === null) return null;
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
    if (!missionId(properties.missionId) || !['chooser', 'home', 'my-french'].includes(String(properties.entry))) return null;
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
      !['assessed-clear', 'assessed-focus', 'self-guided', 'unavailable'].includes(String(properties.kind))
    ) return null;
  } else if (candidate.name === 'my_french_opened') {
    if (!exactKeys(properties, ['situationsDone', 'linesKept'])) return null;
    if (!nonNegativeCount(properties.situationsDone) || !nonNegativeCount(properties.linesKept)) return null;
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
