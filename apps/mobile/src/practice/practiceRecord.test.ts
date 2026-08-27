/**
 * The Phase 4 record, held to what was actually built and actually run.
 *
 * Four phases of practice work landed on this branch, and the thing most likely to
 * outlive all of it is the paragraph somebody reads next month to decide what is safe
 * to ship. A roadmap that overclaims is worse than one that admits a gap: the gap gets
 * closed, the overclaim gets trusted.
 *
 * So this walks the documents the way `sync/policy.test.ts` walks `policy.ts` and the
 * way `tutor/enterRecord.test.ts` walks the enter fix, and asks four questions that a
 * spell-check cannot ask.
 *
 * - **Does the roadmap still say Phase 4 has not started?** The ledger is the authority,
 *   so the ledger is read and the roadmap is checked against it. Every Phase 4 entry the
 *   gate says is closed has to be named in the roadmap, which means a fifteenth entry
 *   filed later cannot quietly go unrecorded either.
 * - **Does it claim an external check nobody ran?** Six of them are outstanding. Each is
 *   pinned to a source of truth that is not this document: the blocker list in
 *   `IMPLEMENTATION_EVIDENCE.md`, the open ledger entry, the device matrix's own status.
 *   A blocker that clears makes this test red until somebody updates the roadmap, which
 *   is the point rather than a side effect.
 * - **Does the storage doc still describe the durability gap as open?** F118, F123 and
 *   F124 closed it, so the banking section has to carry the shipped contract, and the
 *   risk register may not still be waiting for Phase 4 to do the work Phase 4 did.
 * - **Does any of it name code that no longer exists?** Every file path and every code
 *   identifier the checked sections cite is looked up: paths on disk, identifiers in
 *   shipped source with test files excluded, so a doc cannot be kept true by a symbol
 *   that only survives in a test.
 *
 * Written positively where it can be. A future edit must not be able to satisfy this by
 * deleting the honest paragraph, which is the other way to end up with a record that
 * says nothing true.
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));

const read = (relative: string): string => readFileSync(join(REPO, relative), 'utf8');

const ROADMAP = read('docs/DELIVERY_ROADMAP.md');
const STORAGE = read('docs/STATE_AND_STORAGE.md');
const RISK = read('docs/RISK_REGISTER.md');
const LEDGER = read('docs/KNOWN_ISSUES.md');
const EVIDENCE = read('docs/IMPLEMENTATION_EVIDENCE.md');

/** The title F130 names. Found by the ledger, so this file cannot drift from its entry. */
const ANCHOR = 'the roadmap and storage docs match the shipped practice contract';

/**
 * Phase 4's ledger ids, written out rather than inferred from a range.
 * `evidenceContract.test.ts` makes the same choice for Phase 1 and for the same reason:
 * a phase is a fixed historical thing, and a rule like "everything after F117" silently
 * adopts whatever the next phase files.
 */
const PHASE_FOUR = [
  'F118', 'F119', 'F120', 'F121', 'F122', 'F123', 'F124',
  'F125', 'F126', 'F127', 'F128', 'F129', 'F130', 'F131',
] as const;

// ───────────────────────────────────────────────────────────── reading the docs

interface Entry {
  id: string;
  title: string;
  done: boolean;
  where: string;
  verifiedBy: string[];
}

