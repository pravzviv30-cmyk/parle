/**
 * Then and now (2026-10-20, B4, B-ThenNow): first try next to best, in the
 * ladder's help words, per guided scene, asked of `thenNowView.ts` directly;
 * then the screen read for its reads, its doors and what it must never call.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { MISSIONS, missionStates } from '@luvani/core';

import { missionCompletionsFrom } from '../missions/chooserView.ts';
import { COMPLETIONS_PER_MISSION } from '../missions/store.ts';
import { retainCompletions } from '../missions/retain.ts';
import { shortDate, type StoredCompletion } from './journeyView.ts';
import { HELP_BAR, LEGEND, LEGEND_BARS, STATUS, THEN_NOW_FOOTER, THEN_NOW_INTRO, THEN_NOW_TITLE, TRY_IT_AGAIN, thenNowView } from './thenNowView.ts';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 9, 20, 12).getTime();
const at = (day: number) => new Date(2026, 9, day, 9).getTime();
const progressOf = (stored: readonly StoredCompletion[]) => missionStates(missionCompletionsFrom(stored), [], NOW);
const view = (stored: StoredCompletion[]) => thenNowView({ progress: progressOf(stored), completions: stored });

describe('then and now, per guided scene', () => {
  test('the legend is the four help words in ladder order, most help first', () => {
    assert.deepEqual([...LEGEND], ['Line given', 'Choices', 'Hint', 'On your own']);
    assert.equal(THEN_NOW_TITLE, 'Then and now');
    assert.equal(THEN_NOW_INTRO, 'Your first try at each guided scene, next to your best. Your best never goes backwards, even on a tired day.');
    assert.match(THEN_NOW_FOOTER, /^Free conversations don’t appear here, because they don’t have guided steps\.$/);
  });

  test('first is the earliest retained try and best the highest rung, each in words and dated', () => {
    const stored: StoredCompletion[] = [
      { id: 'mission:premier-cafe', at: at(17), rung: 4 },
      { id: 'mission:premier-cafe', at: at(12), rung: 1 },
      { id: 'mission:premier-cafe', at: at(19), rung: 2 },
    ];
    const row = view(stored).rows.find((r) => r.missionId === 'mission:premier-cafe')!;
    assert.equal(row.status, STATUS.earned);
    // 2026-10-20 UI-008, artboard B-ThenNow: each cell carries its rung's bar colour too.
    assert.deepEqual(row.first, { label: 'First, 12 Oct', help: 'Line given', bar: 'lavender' });
    assert.deepEqual(row.best, { label: 'Best, 17 Oct', help: 'On your own', bar: 'mint' }, 'a tired replay walked the best backwards');
    assert.equal(row.tile.ground, 'sage', 'an earned scene is not on the sage tile');
    assert.equal(row.hint, null);
    assert.deepEqual(row.route, { screen: 'ScenePreview', params: { missionId: 'mission:premier-cafe' } });
    assert.match(row.accessibilityLabel, /First, 12 Oct, Line given\. Best, 17 Oct, On your own/);
  });

  test('a single try says "Tried once", has no best, and asks for another go', () => {
    const row = view([{ id: 'mission:cafe', at: at(18), rung: 2 }]).rows.find((r) => r.missionId === 'mission:cafe')!;
    assert.equal(row.status, STATUS.once);
    // 2026-10-20 UI-008, artboard B-ThenNow: Choices draws the periwinkle bar, on the butter tile.
    assert.deepEqual(row.first, { label: 'First, 18 Oct', help: 'Choices', bar: 'periwinkle' });
    assert.equal(row.tile.ground, 'butter');
    assert.deepEqual(row.tile.icon, { name: 'icon-cafe', width: 28, height: 26 });
    assert.equal(row.best, null);
    assert.equal(row.hint, 'Try again to see your best here');
    assert.deepEqual(row.route, { screen: 'ScenePreview', params: { missionId: 'mission:cafe' } });
    assert.equal(TRY_IT_AGAIN, 'Try it again');
  });

  test('an untried scene says so, with nothing invented under it', () => {
    const row = view([]).rows.find((r) => r.missionId === 'mission:hotel')!;
    assert.equal(row.status, STATUS.untried);
    assert.equal(row.first, null);
    assert.equal(row.best, null);
    assert.equal(row.route, null);
    assert.equal(row.tile.ground, 'lavender', 'an untried scene is not on the lavender tile');
  });

  test('several tries with help, none on your own, are practised with help', () => {
    const row = view([{ id: 'mission:cafe', at: at(10), rung: 1 }, { id: 'mission:cafe', at: at(11), rung: 3 }]).rows.find((r) => r.missionId === 'mission:cafe')!;
    assert.equal(row.status, STATUS.helped);
    assert.equal(row.best!.help, 'Hint');
  });

  test('your best never goes backwards: 25 tries with the line given after one on your own keep the best', () => {
    // Backs the intro's promise against the store's own retention.
    const tries: StoredCompletion[] = [{ id: 'mission:cafe', at: NOW - 30 * DAY, rung: 4 }];
    for (let i = 0; i < 25; i += 1) tries.push({ id: 'mission:cafe', at: NOW - (29 - i) * DAY, rung: 1 });
    const kept = retainCompletions(tries, COMPLETIONS_PER_MISSION);
    assert.equal(kept.length, COMPLETIONS_PER_MISSION);
    const row = view(kept).rows.find((r) => r.missionId === 'mission:cafe')!;
    assert.equal(row.best!.help, 'On your own');
    assert.equal(row.best!.label, `Best, ${shortDate(NOW - 30 * DAY)}`);
    assert.equal(row.status, STATUS.earned);
    assert.match(row.first!.label, /^First try we still have, /);
  });

  test('"First try we still have" only once retention may have dropped the first', () => {
    const many: StoredCompletion[] = Array.from({ length: COMPLETIONS_PER_MISSION }, (_, i) => ({ id: 'mission:cafe', at: NOW - (40 - i) * DAY, rung: 2 }));
    assert.match(view(many).rows.find((r) => r.missionId === 'mission:cafe')!.first!.label, /^First try we still have, /);
    assert.match(view(many.slice(1)).rows.find((r) => r.missionId === 'mission:cafe')!.first!.label, /^First, /);
  });

  test('the scenes are this stage\'s plus any tried, and a free conversation never appears', () => {
    const rows = view([{ id: 'mission:amis', at: at(5), rung: 2 }, { id: 'conversation:free', at: at(6), rung: 4 }]).rows;
    const ids = rows.map((r) => r.missionId);
    for (const id of MISSIONS.filter((m) => m.cefr === 'A0').map((m) => m.id)) assert.ok(ids.includes(id));
    assert.ok(ids.includes('mission:amis'));
    assert.ok(!ids.includes('conversation:free'));
    assert.ok(!ids.includes('mission:marche'));
  });

  // 2026-10-20 UI-008, artboard B-ThenNow: the legend's bars, most help first.
  test('the legend pairs each help word with its bar, and the bars are marks, not numbers', () => {
    assert.deepEqual(LEGEND_BARS.map((b) => b.word), [...LEGEND]);
    assert.deepEqual(LEGEND_BARS.map((b) => b.bar), ['lavender', 'periwinkle', 'hint', 'mint']);
    assert.deepEqual(HELP_BAR, { 1: 'lavender', 2: 'periwinkle', 3: 'hint', 4: 'mint' });
  });

  test('help is words only, and the lock is the seam\'s', () => {
    const stored: StoredCompletion[] = [1, 2, 3, 4].map((rung, i) => ({ id: 'mission:cafe', at: at(10 + i), rung }));
    for (const row of view(stored).rows) {
      for (const cell of [row.first, row.best]) if (cell !== null) assert.ok(LEGEND.includes(cell.help), `${cell.help} is not a help word`);
    }
    assert.equal(view(stored).locked, false);
    assert.equal(thenNowView({ progress: progressOf(stored), completions: stored, access: () => 'locked' }).locked, true);
  });
});

describe('the Then and now screen', () => {
  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
  const screen = read('./ThenNowScreen.tsx');
  const flat = screen.replace(/\s+/g, ' ');

  test('it reads one store, fenced to the account, and decides nothing itself', () => {
    assert.match(flat, /const scope = scopeGeneration\(\);/);
    assert.match(flat, /if \(!cancelled && scopeGeneration\(\) === scope\) setCompletions\(stored\)/);
    // 2026-10-20, lock seam wiring: the view gets the reactive seam's access.
    assert.match(flat, /thenNowView\(\{ progress: missionStates\(missionCompletionsFrom\(completions\), \[\], Date\.now\(\)\), completions, access: locks\.access \}\)/);
  });

  test('Try it again opens the scene preview, back leaves, and the lock badge comes through the view', () => {
    assert.match(flat, /nav\.navigate\('ScenePreview', \{ missionId: row\.missionId \}\)/);
    // 2026-10-20 UI-008, artboard B-ThenNow: the 44pt white back button shares
    // the title's row; the badge sits beside the 26/800 title; Try it again is
    // the 44pt ink pill, drawn only while a scene has no best yet. It still
    // opens the scene preview (not Speak): Speak takes no scene, and the
    // preview is where a scene is started.
    assert.match(flat, /<BackButton onPress=\{\(\) => \(nav\.canGoBack\(\) \? nav\.goBack\(\) : nav\.navigate\('Tabs'\)\)\} \/>/);
    assert.match(flat, /\{view\?\.locked \? <LockBadge feature="thenAndNow" \/> : null\}/);
    assert.match(flat, /\{row\.route !== null && row\.best === null && \( <BButton label=\{TRY_IT_AGAIN\}[^>]*height=\{44\} ground=\{t\.primary\}/);
  });

  test('it never reads the plan or the continue arc', () => {
    for (const body of [screen, read('./thenNowView.ts')]) {
      assert.ok(!body.includes('capabilitiesFor('));
      assert.ok(!body.includes('useContinueArc('));
      assert.doesNotMatch(body, /from '[^']*(?:purchases|wall)\//);
    }
  });

  test('French scene names are tagged, decoration is hidden, and nothing is clipped', () => {
    // 2026-10-20 UI-008, artboard B-ThenNow: the scene head is journey/JourneyParts' SceneHead.
    const parts = read('./JourneyParts.tsx').replace(/\s+/g, ' ');
    assert.match(parts, /<Text \{\.\.\.frenchText\} style=\{\[bType\.title17/);
    assert.match(flat, /accessible accessibilityLabel=\{row\.accessibilityLabel\}/);
    assert.match(flat, /<View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>/, 'the cells are said twice');
    assert.doesNotMatch(screen, /numberOfLines|fontSize|—/);
    assert.doesNotMatch(read('./JourneyParts.tsx'), /numberOfLines|fontSize|—/);
  });
});
