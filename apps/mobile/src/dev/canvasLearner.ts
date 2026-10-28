/**
 * The canvas learner: one labelled, development-only learner so every slot on
 * the direction B artboards can be seen filled in a real local build. DEVELOPMENT
 * ONLY, and refused everywhere else.
 *
 * The canvas brief: the same learner in every screen, day 3, level 2, second
 * café scene next. Her name is Yasmin.
 *
 * Four conditions, all required, checked before anything is written:
 * - every lock `sampleAllowed` holds (not production, the local-development
 *   switch, and the mock auth adapter actually running);
 * - and its own switch, `EXPO_PUBLIC_LUVANI_CANVAS_LEARNER=1`, so turning on a
 *   local build never paints a learner nobody asked for.
 *
 * Everything goes through the owning stores' normal writes, never a raw key.
 * Nothing that already exists is overwritten: packs merge by id, cards through
 * `addPhrases` (an existing card keeps its scheduling), the activity log is
 * only painted on an account that has none, a mission already tried is left
 * alone, and the profile only gains a name or goal where none was set. So a
 * second run changes nothing.
 *
 * The account is captured once, before the first await, and every write checks
 * it is still the active account; a sign-out mid-seed stops it.
 */

import { QUEST_XP, buildConversationPack, evidenceOf, localDayKey, phraseKeyOf, type ConversationPack } from '@luvani/core';
import type { LearnerProfile } from '@luvani/brain/profile';

import type { AuthAdapter, AuthUser } from '../auth/types.ts';
import { activeUserId } from '../storage/scope.ts';
import { SAMPLE_LABEL, SAMPLE_PACK_ID, sampleAllowed, sampleExercises, samplePackFor, type SampleEnvironment } from '../conversationPacks/sampleFixture.ts';
import { loadConversationPacks, replaceConversationPacks } from '../conversationPacks/store.ts';
import { reviewPhrasesFor } from '../conversationPacks/packExercises.ts';
import { addPhrases, gradeCard, loadDeck } from '../review/store.ts';
import { mergeExercises } from '../drill/store.ts';
import { loadMissionCompletions, recordMissionCompletion } from '../missions/store.ts';
import { loadActivity, recordActivityOnce } from '../progress/activity.ts';
import { addClaims, setQuestDay } from '../game/store.ts';
import { createStoredProfile, loadProfile, saveMemoryChange, saveProfile, withDailyGoal, withName, type StoredProfile } from '../profile/store.ts';


/**
 * The canvas brief's learner is level 2. Core's bands put level 2 at 50 to
 * 124 XP (`levels/levels.ts`), so the seed stays inside them rather than
 * copying the artboard's 140, which would read as level 3.
 */
export const CANVAS_XP = 120;
export const CANVAS_NAME = 'Yasmin';
/** The revisit of the sample, Au café du coin. Stable, and never a server id. */
export const CANVAS_REVISIT_PACK_ID = 'sample-cafe-corner';

export interface CanvasEnvironment extends SampleEnvironment {
  EXPO_PUBLIC_LUVANI_CANVAS_LEARNER?: string;
}

/**
 * Read member by member: Expo inlines `process.env.EXPO_PUBLIC_*` only where
 * it is written out, so passing `process.env` whole would read as unset.
 */
/**
 * `fresh` first clears the signed-in mock account's own local data, through
 * the same reset an account deletion uses, so every screenshot run starts from
 * the same learner. Only ever reached behind every lock in `canvasAllowed`.
 */
export function canvasStartsFresh(env: CanvasEnvironment = defaultEnv()): boolean {
  return env.EXPO_PUBLIC_LUVANI_CANVAS_LEARNER === 'fresh';
}

function defaultEnv(): CanvasEnvironment {
  return {
    NODE_ENV: process.env.NODE_ENV,
    EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT: process.env.EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT,
    EXPO_PUBLIC_LUVANI_CANVAS_LEARNER: process.env.EXPO_PUBLIC_LUVANI_CANVAS_LEARNER,
  };
}

export function canvasAllowed(adapter: Pick<AuthAdapter, 'kind'>, env: CanvasEnvironment = defaultEnv()): boolean {
  const flag = env.EXPO_PUBLIC_LUVANI_CANVAS_LEARNER;
  return sampleAllowed(adapter, env) && (flag === '1' || flag === 'fresh');
}

