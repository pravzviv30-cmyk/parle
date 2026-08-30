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
import { execFileSync } from 'node:child_process';
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

/**
 * Phase 6's exit criterion, read against the code it describes.
 *
 * The criterion is four nouns and nothing else: "Passport, delayed test, less-help replay,
 * honest reminders/story". Three of them were built in slice 6a and the fourth has no line
 * of code anywhere, which is exactly the moment an exit criterion gets quietly shortened —
 * the failure mode the Phase 5 rule at the head of this file already names.
 *
 * So this rule does two things at once, and neither of them is "the document says built".
 *
 *   1. **The nouns stay.** All four have to be in the criterion cell, including the one
 *      nobody built. Dropping it would make the phase smaller without anybody deciding to.
 *
 *   2. **A built noun names real source.** Each noun carries a definition, and a definition
 *      that claims code cites the symbols in the file that declares them. Those symbols are
 *      checked against the file, not against a list typed into this test: delete
 *      `firstReturn` and this goes red naming it, which is a document to fix rather than a
 *      test to edit. That is the Phase 5 precedent, where the mode names come out of the
 *      `LiveMode` union rather than out of a constant here.
 *
 * `declares` is deliberately stricter than "the word appears in the file". `independenceFrom`
 * is named in a comment at the top of `passport.ts` and is declared in `missions.ts`, so a
 * word search would let the passport claim to implement it. A declaration is what a document
 * is allowed to point at, and the refutations below prove that distinction is real.
 *
 * The unbuilt noun is judged in both directions, because "not built" is a claim about the
 * repository and claims about the repository rot. `slice6bEvidence` looks for the two things
 * slice 6b would have to add — a notifications dependency in a workspace manifest, and a
 * module whose own name is a story or a reminder — and the definition has to agree with what
 * it finds. Build 6b and this goes red until the document catches up.
 */

/** Phase 6's four nouns, written out. Shortening this list is the thing being defended. */
const PHASE_SIX_NOUNS = ['Passport', 'delayed test', 'less-help replay', 'honest reminders/story'] as const;

/**
 * Phase 6's ledger ids, written out rather than inferred from a range.
 * `evidenceContract.test.ts` and `practiceRecord.test.ts` both make this choice, for the
 * reason they both give: a phase is a fixed historical thing, and "everything after F215"
 * silently adopts whatever the next phase files.
 */
const PHASE_SIX_LEDGER = [
  'F216', 'F217', 'F218', 'F219', 'F220',
  'F221', 'F222', 'F223', 'F224', 'F225',
] as const;

/** Case and punctuation dropped, so "honest reminders/story" can find "Honest reminders / story". */
const nounKey = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, '');

/** The `## Phase 6` narrative section, whitespace intact. */
function phaseSixSection(markdown: string): string {
  const start = markdown.search(/^## Phase 6\b/m);
  assert.notEqual(start, -1, 'the roadmap has no Phase 6 narrative section, so there is nothing to judge');
  const rest = markdown.slice(start);
  const end = rest.indexOf('\n## ', 1);
  return end === -1 ? rest : rest.slice(0, end);
}

interface NounDefinition {
  /** The bolded lead of the bullet, which is what names the noun. */
  lead: string;
  /** The whole bullet, whitespace-flattened. */
  body: string;
}

/** One bullet per noun, from the definitions subsection alone. */
function nounDefinitions(section: string): NounDefinition[] {
  const at = section.indexOf('### What each noun means');
  assert.notEqual(at, -1, 'the Phase 6 section no longer defines its nouns, so the criterion means whatever a reader decides');
  const rest = section.slice(at);
  const end = rest.indexOf('\n### ', 1);
  const body = end === -1 ? rest : rest.slice(0, end);
  return body
    .split(/\n[ \t]*-[ \t]+(?=\*\*)/)
    .slice(1)
    .map((chunk) => {
      const flat = chunk.replace(/\s+/g, ' ').trim();
      return { lead: /^\*\*(.+?)\*\*/.exec(flat)?.[1] ?? '', body: flat };
    });
}

/** A minimal definitions section the rule can be run against, read by the real parser. */
function fixtureDefinitions(...bullets: string[]): string {
  return ['## Phase 6: a fixture', '', '### What each noun means', '', ...bullets, ''].join('\n');
}

/**
 * A claim of the shape "`a`, `b` and `c` in `path/to/file.ts`", anywhere in a definition.
 *
 * Free prose around it on purpose. A definition that has to be written in a fixed grammar
 * stops being a definition and becomes a form, and the thing worth checking is only the
 * join between a symbol and the file that is supposed to declare it.
 */
const IMPLEMENTATION_CLAUSE = /((?:`[^`\n]+`(?:,\s+|\s+and\s+))*`[^`\n]+`)\s+in\s+`([^`\n]+)`/g;

function implementationClauses(body: string): { symbols: string[]; file: string }[] {
  return [...body.matchAll(IMPLEMENTATION_CLAUSE)].map((hit) => ({
    symbols: [...hit[1]!.matchAll(/`([^`\n]+)`/g)].map((symbol) => symbol[1]!),
    file: hit[2]!,
  }));
}

/**
 * Whether a file declares a name, rather than merely mentioning it.
 *
 * Five shapes, because the code Phase 6a touched uses all five: a keyword declaration, a
 * re-export list, a class field with a modifier, an optional property in a config type, and
 * a method with a body. A call and a comment are neither, which is the whole point.
 */
function declares(source: string, symbol: string): boolean {
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(symbol)) return false;
  const patterns = [
    `\\b(?:export\\s+)?(?:default\\s+)?(?:abstract\\s+)?(?:async\\s+)?(?:function|const|let|var|class|interface|type|enum)\\s+${symbol}\\b`,
    `export\\s*(?:type\\s*)?\\{[^}]*\\b${symbol}\\b[^}]*\\}`,
    `^[ \\t]*(?:(?:private|public|protected|readonly|static)[ \\t]+)+${symbol}[ \\t]*\\??[ \\t]*:`,
    `^[ \\t]*${symbol}\\?[ \\t]*:`,
    `^[ \\t]*(?:(?:private|public|protected|static|async|override)[ \\t]+)*${symbol}[ \\t]*\\([^\\n]*\\)[^\\n]*\\{`,
  ];
  return patterns.some((pattern) => new RegExp(pattern, 'm').test(source));
}

/**
 * Everything in this repository that would exist if slice 6b had been started.
 *
 * Taken as inputs rather than read here, so the rule can be run against a tree this file
 * controls. A green result nobody can refute is not evidence of anything.
 */
function slice6bEvidence(files: readonly string[], read: (file: string) => string): string[] {
  const found: string[] = [];
  for (const file of files) {
    const base = path.basename(file);
    if (base === 'package.json') {
      let manifest: Record<string, Record<string, string> | undefined>;
      try {
        manifest = JSON.parse(read(file));
      } catch {
        continue;
      }
      for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
        for (const dependency of Object.keys(manifest[field] ?? {})) {
          if (/notification/i.test(dependency)) found.push(`${file} depends on ${dependency}`);
        }
      }
      continue;
    }
    if (!/\.tsx?$/.test(base) || /\.test\.tsx?$/.test(base)) continue;
    // Split on separators and on camel humps, so `weeklyStory.ts` is a story module and
    // `history.ts` is not. A substring search cannot tell those two apart.
    const words = base.replace(/\.tsx?$/, '').split(/[^A-Za-z0-9]+|(?<=[a-z0-9])(?=[A-Z])/);
    if (words.some((word) => /^(?:stor(?:y|ies)|notifications?|reminders?)$/i.test(word))) {
      found.push(`${file} is a slice 6b module`);
    }
  }
  return found;
}

