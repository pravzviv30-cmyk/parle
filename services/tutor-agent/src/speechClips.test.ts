import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NO_CLIP_SINK, mayCapture, speechDatasetEnabled } from './speechClips.ts';

test('the speech dataset flag is on only for exactly 1', () => {
  assert.equal(speechDatasetEnabled({ LUVANI_SPEECH_DATASET: '1' }), true);
  for (const value of ['true', 'yes', 'on', '', '0', ' 1', undefined]) {
    assert.equal(speechDatasetEnabled({ LUVANI_SPEECH_DATASET: value }), false, `"${value}" is off`);
  }
  assert.equal(speechDatasetEnabled({}), false);
});

test('capture needs both the flag and consent', () => {
  assert.equal(mayCapture({ enabled: true, consent: true }), true);
  assert.equal(mayCapture({ enabled: true, consent: false }), false);
  assert.equal(mayCapture({ enabled: false, consent: true }), false);
  assert.equal(mayCapture({ enabled: false, consent: false }), false);
});

test('the only sink does nothing and touches no network', (t) => {
  const real = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = (async () => { requests += 1; throw new Error('no network from the clip sink'); }) as typeof fetch;
  t.after(() => { globalThis.fetch = real; });
  const result = NO_CLIP_SINK.offer({ reference: 'Bonjour', lessonId: 'l', turnId: 't', wav: new Uint8Array(4), durationSec: 1, observations: [] });
  assert.equal(result, undefined);
  assert.equal(requests, 0);
});

test('no production code turns the speech dataset seam on', async () => {
  const { readdirSync, readFileSync, statSync } = await import('node:fs');
  const { join, relative, resolve } = await import('node:path');
  const repo = resolve(import.meta.dirname, '../../..');
  const roots = ['services/tutor-agent/src', 'services/token-server/src', 'services/shared', 'apps/mobile/src'];
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules') continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(relative(repo, path));
    }
  };
  for (const root of roots) walk(join(repo, root));
  const TUTOR = 'services/tutor-agent/src/tutor.ts';
  assert.ok(files.includes(TUTOR), 'the scan reaches tutor.ts');
  // The only lines allowed to name the seam's switches: tutor.ts's own field
  // declarations and constructor options type.
  const allowed = (file: string, line: string): boolean =>
    file === TUTOR &&
    (line === 'private readonly clipSink: ClipSink;' ||
      line === 'private readonly datasetConsent: boolean;' ||
      line.startsWith('constructor(lesson: Lesson, startRung?: Rung, options: {'));
  const offenders: string[] = [];
  for (const file of files) {
    readFileSync(join(repo, file), 'utf8').split('\n').forEach((raw, i) => {
      const line = raw.trim();
      if (/\b(datasetConsent|clipSink)\s*:/.test(line) && !allowed(file, line)) offenders.push(`${file}:${i + 1}: ${line}`);
      if (line.includes('LUVANI_SPEECH_DATASET') && file !== 'services/tutor-agent/src/speechClips.ts') offenders.push(`${file}:${i + 1}: ${line}`);
    });
  }
  assert.deepEqual(offenders, []);
});
