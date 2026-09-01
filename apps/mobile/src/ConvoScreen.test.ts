/**
 * The way out of a conversation, and what it is allowed to delete.
 *
 * `live/journal.test.ts` proves the outbox: three stores write, three answer,
 * and the journal goes only when all three said `durable`. What it cannot prove
 * is that the app ever walks through it. The conversation screen had its own
 * banking, written before the acknowledgements existed, and it did three things
 * that each look harmless on their own:
 *
 *   practiceBankedRef.current = true;                          // before any disk
 *   void mergeSessionTopics(...);                              // not awaited
 *   void addPhrases(..., { stagger: true }).then(clearJournal); // a promise, not an ack
 *
 * A resolved promise from a store that swallowed a full disk is indistinguishable
 * from a successful write, so a phone with no room could resolve all three and
 * delete the only copy of the conversation. The outbox was closed and the live
 * path still went round it, which is a fix that certifies a route nobody takes.
 *
 * So this file asks two different questions with two different tools. The source
 * walk says the screen goes through `bankPractice`; there is no renderer here
 * (docs/TESTING.md) and a component's wiring is what a file can be asked about.
 * The disk tests then run the batch the screen builds and check what survives —
 * both banks it can make, because the learner who taps Done while the practice
 * message is still in flight loses exactly as much as the one who waits.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createProfile } from '@luvani/brain/profile';
import { evidenceOf, phraseKeyOf, type ConvoPhrase, type DrillExercise, type RecapPayload } from '@luvani/core';

import { loadDrillBank } from './drill/store.ts';
import { bankPractice, journalDrills, journalRecap } from './live/journal.ts';
import { convoUsesFrom, type PracticeBatch } from './live/journalRules.ts';
import { loadDeck } from './review/store.ts';
import { setActiveUser } from './storage/scope.ts';
import { loadTopics } from './topics/store.ts';

const NOW = new Date(2026, 7, 20, 14).getTime();

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const phrase = (fr: string, en: string): ConvoPhrase =>
  ({ fr, frWritten: null, en, enLiteral: null, register: 'familier', note: null }) as ConvoPhrase;

const drill = (id: string, phraseKey: string): DrillExercise =>
  ({ id, phraseKey, kind: 'listen-type', difficulty: 'production', fr: 'Ça marche', accepted: ['ça marche'] }) as DrillExercise;

const recap = (): RecapPayload => ({
  headline: 'You ordered a coffee.',
  wins: ['You said it without help.'],
  fixes: [],
  phrases: [phrase('Ça marche', 'coming up'), phrase('Autre chose', 'something else')],
  nextFocus: 'The u sound',
  topics: [{ fr: 'Au café', en: 'Ordering at the café' }],
  cefr: { estimate: 'A1', confidence: 'low' },
  stats: { turns: 6, rescues: 1, unassistedRate: 0.7 },
});

/** The learner model the recap arrives with, in the shape the brain writes it. */
function profileWith(used: Record<string, number>): unknown {
  const profile = createProfile();
  for (const [fr, timesUsedWell] of Object.entries(used)) {
    profile.phrases[fr.toLowerCase()] = {
      fr,
      frWritten: null,
      en: 'used in conversation',
      register: 'familier',
      introducedAt: new Date(NOW).toISOString(),
      timesUsedWell,
      mastered: false,
    };
  }
  return profile;
}

interface DiskFaults {
  full?: (key: string) => boolean;
}

/** One in-memory AsyncStorage, shared by every store, that can refuse a key. */
function installDisk(faults: DiskFaults = {}): Map<string, string> {
  const map = new Map<string, string>();
  const shared = AsyncStorage as unknown as Record<string, unknown>;
  shared.getItem = (key: string): Promise<string | null> => Promise.resolve(map.get(key) ?? null);
  shared.setItem = (key: string, value: string): Promise<void> => {
    if (faults.full?.(key)) return Promise.reject(new Error('QuotaExceededError'));
    map.set(key, value);
    return Promise.resolve();
  };
  shared.removeItem = (key: string): Promise<void> => {
    map.delete(key);
    return Promise.resolve();
  };
  return map;
}

let uids = 0;
const nextUid = (): string => `33333333-3333-4333-8333-${String(++uids).padStart(12, '0')}`;
const journalKeyOf = (uid: string): string => `luvani.u.${uid}.journal`;

/**
 * The batch ConvoScreen's `practiceBatch` builds, rebuilt here.
 *
 * A copy, and the test below pins it to the original by reading the three
 * decisions out of the screen: an unnamed batch, drills defaulted to none, and
 * the conversation counts read through `convoUsesFrom` rather than counted
 * again. There is no renderer, so the alternative to a pinned copy is not
 * calling the real function, it is not testing the batch at all.
 */
