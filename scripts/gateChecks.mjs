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