/** Every file this repository ships, repo-relative, excluding the obvious noise. */
function repoFiles(dir: string, prefix = ''): string[] {
  const skip = new Set(['node_modules', 'dist', 'build', 'coverage', '.expo', 'android', 'ios', 'graphify-out']);
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || skip.has(entry.name)) continue;
    const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) out.push(...repoFiles(path.join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out;
}

/**
 * Every reason the Phase 6 criterion and its definitions do not describe this repository.
 *
 * A list rather than inline assertions, for the reason the head of this file gives twice
 * over: a rule that can only be run against the one document on disk cannot prove that a
 * green result was earned.
 */
function phaseSixProblems(
  criteria: string,
  section: string,
  read: (file: string) => string | null,
  slice6b: readonly string[],
): string[] {
  const problems: string[] = [];
  const definitions = nounDefinitions(section);

  for (const noun of PHASE_SIX_NOUNS) {
    if (!criteria.toLowerCase().includes(noun.toLowerCase())) {
      problems.push(`the criterion no longer names "${noun}", so the phase quietly got smaller`);
    }
    const matching = definitions.filter((definition) => nounKey(definition.lead) === nounKey(noun));
    if (matching.length !== 1) {
      problems.push(`"${noun}" has ${matching.length} definitions, and a noun nobody defined is a noun nobody can close`);
    }
  }
  for (const definition of definitions) {
    if (!PHASE_SIX_NOUNS.some((noun) => nounKey(noun) === nounKey(definition.lead))) {
      problems.push(`the definitions name "${definition.lead}", which is not one of the criterion's nouns`);
    }
  }

  for (const definition of definitions) {
    const unbuilt = /\bnot built\b/i.test(definition.body);
    const built = /\bbuilt\b/i.test(definition.body.replace(/\bnot built\b/gi, ' '));
    if (built === unbuilt) {
      problems.push(`"${definition.lead}" says neither that it is built nor that it is not, or says both`);
      continue;
    }

    const clauses = implementationClauses(definition.body);
    if (!built) {
      if (clauses.length > 0) {
        problems.push(`"${definition.lead}" is not built and cites ${clauses[0]!.file} anyway`);
      }
      continue;
    }
    if (clauses.length === 0) {
      problems.push(`"${definition.lead}" claims to be built and names no source at all`);
      continue;
    }
    for (const clause of clauses) {
      const source = read(clause.file);
      if (source === null) {
        problems.push(`"${definition.lead}" names ${clause.file}, and no such file is in this repo`);
        continue;
      }
      for (const symbol of clause.symbols) {
        if (!declares(source, symbol)) {
          problems.push(`"${definition.lead}" says \`${symbol}\` is in ${clause.file}, which declares no such thing`);
        }
      }
    }
  }

  // The unbuilt noun, judged against the tree rather than against itself. This is the half
  // that stops "not built" from becoming a sentence nobody rereads.
  const reminders = definitions.find((definition) => /reminder/i.test(definition.lead));
  if (reminders === undefined) {
    problems.push('no definition names the reminders and story noun at all');
  } else {
    const claimsBuilt = !/\bnot built\b/i.test(reminders.body);
    if (claimsBuilt && slice6b.length === 0) {
      problems.push('the reminders and story noun claims to be built and nothing in this repository implements it');
    }
    if (!claimsBuilt && slice6b.length > 0) {
      problems.push(`the reminders and story noun says it is not built, and this repository has ${slice6b.join(', ')}`);
    }
  }

  return problems;
}

/**
 * Slice 6b's ledger ids, and why three ids inside the F226..F239 span are not among them.
 *
 * Written out rather than inferred from a range, for the reason `PHASE_SIX_LEDGER` above
 * gives: a slice is a fixed historical thing, and "everything after F225" silently adopts
 * whatever the next slice files.
 *
 *  - **F235** files the rule you are reading and **F236** writes the row it judges. F203 and
 *    F225 set that precedent twice over: an entry whose whole job is to make the row right
 *    cannot also be a precondition for the row being writable, or nothing ever closes.
 *  - **F237** is a P2 about raw NUL bytes hiding two source files from grep. It was found
 *    while 6b was being built and belongs to no slice, so counting it would hold the row
 *    hostage to an unrelated repair. The severity filter below would drop it anyway; leaving
 *    it out of the list is what says why.
 *
 * **F240 is in**, and it asked to be decided here rather than guessed at. It reads like F237 —
 * both were found in passing, both name a file the entry that found them was not building — and
 * it is not the same case. What separates them is which tree the repair lives in. F237's files
 * are `apps/mobile/src/sync/policy.ts` and `packages/core/src/review/merge.ts`, which slice 6b
 * never touched; F240's are the reminder's own, and its subject is the reminder putting a count
 * on the launcher icon. A count is the thing this phase exists not to show. A row that called 6b
 * built while the reminder still badged the home screen would be the exact overclaim this rule
 * refuses, so the slice is not closed while F240 is open.
 */
const PHASE_SIX_B_LEDGER = [
  'F226', 'F227', 'F228', 'F229', 'F230', 'F231',
  'F232', 'F233', 'F234', 'F238', 'F239', 'F240',
] as const;

/**
 * The ids in the same span that are deliberately not slice 6b work, and why.
 *
 * This exists so the list above can be checked for completeness rather than trusted. Every
 * id from F226 up has to appear in one of these two places while the slice is still in
 * flight, and an id in neither turns this red by name. That is the whole answer to the
 * failure mode the hand-written list actually has: not that it is wrong, but that being
 * wrong made it quieter. F238, F239 and F240 were each filed after it was written, and each
 * time the list got weaker without saying so.
 *
 * The obvious alternative — derive the slice from the ledger instead of typing it — was
 * measured before being rejected, because it reads better than it works. Matching `where:`
 * against a reminders or story path finds six of the twelve: it drops F229 (the sync
 * exclusion, filed against `sync/policy.ts`), F231 and F239 (the Profile row), F233 (My
 * French), F234 (the ladder comment) and F238 (`app.json`), four of them P1. Widening it to
 * keyword-match the note instead sweeps in F236, which is the one entry that provably must
 * be excluded, because its note has to describe the slice in order to write the row about
 * it. A derived rule would therefore have been wrong in both directions and silent in both,
 * which is the property being fixed, so the list stays typed and the completeness check is
 * what stops it going quiet.
 */
const NOT_SLICE_SIX_B: Readonly<Record<string, string>> = {
  F235: 'files the row rule in this file, so it cannot be a precondition for the row',
  F236: 'writes the row this rule judges, for the same reason',
  F237: 'a P2 about NUL bytes in sync/policy.ts and core/review/merge.ts, files 6b never touched',
};

/** Every id the ledger holds from F226 up, which is the span slice 6b was filed into. */
function sliceSixBSpan(entries: ReadonlyMap<string, LedgerEntry>): string[] {
  return [...entries.keys()]
    .filter((id) => Number(id.slice(1)) >= 226)
    .sort((left, right) => Number(left.slice(1)) - Number(right.slice(1)));
}

interface LedgerEntry {
  severity: string;
  closed: boolean;
}

/** Every ledger entry by id, with its severity and whether it is closed. */
function ledgerEntries(text: string): Map<string, LedgerEntry> {
  return new Map(
    text.split(/\n(?=### )/).flatMap((block) => {
      const id = /^### (F\d+) — /.exec(block)?.[1];
      if (id === undefined) return [];
      const severity = /^- severity: (P[012])/m.exec(block)?.[1] ?? 'P2';
      return [[id, { severity, closed: /^- status: \[x\]/m.test(block) }] as const];
    }),
  );
}

/**
 * The ids in a slice that are still open above P2.
 *
 * A missing id counts as blocking. An entry nobody can find in the ledger is an entry
 * nobody can call closed, and the alternative is a row that gets easier to justify by
 * deleting its evidence.
 */
function blockingIn(ids: readonly string[], entries: ReadonlyMap<string, LedgerEntry>): string[] {
  return ids.filter((id) => {
    const entry = entries.get(id);
    return entry === undefined || (!entry.closed && entry.severity !== 'P2');
  });
}

/**
 * The status cell as separate claims. A full stop ends one; a colon or a semicolon
 * introduces the next. That is how this cell is actually written, and splitting on the
 * three of them is what stops a claim about slice 6a being read as a claim about 6b.
 */
function rowSentences(status: string): string[] {
  return status
    .split(/(?<=[.;:])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

/** Words that turn a sentence about a phone into an admission rather than a claim. */
const NEGATOR = /\b(?:no|not|never|nothing|nobody|none|neither|nor|yet|unclaimed|unverified|pending)\b/i;

/**
 * A claim that a reminder, a notification or the weekly story was seen doing something on
 * a phone. Nothing in this slice has been on a phone, and a notification firing is the one
 * piece of evidence a green suite most looks like and least is.
 *
 * The noun and the verb have to sit in one clause — `[^.;:]` — so "no reminder has been
 * seen firing" and "the passport was seen on a device" are not stitched together across a
 * full stop. The limit, stated rather than hidden: the negation check reads the whole
 * clause, so a clause that both denies one thing and claims another gets through. That is
 * a contrived sentence, and the honest ones this has to keep accepting — "Nothing in this
 * phase has been seen on a device" — are the common case.
 */
const DEVICE_FIRING =
  /\b(?:reminders?|notifications?|stor(?:y|ies))\b[^.;:]{0,160}?\b(?:fired|fires|arrived|arrives|rang|popped up|(?:was|were) delivered|landed on (?:a|the) (?:phone|device)|seen (?:firing|arriving)|seen on (?:a|the) (?:phone|device))\b/i;

/**
 * Every reason the Phase 6 status cell does not describe the ledger and the tree.
 *
 * A list rather than inline assertions, for the reason this file gives three times over: a
 * rule that can only be run against the one document on disk cannot prove a green result
 * was earned. The refutations in the test below run it against rows nobody wrote.
 *
 * Both slices are judged the same way and in both directions. The row may say a slice is
 * built only when that slice's ledger is closed, and it may say a slice is unbuilt only
 * while the ledger agrees and the tree holds none of it. F235 filed this because the
 * hard-coded "6b is not built" assertion that used to live here was a claim about the
 * repository, and claims about the repository rot: 6b shipped and the assertion went red by
 * design. The replacement cannot go stale the same way, because nothing here is pinned to
 * what happens to be true today.
 */
function phaseSixRowProblems(
  status: string,
  entries: ReadonlyMap<string, LedgerEntry>,
  slice6b: readonly string[],
): string[] {
  const problems: string[] = [];
  const sentences = rowSentences(status);

  // ── slice 6a, the F225 rule, unchanged ───────────────────────────────────────────────
  const blocking6a = blockingIn(PHASE_SIX_LEDGER.filter((id) => id !== 'F225'), entries);
  const claims6aBuilt = /\b(?:slice )?6a is built\b/i.test(status);
  if (blocking6a.length > 0) {
    if (claims6aBuilt) problems.push(`the row says 6a is built while ${blocking6a.join(', ')} is still open`);
  } else if (!claims6aBuilt) {
    problems.push('every Phase 6 P0 and P1 is closed and the row does not say slice 6a is built');
  }

  // ── slice 6b, the same rule against its own ledger and the tree ──────────────────────
  const claim = sentences.filter((sentence) => /\b6b\b/i.test(sentence)).join(' ');
  if (claim === '') {
    problems.push('the status cell never mentions slice 6b, so a reader takes the phase for finished');
  } else {
    const unbuilt = /\bnot built\b|\bdeferred\b/i.test(claim);
    const built = /\bbuilt\b/i.test(claim.replace(/\bnot built\b/gi, ' '));
    const blocking6b = blockingIn(PHASE_SIX_B_LEDGER, entries);
    if (built === unbuilt) {
      problems.push('the row says neither that slice 6b is built nor that it is not, or says both');
    } else if (built) {
      if (blocking6b.length > 0) {
        problems.push(
          `the row says slice 6b is built while ${blocking6b.join(', ')} ${blocking6b.length === 1 ? 'is' : 'are'} still open`,
        );
      }
      if (slice6b.length === 0) {
        problems.push('the row says slice 6b is built and nothing in this repository implements it');
      }
    } else {
      if (slice6b.length > 0) {
        problems.push(`the row says slice 6b is not built, and this repository has ${slice6b.join(', ')}`);
      }
      if (blocking6b.length === 0) {
        problems.push('every slice 6b P0 and P1 is closed and the row still says slice 6b is not built');
      }
      // While the row still reads unbuilt the slice is in flight, which is the only window
      // in which `PHASE_SIX_B_LEDGER` can go stale. An id filed into the span that neither
      // list claims is an id nobody decided about, and the point of saying so here is that
      // the alternative is a rule that silently got easier to satisfy.
      for (const id of sliceSixBSpan(entries)) {
        if (PHASE_SIX_B_LEDGER.includes(id as (typeof PHASE_SIX_B_LEDGER)[number])) continue;
        if (NOT_SLICE_SIX_B[id] !== undefined) continue;
        problems.push(`${id} was filed into the slice 6b span and neither list says whether it is 6b work`);
      }
    }
  }

  // ── what nobody did ──────────────────────────────────────────────────────────────────
  // Device evidence stays unclaimed for both slices. A notification that has been watched
  // arriving on a phone is the thing this row is most tempted to imply and least entitled
  // to say, because the whole slice was measured by tests against source.
  for (const sentence of sentences) {
    if (DEVICE_FIRING.test(sentence) && !NEGATOR.test(sentence)) {
      problems.push(`the row claims a reminder was seen working on a phone: "${sentence}"`);
    }
  }
  const onDevice = sentences.filter((sentence) => /\bdevice\b|\bphone\b/i.test(sentence));
  if (onDevice.length === 0) {
    problems.push('the row does not say that none of this has been seen on a device');
  } else if (!onDevice.some((sentence) => NEGATOR.test(sentence))) {
    problems.push('the row mentions a device without saying that nobody has seen this on one');
  }
  // A merge claim used to be refused outright here, on the grounds that no merge had
  // happened. That was a claim about the repository written into a test, which is the exact
  // defect F235 filed against the line above it, and it rotted the same way: `eee755c`
  // merged the branch into `main` and the refusal became the false sentence. F243 moved the
  // check to `landingProblems` at the foot of this file, where a merge claim is judged
  // against git — it must name a commit, the commit must exist, and it must be in a history
  // this checkout can reach. Nothing was dropped; the pin was.
  if (/\brelease\b|\bshipped\b|ready to ship/i.test(status)) {
    problems.push('the row reads as a release');
  }

  return problems;
}

/** A ledger the row rule can be run against: every id closed at P1 unless named open. */
function fixtureLedger(open: Readonly<Record<string, string>> = {}): Map<string, LedgerEntry> {
  const ledger = new Map<string, LedgerEntry>();
  for (const id of [...PHASE_SIX_LEDGER, ...PHASE_SIX_B_LEDGER]) {
    ledger.set(id, { severity: 'P1', closed: true });
  }
  for (const [id, severity] of Object.entries(open)) ledger.set(id, { severity, closed: false });
  return ledger;
}

/** A status cell that claims both slices, honestly. The refutations vary one thing from it. */
const FIXTURE_BUILT_ROW =
  'Slice 6a is built on `phase-6-retention` and has not landed. Slice 6b, the honest reminders and the weekly story, is built. Nothing in this phase has been seen on a device';

/** The same cell as it read before 6b existed, which this rule still has to accept. */
const FIXTURE_DEFERRED_ROW =
  'Slice 6a is built on `phase-6-retention` and has not landed. Slice 6b, the honest reminders and the weekly story, is not built at all and stays designed but intentionally deferred. Nothing in this phase has been seen on a device';

describe('the delivery roadmap defines what Phase 6 shipped and what it did not', () => {
  test('the Phase 6 criterion keeps all four nouns and each built noun names real source', () => {
    const criteria = criteriaFor(roadmap, 6);
    const section = phaseSixSection(roadmap);
    const read = (file: string): string | null => {
      try {
        return readFileSync(path.join(ROOT, file), 'utf8');
      } catch {
        return null;
      }
    };
    const files = repoFiles(ROOT);
    const slice6b = slice6bEvidence(files, (file) => readFileSync(path.join(ROOT, file), 'utf8'));

    // 1. The documents as they stand.
    assert.deepEqual(
      phaseSixProblems(criteria, section, read, slice6b),
      [],
      'the Phase 6 criterion and its definitions do not describe the code this repository ships',
    );

    // 2. The rule is not vacuous. A definitions section that had drifted into prose would
    //    pass every check above by having nothing left to check.
    const clauses = nounDefinitions(section).flatMap((definition) => implementationClauses(definition.body));
    const symbols = clauses.flatMap((clause) => clause.symbols);
    assert.ok(clauses.length >= 8, `only ${clauses.length} definitions name a source file, so this rule is judging almost nothing`);
    assert.ok(symbols.length >= 12, `only ${symbols.length} symbols are named across the definitions`);
    assert.ok(
      new Set(clauses.map((clause) => clause.file)).size >= 6,
      'the definitions point at fewer than six files, so a whole noun has stopped naming its code',
    );

    // 3. And 6b really is absent, measured rather than asserted. If this ever finds
    //    something, rule 1 above has already said the document is the thing to change.
    assert.ok(files.length > 100, `only ${files.length} files were walked, so the slice 6b probe saw almost nothing`);

    // ── the refutations ────────────────────────────────────────────────────────────────
    // Each one is a document somebody could plausibly write, and each has to be refused.

    // 4. The unbuilt noun dropped. The sentence still reads well, the phase is smaller, and
    //    this is the cheapest way there is to pass an exit criterion.
    const shortened = phaseSixProblems('Passport, delayed test, less-help replay', section, read, slice6b);
    assert.ok(
      shortened.some((problem) => problem.includes('"honest reminders/story"') && problem.includes('quietly got smaller')),
      'the criterion was allowed to drop the noun nobody built',
    );

    // 5. A symbol the file only mentions. `independenceFrom` is named in a comment at the
    //    top of `passport.ts` and declared in `missions.ts`, so a word search would accept
    //    this and a declaration check must not.
    const borrowed = phaseSixProblems(
      criteria,
      fixtureDefinitions('- **Passport.** Built in 6a. In code: `independenceFrom` in `apps/mobile/src/progress/passport.ts`.'),
      read,
      slice6b,
    );
    assert.ok(
      borrowed.some((problem) => problem.includes('`independenceFrom`') && problem.includes('declares no such thing')),
      'a definition claiming a symbol its own file only mentions in a comment was accepted',
    );
    assert.ok(
      readFileSync(path.join(ROOT, 'apps', 'mobile', 'src', 'progress', 'passport.ts'), 'utf8').includes('independenceFrom'),
      'passport.ts no longer mentions independenceFrom, so refutation 5 is proving nothing',
    );

    // 6. A file that does not exist. A definition may not be kept true by a typo.
    const missing = phaseSixProblems(
      criteria,
      fixtureDefinitions('- **Passport.** Built in 6a. In code: `stampsFrom` in `apps/mobile/src/progress/stamps.ts`.'),
      read,
      slice6b,
    );
    assert.ok(
      missing.some((problem) => problem.includes('no such file is in this repo')),
      'a definition pointing at a file this repo does not have was accepted',
    );

    // 7. A noun that claims to be built and names nothing. This is the state the criterion
    //    was in before F225: four nouns, no definitions, and nothing to close against.
    const bare = phaseSixProblems(criteria, fixtureDefinitions('- **Passport.** Built in 6a. It works well.'), read, slice6b);
    assert.ok(
      bare.some((problem) => problem.includes('names no source at all')),
      'a noun claiming to be built while naming no code was accepted',
    );

    // 8. And the other direction: an unbuilt noun that cites code anyway.
    const contradictory = phaseSixProblems(
      criteria,
      fixtureDefinitions('- **Honest reminders / story.** Not built. In code: `stampsFrom` in `apps/mobile/src/progress/passport.ts`.'),
      read,
      slice6b,
    );
    assert.ok(
      contradictory.some((problem) => problem.includes('is not built and cites')),
      'a noun that says it is not built and then names its implementation was accepted',
    );

    // 9. The reminders noun claiming to be built while nothing implements it, which is the
    //    overclaim this whole entry exists to stop.
    //
    //    The empty probe is passed in rather than the real one, and that is the correction
    //    F235 made here. While 6b was unbuilt the two were the same list, so this read as a
    //    refutation and was in fact a tautology: the day 6b shipped, the real probe stopped
    //    being empty and this stopped being able to fire at all. A refutation that quietly
    //    dies when the tree moves is the same rot the row rule below was filed for.
    const overclaimed = phaseSixProblems(
      criteria,
      fixtureDefinitions('- **Honest reminders / story.** Built in 6a. It reminds people honestly.'),
      read,
      [],
    );
    assert.ok(
      overclaimed.some((problem) => problem.includes('nothing in this repository implements it')),
      'the unbuilt noun was allowed to claim it shipped',
    );

    // 10. And the direction that actually happened: 6b got built and the document still
    //     said it did not. The tree moves here, not the sentence. Both sides are fixtures
    //     now, for the reason given at refutation 9: read against the live section this
    //     went dead the moment that section stopped saying "not built".
    assert.ok(
      phaseSixProblems(
        criteria,
        fixtureDefinitions('- **Honest reminders / story.** Not built. It stays designed but intentionally deferred.'),
        read,
        ['apps/mobile/package.json depends on expo-notifications'],
      ).some((problem) => problem.includes('says it is not built')),
      'the document kept its "not built" claim while the repository had shipped it',
    );

    // 11. The probe itself, run over a tree this test controls. A story module and a
    //     notifications dependency are found; `history.ts` is not a story.
    assert.deepEqual(
      slice6bEvidence(['apps/mobile/src/progress/history.ts', 'apps/mobile/src/progress/passport.ts'], () => ''),
      [],
      'the slice 6b probe mistook an ordinary module for a story or a reminder',
    );
    assert.equal(slice6bEvidence(['apps/mobile/src/story/weeklyStory.ts'], () => '').length, 1);
    assert.equal(slice6bEvidence(['apps/mobile/src/notifications.ts'], () => '').length, 1);
    assert.equal(
      slice6bEvidence(['apps/mobile/package.json'], () => JSON.stringify({ dependencies: { 'expo-notifications': '~0.1.0' } })).length,
      1,
    );
    assert.deepEqual(slice6bEvidence(['apps/mobile/package.json'], () => 'not json at all'), []);

    // 12. And `declares` is stricter than a word search, proven on strings rather than on
    //     the tree, so the distinction rule 5 depends on is nailed down here.
    assert.ok(declares('export function firstReturn(card: ReviewCard): boolean {', 'firstReturn'));
    assert.ok(declares('export const LESS_HELP = "Less help this time.";', 'LESS_HELP'));
    assert.ok(declares('export interface Stamp {', 'Stamp'));
    assert.ok(declares('    startRung?: Rung;', 'startRung'));
    assert.ok(declares('  private readonly startRung: Rung | undefined;', 'startRung'));
    assert.ok(declares('  private openMission(frame: ScenarioFrame): void {', 'openMission'));
    assert.ok(declares('export { firstReturn, dueCards } from "./scheduler.ts";', 'firstReturn'));
    assert.ok(!declares('      this.openMission(mission);', 'openMission'));
    assert.ok(!declares(' * already owned: `independenceFrom` says how much help was', 'independenceFrom'));
    assert.ok(!declares('  const stamps = stampsFrom(progress);', 'stampsFrom'));
    assert.ok(!declares('export type StampState = (typeof STAMP_STATES)[number];', 'Stamp'));
  });

  test('the phase six row says what is built and what is not', () => {
    const entries = ledgerEntries(readFileSync(KNOWN_ISSUES_PATH, 'utf8'));
    for (const id of [...PHASE_SIX_LEDGER, ...PHASE_SIX_B_LEDGER]) {
      assert.ok(entries.has(id), `${id} is gone from the ledger, so the Phase 6 row cannot be judged against it`);
    }

    const row = phaseRows(roadmap).find((candidate) => candidate.phase.startsWith('6.'));
    assert.ok(row, 'the roadmap has no row for phase 6');
    const status = row.status.replace(/\s+/g, ' ').trim();
    assert.ok(status.length > 0, 'the Phase 6 row has no status cell to read');

    const files = repoFiles(ROOT);
    const slice6b = slice6bEvidence(files, (file) => readFileSync(path.join(ROOT, file), 'utf8'));

    // 1. The row as it stands, against the ledger and the tree it summarises.
    assert.deepEqual(
      phaseSixRowProblems(status, entries, slice6b),
      [],
      'the Phase 6 row does not describe the ledger and the code this repository ships',
    );

    // 2. The probe is not answering out of an empty tree, which would make every claim
    //    about slice 6b below vacuously true.
    assert.ok(files.length > 100, `only ${files.length} files were walked, so the slice 6b probe saw almost nothing`);

    // ── the refutations ────────────────────────────────────────────────────────────────
    // Each one is a status cell somebody could plausibly write, and each has to be refused.
    // These run on strings and a fixture ledger, so none of them moves when the real
    // document does.

    // 3. Slice 6b claimed as built while its own ledger is open. This is the direction the
    //    F225 rule already holds for 6a, applied to the slice that has now been built.
    assert.ok(
      phaseSixRowProblems(FIXTURE_BUILT_ROW, fixtureLedger({ F238: 'P1' }), ['a slice 6b module']).some(
        (problem) => problem.includes('slice 6b is built while F238'),
      ),
      'the row was allowed to call slice 6b built with a slice 6b P1 still open',
    );

    // 4. And claimed as built over a tree that holds none of it. A row may not ship a slice
    //    by describing it.
    assert.ok(
      phaseSixRowProblems(FIXTURE_BUILT_ROW, fixtureLedger(), []).some(
        (problem) => problem.includes('nothing in this repository implements it'),
      ),
      'the row was allowed to call slice 6b built while nothing implements it',
    );

    // 5. The other direction, and the one that actually happened: 6b got built and the row
    //    still called it deferred. The tree moves here, not the sentence. This is what the
    //    hard-coded "6b is not built" assertion used to prevent by pinning, and what it now
    //    prevents by measuring.
    assert.ok(
      phaseSixRowProblems(FIXTURE_DEFERRED_ROW, fixtureLedger({ F238: 'P1' }), [
        'apps/mobile/src/reminders/reminder.ts is a slice 6b module',
      ]).some((problem) => problem.includes('slice 6b is not built, and this repository has')),
      'the row kept its deferred claim while the repository had shipped the slice',
    );

    // 6. Deferred while every slice 6b entry is closed. The ledger is an authority of its
    //    own here, so a slice that closed without leaving a file the probe recognises still
    //    cannot be summarised as unbuilt.
    assert.ok(
      phaseSixRowProblems(FIXTURE_DEFERRED_ROW, fixtureLedger(), []).some(
        (problem) => problem.includes('every slice 6b P0 and P1 is closed'),
      ),
      'the row was allowed to call a closed slice deferred',
    );

    // 7. And the state before any of this: 6b unbuilt, its ledger open, nothing in the tree.
    //    The rule has to keep accepting the row it was written against, or it is not a rule
    //    about honesty but a rule about the calendar.
    assert.deepEqual(phaseSixRowProblems(FIXTURE_DEFERRED_ROW, fixtureLedger({ F238: 'P1' }), []), []);

    // 8. The three exclusions, proven rather than asserted in a comment. F235 writes this
    //    rule, F236 writes the row, and F237 is an unrelated P2 about NUL bytes in source.
    //    If any of them counted, the row could never be written and nothing could close.
    assert.deepEqual(
      phaseSixRowProblems(
        FIXTURE_BUILT_ROW,
        fixtureLedger({ F235: 'P1', F236: 'P1', F237: 'P2' }),
        ['a slice 6b module'],
      ),
      [],
      'an entry whose job is to write this row was counted as a reason the row may not be written',
    );
    assert.deepEqual(
      Object.keys(NOT_SLICE_SIX_B).sort(),
      ['F235', 'F236', 'F237'],
      'an id was excluded from slice 6b without a reason written beside it',
    );
    for (const [id, reason] of Object.entries(NOT_SLICE_SIX_B)) {
      assert.ok(reason.length > 40, `${id} is excluded from slice 6b with a reason too short to be one`);
      assert.ok(
        !PHASE_SIX_B_LEDGER.includes(id as (typeof PHASE_SIX_B_LEDGER)[number]),
        `${id} is both in slice 6b and excluded from it`,
      );
    }

    // 8b. And the hole a hand-written list of ids actually has. F238, F239 and F240 were each
    //     filed after this list was written, and each time it got weaker without saying so.
    //     An id in the span that neither list claims is now named while the slice is in
    //     flight, which is the difference between a decision and an oversight.
    assert.ok(
      phaseSixRowProblems(FIXTURE_DEFERRED_ROW, fixtureLedger({ F241: 'P1' }), []).some(
        (problem) => problem.includes('F241 was filed into the slice 6b span'),
      ),
      'an entry filed into the slice 6b span after this list was written passed unnoticed',
    );
    assert.deepEqual(
      sliceSixBSpan(fixtureLedger({ F241: 'P1' })).filter((id) => id === 'F216' || id === 'F241'),
      ['F241'],
      'the slice 6b span reached back into Phase 6a, where a different list is the authority',
    );

    // 9. Slice 6a still tracks its own ledger, in both directions.
    assert.ok(
      phaseSixRowProblems(FIXTURE_BUILT_ROW, fixtureLedger({ F220: 'P1' }), ['a slice 6b module']).some(
        (problem) => problem.includes('6a is built while F220'),
      ),
      'the row was allowed to call slice 6a built with a Phase 6a P1 still open',
    );
    assert.ok(
      phaseSixRowProblems(
        'Slice 6b, the honest reminders and the weekly story, is built. Nothing here has been seen on a device',
        fixtureLedger(),
        ['a slice 6b module'],
      ).some((problem) => problem.includes('does not say slice 6a is built')),
      'the row dropped the slice 6a claim while every Phase 6a entry was closed',
    );

    // 10. A row that never names 6b at all. A table reader takes the phase for finished,
    //     which is the whole reason the half-claim lives in the cell and not only in the
    //     section below it.
    assert.ok(
      phaseSixRowProblems(
        'Slice 6a is built on `phase-6-retention` and has not landed. Nothing in this phase has been seen on a device',
        fixtureLedger(),
        ['a slice 6b module'],
      ).some((problem) => problem.includes('never mentions slice 6b')),
      'the row was allowed to stop naming slice 6b',
    );

    // 11. And a row that says both, which is how a status cell rots: the old sentence is
    //     kept and the new one is appended.
    assert.ok(
      phaseSixRowProblems(
        'Slice 6a is built. Slice 6b is built and stays designed but intentionally deferred. Nothing has been seen on a device',
        fixtureLedger(),
        ['a slice 6b module'],
      ).some((problem) => problem.includes('neither that slice 6b is built nor that it is not')),
      'a row claiming slice 6b both built and deferred was accepted',
    );

    // 12. Device evidence, which nobody has. A notification seen arriving on a phone is the
    //     claim a green suite most resembles and least earns.
    assert.ok(
      phaseSixRowProblems(
        'Slice 6a is built. Slice 6b is built and the reminder fired on a phone at 8am. Nothing else has been seen on a device',
        fixtureLedger(),
        ['a slice 6b module'],
      ).some((problem) => problem.includes('seen working on a phone')),
      'the row was allowed to claim a notification had been watched arriving',
    );
    assert.ok(
      phaseSixRowProblems(
        'Slice 6a is built. Slice 6b is built. All of it has been seen on a device',
        fixtureLedger(),
        ['a slice 6b module'],
      ).some((problem) => problem.includes('without saying that nobody has seen this on one')),
      'the row mentioned a device without admitting nobody has used one',
    );
    assert.ok(
      phaseSixRowProblems(
        'Slice 6a is built. Slice 6b is built.',
        fixtureLedger(),
        ['a slice 6b module'],
      ).some((problem) => problem.includes('none of this has been seen on a device')),
      'the row dropped the device admission entirely',
    );

    // 13. And the claim that would make this read as finished work rather than as a branch.
    //     The word release, still refused here. A merge claim is no longer refused by this
    //     rule at all — F243 moved it to `landingProblems`, which asks git rather than
    //     asserting that no merge has happened — so the same string is checked there, on the
    //     property that survives a merge actually happening: the hash has to be real.
    assert.ok(
      landingProblems(
        [{ where: 'the Phase 6 row', text: `${FIXTURE_BUILT_ROW}, merged into \`main\` as \`abc1234\`` }],
        fixtureGit({ absent: ['abc1234'] }),
      ).some((problem) => problem.includes('does not exist in this repository')),
      'the row claimed a merge naming a commit this repository does not have',
    );
    assert.ok(
      phaseSixRowProblems(`${FIXTURE_BUILT_ROW} and it is ready to ship`, fixtureLedger(), ['a slice 6b module'])
        .some((problem) => problem.includes('reads as a release')),
      'the row was allowed to read as a release',
    );

    // 14. The sentence splitter, so refutations 3 to 12 are judging the clause they think
    //     they are. A claim about 6a must not be read as a claim about 6b.
    assert.deepEqual(rowSentences('One. Two: three; four'), ['One.', 'Two:', 'three;', 'four']);
    assert.deepEqual(rowSentences('Version 57.0.15 shipped.'), ['Version 57.0.15 shipped.']);
  });
});

/**
 * Landing claims, read against git rather than against the day they were written.
 *
 * F243. The Phase 6 row said "Slice 6a is built on `phase-6-retention` and has not landed".
 * That was true when it was written and false forty minutes later, when `eee755c` merged the
 * branch into `main`. Every rule above it stayed green, because every rule above it judges a
 * *built* claim — a claim about the ledger and the tree, both of which those rules read. A
 * *landed* claim is a fact about git, and nothing in this repository was reading git.
 *
 * That is the third roadmap sentence to outlive its truth in one day, after F211 and F212 in
 * the same document, so the repair is the rule rather than the sentence.
 *
 * ## What this can honestly check, and what it cannot
 *
 * A test that shells out to `git` is a different animal from the rest of this file, which
 * reads files. Files are always there. Git's answer depends on how the repository was
 * cloned, and the environments where that bites are exactly the ones that matter — a shallow
 * CI checkout, a detached HEAD, a worktree, a tarball with no `.git` at all. Measured, not
 * assumed: `actions/checkout@v4` defaults to `fetch-depth: 1`, and a `--depth 1` clone of
 * this repository resolves `eee755c` and nothing else. `refs/heads/main`,
 * `refs/remotes/origin/main`, `refs/heads/phase-6-retention` and `2a86092` all fail to
 * resolve there. A rule that read that as "the hash does not exist" would be a rule that
 * fails on the runner and passes on a laptop, which is worse than no rule.
 *
 * So every question git is asked has three answers and not two, and `unknown` is never a
 * failure. Two asymmetries make that honest rather than convenient:
 *
 *   - **A positive answer is always trusted.** `merge-base --is-ancestor` reaches a commit
 *     or it does not; a shallow graft can hide an ancestor, but it cannot invent one. So a
 *     "yes, this landed" is sound even in a truncated clone.
 *   - **A negative answer is trusted only in a full clone.** "This hash does not resolve" and
 *     "this branch is not on main" both mean "not here", and in a shallow clone "not here"
 *     is the normal state of almost everything. Both are downgraded to `unknown` when
 *     `rev-parse --is-shallow-repository` says true.
 *
 * The practical consequence, stated plainly so nobody reads a green CI run as more than it
 * is: **on GitHub Actions as this repository configures it, the git half of this rule
 * answers `unknown` to everything and only the textual half runs.** It would run in full if
 * the workflow ever set `fetch-depth: 0`. On a developer machine, in a worktree, and at a
 * detached HEAD, the whole rule runs — a worktree shares its parent's object database and
 * refs, and a detached HEAD still resolves `HEAD` and `refs/heads/main`.
 *
 * The textual half needs no git and never goes quiet:
 *
 *   - a cell that claims a merge has to name a commit, and the token has to be shaped like
 *     one, and
 *   - a cell may not say both that something merged and that something has not landed. That
 *     is the half-edit F243 would have become if the row had been half corrected, and it is
 *     the same rot refutation 11 above names: the old sentence kept, the new one appended.
 *
 * `git.limits` carries what could not be consulted, and the test prints it as a diagnostic.
 * A rule that quietly checks nothing is the failure mode this file exists to prevent, so a
 * green run says out loud which half of itself ran.
 */

/** What git could establish. `unknown` is a real answer, and it is never a failure. */
type GitAnswer = boolean | 'unknown';

interface GitFacts {
  /** Whether a commit for this hash is in the object database. */
  hasCommit(hash: string): GitAnswer;
  /** Whether that commit is in the history this checkout carries, or on `main`. */
  inHistory(hash: string): GitAnswer;
  /** Whether every commit on this branch is already an ancestor of `main`. */
  landedOnMain(branch: string): GitAnswer;
  /** What git could not be asked here, in words a failure message can carry. */
  readonly limits: readonly string[];
}

/** Where a landing claim was found and what it says. One table cell, flattened. */
interface LandingClaim {
  where: string;
  text: string;
}

/** A git command's stdout, or undefined if it failed for any reason at all. */
function gitText(root: string, args: readonly string[]): string | undefined {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 15_000,
    }).trim();
  } catch {
    return undefined;
  }
}

