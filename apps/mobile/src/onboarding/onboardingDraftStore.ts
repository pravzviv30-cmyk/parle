/** Unfinished onboarding belongs to the active account and is cleared on reset. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isTutorVoiceKey, type TutorVoiceKey } from '@luvani/core';
import { scopeGeneration, userKey, writeInUserScope } from '../storage/scope.ts';
import { PAGES, type Page } from './answers.ts';
import { repaired, type PreAccountOnboardingDraft } from './preAccountDraft.ts';

export interface RepairDraft {
  page: Page;
  name: string;
  oldEnough: boolean | null;
  voice: TutorVoiceKey | null;
  analyticsConsent: boolean | null;
  completedSteps: string[];
}
let chain: Promise<unknown> = Promise.resolve();
function save(key: string, data: unknown) {
  const owner = scopeGeneration();
  const encoded = JSON.stringify(data);
  const next = chain.then(() => writeInUserScope(owner, () => AsyncStorage.setItem(key, encoded))).catch(() => false);
  chain = next;
  return next;
}
async function read(key: string): Promise<unknown> {
  const owner = scopeGeneration();
  try { const raw = await AsyncStorage.getItem(key); return owner === scopeGeneration() && raw ? JSON.parse(raw) : null; }
  catch { return null; }
}
function clear(key: string) {
  // Clearing a captured old-account key remains safe after sign-out. Unlike a
  // write it cannot resurrect or touch the next account's namespace.
  const next = chain.then(() => AsyncStorage.removeItem(key)).then(() => true).catch(() => false);
  chain = next;
  return next;
}
export async function loadSetupDraft(): Promise<PreAccountOnboardingDraft | null> {
  const value = await read(userKey('onboarding-setup-draft'));
  return value !== null && typeof value === 'object' && (value as { version?: unknown }).version === 1 ? repaired(value) : null;
}
export function saveSetupDraft(draft: PreAccountOnboardingDraft) { return save(userKey('onboarding-setup-draft'), draft); }
export function clearSetupDraft() { return clear(userKey('onboarding-setup-draft')); }
export async function loadRepairDraft(): Promise<RepairDraft | null> {
  const raw = await read(userKey('onboarding-repair-draft'));
  if (typeof raw !== 'object' || raw === null) return null;
  const value = raw as Partial<RepairDraft>;
  if (!PAGES.includes(value.page as Page)) return null;
  // A refusal stores no personal answers and cannot resume beyond the gate.
  const oldEnough = value.oldEnough === true ? true : value.oldEnough === false ? false : null;
  return { page: oldEnough === true ? value.page as Page : 'age', name: oldEnough === true && typeof value.name === 'string' ? value.name.slice(0, 40) : '', oldEnough,
    voice: isTutorVoiceKey(value.voice) ? value.voice : null,
    analyticsConsent: typeof value.analyticsConsent === 'boolean' ? value.analyticsConsent : null,
    completedSteps: Array.isArray(value.completedSteps) ? value.completedSteps.filter(step => (PAGES as readonly string[]).includes(step)) : [],
  };
}
export function saveRepairDraft(draft: RepairDraft) {
  if (draft.oldEnough === false) return clearRepairDraft();
  return save(userKey('onboarding-repair-draft'), draft);
}
export function clearRepairDraft() { return clear(userKey('onboarding-repair-draft')); }
