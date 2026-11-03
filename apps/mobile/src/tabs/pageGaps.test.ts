/**
 * The gaps between separate cards on each tab page (phone fixes, item 3,
 * 2026-11-02). Founder on an iPhone: Today's three tiles sat on the hero, and
 * pages read cramped. Page gaps now come from theme.ts's RHYTHM: 12 between
 * list items and stacked tiles, 20 between separate cards, 32 between
 * sections. Gaps inside a card are the card's own and are not pinned here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

test('Today keeps 16pt between the sky tiles and the hero, and sections RHYTHM.section apart', () => {
  const sky = read('../home/SkyBand.tsx');
  assert.match(sky, /<View style=\{\{ height: overlap \+ space\(4\) \}\} \/>/, 'the hero sits on the tiles again');
  const layout = read('../home/TodayLayout.tsx');
  assert.match(layout, /section: \{ marginTop: RHYTHM\.section \}/);
});

test('each tab page spaces its cards and sections with RHYTHM', () => {
  const practice = read('./PracticeTab.tsx');
  assert.match(practice, /page: \{ gap: RHYTHM\.block \}/);
  assert.match(practice, /emptyPage: \{ gap: RHYTHM\.block \}/);
  assert.match(practice, /list: \{ gap: RHYTHM\.item \}/);
  const speak = read('./TutorTab.tsx');
  assert.match(speak, /page: \{ gap: RHYTHM\.block \}/);
  assert.match(speak, /scenes: \{ gap: RHYTHM\.item \}/);
  const journey = read('./MyFrenchTab.tsx');
  assert.match(journey, /body: \{ paddingTop: space\(6\), paddingHorizontal: 22, gap: RHYTHM\.section \}/);
  assert.match(journey, /page: \{ gap: RHYTHM\.section \}/);
  assert.match(journey, /stack: \{ gap: RHYTHM\.item \}/);
  const explore = read('./ExploreTab.tsx');
  assert.match(explore, /page: \{ gap: RHYTHM\.section \}/);
  assert.match(explore, /column: \{ gap: RHYTHM\.section \}/);
  assert.match(explore, /stack: \{ gap: RHYTHM\.item \}/);
  assert.match(explore, /grid: \{ flexDirection: 'row', flexWrap: 'wrap', gap: RHYTHM\.item \}/);
});

test('RHYTHM holds 12 between items, 20 between cards and 32 between sections', () => {
  // theme.ts imports React Native, so its source is read: a 4pt space and the three steps on it.
  const theme = read('../theme.ts');
  assert.match(theme, /export const space = \(n: number\) => n \* 4;/, 'space is no longer the 4pt base');
  const rhythm = /export const RHYTHM = \{([^}]*)\}/.exec(theme)?.[1] ?? '';
  assert.match(rhythm, /item: space\(3\)/, 'the gap between items is not 12');
  assert.match(rhythm, /block: space\(5\)/, 'the gap between cards is not 20');
  assert.match(rhythm, /section: space\(8\)/, 'the gap between sections is not 32');
});
