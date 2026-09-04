import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

const source = readFileSync(fileURLToPath(new URL('./ConversationPackLibrary.tsx', import.meta.url)), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

describe('Conversation Pack library', () => {
  test('keeps a complete learner-owned route back into a conversation', () => {
    for (const required of [
      'Your conversations',
      'You practised',
      'Review phrases',
      'Continue talking',
      'Delete this conversation',
      'Delete all saved conversations',
    ]) {
      assert.ok(source.includes(required), `the library no longer offers ${required}`);
    }
    assert.match(source, /useHardwareBack\(selected !== null/, 'Android back strands a learner inside pack detail');
  });

  test('explains that deleting history does not remove earned learning', () => {
    assert.match(source, /Your earned phrases and reviews stay\./, 'history deletion claims it deletes more or explains nothing');
    assert.doesNotMatch(source, /transcript/i, 'the Pack library implies readable transcript history exists by default');
  });
});
