/**
 * The evidence contract.
 *
 * Phase 1 built three harnesses whose own self-tests are green while the things they
 * verify are, in two cases out of three, entirely unverified. That is the design and it is
 * stated openly — but it leaves one way to be badly wrong: somebody reads `npm run gate`
 * coming back green and concludes that Supabase RLS was proven, or that the dependency
 * audit is still blocked, or that a failed room does not charge a learner.
 *
 * This file is what makes that misreading fail a test rather than reach a release.
 *
 * The rule it enforces is simple and mechanical. Every Phase 1 area carries exactly one of
 * three states in `docs/IMPLEMENTATION_EVIDENCE.md`:
 *
 *   `measured`                — a run happened, and the row carries its numbers
 *   `blocked-on:<thing>`      — a named external thing is missing, and nothing is claimed
 *   `accepted-with-evidence`  — known, not fixed, and the reasoning is written down
 *
 * Two states in one cell is not honesty, it is hedging, so it fails. A `measured` row with
 * no number in it is a claim, not a measurement, so it fails. A blocker that nobody
 * repeated in the outstanding list is a blocker nobody will ever unblock, so it fails.
 *
 * Written as a source walk, in the mould of `databaseContract.test.ts` and
 * `ciContract.test.ts`: the thing being defended is a document, so a document is what gets
 * read — and it is read against the code, so the counts in it cannot quietly rot.
 *
 * ## What F81 changed, and why it is the whole point of this file
 *
 * The first version of the Supabase guard below asserted that the F63 and F73 rows must
 * *never* say `measured`, and that the document must carry the literal string
 * "12 of 12 proofs skipped". That was true on the day it was written — there were no
 * credentials and no run — and it inverted the moment the twelve proofs ran and passed. A
 * test that pins a state rather than proving one turns an honest correction red, which is
 * exactly the defect this phase condemned at `databaseContract.test.ts:52`, where a regex
 * asserting the buggy `claim_trial` line verbatim held a P0 in place.
 *
 * So the guard survives and the pin does not. The rule is now: **a `measured` claim about
 * the database is refused unless a run is recorded, proof by proof, and accepted when one
 * is.** The proof ids come from `SUPABASE_PROOFS`, so a thirteenth proof makes the record
 * stale rather than making the document lucky. Where a document has to follow the ledger,
 * the tests below read the ledger and branch on it rather than hard-coding the answer, so
 * neither direction of the correction can ever be the one that fails.
 */

import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { ROOM_LIFECYCLE } from '../tokens.ts';
import { REQUIRED_ENV as SUPABASE_ENV, SUPABASE_PROOFS } from './supabaseLive.ts';
import { REQUIRED_ENV as UPSTASH_ENV, UPSTASH_CHECKS } from './upstashLive.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const EVIDENCE_PATH = path.join(ROOT, 'docs', 'IMPLEMENTATION_EVIDENCE.md');
const RISK_PATH = path.join(ROOT, 'docs', 'RISK_REGISTER.md');
const LEDGER_PATH = path.join(ROOT, 'docs', 'KNOWN_ISSUES.md');
const VOICE_HARNESS_PATH = path.join(ROOT, 'services', 'tutor-agent', 'src', 'verify', 'voiceLifecycle.ts');
const RUNBOOK_PATH = path.join(ROOT, 'supabase', 'README.md');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');
const FLOORS_PATH = path.join(ROOT, 'scripts', 'gate.floors.json');

const evidence = readFileSync(EVIDENCE_PATH, 'utf8');
const risk = readFileSync(RISK_PATH, 'utf8');
const ledger = readFileSync(LEDGER_PATH, 'utf8');
const runbook = readFileSync(RUNBOOK_PATH, 'utf8');

/**
 * Prose is checked against these, not against the raw text. Markdown wraps a sentence
 * wherever the column runs out, so an assertion on a phrase is really an assertion about
 * where somebody's editor broke the line unless the whitespace is flattened first.
 */
const evidenceFlat = evidence.replace(/\s+/g, ' ');
const riskFlat = risk.replace(/\s+/g, ' ');

/**
 * The phase is a fixed historical thing, so its ledger ids are written out rather than
 * inferred. Inferring them from a range or from "everything after F58" would mean the list
 * silently shrinks the moment somebody files F74, which is the exact failure this file
 * exists to prevent. A later phase gets its own section and its own literal list.
 */
const PHASE_ONE_LEDGER = [
  'F59',
  'F60',
  'F61',
  'F62',
  'F63',
  'F64',
  'F65',
  'F66',
  'F67',
  'F68',
  'F69',
  'F70',
  'F71',
  'F72',
  'F73',
] as const;

interface MatrixRow {
  area: string;
  ledger: string;
  state: string;
  evidence: string;
  notProven: string;
}

/** One `## heading` and everything under it, up to the next one. */
function section(markdown: string, heading: string): string {
  const start = markdown.indexOf(heading);
  assert.notEqual(start, -1, `IMPLEMENTATION_EVIDENCE.md has no "${heading}" section`);
  const rest = markdown.slice(start);
  const end = rest.indexOf('\n## ', 1);
  return end === -1 ? rest : rest.slice(0, end);
}

