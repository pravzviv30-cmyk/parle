/**
 * The CI contract.
 *
 * Three things here can be lost silently, and all of them are the kind of loss nobody
 * notices for months.
 *
 * The first is a workflow step. `.github/workflows/ci.yml` is a file people edit while
 * chasing a red build, and deleting the step that is red is the most tempting fix there
 * is. So the three steps are named here, and each one is checked to be a real npm script
 * that points at a file that exists — a step renamed to something that silently does
 * nothing fails this, and so does a script that survives while the file it runs is moved.
 *
 * The second is a dependency decision. `npm audit` reports advisories against packages
 * nobody in this repo chose; the interesting question is never "is there an advisory" but
 * "is that code path reached, and if it is not, who decided that and on what evidence".
 * Those decisions live in package.json under `luvani.dependencyAudit`, and the tests below
 * hold them against package-lock.json: every decision names a version the lockfile
 * actually carries, and the chain that was judged fixable is walked, edge by edge, to
 * prove no vulnerable package is still on it.
 *
 * The third is the strength of a guard that reads git, which is not decided in that
 * guard's own source but in one line of this workflow. It has its own comment below.
 *
 * Written as a source walk rather than as a mock, in the mould of
 * `serverSecurityContract.test.ts` and `databaseContract.test.ts`: the thing being
 * defended is a file, so a file is what gets read. That is also the honest limit of the
 * last test: it can hold what CI *asks* for, never what a runner handed over.
 */

import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'ci.yml');