/**
 * A git predicate as three states. Exit 0 is yes, exit 1 is no, and anything else — 128 for
 * a rev git cannot name, ENOENT for no git at all — is a question that was never answered.
 */
function gitPredicate(root: string, args: readonly string[]): GitAnswer {
  try {
    execFileSync('git', args, { cwd: root, stdio: 'ignore', timeout: 15_000 });
    return true;
  } catch (error) {
    return (error as { status?: number }).status === 1 ? false : 'unknown';
  }
}

/** Where `main` might live, in the order worth trying. A worktree and a CI clone differ here. */
const MAIN_REFS = ['refs/heads/main', 'refs/remotes/origin/main', 'refs/remotes/upstream/main'] as const;

/** Where a branch might still be findable, including the tag this repo leaves when it deletes one. */
const BRANCH_REFS = ['refs/heads/', 'refs/remotes/origin/', 'refs/tags/', 'refs/tags/archive/'] as const;

/**
 * Everything git can say here, asked once and cached, with the limits written down.
 *
 * `rev-parse --verify --quiet <rev>^{commit}` is the one probe used for existence, because it
 * answers uniformly for a ref and for a hash: exit 0 with the full sha, or exit 1. `cat-file
 * -e` was measured and rejected — it exits 128 for a short hash that names nothing, which is
 * indistinguishable from git being broken.
 */
