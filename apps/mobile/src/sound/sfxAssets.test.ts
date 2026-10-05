/**
 * The sound effects are synthesised, not recorded (decision D9), so the committed files can be
 * checked against their recipes: every .m4a must be the encoding the manifest names, every
 * manifest wavSha256 must be what scripts/sfx/synth.mjs makes from the recipe today, and a
 * sound counts as approved only while the synthesis the founder heard is the one it makes now.
 * Regenerate with `node scripts/sfx/generate.mjs` (add `--audition` for the listening page).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { synthesise, encodeWav } from '../../../../scripts/sfx/synth.mjs';
import { RECIPES, RECIPE_VERSION } from '../../../../scripts/sfx/recipes.mjs';
import { approvedFlags, renderSfxManifestTs, sha256, MAX_M4A_BYTES } from '../../../../scripts/sfx/manifest.mjs';
import { SFX_APPROVED, SFX_DURATION_MS, SFX_IDS } from './sfxManifest.ts';

type SoundEntry = { id: string; durationMs: number; peakDbfs: number; wavSha256: string; m4aSha256: string; m4aBytes: number };

const at = (relative: string) => new URL(relative, import.meta.url);
const ASSETS = '../../assets/sfx/';
const manifest = JSON.parse(readFileSync(at(`${ASSETS}manifest.json`), 'utf8')) as { recipeVersion: number; sampleRate: number; sounds: SoundEntry[] };
const sounds = manifest.sounds;
const approvals = JSON.parse(readFileSync(at('../../../../scripts/sfx/approvals.json'), 'utf8')) as Record<string, unknown>;
const recipeFor = (id: string) => {
  const recipe = RECIPES.find((candidate) => candidate.id === id);
  assert.ok(recipe, `${id} has no recipe in scripts/sfx/recipes.mjs`);
  return recipe;
};
const synthesised = new Map(RECIPES.map((recipe) => [recipe.id, encodeWav(synthesise(recipe, RECIPE_VERSION))]));

/** The ids named by the `SfxId` union in sfxIds.ts, in order. */
const unionIds = () => [...readFileSync(at('./sfxIds.ts'), 'utf8').matchAll(/\|\s*'([\w-]+)'/g)].map((match) => match[1]);

test('every sound asset matches its approved synthesis', () => {
  const ids = sounds.map((sound) => sound.id);
  assert.equal(ids.length, 12);
  assert.deepEqual(ids, RECIPES.map((recipe) => recipe.id), 'the manifest and the recipes list different sounds');
  assert.deepEqual([...SFX_IDS], ids, 'SFX_IDS is not the manifest list');
  assert.deepEqual(unionIds(), ids, 'the SfxId union is not the manifest list');
  assert.equal(manifest.recipeVersion, RECIPE_VERSION);

  for (const sound of sounds) {
    recipeFor(sound.id);
    assert.equal(
      sha256(synthesised.get(sound.id)!),
      sound.wavSha256,
      `${sound.id} no longer synthesises to the sound in the manifest. Run node scripts/sfx/generate.mjs; the founder must hear it again.`,
    );
    const file = at(`${ASSETS}${sound.id}.m4a`);
    assert.ok(existsSync(file), `${sound.id}.m4a is missing`);
    const bytes = readFileSync(file);
    assert.equal(bytes.subarray(4, 8).toString('latin1'), 'ftyp', `${sound.id}.m4a is not an MP4 file`);
    assert.equal(sha256(bytes), sound.m4aSha256, `${sound.id}.m4a is not the file the manifest names`);
    assert.equal(bytes.length, sound.m4aBytes);
    assert.ok(bytes.length <= MAX_M4A_BYTES, `${sound.id}.m4a is ${bytes.length} bytes, over 30 KB`);
  }

  const flags = approvedFlags(sounds, approvals);
  assert.deepEqual({ ...SFX_APPROVED }, flags, 'SFX_APPROVED says a sound is approved that the founder has not heard in this form');
  assert.equal(
    readFileSync(at('./sfxManifest.ts'), 'utf8'),
    renderSfxManifestTs(sounds, flags),
    'sfxManifest.ts was edited by hand or is stale. Run node scripts/sfx/generate.mjs.',
  );
});

