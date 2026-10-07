/**
 * The bundled sound-effect files, by id. Only sound/sfx.native.ts and sound/sfx.web.ts import
 * this (sound/sfxGate.test.ts holds that): a `require` of an .m4a does not load under the node
 * test runner, and nothing else may reach a sound without passing the approval gate.
 */
import type { SfxId } from './sfxIds.ts';

export const SFX_SOURCES: Readonly<Record<SfxId, number>> = {
  tap: require('../../assets/sfx/tap.m4a'),
  select: require('../../assets/sfx/select.m4a'),
  correct: require('../../assets/sfx/correct.m4a'),
  nearly: require('../../assets/sfx/nearly.m4a'),
  complete: require('../../assets/sfx/complete.m4a'),
  streak: require('../../assets/sfx/streak.m4a'),
  levelup: require('../../assets/sfx/levelup.m4a'),
  quest: require('../../assets/sfx/quest.m4a'),
  badge: require('../../assets/sfx/badge.m4a'),
  save: require('../../assets/sfx/save.m4a'),
  'count-tick': require('../../assets/sfx/count-tick.m4a'),
  whoosh: require('../../assets/sfx/whoosh.m4a'),
};