function readGitFacts(root: string): GitFacts {
  const limits: string[] = [];
  const resolved = new Map<string, string | undefined>();

  const resolve = (rev: string): string | undefined => {
    if (!resolved.has(rev)) resolved.set(rev, gitText(root, ['rev-parse', '--verify', '--quiet', `${rev}^{commit}`]));
    return resolved.get(rev);
  };

  const inRepo = gitText(root, ['rev-parse', '--git-dir']) !== undefined;
  if (!inRepo) limits.push('git could not read a repository here, so no claim was checked against history');

  const shallow = inRepo && gitText(root, ['rev-parse', '--is-shallow-repository']) === 'true';
  if (shallow) {
    limits.push('the clone is shallow, so git can confirm that a commit is present but never that one is missing');
  }

  const head = inRepo ? resolve('HEAD') : undefined;
  const main = inRepo ? MAIN_REFS.map(resolve).find((sha) => sha !== undefined) : undefined;
  if (inRepo && main === undefined) {
    limits.push(`no main ref resolves here (${MAIN_REFS.join(', ')}), so no row could be checked for having landed`);
  }

  /** A negative is only a negative in a full clone. Everywhere else it is "not fetched". */
  const negative = (answer: GitAnswer): GitAnswer => (answer === false && (shallow || !inRepo) ? 'unknown' : answer);

  const ancestor = (sha: string, of: string | undefined): GitAnswer =>
    of === undefined ? 'unknown' : negative(gitPredicate(root, ['merge-base', '--is-ancestor', sha, of]));

  return {
    limits,
    hasCommit(hash) {
      if (!inRepo) return 'unknown';
      return resolve(hash) !== undefined ? true : negative(false);
    },
    inHistory(hash) {
      const sha = inRepo ? resolve(hash) : undefined;
      if (sha === undefined) return 'unknown';
      const onHead = ancestor(sha, head);
      if (onHead === true) return true;
      const onMain = ancestor(sha, main);
      if (onMain === true) return true;
      return onHead === false && onMain === false ? false : 'unknown';
    },
    landedOnMain(branch) {
      if (!inRepo || main === undefined) return 'unknown';
      const tip = BRANCH_REFS.map((prefix) => resolve(`${prefix}${branch}`)).find((sha) => sha !== undefined);
      if (tip === undefined) return 'unknown';
      return ancestor(tip, main);
    },
  };
}

