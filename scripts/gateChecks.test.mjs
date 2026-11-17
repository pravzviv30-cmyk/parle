import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { suiteProblems, malformedVerifiedBy, isTestFile, focusProblems, unrunTestFiles, REQUIRED_COMMANDS, guardWiringProblems, PROOF_FLOOR_KEY, workspaceKeys, belowFloor } from './gateChecks.mjs';

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

describe('gate — every test on disk runs, and runs whole', () => {
  test('a test file that no workspace and no proof list runs fails the gate', () => {
    const workspaces = [{ dir: 'apps/mobile', glob: 'src/**/*.test.ts' }];
    const proofs = ['scripts/loop.test.mjs', 'services/shared/audioDecode.test.ts'];
    const files = [
      'apps/mobile/src/home/today.test.ts',
      'apps/mobile/src/home/Card.test.tsx',
      'apps/mobile/e2e/flow.test.ts',
      'scripts/loop.test.mjs',
      'services/shared/audioDecode.test.ts',
      'services/shared/forgotten.test.ts',
    ];
    assert.deepEqual(unrunTestFiles(files, workspaces, proofs), [
      'apps/mobile/src/home/Card.test.tsx',
      'apps/mobile/e2e/flow.test.ts',
      'services/shared/forgotten.test.ts',
    ], 'a file the workspace glob does not match and no proof list names never runs, so whatever it defends is undefended');
  });

  test('a suite that skipped a test fails the gate', () => {
    const problems = suiteProblems('@luvani/x', { code: 0, out: summary({ tests: 3, pass: 2, skipped: 1 }) });
    assert.equal(problems.length > 0, true,
      'a skip in option form, { skip: true } or t.skip(), slips past the source scan; the runtime count sees every form');
    assert.match(problems.join('\n'), /skipped/, 'the detail says a test was skipped');
  });

  test('a focused or skipped test is caught in every test extension', () => {
    for (const ext of ['ts', 'tsx', 'mts', 'cts', 'js', 'mjs', 'cjs']) {
      assert.equal(isTestFile(`thing.test.${ext}`), true, `a .test.${ext} file is a test file the scan must read`);
    }
    assert.equal(isTestFile('thing.ts'), false, 'a source file is not a test file');
    // Built by concatenation so this file does not trip the scan it is testing.
    const dot = '.';
    assert.equal(focusProblems('a.test.mjs', `test${dot}only('x', () => {})`).length, 1, 'a focused test hides every other test in the file');
    assert.equal(focusProblems('a.test.tsx', `describe${dot}skip('x', () => {})`).length, 1, 'a skipped block defends nothing');
    assert.deepEqual(focusProblems('a.test.mjs', "test('x', () => {})"), [], 'a plain test is fine');
  });
});

describe('gate — the push check cannot be unplugged quietly', () => {
  test('the gate fails when the push-check hook or the push-check and land commands go missing', () => {
    for (const command of ['push-check', 'land']) {
      assert.equal(REQUIRED_COMMANDS.includes(command), true, `/${command} is how code reaches main; the gate must notice it vanishing`);
    }
    const hook = { type: 'command', command: 'node "$CLAUDE_PROJECT_DIR/scripts/push-check-guard.mjs" hook' };
    const settings = (entries) => JSON.stringify({ hooks: { PreToolUse: entries } });
    assert.deepEqual(guardWiringProblems(settings([{ matcher: 'Bash', hooks: [hook] }])), [],
      'the repo settings as they stand wire the guard on every Bash call');
    assert.deepEqual(guardWiringProblems(settings([{ matcher: 'Bash|Grep', hooks: [hook] }])), [],
      'a matcher that names Bash among others still reaches every push');
    assert.equal(guardWiringProblems(settings([{ matcher: 'Bash', hooks: [] }])).length, 1,
      'with the hook entry deleted every git push goes out unchecked');
    assert.equal(guardWiringProblems(settings([{ matcher: 'Read', hooks: [hook] }])).length, 1,
      'a guard that never sees a Bash call never sees a push');
    assert.equal(guardWiringProblems(null).length, 1, 'no settings file means no guard');
    assert.equal(guardWiringProblems('{ not json').length, 1, 'settings Claude Code cannot read wire nothing');
  });
});

describe('gate — the release and provider proofs are counted like the workspaces', () => {
  test('the release and provider proofs fail below their recorded floor', () => {
    assert.deepEqual(belowFloor(PROOF_FLOOR_KEY, 359, 359), [], 'at the floor is green');
    assert.equal(belowFloor(PROOF_FLOOR_KEY, 358, 359).length, 1,
      'one test fewer means a proof file stopped loading, which "more than zero tests" never noticed');
    assert.match(belowFloor(PROOF_FLOOR_KEY, 358, 359)[0], /floor is 359/, 'the detail names the floor it fell below');
    assert.equal(belowFloor(PROOF_FLOOR_KEY, 359, undefined).length, 1,
      'a deleted floor is not a floor of zero; it is a missing guard');
  });

  test('a floors key that is not a workspace is not run as one', () => {
    assert.deepEqual(workspaceKeys({ '@luvani/core': 1152, [PROOF_FLOOR_KEY]: 359, '@luvani/mobile': 4112 }),
      ['@luvani/core', '@luvani/mobile'],
      'npm test --workspace on the proof floor would fail as an unknown workspace, so only @ keys run');
  });
});
