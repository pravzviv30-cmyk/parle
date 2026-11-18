#!/usr/bin/env node
/**
 * unslop-scan: a mechanical pass over the app's source for the signs in
 * `.claude/skills/unslop/references/signs.md` that a regex can see. It is a
 * ratchet, not a judge: today's counts live in `unslop-scan.baseline.json`, and
 * the scan fails only when a file's count for a rule rises above it, or a file
 * the baseline does not know has any hit. DESIGN.md decides what is slop; this
 * only stops new instances of the obvious ones from slipping in.
 *
 *   node scripts/unslop-scan.mjs                     scan everything
 *   node scripts/unslop-scan.mjs --diff origin/main...HEAD   scan only changed files
 *   node scripts/unslop-scan.mjs --update-baseline   write today's counts
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BASELINE = join(ROOT, 'scripts', 'unslop-scan.baseline.json');
export const SCAN_ROOTS = ['apps/mobile/src', 'packages/core/src'];

/** The sanctioned sky (Today's band, onboarding's soft sky window) is drawn in `art/sky/`. */
export const GRADIENT_ALLOW = ['apps/mobile/src/art/sky/'];
/** ExtraBold and Black are named once, in the theme's font table (DESIGN.md, Type). */
export const HEAVY_WEIGHT_ALLOW = ['apps/mobile/src/theme.ts'];
/** Looping animation is written only in the motion engine (DESIGN.md, Motion rule 5). */
export const REPEAT_ALLOW = ['apps/mobile/src/motion/drive.ts'];
/** The eyebrow type tokens are defined in the theme; a ratchet counts uses, not the definitions. */
export const EYEBROW_ALLOW = ['apps/mobile/src/theme.ts'];

/** Files the scan skips: tests, dev previews and art, where colours and curves are data. */
export function isScanned(rel) {
  if (!/\.tsx?$/.test(rel) || /\.test\.tsx?$/.test(rel) || /\.d\.ts$/.test(rel)) return false;
  if (!SCAN_ROOTS.some((r) => rel.startsWith(`${r}/`))) return false;
  return !/\/(dev|art)\//.test(rel);
}

/** Blanks comments with spaces, keeping newlines and string literals. */
export function stripComments(source) {
  let out = '';
  let quote = null;
  let comment = null; // '//' or '/*'
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    const two = source.slice(i, i + 2);
    if (comment) {
      if (comment === '/*' && two === '*/') (out += '  '), i++, (comment = null);
      else if (c === '\n') (out += c), (comment = comment === '//' ? null : comment);
      else out += ' ';
    } else if (quote) {
      out += c;
      if (c === '\\') out += source[++i] ?? '';
      else if (c === quote) quote = null;
    } else if (two === '//' || two === '/*') {
      comment = two;
      out += '  ';
      i++;
    } else {
      if (c === "'" || c === '"' || c === '`') quote = c;
      out += c;
    }
  }
  return out;
}

const allowed = (rel, list) => list.some((p) => rel === p || rel.startsWith(p));
const INK = /\b(ink|liftInk)\b|shadow\.lift|black|#000\b|#000000|rgba\(\s*0\s*,\s*0\s*,\s*0/i;
const HYPE = /\b(seamless(ly)?|supercharge[sd]?|unlock(s|ed)?|magic(al)?|AI-powered|effortless(ly)?|revolutionary)\b/i;
const EMOJI = /\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F/u;

