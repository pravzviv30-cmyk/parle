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
    const overclaimed = phaseSixProblems(
      criteria,
      fixtureDefinitions('- **Honest reminders / story.** Built in 6a. It reminds people honestly.'),
      read,
      slice6b,
    );
    assert.ok(
      overclaimed.some((problem) => problem.includes('nothing in this repository implements it')),
      'the unbuilt noun was allowed to claim it shipped',
    );

    // 10. And the direction that will actually happen one day: 6b gets built and the
    //     document still says it did not. The tree moves here, not the sentence.
    assert.ok(
      phaseSixProblems(criteria, section, read, ['apps/mobile/package.json depends on expo-notifications']).some(
        (problem) => problem.includes('says it is not built'),
      ),
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
    const ledgerText = readFileSync(KNOWN_ISSUES_PATH, 'utf8');
    const entries = new Map(
      ledgerText.split(/\n(?=### )/).flatMap((block) => {
        const id = /^### (F\d+) — /.exec(block)?.[1];
        return id === undefined
          ? []
          : [[id, { severity: /^- severity: (P[012])/m.exec(block)?.[1] ?? 'P2', closed: /^- status: \[x\]/m.test(block) }] as const];
      }),
    );
    for (const id of PHASE_SIX_LEDGER) {
      assert.ok(entries.has(id), `${id} is gone from the ledger, so the Phase 6 row cannot be judged against it`);
    }

    const row = phaseRows(roadmap).find((candidate) => candidate.phase.startsWith('6.'));
    assert.ok(row, 'the roadmap has no row for phase 6');
    const status = row.status.replace(/\s+/g, ' ').trim();

    // 1. The claim tracks the ledger, in both directions. F225 is excluded from its own
    //    evidence for the reason F203 is: it is the entry that writes this row, so counting
    //    it would make the rule unsatisfiable. Phase 5 set that precedent above.
    const blocking = PHASE_SIX_LEDGER.filter(
      (id) => id !== 'F225' && entries.get(id)!.closed === false && entries.get(id)!.severity !== 'P2',
    );
    const claimsBuilt = /\b6a is built\b|\bslice 6a is built\b/i.test(status);
    if (blocking.length > 0) {
      assert.ok(!claimsBuilt, `the row says 6a is built while ${blocking.join(', ')} is still open`);
    } else {
      assert.ok(claimsBuilt, 'every Phase 6 P0 and P1 is closed and the row does not say slice 6a is built');
    }

    // 2. The half that is not built is named in the row itself, not only in a section
    //    further down that a table reader never reaches.
    assert.match(status, /6b/i, 'the status cell never mentions slice 6b, so a reader takes the phase for finished');
    assert.match(status, /is not built|not built at all/i, 'the row does not say that slice 6b is unbuilt');

    // 3. And nothing is claimed that nobody did. This branch has not landed and no part of
    //    it has been seen on a device.
    assert.doesNotMatch(status, /merged (?:in)?to `main`/i, 'the row claims a merge that has not happened');
    assert.doesNotMatch(status, /\brelease\b|\bshipped\b|ready to ship/i, 'the row reads as a release');
    assert.match(status, /device/i, 'the row does not say that none of this has been seen on a device');
  });
});