export type CanvasSeed = { ok: true } | { ok: false; reason: 'not-allowed' | 'account-changed' | 'failed' };

const MIN_MS = 60 * 1000;

/** Six in the evening, `daysAgo` local days before `now`. */
function eveningOf(now: number, daysAgo: number): number {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(18, 0, 0, 0);
  return d.getTime();
}

/** The revisit: Au café du coin, after the sample, with a gender fix. */
export function revisitPackFor(learnerId: string, createdAt: string): ConversationPack {
  return buildConversationPack({
    id: CANVAS_REVISIT_PACK_ID,
    sessionId: CANVAS_REVISIT_PACK_ID,
    learnerId,
    createdAt,
    title: { fr: 'Au café du coin', en: `At the corner café (${SAMPLE_LABEL})` },
    summary: `${SAMPLE_LABEL}. Ordering a drink and something to eat, then paying.`,
    keyPhrases: [
      { fr: "Un croissant, s'il vous plaît.", en: 'A croissant, please.', frWritten: null },
      { fr: 'Je vous dois combien ?', en: 'How much do I owe you?', frWritten: null },
      { fr: 'Bonne journée !', en: 'Have a good day!', frWritten: null },
    ],
    wins: ['Je vous dois combien ?'],
    corrections: [
      { quote: "Une croissant, s'il vous plaît.", better: "Un croissant, s'il vous plaît.", betterEn: 'A croissant, please.', why: 'Croissant is masculine, so it takes un.' },
    ],
    revisedFromPackId: SAMPLE_PACK_ID,
  });
}

const CANVAS_FACTS: LearnerProfile['memory']['facts'] = [
  { kind: 'interest', fr: null, en: 'Loves food and cafés', happensAround: null, notedAt: '', source: 'conversation', updatedAt: '' },
  { kind: 'life-event', fr: null, en: 'Dinner in Lyon', happensAround: 'Friday', notedAt: '', source: 'conversation', updatedAt: '' },
];

/** The profile edits still owed, or null when the canvas already holds. Never overwrites a set value. */
function profileEdits(held: StoredProfile | null, now: number): StoredProfile | null {
  let next = held ?? createStoredProfile({ name: CANVAS_NAME, ageConfirmed: true, motivation: null, dailyGoalMin: 10 }, now);
  if (next.name === null || next.name.trim() === '') next = withName(next, CANVAS_NAME);
  if (next.dailyGoalMin === null) next = withDailyGoal(next, 10);
  return held !== null && next === held ? null : next;
}

function memoryOwed(profile: StoredProfile): boolean {
  const known = new Set(profile.brain.memory.facts.map((f) => f.en));
  return CANVAS_FACTS.some((f) => !known.has(f.en)) || !('gender-agreement' in profile.brain.errorPatterns);
}

function withCanvasMemory(profile: StoredProfile, now: number): StoredProfile {
  const known = new Set(profile.brain.memory.facts.map((f) => f.en));
  const notedAt = new Date(now).toISOString();
  const facts = [...profile.brain.memory.facts, ...CANVAS_FACTS.filter((f) => !known.has(f.en)).map((f) => ({ ...f, notedAt }))];
  const errorPatterns = 'gender-agreement' in profile.brain.errorPatterns
    ? profile.brain.errorPatterns
    : { ...profile.brain.errorPatterns, 'gender-agreement': { count: 3, lastSeen: notedAt, example: "Une croissant, s'il vous plaît.", sessions: 1, lastSession: profile.brain.stats.sessions } };
  return { ...profile, brain: { ...profile.brain, errorPatterns, memory: { ...profile.brain.memory, facts } } };
}

