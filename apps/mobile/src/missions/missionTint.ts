/**
 * Which tint sits under which situation's drawing — F362.
 *
 * One place decides it, so Home, Tutor and My French cannot put the café on
 * three different tints. The mapping is by place rather than by mission id
 * because the art is by place too (`MissionArt`), and a tint is a paper for a
 * place — under its drawing, and since F467 under its row — never a mark for a
 * mission. Every place has one tint and every tint
 * has one place; the test walks the catalogue to hold both halves.
 *
 * This file imports nothing that reaches react-native, so the test can import
 * it under plain node.
 */

import type { MissionPlace } from '@luvani/core';
import type { TintName } from '../palette.ts';

export const MISSION_TINT: Record<MissionPlace, TintName> = {
  cafe: 'sand',
  friends: 'rose',
  home: 'lilac',
  street: 'lagoon',
  market: 'sage',
  hotel: 'sky',
};

export function missionTint(place: MissionPlace): TintName {
  return MISSION_TINT[place];
}
