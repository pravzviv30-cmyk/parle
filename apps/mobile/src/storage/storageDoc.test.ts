/**
 * The storage doc, held to the source it describes.
 *
 * `docs/STATE_AND_STORAGE.md` is where somebody looks to find out where a
 * learner's data lives and what is still lost. A storage doc that has drifted
 * from the storage is worse than none, because it is read *instead of* the code
 * and it is believed.
 *
 * The drift F194 names is the expensive kind. The pre-recap section described
 * `finish()` as ending in two `void`ed, unawaited analyst calls whose results
 * were dropped when the room closed. F101 replaced that with an awaited
 * `Promise.allSettled`, and the worker now holds the room open for it. So an
 * engineer reading the doc would have gone and fixed a fixed thing, and walked
 * straight past the loss that is actually there: those calls publish three
 * frames into a room the learner may already have left. A server-owned
 * Conversation Pack now recovers the learning artefact, and this test keeps
 * that promise connected to the actual reporter instead of the room frames.
 *
 * So this reads the agent's real `finish()` and the real publish sites and holds
 * the prose to them, the way `practice/practiceRecord.test.ts` holds the roadmap
 * to the ledger. It is written in the same two directions that file uses, and
 * both matter:
 *
 * - **Positively**, so the doc cannot be made true by deleting the paragraph.
 *   If the source awaits, the doc has to say awaited.
 * - **Conditionally on the source**, so the day somebody changes the persistence
 *   boundary this test turns red and asks for the doc rather than asserting an
 *   obsolete delivery story forever.
 *
 * `sync/policy.test.ts` owns the other half of this section — the window, its
 * owner, the phase and the ledger entry — and this file does not repeat it.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const read = (relative: string): string => readFileSync(join(REPO, relative), 'utf8');

const DOC = read('docs/STATE_AND_STORAGE.md');
const CONVO = read('services/tutor-agent/src/convo.ts');
const AGENT = read('services/tutor-agent/src/agent.ts');

/** One `###` section of the doc, heading to the next heading. */
function section(heading: string): string {
  const at = DOC.indexOf(heading);
  assert.ok(at >= 0, `the storage doc no longer has the section "${heading}", so this test reads nothing`);
  const rest = DOC.slice(at + heading.length);
  const next = rest.search(/\n#{2,3} /);
  return next === -1 ? rest : rest.slice(0, next);
}

/** The body of `finish()` in the agent, from its signature to the next method. */
function finishBody(): string {
  const wrapper = CONVO.slice(CONVO.indexOf('  finish(): Promise<void> {'), CONVO.indexOf('  private async complete(): Promise<void> {'));
  assert.match(wrapper, /if \(this.finishing\) return this.finishing/);
  assert.match(wrapper, /this.finishing = this.complete\(\)/);
  const at = CONVO.indexOf('private async complete(): Promise<void> {');
  assert.ok(at >= 0, 'convo.ts no longer has its shared completion pipeline, so the doc cannot be held to it');
  const rest = CONVO.slice(at);
  const end = rest.indexOf('\n  }\n');
  assert.ok(end > 0, 'finish() has no end, so this is reading the rest of the file');
  return rest.slice(0, end);
}

/** Markdown wraps sentences wherever the column runs out. Compare flattened. */
const flat = (text: string): string => text.replace(/\s+/g, ' ').trim();

describe('the storage doc and the agent it describes', () => {
  test('the storage doc describes the awaited publish and durable pack recovery', () => {
    const window = section('### The pre-recap window');
    const prose = flat(window);
    const body = finishBody();

    // ── 1. The join, as the source actually writes it.
    const joined = /await\s+Promise\.allSettled\(\s*\[\s*this\.extractMemory\([^)]*\),\s*this\.curateAndDrill\([^)]*\)\s*\]\s*\)/.test(
      flat(body),
    );
    const voided = /void\s+this\.(extractMemory|curateAndDrill)\s*\(/.test(body);
    assert.ok(
      joined !== voided,
      'finish() both awaits and voids its analyst calls, or does neither, so there is no single fact for the doc to describe',
    );

    if (joined) {
      assert.match(
        prose,
        /allSettled/,
        'finish() awaits its analyst calls and the doc never says so. F101 made this change; a doc that still ' +
          'describes the fire-and-forget sends the next engineer to fix a fixed thing.',
      );
      // And it may not describe the old shape as a present fact. `used to`,
      // `no longer` and friends are how a document keeps history honestly.
      for (const hit of prose.matchAll(/\bvoid(?:ed)?\b/gi)) {
        const at = hit.index ?? 0;
        const around = prose.slice(Math.max(0, at - 200), at + 200);
        assert.ok(
          /no longer|used to|until F101|stopped|instead of|rather than|never ahead/i.test(around),
          'the storage doc still describes the analyst calls as voided and unawaited, which is a present-tense ' +
            'claim about code that changed. Say it only to say it used to be so.',
        );
      }
      assert.doesNotMatch(
        prose,
        /deliberately not\s+awaited|are not awaited|fire[- ]and[- ]forget(?![^.]*\b(no longer|used to|until)\b)/i,
        'the storage doc still calls the analyst calls unawaited',
      );
    } else {
      assert.match(prose, /not awaited|unawaited|fire[- ]and[- ]forget/i, 'finish() still voids its analyst calls and the doc no longer says so');
    }

    // ── 2. The order inside finish(), which is the reason the join is safe.
    //     The debit must not wait on analyst work and the summary must include it.
    const usageAt = body.indexOf('reportUsage');
    const joinAt = body.search(/Promise\.allSettled/);
    const summaryAt = body.lastIndexOf('logSpendSummary');
    assert.match(body, /if \(this.safetyStopped\) \{\s*this.logSpendSummary\(\);\s*return;\s*\}/,
      'an early spend summary is valid only for the safety path that skips enrichment');
    assert.ok(usageAt >= 0 && joinAt >= 0 && summaryAt >= 0, 'finish() no longer debits, joins and summarises, so the doc claim cannot be checked');
    assert.ok(usageAt < joinAt, 'reportUsage now runs after the analyst join, so the minutes debit waits on telemetry');
    assert.ok(joinAt < summaryAt, 'the spend summary now runs before the analyst join and cannot see the biggest spend of the session');
    assert.match(prose, /after\W+`?reportUsage/i, 'the doc does not say the join is after the minutes debit');
    assert.match(prose, /before\W+`?logSpendSummary/i, 'the doc does not say the join is before the spend summary');

    // ── 3. The worker really does hold the room open for it.
    assert.match(
      AGENT,
      /tutor\.finish\(\)\.finally\(\(\) => ctx\.room\.disconnect\(\)\)/,
      'agent.ts no longer disconnects on finish().finally, so the doc claim about the room is wrong',
    );
    assert.match(prose, /finish\(\)\.finally|holds the room open/i, 'the doc does not say the worker holds the room open for the analyst calls');

    // ── 4. The frames still publish into the live room, and the durable Pack
    //     is what turns their learning content into cross-session recovery.
    const analyst = body + CONVO.slice(CONVO.indexOf('private async curateAndDrill'));
    for (const frame of ['practice', 'drills', 'recap']) {
      assert.ok(
        analyst.includes(`t: '${frame}'`),
        `the analyst path no longer publishes a ${frame} frame, so the doc's list of what is lost is stale`,
      );
      assert.match(
        prose,
        new RegExp(`\`${frame}\``),
        `the doc does not name the ${frame} frame among the ones published into a room the learner may have left`,
      );
    }
    // A replay exists for the recap and for nothing else. If somebody adds a
    // `lastPractice`, this asks for the doc before it asks for anything else.
    assert.match(CONVO, /this\.lastRecap = /, 'lastRecap is gone, so the doc claim about the replay is stale');
    assert.ok(
      !/lastPractice|lastDrills/.test(CONVO),
      'the agent now remembers a practice or drills frame for replay, and the doc still says nothing does',
    );
    assert.match(prose, /lastRecap/, 'the doc does not name the one frame that is replayed');
    assert.match(
      prose,
      /participantDisconnected/,
      'the doc does not name the path that both triggers the analyst work and guarantees nobody is there to receive it',
    );

    // ── 5. The server boundary is explicit. A room frame remains transient,
    //     but the learner's selected practice is saved as an audio-free pack.
    const persistsServerSide = /reportConversationPack\(/.test(CONVO);
    assert.ok(persistsServerSide, 'convo.ts no longer reports the durable Conversation Pack');
    for (const named of ['Conversation Pack', 'conversation_packs', 'generating', 'ready', 'outbox guarantee']) {
      assert.ok(prose.includes(named), `the storage doc does not state the pack recovery contract: ${named}`);
    }

    // ── 6. Every path and code name the section cites still exists. A doc kept
    //     true by a symbol nobody ships is the drift this entry is about.
    const shipped = CONVO + AGENT + read('apps/mobile/src/live/journal.ts');
    for (const cited of ['extractMemory', 'curateAndDrill', 'reportUsage', 'logSpendSummary', 'lastRecap', 'participantDisconnected']) {
      assert.ok(prose.includes(cited), `the section stopped naming ${cited}`);
      assert.ok(shipped.includes(cited), `the section names ${cited}, which no longer exists in shipped source`);
    }
    for (const path of [...window.matchAll(/`((?:apps|services|packages|docs)\/[\w./-]+\.(?:ts|tsx|md))`/g)]) {
      const cited = path[1] as string;
      assert.doesNotThrow(() => read(cited), `the section cites ${cited}, which is not a file in this repo`);
    }
  });
});

/**
 * The two stores the daily home added, and the field the sitting gained.
 *
 * Written in the same two directions as the test above. **Positively**, so the
 * doc cannot be made true by leaving the new stores out of it: the source is
 * read for the key each one writes, and the doc has to name it. And
 * **conditionally on the source**, so the day one of them is deleted or renamed
 * this asks for the doc instead of asserting a store nobody ships.
 *
 * `durationMs` gets the strictest half. An optional field on a shape that
 * already exists on phones is the kind of thing a reader assumes is always
 * there, and reading absent as zero would put a "minutes today" figure under a
 * learner who has been studying for a year. So the doc has to say both that it
 * is optional and that the entries written before it exist without it.
 */
describe('the storage doc and the stores the daily home added', () => {
  const STORES = [
    { suffix: 'bookmarks', file: 'apps/mobile/src/bookmarks/store.ts' },
    { suffix: 'scenarioProgress', file: 'apps/mobile/src/missions/progressStore.ts' },
  ] as const;

  test("the storage doc names the two daily stores and the sitting's duration — F408", () => {
    const stores = section('## On the device');
    const contract = section('### The sync contract');

    for (const { suffix, file } of STORES) {
      // Read the store first. A doc entry for a key nothing writes is drift in the
      // other direction, and it is the harder one to notice.
      const source = read(file);
      assert.ok(
        source.includes(`userKey('${suffix}')`),
        `${file} no longer writes userKey('${suffix}'), so the doc entry describes a store that is gone`,
      );
      assert.ok(
        source.includes(`registerSyncAdopter('${suffix}'`),
        `${file} no longer registers an adopter, so it cannot take a merge back and the sync entry is wrong`,
      );
      assert.match(
        stores,
        new RegExp(`\`${suffix}\``),
        `the stores list does not name ${suffix}, so a learner's data lives somewhere the doc does not say`,
      );
      assert.match(
        contract,
        new RegExp(`\\*\\*per-item\\*\\*[^\\n]*(?:\\n[^\\n]*)?\`${suffix}\``),
        `${suffix} is not under the per-item class in the sync contract`,
      );
    }

    // The per-item choice is the load-bearing one for bookmarks, and the doc has to
    // carry the reason rather than only the classification.
    assert.match(
      contract,
      /un-save[^.]*\b(back|again)\b|newer\s+decision/,
      'the doc classifies bookmarks as per-item without saying why a set of saved ids cannot express a removal',
    );

    // `beatsTotal` is the count that is deliberately not stored. If the store ever
    // starts holding it, this asks for the doc before anything else does.
    const partial = read('apps/mobile/src/missions/progressStore.ts');
    assert.ok(!/beatsTotal\s*:/.test(partial), 'progressStore.ts now stores beatsTotal, which the doc says it never does');
    assert.match(flat(stores), /never the beat total|beatsTotal is never stored/i, 'the doc does not say the beat total is not stored');

    // And the sitting's duration: optional in the source, optional in the doc, and
    // absent on everything written before it existed.
    const activity = read('apps/mobile/src/progress/activity.ts');
    assert.match(
      activity,
      /durationMs\?:\s*number/,
      'ActivityEntry no longer declares durationMs as optional, so the doc claim about older entries is stale',
    );
    const said = flat(stores);
    assert.match(said, /`durationMs`/, 'the stores list does not name durationMs at all');
    assert.match(said, /optional/i, 'the doc does not say durationMs is optional');
    assert.match(
      said,
      /absent on\s+\*\*?every entry written before it existed|absent on every entry written before it existed/i,
      'the doc does not say durationMs is absent on entries written before this pass',
    );
    assert.match(
      said,
      /never as zero|not measured/i,
      'the doc does not say what absence means, and a reader who treats it as zero invents minutes nobody spent',
    );
  });
});
