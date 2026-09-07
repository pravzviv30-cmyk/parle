/**
 * The conflict table, held to the two things it claims about itself.
 *
 * A merge policy is a promise that is easy to write and easy to break: every rule here
 * looks convergent, and the ones that are not only reveal it on the pair of blobs nobody
 * thought to type out. So the centrepiece is a property test rather than a list of
 * examples — generated blobs for all ten namespaces, merged in both orders, merged again
 * against their own output, and gossiped between two simulated devices until they settle.
 *
 * Two structural tests do the rest of the work:
 *
 * - **Completeness.** Every per-user storage suffix must be either a policy or a named
 *   exclusion, and every store that registered a sync adopter must have a policy. Read
 *   out of the source rather than imported, so no store can join the app without this
 *   noticing, and so nothing in `sync/` has to import a module that reaches AsyncStorage.
 * - **The borrowed caps.** Four numbers in `policy.ts` belong to store files it cannot
 *   import. Their owners are read as text and compared, because a cap that silently drifts
 *   makes the merge and the disk permanently disagree and the engine adopt forever.
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

import { mergeStoredProfiles } from '@luvani/brain/profile/merge';
import { mergeDecks } from '@luvani/core';

import { sameData, stableStringify } from './envelope.ts';
import { SYNC_STATE_SUFFIX } from './registry.ts';
import {
  ACTIVITY_KEEP_DAYS,
  MAX_BOOKMARKS,
  MAX_COMPLETIONS_PER_MISSION,
  MAX_HISTORY_SESSIONS,
  MAX_SCENARIO_RECORDS,
  MAX_SOUND_CHECKS,
  SYNC_EXCLUSIONS,
  SYNC_POLICIES,
  createSyncPolicy,
} from './policy.ts';
import { upgradeStored } from '../profile/upgrade.ts';

const MOBILE = fileURLToPath(new URL('../..', import.meta.url));
const FIXED_NOW = Date.UTC(2026, 7, 26, 12, 0, 0);
const policy = createSyncPolicy({ now: () => FIXED_NOW });

/** The merged value, or a marker naming the quiet reason so a test can see both. */
function merge(namespace: string, local: unknown, remote: unknown): unknown {
  const result = policy.merge({ namespace, local, remote });
  return result.kind === 'merged' ? result.data : `quiet:${result.reason}`;
}

// ─────────────────────────────────────────────────────────── reading the app

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
      out.push(...sourceFiles(full));
      continue;
    }
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) continue;
    out.push(full);
  }
  return out;
}

/**
 * `USER_KEY_SUFFIXES` read out of scope.ts as text.
 *
 * Imported would be shorter and would drag `@react-native-async-storage` into a directory
 * whose whole point is that it loads under plain node. Comment lines are dropped first, so
 * a sentence mentioning a suffix cannot be mistaken for a member of the list.
 */