test('an approval counts only for the exact synthesis the founder heard', () => {
  const heard = 'a'.repeat(64);
  const pair = [{ id: 'tap', wavSha256: heard }, { id: 'select', wavSha256: 'b'.repeat(64) }];
  assert.deepEqual(approvedFlags(pair, {}), { tap: false, select: false });
  assert.deepEqual(approvedFlags(pair, { tap: { on: '2026-10-06', wavSha256: heard } }), { tap: true, select: false });
  // The recipe changed after he listened: the old approval no longer counts.
  assert.equal(approvedFlags(pair, { tap: { on: '2026-10-06', wavSha256: 'c'.repeat(64) } }).tap, false);
  // An approval needs its date and its hash; a bare true is not one.
  assert.equal(approvedFlags(pair, { tap: { wavSha256: heard } }).tap, false);
  assert.equal(approvedFlags(pair, { tap: { on: 'yesterday', wavSha256: heard } }).tap, false);
  assert.equal(approvedFlags(pair, { tap: true }).tap, false);
  assert.throws(() => approvedFlags(pair, { ding: { on: '2026-10-06', wavSha256: heard } }), /not a sound/);
  // The real file names only real sounds.
  assert.doesNotThrow(() => approvedFlags(sounds, approvals));
});

test('the sound folder holds only the twelve sounds and their manifest', () => {
  const expected = [...sounds.map((sound) => `${sound.id}.m4a`), 'manifest.json'].sort();
  assert.deepEqual(readdirSync(at(ASSETS)).filter((name) => !name.startsWith('.')).sort(), expected);
});

test('sound synthesis is seeded, never the clock or Math.random', () => {
  for (const recipe of RECIPES) {
    assert.deepEqual(encodeWav(synthesise(recipe, RECIPE_VERSION)), synthesised.get(recipe.id), `${recipe.id} changed between two renders`);
  }
  // The seed is the id and the recipe version: a new version re-rolls the noise and dither.
  const whoosh = recipeFor('whoosh');
  assert.notEqual(sha256(encodeWav(synthesise(whoosh, RECIPE_VERSION + 1))), sha256(synthesised.get('whoosh')!));
  for (const script of ['synth.mjs', 'recipes.mjs']) {
    const source = readFileSync(at(`../../../../scripts/sfx/${script}`), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(source, /Math\.random|Date\b|performance\.now|hrtime|crypto/, `${script} reads something that changes between runs`);
    assert.doesNotMatch(source, /^import\s/m, `${script} must stay free of imports and I/O`);
  }
});

test('every pitch a sound rests on is in C-major pentatonic', () => {
  // Pitch classes counted in semitones from A: C 3, D 5, E 7, G 10, A 0.
  const pentatonic = new Set([0, 3, 5, 7, 10]);
  const check = (id: string, hz: number) => {
    const semitones = 12 * Math.log2(hz / 440);
    const nearest = Math.round(semitones);
    assert.ok(Math.abs(semitones - nearest) * 100 < 0.5, `${id}: ${hz} Hz is between notes`);
    assert.ok(pentatonic.has(((nearest % 12) + 12) % 12), `${id}: ${hz.toFixed(1)} Hz is not C, D, E, G or A`);
  };
  let tones = 0;
  for (const recipe of RECIPES) {
    for (const voice of recipe.voices) {
      if (voice.kind !== 'tone') continue;
      tones += 1;
      check(recipe.id, voice.hz);
      if (voice.glide) check(recipe.id, voice.glide.to);
    }
  }
  assert.ok(tones >= 25, 'the recipes lost their notes');
});

test('each sound keeps the length and peak its recipe sets', () => {
  // docs/come-alive/motion-sound.md section 6.1: length in ms and peak in dBFS.
  const table: Record<string, [number, number]> = {
    tap: [40, -18], select: [90, -14], correct: [300, -8], nearly: [220, -12],
    complete: [760, -6], streak: [820, -6], levelup: [1150, -5], quest: [680, -7],
    badge: [950, -7], save: [140, -10], 'count-tick': [18, -24], whoosh: [300, -16],
  };
  assert.deepEqual(Object.keys(table), sounds.map((sound) => sound.id));
  assert.equal(manifest.sampleRate, 44100);
  for (const sound of sounds) {
    const [lengthMs, peakDbfs] = table[sound.id]!;
    const recipe = recipeFor(sound.id);
    assert.equal(recipe.lengthMs, lengthMs, `${sound.id} recipe length`);
    assert.equal(recipe.peakDbfs, peakDbfs, `${sound.id} recipe peak`);
    assert.equal(sound.durationMs, lengthMs, `${sound.id} manifest length`);
    assert.equal(SFX_DURATION_MS[sound.id as keyof typeof SFX_DURATION_MS], lengthMs, `${sound.id} SFX_DURATION_MS`);
    assert.ok(Math.abs(sound.peakDbfs - peakDbfs) <= 0.1, `${sound.id} peaks at ${sound.peakDbfs} dBFS, not ${peakDbfs}`);
  }
});
