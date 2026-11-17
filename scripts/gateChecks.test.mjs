import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { suiteProblems, malformedVerifiedBy } from './gateChecks.mjs';

/** A node:test summary block as the spec reporter prints it. */
const summary = ({ tests = 3, pass = 3, fail = 0, cancelled = 0, skipped = 0 } = {}) =>
  [`ℹ tests ${tests}`, `ℹ pass ${pass}`, `ℹ fail ${fail}`, `ℹ cancelled ${cancelled}`, `ℹ skipped ${skipped}`, 'ℹ todo 0'].join('\n');

describe('gate — a suite is only green when it finished cleanly', () => {
  test('a suite that cancelled a test or exited non-zero fails the gate even with zero failures', () => {
    assert.deepEqual(suiteProblems('@luvani/x', { code: 0, out: summary() }), [],
      'a clean run with exit 0 is the only shape that passes');
    const timedOut = suiteProblems('@luvani/x', { code: 1, out: summary({ tests: 3, pass: 2, cancelled: 1 }) });
    assert.equal(timedOut.length > 0, true,
      'a test that timed out reports fail 0 and cancelled 1; it defended nothing, so the suite is red');
    assert.match(timedOut.join('\n'), /cancelled/, 'the detail says what went wrong, so the loop can act on it');
    const crashed = suiteProblems('@luvani/x', { code: 1, out: summary() });
    assert.equal(crashed.length > 0, true,
      'a runner that exits non-zero is red whatever its summary claims, as the release proofs already treat it');
    assert.match(crashed.join('\n'), /exit/, 'the detail names the exit code');
  });
});

describe('gate — a ledger tick is only checked when its test is named cleanly', () => {
  test('a verified-by line with text after the closing backtick fails the goal check', () => {
    const ledger = [
      '### F1 — something',
      '- verified-by: `a clean title`',
      '- verified-by: `a renamed title` (renamed 2026-10-20 when the bar moved)',
      '    - verified-by: `the format block, indented, is not an entry`',
      '- note: a renamed title used to be called something else',
    ].join('\n');
    assert.deepEqual(malformedVerifiedBy(ledger), [
      { line: 3, text: '- verified-by: `a renamed title` (renamed 2026-10-20 when the bar moved)' },
    ], 'the strict parser skips a line with trailing text, so its test is never checked; the gate must say so instead');
  });
});
