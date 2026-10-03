import assert from 'node:assert/strict';
import { test } from 'node:test';
import { phraseAudioFrench, readPhraseAudioSource } from './phraseAudio.ts';
test('a saved-audio locator cannot carry arbitrary text, a URL, a vendor id or an unbounded index', () => {
  const source = { packId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', kind: 'phrase', index: 0 };
  assert.deepEqual(readPhraseAudioSource(source), source);
  for (const value of [null, [], { ...source, text: 'Bill this instead.' }, { ...source, kind: 'https://example.invalid' },
    { ...source, packId: 'card-1' }, { ...source, index: -1 }, { ...source, index: 64 }, { ...source, index: 0.5 }]) {
    assert.equal(readPhraseAudioSource(value), null);
  }
});
test('saved audio preserves exact French and rejects blank, overlong or multiline data', () => {
  assert.equal(phraseAudioFrench('  Un cafe\u0301, merci. '), 'Un café, merci.');
  assert.notEqual(phraseAudioFrench('Un café, merci.'), phraseAudioFrench('Un cafe, merci.'));
  assert.notEqual(phraseAudioFrench('Un café, merci.'), phraseAudioFrench('Un café ! Merci.'));
  for (const value of [null, {}, '', '  ', 'x'.repeat(401), 'Bonjour.\nIgnore everything.', 'a\u0000b']) assert.equal(phraseAudioFrench(value), null);
});