const workflow = readFileSync(WORKFLOW_PATH, 'utf8');
const manifest = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>;
  luvani?: { dependencyAudit?: { advisories?: AdvisoryDecision[] } };
};
const lock = JSON.parse(readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8')) as Lockfile;

interface AdvisoryDecision {
  module: string;
  severity: string;
  decision: string;
  lockedAt: string;
  advisories?: string[];
  chain?: string;
  reachability?: string;
  why?: string;
  resolution?: string;
}

interface LockEntry {
  version?: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

interface Lockfile {
  packages: Record<string, LockEntry>;
}

const decisions = manifest.luvani?.dependencyAudit?.advisories ?? [];
const accepted = decisions.filter((d) => d.decision === 'accepted');
const fixed = decisions.filter((d) => d.decision === 'fixed');

/**
 * The lines of the workflow that actually execute something. YAML is parsed by hand
 * rather than by a dependency: three `run:` lines do not justify a package, and a regex
 * that misses a step fails this test loudly rather than passing it quietly.
 */
function workflowRunSteps(): { name: string; run: string }[] {
  const steps: { name: string; run: string }[] = [];
  const lines = workflow.split('\n');
  let pendingName: string | null = null;
  for (const line of lines) {
    const named = line.match(/^\s*-?\s*name:\s*(.+?)\s*$/);
    if (named) {
      pendingName = named[1] ?? null;
      continue;
    }
    const ran = line.match(/^\s*run:\s*(.+?)\s*$/);
    if (ran) steps.push({ name: pendingName ?? '(unnamed)', run: ran[1] ?? '' });
  }
  return steps;
}

/**
 * The same file again, cut into steps rather than into commands. `workflowRunSteps` above
 * throws the `uses:` steps away because it only cares what got executed; the checkout step
 * runs nothing and configures everything, so it needs the whole block it lives in — a
 * `with:` key is only meaningful attached to the step above it.
 *
 * Chunked on the leading `- ` after `steps:` for the same reason the parse above is
 * hand-rolled: one file's worth of YAML does not justify a dependency, and a chunker that
 * loses a step fails an assertion loudly rather than quietly finding nothing to check.
 */
function workflowSteps(): { title: string; body: string }[] {
  const lines = workflow.split('\n');
  const stepsAt = lines.findIndex((l) => /^\s*steps:\s*$/.test(l));
  if (stepsAt === -1) return [];
  const blocks: string[][] = [];
  for (const line of lines.slice(stepsAt + 1)) {
    if (/^\s*-\s+\S/.test(line)) blocks.push([line]);
    else if (blocks.length > 0) (blocks[blocks.length - 1] as string[]).push(line);
  }
  return blocks.map((block) => {
    const body = block.join('\n');
    const named = body.match(/name:\s*(.+?)\s*$/m);
    return { title: named?.[1] ?? '(unnamed step)', body };
  });
}

/** Node's own resolution order, read off the lockfile: nested first, then up to the root. */
function* resolutionScopes(fromKey: string): Generator<string> {
  let current = fromKey;
  while (current) {
    yield current;
    const boundary = current.lastIndexOf('/node_modules/');
    if (boundary === -1) break;
    current = current.slice(0, boundary);
  }
  yield '';
}

function resolveFrom(fromKey: string, name: string): string | null {
  for (const scope of resolutionScopes(fromKey)) {
    const candidate = scope ? `${scope}/node_modules/${name}` : `node_modules/${name}`;
    if (lock.packages[candidate]) return candidate;
  }
  return null;
}

/** Every package reachable from one lockfile entry by following real dependency edges. */
function dependencyClosure(rootKey: string): Map<string, { key: string; version: string }> {
  const seen = new Map<string, { key: string; version: string }>();
  const queue = [rootKey];
  while (queue.length > 0) {
    const key = queue.shift() as string;
    const entry = lock.packages[key];
    if (!entry) continue;
    const edges = { ...(entry.dependencies ?? {}), ...(entry.optionalDependencies ?? {}) };
    for (const name of Object.keys(edges)) {
      const resolved = resolveFrom(key, name);
      if (!resolved || seen.has(resolved)) continue;
      seen.set(resolved, { key: resolved, version: lock.packages[resolved]?.version ?? '' });
      queue.push(resolved);
    }
  }
  return seen;
}

/** Enough of semver to compare two release versions. No range syntax, on purpose. */
function atLeast(version: string, floor: string): boolean {
  const parse = (v: string) => (v.split('-')[0] ?? '').split('.').map((n) => Number(n) || 0);
  const [a, b] = [parse(version), parse(floor)];
  for (let i = 0; i < 3; i += 1) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return true;
}

describe('the ci contract', () => {
  test('both XML parser release lines stay above their security patch floors', () => {
    const parsers = Object.entries(lock.packages).filter(([key]) => key.endsWith('node_modules/@xmldom/xmldom'));
    assert.ok(parsers.length >= 2, 'both Expo and plist XML parser chains must be checked');
    for (const [key, entry] of parsers) {
      const version = entry.version ?? '0.0.0';
      const floor = version.startsWith('0.8.') ? '0.8.15' : '0.9.12';
      assert.ok(atLeast(version, floor), `${key} carries vulnerable XML parser ${version}; requires ${floor}`);
    }
  });

  test('every Sharp copy is patched and retains its cross-platform native assets', () => {
    const copies = Object.entries(lock.packages).filter(([key]) => key.endsWith('node_modules/sharp'));
    assert.ok(copies.length > 0, 'the live tutor image-processing dependency must be checked');
    for (const [key, entry] of copies) {
      assert.ok(atLeast(entry.version ?? '0.0.0', '0.35.4'), `${key} must not restore vulnerable Sharp`);
      const binaries = Object.entries(entry.optionalDependencies ?? {});
      assert.ok(binaries.some(([name]) => name === '@img/sharp-linux-x64'), 'Linux CI binary is declared');
      assert.ok(binaries.some(([name]) => name === '@img/sharp-darwin-arm64'), 'Apple Silicon binary is declared');
      for (const [name, version] of binaries) {
        const resolved = resolveFrom(key, name);
        assert.ok(resolved, `${key} is missing its ${name} optional binary from the lockfile`);
        assert.equal(lock.packages[resolved]?.version, version, `${name} matches its Sharp release`);
      }
    }
  });

  test('the tutor SDK and plugins are aligned on the upstream Sharp security fix', () => {
    const tutor = lock.packages['services/tutor-agent'];
    assert.ok(tutor?.dependencies, 'the tutor workspace is present');
    const sdk = Object.entries(tutor.dependencies).filter(([name]) => name.startsWith('@livekit/agents'));
    assert.equal(sdk.length, 7, 'the agent and all six provider plugins are checked');
    for (const [name, version] of sdk) {
      assert.equal(version, '1.9.0', `${name} remains deliberately pinned to the tested SDK release`);
      const resolved = resolveFrom('services/tutor-agent', name);
      assert.ok(resolved, `${name} resolves from the tutor workspace`);
      assert.equal(lock.packages[resolved]?.version, version);
    }
  });

  test('ci runs the gate, the dependency audit and the secret scan on every push', () => {
    assert.ok(existsSync(WORKFLOW_PATH), '.github/workflows/ci.yml does not exist');

    // On every push, not only on main and not only on a pull request. The reason the
    // workflow exists is a push from a machine whose hooks were never installed.
    const triggers = workflow.split('\n');
    const onIndex = triggers.findIndex((l) => /^on:\s*$/.test(l));
    assert.ok(onIndex !== -1, 'the workflow has no `on:` block, so it never runs');
    const triggerBlock = triggers.slice(onIndex + 1, onIndex + 6).join('\n');
    assert.match(triggerBlock, /^\s{2}push:/m, 'the workflow does not run on push');

    const steps = workflowRunSteps();
    const commands = steps.map((s) => s.run);

    const required: { what: string; script: string }[] = [
      { what: 'the gate', script: 'gate' },
      { what: 'the dependency audit', script: 'audit:ci' },
      { what: 'the secret scan', script: 'scan:secrets' },
    ];

    for (const { what, script } of required) {
      const step = commands.find((c) => c === `npm run ${script}`);
      assert.ok(step, `no CI step runs \`npm run ${script}\` — ${what} is not being run`);
      assert.ok(
        typeof manifest.scripts[script] === 'string',
        `the workflow runs \`npm run ${script}\` but package.json has no such script`,
      );
    }

    // A step that runs a script that runs a file which has moved is a step that passes by
    // doing nothing. Resolve each entry point to a real path.
    for (const script of ['audit:ci', 'scan:secrets']) {
      const command = manifest.scripts[script] as string;
      const target = command.split(/\s+/).find((token) => /\.(mjs|ts)$/.test(token));
      assert.ok(target, `the ${script} script runs no file: ${command}`);
      assert.ok(existsSync(path.join(ROOT, target)), `${script} points at ${target}, which does not exist`);
    }

    // The install has to be the lockfile as written, or the dependency decisions below are
    // being tested against a tree CI never builds.
    assert.ok(
      commands.some((c) => c.startsWith('npm ci')),
      'CI must install with `npm ci`, so the lockfile it tests is the lockfile that is committed',
    );

    // Nothing here needs a credential. Every suite was measured with no .env loaded and
    // produced identical counts, so a secret in this workflow would be a second place to
    // leak one and no place to use it.
    assert.ok(
      !/secrets\./.test(workflow),
      'the CI workflow references a repository secret; it was designed to need none',
    );
    assert.match(
      workflow,
      /permissions:\s*\n\s*contents:\s*read/,
      'the workflow does not restrict its GitHub token to contents: read',
    );
  });

  test('the lockfile carries no vulnerable version on a chain that was judged fixable', () => {
    assert.ok(
      fixed.length > 0,
      'no advisory is recorded as fixed, so this test would pass by proving nothing. ' +
        'If nothing was fixable, say so in package.json rather than leaving the list empty.',
    );

    const stillVulnerable = new Set(accepted.map((d) => d.module));

    for (const record of fixed) {
      const key = `node_modules/${record.module}`;
      const entry = lock.packages[key];
      assert.ok(entry, `${record.module} is recorded as fixed but the lockfile does not carry it`);
      assert.ok(
        atLeast(entry.version ?? '0.0.0', record.lockedAt),
        `${record.module} was fixed at ${record.lockedAt} but the lockfile now carries ${entry.version}`,
      );

      const closure = dependencyClosure(key);
      assert.ok(
        closure.size >= 10,
        `the dependency walk from ${record.module} reached only ${closure.size} packages, ` +
          'which means the walk is broken rather than the chain being clean',
      );

      for (const [resolvedKey, resolved] of closure) {
        const name = resolvedKey.slice(resolvedKey.lastIndexOf('node_modules/') + 'node_modules/'.length);
        assert.ok(
          !stillVulnerable.has(name),
          `${record.module} was judged fixable, but ${name}@${resolved.version} is still on its chain at ` +
            `${resolvedKey}. Either the fix regressed or the acceptance for ${name} is wrong.`,
        );
      }
    }

    // The concrete thing the fix bought, named so a future reader can check it by hand:
    // the Expo bundler chain runs metro 0.84.5, which dropped image-size altogether.
    const expoMetro = dependencyClosure('node_modules/@expo/metro');
    const metro = [...expoMetro.entries()].find(([key]) => key.endsWith('node_modules/metro'));
    assert.ok(metro, 'the @expo/metro chain no longer reaches metro at all, which is not a fix');
    assert.ok(
      atLeast(metro[1].version, '0.84.5'),
      `the Expo bundler resolves metro ${metro[1].version}; 0.84.5 is the first release without image-size`,
    );
  });

  test('every advisory decision names a package the lockfile carries, an advisory and a reachability argument', () => {
    assert.ok(decisions.length > 0, 'package.json records no dependency-audit decisions at all');

    for (const record of decisions) {
      const where = `luvani.dependencyAudit for ${record.module}`;
      assert.ok(['moderate', 'high', 'critical'].includes(record.severity), `${where}: unknown severity`);
      assert.ok(['fixed', 'accepted'].includes(record.decision), `${where}: decision must be fixed or accepted`);

      const entry = lock.packages[`node_modules/${record.module}`];
      assert.ok(entry, `${where}: the lockfile does not carry this package, so the record is stale`);
      assert.equal(
        entry.version,
        record.lockedAt,
        `${where}: recorded at ${record.lockedAt} but the lockfile now carries ${entry.version}. ` +
          'An install moved it — re-read the reachability argument before updating this line.',
      );

      assert.ok(
        Array.isArray(record.advisories) && record.advisories.length > 0,
        `${where}: names no advisory`,
      );
      for (const url of record.advisories as string[]) {
        assert.match(url, /^https:\/\/github\.com\/advisories\/GHSA-/, `${where}: ${url} is not an advisory url`);
      }

      assert.ok((record.chain ?? '').includes('->'), `${where}: the chain does not name how the package is reached`);
      assert.ok(
        (record.reachability ?? '').length > 80,
        `${where}: no reachability argument. Say which code path reaches it, or say that none does and why.`,
      );
      if (record.decision === 'accepted') {
        assert.ok((record.why ?? '').length > 80, `${where}: accepted with no reason recorded`);
      } else {
        assert.ok((record.resolution ?? '').length > 80, `${where}: fixed with no account of what was done`);
      }
    }
  });

  test('the gate runs the secret scan among the checks that read files', () => {
    const gate = readFileSync(path.join(ROOT, 'scripts', 'gate.mjs'), 'utf8');

    // The banner lines, not the summary in the header comment.
    const banner = (n: number, label: string) => gate.search(new RegExp(`^// -+ ${n}\\. ${label}$`, 'm'));
    const start = banner(4, 'secrets');
    const end = banner(5, 'agents');
    assert.ok(start !== -1 && end > start, 'gate.mjs has no secrets section between hygiene and agents');
    const section = gate.slice(start, end);

    assert.match(section, /SECRET_SCANNER/, 'the secrets section does not invoke the scanner');
    assert.match(section, /fail\('secrets'/, 'the secrets section cannot fail the gate');

    // The point of putting it here rather than beside the suites: `--fast` is what the
    // pre-commit hook runs, and a leaked credential is the one mistake a later commit
    // cannot undo. Anything that made this conditional on `fast` would defeat that, so
    // the executable part of the section — comments stripped — must not mention it.
    const executable = section.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(
      !/\bfast\b/.test(executable),
      'the secret scan is conditional on fast mode, so the pre-commit hook would skip it',
    );

    // And the command itself has to work, not merely be spelled correctly.
    const scanner = path.join(ROOT, 'services', 'token-server', 'src', 'secretScan.ts');
    assert.ok(existsSync(scanner), 'gate.mjs points at a scanner that does not exist');
    const outcome = execFileSync(process.execPath, ['--experimental-strip-types', scanner], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    assert.match(outcome, /secret scan: clean/, 'the scanner the gate runs did not report a clean tree');
  });
  /**
   * The third thing that can be lost silently, and the quietest of the three: a guard that
   * still runs, still passes, and has stopped being able to see anything.
   *
   * `deliveryRoadmap.test.ts` asks git whether a claimed hash exists and whether a branch is
   * an ancestor of `main`, and it deliberately answers `unknown` rather than `no` in a
   * shallow clone, because in a truncated history "not here" is the normal state of almost
   * everything. That design is right. What it means, though, is that the guard's strength is
   * decided by a line in this YAML file rather than by anything in its own source.
   *
   * Measured on 2026-08-30 by rebuilding the four fetch shapes with plain git against this
   * repository, checking out `phase-7-revenue` each time and probing the revs the rule needs:
   *
   *   depth 1, one branch  — shallow, 1 commit. Only `eee755c` resolves. No main ref at all.
   *   depth 50, one branch — shallow, 86 commits. Older hashes resolve, but `is-shallow` is
   *                          still true and there is still no main ref, so the rule is still
   *                          entirely `unknown`. It costs 6.4M of 7.1M and buys nothing.
   *   depth 0             — not shallow, 131 commits, `refs/remotes/origin/main` and the
   *                          archive tags all resolve. The rule runs in full.
   *   depth 1 + a second shallow fetch of main — the main ref appears, but the clone is still
   *                          shallow, so every negative answer is still downgraded to unknown.
   *
   * Only the third shape turns the rule on, which is why this asserts `0` and not "more than
   * one". Two things are needed and both arrive together: the history, and the ref.
   */
  test('ci fetches enough history for the guards that read git', (t) => {
    const checkouts = workflowSteps().filter((s) => /uses:\s*actions\/checkout(?:@|\s|$)/.test(s.body));
    assert.ok(
      checkouts.length > 0,
      'no step in the workflow checks the repository out, so nothing below is being tested',
    );

    for (const step of checkouts) {
      const declared = step.body.match(/^\s*fetch-depth:\s*(\S+)\s*$/m);
      assert.ok(
        declared,
        `${step.title}: actions/checkout sets no fetch-depth, so it takes the default of 1. ` +
          'A depth-1 clone of this repository resolves the tip and nothing else, and the ' +
          'landing rule in deliveryRoadmap.test.ts answers `unknown` to every question it ' +
          'asks git — it passes by having checked nothing. F243 was a stale landing claim on ' +
          '`main` that reached the repository through exactly that hole.',
      );
      assert.equal(
        declared[1],
        '0',
        `${step.title}: fetch-depth is ${declared[1]}. Any positive depth still leaves ` +
          '`rev-parse --is-shallow-repository` true, and still fetches one branch rather than ' +
          'all of them, so the landing rule stays silent. Measured: depth 50 costs 6.4M of a ' +
          'full 7.1M and turns nothing on. Only 0 fetches every head and unshallows the clone.',
      );
    }

    // The line above is only worth defending while something still depends on it. If the
    // guard that reads git ever goes away, `fetch-depth: 0` becomes a cost with no reason,
    // and this is where a reader finds that out rather than paying it forever.
    const landingRule = readFileSync(
      path.join(ROOT, 'services', 'token-server', 'src', 'verify', 'deliveryRoadmap.test.ts'),
      'utf8',
    );
    assert.match(
      landingRule,
      /--is-shallow-repository/,
      'nothing in deliveryRoadmap.test.ts probes for a shallow clone any more, so either the ' +
        'landing rule stopped reading git — in which case fetch-depth: 0 is now an unpaid-for ' +
        'cost and should go — or it stopped noticing that it cannot, which is worse.',
    );

    // Said out loud on every green run, because this is a test about a file and not about a
    // machine. It reads YAML: it can hold what the workflow *asks* for, and it cannot hold
    // what a runner actually handed over. If GitHub ever changes what fetch-depth: 0 means,
    // or a self-hosted runner reuses a shallow work directory, this test stays green and the
    // guard goes quiet again. The only thing that would catch that is the diagnostic
    // deliveryRoadmap.test.ts already prints from the runner itself.
    t.diagnostic(
      'this asserts the workflow asks for full history; it cannot prove a runner delivered it. ' +
        'The proof of delivery is the `git.limits` diagnostic printed by the landing rule in CI.',
    );
  });

});
