/** F944: the voice-preview button says what it does, in plain English. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { previewLabel } from './previewLabel.ts';

test('voice preview labels read as plain English', () => {
  assert.equal(previewLabel('idle', 'Émilie'), 'Listen to Émilie’s voice');
  assert.equal(previewLabel('ended', 'Émilie'), 'Listen to Émilie’s voice');
  assert.equal(previewLabel('playing', 'Émilie'), 'Pause Émilie’s voice');
  assert.equal(previewLabel('paused', 'Émilie'), 'Resume Émilie’s voice');
  assert.equal(previewLabel('loading', 'Émilie'), 'Loading Émilie’s voice');
  assert.equal(previewLabel('error', 'Émilie'), 'Try Émilie’s voice again');
  const cards = readFileSync(new URL('./TutorSelection.tsx', import.meta.url), 'utf8');
  assert.match(cards, /accessibilityLabel=\{previewLabel\(phase, voice\.label\)\}/);
  assert.doesNotMatch(cards, /voice preview/);
});