/** A five-column area table under `heading`, one row per area. */
function readRows(markdown: string, heading: string): MatrixRow[] {
  const body = section(markdown, heading);

  const rows: MatrixRow[] = [];
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    const cells = trimmed.slice(1, trimmed.endsWith('|') ? -1 : undefined).split('|').map((cell) => cell.trim());
    if (cells.length < 5) continue;
    if (/^-+$/.test(cells[0] ?? '')) continue; // the header rule
    if ((cells[1] ?? '').toLowerCase() === 'ledger') continue; // the header row
    rows.push({
      area: cells[0] ?? '',
      ledger: cells[1] ?? '',
      state: cells[2] ?? '',
      evidence: cells[3] ?? '',
      notProven: cells[4] ?? '',
    });
  }
  return rows;
}

/** The table under `## Phase 1 matrix`, one row per area. */
function readMatrix(markdown: string): MatrixRow[] {
  return readRows(markdown, '## Phase 1 matrix');
}

/**
 * The defects Phase 1 found *after* its plan was written. They are not in
 * `PHASE_ONE_LEDGER` on purpose — that list is the phase as designed, and rewriting it
 * every time a run turns something up is how a fixed historical record stops being one.
 * They still have to carry a state, so they get their own table and the same rules.
 */
function readFindings(markdown: string): MatrixRow[] {
  return readRows(markdown, '## Found and fixed during Phase 1');
}

const MEASURED = /^`measured`$/;
const ACCEPTED = /^`accepted-with-evidence`$/;
const BLOCKED = /^`blocked-on:([a-z0-9][a-z0-9-]*|[A-Z][A-Z0-9_]*)`$/;

type Verdict = { kind: 'measured' } | { kind: 'accepted' } | { kind: 'blocked'; blocker: string };

/** Exactly one state, or an explanation of why the cell is not one. */
function classify(cell: string): { verdict?: Verdict; problem?: string } {
  const words = ['measured', 'accepted-with-evidence', 'blocked-on'].filter((word) => cell.includes(word));
  // `blocked-on:...` contains no other state word, so more than one match is a hedge.
  if (words.length > 1) return { problem: `carries ${words.length} states at once: ${cell}` };
  if (MEASURED.test(cell)) return { verdict: { kind: 'measured' } };
  if (ACCEPTED.test(cell)) return { verdict: { kind: 'accepted' } };
  const blocked = BLOCKED.exec(cell);
  if (blocked) return { verdict: { kind: 'blocked', blocker: blocked[1]! } };
  return { problem: `is not one of \`measured\`, \`blocked-on:<thing>\` or \`accepted-with-evidence\`: ${cell}` };
}

/** The rows of the credential-state table, where a false "verified" would do most harm. */
function credentialTable(markdown: string): string[] {
  const start = markdown.indexOf('## Credential state');
  assert.notEqual(start, -1, 'IMPLEMENTATION_EVIDENCE.md has no "## Credential state" section');
  const rest = markdown.slice(start);
  const end = rest.indexOf('\n## ', 1);
  return (end === -1 ? rest : rest.slice(0, end)).split('\n').filter((line) => line.trim().startsWith('|'));
}

/** The "What is still outstanding" section, where every blocker has to reappear. */
function outstandingSection(markdown: string): string {
  const start = markdown.indexOf('## What is still outstanding');
  assert.notEqual(start, -1, 'IMPLEMENTATION_EVIDENCE.md has no "## What is still outstanding" section');
  return markdown.slice(start);
}

// ─────────────────────────────────────────────────────── the database claim rule (F81)

/**
 * The two areas whose only honest proof is a live database. Written out for the same
 * reason as `PHASE_ONE_LEDGER`: which areas need a database is a fact about the phase,
 * not something to infer from the document being checked.
 */
const SUPABASE_DEPENDENT_AREAS = ['F63', 'F73'] as const;

/**
 * The `## Supabase run record` table: proof id to outcome. `undefined` means no run has
 * been recorded at all, which is a different thing from a run that recorded failures.
 */
function supabaseRunRecord(markdown: string): Map<string, string> | undefined {
  const start = markdown.indexOf('## Supabase run record');
  if (start === -1) return undefined;
  const rest = markdown.slice(start);
  const end = rest.indexOf('\n## ', 1);
  const body = end === -1 ? rest : rest.slice(0, end);

  const outcomes = new Map<string, string>();
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    const cells = trimmed.slice(1, trimmed.endsWith('|') ? -1 : undefined).split('|').map((cell) => cell.trim());
    if (cells.length < 2) continue;
    const id = (cells[0] ?? '').replace(/`/g, '');
    // Skips the header row and the header rule without needing to know their text: a
    // proof id is lower-case and hyphenated, and neither of those lines is.
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) continue;
    outcomes.set(id, (cells[1] ?? '').toLowerCase());
  }
  return outcomes;
}

/**
 * Every reason this document is not allowed to make the database claims it makes.
 *
 * The shape matters more than the checks. A row that says `blocked` or
 * `accepted-with-evidence` claims nothing about a database, so there is nothing here to
 * refuse — the rule only ever looks at `measured`. And a `measured` row is judged against
 * a recorded run, proof by proof, against the ids the harness itself declares. That is
 * what makes it possible to correct this document in *either* direction without a test
 * having to be edited to allow the truth.
 */
function supabaseClaimProblems(markdown: string): string[] {
  const problems: string[] = [];
  const rows = readMatrix(markdown);
  const record = supabaseRunRecord(markdown);

  for (const id of SUPABASE_DEPENDENT_AREAS) {
    const row = rows.find((candidate) => candidate.ledger === id);
    if (!row) {
      problems.push(`${id} is missing from the Phase 1 matrix`);
      continue;
    }
    if (classify(row.state).verdict?.kind !== 'measured') continue;

    if (!record) {
      problems.push(`${id} says measured while the document records no Supabase run at all`);
      continue;
    }
    for (const proof of SUPABASE_PROOFS) {
      const outcome = record.get(proof.id);
      if (outcome === undefined) {
        problems.push(`${id} says measured but no run has recorded ${proof.id}`);
      } else if (!/^passed\b/.test(outcome)) {
        problems.push(`${id} says measured but ${proof.id} is recorded as "${outcome}"`);
      }
    }
  }
  return problems;
}

/**
 * A minimal document the rule can be run against, so the rule is proven on inputs it
 * controls rather than only on the one file that happens to be on disk today.
 * `record: null` means the run-record section is absent entirely.
 */
function fixtureEvidence(state: string, record: readonly (readonly [string, string])[] | null): string {
  const lines = [
    '## Phase 1 matrix',
    '',
    '| Area | Ledger | State | Evidence: the run and its numbers | Not proven by that run |',
    '|---|---|---|---|---|',
    `| Supabase RLS and the money functions | F63 | ${state} | a run of 12 proofs | the production project |`,
    `| The trial claim | F73 | ${state} | trial-refused-second-installation | the production project |`,
    '',
  ];
  if (record) {
    lines.push('## Supabase run record', '', '| Proof | Outcome | What it showed |', '|---|---|---|');
    for (const [id, outcome] of record) lines.push(`| \`${id}\` | ${outcome} | one line of detail |`);
    lines.push('');
  }
  return lines.join('\n');
}

