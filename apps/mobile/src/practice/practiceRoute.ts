/**
 * How a practice sitting travels through navigation, and how it is read back.
 *
 * Only flat, safe identifiers go in the route: which kind of sitting, which
 * conversation, and whether the French was just shown. On the web the route
 * is the address bar, so an object param is written as "[object Object]" and
 * a reload hands the screen that string. Nothing here is ever an object.
 *
 * The chosen targets are NOT carried. The screen rebuilds the selection from
 * the learner's own stores when it opens, through the same selector the card
 * used, and a sitting already under way is restored from the local resume
 * record rather than from the address. A link that cannot be read is
 * reported as such, never silently opened as a different sitting.
 */

/**
 * Which sitting a link opens. 'resume' opens the one sitting saved on this
 * phone, whatever it was; its targets and warm-up flag come from that record,
 * never from the link.
 */
export type PracticeRouteOrigin = 'recommended' | 'pack' | 'resume';

export interface PracticeRoute {
  origin: PracticeRouteOrigin;
  /** The saved conversation, for a pack sitting. Null for a recommended one. */
  packId: string | null;
  /** The French was just shown, by the recognition warm-up. */
  exposed: boolean;
}

/** The Drill route's practice fields, all plain strings. */
export interface PracticeRouteParams {
  practice: PracticeRouteOrigin;
  packId?: string;
  exposed?: '1';
}

/** Conversation ids are server-issued identifiers; anything else is refused. */
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;

export function practiceRouteParams(route: PracticeRoute): PracticeRouteParams {
  return {
    practice: route.origin,
    ...(route.packId !== null ? { packId: route.packId } : {}),
    ...(route.exposed ? { exposed: '1' as const } : {}),
  };
}

/**
 * Read the Drill route's practice fields.
 *
 * `null` when the route is not a practice sitting at all, which leaves the
 * ordinary scheduled drill exactly as it was. `'invalid'` when it claims to be
 * one but cannot be read, so the screen can say so. `exposed` accepts the
 * forms a reload produces ('1', 'true') as well as a boolean.
 */
export function parsePracticeRoute(params: unknown): PracticeRoute | 'invalid' | null {
  if (typeof params !== 'object' || params === null) return null;
  const raw = params as Record<string, unknown>;
  if (!('practice' in raw) || raw.practice === undefined) return null;

  const origin = raw.practice;
  if (origin !== 'recommended' && origin !== 'pack' && origin !== 'resume') return 'invalid';

  const packRaw = raw.packId;
  let packId: string | null = null;
  if (packRaw !== undefined) {
    if (typeof packRaw !== 'string' || !SAFE_ID.test(packRaw)) return 'invalid';
    packId = packRaw;
  }
  if (origin === 'pack' && packId === null) return 'invalid';

  const exposedRaw = raw.exposed;
  const exposed = exposedRaw === true || exposedRaw === '1' || exposedRaw === 'true';
  if (exposedRaw !== undefined && !exposed && exposedRaw !== false && exposedRaw !== '0' && exposedRaw !== 'false') return 'invalid';

  return { origin, packId, exposed };
}
