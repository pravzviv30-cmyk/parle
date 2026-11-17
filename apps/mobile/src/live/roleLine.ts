/**
 * Who the tutor plays in a scene, said before the scene's own narration (F942).
 *
 * Missions cast the tutor as a character ("Karim, the barista") and the
 * narration names that character, but nothing said the learner's chosen tutor
 * was playing him. This line says it once, first, in plain English, on the
 * scene preview and as the room's first line. The short part is core data
 * (`Mission.tutorPart`), never a parse of the long `tutorRole`.
 */
import { getMission, tutorVoice, DEFAULT_TUTOR_VOICE, isTutorVoiceKey, type ConvoView, type ServerMessage } from '@luvani/core';
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

type SceneTurn = { line: Omit<TurnLine, 'id'>; id?: string };

/** The lines of one tutor turn, from a view or from the early tutor-line. */
interface SceneLines {
  textTurnId?: string;
  narration: { fr: string; frWritten?: string | null; en: string } | null;
  coach: string | null;
  reply: { fr: string; frWritten?: string | null; en?: string };
}

/**
 * The turns one scene view adds, in the order they are read: the role line
 * (once, by its fixed id), then the narration, then the coach line when it was
 * spoken (F988, an English reach or a way back), then the tutor's line.
 */
export function sceneTurns(view: ConvoView, role: string | null): SceneTurn[] {
  return turnsOf({ textTurnId: view.textTurnId, narration: view.narration, coach: view.coachSpoken ? view.coachLine : null, reply: view.sceneReply }, role);
}

/**
 * The same turns from a tutor-line, sent with the early voice (F988). Same ids,
 * so the view that follows adds no copy and only fills in the English.
 */
export function tutorLineTurns(message: Extract<ServerMessage, { t: 'tutor-line' }>, role: string | null): SceneTurn[] {
  return turnsOf({ textTurnId: message.textTurnId, narration: message.narration, coach: message.coach, reply: message.reply }, role);
}

function turnsOf(lines: SceneLines, role: string | null): SceneTurn[] {
  const out: SceneTurn[] = [];
  const id = (kind: string) => (lines.textTurnId ? `${kind}:${lines.textTurnId}` : undefined);
  if (role !== null) out.push({ line: { who: 'narration', fr: role, frWritten: null, en: role }, id: ROLE_TURN_ID });
  if (lines.narration) {
    out.push({ line: { who: 'narration', fr: lines.narration.fr, frWritten: lines.narration.frWritten ?? null, en: lines.narration.en }, id: id('narration') });
  }
  // Spoken in English, so it carries no English line of its own.
  if (lines.coach) out.push({ line: { who: 'tutor', fr: lines.coach, frWritten: null, en: null }, id: id('coach') });
  out.push({ line: { who: 'tutor', fr: lines.reply.fr, frWritten: lines.reply.frWritten ?? null, en: lines.reply.en ?? null }, id: id('tutor') });
  return out;
}
