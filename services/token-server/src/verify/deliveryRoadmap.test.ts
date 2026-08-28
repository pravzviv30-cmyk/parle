/**
 * The delivery roadmap's Phase 5 exit criterion, read against the code it describes.
 *
 * The criterion used to say "three modes". No triad of modes exists anywhere in this
 * repo: `apps/mobile/src/tutor/choosingView.ts` declares four session modes, and four
 * different readings of "three" each produced a different scope. A ledger entry cannot
 * be closed against a sentence like that, because nobody can say what closing it means.
 *
 * The founder's decision was to read the criterion as the four session modes, which makes
 * mode parity the testable property rather than a count somebody has to interpret. This
 * file is what keeps that decision true.
 *
 * The rule is deliberately not "the document says four". Pinning the number is the same
 * mistake `evidenceContract.test.ts` records at its own head: a test that pins a state
 * turns an honest correction red. So the number, the names and the count word all come
 * from the `LiveMode` union in source, and the document is judged against them. Add a
 * fifth mode to the code and this goes red with a message naming it, which is a document
 * to fix and not a test to edit.
 *
 * Two conventions the rule depends on, both stated here rather than inferred:
 *
 *   - Mode names appear in the criterion in backticks. That is what lets a name be told
 *     apart from prose, and it is why a bare `lesson-video` is refused as well.
 *   - The criterion carries the rest of Phase 5's scope in plain words. Correction
 *     policy, recovery, safety and curation may not quietly leave the sentence, because
 *     the cheapest way to pass an exit criterion is to shorten it.
 */

import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const ROADMAP_PATH = path.join(ROOT, 'docs', 'DELIVERY_ROADMAP.md');
const CHOOSING_VIEW_PATH = path.join(ROOT, 'apps', 'mobile', 'src', 'tutor', 'choosingView.ts');
const MOBILE_SRC = path.join(ROOT, 'apps', 'mobile', 'src');

const roadmap = readFileSync(ROADMAP_PATH, 'utf8');
const choosingView = readFileSync(CHOOSING_VIEW_PATH, 'utf8');

/**
 * Prose is checked against this, not the raw text. Markdown wraps a sentence wherever the
 * column runs out, so an assertion on a phrase is really an assertion about where
 * somebody's editor broke the line unless the whitespace is flattened first.
 */
const roadmapFlat = roadmap.replace(/\s+/g, ' ');

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** The `LiveMode` union, read out of the source that declares it. */
function liveModes(source: string): string[] {
  const declaration = /export type LiveMode\s*=([^;]*);/.exec(source);
  assert.ok(declaration, 'choosingView.ts no longer declares `export type LiveMode`, so the roadmap cannot be checked');
  const modes = [...declaration[1]!.matchAll(/'([^']+)'/g)].map((match) => match[1]!);
  assert.ok(modes.length > 0, 'the LiveMode union parsed to no members at all');
  return modes;
}

interface PhaseRow {
  phase: string;
  owner: string;
  criteria: string;
  status: string;
}

/** The phase table at the top of the roadmap, one row per numbered phase. */
function phaseRows(markdown: string): PhaseRow[] {
  const rows: PhaseRow[] = [];
  for (const line of markdown.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    const cells = trimmed.slice(1, trimmed.endsWith('|') ? -1 : undefined).split('|').map((cell) => cell.trim());
    if (cells.length < 4) continue;
    // A phase row starts "5. Tutor". The header row and its rule do not, so neither
    // needs to be recognised by its text.
    if (!/^\d+\.\s/.test(cells[0] ?? '')) continue;
    rows.push({ phase: cells[0]!, owner: cells[1]!, criteria: cells[2]!, status: cells[3]! });
  }
  return rows;
}

/** The exit criteria cell for one numbered phase. */
function criteriaFor(markdown: string, phase: number): string {
  const row = phaseRows(markdown).find((candidate) => candidate.phase.startsWith(`${phase}.`));
  assert.ok(row, `the roadmap has no row for phase ${phase}`);
  return row.criteria;
}