// ───────────────────────────────────────────────────────────────────── the ledger (F82)

interface LedgerEntry {
  id: string;
  title: string;
  severity: string;
  done: boolean;
  body: string;
}

/** `docs/KNOWN_ISSUES.md`, parsed the way `scripts/gate.mjs` parses it. */
function readLedger(markdown: string): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  for (const part of markdown.split(/^### /m).slice(1)) {
    const heading = /^(F\d+) — (.*)$/m.exec(part);
    if (!heading) continue;
    entries.push({
      id: heading[1]!,
      title: heading[2]!.trim(),
      severity: /^-\s*severity:\s*(P\d)/m.exec(part)?.[1] ?? '',
      done: /^-\s*status:\s*\[x\]/m.test(part),
      body: part,
    });
  }
  return entries;
}

/**
 * Ticked schema entries whose own note says the proof happened against a live database.
 *
 * Scoped by `where:` rather than by the words alone, because entries that *discuss* a
 * live proof — this file's own F81 and F82, for two — quote the phrase without being one.
 * A ledger entry that points into `supabase/` and says its defect was proven live is the
 * only shape that means "a database answered".
 */
function provenLiveEntries(markdown: string): LedgerEntry[] {
  return readLedger(markdown).filter((entry) => {
    if (!entry.done) return false;
    const where = /^-\s*where:\s*(\S+)/m.exec(entry.body)?.[1] ?? '';
    if (!where.startsWith('supabase/')) return false;
    return /proven live/i.test(entry.body);
  });
}

