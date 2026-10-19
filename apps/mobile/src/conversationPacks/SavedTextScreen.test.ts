import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const screen = readFileSync(new URL('./SavedTextScreen.tsx', import.meta.url), 'utf8');

test('saved text keeps read failures distinct from an empty opt-in list', () => {
  assert.match(screen, /rows === null \? <Text[^>]+>\{message \? 'The saved text could not be loaded\.' : 'Loading saved text…'\}/);
  assert.match(screen, /rows\.length === 0 \? <Text[^>]+>No conversation text saved\./);
  assert.match(screen, /rows === null && message !== null && <MainButton label="Try again"/);
  assert.match(screen, /scope !== scopeGeneration\(\) \|\| user\?\.id !== ownerId/);
});

test('a conversation link opens only the exact saved session and keeps older-page recovery', () => {
  assert.match(screen, /rows\.find\(row => row\.sessionId === initialSessionId\)/);
  assert.match(screen, /openedInitial\.current = true; setSelected\(found\)/);
  assert.match(screen, /This conversation’s text is not on the loaded page/);
  assert.match(screen, /There is no saved text here for this conversation/);
  assert.match(screen, /Load older saved text/);
});

test('saved text labels real preview, date and deletion scope', () => {
  assert.match(screen, /row\.lines\[0\]\.frWritten \?\? row\.lines\[0\]\.fr/);
  assert.match(screen, /new Date\(row\.savedAt\)\.toLocaleDateString\(\)/);
  assert.match(screen, /Your curated phrases, corrections and practice stay\./);
  assert.match(screen, /No recordings are kept here\./);
});
