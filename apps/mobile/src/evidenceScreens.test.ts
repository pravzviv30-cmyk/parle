/**
 * The practice and evidence screens wear the notebook — notebook Phase 4 (B2),
 * added 2026-09-27.
 *
 * Every screen outside the tabs where a learner practises or looks back at
 * their French: the drills, the review deck, the phrasebook, the daily library,
 * the conversations, the sound check and its journey, the goal step, Profile
 * and its cards, and the Friends screens. None of them may draw the old kit:
 * no tinted row or panel, no row card, no hero card, no feature paper, no
 * whisper shadow, no week rail, and no card inside a card. The highlighter is
 * at most once per file. The final sweep deletes the primitives themselves;
 * this pins that nothing in these files still reaches for them.
 *
 * Read as source with comments stripped, because a comment may name the thing
 * it replaced.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { FRENCH_LIFE_COPY, PROFILE_PURPOSE } from './profile/frenchLife.ts';
import { FRIENDS_PURPOSE, FRIENDS_NO_POINTS } from './friends/friendsView.ts';

const SRC = fileURLToPath(new URL('.', import.meta.url));

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const read = (rel: string): string => stripComments(readFileSync(`${SRC}${rel}`, 'utf8'));

/** Every screen file this pass owns, by directory where the directory is whole. */
const WHOLE_DIRS = ['drill', 'phrases', 'conversationPacks', 'soundcheck', 'goals', 'profile', 'friends', 'practice'];
const SINGLE = [
  'DrillScreen.tsx',
  'ReviewScreen.tsx',
  'tabs/ProfileTab.tsx',
  'tabs/FriendsTab.tsx',
  'illustrations/scenes/reward.tsx',
  'daily/DailyCard.tsx',
  'daily/DailyLibraryScreen.tsx',
  'daily/DailyPracticeScreen.tsx',
];
const FILES: string[] = [
  ...SINGLE,
  ...WHOLE_DIRS.flatMap((dir) =>
    readdirSync(`${SRC}${dir}`)
      .filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
      .map((name) => `${dir}/${name}`),
  ),
];

/** How deep `<Card>` opens inside another `<Card>` in one file. One is a card; two is a card in a card. */
function cardDepth(source: string): number {
  let depth = 0;
  let deepest = 0;
  for (const m of source.matchAll(/<Card\b(?:[^>"']|"[^"]*"|'[^']*'|\{[^}]*\})*?(\/)?>|<\/Card>/g)) {
    if (m[0] === '</Card>') depth -= 1;
    else if (m[1] === undefined) {
      depth += 1;
      deepest = Math.max(deepest, depth);
    }
  }
  return deepest;
}

describe('the practice and evidence screens wear the notebook — Phase 4 B2', () => {
  test('no screen in this pass draws a tint, a row card, a hero card, feature paper, the whisper or the week rail', () => {
    const OLD_KIT = [
      /<TintRow\b/,
      /<TintPanel\b/,
      /<TintDisc\b/,
      /<IconRowCard\b/,
      /<HeroCard\b/,
      /<WeekRail\b/,
      /\baccent\.feature\b/,
      /\bshadow\.whisper\b/,
      /tone="feature"/,
      /\btint=/,
    ];
    const offenders: string[] = [];
    for (const rel of FILES) {
      const body = read(rel);
      for (const pattern of OLD_KIT) if (pattern.test(body)) offenders.push(`${rel}  ${pattern.source}`);
    }
    assert.ok(FILES.length > 40, 'the walk reads too few files to be guarding this pass');
    assert.deepEqual(offenders, [], `The old kit, still drawn:\n${offenders.join('\n')}`);
  });

  test('no card sits inside another card, and the highlighter is used at most once a file', () => {
    assert.equal(cardDepth('<Card><Card>x</Card></Card>'), 2, 'the depth check cannot see a nested card');
    assert.equal(cardDepth('<Card style={a}>x</Card><Card />'), 1, 'the depth check reads siblings as nesting');
    const nested: string[] = [];
    const loud: string[] = [];
    for (const rel of FILES) {
      const body = read(rel);
      if (cardDepth(body) > 1) nested.push(rel);
      if ((body.match(/<Highlight\b/g) ?? []).length > 1) loud.push(rel);
    }
    assert.deepEqual(nested, [], `A card inside a card:\n${nested.join('\n')}`);
    assert.deepEqual(loud, [], `More than one highlighter on a screen:\n${loud.join('\n')}`);
  });

  test('the drill verdict mark is still, and the word chips are plain paper', () => {
    const reward = read('illustrations/scenes/reward.tsx');
    assert.doesNotMatch(reward, /\bAnimated\b|useSceneMotion|arriveStyle|interpolate/, 'RewardMark moves again');
    assert.match(reward, /export function RewardMark\(/, 'RewardMark is gone, so the drill has no verdict mark');
    const drill = read('DrillScreen.tsx');
    assert.doesNotMatch(drill, /WORD_TINT/, 'the drill still names a tint for its word chips');
  });

  test('the profile avatar is the notebook Monogram: an ink initial on groundDeep, no ring', () => {
    const button = read('profile/ProfileButton.tsx');
    assert.match(button, /<Monogram\b/, 'the avatar hand-rolls its own disc instead of the shared Monogram');
    assert.doesNotMatch(button, /borderWidth|borderColor|backgroundColor|accent\./, 'the avatar draws a ring or its own paper');
    assert.match(button, /accessibilityLabel="Open profile and settings"/, 'the avatar lost its one accessible name');
  });

  test('the week on Profile is one plain sentence, not a rail', () => {
    const card = read('profile/FrenchLifeCard.tsx');
    const flat = card.replace(/\s+/g, ' ');
    assert.doesNotMatch(card, /WeekRail|WEEKDAY_LABELS|RHYTHM_TINT/, 'the week is still drawn as a rail of marks');
    assert.match(flat, /\{rhythmSentence\(week\)\}/, 'the week is not said as the momentum module\'s one sentence');
    assert.equal((card.match(/<Text\b/g) ?? []).length, 1, 'the week card says more than one thing');
  });

  test('the copy pass: no taglines, no "Ready when you are"', () => {
    const TAGLINES = ['Your French journey, your way.', 'A little French, together.', 'Ready when you are'];
    for (const rel of FILES) {
      const body = read(rel);
      for (const line of TAGLINES) assert.ok(!body.includes(line), `${rel} still says "${line}"`);
    }
    for (const line of [PROFILE_PURPOSE, FRIENDS_PURPOSE, FRIENDS_NO_POINTS, ...FRENCH_LIFE_COPY]) {
      assert.ok(!TAGLINES.includes(line), `"${line}" is a tagline the copy pass cut`);
      assert.doesNotMatch(line, /—|\byour way\b|journey/i, `"${line}" reads as a tagline or carries an em dash`);
    }
    assert.match(read('tabs/FriendsTab.tsx'), /purpose=\{FRIENDS_PURPOSE\}/, 'Friends types its purpose line in JSX, where no sweep can read it');
  });
});