/** A commit hash as this repository writes them: seven to forty lowercase hex digits. */
const COMMIT_HASH = /^[0-9a-f]{7,40}$/;

/**
 * A sentence saying something has not landed.
 *
 * Deliberately narrow. "Not built" is a claim about the tree and the rules above already own
 * it; this is only about a branch's commits being on `main` or not.
 */
const UNLANDED = /\b(?:not\s+landed|unlanded|yet\s+to\s+land|not\s+been\s+merged|has\s+not\s+merged)\b/i;

/** A sentence claiming the work reached `main`. Read only on sentences `UNLANDED` did not claim. */
const LANDED = /\b(?:merged|landed)\b/i;

/** Names that are the target of a landing rather than a branch that landed. */
const NOT_A_BRANCH = new Set(['main', 'master', 'HEAD', 'origin']);

/** A backticked token that could be a ref. Git resolution is the real filter; this drops the obvious. */
function looksLikeBranch(token: string): boolean {
  if (NOT_A_BRANCH.has(token)) return false;
  if (COMMIT_HASH.test(token)) return false;
  if (/\.(?:ts|tsx|js|jsx|mjs|json|md|sql|yml|yaml)$/.test(token)) return false;
  return /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(token);
}

/** Every backticked token in a fragment. */
function backticked(text: string): string[] {
  return [...text.matchAll(/`([^`\n]+)`/g)].map((hit) => hit[1]!);
}

/**
 * Every table row in a markdown document, as one claim per cell after the first.
 *
 * Per cell rather than per row on purpose: a cell is one claim, and joining them would let a
 * branch name in the exit-criteria column be read as part of a sentence in the status column.
 * The first cell is the row's name and is what a failure message says instead of a line
 * number, which moves.
 */
function landingClaims(file: string, markdown: string): LandingClaim[] {
  const claims: LandingClaim[] = [];
  for (const line of markdown.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    const cells = trimmed.slice(1, trimmed.endsWith('|') ? -1 : undefined).split('|').map((cell) => cell.trim());
    if (cells.length < 2) continue;
    if (cells.every((cell) => /^:?-{2,}:?$/.test(cell))) continue;
    for (const cell of cells.slice(1)) {
      claims.push({ where: `\`${file}\` row "${cells[0]}"`, text: cell.replace(/\s+/g, ' ').trim() });
    }
  }
  return claims;
}