function userKeySuffixes(): string[] {
  const source = readFileSync(join(MOBILE, 'src/storage/scope.ts'), 'utf8');
  const block = source.match(/export const USER_KEY_SUFFIXES = \[([\s\S]*?)\] as const;/);
  assert.ok(block, 'USER_KEY_SUFFIXES is no longer a literal array in scope.ts, so this test reads nothing');
  const body = (block[1] ?? '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
  return [...body.matchAll(/'([^']+)'/g)].map((match) => match[1] as string);
}

/** Every namespace a store claimed by registering an adopter for it. */
function adoptedNamespaces(): { namespace: string; file: string }[] {
  const found: { namespace: string; file: string }[] = [];
  for (const file of sourceFiles(join(MOBILE, 'src'))) {
    if (file.includes(`${join('src', 'sync')}`)) continue;
    for (const match of readFileSync(file, 'utf8').matchAll(/registerSyncAdopter\(\s*'([^']+)'/g)) {
      found.push({ namespace: match[1] as string, file: file.slice(MOBILE.length) });
    }
  }
  return found;
}

/** One number out of a store this file may not import, by the name it has there. */
function constantIn(relative: string, name: string): number {
  const source = readFileSync(join(MOBILE, relative), 'utf8');
  const match = source.match(new RegExp(`${name}\\s*=\\s*(\\d+)`));
  assert.ok(match, `${name} is no longer declared in ${relative}, so the policy cap is unchecked`);
  return Number(match[1]);
}

// ──────────────────────────────────────────────────────────── generated blobs

/** A deterministic source of choices. A property test that cannot be replayed is a flake. */
function chooser(seed: number) {
  let state = (seed * 2654435761) >>> 0;
  const next = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
  return {
    int: (n: number): number => Math.floor(next() * n),
    one: <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T,
    bool: (): boolean => next() < 0.5,
  };
}

type Chooser = ReturnType<typeof chooser>;

const FRENCH = ['bonjour', 'un café', "l'addition", 'merci beaucoup', 'je voudrais', 'à demain'];
const DAY = 86_400_000;
const BASE = Date.UTC(2026, 0, 1);

function genProfile(pick: Chooser): unknown {
  const phrases: Record<string, unknown> = {};
  for (let i = 0; i < 1 + pick.int(4); i += 1) {
    const fr = pick.one(FRENCH);
    phrases[`phrase:${fr}`] = {
      fr,
      frWritten: null,
      en: 'something',
      register: 'neutral',
      introducedAt: new Date(BASE + pick.int(60) * DAY).toISOString(),
      timesUsedWell: pick.int(5),
      mastered: pick.bool(),
    };
  }
  const errorPatterns: Record<string, unknown> = {};
  for (let i = 0; i < pick.int(3); i += 1) {
    errorPatterns[pick.one(['gender', 'liaison', 'verb-tense'])] = {
      count: 1 + pick.int(4),
      lastSeen: new Date(BASE + pick.int(60) * DAY).toISOString(),
      example: 'le table',
    };
  }
  return {
    version: 4,
    name: pick.bool() ? 'Camille' : null,
    dob: null,
    ageConfirmed: pick.bool() ? true : null,
    motivation: pick.bool() ? 'travel' : null,
    dailyGoalMin: pick.one([5, 10, 15, null]),
    onboardedAt: BASE,
    username: pick.bool() ? 'camille' : null,
    brain: {
      version: 2,
      cefr: { estimate: pick.one(['A0', 'A1', 'A2']), confidence: 'low', evidence: [] },
      errorPatterns,
      phrases,
      memory: { facts: [], opener: null, name: null },
      preferences: { strictness: 'balanced', lastScenarios: [] },
      stats: { sessions: pick.int(6), totalTurns: pick.int(40), rescues: pick.int(3), lastRung: null },
    },
  };
}

function genReview(pick: Chooser): unknown {
  const deck: unknown[] = [];
  for (let i = 0; i < pick.int(6); i += 1) {
    const fr = pick.one(FRENCH);
    deck.push({
      id: `phrase:${fr}`,
      kind: 'vocab',
      front: fr,
      back: 'something',
      context: '',
      ipa: '',
      addedAt: BASE + pick.int(30) * DAY,
      due: BASE + pick.int(60) * DAY,
      intervalDays: 1 + pick.int(20),
      ease: 2 + pick.int(2),
      reps: pick.int(6),
      lapses: pick.int(3),
    });
  }
  return deck;
}

function genDrills(pick: Chooser): unknown {
  const exercises: unknown[] = [];
  for (let i = 0; i < pick.int(6); i += 1) {
    const fr = pick.one(FRENCH);
    const kind = pick.one(['say-it', 'fill-gap', 'listen']);
    exercises.push({
      id: pick.bool() ? `gen:phrase:${fr}:${kind}` : `cafe-${i}`,
      phraseKey: `phrase:${fr}`,
      kind,
      prompt: 'go on',
    });
  }
  return {
    version: 1,
    exercises,
    micSuppressedUntil: pick.bool() ? new Date(BASE + pick.int(20) * DAY).toISOString() : null,
  };
}

function genTopics(pick: Chooser): unknown {
  const topics: unknown[] = [];
  for (let i = 0; i < pick.int(5); i += 1) {
    const subject = pick.one(['cafe', 'trains', 'family', 'work']);
    topics.push({
      id: `topic:${subject}`,
      title: { fr: subject, en: subject },
      discussed: [new Date(BASE + pick.int(90) * DAY).toISOString().slice(0, 10)],
      phraseKeys: [`phrase:${pick.one(FRENCH)}`],
    });
  }
  return { version: 1, topics };
}

function genHistory(pick: Chooser): unknown {
  const sessions: unknown[] = [];
  for (let i = 0; i < pick.int(5); i += 1) {
    sessions.push({
      endedAt: BASE + pick.int(90) * DAY,
      summary: { lessonId: pick.one(['cafe', 'train']), turns: pick.int(20), lastRung: pick.int(6) },
    });
  }
  return sessions;
}

function genActivity(pick: Chooser): unknown {
  const entries: unknown[] = [];
  for (let i = 0; i < pick.int(6); i += 1) {
    // Some entries carry a duration and some do not, which is what every real log
    // looks like after F395: the rows written before the field existed keep no
    // minutes, and the merge has to fold the two kinds together.
    const base = {
      at: BASE + pick.int(500) * DAY,
      kind: pick.one(['lesson', 'convo', 'drill', 'review']),
      xp: 1 + pick.int(30),
    };
    entries.push(pick.bool() ? { ...base, durationMs: pick.int(900_000) } : base);
  }
  return pick.bool() ? { version: 1, entries, backfilled: true } : { version: 1, entries };
}

function genMissions(pick: Chooser): unknown {
  const completions: unknown[] = [];
  for (let i = 0; i < pick.int(6); i += 1) {
    completions.push({
      id: pick.one(['mission:cafe', 'mission:train', 'mission:market']),
      at: BASE + pick.int(90) * DAY,
      rung: pick.int(7),
    });
  }
  return { version: 1, completions };
}

function genSoundChecks(pick: Chooser): unknown {
  const evidence: unknown[] = [];
  for (let i = 0; i < pick.int(5); i += 1) {
    evidence.push({
      missionId: pick.one(['mission:cafe', 'mission:train']),
      reference: pick.one(FRENCH),
      at: BASE + pick.int(90) * DAY,
      kind: pick.one(['assessed-clear', 'assessed-focus', 'self-guided', 'unavailable']),
      focus: pick.bool() ? 'the r at the end' : null,
    });
  }
  return { version: 1, evidence };
}

function genBookmarks(pick: Chooser): unknown {
  const items: unknown[] = [];
  for (let i = 0; i < pick.int(6); i += 1) {
    items.push({
      scenarioId: pick.one(['scene:market', 'scene:pharmacy', 'scene:taxi', 'scene:neighbour']),
      at: BASE + pick.int(90) * DAY,
      saved: pick.bool(),
    });
  }
  return { version: 1, items };
}

function genScenarioProgress(pick: Chooser): unknown {
  const records: unknown[] = [];
  for (let i = 0; i < pick.int(5); i += 1) {
    records.push({
      missionId: pick.one(['mission:cafe', 'mission:train', 'mission:market']),
      at: BASE + pick.int(90) * DAY,
      elapsedMs: pick.int(600_000),
      beatsDone: pick.int(8),
    });
  }
  return { version: 1, records };
}

function genCoachMarks(pick: Chooser): unknown {
  const marks: string[] = [];
  for (let i = 0; i < pick.int(4); i += 1) marks.push(pick.one(['mic', 'hint', 'done', 'slow', 'future-mark']));
  return marks;
}

function genTutorIntro(pick: Chooser): unknown {
  return pick.bool() ? 1 : null;
}

const GENERATORS: Record<string, (pick: Chooser) => unknown> = {
  profile: genProfile,
  review: genReview,
  drills: genDrills,
  topics: genTopics,
  history: genHistory,
  activity: genActivity,
  missions: genMissions,
  soundChecks: genSoundChecks,
  bookmarks: genBookmarks,
  scenarioProgress: genScenarioProgress,
  coachMarks: genCoachMarks,
  tutorIntro: genTutorIntro,
};

/** A blob a store might have on disk, plus the occasional absence and the occasional lie. */
function blobFor(namespace: string, seed: number): unknown {
  const pick = chooser(seed);
  if (seed % 11 === 0) return null;
  const generator = GENERATORS[namespace];
  assert.ok(generator, `no generator for ${namespace}, so the property test is skipping it silently`);
  return generator(pick);
}

// ──────────────────────────────────────────────────────────────────── tests

describe('the per-domain conflict policy — seventeen namespaces, three classes, five exclusions', () => {
  test('every synced namespace has an explicit merge policy and every excluded one an explicit reason', () => {
    const suffixes = userKeySuffixes().filter((suffix) => suffix !== SYNC_STATE_SUFFIX);
    assert.ok(suffixes.length > 0, 'the scan read no suffixes out of scope.ts, so it is checking nothing');

    const synced = new Set(SYNC_POLICIES.map((entry) => entry.namespace));
    const excluded = new Set(SYNC_EXCLUSIONS.map((entry) => entry.namespace));

    for (const suffix of suffixes) {
      assert.ok(
        synced.has(suffix) || excluded.has(suffix),
        `${suffix} is stored per learner but the sync table neither merges it nor says why not`,
      );
      assert.ok(!(synced.has(suffix) && excluded.has(suffix)), `${suffix} is both synced and excluded`);
    }
    for (const namespace of [...synced, ...excluded]) {
      assert.ok(suffixes.includes(namespace), `${namespace} is in the sync table but is not a per-user storage key`);
    }
    assert.equal(
      synced.size + excluded.size,
      suffixes.length,
      'the table and the store list are different sizes, so one namespace is decided twice or not at all',
    );

    // Every exclusion states a reason, and the reason is about the product rather than
    // about effort. journal, friends and reminder each have to be here by name: this list
    // is pinned so that excluding a namespace stays a decision somebody made on purpose
    // rather than a store that quietly slipped out of the merge table.
    assert.deepEqual([...excluded].sort(), ['conversationPacks', 'friends', 'journal', 'reminder', 'suggestions']);
    for (const exclusion of SYNC_EXCLUSIONS) {
      assert.ok(exclusion.reason.trim().length > 40, `${exclusion.namespace} has no real reason for being excluded`);
    }

    // Three classes, and each policy declares one of them along with its rule.
    const classes = new Set(SYNC_POLICIES.map((entry) => entry.merges));
    assert.deepEqual([...classes].sort(), ['per-item', 'set-union', 'structured']);
    for (const entry of SYNC_POLICIES) {
      assert.ok(entry.rule.trim().length > 20, `${entry.namespace} has no stated rule`);
      assert.equal(typeof entry.merge, 'function');
    }

    // And the two halves of the seam agree: a store that registered an adopter has a
    // policy, and a policy has a store that will take the merge back.
    const adopters = adoptedNamespaces();
    assert.ok(adopters.length > 0, 'no store registers a sync adopter, so nothing can adopt a merge');
    for (const { namespace, file } of adopters) {
      assert.ok(synced.has(namespace), `${file} adopts "${namespace}" but the policy has no merge for it`);
    }
    assert.deepEqual(
      [...new Set(adopters.map((entry) => entry.namespace))].sort(),
      [...synced].sort(),
      'a namespace the policy merges has no store willing to take the result back',
    );

    assert.equal(policy.namespaces.length, synced.size);
  });

  test('two devices that edited the same namespace offline converge to the same merged state', () => {
    for (const { namespace } of SYNC_POLICIES) {
      for (let seed = 1; seed <= 30; seed += 1) {
        // Two devices, each with its own offline edit, and a server that starts as
        // whatever the first of them managed to push.
        let phone = blobFor(namespace, seed * 7 + 1);
        let tablet = blobFor(namespace, seed * 13 + 5);
        let server = phone;

        // Six rounds of the cycle the engine actually runs: pull, merge, adopt, push —
        // deliberately out of step, and with a duplicate push thrown in, because a
        // reconciler that only converges when both devices take turns is not converged.
        for (let round = 0; round < 6; round += 1) {
          const device = round % 2 === 0 ? 'phone' : 'tablet';
          const local = device === 'phone' ? phone : tablet;
          const merged = merge(namespace, local, server);
          if (device === 'phone') phone = merged;
          else tablet = merged;
          server = merged;
          // The same push landing twice must not move anything.
          server = merge(namespace, merged, server);
        }

        const settledPhone = merge(namespace, phone, server);
        const settledTablet = merge(namespace, tablet, server);
        assert.ok(
          sameData(settledPhone, settledTablet),
          `${namespace} (seed ${seed}) left two devices holding different state:\n` +
            `${stableStringify(settledPhone)}\n${stableStringify(settledTablet)}`,
        );
        assert.ok(
          sameData(settledPhone, server),
          `${namespace} (seed ${seed}) settled on something the account does not hold`,
        );
      }
    }
  });

  test('a device never pushes over a payload from a newer app version', () => {
    const versioned = SYNC_POLICIES.filter((entry) => entry.writes !== null);
    assert.ok(versioned.length >= 5, 'no namespace declares the schema version it writes, so the rule is unenforced');

    for (const entry of versioned) {
      const mine = blobFor(entry.namespace, 3);
      const declared = entry.writes as number;
      const future = { version: declared + 1, wroteBy: 'a build that does not exist yet' };

      // The account's payload came from a newer build. Quiet, not a merge: merging would
      // drop every field this build does not know and push that loss everywhere.
      const result = policy.merge({ namespace: entry.namespace, local: mine, remote: future });
      assert.equal(result.kind, 'quiet', `${entry.namespace} merged a payload from a newer app version`);
      assert.equal(result.kind === 'quiet' ? result.reason : '', 'newer-schema');

      // The same rule the other way round: an older build over a disk a newer one wrote.
      const downgraded = policy.merge({ namespace: entry.namespace, local: future, remote: mine });
      assert.equal(downgraded.kind, 'quiet', `${entry.namespace} pushed over a newer blob on its own disk`);

      // And the version it does write is merged normally, so the rule is not just "quiet".
      const same = policy.merge({ namespace: entry.namespace, local: mine, remote: blobFor(entry.namespace, 4) });
      assert.equal(same.kind, 'merged', `${entry.namespace} refuses the version this build itself writes`);
    }

    // The bare-array namespaces carry no version, so they declare none rather than
    // pretending to one. A version invented for them would be a version nothing writes.
    for (const entry of SYNC_POLICIES.filter((policyEntry) => policyEntry.writes === null)) {
      const result = policy.merge({ namespace: entry.namespace, local: blobFor(entry.namespace, 3), remote: [] });
      assert.equal(result.kind, 'merged', `${entry.namespace} went quiet on a payload with no version at all`);
    }
  });

  test('every merge policy is commutative and idempotent over generated blobs', () => {
    // Set when a `profile` grouping is actually caught disagreeing. The exception carved
    // out below is only honest while it is a fact, so the end of this test insists on it.
    let profileGroupingDiffers = false;
    for (const { namespace } of SYNC_POLICIES) {
      for (let seed = 1; seed <= 40; seed += 1) {
        const a = blobFor(namespace, seed * 3 + 1);
        const b = blobFor(namespace, seed * 5 + 2);

        const forward = merge(namespace, a, b);
        const backward = merge(namespace, b, a);
        assert.ok(
          sameData(forward, backward),
          `${namespace} (seed ${seed}) depends on which device asked:\n` +
            `${stableStringify(forward)}\n${stableStringify(backward)}`,
        );

        const again = merge(namespace, forward, forward);
        assert.ok(sameData(again, forward), `${namespace} (seed ${seed}) changes when the same merge is applied twice`);

        // A device that adopted the merge and then pulled the same merge back — the
        // commonest cycle there is — must find nothing to do.
        const settled = merge(namespace, forward, backward);
        assert.ok(sameData(settled, forward), `${namespace} (seed ${seed}) keeps moving after both sides agree`);

        // And associative, which is what licences the fold in registry.ts. Adoption is a
        // three-way merge: the engine merged this device's blob with the account's before
        // the pull returned, and the store then folds that answer into whatever it holds
        // *now*, which may be a third value the learner wrote in between. If the grouping
        // could change the answer, that fold would be a way to lose one of the three.
        //
        // `profile` is the one exception, and it is the tradeoff the design already took
        // rather than a defect discovered here. Everything outside brain's phrase and
        // error-pattern unions is taken *whole* from the evidence-heavier side, so when
        // two sides carry equal evidence the tiebreak is the canonical rendering of a
        // value the first merge has already changed. Folding a profile is still strictly
        // better than writing over it — a blind adoption lost every field of a write that
        // landed mid-cycle, and the fold can only lose one on a tie — and field-wise merge
        // of `cefr`, `memory` and `stats` is Phase 4's, with the mastery reconciliation.
        const c = blobFor(namespace, seed * 7 + 3);
        const leftFirst = merge(namespace, merge(namespace, a, b), c);
        const rightFirst = merge(namespace, a, merge(namespace, b, c));
        if (namespace === 'profile') {
          if (!sameData(leftFirst, rightFirst)) profileGroupingDiffers = true;
        } else {
          assert.ok(
            sameData(leftFirst, rightFirst),
            `${namespace} (seed ${seed}) depends on the order the three were folded in:\n` +
              `${stableStringify(leftFirst)}\n${stableStringify(rightFirst)}`,
          );
        }
      }
    }
    assert.equal(
      profileGroupingDiffers,
      true,
      'profile now folds the same way whichever grouping is used, so the exception above can go',
    );
  });

  test('the profile row writes the version the store writes', () => {
    // The failure this catches has no symptom. `writes` is the inner schema
    // version this build puts in the profile blob, and the engine goes quiet on
    // anything declaring a higher one. So a store that moves to v6 while this
    // table still says 5 makes the build call *its own merge output* a payload
    // from the future: every profile cycle goes pull-quiet, forever, with
    // nothing on fire and nothing in the log to say why. v6 is the chosen tutor
    // voice, and the way a learner would meet this bug is picking Céline on one
    // phone and never hearing her on the other.
    //
    // Read as text rather than imported, like the caps below: importing
    // profile/store.ts would drag AsyncStorage into a directory whose whole
    // point is that it loads under plain node. `profile/ageStop.test.ts` holds
    // the same coupling from the store's side against a live StoredProfile —
    // two readings of one fact, because this is the fact both of them are for.
    const profilePolicy = SYNC_POLICIES.find((entry) => entry.namespace === 'profile');
    assert.ok(profilePolicy, 'the profile namespace has no sync policy, so this reads nothing');

    const source = readFileSync(join(MOBILE, 'src/profile/store.ts'), 'utf8');
    const declared = source.match(/export interface StoredProfile \{\s*\n\s*version:\s*(\d+);/);
    assert.ok(declared, 'StoredProfile no longer declares a literal version, so this test reads nothing');
    assert.equal(
      profilePolicy.writes,
      Number(declared[1]),
      'sync/policy.ts declares a different profile schema version than profile/store.ts writes',
    );

    // And the same number from the other door: the chain brings every older blob
    // up to exactly the version this build writes, so a policy that agreed with
    // the interface but not with the upgrade would still be wrong.
    const upgraded = upgradeStored({ version: 1, brain: null }, FIXED_NOW);
    assert.ok(upgraded, 'the version chain refused a v1 blob, so this reads nothing');
    assert.equal(
      profilePolicy.writes,
      upgraded.version,
      'sync/policy.ts declares a different profile schema version than profile/upgrade.ts brings blobs to',
    );

    // The rule that number buys, driven rather than asserted: one past it is a
    // payload from a newer build and this device declines to merge it.
    const future = { version: Number(declared[1]) + 1, name: 'from a build that does not exist yet' };
    const result = policy.merge({ namespace: 'profile', local: genProfile(chooser(7)), remote: future });
    assert.equal(result.kind, 'quiet', 'the profile row merged a payload from a newer app version');
    assert.equal(result.kind === 'quiet' ? result.reason : '', 'newer-schema');
  });

  test('the caps this policy re-applies are the caps the stores enforce', () => {
    assert.equal(
      MAX_HISTORY_SESSIONS,
      constantIn('src/progress/store.ts', 'MAX_SESSIONS'),
      'the history cap in policy.ts no longer matches progress/store.ts',
    );
    assert.equal(
      MAX_SOUND_CHECKS,
      constantIn('src/soundcheck/store.ts', 'MAX_EVIDENCE'),
      'the sound-check cap in policy.ts no longer matches soundcheck/store.ts',
    );
    assert.equal(
      MAX_COMPLETIONS_PER_MISSION,
      constantIn('src/missions/store.ts', 'COMPLETIONS_PER_MISSION'),
      'the mission cap in policy.ts no longer matches missions/store.ts',
    );
    assert.equal(
      ACTIVITY_KEEP_DAYS,
      constantIn('src/progress/activity.ts', 'KEEP_DAYS'),
      'the activity retention window in policy.ts no longer matches progress/activity.ts',
    );
    assert.equal(
      MAX_BOOKMARKS,
      constantIn('src/bookmarks/store.ts', 'MAX_BOOKMARKS'),
      'the bookmark cap in policy.ts no longer matches bookmarks/store.ts',
    );
    assert.equal(
      MAX_SCENARIO_RECORDS,
      constantIn('src/missions/progressStore.ts', 'MAX_SCENARIO_RECORDS'),
      'the partial-scene cap in policy.ts no longer matches missions/progressStore.ts',
    );

    // And the caps actually bite, rather than being constants nothing reads.
    const many = Array.from({ length: MAX_HISTORY_SESSIONS + 20 }, (_, i) => ({
      endedAt: BASE + i * DAY,
      summary: { lessonId: 'cafe', turns: i },
    }));
    const history = merge('history', many.slice(0, 40), many.slice(20)) as { endedAt: number }[];
    assert.equal(history.length, MAX_HISTORY_SESSIONS);
    assert.equal(history[history.length - 1]?.endedAt, many[many.length - 1]?.endedAt, 'the cap dropped the newest');

    const attempts = Array.from({ length: MAX_SOUND_CHECKS + 10 }, (_, i) => ({
      missionId: 'mission:cafe',
      reference: 'bonjour',
      at: BASE + i * 1000,
      kind: 'assessed-clear',
      focus: null,
      phoneme: null,
    }));
    const checks = merge('soundChecks', { version: 1, evidence: attempts }, null) as { evidence: unknown[] };
    assert.equal(checks.evidence.length, MAX_SOUND_CHECKS);

    const finishes = Array.from({ length: MAX_COMPLETIONS_PER_MISSION + 6 }, (_, i) => ({
      id: 'mission:cafe',
      at: BASE + i * DAY,
      rung: 3,
    }));
    const missions = merge('missions', { version: 1, completions: finishes }, null) as { completions: unknown[] };
    assert.equal(missions.completions.length, MAX_COMPLETIONS_PER_MISSION);

    // The two daily stores are capped by decision rather than by content, so their caps
    // are checked on distinct ids: one row per situation and one row per mission means a
    // list only reaches the ceiling when the learner has that many different opinions.
    const taps = Array.from({ length: MAX_BOOKMARKS + 15 }, (_, i) => ({
      scenarioId: `scene:${String(i).padStart(4, '0')}`,
      at: BASE + i * 1000,
      saved: true,
    }));
    const saved = merge('bookmarks', { version: 1, items: taps }, null) as { items: { scenarioId: string }[] };
    assert.equal(saved.items.length, MAX_BOOKMARKS);
    assert.equal(
      saved.items[saved.items.length - 1]?.scenarioId,
      taps[taps.length - 1]?.scenarioId,
      'the bookmark cap dropped the newest decision instead of the oldest',
    );

    const walkOuts = Array.from({ length: MAX_SCENARIO_RECORDS + 8 }, (_, i) => ({
      missionId: `mission:${String(i).padStart(4, '0')}`,
      at: BASE + i * 1000,
      elapsedMs: 60_000,
      beatsDone: 2,
    }));
    const partial = merge('scenarioProgress', { version: 1, records: walkOuts }, null) as { records: unknown[] };
    assert.equal(partial.records.length, MAX_SCENARIO_RECORDS);

    // The activity prune is measured from the newest entry, never from a clock: two
    // devices with different clocks would otherwise sit either side of the cutoff and
    // trade the same entry back and forth for as long as both were running.
    const old = { at: BASE, kind: 'lesson', xp: 10 };
    const recent = { at: BASE + (ACTIVITY_KEEP_DAYS + 5) * DAY, kind: 'convo', xp: 20 };
    const pruned = merge('activity', { version: 1, entries: [old] }, { version: 1, entries: [recent] }) as {
      entries: { at: number }[];
    };
    assert.deepEqual(
      pruned.entries.map((entry) => entry.at),
      [recent.at],
      'an entry beyond the retention window survived the merge',
    );
  });

  test('a namespace absent on both sides never creates a row', () => {
    for (const { namespace } of SYNC_POLICIES) {
      const result = policy.merge({ namespace, local: null, remote: null });
      assert.equal(result.kind, 'merged');
      assert.equal(
        result.kind === 'merged' ? result.data : 'not-merged',
        null,
        `${namespace} invents a value out of two absences, so every unused store would write a row per launch`,
      );
    }
  });

  test('a corrupt payload never takes good local data with it', () => {
    const corrupt: unknown[] = ['not an object', 42, [], { version: 'one' }, { entries: 'lots' }, { topics: null }];
    for (const { namespace } of SYNC_POLICIES) {
      const mine = blobFor(namespace, 2);
      for (const junk of corrupt) {
        const result = policy.merge({ namespace, local: mine, remote: junk });
        assert.ok(result.kind === 'merged' || result.kind === 'quiet', `${namespace} answered nothing at all`);
        if (result.kind !== 'merged') continue;
        // Whatever comes back, merging it with this device's own copy again is stable —
        // the property that stops a corrupt row starting an endless push loop.
        const twice = merge(namespace, result.data, mine);
        const thrice = merge(namespace, twice, result.data);
        assert.ok(sameData(twice, thrice), `${namespace} keeps moving after meeting ${stableStringify(junk)}`);
      }
    }

    // The one shape that is genuinely unreadable on both sides is reported, not merged.
    const unreadable = policy.merge({ namespace: 'profile', local: 'nonsense', remote: 7 });
    assert.equal(unreadable.kind, 'quiet');
    assert.equal(unreadable.kind === 'quiet' ? unreadable.reason : '', 'unreadable-local');
  });

  test('the profile and deck merges are delegated to brain and core, not restated here', () => {
    const a = genProfile(chooser(11));
    const b = genProfile(chooser(29));
    const throughPolicy = merge('profile', a, b);
    const throughBrain = mergeStoredProfiles(
      { stored: a, savedAt: 0 },
      { stored: b, savedAt: 0 },
      { upgrade: (stored, when) => upgradeStored(stored, when), now: FIXED_NOW },
    );
    assert.ok(sameData(throughPolicy, throughBrain), 'the profile policy is not brain mergeStoredProfiles');

    const deckA = genReview(chooser(3));
    const deckB = genReview(chooser(17));
    assert.ok(sameData(merge('review', deckA, deckB), mergeDecks(deckA, deckB)), 'the deck policy is not core mergeDecks');

    // Delegation is the point, so the file must not carry its own copy of a scheduling or
    // mastery rule. Both words appear only inside comments explaining why they are absent.
    const source = readFileSync(join(MOBILE, 'src/sync/policy.ts'), 'utf8')
      .split('\n')
      .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
      .join('\n');
    for (const forbidden of ['MASTERY_USES', 'applyGrade', 'intervalDays', 'evictOverflowPhrases']) {
      assert.ok(!source.includes(forbidden), `policy.ts reaches for ${forbidden} instead of delegating the judgement`);
    }
  });

  test('a merge that throws costs one namespace one pass, never the cycle', () => {
    const exploding = {
      get version(): number {
        throw new Error('this payload bites');
      },
    };
    const result = policy.merge({ namespace: 'activity', local: exploding, remote: { version: 1, entries: [] } });
    assert.equal(result.kind, 'quiet', 'a throwing payload escaped the policy and would reject the engine cycle');
    assert.equal(result.kind === 'quiet' ? result.reason : '', 'unreadable-local');

    // An excluded namespace reaching this by some other route is answered, not merged.
    for (const { namespace } of SYNC_EXCLUSIONS) {
      const excluded = policy.merge({ namespace, local: { a: 1 }, remote: { b: 2 } });
      assert.equal(excluded.kind, 'quiet', `${namespace} was merged despite being excluded`);
      assert.equal(excluded.kind === 'quiet' ? excluded.reason : '', 'not-synced');
    }
  });
});

/**
 * The doc and the table, held to each other.
 *
 * `docs/STATE_AND_STORAGE.md` is where somebody looks to find out where a learner's data
 * lives, and a storage doc that has drifted from the storage is worse than none: it is
 * confidently wrong. Two things are checked, and the second one is a P2 that cannot close
 * this phase — which is exactly why it needs a test rather than a good intention.
 */
describe('the storage doc says what the sync table does', () => {
  const doc = readFileSync(join(MOBILE, '../../docs/STATE_AND_STORAGE.md'), 'utf8');

  test('the storage doc names the pre-recap owner and its durable recovery path', () => {
    const window = doc.slice(doc.indexOf('### The pre-recap window'));
    assert.ok(window.length > 0, 'the storage doc no longer has a pre-recap window section');

    // The window itself: a session that ends before the recap arrives.
    assert.match(window, /BEFORE it|BEFORE the recap/, 'the doc does not say when the window opens');

    // Its owner, named as the thing that would have to change.
    assert.match(window, /Owner: tutor-agent/, 'the doc does not say who owns the window');

    // The server-owned artefact that closes the delivery loss.
    assert.match(window, /Conversation Pack/, 'the doc does not name the durable recovery artefact');
    assert.match(window, /conversation_packs/, 'the doc does not name the durable server table');
    assert.match(window, /generating/, 'the doc does not name the early recovery state');
    assert.match(window, /ready/, 'the doc does not name the curated recovery state');

    // The agent half, which fails silently and is the easiest half to forget.
    assert.match(window, /extractMemory/, 'the doc does not name the agent-side call that is dropped');
    assert.match(window, /curateAndDrill/, 'the doc does not name the agent-side call that is dropped');
    assert.match(window, /convo\.ts/, 'the doc does not say which file the dropped work is in');

    assert.match(window, /outbox guarantee/, 'the doc does not name the remaining delivery limit');
  });

  test('the storage doc lists the namespaces the policy actually syncs and excludes', () => {
    const contract = doc.slice(doc.indexOf('### The sync contract'));
    assert.ok(contract.length > 0, 'the storage doc has no sync contract section');
    for (const { namespace } of SYNC_POLICIES) {
      assert.match(contract, new RegExp(`\`${namespace}\``), `the doc does not mention the synced ${namespace}`);
    }
    for (const { namespace } of SYNC_EXCLUSIONS) {
      assert.match(contract, new RegExp(`\`${namespace}\``), `the doc does not mention the excluded ${namespace}`);
    }
    // The three claims the whole design rests on, so a rewrite cannot quietly drop one.
    assert.match(contract, /commutative and idempotent/, 'the doc dropped the convergence claim');
    assert.match(contract, /newer than this\s+build writes|newer than this build writes/, 'the doc dropped the newer-schema rule');
    assert.match(contract, /Nothing is recomputed/, 'the doc dropped the no-recomputation rule');
  });

  test('the storage doc names the profile version the store writes — F380', () => {
    // The doc said "version 5" while the store wrote 6, and would have gone on
    // saying it while the store wrote 7. The number and the shape are read out
    // of profile/store.ts as text, for the same reason the writes test above
    // does: importing the store drags AsyncStorage into a plain-node suite.
    const source = readFileSync(join(MOBILE, 'src/profile/store.ts'), 'utf8');
    const declared = source.match(/export interface StoredProfile \{\s*\n\s*version:\s*(\d+);/);
    assert.ok(declared, 'StoredProfile no longer declares a literal version, so this test reads nothing');
    const said = doc.match(/`profile` is at \*\*version (\d+)\*\*/);
    assert.ok(said, 'the storage doc no longer says which version the profile is at');
    assert.equal(said[1], declared[1], `the doc says version ${said[1]} and the store writes ${declared[1]}`);

    // The shape block names the version the store writes, and the two fields
    // that arrived after the doc was last true.
    const shape = doc.match(/\{ version: (\d+),([^}]*)brain: LearnerProfile \}/);
    assert.ok(shape, 'the storage doc no longer shows the stored profile shape');
    assert.equal(shape[1], declared[1], 'the shape block shows an older version than the store writes');
    for (const field of ['ageStopAt', 'tutorVoice', 'preferTyping']) {
      assert.match(shape[2]!, new RegExp(`\\b${field}\\b`), `the shape block does not name ${field}`);
    }
    assert.match(doc, /returns a version-\d+ profile/, 'the doc no longer says what upgradeStored returns');
    assert.match(doc, new RegExp(`returns a version-${declared[1]} profile`), 'the doc says upgradeStored returns an older version');
  });
});

/**
 * The other side of the wire.
 *
 * `SYNC_POLICIES` is the app's half of the contract and, until F411, it was the only
 * half anything checked. The database has a half too: `learner_state.namespace` carries
 * a check constraint listing the names it will accept, and a namespace missing from it
 * is refused with a 400 that `sync/engine.ts` files as `http-error` and retries under
 * backoff forever. Nothing corrupts, nothing on screen changes, and the data never
 * leaves the phone. That is the quietest failure in this system, and it is why the two
 * lists are compared here rather than trusted to stay in step.
 *
 * The migrations are read rather than a copy of the list being kept: a second copy is
 * how the first one stopped being the rule. The newest `add constraint` on the
 * namespace column wins, because a later migration may widen or narrow what an earlier
 * one set, and what a deployed database ends up with is the last one applied.
 */
describe('the app and the database agree about what a namespace is — F411', () => {
  test('every namespace the sync policy merges is one the database will accept — F411', () => {
    const migrationsDir = fileURLToPath(new URL('../../../../supabase/migrations/', import.meta.url));
    const files = readdirSync(migrationsDir)
      .filter((name) => name.endsWith('.sql'))
      .sort();
    assert.ok(files.length > 0, 'no migrations were found, so this test is reading the wrong directory');

    // Every definition of the whitelist, oldest first; the last one is what a database
    // that applied them all ends up enforcing.
    const definitions: string[][] = [];
    for (const name of files) {
      const sql = readFileSync(join(migrationsDir, name), 'utf8').replace(/\s+/g, ' ');
      for (const [, list] of sql.matchAll(/namespace (?:text not null )?(?:in|check \(namespace in) \(([^)]*)\)/gi)) {
        const names = [...list!.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
        if (names.length > 0) definitions.push(names);
      }
    }
    assert.ok(
      definitions.length > 0,
      'no namespace whitelist was found in any migration, so this test cannot see the database half at all',
    );

    const accepted = new Set(definitions[definitions.length - 1]);
    for (const policy of SYNC_POLICIES) {
      assert.ok(
        accepted.has(policy.namespace),
        `the sync policy merges "${policy.namespace}" but learner_state will refuse it, so it never leaves the device`,
      );
    }

    // And nothing the database accepts is a name the app has simply forgotten. A
    // namespace may be merged, or it may be excluded on purpose with a reason written
    // down; what it may not be is neither, because that is a row a device can write and
    // nothing will ever fold.
    const merged = new Set(SYNC_POLICIES.map((policy) => policy.namespace));
    const excluded = new Set(SYNC_EXCLUSIONS.map((exclusion) => exclusion.namespace));
    for (const namespace of accepted) {
      assert.ok(
        merged.has(namespace) || excluded.has(namespace),
        `learner_state accepts "${namespace}" but the app neither merges nor excludes it, so a row could be written that nothing folds`,
      );
    }
  });
});
