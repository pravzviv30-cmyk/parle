/**
 * Who the tutor plays in a scene, said before the scene's own narration (F942).
 *
 * Missions cast the tutor as a character ("Karim, the barista") and the
 * narration names that character, but nothing said the learner's chosen tutor
 * was playing him. This line says it once, first, in plain English, on the
 * scene preview and as the room's first line. The short part is core data
 * (`Mission.tutorPart`), never a parse of the long `tutorRole`.
 */
import { getMission, tutorVoice, DEFAULT_TUTOR_VOICE, isTutorVoiceKey, type ConvoView } from '@luvani/core';
import type { TurnLine } from './turns.ts';

export function roleLine(tutorName: string, tutorPart: string): string {
  return `${tutorName} plays ${tutorPart}.`;
}

/** The role line for a mission, or null when the session is not a known mission. */
export function missionRoleLine(missionId: string | undefined, voice: string | undefined): string | null {
  const mission = missionId === undefined ? undefined : getMission(missionId);
  if (mission === undefined) return null;
  const key = voice !== undefined && isTutorVoiceKey(voice) ? voice : DEFAULT_TUTOR_VOICE;
  return roleLine(tutorVoice(key).persona.name, mission.tutorPart);
}

/** The role line's turn id: fixed, so `pushTurn` adds it once and never again. */
export const ROLE_TURN_ID = 'role';

/**
 * The turns one scene view adds, in the order they are read: the role line
 * (once, by its fixed id), then the narration, then the tutor's line.
 */
export function sceneTurns(view: ConvoView, role: string | null): { line: Omit<TurnLine, 'id'>; id?: string }[] {
  const out: { line: Omit<TurnLine, 'id'>; id?: string }[] = [];
  if (role !== null) out.push({ line: { who: 'narration', fr: role, frWritten: null, en: role }, id: ROLE_TURN_ID });
  if (view.narration) {
    out.push({
      line: { who: 'narration', fr: view.narration.fr, frWritten: view.narration.frWritten ?? null, en: view.narration.en },
      id: view.textTurnId ? `narration:${view.textTurnId}` : undefined,
    });
  }
  out.push({
    line: { who: 'tutor', fr: view.sceneReply.fr, frWritten: view.sceneReply.frWritten ?? null, en: view.sceneReply.en },
    id: view.textTurnId ? `tutor:${view.textTurnId}` : undefined,
  });
  return out;
}
