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

/** The screen without comments, so an order check reads JSX and not prose. */
const code = screen.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
const render = code.slice(code.indexOf('return ('));
function at(marker: string): number {
  const i = render.indexOf(marker);
  assert.notEqual(i, -1, `\`${marker}\` is not on the recap at all`);
  return i;
}

describe('the conversation closes with something useful', () => {
  // Re-pointed 2026-09-25 (whole-app Stage 3A). The closure is split: what
  // went well and the one focus lead, and the other phrases, the small fix and
  // the next step sit one tap away under More. Nothing the closure chose is
  // dropped; the three-phrase ceiling across the keepsake and the rest holds.
  test('one earned phrase leads and the rest of the truthful closure is one tap away under More', () => {
    assert.match(screen, /const keptPhrase = closureFromRecap\(recap, null\)\.phrases\[0\] \?\? null/);
    assert.match(screen, /phrase\.key !== keptPhrase\?\.key/);
    assert.match(screen, /slice\(0, MAX_CLOSURE_PHRASES - 1\)/);
    assert.match(screen, /<ConversationPackCard closure=\{leadClosure\} \/>/);
    assert.equal((code.match(/<ConversationPackCard\b/g) ?? []).length, 1, 'the closure card is mounted twice, so the arrival is felt twice');
    assert.match(screen, /A phrase to take with you/);
    // The lead carries the win and the focus, and nothing else.
    assert.match(code, /const leadClosure = \{ \.\.\.closure, summary: '', phrases: \[\], repair: null, nextMission: null, focus: leadFocus \}/);
    // The rest is still drawn, behind the one disclosure.
    const more = code.slice(code.indexOf('{more && ('));
    assert.ok(code.includes('{more && ('), 'nothing is behind More');
    for (const part of ['otherPhrases.map(', 'closure.repair', 'closure.nextMission', '{NEXT_WAITING}']) {
      assert.ok(more.includes(part), `${part} is no longer reachable from More`);
    }
  });

  test('the recap reads win, focus, practise, done, and keeps everything else under one closed More', () => {
    assert.match(code, /const \[more, setMore\] = useState\(false\);/, 'More opens by itself');
    assert.equal((code.match(/accessibilityState=\{\{ expanded: more \}\}/g) ?? []).length, 1, 'there is not exactly one More disclosure');
    assert.ok(at('<ConversationPackCard') < at('label="Practise this phrase"'), 'the practice comes before the win and the focus');
    assert.ok(at('label="Practise this phrase"') < at('label="Finish conversation"'), 'Done comes before the practice');
    assert.ok(at('label="Finish conversation"') < at('expanded: more'), 'More is drawn before Done, so opening it pushes the way out down the screen');
  });

  test('a focus sound is said with a word first, and its symbol is an optional detail', () => {
    // Stage 3A Fable review (2026-09-25): the inventory's example word is passed
    // too, so a sound with no minimal pair is not led with notation either.
    assert.match(code, /heading: exampleFirstHeading\(closure\.focus\.acoustic, closure\.focus\.example\)/, 'the recap leads the focus with notation');
    assert.match(code, /const \[soundDetail, setSoundDetail\] = useState\(false\);/, 'the sound symbol is shown before anyone asks');
    assert.match(code, /soundDetail && <Text[^>]*>\{closure\.focus\.acoustic\.heading\}<\/Text>/, 'the original notation is not reachable at all');
    assert.match(code, /SOUND_DETAIL\.show/, 'the toggle spells its own words');
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

  test('practice is the recommended next action and finishing stays available', () => {
    assert.match(screen, /<PillButton\s+label="Practise this phrase"/);
    assert.match(screen, /<GhostButton label="Finish conversation"/);
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
