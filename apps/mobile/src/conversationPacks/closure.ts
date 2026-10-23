/**
 * The closure a conversation earns (F552).
 *
 * The end card listed everything: twelve phrases, four fixes, every win. The
 * founder's brief asks for a closure instead, one that says what happened and
 * what to keep: three phrases worth keeping, one repair, one focus, one next
 * situation, what went well, and a summary. This chooses them from the pack,
 * or from the live recap before the pack exists, and invents nothing: an
 * absent focus is null, not a sentence made up to fill the slot.
 *
 * The three phrases prefer the ones the learner has not yet used in a
 * conversation, read off the deck's own evidence, because a phrase that came
 * out unasked is theirs already and the slot is worth more on one that is not.
 *
 * The focus comes from the strongest evidence available, in this order: a
 * sound scored live in this conversation, when the learner said the line the
 * tutor handed them (VOICE-004); the newest sound check, which measured the learner's own voice against a known
 * line; the tutor's own one-sentence focus for this conversation, which is
 * about clarity rather than sound; and a cadence connector the learner has not
 * yet produced. The pack's `pronunciationFocus` is not read, because nothing
 * writes it (F558).
 */

import {
  evidenceStateOf,
  phraseKeyOf,
  suggestedMission,
  type ConversationPack,
  type MissionProgress,
  type RecapPayload,
  type ReviewCard,
} from '@luvani/core';

import { acousticFor, type Acoustic } from '../myfrench/acoustic.ts';
import { cadenceFrom } from '../myfrench/cadence.ts';
import type { SoundCheckEvidence } from '../soundcheck/model.ts';
import { soundExampleWord } from '../tutor/soundExample.ts';

export const MAX_CLOSURE_PHRASES = 3;
export const MAX_CLOSURE_WINS = 3;

export interface ClosureContext {
  progress: readonly MissionProgress[];
  deck: readonly ReviewCard[];
  checks: readonly SoundCheckEvidence[];
}

export type ClosureFocus =
  /**
   * `example` is a word for the sound, so the card can lead with a word. A
   * 'check' focus came from a saved sound check on `missionId`; a 'live' focus
   * was heard in this conversation, when the learner said the line they were
   * given, and `example` is the word it was heard in.
   */
  | { kind: 'sound'; source: 'check'; ipa: string; acoustic: Acoustic; missionId: string; example: string | null }
  | { kind: 'sound'; source: 'live'; ipa: string; acoustic: Acoustic; example: string | null }
  | { kind: 'clarity'; line: string }
  | { kind: 'cadence'; fr: string; en: string; note: string };

export interface ClosurePhrase {
  fr: string;
  en: string;
  key: string;
}

export interface ClosureRepair {
  quote: string;
  better: string;
  betterEn: string;
  why: string;
}

export interface Closure {
  title: string;
  summary: string;
  didWell: readonly string[];
  phrases: readonly ClosurePhrase[];
  repair: ClosureRepair | null;
  focus: ClosureFocus | null;
  nextMission: MissionProgress | null;
}

/** What a pack and a recap have in common, which is everything the closure reads. */
export interface ClosureParts {
  title: string;
  summary: string;
  wins: readonly string[];
  phrases: readonly { fr: string; en: string }[];
  corrections: readonly ClosureRepair[];
  /** The tutor's own one-sentence focus for this conversation, or null. */
  clarity: string | null;
  /** The one sound scored live in this conversation (VOICE-004), when there was one. */
  liveSound?: { ipa: string; word: string } | null;
}

/** The newest sound check that named a sound this build can say something about. */
export function soundFocus(checks: readonly SoundCheckEvidence[]): { acoustic: Acoustic; missionId: string; ipa: string } | null {
  const newest = [...checks].filter((check) => check.phoneme !== null).sort((a, b) => b.at - a.at)[0];
  if (newest === undefined || newest.phoneme === null) return null;
  const acoustic = acousticFor(newest.phoneme);
  return acoustic === null ? null : { acoustic, missionId: newest.missionId, ipa: newest.phoneme };
}

function focusFor(parts: ClosureParts, ctx: ClosureContext | null): ClosureFocus | null {
  // This conversation's own evidence outranks a saved check from an earlier one.
  const live = parts.liveSound ?? null;
  const liveAcoustic = live === null ? null : acousticFor(live.ipa);
  if (live !== null && liveAcoustic !== null) {
    return { kind: 'sound', source: 'live', ipa: live.ipa, acoustic: liveAcoustic, example: soundExampleWord(live.ipa, live.word) };
  }
  if (ctx !== null) {
    const sound = soundFocus(ctx.checks);
    if (sound !== null) return { kind: 'sound', source: 'check', ipa: sound.ipa, acoustic: sound.acoustic, missionId: sound.missionId, example: soundExampleWord(sound.ipa) };
  }
  const clarity = parts.clarity?.trim() ?? '';
  if (clarity.length > 0) return { kind: 'clarity', line: clarity };
  if (ctx !== null) {
    const next = cadenceFrom({ deck: ctx.deck }).words.find((word) => !word.yours);
    if (next !== undefined) return { kind: 'cadence', fr: next.fr, en: next.en, note: next.note };
  }
  return null;
}

function phrasesFor(parts: ClosureParts, deck: readonly ReviewCard[]): ClosurePhrase[] {
  const keyed = parts.phrases
    .map((phrase) => ({ fr: phrase.fr.trim(), en: phrase.en.trim(), key: phraseKeyOf(phrase.fr) }))
    .filter((phrase) => phrase.fr.length > 0 && phrase.en.length > 0);
  const seen = new Set<string>();
  const unique = keyed.filter((phrase) => (seen.has(phrase.key) ? false : (seen.add(phrase.key), true)));
  const used = (phrase: ClosurePhrase): boolean => {
    const card = deck.find((entry) => entry.id === phrase.key);
    if (card === undefined) return false;
    const state = evidenceStateOf(card);
    return state === 'used' || state === 'transferred';
  };
  return [...unique.filter((phrase) => !used(phrase)), ...unique.filter(used)].slice(0, MAX_CLOSURE_PHRASES);
}

export function closureOf(parts: ClosureParts, ctx: ClosureContext | null): Closure {
  return {
    title: parts.title.trim(),
    summary: parts.summary.trim(),
    didWell: [...new Set(parts.wins.map((win) => win.trim()).filter(Boolean))].slice(0, MAX_CLOSURE_WINS),
    phrases: phrasesFor(parts, ctx?.deck ?? []),
    repair: parts.corrections[0] ?? null,
    focus: focusFor(parts, ctx),
    nextMission: ctx === null ? null : suggestedMission(ctx.progress),
  };
}

export function closureFromPack(pack: ConversationPack, ctx: ClosureContext | null): Closure {
  return closureOf(
    {
      title: pack.title.en,
      summary: pack.summary,
      wins: pack.wins,
      phrases: pack.keyPhrases,
      corrections: pack.corrections,
      clarity: pack.tutorGoal,
    },
    ctx,
  );
}

export function closureFromRecap(recap: RecapPayload, ctx: ClosureContext | null): Closure {
  return closureOf(
    {
      title: recap.topics[0]?.en ?? recap.headline,
      summary: recap.headline,
      wins: recap.wins,
      phrases: recap.phrases,
      corrections: recap.fixes.map((fix) => ({ quote: fix.quote, better: fix.better, betterEn: fix.betterEn, why: fix.why })),
      clarity: recap.nextFocus,
      liveSound: recap.focusSound ?? null,
    },
    ctx,
  );
}
