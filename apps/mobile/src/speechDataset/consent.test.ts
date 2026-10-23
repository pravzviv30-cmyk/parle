/**
 * The speech dataset consent: hidden, strict about what counts as yes, never
 * synced, cleared on erasure, sent by nothing, and worded kindly.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { guiltIn } from '../copy/guilt.ts';
import { USER_KEY_SUFFIXES } from '../storage/scope.ts';
import { SYNC_EXCLUSIONS } from '../sync/policy.ts';
import {
  SPEECH_CONSENT_COPY,
  SPEECH_CONSENT_EXPLAINER,
  SPEECH_CONSENT_LABEL,
  SPEECH_CONSENT_ROW,
  SPEECH_CONSENT_SAVE_TROUBLE,
  SPEECH_CONSENT_SUB,
  SPEECH_CONSENT_VERSION,
  SPEECH_DATASET_ENABLED,
  speechConsentGranted,
} from './consent.ts';

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('the speech dataset stays off, and Settings draws its switch only through the seam', () => {
  assert.equal(SPEECH_DATASET_ENABLED, false, 'switched on before legal review and the policy change');
  const settings = read('../settings/SettingsScreen.tsx');
  assert.match(settings, /\{SPEECH_DATASET_ENABLED && <SwitchRow/, 'the speech switch must only draw behind SPEECH_DATASET_ENABLED');
  assert.equal((settings.match(/title=\{SPEECH_CONSENT_ROW\}/g) ?? []).length, 1, 'a second, unguarded speech switch');
  assert.match(settings, /if \(SPEECH_DATASET_ENABLED\) \{\s*void loadSpeechConsent\(\)/, 'the consent is read while the feature is off');
});

test('only a literal yes to the current wording counts', () => {
  assert.equal(SPEECH_CONSENT_VERSION, 1);
  assert.equal(speechConsentGranted({ allowed: true, version: 1 }), true);
  for (const no of [
    'true', 1, true, null, undefined, {}, { allowed: true }, { allowed: true, version: 0 },
    { allowed: true, version: 2 }, { allowed: 'true', version: 1 }, { allowed: 1, version: 1 },
    { allowed: true, version: '1' }, { allowed: false, version: 1 },
  ]) {
    assert.equal(speechConsentGranted(no), false, `read as yes: ${JSON.stringify(no)}`);
  }
});

test('erasure clears it, export carries it, and sync never merges it', () => {
  assert.ok((USER_KEY_SUFFIXES as readonly string[]).includes('speechDataset'));
  const entry = SYNC_EXCLUSIONS.find((e) => e.namespace === 'speechDataset');
  assert.ok(entry, 'speechDataset is not excluded from sync');
  assert.match(entry.reason, /older yes/);
});

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sources(path));
    else if (/\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

test('nothing in live or analytics imports the speech dataset', () => {
  for (const dir of ['../live', '../analytics']) {
    const files = sources(new URL(dir, import.meta.url).pathname);
    assert.ok(files.length > 0, `no sources found under ${dir}`);
    for (const file of files) {
      assert.doesNotMatch(readFileSync(file, 'utf8'), /speechDataset/, `${file} reaches the speech dataset`);
    }
  }
});

test('the speech consent copy is warm, plain and never asks', () => {
  assert.deepEqual(
    [...SPEECH_CONSENT_COPY],
    [SPEECH_CONSENT_ROW, SPEECH_CONSENT_SUB, SPEECH_CONSENT_LABEL, SPEECH_CONSENT_SAVE_TROUBLE, ...SPEECH_CONSENT_EXPLAINER],
  );
  assert.ok(SPEECH_CONSENT_EXPLAINER.length >= 2 && SPEECH_CONSENT_EXPLAINER.length <= 4);
  for (const line of SPEECH_CONSENT_COPY) {
    assert.ok(line.trim().length > 0);
    assert.equal(guiltIn(line), undefined, `guilt in speech consent copy: ${line}`);
    assert.doesNotMatch(line, /[—–]/, `em dash: ${line}`);
    assert.doesNotMatch(line, /\d/, `digit: ${line}`);
    assert.doesNotMatch(line, /\b(must|should|please|wrong|bad|required|need to|don't|do not)\b/i, `asks or scolds: ${line}`);
  }
  assert.match(SPEECH_CONSENT_EXPLAINER.join(' '), /works the same either way/);
  assert.match(SPEECH_CONSENT_EXPLAINER.join(' '), /turn it off any time/);
});