/**
 * Every reason a document's landing claims disagree with git, or with themselves.
 *
 * A list rather than inline assertions, and git as a parameter rather than a call, for the
 * reason the rest of this file gives: a rule that can only run against the one repository on
 * this disk cannot prove that a green result was earned. The refutations below run it against
 * repositories nobody has.
 */
function landingProblems(claims: readonly LandingClaim[], git: GitFacts): string[] {
  const problems: string[] = [];

  for (const { where, text } of claims) {
    const sentences = rowSentences(text);
    const unlanded = sentences.filter((sentence) => UNLANDED.test(sentence));
    const merged = sentences.filter((sentence) => !UNLANDED.test(sentence) && LANDED.test(sentence) && /`main`/.test(sentence));

    // 1. A merge claim names a commit, and the commit is real. The first two hold with no
    //    git at all; the last two go quiet rather than guess when git cannot answer.
    for (const sentence of merged) {
      const hashes = backticked(sentence).filter((token) => COMMIT_HASH.test(token));
      if (hashes.length === 0) {
        const named = backticked(sentence).filter((token) => token !== 'main');
        problems.push(
          named.length > 0
            ? `${where} claims a merge into \`main\` and names \`${named[0]}\`, which is not a commit hash`
            : `${where} claims a merge into \`main\` and names no commit, so nobody can check it`,
        );
        continue;
      }
      for (const hash of hashes) {
        if (git.hasCommit(hash) === false) {
          problems.push(`${where} names merge commit \`${hash}\`, which does not exist in this repository`);
          continue;
        }
        if (git.inHistory(hash) === false) {
          problems.push(`${where} names merge commit \`${hash}\`, which is in no history this checkout can reach`);
        }
      }
    }

    // 2. F243 itself. An unlanded claim about a branch whose commits are all on `main` is a
    //    sentence that has outlived its truth, and no amount of reading documents finds it.
    for (const sentence of unlanded) {
      for (const branch of backticked(sentence).filter(looksLikeBranch)) {
        if (git.landedOnMain(branch) === true) {
          problems.push(
            `${where} says \`${branch}\` has not landed, and every commit on it is already an ancestor of \`main\``,
          );
        }
      }
    }

    // 3. And the half-edit, which needs no git: one cell that says both.
    if (merged.length > 0 && unlanded.length > 0) {
      problems.push(
        `${where} says the work merged into \`main\` and also that it has not landed, so one of the two is stale`,
      );
    }
  }

  return problems;
}

