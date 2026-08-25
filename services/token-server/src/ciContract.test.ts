/**
 * The CI contract.
 *
 * Two things here can be lost silently, and both of them are the kind of loss nobody
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
 * Those decisions live in package.json under `parle.dependencyAudit`, and the tests below
 * hold them against package-lock.json: every decision names a version the lockfile
 * actually carries, and the chain that was judged fixable is walked, edge by edge, to
 * prove no vulnerable package is still on it.
 *
 * Written as a source walk rather than as a mock, in the mould of
 * `serverSecurityContract.test.ts` and `databaseContract.test.ts`: the thing being
 * defended is a file, so a file is what gets read.
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
  parle?: { dependencyAudit?: { advisories?: AdvisoryDecision[] } };
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

const decisions = manifest.parle?.dependencyAudit?.advisories ?? [];
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
      const where = `parle.dependencyAudit for ${record.module}`;
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
});
