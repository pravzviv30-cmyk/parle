/**
 * Prepare for a real moment: the plan is stated before the learner fills the
 * form (whole-app Stage 3A, 2026-09-25).
 *
 * The screen already knew whether the plan includes personal rehearsals, but
 * a learner without Max only met the plain line and the door to plans at the
 * foot of the page, after choosing a situation and writing about it. Now the
 * one plan notice sits above the situation list and says, in one place, what
 * the plan allows: checking, could not check (with a retry and the draft kept),
 * not included (with the one door to plans), or included.
 *
 * A failed plan read is never shown as an upgrade: only a plan that answered
 * and does not include rehearsals is offered one. No price, no entitlement
 * change: `capabilitiesFor` is read exactly as before.
 *
 * No renderer in this suite (docs/TESTING.md), so the screen is read as source.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { guiltIn } from '../copy/guilt.ts';
import { PLAN_CHECKING, PLAN_INCLUDED, PLAN_READ_FAILED } from './realMoments.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const SCREEN = stripComments(read('./RealMomentScreen.tsx'));
const RENDER = SCREEN.slice(SCREEN.indexOf('return (', SCREEN.indexOf('export function RealMomentScreen')));

function at(marker: string): number {
  const i = RENDER.indexOf(marker);
  assert.notEqual(i, -1, `\`${marker}\` is not on the real moment screen at all`);
  return i;
}

describe('a real moment says what the plan allows before the learner fills anything in', () => {
  test('the plan notice, the upgrade line and the one door to plans come before the situation list and the form', () => {
    const list = at('REAL_MOMENTS.map(');
    assert.ok(at('{MAX_ONLY_LINE}') < list, 'the Max requirement is only said after the situations');
    assert.ok(at('label={SEE_PLANS}') < list, 'the way to plans is only offered after the situations');
    assert.ok(at('<Field') > list, 'the form comes before the situations');
    assert.equal((RENDER.match(/label=\{SEE_PLANS\}/g) ?? []).length, 1, 'the screen offers two doors to the same plans');
    assert.equal((RENDER.match(/\{MAX_ONLY_LINE\}/g) ?? []).length, 1, 'the Max line is said twice');
  });

  test('a plan that could not be read is a retry, never an upgrade', () => {
    // The failed read and the upgrade are separate branches of the one notice.
    // A failed read leaves `allowed` null, so the unknown branch carries both
    // the wait and the failure, and neither mentions Max or plans.
    const unknown = RENDER.slice(at('{allowed === null && <Text'), at('{allowed === false && ('));
    assert.match(unknown, /accessibilityLiveRegion="polite"[^>]*>\{planError \? PLAN_READ_FAILED : PLAN_CHECKING\}<\/Text>/, 'a failed read and a check in flight are not said in their own words');
    assert.match(unknown, /\{planError && <GhostButton label="Check my plan again" onPress=\{\(\) => setPlanAttempt/, 'a failed read has no retry');
    assert.doesNotMatch(unknown, /SEE_PLANS|MAX_ONLY_LINE|onSeePlans/, 'a failed plan read is offered an upgrade');
    assert.match(SCREEN, /setAllowed\(status === null \? null : capabilitiesFor\(status\.plan, status\.lapsed\)\.customRehearsal\)/, 'an unread plan is read as a plan without Max');
    assert.match(RENDER, /\{allowed === true && <Text[^>]*>\{PLAN_INCLUDED\}<\/Text>\}/, 'a learner with Max is not told it is included');
    for (const line of [PLAN_CHECKING, PLAN_INCLUDED, PLAN_READ_FAILED]) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries "${guiltIn(line)}"`);
      assert.doesNotMatch(line, /—|\d|£|\$|€/, `"${line}" carries an em dash, a number or a price`);
    }
  });
});