function screenBatch(
  phrases: readonly ConvoPhrase[],
  parts: { topics: PracticeBatch['topics']; drills: DrillExercise[] | null; profile: unknown },
): PracticeBatch {
  return {
    batchId: null,
    phrases: [...phrases],
    topics: parts.topics,
    drills: parts.drills ?? [],
    convoUses: convoUsesFrom(parts.profile),
  };
}

/** What the practice message hands the screen, curated into topics. */
const PRACTICE = [
  { titleFr: 'Au café', titleEn: 'Ordering at the café', phrases: recap().phrases },
];

/** The ordinary bank: the whole practice message, keyed the way the screen keys it. */
const ordinaryBatch = (profile: unknown, drills: DrillExercise[] | null = null): PracticeBatch =>
  screenBatch(PRACTICE.flatMap((t) => t.phrases), {
    topics: PRACTICE.map((t) => ({
      title: { fr: t.titleFr, en: t.titleEn },
      phraseKeys: t.phrases.map((p) => phraseKeyOf(p.fr)),
    })),
    drills,
    profile,
  });

/** The early exit: the recap's first few phrases under the session's own topic. */
function earlyExitBatch(profile: unknown): PracticeBatch {
  const payload = recap();
  const phrases = payload.phrases.slice(0, 5);
  const home = payload.topics[0]!;
  return screenBatch(phrases, {
    topics: [{ title: home, phraseKeys: phrases.map((p) => phraseKeyOf(p.fr)) }],
    drills: null,
    profile,
  });
}

/** A conversation that reached the recap and the drills, and is still on disk. */
async function journalledSession(profile?: unknown): Promise<void> {
  await journalRecap(recap(), { savedAt: NOW, profile });
  await journalDrills([drill('gen:one', 'phrase:ça marche')], NOW);
}

describe('the conversation screen banks through the outbox — F118, F124', () => {
  test('the practice a conversation leaves behind is banked once every store has written it down', async () => {
    const uid = nextUid();
    const disk = installDisk();
    setActiveUser(uid);
    await journalledSession(profileWith({ 'Ça marche': 2 }));
    assert.ok(disk.has(journalKeyOf(uid)), 'the session was journalled before anything tried to bank it');

    const result = await bankPractice(ordinaryBatch(profileWith({ 'Ça marche': 2 })));

    assert.equal(result, 'banked', 'every store wrote and the bank still called itself unfinished');
    assert.equal(disk.has(journalKeyOf(uid)), false, 'the journal is kept for a batch that is safely on disk');
    assert.deepEqual(
      (await loadDeck()).map((c) => c.id).sort(),
      ['phrase:autre chose', 'phrase:ça marche'],
      'the phrases the tutor curated did not reach the deck',
    );
    assert.equal((await loadTopics()).length, 1, 'the conversation left no topic behind');
    // The brain's tally rides the same write, so a phrase somebody has started
    // using unprompted looks different from one they read once.
    const used = (await loadDeck()).find((c) => c.id === 'phrase:ça marche')!;
    assert.equal(evidenceOf(used).convoUses, 2, 'the conversation counts did not reach the card');
  });

  test('a bank the phone refuses leaves the conversation exactly where it was', async () => {
    // The bug this closes, in one line: the old path resolved, cleared, and the
    // conversation existed nowhere. Kept means the next launch banks it again,
    // which is safe because every merge in the path folds by content identity.
    const uid = nextUid();
    const disk = installDisk({ full: (key) => key === `luvani.u.${uid}.review` });
    setActiveUser(uid);
    await journalledSession();

    const result = await bankPractice(ordinaryBatch(null));

    assert.equal(result, 'kept', 'a bank with a refused write called itself finished');
    assert.ok(disk.has(journalKeyOf(uid)), 'the only copy of the conversation was deleted anyway');
    assert.equal(disk.has(`luvani.u.${uid}.review`), false, 'the test disk did not actually refuse the deck');
    assert.ok(disk.has(`luvani.u.${uid}.topics`), 'the store that could write still wrote');
  });

  test('leaving before the practice message lands banks through the same outbox', async () => {
    // An early exit that loses the journal is the same bug one beat earlier, so
    // the minimal batch travels the identical path rather than a shortcut.
    const uid = nextUid();
    const disk = installDisk();
    setActiveUser(uid);
    await journalledSession();

    const result = await bankPractice(earlyExitBatch(profileWith({ 'Autre chose': 1 })));

    assert.equal(result, 'banked');
    assert.equal(disk.has(journalKeyOf(uid)), false, 'the journal outlived a batch every store acknowledged');
    assert.deepEqual(
      (await loadDeck()).map((c) => c.id).sort(),
      ['phrase:autre chose', 'phrase:ça marche'],
      'the early exit lost what the learner said',
    );
  });

  test('an early exit onto a full phone keeps the journal for the next launch', async () => {
    const uid = nextUid();
    const disk = installDisk({ full: (key) => key === `luvani.u.${uid}.topics` });
    setActiveUser(uid);
    await journalledSession();

    assert.equal(await bankPractice(earlyExitBatch(null)), 'kept', 'an early exit with a refused write called itself finished');
    assert.ok(disk.has(journalKeyOf(uid)), 'the early exit deleted the only copy of the conversation');
  });

  test('drills already in hand ride the same acknowledged write', async () => {
    const uid = nextUid();
    installDisk();
    setActiveUser(uid);
    await journalledSession();

    await bankPractice(ordinaryBatch(null, [drill('gen:two', 'phrase:autre chose')]));

    assert.deepEqual(
      (await loadDrillBank()).filter((e) => e.id.startsWith('gen:')).map((e) => e.id),
      ['gen:two'],
      'a batch of drills the screen was holding was dropped by the bank',
    );
  });
});