/** The ledger, parsed the way `scripts/gate.mjs` parses it. */
function readLedger(text: string): Map<string, Entry> {
  const entries = new Map<string, Entry>();
  let current: Entry | null = null;
  for (const line of text.split('\n')) {
    const heading = line.match(/^### (\S+) — (.+)$/);
    if (heading) {
      current = { id: heading[1] as string, title: (heading[2] as string).trim(), done: false, where: '', verifiedBy: [] };
      entries.set(current.id, current);
      continue;
    }
    if (current === null) continue;
    if (/^-\s*status:\s*\[x\]\s*$/.test(line)) current.done = true;
    const where = line.match(/^-\s*where:\s*(.+?)\s*$/);
    if (where) current.where = where[1] as string;
    const verified = line.match(/^-\s*verified-by:\s*`(.+)`\s*$/);
    if (verified) current.verifiedBy.push(verified[1] as string);
  }
  return entries;
}

const ledger = readLedger(LEDGER);

/** One `## ` section of a document, from its heading to the next one. */
function section(doc: string, name: string, heading: string): string {
  const at = doc.indexOf(heading);
  assert.ok(at >= 0, `${name} no longer has the section "${heading}", so this test reads nothing`);
  const rest = doc.slice(at + heading.length);
  const next = rest.search(/\n#{2,3} /);
  return next === -1 ? rest : rest.slice(0, next);
}

/** One table row of the register or the roadmap, found by what it is about. */
function row(doc: string, name: string, match: RegExp): string {
  const found = doc.split('\n').filter((line) => line.trim().startsWith('|') && match.test(line));
  assert.equal(found.length, 1, `${name} has ${found.length} rows matching ${match}, expected exactly one`);
  return found[0] as string;
}

/** The blocker names `IMPLEMENTATION_EVIDENCE.md` still lists as outstanding. */
function outstandingBlockers(): string {
  return section(EVIDENCE, 'docs/IMPLEMENTATION_EVIDENCE.md', '## What is still outstanding');
}

// ────────────────────────────────────────────────────────── reading the source

const SOURCE_ROOTS = ['packages', 'apps', 'services'];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', '.expo', 'android', 'ios', 'graphify-out']);
const PATH_ROOTS = [...SOURCE_ROOTS, 'docs', 'supabase', 'scripts'];

function walk(dir: string, out: string[]): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.github') continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full.slice(REPO.length));
  }
  return out;
}

/** Every file a document could reasonably cite, repo-relative. */
const FILES: string[] = PATH_ROOTS.flatMap((root) => walk(join(REPO, root), []));

/**
 * Every word in shipped source. Test files are left out on purpose: a document that
 * names a symbol only a test still mentions is describing something that has already
 * been deleted, which is exactly the drift this test exists to catch.
 */
const SOURCE_WORDS: Set<string> = (() => {
  const words = new Set<string>();
  for (const file of FILES) {
    if (!/\.tsx?$/.test(file) || /\.test\.tsx?$/.test(file)) continue;
    for (const word of readFileSync(join(REPO, file), 'utf8').split(/[^A-Za-z0-9_$]+/)) {
      if (word !== '') words.add(word);
    }
  }
  return words;
})();

const PATH_TOKEN = /^[\w.-]+(?:\/[\w.-]+)+\.(?:ts|tsx|js|mjs|json|sql|md|yml)(?::\d+)?$/;
const CODE_TOKEN = /^[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z0-9_$]+)*(?:\(\))?$/;

