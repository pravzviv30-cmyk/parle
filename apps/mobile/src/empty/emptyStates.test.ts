// 2026-10-21 UI-008, artboard B-Empty-States: the "Out of speaking time" card
// is decided from the plan band and says its refill only in the band's words.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { guiltIn } from '../copy/guilt.ts';
import { PLAN_LABELS, type PlanStatusView } from '../purchases/planStatus.ts';
import { ALL_DONE_ART, AWAY_ART, OUT_OF_TIME, OUT_OF_TIME_ART, outOfTimeCard } from './emptyStates.ts';

const free = (band: 'plenty' | 'a-little' | 'none', bandLine: string) => ({ known: true, planLabel: PLAN_LABELS.trial, periodLine: 'Free every week.', band, bandLine, canStart: band !== 'none' }) satisfies PlanStatusView;

test('the free plan with no time left gets the card, with the band line as its refill', () => {
  assert.deepEqual(outOfTimeCard(free('none', 'Free minutes refill Monday.')), {
    title: OUT_OF_TIME.title,
    body: 'Free minutes refill Monday. Practice, review and your phrases are all still here.',
    action: 'See the plans',
  });
  assert.equal(outOfTimeCard(free('a-little', 'x')), null, 'a learner with time left was told it was used');
  assert.equal(outOfTimeCard({ ...free('none', 'No speaking time left for now.'), planLabel: PLAN_LABELS.starter }), null, 'a paid plan was told about free time');
  assert.equal(outOfTimeCard({ known: false, line: 'x' }), null);
  assert.equal(outOfTimeCard(null), null);
  for (const line of [OUT_OF_TIME.title, OUT_OF_TIME.still]) {
    assert.equal(guiltIn(line), undefined, line);
    assert.ok(!line.includes('—'), line);
  }
  assert.ok(!/7 days|free trial|Monday/.test(`${OUT_OF_TIME.title} ${OUT_OF_TIME.still}`), 'the card promises a trial or a day of its own');
});

test('Speak draws the away card and the out-of-time card from the one empty-state part', () => {
  const speak = readFileSync(new URL('../tabs/TutorTab.tsx', import.meta.url), 'utf8');
  assert.match(speak, /<EmptyStateCard ground="lavender" art=\{AWAY_ART\}/);
  assert.match(speak, /<EmptyStateCard art=\{OUT_OF_TIME_ART\}/);
  assert.deepEqual(AWAY_ART, { name: 'coffee-break', width: 150, height: 137 });
  assert.deepEqual(OUT_OF_TIME_ART, { name: 'clock-calendar', width: 140, height: 124 });
  assert.deepEqual(ALL_DONE_ART, { name: 'cloud-cheer', width: 150, height: 114 });
  assert.match(speak, /const outOfTime = offlineShown \? null : outOfTimeCard\(planView\);/);
  assert.match(speak, /nav\.navigate\('Wall', \{ entry: 'refused' \}\)/);
});