export async function seedCanvasLearner(
  user: Pick<AuthUser, 'id'>,
  adapter: Pick<AuthAdapter, 'kind'>,
  now: number = Date.now(),
  env: CanvasEnvironment = defaultEnv(),
): Promise<CanvasSeed> {
  if (!canvasAllowed(adapter, env)) return { ok: false, reason: 'not-allowed' };
  // Captured before the first await. Every write below is for this account.
  const owner = user.id;
  const mine = () => activeUserId() === owner;
  const changed = { ok: false, reason: 'account-changed' } as const;
  // A refused write after a sign-out is the account changing, not a failure.
  const fail = (): CanvasSeed => (mine() ? { ok: false, reason: 'failed' } : changed);
  if (!mine()) return changed;
  try {
    // Profile: name and daily goal, then the tutor's memory and a pattern.
    const edits = profileEdits(await loadProfile(), now);
    if (!mine()) return changed;
    if (edits && !(await saveProfile(edits))) return fail();
    if (!mine()) return changed;
    const profile = await loadProfile();
    if (!mine()) return changed;
    if (profile && memoryOwed(profile) && (await saveMemoryChange((p) => withCanvasMemory(p, now))) === null) return fail();

    // Packs: the sample two days ago, its revisit yesterday. Merged by id.
    const sample = samplePackFor(owner, new Date(eveningOf(now, 2)).toISOString());
    const revisit = revisitPackFor(owner, new Date(eveningOf(now, 1)).toISOString());
    if (!mine()) return changed;
    const packs = await loadConversationPacks();
    if (!mine()) return changed;
    const missing = [revisit, sample].filter((pack) => !packs.some((held) => held.id === pack.id));
    if (missing.length > 0) await replaceConversationPacks([...missing, ...packs]);

    // Deck and drills: merged, so a held card keeps its scheduling.
    for (const pack of [sample, revisit]) {
      if (!mine()) return changed;
      const uses = pack === sample ? [{ fr: 'Je voudrais un café.', uses: 2 }] : [];
      if ((await addPhrases(reviewPhrasesFor(pack), { source: 'sample', stagger: true, convoUses: uses })) === 'failed') return fail();
      if (!mine()) return changed;
      if ((await mergeExercises(sampleExercises(pack))) === 'failed') return fail();
    }
    // One recall, once: only while the card has none.
    if (!mine()) return changed;
    const recallId = phraseKeyOf('Sur place, merci.');
    const card = (await loadDeck()).find((c) => c.id === recallId);
    if (!mine()) return changed;
    if (card && evidenceOf(card).retrievals === 0) await gradeCard(recallId, 'good', { attempt: 'typed' });

    // Scenes: Le premier café done on her own, Au café du coin tried with choices.
    if (!mine()) return changed;
    const done = await loadMissionCompletions();
    const tried = new Set(done.map((c) => c.id));
    if (!tried.has('mission:premier-cafe')) {
      if (!mine()) return changed;
      await recordMissionCompletion('mission:premier-cafe', 1, eveningOf(now, 2));
      if (!mine()) return changed;
      await recordMissionCompletion('mission:premier-cafe', 4, eveningOf(now, 1));
    }
    if (!tried.has('mission:cafe')) {
      if (!mine()) return changed;
      await recordMissionCompletion('mission:cafe', 2, eveningOf(now, 1) + 30 * MIN_MS);
    }

    // Activity: three days in a row, 130 XP, 6 measured minutes today. Only on
    // an account with no log, so a real history is never added to.
    if (!mine()) return changed;
    if ((await loadActivity()).length === 0) {
      const rows = [
        { at: eveningOf(now, 2), xp: 40, activeMs: 8 * MIN_MS },
        { at: eveningOf(now, 1), xp: 50, activeMs: 9 * MIN_MS },
        { at: Math.max(now - MIN_MS, eveningOf(now, 0) - 18 * 60 * MIN_MS), xp: CANVAS_XP - 40 - 50 - QUEST_XP, activeMs: 6 * MIN_MS },
      ];
      for (const row of rows) {
        if (!mine()) return changed;
        if ((await recordActivityOnce('convo', row.xp, row.at, { activeMs: row.activeMs, finished: true })) === 'failed') return fail();
      }
    }

    // Today's quests: three dealt (frozen if already dealt), one claimed.
    const today = localDayKey(now);
    if (!mine()) return changed;
    await setQuestDay({ day: today, ids: ['finish-practice', 'practise-twice', 'sound-check'], at: now });
    if (!mine()) return changed;
    await addClaims([{ day: today, questId: 'finish-practice', xp: QUEST_XP, at: now }]);
    return { ok: true };
  } catch {
    return fail();
  }
}
