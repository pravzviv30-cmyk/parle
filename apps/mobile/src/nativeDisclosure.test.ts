import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
test('the microphone permission describes conversation and private practice without claiming live sound assessment', () => {
  const config = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
  assert.equal(config.expo.ios.infoPlist.NSMicrophoneUsageDescription, 'Luvani uses your microphone for spoken French conversations and practice recordings you choose to make.');
});