/**
 * Every reason this criterion is not the property the code holds.
 *
 * Returned as a list rather than asserted inline so the rule can be run against inputs
 * this file controls, which is the only way to prove that a green result on the real
 * document was earned rather than vacuous.
 */
function modeParityProblems(criteria: string, modes: readonly string[]): string[] {
  const problems: string[] = [];
  const counted = NUMBER_WORDS[modes.length] ?? String(modes.length);
  const sentence = `mode parity across the ${counted} session modes`;

  if (!criteria.toLowerCase().includes(sentence)) {
    problems.push(`the criterion does not read "${sentence}": ${criteria}`);
  }

  const named = [...criteria.matchAll(/`([^`]+)`/g)].map((match) => match[1]!);
  for (const name of named) {
    if (!modes.includes(name)) {
      problems.push(`the criterion names \`${name}\`, which is not a member of the LiveMode union`);
    }
  }
  for (const mode of modes) {
    if (!named.includes(mode)) {
      problems.push(`LiveMode has \`${mode}\` and the criterion never names it`);
    }
  }

  // A mode named outside backticks reads as prose and escapes the check above, so the
  // shape is refused directly. The prefixes come from the union, so this knows nothing
  // about the modes that happen to exist today.
  const prefixes = [...new Set(modes.map((mode) => mode.split('-')[0]!))];
  const shaped = new RegExp(`\\b(?:${prefixes.join('|')})-[a-z]+\\b`, 'g');
  const outsideBackticks = criteria.replace(/`[^`]*`/g, ' ');
  for (const match of outsideBackticks.matchAll(shaped)) {
    problems.push(`the criterion names ${match[0]} outside backticks, where a name cannot be told from prose`);
  }
  for (const mode of modes) {
    if (new RegExp(`\\b${mode}\\b`).test(outsideBackticks)) {
      problems.push(`the criterion names ${mode} outside backticks, where a name cannot be told from prose`);
    }
  }

  return problems;
}

/** A minimal phase table the rule can be run against. */
function fixtureRoadmap(criteria: string): string {
  return [
    '| Phase | Owner | Exit criteria | Current status |',
    '|---|---|---|---|',
    `| 5. Tutor | tutor behaviour | ${criteria} | six P0s landed |`,
    '',
  ].join('\n');
}

/** Every `*.test.ts` and `*.test.tsx` under a directory, read into one string. */
function testSources(dir: string): string {
  let joined = '';
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) joined += testSources(full);
    else if (/\.test\.tsx?$/.test(entry.name)) joined += readFileSync(full, 'utf8');
  }
  return joined;
}

describe('the delivery roadmap names the property Phase 5 actually holds', () => {
  test('the roadmap reads mode parity across the four session modes', () => {
    const modes = liveModes(choosingView);
    const criteria = criteriaFor(roadmap, 5);

    // 1. The document as it stands. Every mode the code has is named, every name it gives
    //    is a mode the code has, and the count word matches the union it describes.
    assert.deepEqual(
      modeParityProblems(criteria, modes),
      [],
      'the Phase 5 exit criterion does not describe the session modes the code ships',
    );

    // 2. The rest of the phase is still in the sentence. Shortening an exit criterion is
    //    the cheapest way to meet one, so the other four halves of Phase 5 are held here.
    for (const scope of ['correction policy', 'recovery', 'safety', 'curation']) {
      assert.ok(
        criteria.toLowerCase().includes(scope),
        `the Phase 5 exit criterion no longer names ${scope}, so the phase quietly got smaller`,
      );
    }

    // 3. The count is a property of the code, not a number somebody typed. If a fifth mode
    //    is added, this is the line that says the roadmap went stale rather than the line
    //    that has to be edited to allow it.
    const counted = NUMBER_WORDS[modes.length] ?? String(modes.length);
    assert.ok(
      roadmapFlat.includes(`mode parity across the ${counted} session modes`),
      `LiveMode has ${modes.length} members and no sentence in the roadmap says so`,
    );

    // 4. And the guarantee the roadmap leans on is real. `Record<LiveMode, …>` is what
    //    makes a fifth mode fail to compile until it declares its capabilities; a partial
    //    record would let the next mode inherit whatever the fall-through gave it, which
    //    is exactly how `lesson-text` came to publish a microphone.
    assert.match(
      choosingView,
      /export const MODE_CAPS:\s*Record<LiveMode,/,
      'MODE_CAPS is no longer a total Record over LiveMode, so the roadmap claims a guarantee the code dropped',
    );
    assert.match(
      roadmapFlat,
      /`MODE_CAPS` is a `Record<LiveMode,[^`]*`/,
      'the roadmap no longer says what makes mode parity hold',
    );

    // 5. The test the roadmap cites has to exist. A criterion whose evidence is a test
    //    name is only as good as the name still being a test.
    const cited = /the test `([^`]+)`/.exec(roadmapFlat);
    assert.ok(cited, 'the Phase 5 section names no test as the evidence for mode parity');
    assert.ok(
      testSources(MOBILE_SRC).includes(cited[1]!),
      `the roadmap cites the test "${cited[1]}", which no test under apps/mobile/src declares`,
    );

    // ── the refutations ────────────────────────────────────────────────────────────────
    // Each one is a document somebody could plausibly write, and each has to be refused.

    // 6. The wording this entry replaced. "Three modes" names no triad in the code.
    const three = modeParityProblems('Three modes, correction policy, recovery, safety, durable curation', modes);
    assert.ok(
      three.some((problem) => problem.startsWith('the criterion does not read')),
      '"Three modes" was accepted as a statement of mode parity',
    );
    assert.equal(
      three.filter((problem) => /never names it/.test(problem)).length,
      modes.length,
      '"Three modes" was accepted while naming none of the modes',
    );

    // 7. A fifth mode the code does not have, named in backticks and counted honestly.
    //    The count word is right and the document is still wrong.
    const invented = `Mode parity across the ${NUMBER_WORDS[modes.length + 1]} session modes (${[...modes, 'lesson-video'].map((mode) => `\`${mode}\``).join(', ')}), correction policy`;
    const fifth = modeParityProblems(invented, modes);
    assert.ok(
      fifth.some((problem) => problem.includes('`lesson-video`, which is not a member')),
      'the criterion was allowed to name a mode the LiveMode union does not have',
    );

    // 8. The same invented mode written as prose, which is how it would really be added.
    const bare = modeParityProblems(
      `Mode parity across the ${counted} session modes (${modes.map((mode) => `\`${mode}\``).join(', ')}) and lesson-video, correction policy`,
      modes,
    );
    assert.ok(
      bare.some((problem) => problem.includes('lesson-video outside backticks')),
      'a mode name written as prose escaped the check',
    );

    // 9. A mode dropped. This is the quiet one: the sentence still reads well, the count
    //    is still a word, and one whole session shape has stopped being in scope.
    const dropped = modeParityProblems(
      `Mode parity across the ${counted} session modes (${modes.slice(1).map((mode) => `\`${mode}\``).join(', ')}), correction policy`,
      modes,
    );
    assert.ok(
      dropped.some((problem) => problem === `LiveMode has \`${modes[0]}\` and the criterion never names it`),
      `dropping ${modes[0]} from the criterion was accepted`,
    );

    // 10. And the rule run through the real parser, not only on strings, so a table shape
    //     this file cannot read could never be the reason it passes.
    assert.deepEqual(modeParityProblems(criteriaFor(fixtureRoadmap(criteria), 5), modes), []);
    assert.ok(modeParityProblems(criteriaFor(fixtureRoadmap('Three modes, safety'), 5), modes).length > 0);
  });
});

