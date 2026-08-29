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

/**
 * What the Phase 5 narrative is allowed to claim, judged against the same ledger.
 *
 * The row above is one table cell. The section below the table is where a reader actually
 * finds out where the phase stands, and it is the half that rots first: a slice-1 paragraph
 * survived the slice-2 landing and went on saying "34 of them are still open, 23 at P1"
 * three paragraphs after the same section said every P0 and every P1 was closed. Both
 * sentences were in one document, and the wrong one was the one a reader reached last.
 *
 * The rule is the same shape as the row's: the ledger is the authority and the prose is
 * judged against it, in both directions. A count of open P0 or P1 work has to be the count
 * the ledger holds, and a claim that the phase closed all of it is refused while any of it
 * is open. Neither direction is pinned, so correcting the ledger is never what turns this
 * red — only a document that stopped agreeing with it.
 *
 * One limit, stated rather than hidden: `phaseFiveEntries` reads F132 to F199, so entries
 * this phase filed at F200 and above are outside its view. That is why the counted rule is
 * scoped to P0 and P1, where the range is complete, and why rule 3 below is an internal
 * consistency check that needs no ledger at all.
 */

/** The `## Phase 5` narrative section, whitespace-flattened. */
function phaseFiveNarrative(markdown: string): string {
  const start = markdown.search(/^## Phase 5\b/m);
  assert.notEqual(start, -1, 'the roadmap has no Phase 5 narrative section, so there is nothing to judge');
  const rest = markdown.slice(start);
  const end = rest.indexOf('\n## ', 1);
  return (end === -1 ? rest : rest.slice(0, end)).replace(/\s+/g, ' ');
}

/** A claim that the phase closed every blocking entry it filed. */
const CLAIMS_ALL_CLOSED = /every P0 and (?:every )?P1\b[^.]*?\bclosed\b/i;

/**
 * Every reason this narrative disagrees with the ledger it summarises.
 *
 * A list rather than inline assertions, for the reason the head of this file gives: a rule
 * that can only be run against the one document on disk cannot prove its own green result
 * was earned.
 */
function narrativeProblems(
  narrative: string,
  entries: readonly { id: string; severity: string; closed: boolean }[],
): string[] {
  const problems: string[] = [];
  const claimsAllClosed = CLAIMS_ALL_CLOSED.test(narrative);
  const counted = [...narrative.matchAll(/(\d+)\s+at\s+(P[01])\b/g)];

  // 1. A counted claim of open work at P0 or P1 is a claim about the ledger, so it has to
  //    be the number the ledger holds. This is the sentence F211 was filed for.
  for (const claim of counted) {
    const severity = claim[2]!;
    const open = entries.filter((entry) => !entry.closed && entry.severity === severity);
    if (Number(claim[1]) !== open.length) {
      problems.push(
        `the narrative says "${claim[0]}" while the ledger has ${open.length} open at ${severity}` +
          `${open.length > 0 ? ` (${open.map((entry) => entry.id).join(', ')})` : ''}`,
      );
    }
  }

  // 2. And the other direction. Claiming the phase closed all of it while any of it is open
  //    is the overclaim, and it is the one that reads as finished.
  const blocking = entries.filter((entry) => !entry.closed && entry.severity !== 'P2');
  if (claimsAllClosed && blocking.length > 0) {
    problems.push(
      `the narrative says every P0 and P1 is closed while ${blocking.map((entry) => `${entry.id} (${entry.severity})`).join(', ')} ` +
        `${blocking.length === 1 ? 'is' : 'are'} still open`,
    );
  }

  // 3. The self-contradiction, which needs no ledger. One section may not both count open
  //    P1 work and say there is none. Whichever half is wrong, a reader cannot tell which.
  if (claimsAllClosed) {
    for (const claim of counted) {
      if (Number(claim[1]) > 0) {
        problems.push(
          `the narrative says every P0 and P1 is closed and also says "${claim[0]}", and both cannot be true`,
        );
      }
    }
  }

  return problems;
}

/** A minimal Phase 5 section the rule can be run against, read by the real parser. */
function fixtureNarrative(body: string): string {
  return ['## Phase 5: what the exit criterion means, and where it stands', '', body, ''].join('\n');
}

describe('the Phase 5 narrative agrees with the ledger', () => {
  test('the phase five narrative agrees with the ledger it summarises', () => {
    const ledger = readFileSync(KNOWN_ISSUES_PATH, 'utf8');
    const entries = phaseFiveEntries(ledger);
    assert.ok(
      entries.length >= 30,
      `only ${entries.length} Phase 5 entries found, so the ledger cannot be the authority here`,
    );

    // 1. The document as it stands.
    const narrative = phaseFiveNarrative(roadmap);
    assert.ok(narrative.length > 400, 'the Phase 5 section is too short to be saying anything');
    assert.deepEqual(
      narrativeProblems(narrative, entries),
      [],
      'the Phase 5 narrative does not agree with the ledger it summarises',
    );

    // ── the refutations ────────────────────────────────────────────────────────────────

    // 2. The sentence F211 was filed for, run through the real parser rather than as a
    //    bare string, so a section shape this file cannot read could never be why it passes.
    const stale = fixtureNarrative(
      'Phase 5 is held locally. Every P0 and every P1 in the range this phase filed is closed ' +
        'against a named test that passes. A survey of the phase found 40 gaps and 34 of them ' +
        'are still open, 23 at P1 and 11 at P2, across correction policy and much of safety.',
    );
    const staleProblems = narrativeProblems(phaseFiveNarrative(stale), entries);
    assert.ok(
      staleProblems.some((problem) => problem.includes('"23 at P1"') && problem.includes('open at P1')),
      'a narrative counting 23 open P1s was accepted while the ledger has none',
    );
    assert.ok(
      staleProblems.some((problem) => problem.includes('both cannot be true')),
      'a narrative that both counts open P1s and says there are none was accepted',
    );

    // 3. The other direction, on entries this test controls: an open P1 with a section that
    //    says the phase closed everything. The ledger is what moves here, not the document.
    const reopened = [...entries.map((entry) => ({ ...entry })), { id: 'F999', severity: 'P1', closed: false }];
    assert.ok(
      narrativeProblems(narrative, reopened).some((problem) => problem.includes('F999 (P1)')),
      'the narrative kept its "every P0 and P1 is closed" claim while a P1 was open',
    );

    // 4. And an honest count passes. A rule that refused every number would push the
    //    numbers out of the document, which is the opposite of what F211 asked for.
    const honest = [...entries.map((entry) => ({ ...entry })), { id: 'F999', severity: 'P1', closed: false }];
    assert.deepEqual(
      narrativeProblems(fixtureNarrative('A survey found 40 gaps. 1 at P1 is still open, and it is F999.'), honest),
      [],
      'a narrative whose count matches the ledger exactly was still refused',
    );
  });
});
