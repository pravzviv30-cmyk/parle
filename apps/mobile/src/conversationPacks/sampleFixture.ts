/**
 * A labelled sample conversation, for looking at the practice journey in a
 * local build. DEVELOPMENT ONLY, and refused everywhere else.
 *
 * Why this exists: Practice, My French and the conversation library read a
 * learner's own saved conversations, and a fresh local account has none, so
 * none of the new practice journey can be seen without a real paid live
 * session. This puts one clearly labelled sample into the signed-in mock
 * account's own stores, through the same writes a real delivery uses.
 *
 * Three conditions, all required, checked before anything is written:
 * - not a production build;
 * - the explicit local-development switch, the same one the mock adapter and
 *   the wall preview ride on;
 * - and the adapter actually running is the mock one. The two flags alone are
 *   not enough: a local build with Supabase configured still signs in for
 *   real, and a sample must never land in a real account.
 *
 * What it never does: overwrite. The sample pack is merged by its stable id
 * into whatever this account already has, and an existing pack with that id
 * is left exactly as it is. Cards merge through `addPhrases`, which keeps an
 * existing card's scheduling, and exercises through `mergeExercises`. No
 * history, resume record, grade or XP is written, so nothing here can be read
 * back as something the learner did. Mock auth has no token, so the sync
 * engine stays silent and none of it leaves the phone.
 *
 * The account is captured once, before the first await, and every write checks
 * it is still the account that asked; a sign-out mid-load stops it.
 */

import {
  buildConversationPack,
  phraseKeyOf,
  validateExercise,
  type ConversationPack,
  type DrillExercise,
  type TranslationExercise,
} from '@luvani/core';

import type { AuthAdapter, AuthUser } from '../auth/types.ts';
import { activeUserId } from '../storage/scope.ts';
import { addPhrases } from '../review/store.ts';
import { mergeExercises } from '../drill/store.ts';
import { loadConversationPacks, replaceConversationPacks } from './store.ts';
import { packExercisesFor, reviewPhrasesFor } from './packExercises.ts';

/** Said wherever the sample shows, so nobody mistakes it for their own conversation. */
export const SAMPLE_LABEL = 'Sample conversation';

/** Stable, and obviously not a session id the server would ever issue. */
export const SAMPLE_PACK_ID = 'sample-cafe-morning';

export interface SampleEnvironment {
  NODE_ENV?: string;
  EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT?: string;
}

/** Whether the sample may be offered at all. Every condition, or none. */
export function sampleAllowed(adapter: Pick<AuthAdapter, 'kind'>, env: SampleEnvironment = process.env): boolean {
  if (env.NODE_ENV === 'production') return false;
  if (env.EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT !== '1') return false;
  return adapter.kind === 'mock';
}

/** Whether a pack is the sample, so every surface can label it. */
export function isSamplePack(pack: Pick<ConversationPack, 'id'>): boolean {
  return pack.id === SAMPLE_PACK_ID;
}

/**
 * The sample, owned by this learner. Its phrases are chosen so it offers
 * real work: key phrases for translation, and a correction for the replay.
 */
export function samplePackFor(learnerId: string, createdAt: string): ConversationPack {
  return buildConversationPack({
    id: SAMPLE_PACK_ID,
    sessionId: SAMPLE_PACK_ID,
    learnerId,
    createdAt,
    title: { fr: 'Un matin au café', en: `A morning at the café (${SAMPLE_LABEL})` },
    summary: `${SAMPLE_LABEL}. Ordering breakfast and asking for the bill, made for trying the practice journey.`,
    keyPhrases: [
      { fr: 'Je voudrais un café.', en: 'I would like a coffee.', frWritten: null },
      { fr: 'Sur place, merci.', en: 'For here, thanks.', frWritten: null },
      { fr: 'Vous avez des croissants ?', en: 'Do you have croissants?', frWritten: null },
      { fr: "L'addition, s'il vous plaît.", en: 'The bill, please.', frWritten: null },
    ],
    corrections: [
      { quote: 'Je suis faim.', better: "J'ai faim.", betterEn: 'I am hungry.', why: 'Hunger takes avoir in French.' },
    ],
  });
}

/** The packs with the sample merged in by id. An existing pack with that id is kept as it is. */
export function withSample(existing: readonly ConversationPack[], sample: ConversationPack): ConversationPack[] {
  if (existing.some((pack) => pack.id === sample.id)) return [...existing];
  return [sample, ...existing];
}

export type SampleLoad = { ok: true; added: boolean } | { ok: false; reason: 'not-allowed' | 'account-changed' | 'failed' };

export async function loadSampleConversation(
  user: Pick<AuthUser, 'id'>,
  adapter: Pick<AuthAdapter, 'kind'>,
  now: number = Date.now(),
  env: SampleEnvironment = process.env,
): Promise<SampleLoad> {
  if (!sampleAllowed(adapter, env)) return { ok: false, reason: 'not-allowed' };
  // Captured before the first await. Every write below is for this account.
  const owner = user.id;
  if (activeUserId() !== owner) return { ok: false, reason: 'account-changed' };
  try {
    const sample = samplePackFor(owner, new Date(now).toISOString());
    const existing = await loadConversationPacks();
    if (activeUserId() !== owner) return { ok: false, reason: 'account-changed' };
    const added = !existing.some((pack) => pack.id === sample.id);
    if (added) await replaceConversationPacks(withSample(existing, sample));
    if (activeUserId() !== owner) return { ok: false, reason: 'account-changed' };
    // Cards and exercises merge, never replace: a card the learner already
    // owns keeps its scheduling, and nothing is graded.
    if ((await addPhrases(reviewPhrasesFor(sample), { stagger: true })) === 'failed') return { ok: false, reason: 'failed' };
    if (activeUserId() !== owner) return { ok: false, reason: 'account-changed' };
    if ((await mergeExercises(sampleExercises(sample))) === 'failed') return { ok: false, reason: 'failed' };
    return { ok: true, added };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

/**
 * The drills the sample offers: an English-to-French translation for every
 * key phrase, which is what a real server delivery carries, and the repair and
 * repeats the app always adds (`packExercisesFor`). Every one is validated by
 * core before it is offered.
 */
export function sampleExercises(sample: ConversationPack): DrillExercise[] {
  const translate: TranslationExercise[] = sample.keyPhrases.map((phrase, i) => ({
    id: `pack:${sample.id}:en-fr:${i}`,
    phraseKey: phraseKeyOf(phrase.fr),
    difficulty: 'production',
    kind: 'translate',
    fr: phrase.fr,
    en: phrase.en,
    direction: 'en-fr',
    accepted: [phrase.fr],
  }));
  return [...translate.filter((e) => validateExercise(e).ok), ...packExercisesFor(sample)];
}
