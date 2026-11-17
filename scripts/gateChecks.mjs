/**
 * The gate's pure checks. `gate.mjs` cannot be imported without running the whole gate,
 * so the decisions it makes on text live here, where `gateChecks.test.mjs` can feed them
 * fixtures without spawning anything.
 */

/** The node:test summary counts, or null for a count the output never printed. */
export function suiteSummary(out) {
  const num = (label) => {
    const m = out.match(new RegExp(`^[ℹ#] ${label} (\\d+)$`, 'm'));
    return m ? Number(m[1]) : null;
  };
  return {
    tests: num('tests'),
    pass: num('pass'),
    fail: num('fail'),
    cancelled: num('cancelled'),
    skipped: num('skipped'),
  };
}

/** Why one suite run is red, as gate failure details. Empty means it is sound. */
export function suiteProblems(name, { code, out }) {
  const s = suiteSummary(out);
  if (s.tests === null || s.fail === null) {
    return [`${name}: could not read a test summary — the suite did not finish.\n${out.slice(-2000)}`];
  }
  const problems = [];
  if (s.fail > 0) {
    const names = out
      .split('\n')
      .filter((l) => l.trim().startsWith('✖ '))
      .slice(0, 15)
      .map((l) => l.trim());
    problems.push(`${name}: ${s.fail} failing\n${names.join('\n')}`);
  }
  // A timed-out test is cancelled, not failed: `fail 0`, `cancelled 1`, exit 1.
  // The runtime count catches every skip form, `{ skip: true }` and `t.skip()` included.
  if (s.skipped > 0) problems.push(`${name}: ${s.skipped} skipped — a skipped test is a test that is not defending anything`);
  if (s.cancelled > 0) problems.push(`${name}: ${s.cancelled} cancelled — a test that never finished defended nothing`);
  if (code !== 0 && problems.length === 0) {
    problems.push(`${name}: the runner exited ${code} with no failing test named.\n${out.slice(-2000)}`);
  }
  return problems;
}

/** The only verified-by form the goal check reads: the title in backticks, nothing after. */
export const VERIFIED_BY = /^-\s*verified-by:\s*`(.+)`\s*$/;

/**
 * Ledger lines that start `- verified-by:` but do not match the strict form the goal check
 * reads. The strict parser skips them, so the test they name would never be checked.
 */
export function malformedVerifiedBy(ledger) {
  return ledger
    .split('\n')
    .map((text, i) => ({ line: i + 1, text }))
    .filter(({ text }) => /^-\s*verified-by:/.test(text) && !VERIFIED_BY.test(text));
}

/** A file the scan treats as a test. */
export function isTestFile(name) {
  return /\.test\.[cm]?[jt]sx?$/.test(name);
}

/** A focused or skipped test, read from the source. */
export function focusProblems(rel, source) {
  const problems = [];
  if (/\b(test|describe|it)\.only\s*\(/.test(source)) {
    problems.push(`${rel}: a focused .only() hides every other test in the file`);
  }
  if (/\b(test|describe|it)\.skip\s*\(/.test(source)) {
    problems.push(`${rel}: a skipped test is a test that is not defending anything`);
  }
  return problems;
}

/** Test files, relative to the repo root, that no floored workspace's glob and no proof list runs. */
export function unrunTestFiles(files, workspaces, proofList) {
  const matchers = workspaces.map(({ dir, glob }) => globRegExp(`${dir}/${glob}`));
  return files.filter((file) => !proofList.includes(file) && !matchers.some((m) => m.test(file)));
}

/** The node --test glob shapes the workspaces use: `**` for any folders, `*` inside one. */
function globRegExp(glob) {
  const body = glob
    .split(/(\*\*\/|\*)/)
    .map((part) => (part === '**/' ? '(?:.*/)?' : part === '*' ? '[^/]*' : part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')))
    .join('');
  return new RegExp(`^${body}$`);
}

/** The .claude/commands the workflow depends on. */
export const REQUIRED_COMMANDS = ['forge', 'bug-sweep', 'ship', 'backend-review', 'push-check', 'land'];

/** Why `.claude/settings.json` (its text, or null when missing) no longer runs the push guard. */
export function guardWiringProblems(settingsText) {
  const missing = '.claude/settings.json no longer runs scripts/push-check-guard.mjs as a PreToolUse hook on Bash, so every git push and gh pr merge goes out unchecked';
  let settings;
  try {
    settings = JSON.parse(settingsText ?? '');
  } catch {
    return [missing];
  }
  const entries = Array.isArray(settings?.hooks?.PreToolUse) ? settings.hooks.PreToolUse : [];
  const wired = entries.some((entry) => {
    let matchesBash = false;
    try {
      matchesBash = new RegExp(`^(?:${entry?.matcher ?? ''})$`).test('Bash');
    } catch { /* an unreadable matcher matches nothing */ }
    return matchesBash && (entry.hooks ?? []).some((hook) => /push-check-guard\.mjs"?\s+hook\b/.test(hook?.command ?? ''));
  });
  return wired ? [] : [missing];
}

/** The gate.floors.json key that floors the release and provider proofs. */
export const PROOF_FLOOR_KEY = 'release/provider proofs';

/** The floors keys that name a workspace to run. */
export function workspaceKeys(floors) {
  return Object.keys(floors).filter((key) => key.startsWith('@'));
}

/** A run that counted fewer tests than its recorded floor. */
export function belowFloor(name, count, floor) {
  if (typeof floor !== 'number') return [`${name}: no floor recorded in scripts/gate.floors.json — run npm run gate:bless`];
  return count < floor ? [`${name}: ${count} tests ran, floor is ${floor}. A suite is missing, not merely failing.`] : [];
}