describe('the evidence matrix is honest about what Phase 1 actually proved', () => {
  test('the evidence matrix names a measured or blocked status for every phase one area', () => {
    const rows = readMatrix(evidence);
    const outstanding = outstandingSection(evidence);

    // 1. Every area of the phase is present, exactly once, and is a real ledger entry.
    for (const id of PHASE_ONE_LEDGER) {
      assert.ok(
        new RegExp(`^### ${id} — `, 'm').test(ledger),
        `${id} is in the Phase 1 list but no longer exists in docs/KNOWN_ISSUES.md`,
      );
      const matching = rows.filter((row) => row.ledger === id);
      assert.equal(matching.length, 1, `${id} has ${matching.length} rows in the Phase 1 matrix, expected exactly 1`);
    }
    for (const row of rows) {
      assert.ok(
        (PHASE_ONE_LEDGER as readonly string[]).includes(row.ledger),
        `the Phase 1 matrix cites ${row.ledger || '(nothing)'}, which is not a Phase 1 ledger entry`,
      );
    }

    // 2. Exactly one of the three states, per row, with no hedging.
    for (const row of rows) {
      const { verdict, problem } = classify(row.state);
      assert.ok(verdict, `${row.ledger} ${problem}`);

      // 3. A state has to be backed by the kind of thing it claims.
      if (verdict.kind === 'measured') {
        assert.ok(
          /\d/.test(row.evidence),
          `${row.ledger} says measured but its evidence carries no number, so nothing was measured`,
        );
        assert.ok(
          row.notProven.length > 12,
          `${row.ledger} says measured without saying what that run did not prove`,
        );
      }
      if (verdict.kind === 'blocked') {
        assert.ok(
          outstanding.includes(verdict.blocker),
          `${row.ledger} is blocked on "${verdict.blocker}", which nobody repeated in "What is still outstanding"`,
        );
      }
      if (verdict.kind === 'accepted') {
        assert.ok(
          row.evidence.length > 40,
          `${row.ledger} is accepted with evidence but carries no evidence`,
        );
      }
    }

    // 4. The phase measured something and is blocked on something. A matrix that is all
    //    one state is a matrix nobody looked at.
    const kinds = rows.map((row) => classify(row.state).verdict?.kind);
    assert.ok(kinds.includes('measured'), 'nothing in Phase 1 is recorded as measured');
    assert.ok(kinds.includes('blocked'), 'nothing in Phase 1 is recorded as blocked, which cannot be true');
  });

  test('a green gate cannot be read as a verified database', () => {
    const rows = readMatrix(evidence);

    // The state of the two database-dependent areas is no longer pinned here — see the
    // header, and the two tests below it. What survives is everything the pin was really
    // protecting: no claim beyond what ran, and no word in a claim cell that lets a reader
    // upgrade a disposable project into a verified one.
    assert.deepEqual(
      supabaseClaimProblems(evidence),
      [],
      'the document makes a database claim no recorded run supports',
    );

    // The ban on the words is scoped to where claims are actually made — the matrix cells
    // and the credential table — rather than to the whole document. Prose that warns
    // against a misreading has to be able to name the misreading, and a whole-file ban
    // would forbid the warning along with the error.
    const claimCells = [
      ...rows.flatMap((row) => [row.area, row.state, row.evidence, row.notProven]),
      ...readFindings(evidence).flatMap((row) => [row.area, row.state, row.evidence, row.notProven]),
      ...credentialTable(evidence),
    ];
    for (const claim of [/RLS (?:is )?verified/i, /RLS (?:proofs? )?passed/i, /Supabase (?:is )?verified/i]) {
      const offender = claimCells.find((cell) => claim.test(cell));
      assert.equal(offender, undefined, `a Phase 1 claim matches ${claim}: ${offender}`);
    }

    // And the document has to say the thing out loud, once, in its own voice — both halves
    // of it. The first sentence was the warning that mattered when the project was empty.
    // The second is the one that matters now the twelve proofs have run somewhere: the
    // somewhere was a throwaway project, and no production database has answered anything.
    assert.ok(
      evidenceFlat.includes('Supabase authenticating is not Supabase verified'),
      'the document never says plainly that an authenticating project is not a verified one',
    );
    assert.ok(
      evidenceFlat.includes('A disposable project proven is not a production project proven'),
      'the document never says plainly that a disposable project is not the one that ships',
    );
    assert.ok(
      /disposable project/i.test(evidence),
      'the document does not name the kind of project the Supabase proofs ran against',
    );

    // The proof counts are read off the harnesses, so adding a proof makes the doc stale.
    // The count itself comes from the recorded run rather than from a literal, so this
    // checks the document against itself and against the code, and pins no outcome.
    const record = supabaseRunRecord(evidence);
    const passed = record
      ? SUPABASE_PROOFS.filter((proof) => /^passed\b/.test(record.get(proof.id) ?? '')).length
      : 0;
    assert.ok(
      evidence.includes(`${passed} of ${SUPABASE_PROOFS.length} proofs`),
      `the run record says ${passed} of ${SUPABASE_PROOFS.length} proofs passed, and no summary line says so`,
    );
    assert.ok(
      evidence.includes(`${UPSTASH_CHECKS.length} of ${UPSTASH_CHECKS.length} proofs`),
      `the document does not record the Upstash run as ${UPSTASH_CHECKS.length} of ${UPSTASH_CHECKS.length}`,
    );
    const voiceSource = readFileSync(VOICE_HARNESS_PATH, 'utf8');
    const voiceChecks = voiceSource.slice(voiceSource.indexOf('LIFECYCLE_CHECKS'));
    const voiceCount = (voiceChecks.slice(0, voiceChecks.indexOf('] as const')).match(/^\s{4}id: '/gm) ?? []).length;
    assert.ok(voiceCount > 0, 'could not count the voice lifecycle checks');
    assert.ok(
      evidence.includes(`${voiceCount} checks`),
      `the document does not record the voice run as ${voiceCount} checks`,
    );
  });

  test("the evidence contract accepts a measured supabase row that carries the live run's numbers", () => {
    const complete = SUPABASE_PROOFS.map((proof) => [proof.id, 'passed'] as const);

    // 1. The rule itself, on an input this test controls. A measured row backed by a
    //    complete run is legitimate, and the contract has to say so out loud — otherwise
    //    the only way to write down a real result is to make the gate red.
    assert.deepEqual(
      supabaseClaimProblems(fixtureEvidence('`measured`', complete)),
      [],
      'a measured row with all twelve proofs recorded as passed was still refused',
    );

    // 2. Extra detail in the outcome cell is fine. "passed (three attempts, one granted)"
    //    is a better record than "passed", and a rule that punished it would push the
    //    numbers out of the document, which is the opposite of the point.
    assert.deepEqual(
      supabaseClaimProblems(
        fixtureEvidence('`measured`', SUPABASE_PROOFS.map((proof) => [proof.id, `passed — ${proof.id} detail`] as const)),
      ),
      [],
      'a measured row was refused for recording more than the bare word "passed"',
    );

    // 3. And on the document as it actually stands. If it claims a measured database
    //    today, that claim is backed proof by proof by the ids the harness declares.
    assert.deepEqual(supabaseClaimProblems(evidence), [], 'the live document makes an unsupported database claim');

    const record = supabaseRunRecord(evidence);
    if (record) {
      // A record may not invent a proof to reach twelve, and may not quietly rename one.
      const declared = new Set<string>(SUPABASE_PROOFS.map((proof) => proof.id));
      for (const id of record.keys()) {
        assert.ok(declared.has(id), `the Supabase run record names "${id}", which no harness proof declares`);
      }
      // Every recorded proof carries an outcome word, not an empty cell.
      for (const [id, outcome] of record) {
        assert.ok(outcome.length > 0, `the Supabase run record gives ${id} no outcome`);
      }
    }
  });

  test('the evidence contract still refuses a measured claim for a proof no run has recorded', () => {
    const complete = SUPABASE_PROOFS.map((proof) => [proof.id, 'passed'] as const);

    // 1. Measured with no run recorded anywhere. This is the state Phase 1 started in,
    //    and it is the misreading the original guard existed to make impossible.
    const noRun = supabaseClaimProblems(fixtureEvidence('`measured`', null));
    assert.equal(noRun.length, SUPABASE_DEPENDENT_AREAS.length, `expected one problem per area, got: ${noRun}`);
    for (const problem of noRun) assert.match(problem, /records no Supabase run at all/);

    // 2. Measured with a run that recorded nothing. A section header is not a run.
    const emptyRun = supabaseClaimProblems(fixtureEvidence('`measured`', []));
    assert.equal(emptyRun.length, SUPABASE_DEPENDENT_AREAS.length * SUPABASE_PROOFS.length);

    // 3. Measured with eleven of twelve. One missing proof is the whole failure mode: a
    //    document that reads as a clean sweep because nobody counted.
    const missing = complete.filter(([id]) => id !== 'deletion-cascade');
    const short = supabaseClaimProblems(fixtureEvidence('`measured`', missing));
    assert.equal(short.length, SUPABASE_DEPENDENT_AREAS.length, `expected one problem per area, got: ${short}`);
    for (const problem of short) assert.match(problem, /no run has recorded deletion-cascade/);

    // 4. Measured with a proof recorded as skipped, or failed. Recording an outcome is
    //    not the same as recording a pass.
    for (const outcome of ['skipped', 'failed', 'not run']) {
      const flipped = complete.map(([id, was]) => [id, id === 'trial-race' ? outcome : was] as const);
      const problems = supabaseClaimProblems(fixtureEvidence('`measured`', flipped));
      assert.equal(problems.length, SUPABASE_DEPENDENT_AREAS.length, `"${outcome}" was accepted as a pass`);
      for (const problem of problems) assert.match(problem, new RegExp(`trial-race is recorded as "${outcome}"`));
    }

    // 5. The rule refuses *claims*, not documents. A blocked row with no run is exactly
    //    what an honest phase looks like before the credentials arrive, and it passes.
    assert.deepEqual(supabaseClaimProblems(fixtureEvidence('`blocked-on:supabase-schema-not-applied`', null)), []);
    assert.deepEqual(supabaseClaimProblems(fixtureEvidence('`accepted-with-evidence`', null)), []);

    // 6. And the same refutation against the real file rather than a fixture. Force the
    //    F63 row to measured, delete the run record, and the rule has to turn red — which
    //    is what proves this document's own green result in the test above is earned.
    const forced = evidence.replace(/\| F63 \| `[^`]+` \|/, '| F63 | `measured` |');
    assert.equal(
      readMatrix(forced).find((row) => row.ledger === 'F63')?.state,
      '`measured`',
      'the mutation did not land: the F63 row is not shaped the way this test expects',
    );
    const stripped = forced.replace(/\n## Supabase run record[\s\S]*?(?=\n## )/, '\n');
    assert.equal(supabaseRunRecord(stripped), undefined, 'the mutation did not remove the run record');
    assert.ok(
      supabaseClaimProblems(stripped).some((problem) => problem.startsWith('F63 ')),
      'deleting the run record from the real document left its measured claim standing',
    );
  });

  test('the evidence matrix does not call blocked what the ledger has ticked as proven live', () => {
    // The ledger is the source of truth and this document follows it, so the rule reads
    // the ledger and branches. Neither direction is hard-coded, which means correcting
    // either document can never be the thing that turns this red.
    const provenLive = provenLiveEntries(ledger);
    const rows = [...readMatrix(evidence), ...readFindings(evidence)];
    const supabaseBlocked = rows.filter((row) => {
      const { verdict } = classify(row.state);
      return verdict?.kind === 'blocked' && /supabase|schema/i.test(verdict.blocker);
    });

    if (provenLive.length === 0) {
      // Nothing has run. Every database-dependent area must still say so.
      for (const id of SUPABASE_DEPENDENT_AREAS) {
        const row = rows.find((candidate) => candidate.ledger === id);
        assert.ok(row, `${id} is missing from the evidence document`);
        assert.equal(
          classify(row.state).verdict?.kind,
          'blocked',
          `${id} claims "${row.state}" while no ledger entry records a live database proof`,
        );
      }
      return;
    }

    const named = provenLive.map((entry) => entry.id).join(', ');
    assert.deepEqual(
      supabaseBlocked.map((row) => `${row.ledger}: ${row.state}`),
      [],
      `the ledger records ${named} as proven live against a database, so no area is blocked on a Supabase schema any more`,
    );

    // A defect the ledger proved live has to be findable in both documents by its id, or
    // the correction is invisible to the person the documents exist for.
    for (const entry of provenLive) {
      assert.ok(evidence.includes(entry.id), `${entry.id} is proven live in the ledger and named nowhere in the evidence document`);
      assert.ok(risk.includes(entry.id), `${entry.id} is proven live in the ledger and named nowhere in the risk register`);
      const row = rows.find((candidate) => candidate.ledger === entry.id);
      assert.ok(row, `${entry.id} is proven live in the ledger and has no row in either evidence table`);
      assert.equal(
        classify(row.state).verdict?.kind,
        'measured',
        `${entry.id} is proven live in the ledger but its row says "${row.state}"`,
      );
    }

    // And the register may not carry the same stale blocker in its own column.
    const staleRegisterRows = risk
      .split('\n')
      .filter((line) => line.trim().startsWith('|') && /blocked:\s*`?supabase-/i.test(line));
    assert.deepEqual(staleRegisterRows, [], `the risk register still blocks a row on a Supabase schema the ledger proved live (${named})`);
  });

  test('the outstanding schema instruction names every migration in the runbook', () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith('.sql')).sort();
    assert.ok(files.length > 0, 'supabase/migrations holds no migrations');
    const ids = files.map((name) => name.slice(0, name.indexOf('_')));
    const outstanding = outstandingSection(evidence);

    // 1. The runbook is the authority on apply order, so it has to know about every file
    //    on disk, and may not name one that does not exist.
    for (const file of files) {
      assert.ok(runbook.includes(file), `supabase/README.md never names ${file}, so an operator cannot apply it`);
    }
    for (const named of new Set(runbook.match(/\b20\d{10}\b/g) ?? [])) {
      assert.ok(ids.includes(named), `supabase/README.md names migration ${named}, which is not in supabase/migrations`);
    }

    // 2. The instruction an operator actually follows names every one of them. This is
    //    the check that matters: the version of this document that said "apply three"
    //    would have deployed the two money defects this phase found and fixed.
    for (const id of ids) {
      assert.ok(
        outstanding.includes(id),
        `"What is still outstanding" tells an operator to apply the schema but never names ${id}`,
      );
    }

    // 3. In the runbook's order, because order is load-bearing and a list nobody sorted
    //    is a list somebody will paste out of order.
    const positions = ids.map((id) => outstanding.indexOf(id));
    assert.deepEqual(
      positions,
      [...positions].sort((a, b) => a - b),
      'the outstanding instruction lists the migrations out of order',
    );

    // 4. And no prose in either document may count them wrong. "Apply the three
    //    migrations" was false and readable and cost nothing to write, which is exactly
    //    the kind of sentence a person follows.
    const words = new Map([
      ['one', 1], ['two', 2], ['three', 3], ['four', 4], ['five', 5],
      ['six', 6], ['seven', 7], ['eight', 8], ['nine', 9], ['ten', 10],
    ]);
    const documents: [string, string][] = [
      ['docs/IMPLEMENTATION_EVIDENCE.md', evidence],
      ['docs/RISK_REGISTER.md', risk],
      ['supabase/README.md', runbook],
    ];
    for (const [name, text] of documents) {
      for (const match of text.matchAll(/\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+migrations\b/gi)) {
        const counted = words.get(match[1]!.toLowerCase()) ?? Number(match[1]);
        assert.equal(
          counted,
          ids.length,
          `${name} says "${match[0]}" while supabase/migrations holds ${ids.length}`,
        );
      }
    }
  });

  test('every defect found after the plan carries a state of its own', () => {
    const findings = readFindings(evidence);
    const outstanding = outstandingSection(evidence);
    assert.ok(findings.length > 0, 'no defect is recorded as found during Phase 1, which cannot be true');

    for (const row of findings) {
      assert.ok(
        new RegExp(`^### ${row.ledger} — `, 'm').test(ledger),
        `the findings table cites ${row.ledger || '(nothing)'}, which is not in docs/KNOWN_ISSUES.md`,
      );
      assert.ok(
        !(PHASE_ONE_LEDGER as readonly string[]).includes(row.ledger),
        `${row.ledger} is in the Phase 1 matrix already; it cannot also be a finding made after the plan`,
      );

      // The same three states, judged the same way. A finding is not a lesser record.
      const { verdict, problem } = classify(row.state);
      assert.ok(verdict, `${row.ledger} ${problem}`);
      if (verdict.kind === 'measured') {
        assert.ok(/\d/.test(row.evidence), `${row.ledger} says measured but its evidence carries no number`);
        assert.ok(row.notProven.length > 12, `${row.ledger} says measured without saying what that run did not prove`);
      }
      if (verdict.kind === 'blocked') {
        assert.ok(
          outstanding.includes(verdict.blocker),
          `${row.ledger} is blocked on "${verdict.blocker}", which nobody repeated in "What is still outstanding"`,
        );
      }
      if (verdict.kind === 'accepted') {
        assert.ok(row.evidence.length > 40, `${row.ledger} is accepted with evidence but carries no evidence`);
      }
    }

    // An open entry may not be written up as finished. This is the failure mode of every
    // document that lags its ledger, and it is one line to check.
    const entries = new Map(readLedger(ledger).map((entry) => [entry.id, entry]));
    for (const row of findings) {
      const entry = entries.get(row.ledger);
      assert.ok(entry, `${row.ledger} is not in the ledger`);
      if (!entry.done) {
        assert.notEqual(
          classify(row.state).verdict?.kind,
          'measured',
          `${row.ledger} is still open in the ledger and the findings table calls it measured`,
        );
      }
    }
  });

  test('the stale audit and baseline claims are gone from the evidence document', () => {
    // The audit reaches the registry. It was never blocked, and saying it was hid four
    // real advisory roots behind a permission request nobody needed to grant.
    assert.ok(
      !/Blocked by external registry access/i.test(evidence),
      'the document still claims the dependency audit is blocked by registry access',
    );
    assert.ok(
      !/audit access|registry audit access/i.test(evidence.slice(evidence.indexOf('## What is still outstanding'))),
      'the outstanding list still asks for audit access that is not needed',
    );
    const auditRow = readMatrix(evidence).find((row) => row.ledger === 'F69');
    assert.ok(auditRow, 'F69 is missing from the Phase 1 matrix');
    assert.equal(classify(auditRow.state).verdict?.kind, 'accepted');
    for (const root of ['image-size', 'adm-zip', 'uuid', '@expo/metro']) {
      assert.ok(auditRow.evidence.includes(root), `the F69 row does not name the advisory root ${root}`);
    }

    // The tree was clean and the gate was 1,495. The old numbers described a different day.
    assert.ok(!evidence.includes('1,437'), 'the document still quotes the stale 1,437-test baseline');
    // Same lookbehind reason as above: the document is meant to say there was no such
    // worktree, and a bare word ban would forbid the correction along with the error.
    assert.ok(
      !/(?<!no )(?<!not )inherited dirty worktree/i.test(evidence),
      'the document still describes an inherited dirty worktree; the tree was clean at 7d99fb6',
    );
    assert.ok(
      /clean when Phase 1 started|tree was clean/i.test(evidence) && evidence.includes('7d99fb6'),
      'the document does not record that the tree was clean at 7d99fb6',
    );

    // Every gate this document quotes has to add up. The totals are found rather than
    // listed: pinning "1,557" here is how the document came to carry a mid-phase number
    // in three places while the gate said something else, so the rule is now the
    // arithmetic and not the value. Floors are monotonic, though, and historical runs
    // are supposed to fall below today's floor. Only the newest (largest) recorded gate
    // has to defend the current floor; rewriting old measurements would destroy evidence.
    const floors: Record<string, number> = JSON.parse(readFileSync(FLOORS_PATH, 'utf8'));
    const workspaceOf: Record<string, string> = {
      core: '@parle/core',
      brain: '@parle/brain',
      'tutor agent': '@parle/tutor-agent',
      'token server': '@parle/token-server',
      playground: '@parle/brain-playground',
      mobile: '@parle/mobile',
    };
    const claims = [...evidence.matchAll(/\*\*([\d,]+) tests/g)];
    assert.ok(claims.length >= 2, 'the document records fewer than two gate runs, so nothing can be compared');
    const runs: { label: string; total: number; counts: Map<string, number> }[] = [];
    for (const claim of claims) {
      const label = claim[1]!;
      // Bounded to the bullet it lives in, or the next bullet's six numbers join in
      // and the sum stops meaning anything.
      const rest = evidence.slice(claim.index!);
      const stop = rest.indexOf('\n- ', 1);
      // Whitespace-normalised, because markdown wraps "tutor agent 338" across two lines.
      const window = (stop === -1 ? rest.slice(0, 260) : rest.slice(0, stop)).replace(/\s+/g, ' ');
      const parts = [...window.matchAll(/(core|brain|tutor agent|token server|playground|mobile) (\d{2,4})/g)];
      assert.equal(parts.length, 6, `the ${label} gate does not name all six workspaces`);
      const total = parts.reduce((sum, part) => sum + Number(part[2]), 0);
      assert.equal(total, Number(label.replace(/,/g, '')), `the ${label} gate's six workspace counts do not sum to ${label}`);
      runs.push({ label, total, counts: new Map(parts.map((part) => [part[1]!, Number(part[2])])) });
    }
    const newest = runs.reduce((largest, run) => (run.total > largest.total ? run : largest));
    for (const [name, workspace] of Object.entries(workspaceOf)) {
      const floor = floors[workspace];
      assert.ok(floor !== undefined, `no floor is recorded for ${name}`);
      const count = newest.counts.get(name);
      assert.ok(count !== undefined, `the ${newest.label} gate does not record ${name}`);
      assert.ok(
        count >= floor,
        `the newest ${newest.label} gate records ${name} at ${count}, below its current floor of ${floor}`,
      );
    }
    assert.ok(evidence.includes('1,495'), 'the document no longer records the 1,495-test pre-phase baseline');
  });

  test('every blocker names an environment value the harnesses really need or an external thing', () => {
    const known = new Set<string>([...SUPABASE_ENV, ...UPSTASH_ENV]);
    const rows = readMatrix(evidence);
    const blockers = rows
      .map((row) => classify(row.state).verdict)
      .filter((verdict): verdict is { kind: 'blocked'; blocker: string } => verdict?.kind === 'blocked')
      .map((verdict) => verdict.blocker);

    assert.ok(blockers.length > 0, 'no area is blocked, which would mean the phase closed everything');
    for (const blocker of blockers) {
      if (/^[A-Z][A-Z0-9_]*$/.test(blocker)) {
        assert.ok(
          known.has(blocker),
          `${blocker} is written as an environment value but no harness declares it in REQUIRED_ENV`,
        );
      } else {
        assert.ok(
          /^[a-z0-9]+(-[a-z0-9]+)+$/.test(blocker),
          `"${blocker}" is neither an environment value nor a hyphenated external thing`,
        );
      }
    }
    assert.equal(new Set(blockers).size <= blockers.length, true);
  });

  test('the vendor cost record carries the seconds and the dollars from the live voice run', () => {
    const start = evidence.indexOf('## Vendor cost record');
    assert.notEqual(start, -1, 'the document has no vendor cost record');
    const section = evidence.slice(start, evidence.indexOf('\n## ', start + 1)).replace(/\s+/g, ' ');

    assert.ok(/tutor-attended room seconds:\s+\d+(\.\d+)?s/.test(section), 'no tutor-attended second count');
    assert.ok(/estimated vendor spend:\s+\$\d+\.\d+/.test(section), 'no estimated spend');
    assert.ok(/wall clock:\s+\d+(\.\d+)?s/.test(section), 'no wall clock for the run');
    assert.ok(/per tutor-attended minute/.test(section), 'the record gives a total but never a rate');
    // "ceiling" also appears in the harness's own output line, so matching the word alone
    // survives a rewrite that turns the record into a bill. The disclaimer is the promise.
    assert.ok(
      section.includes('Read it as a ceiling, not a bill.'),
      'the record does not say in its own voice that it is a ceiling and not a bill',
    );
    assert.ok(
      /upper bound/.test(section),
      'the record no longer describes the estimate as an upper bound',
    );
  });

  test('the risk register records the trial farming P0 as realised rather than theoretical', () => {
    assert.ok(risk.includes('claim_trial'), 'the risk register never names claim_trial');
    assert.ok(
      /202608240001/.test(risk),
      'the risk register does not name the forward migration that fixes the trial claim',
    );
    const trialRow = risk
      .split('\n')
      .find((line) => line.trim().startsWith('|') && /Trial farming/i.test(line));
    assert.ok(trialRow, 'the risk register has no trial farming row');
    assert.ok(
      /realised|measured|live/i.test(trialRow),
      'the trial farming row still reads as though the risk were hypothetical',
    );
    // The prose has to carry why it was missed, or the next text-only assertion repeats it.
    assert.ok(
      /asserted the buggy line verbatim|pinned the defect/i.test(risk),
      'the risk register does not record that the only test pinned the defect rather than catching it',
    );
    // The register may not let a disposable project stand in for the one that ships. This
    // replaces a pin on "has not been applied", which was true mid-phase and false the
    // moment the migrations went on to a real project — the same inversion as F81.
    assert.ok(
      /no production project|not a production project/i.test(riskFlat),
      'the risk register does not say that nothing here has been applied to a production project',
    );

    // The register may not claim a control it does not have, and may not go on denying one
    // it has. Which of those applies is the ledger's call, not this test's, so it reads
    // F76 and follows it either way.
    const failedRoom = risk.split('\n').find((line) => /failed room charges the learner/i.test(line));
    assert.ok(failedRoom, 'the risk register has no row for a failed room charging the learner');
    const billingFix = readLedger(ledger).find((entry) => entry.id === 'F76');
    assert.ok(billingFix, 'F76 is not in docs/KNOWN_ISSUES.md');
    if (billingFix.done) {
      assert.ok(
        !/none that holds/i.test(failedRoom),
        'F76 is ticked in the ledger and the failed-room row still says no control holds',
      );
      assert.ok(
        /learnerTurns/.test(failedRoom),
        'the failed-room row does not name the counter the fix bills off, so nobody can check it',
      );
      assert.ok(
        /measured/i.test(failedRoom) && /\d/.test(failedRoom),
        'the failed-room row claims a fix without a measurement behind it',
      );
    } else {
      assert.ok(
        /none that holds/i.test(failedRoom),
        'F76 is open in the ledger and the failed-room row claims a control anyway',
      );
    }
    // The phrase that was the overclaim. It is allowed back exactly when the ledger says
    // the control is real again, and not one commit sooner.
    const claimedInARow = risk
      .split('\n')
      .filter((line) => line.trim().startsWith('|'))
      .some((line) => /Zero-second unusable report and idempotent release/.test(line));
    if (!billingFix.done) {
      assert.ok(!claimedInARow, 'a risk register row still lists the zero-second report as a control in place');
    }
  });

  test('both documents describe the room lifecycle the code actually ships', () => {
    // F78 was filed on a premise the measurement then refused: an abandoned room does not
    // hold a tutor, because dispatch follows a participant. `tokens.ts` carries the
    // shipped numbers and the measured ones, so the documents are checked against it
    // rather than against each other.
    const documents: [string, string][] = [
      ['docs/IMPLEMENTATION_EVIDENCE.md', evidence],
      ['docs/RISK_REGISTER.md', risk],
    ];
    for (const [name, text] of documents) {
      if (ROOM_LIFECYCLE.measured.emptyRoom.tutorDispatched === false) {
        assert.ok(
          !/empty room holds (?:a |the )?waiting tutor|empty room held (?:a |the )?waiting tutor/i.test(text),
          `${name} still says an empty room holds a waiting tutor, which the F78 measurement refuted`,
        );
      }
      assert.ok(
        text.includes('departureTimeout'),
        `${name} does not name departureTimeout, which is the timeout that actually holds a worker`,
      );
      assert.ok(
        text.includes(`${ROOM_LIFECYCLE.measured.departedRoom.roomGoneAfterSec}s`),
        `${name} does not carry the measured ${ROOM_LIFECYCLE.measured.departedRoom.roomGoneAfterSec}s departure window from ROOM_LIFECYCLE`,
      );
    }
    // And the shipped value stays quotable: a document naming a different one is stale.
    assert.ok(
      new RegExp(`departureTimeout[^.\\n]{0,20}\\b${ROOM_LIFECYCLE.departureTimeoutSec}\\b`).test(evidence),
      `the evidence document does not record the shipped departureTimeout of ${ROOM_LIFECYCLE.departureTimeoutSec}s`,
    );
  });
});
