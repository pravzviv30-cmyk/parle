import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const parts = readFileSync(new URL('../components.tsx', import.meta.url), 'utf8');
const block = parts.slice(parts.indexOf('export function FrenchBlock'), parts.indexOf('const b ='));
describe('the card that holds one French line — F569', () => {
  test('the speaker is one button at the touch floor that offers to stop what it is already playing', () => {
    assert.match(block, /<Press[\s\S]*accessibilityRole="button"/);
    assert.match(block, /playing \? 'Stop' : 'Hear this line'/);
    assert.match(parts, /hearDisc: \{[\s\S]{0,130}width: HIT[\s\S]{0,100}height: HIT/);
    assert.equal(existsSync(new URL('./PhraseCard.tsx', import.meta.url)), false);
  });
  test('the French is sized to fit rather than clipped, and the gloss stays quiet under it', () => {
    assert.match(block, /<Text \{\.\.\.frenchText\}/);
    assert.match(block, /type\.frenchLg : type\.french/);
    assert.match(block, /type\.small[\s\S]*font\.regular[\s\S]*\{english\}/);
    assert.doesNotMatch(block, /numberOfLines|maxFontSizeMultiplier|allowFontScaling|<PillButton|borderLeftWidth/);
  });
});
