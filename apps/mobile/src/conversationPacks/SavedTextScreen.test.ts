import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const screen = readFileSync(new URL('./SavedTextScreen.tsx', import.meta.url), 'utf8');

test('saved text keeps read failures distinct from an empty opt-in list', () => {
  assert.match(screen, /rows === null \? <Text[^>]+>\{message \? 'The saved text could not be loaded\.' : 'Loading saved text…'\}/);
  assert.match(screen, /rows\.length === 0 \? <Text[^>]+>No conversation text saved\./);
  assert.match(screen, /rows === null && message !== '' && <IconAction layout="inline" icon="refresh" label="Try again"/);
  assert.match(screen, /scope !== scopeGeneration\(\) \|\| user\?\.id !== ownerId/);
});

test('saved text labels real preview, date and deletion scope', () => {
  assert.match(screen, /row\.lines\[0\]\.frWritten \?\? row\.lines\[0\]\.fr/);
  assert.match(screen, /new Date\(row\.savedAt\)\.toLocaleDateString\(\)/);
  assert.match(screen, /Your curated phrases, corrections and practice stay\./);
  assert.match(screen, /No recordings are kept here\./);
});