/** Words a person reads: quoted strings and JSX text on the line. */
function literals(line) {
  const out = [];
  for (const m of line.matchAll(/'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"|`([^`]*)`/g)) out.push(m[1] ?? m[2] ?? m[3]);
  for (const m of line.matchAll(/>([^<>{}]+)</g)) out.push(m[1]);
  return out;
}

/** Every hit in one file's source, as { file, line, rule, snippet }. */
export function scanSource(rel, source) {
  const hits = [];
  const lines = stripComments(source).split('\n');
  const hit = (i, rule) => hits.push({ file: rel, line: i + 1, rule, snippet: lines[i].trim().slice(0, 120) });
  lines.forEach((line, i) => {
    const words = literals(line);
    if (words.some((w) => EMOJI.test(w))) hit(i, 'emoji');
    if (words.some((w) => /\s/.test(w) && HYPE.test(w))) hit(i, 'hype-word');
    if (/\b(Linear|Radial)Gradient\b|(linear|radial)-gradient|experimental_backgroundImage/.test(line) && !allowed(rel, GRADIENT_ALLOW)) hit(i, 'gradient');
    if (/\bborder\w*Radius\s*:\s*-?(?!0(?![.\d]))\d/.test(line)) hit(i, 'literal-radius');
    if (/\.eyebrow\w*|\beyebrow\s*[=:]/.test(line) && !allowed(rel, EYEBROW_ALLOW)) hit(i, 'eyebrow');
    if (/Outfit[-_](Black|ExtraBold|900Black|800ExtraBold)|\bfont\.(black|extraBold)\b/.test(line) && !allowed(rel, HEAVY_WEIGHT_ALLOW)) hit(i, 'heavy-weight');
    if (/\bwithRepeat\(/.test(line) && !allowed(rel, REPEAT_ALLOW)) hit(i, 'repeat-loop');
    const box = line.match(/boxShadow\s*:\s*(.*)$/);
    if (box) {
      const blur = box[1].match(/-?\d+(?:px)?\s+-?\d+(?:px)?\s+(\d+)(?:px)?/);
      if (blur && Number(blur[1]) >= 12 && !INK.test(box[1])) hit(i, 'glow-shadow');
    }
    const colour = line.match(/shadowColor\s*:\s*([^,}]+)/);
    if (colour && !INK.test(colour[1])) {
      const near = lines.slice(Math.max(0, i - 4), i + 5).join(' ').match(/shadowRadius\s*:\s*(\d+)/);
      if (near && Number(near[1]) >= 12) hit(i, 'glow-shadow');
    }
  });
  return hits;
}

/** { file: { rule: count } } from a list of hits. */
export function countHits(hits) {
  const counts = {};
  for (const h of hits) {
    counts[h.file] ??= {};
    counts[h.file][h.rule] = (counts[h.file][h.rule] ?? 0) + 1;
  }
  return counts;
}

/** The { file, rule, count, allowed } pairs whose count rose above the baseline. */
export function regressions(counts, baseline) {
  const out = [];
  for (const [file, rules] of Object.entries(counts)) {
    for (const [rule, count] of Object.entries(rules)) {
      const allowedCount = baseline[file]?.[rule] ?? 0;
      if (count > allowedCount) out.push({ file, rule, count, allowed: allowedCount });
    }
  }
  return out;
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function filesToScan(diffRange) {
  const rels = diffRange
    ? execFileSync('git', ['diff', '--name-only', '--diff-filter=d', diffRange], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
    : SCAN_ROOTS.flatMap((r) => walk(join(ROOT, r)).map((f) => relative(ROOT, f)));
  return rels.filter((rel) => isScanned(rel) && existsSync(join(ROOT, rel)));
}

function main(argv) {
  const at = argv.indexOf('--diff');
  const range = at === -1 ? null : argv[at + 1];
  if (at !== -1 && !range) {
    console.error('unslop-scan: --diff needs a git range, like origin/main...HEAD');
    return 2;
  }
  if (range && argv.includes('--update-baseline')) {
    console.error('unslop-scan: --update-baseline needs a full scan; drop --diff');
    return 2;
  }
  const hits = filesToScan(range).flatMap((rel) => scanSource(rel, readFileSync(join(ROOT, rel), 'utf8')));
  const counts = countHits(hits);
  if (argv.includes('--update-baseline')) {
    const sorted = Object.fromEntries(Object.keys(counts).sort().map((f) => [f, counts[f]]));
    writeFileSync(BASELINE, `${JSON.stringify(sorted, null, 2)}\n`);
    console.log(`unslop-scan: baseline written, ${hits.length} hits in ${Object.keys(sorted).length} files`);
    return 0;
  }
  const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
  const bad = regressions(counts, baseline);
  for (const r of bad) {
    console.log(`${r.file}: ${r.rule} ${r.count} (baseline ${r.allowed})`);
    for (const h of hits.filter((x) => x.file === r.file && x.rule === r.rule)) console.log(`  ${h.file}:${h.line} ${h.rule} ${h.snippet}`);
  }
  console.log(bad.length ? `unslop-scan: ${bad.length} rule counts above baseline` : `unslop-scan: clean against baseline (${hits.length} known hits)`);
  return bad.length ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = main(process.argv.slice(2));
