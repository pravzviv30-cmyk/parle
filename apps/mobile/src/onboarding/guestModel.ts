import { starterTasks, type StarterFeedback } from '@luvani/core';
import { repaired, type PreAccountOnboardingDraft } from './preAccountDraft.ts';

export interface GuestAttempt {
  taskId: string;
  reply: string;
  feedback: StarterFeedback;
  at: number;
  offline: boolean;
  kept?: boolean;
}
export interface GuestPractice {
  version: 2;
  token: string | null;
  expiresAt: number;
  id: string | null;
  secondsUsed: number;
  offline?: boolean;
  speechAvailable?: boolean;
  attempts: GuestAttempt[];
  kept: boolean;
  completed: boolean;
  plan: PreAccountOnboardingDraft;
}
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;
const text = (value: unknown, max = 600): value is string =>
  typeof value === 'string' && value.length <= max;
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** A corrupt disk cannot invent eligibility, an attempt or a usable capability. */
export function repairGuestPractice(value: unknown): GuestPractice | null {
  if (
    !record(value) ||
    value.version !== 2 ||
    !record(value.plan) ||
    value.plan.version !== 1 ||
    value.plan.eligibilityConfirmed !== true
  )
    return null;
  const plan = repaired(value.plan);
  const tasks = starterTasks(plan.reason, plan.drink ?? 'coffee', plan.minutes ?? 5);
  if (
    value.token !== null &&
    (typeof value.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value.token))
  )
    return null;
  if (value.id !== null && (typeof value.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(value.id)))
    return null;
  if (value.token !== null && value.id === null) return null;
  if (
    !finite(value.expiresAt) ||
    !finite(value.secondsUsed) ||
    value.secondsUsed > 360 ||
    !Array.isArray(value.attempts) ||
    value.attempts.length > 100
  )
    return null;
  const attempts: GuestAttempt[] = [];
  for (const item of value.attempts) {
    if (
      !record(item) ||
      !text(item.taskId, 64) ||
      !tasks.some((task) => task.id === item.taskId) ||
      !text(item.reply) ||
      !finite(item.at) ||
      !record(item.feedback)
    )
      return null;
    const feedback = item.feedback;
    if (
      typeof feedback.accepted !== 'boolean' ||
      !text(feedback.text, 1000) ||
      !text(feedback.model) ||
      !['typed', 'spoken', 'model'].includes(String(feedback.evidence))
    )
      return null;
    attempts.push({
      taskId: item.taskId,
      reply: item.reply,
      at: item.at,
      offline: item.offline === true,
      ...(item.kept === true ? { kept: true } : {}),
      feedback: {
        accepted: feedback.accepted,
        text: feedback.text,
        model: feedback.model,
        evidence: feedback.evidence as StarterFeedback['evidence'],
      },
    });
  }
  return {
    version: 2,
    plan,
    token: value.token as string | null,
    id: value.id as string | null,
    expiresAt: value.expiresAt,
    secondsUsed: value.secondsUsed,
    offline: value.offline === true,
    speechAvailable: value.speechAvailable === true,
    attempts,
    kept: value.kept === true,
    completed: value.completed === true,
  };
}

/** Resume the introduced task before moving to another one. */
export function continuingTask(guest: GuestPractice, retry = false) {
  const tasks = starterTasks(
    guest.plan.reason,
    guest.plan.drink ?? 'coffee',
    guest.plan.minutes ?? 5,
  );
  const last = guest.attempts.at(-1);
  const index = Math.max(
    0,
    tasks.findIndex((task) => task.id === last?.taskId),
  );
  return tasks[!retry && last?.feedback.accepted ? Math.min(index + 1, tasks.length - 1) : index]!;
}

/** An offline route change never discards a service capability or its usage debt. */
export function offlineContinuation(
  plan: PreAccountOnboardingDraft,
  prior: GuestPractice | null,
): GuestPractice {
  const same =
    prior &&
    !prior.completed &&
    JSON.stringify([prior.plan.reason, prior.plan.drink, prior.plan.minutes]) ===
      JSON.stringify([plan.reason, plan.drink, plan.minutes]);
  if (same) return { ...prior, offline: true };
  return {
    version: 2,
    plan,
    token: prior?.token ?? null,
    id: prior?.id ?? null,
    expiresAt: prior?.expiresAt ?? 0,
    secondsUsed: prior?.secondsUsed ?? 0,
    attempts: [],
    kept: false,
    completed: false,
    offline: true,
  };
}
