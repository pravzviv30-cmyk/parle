import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEFAULT_TUTOR_VOICE, TUTOR_VOICES, DAILY_PHRASES } from '@luvani/core';
import { TUTOR_LINES, TUTOR_LINES_VOICE, DEMO_REPLY_ID } from './tutorLines.ts';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const lines = Object.values(TUTOR_LINES);

test('every recorded tutor line is bundled as a real audio file under its own id', () => {
  const map = here('./tutorLineAudio.ts');
  assert.ok(existsSync(map), 'tutorLineAudio.ts has not been generated');
  const source = readFileSync(map, 'utf8');
  for (const line of lines) {
    const file = source.match(new RegExp(`"${line.id}": require\\('(\\.\\./\\.\\./assets/onboarding/${TUTOR_LINES_VOICE}/[0-9a-f]{24}\\.m4a)'\\)`))?.[1];
    assert.ok(file, `${line.id} has no bundled recording`);
    const bytes = readFileSync(here(file));
    assert.ok(bytes.length > 1000, `${line.id} recording is empty`);
    assert.equal(bytes.subarray(4, 8).toString(), 'ftyp', `${line.id} is not an MP4 audio file`);
  }
  assert.equal(source.match(/require\(/g)?.length, lines.length, 'the map holds exactly the tutor lines');
});

test('the recordings are in the voice a new learner meets first', () => {
  assert.equal(TUTOR_LINES_VOICE, DEFAULT_TUTOR_VOICE);
});

test('the learner reply is a daily phrase that every tutor already voices', () => {
  const reply = DAILY_PHRASES.find(phrase => phrase.id === DEMO_REPLY_ID);
  assert.equal(reply?.fr, 'Bonjour, je vais prendre un café.');
  const manifest = readFileSync(here('../daily/tutorAudioManifest.ts'), 'utf8');
  const voiced = manifest.match(new RegExp(`"${DEMO_REPLY_ID}": require`, 'g'))?.length ?? 0;
  assert.equal(voiced, Object.keys(TUTOR_VOICES).length);
});

test('tutor lines are plain, captioned and free of em dashes', () => {
  assert.equal(new Set(lines.map(line => line.id)).size, lines.length);
  for (const line of lines) {
    assert.ok(line.fr.trim().length > 0 && line.en.trim().length > 0);
    assert.doesNotMatch(`${line.fr} ${line.en}`, /\u2014/);
  }
});
