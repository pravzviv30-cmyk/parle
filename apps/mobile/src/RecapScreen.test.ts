/**
 * The conversational closure follows the restrained UI 3 direction: one real
 * phrase becomes the keepsake, the existing practice route can rehearse it,
 * and all remaining evidence still appears below it. Source assertions are
 * used because the mobile suite deliberately has no React Native renderer.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const screen = read('./RecapScreen.tsx');
const convo = read('./ConvoScreen.tsx');
const keepsake = read('./live/recapKeepsake.ts');
const nav = read('./nav/RootNavigator.tsx');

describe('the conversation closes with something useful', () => {
  test('one earned phrase leads without hiding the rest of the truthful closure', () => {
    assert.match(screen, /const keptPhrase = closureFromRecap\(recap, null\)\.phrases\[0\] \?\? null/);
    assert.match(screen, /phrase\.key !== keptPhrase\?\.key/);
    assert.match(screen, /slice\(0, MAX_CLOSURE_PHRASES - 1\)/);
    assert.match(screen, /<ConversationPackCard closure=\{remainingClosure\} \/>/);
    assert.match(screen, /A phrase became yours\./);
  });

  test('the exact visible keepsake is durable before the recap calls it saved', () => {
    assert.match(screen, /onSave\(\{ fr: keptPhrase\.fr, en: keptPhrase\.en, situation \}\)/);
    assert.match(screen, /saveState === 'saved'[\s\S]*\? 'Saved to My French'/);
    assert.match(screen, /saveState === 'failed'[\s\S]*\? 'Not saved yet'/);
    assert.match(keepsake, /const acknowledged = await addPhrases\(/);
    assert.match(keepsake, /return acknowledged === 'durable'/);
    assert.match(convo, /onSave=\{saveRecapKeepsake\}/);
    assert.doesNotMatch(
      convo,
      /addPhrases\(/,
      'the exact keepsake must not make the conversation outbox optional',
    );
  });

  test('practice reuses the existing own-words drill and finishing stays the primary action', () => {
    assert.match(screen, /label="Practise this"/);
    assert.match(screen, /label="Done for today"/);
    assert.match(convo, /leaveTo\(\(\) => onPractice\(phrase\)\)/);
    assert.match(
      convo,
      /onPractice=\{onPractice === undefined \? undefined : practiseAfterRecap\}/,
      'the recap bypasses the room-closing path',
    );
    assert.match(
      nav,
      /onPractice=\{\(phrase\) => nav\.replace\('Drill', \{ ownWords: phrase \}\)\}/,
      'the drill is pushed over a stale conversation instead of replacing it',
    );
  });

  test('the scene mic button owns one accessible name', () => {
    assert.match(
      convo,
      /accessibilityLabel=\{OPEN_MIC_LABEL\}[\s\S]*?<VoiceOrb state=\{orbState\} size=\{SCENE_ORB\} announce=\{false\} \/>/,
      'the VoiceOrb announces itself inside a Pressable that already owns the Tap to talk name',
    );
  });
});