/** A repository nobody has, so the rule can be refused as well as passed. */
function fixtureGit(world: {
  present?: readonly string[];
  absent?: readonly string[];
  inHistory?: readonly string[];
  outOfHistory?: readonly string[];
  landed?: readonly string[];
  unlanded?: readonly string[];
  limits?: readonly string[];
}): GitFacts {
  const answer = (yes: readonly string[] | undefined, no: readonly string[] | undefined, key: string): GitAnswer => {
    if (yes?.includes(key)) return true;
    if (no?.includes(key)) return false;
    return 'unknown';
  };
  return {
    limits: world.limits ?? [],
    hasCommit: (hash) => answer(world.present, world.absent, hash),
    inHistory: (hash) => answer(world.inHistory, world.outOfHistory, hash),
    landedOnMain: (branch) => answer(world.landed, world.unlanded, branch),
  };
}

/**
 * The Phase 6 status cell exactly as F243 found it, kept as a fixture rather than a memory.
 *
 * This is the sentence the rule was written against. It stays here so the refutation below
 * runs on the real defect and not on a paraphrase of it, and so that correcting the document
 * cannot quietly make the rule untested.
 */
const STALE_PHASE_SIX_ROW =
  'Slice 6a is built on `phase-6-retention` and has not landed: the passport, the delayed test and the '
  + 'less-help replay each have code and a named test, and F216 to F225 are closed.';

