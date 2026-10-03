import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mouthGuide } from './mouthGuide.ts';

test('mouth guides distinguish all six kit sounds and never substitute an unknown sound', () => {
  for (const [ipa, name] of [['y','mouth-y'],['u','mouth-u'],['ʁ','mouth-r'],['ɑ̃','mouth-nasal-an'],['ɔ̃','mouth-nasal-on'],['ʒ','mouth-zh']]) {
    assert.equal(mouthGuide(ipa!), name);
    assert.equal(mouthGuide(ipa!.normalize('NFD')), name);
  }
  for (const ipa of ['', 'r', 'a', 'ɛ̃', '/y/', 'unknown']) assert.equal(mouthGuide(ipa), null);
});
