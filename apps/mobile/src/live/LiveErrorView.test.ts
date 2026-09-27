/**
 * The live failure screen: recovery first, support details folded away.
 *
 * Whole-app Stage 3A (2026-09-25). A learner whose conversation could not open
 * needs the next useful action, not network jargon. The diagnostic rows (token
 * server, auth headers, room service and the rest) stay for whoever is helping
 * them, behind one collapsed "Support details" disclosure that is closed by
 * default and drawn after every recovery action.
 *
 * No renderer in this suite (docs/TESTING.md), so the screen is read as source.
 * The ceiling is honest: it proves the order and the default, never that a
 * phone drew the panel closed.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { guiltIn } from '../copy/guilt.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const VIEW = stripComments(read('./LiveErrorView.tsx'));
const FLAT = VIEW.replace(/\s+/g, ' ');
const RENDER = VIEW.slice(VIEW.indexOf('return ('));

function at(marker: string): number {
  const i = RENDER.indexOf(marker);
  assert.notEqual(i, -1, `\`${marker}\` is not on the failure screen at all`);
  return i;
}

describe('the live failure screen puts recovery first', () => {
  test('the technical rows sit behind a closed Support details disclosure, after every recovery action', () => {
    // Closed unless the learner opens it.
    assert.match(FLAT, /const \[open, setOpen\] = useState\(false\);/, 'the support details open by themselves');
    assert.match(FLAT, /\{open \? 'Hide support details' : 'Support details'\}/, 'the disclosure is not named Support details');
    assert.match(FLAT, /accessibilityState=\{\{ expanded: open \}\}/, 'the disclosure does not say whether it is open');
    assert.ok(!VIEW.includes('What happened?'), 'the disclosure still reads as a question a learner is meant to answer');

    // Every technical row is inside the open branch, never on the default screen.
    const panel = FLAT.slice(FLAT.indexOf('{open ? ('));
    assert.ok(FLAT.includes('{open ? ('), 'the rows are not behind the disclosure');
    for (const row of ['Token server', 'Auth headers', 'Room service', 'Session token', 'Server phases']) {
      assert.ok(panel.includes(`name="${row}"`), `${row} is not inside the closed support panel`);
      assert.equal((FLAT.match(new RegExp(`name="${row}"`, 'g')) ?? []).length, 1, `${row} is drawn outside the support panel as well`);
    }

    // Recovery first: the ways forward are drawn before the disclosure.
    const disclosure = at("'Support details'");
    for (const action of ['label="Continue by typing"', 'label="Check microphone settings"', 'label="Back"']) {
      assert.ok(at(action) < disclosure, `${action} is drawn after the support details`);
    }
    // And the sentence a learner acts on is before all of it.
    assert.ok(at('{message}') < at('label="Back"'), 'the recovery sentence comes after the controls');
  });

  test('the words a learner reads here are calm and plain', () => {
    for (const line of ['Support details', 'Hide support details', 'Let’s get you back to French', 'Continue by typing', 'Check microphone settings']) {
      assert.ok(VIEW.includes(line), `the failure screen no longer says "${line}"`);
      assert.equal(guiltIn(line), undefined, `"${line}" carries "${guiltIn(line)}"`);
      assert.doesNotMatch(line, /—/);
    }
  });
});