/**
 * What the Phase 5 row is allowed to claim, judged against the ledger.
 *
 * The rule is deliberately not "the row says complete". Pinning a state is the
 * mistake this file's own head warns about: it turns an honest correction red.
 * Instead the ledger is the authority. Count what Phase 5 filed and what is
 * still open at P0 or P1, and the row may claim the properties are held only
 * while that count is zero. Reopen an entry and this goes red with a message
 * naming it, which is a document to fix rather than a test to edit.
 *
 * The second half is the one that matters more. Six checks have never been run
 * by anybody, and every phase before this one has been tempted to let a green
 * gate stand in for them. A roadmap that says "complete" without saying "and
 * nobody has seen this on a device" is the overclaim the whole ledger exists to
 * stop, so the row has to carry the limit in the same breath as the claim.
 */
const KNOWN_ISSUES_PATH = path.join(ROOT, 'docs', 'KNOWN_ISSUES.md');

/** Every Phase 5 entry, with its severity and whether it is closed. */
function phaseFiveEntries(ledger: string): { id: string; severity: string; closed: boolean }[] {
  const out: { id: string; severity: string; closed: boolean }[] = [];
  for (const block of ledger.split(/\n(?=### )/)) {
    const id = /^### (F1(?:3[2-9]|[4-9][0-9])) — /.exec(block)?.[1];
    if (id === undefined) continue;
    out.push({
      id,
      severity: /^- severity: (P[012])/m.exec(block)?.[1] ?? 'P2',
      closed: /^- status: \[x\]/m.test(block),
    });
  }
  return out;
}

describe('the roadmap row records what Phase 5 proved', () => {
  test('the roadmap row records what phase five proved and what stays external', () => {
    const ledger = readFileSync(KNOWN_ISSUES_PATH, 'utf8');
    const entries = phaseFiveEntries(ledger);
    assert.ok(entries.length >= 30, `only ${entries.length} Phase 5 entries found, so the ledger cannot be the authority here`);

    const row = phaseRows(roadmap).find((candidate) => candidate.phase.startsWith('5.'));
    assert.ok(row, 'the roadmap has no row for phase 5');
    const status = row.status.replace(/\s+/g, ' ').trim();
    assert.ok(status.length > 0, 'the Phase 5 row has no status cell to read');

    // 1. The claim tracks the ledger, in both directions. F203 is excluded from
    //    its own evidence: it is the entry that writes this row, so it is open
    //    for as long as the row is being written and closed the moment it is
    //    right. Counting it would make the rule unsatisfiable.
    const blocking = entries.filter((e) => !e.closed && e.severity !== 'P2' && e.id !== 'F203');
    const claimsHeld = /held locally|all five properties/i.test(status);
    if (blocking.length > 0) {
      assert.ok(
        !claimsHeld,
        `the row says Phase 5 is held while ${blocking.map((e) => `${e.id} (${e.severity})`).join(', ')} ${blocking.length === 1 ? 'is' : 'are'} still open`,
      );
    } else {
      assert.ok(claimsHeld, 'every Phase 5 P0 and P1 is closed and the row does not say the properties are held');
    }

    // 2. Open P2s are not hidden. A row that mentions none while some exist is
    //    a row somebody reads as finished.
    const restP2 = entries.filter((e) => !e.closed && e.severity === 'P2' && e.id !== 'F203');
    if (restP2.length > 0) {
      assert.match(status, /P2/, `${restP2.length} Phase 5 P2s are open and the status cell does not admit any`);
    }

    // 3. The external checks are named as nobody's, in the row itself, not only
    //    in a section further down that a table reader never reaches.
    assert.match(status, /external/i, 'the status cell does not mention the external checks at all');
    assert.match(status, /unclaimed|not (?:been )?run|pending/i, 'the row mentions the external checks without saying nobody has run them');
    assert.doesNotMatch(status, /\brelease\b(?!\s*$)|shipped|ready to ship/i, 'the row reads as a release, and no part of Phase 5 has been seen on a device');
  });
});
