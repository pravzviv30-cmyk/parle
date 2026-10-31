/**
 * The stage a drill stands on (drill-b.md, "Families" and the dark table):
 * every kind maps, a new core kind fails here, and every word set on every
 * stage band clears 4.5 in both modes, measured from the real palette.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { b } from '../palette.ts';
import { contrast, WORDS } from '../testing/contrast.ts';
import { drillStage, type DrillExerciseKind, type StageSurface } from './drillStage.ts';

// Typed as a full record, so a kind added to core fails the typecheck here.
const KINDS: Record<DrillExerciseKind, true> = {
  'fill-blank': true, 'best-sentence': true, 'appropriate-reply': true, 'repeat-this': true,
  'tap-translate': true, 'listen-type': true, translate: true, 'own-words': true,
};
const SURFACES: StageSurface[] = [...(Object.keys(KINDS) as DrillExerciseKind[]), 'review', 'sound-drill', 'sound-check', 'fixes-say', 'fixes-type'];

const EXPECTED: Record<StageSurface, [string, string]> = {
  'best-sentence': ['choose', 'lavender'], 'appropriate-reply': ['choose', 'lavender'],
  'fill-blank': ['build', 'butter'], 'tap-translate': ['build', 'butter'],
  translate: ['write', 'sage'], 'listen-type': ['write', 'sage'], 'fixes-type': ['write', 'sage'],
  'repeat-this': ['speak', 'peach'], 'own-words': ['speak', 'peach'], 'sound-drill': ['speak', 'peach'],
  'sound-check': ['speak', 'peach'], 'fixes-say': ['speak', 'peach'],
  review: ['review', 'butter'],
};

describe('drillStage', () => {
  test('every surface maps to its family and band in both modes', () => {
    for (const s of SURFACES) for (const mode of ['light', 'dark'] as const) {
      const st = drillStage(s, mode);
      assert.deepEqual([st.family, st.band], EXPECTED[s], `${s} in ${mode}`);
    }
  });

  test('every exercise kind core defines has a stage (a new kind fails here)', () => {
    const types = readFileSync(fileURLToPath(new URL('../../../../packages/core/src/drill/types.ts', import.meta.url)), 'utf8');
    const kinds = [...types.matchAll(/^\s+kind: '([a-z-]+)';/gm)].map((m) => m[1]!);
    assert.ok(kinds.length >= 8, 'the kinds were not read from core');
    assert.deepEqual([...kinds].sort(), Object.keys(KINDS).sort(), 'core and the stage disagree on the kinds');
    for (const k of kinds) assert.doesNotThrow(() => drillStage(k as DrillExerciseKind, 'light'));
  });

  test('the eyebrow is link except on dark butter, where it is text', () => {
    for (const s of SURFACES) for (const mode of ['light', 'dark'] as const) {
      const st = drillStage(s, mode);
      assert.equal(st.eyebrow, mode === 'dark' && st.band === 'butter' ? 'text' : 'link', `${s} in ${mode}`);
    }
  });

  test('prompt, eyebrow and English clear 4.5 on every band in both modes', () => {
    for (const mode of ['light', 'dark'] as const) for (const s of SURFACES) {
      const t = b[mode];
      const st = drillStage(s, mode);
      const ground = t[st.band];
      for (const [what, ink] of [['prompt', t.text], ['eyebrow', t[st.eyebrow]], ['English', t.muted]] as const) {
        const r = contrast(ink, ground);
        assert.ok(r >= WORDS, `${what} on ${mode} ${st.band} is ${r.toFixed(2)}`);
      }
    }
  });
});
