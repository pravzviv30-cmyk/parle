/**
 * 2026-10-21 UI-008, artboard B-OB-Plan, simulator check: every plan row's
 * title, line and tile drawing come from one scene, and every tile has a drawing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getMission } from '@luvani/core';
import manifest from '../../assets/b-art/manifest.json' with { type: 'json' };
import { planFor, REASONS, START_LEVELS } from './plan.ts';
import { freshPreAccountDraft } from './preAccountDraft.ts';
import { planSceneRows, sceneIcon } from './planScenes.ts';

const drafts = REASONS.flatMap(reason => START_LEVELS.map(level => ({ ...freshPreAccountDraft(), reason: reason.key, startLevel: level.key })));

test('each plan row takes its title and line from the same scene', () => {
  for (const draft of drafts) {
    const rows = planSceneRows(planFor(draft as never).scenes, canDo => canDo);
    assert.ok(rows.length > 0);
    for (const row of rows) {
      const mission = getMission(row.id as never)!;
      assert.equal(row.title, mission.title, `${row.id} is titled from another scene`);
      assert.equal(row.line, mission.canDoEn, `${row.id} reads another scene's line`);
    }
  }
});

test('every plan tile carries a canvas drawing, falling back to the café', () => {
  for (const draft of drafts) {
    for (const row of planSceneRows(planFor(draft as never).scenes, canDo => canDo)) {
      assert.ok(row.icon in manifest, `${row.id} has no drawing`);
      assert.equal(row.icon, sceneIcon(getMission(row.id as never)!.place));
    }
  }
  assert.equal(sceneIcon(undefined), 'icon-cafe');
  assert.equal(sceneIcon('somewhere-new'), 'icon-cafe');
});

test('the plan draws its rows only from planSceneRows, and every tile draws its art', () => {
  const plan = readFileSync(new URL('./PersonalPlan.tsx', import.meta.url), 'utf8');
  assert.match(plan, /planSceneRows\(plan\.scenes, canDoSentence\)/);
  assert.match(plan, /title=\{row\.title\} line=\{row\.line\}[\s\S]*art=\{row\.icon\}/);
  assert.doesNotMatch(plan, /line=\{at === 0 \? firstPractice/);
  const parts = readFileSync(new URL('./BOnboardingParts.tsx', import.meta.url), 'utf8');
  assert.match(parts, /last: boolean; art: BArtName \}/);
});

test('the welcome drawing is widened, never cut at its frame', () => {
  const parts = readFileSync(new URL('./BOnboardingParts.tsx', import.meta.url), 'utf8');
  assert.match(parts, /<BArt name="friends-cheer" width=\{256\} height=\{234\} bleed=\{WELCOME_BLEED\}/);
  assert.doesNotMatch(parts.slice(parts.indexOf('welcomeArt:'), parts.indexOf('disc:')), /overflow: 'hidden'/);
});
