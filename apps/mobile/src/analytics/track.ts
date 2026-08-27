import { auth, authHeaders } from '../auth/adapter.ts';
import { TOKEN_SERVER } from '../live/serverUrl.ts';
import type { SoundCheckKind } from '../soundcheck/model.ts';

/**
 * The five events, and every property any of them may carry.
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
  | { name: 'my_french_opened'; properties: { situationsDone: number; linesKept: number } };

/** Fire-and-forget product evidence. No content fields exist in the type. */
export async function trackProductEvent(event: ProductEvent): Promise<void> {
  try {
    const [user, headers] = await Promise.all([auth.getSession(), authHeaders()]);
    if (!user) return;
    await fetch(`${TOKEN_SERVER}/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ userId: user.id, ...event }),
    });
  } catch {
    // Analytics is evidence for product decisions, never a learner dependency.
  }
}
