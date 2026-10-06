import { loadConsent } from '../analytics/consentStore.ts';
import { activeUserId, scopeGeneration } from '../storage/scope.ts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import { authHeaders } from '../auth/adapter.ts';
import { installationId } from '../auth/installation.ts';
import { TOKEN_SERVER } from '../live/serverUrl.ts';
import { checkStarter, type StarterFeedback, type StarterTask } from '@luvani/core';
import type { PreAccountOnboardingDraft } from './preAccountDraft.ts';
const KEY = '@luvani/guest-practice/v2';
import { repairGuestPractice, type GuestPractice, type GuestAttempt } from './guestModel.ts';
import { keepFinishes, starterMinutes } from './guestProgress.ts';
import { SPEECH_UNAVAILABLE } from './firstRun/speech.ts';
export type { GuestPractice, GuestAttempt } from './guestModel.ts';
let writes: Promise<unknown> = Promise.resolve();
let writeGeneration = 0;
export function saveGuestPractice(value: GuestPractice): Promise<void> {
  const raw = JSON.stringify(value);
  const owner = writeGeneration;
  const work = writes.then(() =>
    owner === writeGeneration ? AsyncStorage.setItem(KEY, raw) : undefined,
  );
  writes = work.catch(() => {});
  return work;
}
export async function loadGuestPractice(): Promise<GuestPractice | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? repairGuestPractice(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
export async function clearGuestPractice(): Promise<void> {
  writeGeneration++;
  const work = writes.then(() => AsyncStorage.removeItem(KEY));
  writes = work.catch(() => {});
  return work;
}
async function post(
  path: string,
  value?: unknown,
  guest?: GuestPractice,
  bytes?: Blob | Uint8Array,
  taskId?: string,
  activeSeconds = 0,
): Promise<Record<string, unknown>> {
  const response = await fetch(`${TOKEN_SERVER}/onboarding/${path}`, {
    method: 'POST',
    signal: AbortSignal.timeout(12000),
    headers: {
      'content-type': bytes ? 'application/octet-stream' : 'application/json',
      'x-luvani-installation': await installationId(),
      ...(guest?.token ? { 'x-luvani-guest': guest.token } : {}),
      ...(taskId ? { 'x-luvani-task': taskId } : {}),
      'x-luvani-active-seconds': String(activeSeconds),
    },
    body: (bytes ?? JSON.stringify(value)) as BodyInit,
  });
  // A take the service will not transcribe (guest speech closed or its budget
  // spent) is a 503 from /onboarding/audio. It spent no attempt, so the first
  // run moves calmly to typing rather than saying the tutor cannot connect (F756).
  if (!response.ok)
    throw new Error(
      response.status === 410
        ? 'expired'
        : response.status === 409
          ? 'limit'
          : response.status === 503 && path === 'audio'
            ? SPEECH_UNAVAILABLE
            : 'unavailable',
    );
  return (await response.json()) as Record<string, unknown>;
}
/**
 * A new guest practice from the service. `prior` is the record it replaces: the
 * days it saw finished stay with the phone (F751), and nothing else of it does.
 */
export async function startGuestPractice(plan: PreAccountOnboardingDraft, prior: GuestPractice | null = null): Promise<GuestPractice> {
  if (!plan.eligibilityConfirmed) throw new Error('eligibility required');
  const data = await post('start', {
    eligible: true,
    goal: plan.reason ?? 'food',
    drink: plan.drink ?? 'coffee',
    minutes: starterMinutes(plan.minutes),
    analyticsAllowed: plan.analyticsConsent === true,
    variant: process.env.EXPO_PUBLIC_ONBOARDING_VARIANT === 'five' ? 'five' : 'full',
  });
  if (
    typeof data.token !== 'string' ||
    typeof data.expiresAt !== 'number' ||
    typeof data.id !== 'string'
  )
    throw new Error('unavailable');
  const next: GuestPractice = {
    version: 2,
    token: data.token,
    expiresAt: data.expiresAt,
    id: data.id,
    speechAvailable: data.speechAvailable === true,
    secondsUsed: 0,
    attempts: [],
    kept: false,
    completed: false,
    plan,
  };
  // The carried days go through the same repair as the rest, so the new record
  // holds them exactly as a record read back from the disk would.
  const valid = repairGuestPractice(keepFinishes(next, prior));
  if (!valid) throw new Error('unavailable');
  return valid;
}
/** A local practice with no capability; like a started one, it keeps the days `prior` saw finished (F751). */
export function offlineGuestPractice(plan: PreAccountOnboardingDraft, prior: GuestPractice | null = null): GuestPractice {
  const local: GuestPractice = {
    version: 2,
    token: null,
    expiresAt: 0,
    id: null,
    secondsUsed: 0,
    attempts: [],
    kept: false,
    completed: false,
    plan,
  };
  return keepFinishes(local, prior);
}
export async function sendGuestAttempt(
  guest: GuestPractice,
  task: StarterTask,
  reply: string,
  uri?: string,
  activeSeconds = 0,
): Promise<GuestAttempt & { secondsUsed: number }> {
  if (!guest.token || guest.offline)
    return {
      taskId: task.id,
      reply,
      feedback: checkStarter(task, reply, 'typed'),
      offline: true,
      at: Date.now(),
      secondsUsed: guest.secondsUsed,
    };
  const bytes = uri
    ? Platform.OS === 'web'
      ? await (await fetch(uri)).blob()
      : await new File(uri).bytes()
    : undefined;
  if (bytes && (bytes instanceof Uint8Array ? bytes.byteLength : bytes.size) > 2 * 1024 * 1024)
    throw new Error('recording too large');
  const data = await post(
    uri ? 'audio' : 'attempt',
    uri ? undefined : { taskId: task.id, reply, activeSeconds },
    guest,
    bytes,
    task.id,
    activeSeconds,
  );
  if (
    typeof data.reply !== 'string' ||
    typeof data.accepted !== 'boolean' ||
    typeof data.text !== 'string' ||
    typeof data.model !== 'string' ||
    typeof data.secondsUsed !== 'number'
  )
    throw new Error('unavailable');
  return {
    taskId: task.id,
    reply: data.reply,
    feedback: {
      accepted: data.accepted,
      text: data.text,
      model: data.model,
      evidence: uri ? 'spoken' : 'typed',
    },
    offline: false,
    at: Date.now(),
    secondsUsed: data.secondsUsed,
  };
}
/** An authenticated, idempotent transfer; the guest secret cannot address another account. */
export async function adoptGuestUsage(
  guest: GuestPractice,
  userId: string,
): Promise<number | null> {
  if (!guest.token) return null;
  const response = await fetch(`${TOKEN_SERVER}/onboarding/claim`, {
    method: 'POST',
    signal: AbortSignal.timeout(12000),
    headers: {
      'content-type': 'application/json',
      'x-luvani-guest': guest.token,
      'x-luvani-installation': await installationId(),
      ...(await authHeaders()),
    },
    body: JSON.stringify({ userId }),
  });
  if (!response.ok) throw new Error('Your practice could not be linked yet. Try again.');
  const data = (await response.json()) as { secondsRemaining?: unknown };
  if (typeof data.secondsRemaining !== 'number')
    throw new Error('Your minutes could not be checked yet.');
  return data.secondsRemaining;
}

export type GuestMetric =
  | 'practice_started'
  | 'useful_reply'
  | 'feedback_seen'
  | 'retry'
  | 'help_used'
  | 'phrase_kept'
  | 'save_progress'
  | 'useful_return'
  | 'practice_finished';
/** Consent is checked at the action, and the server independently checks the start-time opt-in. */
export async function trackGuestMetric(
  guest: GuestPractice | null,
  allowed: boolean,
  name: GuestMetric,
  evidence: 'typed' | 'spoken' | 'none' = 'none',
): Promise<void> {
  if (!allowed || !guest?.token || guest.expiresAt <= Date.now()) return;
  try {
    await post('event', { name, evidence }, guest);
  } catch {
    /* Evidence is optional. */
  }
}

export async function trackAccountStarter(userId: string, name: GuestMetric, evidence: 'typed' | 'spoken' | 'none'): Promise<void> {
  const owner = scopeGeneration();
  try {
    const consent = await loadConsent();
    if (consent?.allowed !== true || owner !== scopeGeneration() || activeUserId() !== userId) return;
    const headers = await authHeaders();
    if (owner !== scopeGeneration()) return;
    await fetch(`${TOKEN_SERVER}/onboarding/account-event`, { method: 'POST', signal: AbortSignal.timeout(5000), headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ ...(process.env.EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT === '1' ? { userId } : {}), analyticsAllowed: true, name, evidence }) });
  } catch { /* Optional aggregate evidence is never a condition of practice. */ }
}