describe('the conversation screen no longer banks by hand — F118, F124', () => {
  const screen = stripComments(read('./ConvoScreen.tsx'));

  test('both ways out of a conversation go through bankPractice', () => {
    // Journalled first, then banked, and the bank is handed the batch the
    // JOURNAL returned rather than the one the screen built. That return value
    // carries the name of the entry now on disk, and the name is what stops a
    // successful bank clearing a journal this batch did not write.
    const banks = (screen.match(/journalPractice\(practiceBatch\([\s\S]*?\)\)\.then\(bankPractice\)/g) ?? []).length;
    assert.equal(banks, 2, `${banks} of the two banks on this screen journal before they bank`);
    assert.ok(
      !/bankPractice\(practiceBatch\(/.test(screen),
      'a bank on this screen still takes the screen\'s own batch, which carries no journal name',
    );
    assert.ok(
      !/\.then\(\(\) => bankPractice/.test(screen),
      'the journal is being waited on and then ignored, which is the unnamed batch again',
    );

    // The practice effect and the early exit, named so a future reader can see
    // which two callsites this is counting. Both now stand down on a safety
    // stop as well, which is F137 and is proved properly in tutor/safetyView.test.ts.
    assert.match(screen, /if \(!live\.practice \|\| practiceBankedRef\.current \|\| stopped\) return;[\s\S]{0,200}journalPractice\(/);
    assert.match(screen, /if \(!stopped && !practiceBankedRef\.current && live\.recap\)[\s\S]{0,400}journalPractice\(/);

    // And the early exit takes the same few phrases the crash path recovers,
    // from the same named cap rather than a second literal five.
    assert.match(
      screen,
      /phrases\.slice\(0, MAX_RECOVERED_PHRASES\)/,
      'the early exit types its own cap, so the two paths can drift apart',
    );
  });

  test('the screen never writes to a practice store or clears a journal itself', () => {
    // The three that made the old path unsafe. Each one on its own is a store
    // that swallowed a failure and answered anyway; together they are a delete.
    for (const reach of ['addPhrases', 'mergeSessionTopics', 'clearJournal']) {
      assert.ok(!screen.includes(reach), `ConvoScreen still calls ${reach} directly, so the outbox is optional again`);
    }
    assert.doesNotMatch(screen, /\.then\(clearJournal\)/, 'the journal is cleared on a promise resolving again');
  });

  test('the banked flag starts the work and claims nothing about the disk', () => {
    // It is an initiation guard: it stops a second bank starting, and it is not
    // evidence that anything reached a disk. Nothing may read it as durability.
    const uses = [...screen.matchAll(/practiceBankedRef\.current/g)].length;
    assert.ok(uses >= 3, 'the guard was renamed or removed; this test is reading the wrong thing');
    assert.doesNotMatch(
      screen,
      /practiceBankedRef\.current\s*=\s*(await|\()/,
      'the guard is being set from something that answers, which makes it a durability claim',
    );
  });

  test('the conversation counts come from the brain tally rather than a count made on the screen', () => {
    // `repairProfile` is the one place a learner model off the wire is made
    // sense of, and `convoUsesFrom` is the one reader of it. A screen counting
    // this itself is a second opinion about what somebody knows.
    assert.match(screen, /convoUses: convoUsesFrom\(parts\.profile\)/, 'the batch counts uses somewhere of its own');
    assert.match(screen, /batchId: null/, 'a live bank claims to be a journal entry it is not');
    assert.doesNotMatch(screen, /timesUsedWell|repairProfile/, 'the screen reads the learner model itself');
  });
});
