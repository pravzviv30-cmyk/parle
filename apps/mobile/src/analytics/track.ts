import { auth, authHeaders } from '../auth/adapter.ts';
import { TOKEN_SERVER } from '../live/serverUrl.ts';

export type ProductEvent =
  | { name: 'onboarding_completed'; properties: { personalisedGreeting: boolean; motivationAnswered: boolean } }
  | { name: 'mission_started'; properties: { missionId: string; entry: 'chooser' | 'home' | 'my-french' } }
  | { name: 'mission_completed'; properties: { missionId: string; rung: number } }
  | { name: 'sound_check_completed'; properties: { missionId: string; kind: string } }
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
