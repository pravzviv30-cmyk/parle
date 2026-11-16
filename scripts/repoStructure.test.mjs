// The repository structure guard (F972 to F978). Every check reads `git ls-files`,
// so untracked files in a checkout never change the result.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Tracked paths, NUL-separated so non-ASCII names are not quoted. */
function git(...args) {
  return execFileSync('git', [...args, '-z'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\0')
    .filter(Boolean);
}
const tracked = git('ls-files');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const onDisk = (rel) => existsSync(join(ROOT, rel));

/** The text of a `## heading` section, up to the next `## ` heading. */
function section(text, heading) {
  const start = text.indexOf(`\n## ${heading}\n`);
  if (start < 0) return '';
  const end = text.indexOf('\n## ', start + 1);
  return text.slice(start, end < 0 ? undefined : end);
}
const codeSpans = (text) => [...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]);
const firstSegment = (p) => p.replace(/^\.\//, '').split('/')[0];

/** Every inline markdown link outside fenced code and inline code: [file, line, target]. */
function markdownLinks(rel) {
  const links = [];
  let fence = false;
  read(rel).split('\n').forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; return; }
    if (fence) return;
    const text = line.replace(/`[^`]*`/g, '');
    for (const m of text.matchAll(/\]\((?:<([^>]+)>|([^)\s]+))(?:\s+"[^"]*")?\)/g)) {
      links.push([rel, i + 1, m[1] ?? m[2]]);
    }
  });
  return links;
}
const isExternal = (target) => (/^[a-z][a-z0-9+.-]*:/i.test(target) && !/^file:/i.test(target)) || target.startsWith('#');
/** A link to a file on one machine: an absolute path or a file: URL. */
const isMachineAbsolute = (target) => target.startsWith('/') || /^file:/i.test(target);
const linkedDocs = tracked.filter((f) => f.endsWith('.md') && !f.startsWith('graphify-out/') && !f.includes('node_modules/') && onDisk(f));
const allLinks = linkedDocs.flatMap(markdownLinks).filter(([, , target]) => !isExternal(target));

test('every top-level tracked entry has a row in the AGENTS.md repository map', () => {
  const mapped = new Set(codeSpans(section(read('AGENTS.md'), 'Find the owner')).map(firstSegment));
  const missing = [...new Set(tracked.map(firstSegment))].filter((entry) => !mapped.has(entry));
  assert.deepEqual(missing, [], missing.map((e) => `add a row for \`${e}\` to AGENTS.md 'Find the owner'`).join('\n'));
});

test('AGENTS.md names where new evidence, boards and scratch output go', () => {
  const where = codeSpans(section(read('AGENTS.md'), 'Where new things go'));
  for (const place of ['artifacts/<slug>-<date>/', 'reviews/<date>-<slug>/', 'output/']) {
    assert.ok(where.includes(place), `name \`${place}\` in AGENTS.md 'Where new things go'`);
  }
});

test('every file and folder directly under docs is listed in docs/README.md', () => {
  const listed = new Set(markdownLinks('docs/README.md').map(([, , target]) => firstSegment(target)));
  const entries = [...new Set(tracked.filter((f) => f.startsWith('docs/')).map((f) => f.split('/')[1]))];
  const missing = entries.filter((entry) => entry !== 'README.md' && !listed.has(entry));
  assert.deepEqual(missing, [], missing.map((e) => `add a row for docs/${e} to the right group in docs/README.md`).join('\n'));
});

test('the artifacts naming rule in AGENTS.md matches the dated folders in artifacts', () => {
  const where = codeSpans(section(read('AGENTS.md'), 'Where new things go'));
  assert.ok(where.includes('artifacts/<slug>-<date>/'), "name `artifacts/<slug>-<date>/` in AGENTS.md 'Where new things go'");
  const folders = [...new Set(tracked.filter((f) => f.startsWith('artifacts/')).map((f) => f.split('/')[1]))];
  const dateFirst = folders.filter((name) => /^\d{4}-\d{2}/.test(name));
  assert.deepEqual(dateFirst, [], 'rename these to artifacts/<slug>-<date>/');
});

test('a file link to a machine path counts as an absolute machine path', () => {
  assert.equal(isMachineAbsolute('file:///Users/x/y.png'), true);
  assert.equal(isMachineAbsolute('FILE:///Users/x/y.png'), true);
  assert.equal(isMachineAbsolute('/Users/x/y.png'), true);
  for (const target of ['https://example.com/a', '../a.md', '#anchor']) assert.equal(isMachineAbsolute(target), false, target);
});

test('every relative markdown link in tracked docs resolves', () => {
  const broken = allLinks.filter(([rel, , target]) => {
    if (isMachineAbsolute(target)) return false; // the absolute-path test owns these
    let path = target.split('#')[0].split('?')[0];
    try { path = decodeURIComponent(path); } catch { /* keep it as written */ }
    return !onDisk(posix.join(posix.dirname(rel), path));
  });
  assert.deepEqual(broken.map(([rel, line, target]) => `${rel}:${line} ${target}`), [],
    'fix each link, or de-link it as code text, in the file and line named');
});

test('no tracked markdown link points at an absolute machine path', () => {
  const absolute = allLinks.filter(([, , target]) => isMachineAbsolute(target));
  assert.deepEqual(absolute.map(([rel, line, target]) => `${rel}:${line} ${target}`), [],
    'make each link relative to its file, or mark a local capture as code text, in the file and line named');
});

test('no tracked path sits under output', () => {
  const inOutput = tracked.filter((f) => f.startsWith('output/'));
  assert.deepEqual(inOutput, [], "output/ is ignored scratch: git mv these to artifacts/<slug>-<date>/ (AGENTS.md 'Where new things go')");
});

test('no tracked file matches .gitignore', () => {
  const ignored = git('ls-files', '--cached', '--ignored', '--exclude-per-directory=.gitignore');
  assert.deepEqual(ignored, [], 'git rm --cached these (the file stays on disk), or change the rule in .gitignore');
});

test('tracked source uses LF line endings and no tab indentation', () => {
  const source = /\.(ts|tsx|js|mjs|cjs|json|md|yml|yaml|sql|css|html|sh|swift|toml|py)$/;
  const problems = [];
  for (const rel of tracked) {
    if (!source.test(rel) || rel.startsWith('graphify-out/') || !onDisk(rel)) continue;
    const text = read(rel);
    if (text.includes('\r')) problems.push(`${rel}: convert to LF line endings (.editorconfig)`);
    const tab = text.split('\n').findIndex((line) => line.startsWith('\t'));
    if (tab >= 0) problems.push(`${rel}:${tab + 1}: indent with spaces, not tabs (.editorconfig)`);
  }
  assert.deepEqual(problems, []);
});
