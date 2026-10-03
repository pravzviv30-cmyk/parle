import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TUTOR_VOICES } from '@luvani/core';
import { VOICED_WORD_IDS, VOICED_PHRASE_IDS } from './voicedSelection.ts';

const src = fileURLToPath(new URL('..', import.meta.url));
const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');

test('every selectable daily recording is bundled for all six tutors without a runtime API', () => {
  const manifest = read('./tutorAudioManifest.ts');
  const groups = [...manifest.matchAll(/  (\w+): \{\n([\s\S]*?)\n  \},/g)];
  assert.deepEqual(groups.map(group => group[1]), Object.keys(TUTOR_VOICES));
  const ids = new Set([...VOICED_WORD_IDS, ...VOICED_PHRASE_IDS]);
  assert.equal(ids.size, 400);
  for (const group of groups) {
    const rows = [...group[2]!.matchAll(/"([^"]+)": require\('\.\.\/\.\.\/assets\/daily-tutors\/([^']+\.m4a)'\)/g)];
    assert.equal(rows.length, ids.size);
    assert.deepEqual(new Set(rows.map(row => row[1])), ids);
    for (const row of rows) {
      assert.ok(row[2]!.startsWith(`${group[1]}/`), `${row[1]} belongs to the wrong tutor`);
      const file = new URL(`../../assets/daily-tutors/${row[2]}`, import.meta.url);
      assert.ok(statSync(file).size > 1000, `${group[1]}:${row[1]} has empty audio`);
      assert.equal(readFileSync(file).subarray(4, 8).toString(), 'ftyp');
    }
  }
  for (const source of ['DailyCard.tsx', 'DailyPracticeScreen.tsx']) {
    assert.doesNotMatch(read(source), /fetch\(|Speech\.speak|speechace|openai/i);
    assert.match(read(source), /tutorAudioFor\(TUTOR_DAILY_AUDIO,/);
  }
});

test('the unused generic audio pack and generator stay retired with no production references', () => {
  for (const relative of ['./audioManifest.ts', '../../assets/daily-kokoro', '../../../../scripts/build-daily-audio.mjs', '../../../../scripts/daily-audio-worker.py']) {
    assert.equal(existsSync(new URL(relative, import.meta.url)), false, relative);
  }
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) {
        const body = readFileSync(full, 'utf8');
        assert.doesNotMatch(body, /(?:from\s*|import\s*\(|require\s*\()["'][^"']*(?:daily-kokoro|\/audioManifest(?:\.ts)?["'])/, full);
      }
    }
  };
  walk(src);
});
