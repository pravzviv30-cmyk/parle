import { auth, authHeaders } from '../auth/adapter.ts';
import { TOKEN_SERVER } from '../live/serverUrl.ts';
import type { SoundCheckKind } from '../soundcheck/model.ts';
import { analyticsAllowed } from './consent.ts';
import { loadConsent } from './consentStore.ts';

/**
 * The ten events, and every property any of them may carry.
 *
 * This union is the allowlist. There is no free-text property and no `unknown`
 * escape hatch, so learner content cannot reach analytics by accident: it would
 * have to be added here first, deliberately, in a diff somebody reviewed.
 *
 * `onboarding_completed` lost `motivationAnswered` when the why page left the
 * first run. A boolean that can only ever be false is not evidence, it is a
 * question nobody is asked reporting its own absence. Removing a property is a
 * change in three places that must agree — this union, `parseProductEvent` in
 * the token server, and the `validate_product_event` trigger in PostgreSQL —
 * and until all three agree the event is rejected rather than stored.
 */
export type ProductEvent =
  | { name: 'onboarding_completed'; properties: { personalisedGreeting: boolean } }
  | { name: 'mission_started'; properties: { missionId: string; entry: 'chooser' | 'home' | 'my-french' } }
  | { name: 'mission_completed'; properties: { missionId: string; rung: number } }
  | { name: 'sound_check_completed'; properties: { missionId: string; kind: SoundCheckKind } }
  | { name: 'my_french_opened'; properties: { situationsDone: number; linesKept: number } }
  // The subscription wall. `pages` rides with `wall_shown` because the page list is
  // computed per showing, so a drop-off at index 2 means nothing without knowing how
  // many there were. Nothing here names a phrase, a situation or a price: `plan` is
  // our own tier id, and `outcome` is the same closed set restore.ts already answers
  // with. A monetisation surface nobody can measure is a surface nobody can improve,
  // and this is the smallest set that answers "which page lost them".
  | { name: 'wall_shown'; properties: { entry: 'path-complete' | 'refused' | 'settings' | 'recap'; pages: number } }
  | { name: 'wall_page_seen'; properties: { page: 'limit' | 'map' | 'french' | 'yours' | 'plans'; index: number } }
  | { name: 'plan_selected'; properties: { plan: 'starter' | 'regular' } }
  | { name: 'purchase_started'; properties: { plan: 'starter' | 'regular' } }
  | { name: 'purchase_settled'; properties: { plan: 'starter' | 'regular'; outcome: 'done' | 'nothing-granted' | 'cancelled' | 'store-trouble' | 'refresh-trouble' } };

/**
 * Fire-and-forget product evidence. No content fields exist in the type.
 *
 * The consent is read here, on every event, rather than held in a module
 * variable. A cached yes outlives the tap that withdrew it, and the learner who
 * turned the switch off goes on being counted until they quit the app: that is
 * exactly the shape of failure a consent exists to prevent, and one storage read
 * beside a network call costs nothing worth having.
 *
 * The gate sits inside the `try` that already swallows failures and before the
 * `fetch`, so an opted-out learner emits nothing rather than emitting something
 * the server discards. `loadConsent` throws rather than resolving with nobody
 * signed in, and that throw lands in the same `catch`: no account, no event.
 */
export async function trackProductEvent(event: ProductEvent): Promise<void> {
  try {
    const [user, headers, consent] = await Promise.all([auth.getSession(), authHeaders(), loadConsent()]);
    if (!user) return;
    if (!analyticsAllowed(consent)) return;
    await fetch(`${TOKEN_SERVER}/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ userId: user.id, ...event }),
    });
  } catch {
    // Analytics is evidence for product decisions, never a learner dependency.
  }
}