/** A backticked token worth checking: a real path, or something that looks like code. */
function citations(text: string): string[] {
  return [...text.matchAll(/`([^`\n]+)`/g)].map((hit) => hit[1] as string);
}

// ──────────────────────────────────────────────────── the six checks nobody ran

/**
 * Each outstanding external check, with the marker the roadmap has to carry and the
 * thing outside the roadmap that says it is still outstanding. Nothing here asserts
 * "this will always be pending" — that was the mistake `evidenceContract.test.ts`
 * documents at length. Each one branches on its own source of truth instead.
 */
const EXTERNAL: {
  what: string;
  marker: RegExp;
  pending: () => boolean;
  why: string;
}[] = [
  {
    what: 'Supabase migration 7 deployment',
    marker: /202608270001/,
    pending: () => outstandingBlockers().includes('phase-3-schema-apply'),
    why: '`phase-3-schema-apply` is still an outstanding blocker in IMPLEMENTATION_EVIDENCE.md',
  },
  {
    what: 'a Supabase-authenticated first run',
    marker: /Supabase-authenticated first run/i,
    pending: () => outstandingBlockers().includes('phase-3-schema-apply'),
    why: 'no deployed schema exists to sign in against while `phase-3-schema-apply` is outstanding',
  },
  {
    what: 'the device and five-viewport accessibility matrix',
    marker: /DEVICE_VERIFICATION\.md/,
    pending: () => read('docs/DEVICE_VERIFICATION.md').includes('not run'),
    why: 'DEVICE_VERIFICATION.md still records rows as not run',
  },
  {
    what: 'the F57 human stopwatch test',
    marker: /\bF57\b/,
    pending: () => ledger.get('F57')?.done === false,
    why: 'F57 is open in the ledger',
  },
  {
    what: 'vendor credential rotation',
    marker: /vendor-key-rotation/,
    pending: () => outstandingBlockers().includes('vendor-key-rotation'),
    why: '`vendor-key-rotation` is still an outstanding blocker in IMPLEMENTATION_EVIDENCE.md',
  },
  {
    what: 'F79 durable replay refusal',
    marker: /\bF79\b/,
    pending: () => ledger.get('F79')?.done === false,
    why: 'F79 is open in the ledger',
  },
];

/** Words that assert a check happened. */
const CLAIMED = /\b(deployed|applied|rotated|ran|run|passed|completed|verified|timed|measured)\b/gi;

/** Words that turn one of those into an admission instead. */
const DENIED = /\b(no|none|not|never|nobody|pending|blocked|owed|until|without|yet|cannot|neither)\b/i;

/**
 * Prose is checked flattened, because markdown wraps a sentence wherever the column runs
 * out and an assertion on a phrase is otherwise an assertion about somebody's editor.
 * `evidenceContract.test.ts` learned this first.
 */
const flat = (text: string): string => text.replace(/\s+/g, ' ').trim();

/**
 * One claim per sentence, and a bold lede is its own sentence.
 *
 * A window of characters is not enough here: "**Migration 7 is not deployed.** It was
 * applied on Tuesday" contradicts itself, and any window wide enough to hold the second
 * clause also holds the "not" in the first. So the denial has to live in the same
 * sentence as the claim, and `.**` ends a sentence like `.` does.
 */
const sentences = (text: string): string[] => flat(text).split(/(?<=[.!?])[*\s]+/);

/**
 * The six workspaces a gate record names, spelled the way both documents spell them.
 * `evidenceContract.test.ts` owns the rule that the newest recorded run defends the
 * current floors, and this file does not repeat it. What nothing owned until now is
 * quieter: the roadmap quotes a gate, the evidence document records the same gate, and
 * a person updating one of them has no reason to think about the other.
 */
const WORKSPACES = /(core|brain|tutor agent|token server|playground|mobile) (\d{2,4})/g;

/** A gate quoted in prose: its total, and what it says each workspace ran. */
function gateRecord(window: string): Map<string, number> {
  return new Map([...window.matchAll(WORKSPACES)].map((hit) => [hit[1] as string, Number(hit[2])]));
}

/** Claims that no amount of surrounding context makes true today. */
const NEVER_TRUE = [
  /verified live/i,
  /now deployed/i,
  /rotation (?:is )?(?:complete|done)/i,
  /matrix (?:is |was )?(?:complete|passed|green)/i,
  /(?:on|against) a real (?:device|phone)/i,
];

// ───────────────────────────────────────────────────────────────────── the test

describe('the Phase 4 record — what the docs are allowed to claim', () => {
  test('the roadmap and storage docs match the shipped practice contract', () => {
    // 0. The entry that names this test exists, once, and points somewhere real.
    const owners = [...ledger.values()].filter((entry) => entry.verifiedBy.includes(ANCHOR));
    assert.equal(
      owners.length,
      1,
      `Expected exactly one ledger entry verified by "${ANCHOR}", found ${owners.length}.`,
    );
    const owner = owners[0] as Entry;
    const wherePath = owner.where.replace(/:\d+$/, '');
    assert.ok(
      existsSync(join(REPO, wherePath)),
      `${owner.id} points at ${owner.where}, which is not a file in this repo`,
    );

    // 1. Phase 4 is recorded as built, and everything the gate calls closed is named.
    for (const id of PHASE_FOUR) {
      assert.ok(ledger.has(id), `${id} is gone from the ledger, so the roadmap's Phase 4 record cannot be checked`);
    }
    const closed = PHASE_FOUR.filter((id) => ledger.get(id)?.done === true);
    const phaseRow = row(ROADMAP, 'docs/DELIVERY_ROADMAP.md', /^\|\s*4\. Practice\b/);
    if (closed.length > 0) {
      assert.ok(
        !/not started|not begun|unstarted|nothing built/i.test(phaseRow),
        `${closed.length} Phase 4 ledger entries are closed and the roadmap's Phase 4 row still reads as unstarted: ${phaseRow.trim()}`,
      );
      assert.ok(
        /phase-4-practice/.test(phaseRow),
        'the roadmap Phase 4 row does not say which branch the work was tested on',
      );
    }
    for (const id of closed) {
      assert.ok(
        ROADMAP.includes(id),
        `${id} is closed in the ledger and named nowhere in the roadmap, so the record of Phase 4 is already incomplete`,
      );
    }

    // 2. Nothing external is claimed. Each item is pinned to a source of truth that is
    //    not this document, so a real run flips the requirement instead of failing it.
    const pendingSection = section(ROADMAP, 'docs/DELIVERY_ROADMAP.md', '## What Phase 4 did not verify');
    for (const item of EXTERNAL) {
      if (!item.pending()) continue;
      const bullets = pendingSection.split(/\n(?=- )/).filter((bullet) => item.marker.test(bullet));
      assert.ok(
        bullets.length > 0,
        `${item.what} is still pending (${item.why}) and the roadmap does not list it under "What Phase 4 did not verify"`,
      );
      for (const bullet of bullets) {
        for (const sentence of sentences(bullet)) {
          for (const hit of sentence.matchAll(CLAIMED)) {
            assert.ok(
              DENIED.test(sentence),
              `the roadmap says "${hit[0]}" about ${item.what}, which nobody did. ${item.why}. ` +
                `Say it only to say it has not happened. The sentence is: "${sentence}"`,
            );
          }
        }
      }
    }
    for (const forbidden of NEVER_TRUE) {
      assert.ok(
        !forbidden.test(flat(pendingSection)),
        `the roadmap's pending section matches ${forbidden}, and none of these checks has been run on this machine`,
      );
    }
    // Review-screen accessibility is source evidence. The roadmap has to say so, because
    // a green suite over accessibility props reads exactly like a screen-reader pass.
    assert.ok(
      /source-level/i.test(pendingSection) && /VoiceOver/i.test(pendingSection),
      "the roadmap does not say that the review screen's accessibility evidence is source-level rather than a screen-reader pass",
    );

    // 3. The durability gap is closed everywhere, or open everywhere.
    const banking = section(STORAGE, 'docs/STATE_AND_STORAGE.md', '### Banking a conversation');
    const persistence = row(RISK, 'docs/RISK_REGISTER.md', /Learner loses practice when local persistence fails/);
    const gapClosed = ['F118', 'F123', 'F124'].every((id) => ledger.get(id)?.done === true);
    if (gapClosed) {
      for (const named of ['PersistAck', 'bankPractice', 'recoverJournal', 'batchId', 'convoUses']) {
        assert.ok(
          banking.includes(named),
          `F123 and F124 shipped ${named} and the storage doc's banking section never names it`,
        );
      }
      for (const hit of banking.matchAll(/swallow\w*/gi)) {
        const at = hit.index ?? 0;
        const around = banking.slice(Math.max(0, at - 200), at + 200);
        assert.ok(
          /no longer|used to|stopped|instead of|rather than|not\b/i.test(around),
          'the storage doc still describes a store swallowing its own failure as a present fact. F123 gave every ' +
            'practice write a word to answer with. Say it only to say it used to happen.',
        );
      }
      assert.ok(
        !/accepted-with-evidence/.test(persistence),
        'F118 is closed and the risk register still accepts the persistence risk instead of measuring it',
      );
      assert.ok(
        !/Phase 4 (?:durable|batch|outbox)/i.test(persistence),
        'the risk register still lists the durable outbox as work Phase 4 will do. Phase 4 did it',
      );
      assert.ok(
        /\bmeasured\b/.test(persistence),
        'the persistence row carries no measured evidence state now that F123, F124 and F125 have closed it',
      );
    }

    // 3b. A gate the roadmap quotes is a gate the evidence document has to record, with
    //     the same six numbers. Floors moved under this document once already, which is
    //     how F130 came back after it was closed.
    const flatRoadmap = flat(ROADMAP);
    const quoted = [...flatRoadmap.matchAll(/([\d,]+) tests and 0 failing/g)];
    assert.ok(quoted.length > 0, 'the roadmap quotes no gate at all, so Phase 4 has no measured exit');
    for (const quote of quoted) {
      const label = quote[1] as string;
      const total = Number(label.replace(/,/g, ''));
      const counts = gateRecord(flatRoadmap.slice(quote.index ?? 0, (quote.index ?? 0) + 220));
      assert.equal(counts.size, 6, `the roadmap's ${label} gate does not name all six workspaces`);
      assert.equal(
        [...counts.values()].reduce((sum, count) => sum + count, 0),
        total,
        `the roadmap's ${label} gate does not add up to ${label}`,
      );
      const flatEvidence = flat(EVIDENCE);
      const records = [...flatEvidence.matchAll(/\*\*([\d,]+) tests/g)].filter(
        (record) => (record[1] as string) === label,
      );
      assert.ok(
        records.length > 0,
        `the roadmap quotes a ${label} gate and docs/IMPLEMENTATION_EVIDENCE.md records no such run. ` +
          'The evidence document is where a gate is recorded; the roadmap only cites it.',
      );
      for (const record of records) {
        const recorded = gateRecord(flatEvidence.slice(record.index ?? 0, (record.index ?? 0) + 220));
        for (const [workspace, count] of counts) {
          assert.equal(
            recorded.get(workspace),
            count,
            `the roadmap says ${workspace} ran ${count} tests in the ${label} gate and ` +
              `docs/IMPLEMENTATION_EVIDENCE.md says ${recorded.get(workspace)}`,
          );
        }
      }
    }

    // 4. Every path and every code name these sections cite still exists.
    const checked: [string, string][] = [
      ['docs/DELIVERY_ROADMAP.md', ROADMAP],
      ['docs/STATE_AND_STORAGE.md (banking)', banking],
      ['docs/RISK_REGISTER.md (Phase 4)', section(RISK, 'docs/RISK_REGISTER.md', '## Phase 4 practice')],
    ];
    let looked = 0;
    for (const [where, text] of checked) {
      for (const token of citations(text)) {
        if (PATH_TOKEN.test(token)) {
          const path = token.replace(/:\d+$/, '');
          assert.ok(
            FILES.some((file) => file === path || file.endsWith(`/${path}`)),
            `${where} cites ${token}, and no such file is in this repo`,
          );
          looked += 1;
          continue;
        }
        if (!CODE_TOKEN.test(token)) continue;
        const parts = token.replace(/\(\)$/, '').split('.');
        if (!parts.some((part) => /[A-Z]/.test(part)) && parts.length === 1 && !token.endsWith('()')) continue;
        for (const part of parts) {
          assert.ok(
            SOURCE_WORDS.has(part),
            `${where} names \`${token}\`, and "${part}" is in no shipped source file. A document that ` +
              'describes a symbol nobody kept is describing a product that does not exist.',
          );
        }
        looked += 1;
      }
    }
    assert.ok(
      looked > 20,
      `only ${looked} citations were checked, which means these sections stopped naming the code they describe`,
    );
  });
});