const EVIDENCE_PATH_F243 = path.join(ROOT, 'docs', 'IMPLEMENTATION_EVIDENCE.md');

describe('a landing claim is checked against git and not against the day it was written', () => {
  test('a roadmap row cannot call a branch unlanded once its work is on main', (t) => {
    const git = readGitFacts(ROOT);
    t.diagnostic(
      git.limits.length === 0
        ? 'git answered in full: hashes were checked for existence and branches for having landed'
        : `git could not be fully consulted here, so part of this rule went quiet: ${git.limits.join('; ')}`,
    );

    const claims = [
      ...landingClaims('docs/DELIVERY_ROADMAP.md', roadmap),
      ...landingClaims('docs/IMPLEMENTATION_EVIDENCE.md', readFileSync(EVIDENCE_PATH_F243, 'utf8')),
    ];

    // 1. The two documents as they stand.
    assert.deepEqual(
      landingProblems(claims, git),
      [],
      'a row claims something about landing that git does not support',
    );

    // 2. And the probe is not answering out of an empty document, which would make every
    //    claim below vacuous.
    assert.ok(
      claims.some((claim) => LANDED.test(claim.text) && /`main`/.test(claim.text)),
      'no row in either document claims a merge, so this rule read nothing',
    );

    // 3. The rule works here, on this machine, against commits this repository certainly has
    //    and a hash it certainly does not. Skipped rather than faked where git cannot answer,
    //    which is the whole design: on a shallow CI clone this is the line that must not run.
    if (git.limits.length === 0) {
      assert.equal(git.hasCommit('eee755c'), true, 'git could not find the commit this rule was written about');
      assert.equal(git.inHistory('eee755c'), true, 'the Phase 6 merge is not in the history this checkout carries');
      assert.equal(
        git.hasCommit('deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'),
        false,
        'a hash nobody ever wrote came back as present, so the existence probe proves nothing',
      );
    } else {
      t.diagnostic('the live git probe was skipped, so only the refutations below ran');
    }

    // ── the refutations ────────────────────────────────────────────────────────────────
    // Each runs against a repository this test invents, so none of them moves when the real
    // one does.

    // 4. F243 itself, on the sentence that caused it. Nothing about this cell reads as a
    //    claim about git to a person, and that is exactly why the rules above it stayed
    //    green while it was false.
    assert.deepEqual(
      landingProblems(
        [{ where: 'the Phase 6 row', text: STALE_PHASE_SIX_ROW }],
        fixtureGit({ landed: ['phase-6-retention'] }),
      ),
      ['the Phase 6 row says `phase-6-retention` has not landed, and every commit on it is already an ancestor of `main`'],
    );

    // 5. The same sentence while the branch really has not landed. A rule that refused this
    //    would be a rule about the calendar rather than about the truth.
    assert.deepEqual(
      landingProblems(
        [{ where: 'the Phase 6 row', text: STALE_PHASE_SIX_ROW }],
        fixtureGit({ unlanded: ['phase-6-retention'] }),
      ),
      [],
    );

    // 6. And the case that decides whether this rule is honest: git cannot answer. A shallow
    //    clone has no `main` and no branch refs, and silence there has to mean silence.
    assert.deepEqual(
      landingProblems([{ where: 'the Phase 6 row', text: STALE_PHASE_SIX_ROW }], fixtureGit({})),
      [],
    );

    // 7. A merge claim naming a hash that exists nowhere. This is the second property F243
    //    asked for, and the one that catches a hash typed from memory.
    assert.deepEqual(
      landingProblems(
        [{ where: 'a row', text: 'Built on `phase-9-x` and merged into `main` as `abc1234`' }],
        fixtureGit({ absent: ['abc1234'] }),
      ),
      ['a row names merge commit `abc1234`, which does not exist in this repository'],
    );

    // 8. A hash that exists but belongs to no history this checkout can reach — a commit on
    //    somebody's branch, written into the document as though it were a merge.
    assert.deepEqual(
      landingProblems(
        [{ where: 'a row', text: 'Built on `phase-9-x` and merged into `main` as `abc1234`' }],
        fixtureGit({ present: ['abc1234'], outOfHistory: ['abc1234'] }),
      ),
      ['a row names merge commit `abc1234`, which is in no history this checkout can reach'],
    );

    // 9. A merge claim with no commit at all, and one that names a branch where a hash
    //    belongs. Both hold with no git whatsoever, which is what keeps this rule alive on
    //    a CI runner that fetched one commit.
    assert.deepEqual(
      landingProblems([{ where: 'a row', text: 'Built and merged into `main` last week' }], fixtureGit({})),
      ['a row claims a merge into `main` and names no commit, so nobody can check it'],
    );
    assert.deepEqual(
      landingProblems([{ where: 'a row', text: 'Merged into `main` as `phase-9-x`' }], fixtureGit({})),
      ["a row claims a merge into `main` and names `phase-9-x`, which is not a commit hash"],
    );

    // 10. The half-edit: a merge sentence appended and the old one left standing. This is
    //     what F243 would have become if the row had been half corrected, and it needs no
    //     git either.
    assert.ok(
      landingProblems(
        [{
          where: 'a row',
          text: 'Slice 6a is built on `phase-6-retention` and merged into `main` as `eee755c`. Slice 6b has not landed.',
        }],
        fixtureGit({}),
      ).some((problem) => problem.includes('and also that it has not landed')),
      'a row was allowed to claim a merge and deny a landing in the same breath',
    );

    // 11. And the two ways this rule could quietly stop being a rule. `main` is the target of
    //     a landing and never a branch that landed, so an honest "has not landed on `main`"
    //     must not be read as main failing to land on itself. A file path is not a ref either.
    assert.deepEqual(
      landingProblems(
        [{ where: 'a row', text: 'Built on `phase-9-x` and has not landed on `main`' }],
        fixtureGit({ landed: ['main', 'phase-9-x'] }),
      ),
      ['a row says `phase-9-x` has not landed, and every commit on it is already an ancestor of `main`'],
    );
    assert.equal(looksLikeBranch('main'), false);
    assert.equal(looksLikeBranch('apps/mobile/src/theme.ts'), false);
    assert.equal(looksLikeBranch('eee755c'), false);
    assert.equal(looksLikeBranch('phase-6-retention'), true);
    assert.equal(looksLikeBranch('claude/forge-phases-status-c74034'), true);

    // 12. The cell splitter, so a claim in the exit-criteria column is never read as part of
    //     a sentence in the status column. Both are cells of the same row. The header row is
    //     read as well, and stays read: a column heading is a cell like any other, and the
    //     rule would rather judge one that says "merged into `main`" than skip it by position.
    const parsed = landingClaims('doc.md', '| Phase | Criteria | Status |\n|---|---|---|\n| 6. R | `a-branch` | merged into `main` as `eee755c` |\n');
    assert.deepEqual(
      parsed.map((claim) => claim.text),
      ['Criteria', 'Status', '`a-branch`', 'merged into `main` as `eee755c`'],
    );
    assert.deepEqual([...new Set(parsed.map((claim) => claim.where))], ['`doc.md` row "Phase"', '`doc.md` row "6. R"']);
  });
});
