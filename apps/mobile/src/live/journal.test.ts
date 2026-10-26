/**
 * The crash window, and exactly how wide it is.
 *
 * Everything a conversation leaves behind arrives after the room has done its
 * work, in an order the learner cannot see: recap, then practice, then drills.
 * ConvoScreen banks on practice, with a fallback for the learner who taps Done
 * first. Nothing covered the learner who reads the recap and swipes the app
 * away, which is not an exotic way to leave an app.
 *
 * The drills were worse still. They arrive last of all, and ConvoScreen merged
 * them straight into an in-memory bank — so an app closed in that beat lost the
 * whole batch with nothing anywhere recording that it had ever existed. They now
 * ride in the same envelope and are banked by the same once-per-launch pass, and
 * the version 1 journals already sitting on phones are still read rather than
 * discarded by the upgrade that added the field.
 *
 * And the window was narrower than it looked, because closing it depended on
 * three stores that could not say whether they had written anything. They can
 * now, and the last section of this file is about the only question that
 * matters afterwards: when is it safe to delete the only copy of a
 * conversation. The answer is never on a promise resolving, always on three
 * acknowledgements, and a batch that is kept is banked again by a later launch
 * without the learner ever seeing a phrase twice.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { evidenceOf, phraseKeyOf, type DrillExercise, type RecapPayload, type SessionSummary } from '@luvani/core';
import { createProfile } from '@luvani/brain/profile';

import { loadDrillBank } from '../drill/store.ts';
import { gradeCards, loadDeck } from '../review/store.ts';
import { setActiveUser } from '../storage/scope.ts';
import { loadTopics } from '../topics/store.ts';
import { bankLesson, bankPractice, journalDrills, journalPractice, journalRecap, recoverJournal } from './journal.ts';
import {
  JOURNAL_VERSION,
  MAX_RECOVERED_PHRASES,
  convoUsesFrom,
  isWorthKeeping,
  journalFor,
  journalWithDrills,
  recoveryPlan,
  type PracticeBatch,
} from './journalRules.ts';

const NOW = new Date(2026, 7, 20, 14).getTime();

const phrase = (fr: string, en: string) => ({ fr, frWritten: null, en, enLiteral: null, register: 'familier', note: null });

const drill = (id: string, phraseKey: string): DrillExercise =>
  ({ id, phraseKey, kind: 'listen-type', difficulty: 'production', fr: 'Ça marche', accepted: ['ça marche'] }) as DrillExercise;

const recap = (over: Partial<RecapPayload> = {}): RecapPayload => ({
  headline: 'You ordered a coffee.',
  wins: ['You said it without help.'],
  fixes: [],
  phrases: [phrase('Ça marche', 'coming up'), phrase('Autre chose', 'something else')],
  nextFocus: 'The u sound',
  topics: [{ fr: 'Au café', en: 'Ordering at the café' }],
  cefr: { estimate: 'A1', confidence: 'low' },
  stats: { turns: 6, rescues: 1, unassistedRate: 0.7 },
  ...over,
});

describe('the session journal', () => {
  test('the recap is journalled the moment it arrives', () => {
    const journal = journalFor(recap(), NOW);

    assert.equal(journal.version, JOURNAL_VERSION);
    assert.equal(journal.savedAt, NOW);
    assert.deepEqual(journal.phrases.map((p) => p.fr), ['Ça marche', 'Autre chose']);
    assert.deepEqual(journal.topics, [{ fr: 'Au café', en: 'Ordering at the café' }]);
  });

  test('only what becomes practice is kept, not the card the learner is reading', () => {
    // Re-showing a headline or a CEFR estimate a day later would be strange.
    // Phrases and topics are the two things that turn into practice.
    const journal = journalFor(recap(), NOW) as unknown as Record<string, unknown>;
    for (const field of ['headline', 'wins', 'fixes', 'cefr', 'stats', 'nextFocus']) {
      assert.equal(journal[field], undefined, `${field} has no business surviving the session`);
    }
  });

  test('an empty phrase is not worth a card', () => {
    const journal = journalFor(recap({ phrases: [phrase('  ', 'nothing')] }), NOW);
    assert.deepEqual(journal.phrases, []);
    assert.equal(isWorthKeeping(journal), false, 'and a journal with nothing in it is not worth writing');
  });

  test('banking the session clears the journal, so nothing is banked twice', () => {
    // Clearing is the store's job; what this holds is the other half of it —
    // once cleared, a launch finds nothing and must do nothing. The recap
    // arrives twice, once plain and once enriched with the learner model, so a
    // recovery that ran on leftovers would double every card.
    assert.equal(recoveryPlan(null), null);
    assert.equal(recoveryPlan(undefined), null);
    assert.equal(recoveryPlan({ version: JOURNAL_VERSION, savedAt: NOW, phrases: [], topics: [] }), null);
  });

  test('a journal orphaned by a crash banks its phrases on the next launch', () => {
    const plan = recoveryPlan(journalFor(recap(), NOW));

    assert.ok(plan, 'there is something to do');
    assert.deepEqual(plan.phrases.map((p) => p.fr), ['Ça marche', 'Autre chose']);
    assert.equal(plan.topics.length, 1, 'under the session it came from');
    assert.equal(plan.topics[0]!.title.en, 'Ordering at the café');
    assert.deepEqual(
      [...plan.topics[0]!.phraseKeys],
      ['phrase:ça marche', 'phrase:autre chose'],
      'keyed exactly as review/store.ts keys them, or the topic points at cards that do not exist',
    );
  });

  test('a journal from a version this build does not understand is left alone', () => {
    assert.equal(recoveryPlan({ ...journalFor(recap(), NOW), version: 99 }), null);
  });

  test('a corrupt journal is nothing to do, not a crash on launch', () => {
    // Same reasoning as topics/store.ts: the deck underneath lost nothing, and
    // the alternative is an app that will not open.
    assert.equal(recoveryPlan('nonsense'), null);
    assert.equal(recoveryPlan({ version: JOURNAL_VERSION, phrases: 'not an array' }), null);
    const halfBad = { version: JOURNAL_VERSION, savedAt: NOW, phrases: [phrase('Ça marche', 'coming up'), { fr: 5 }], topics: [] };
    assert.deepEqual(recoveryPlan(halfBad)?.phrases.map((p) => p.fr), ['Ça marche'], 'the readable half still lands');
  });

  test('a session with no topic still recovers its phrases', () => {
    // Topics are a nicety; the cards are the point.
    const plan = recoveryPlan(journalFor(recap({ topics: [] }), NOW));
    assert.equal(plan?.phrases.length, 2);
    assert.deepEqual(plan?.topics, []);
  });
});

/**
 * The store half, which needs a disk.
 *
 * AsyncStorage resolves under plain node but has no implementation off a
 * device, so the module object every store shares is given one here. Same
 * arrangement as storage/storeBinding.test.ts, and the reason a crash-recovery
 * promise can be checked at all without a simulator.
 */
interface DiskFaults {
  /** This key has no room. The write is refused, exactly as a full phone does. */
  full?(key: string): boolean;
  /** The process died before the delete ran, so the key is still there. */
  neverDeletes?: boolean;
  /** Something to do while a read is in flight — a sign-out, say. */
  during?(key: string): void;
}

function installDisk(initial: Record<string, string> = {}, faults: DiskFaults = {}): Map<string, string> {
  const map = new Map<string, string>(Object.entries(initial));
  const shared = AsyncStorage as unknown as Record<string, unknown>;
  shared.getItem = (key: string): Promise<string | null> => {
    const value = map.get(key) ?? null;
    faults.during?.(key);
    return Promise.resolve(value);
  };
  shared.setItem = (key: string, value: string): Promise<void> => {
    if (faults.full?.(key)) return Promise.reject(new Error('QuotaExceededError'));
    map.set(key, value);
    return Promise.resolve();
  };
  shared.removeItem = (key: string): Promise<void> => {
    if (faults.neverDeletes !== true) map.delete(key);
    return Promise.resolve();
  };
  return map;
}

let uids = 0;
const nextUid = (): string => `22222222-2222-4222-8222-${String(++uids).padStart(12, '0')}`;

describe('the drills a conversation leaves behind', () => {
  test('drills that arrived before the app closed are banked on the next launch', async () => {
    // The whole point of the outbox: the batch is written down the moment it
    // arrives, the app dies before anything banks it, and the next launch finds
    // it and puts it in the bank.
    const uid = nextUid();
    const disk = installDisk();
    setActiveUser(uid);

    await journalRecap(recap(), { savedAt: NOW });
    await journalDrills([drill('gen:crashed', 'phrase:ça marche')], NOW);

    // The app is gone. Nothing merged the batch, nothing cleared the journal.
    assert.ok(disk.has(`luvani.u.${uid}.journal`), 'the batch was on disk when the app died');

    const banked = await recoverJournal();

    assert.equal(banked, 2, 'the recap phrases were banked too');
    assert.deepEqual(
      (await loadDrillBank()).filter((e) => e.id.startsWith('gen:')).map((e) => e.id),
      ['gen:crashed'],
      'the batch the tutor authored reached the bank on the launch after the crash',
    );
    assert.ok(
      (await loadDeck()).some((card) => card.id === 'phrase:ça marche'),
      'and the phrases still bank, because drills did not displace them',
    );
    assert.equal(disk.has(`luvani.u.${uid}.journal`), false, 'banked, then cleared — never the other order');
  });

  test('a journal written by the build before this one still banks everything it holds', async () => {
    // Repair forward, never reinterpret in place. A learner whose app died the
    // day they updated has a version 1 envelope on disk with no drills field,
    // and dropping it would lose the session to the upgrade that was meant to
    // protect it.
    const uid = nextUid();
    const disk = installDisk({
      [`luvani.u.${uid}.journal`]: JSON.stringify({
        version: 1,
        savedAt: NOW,
        phrases: [phrase('Autre chose', 'something else')],
        topics: [{ fr: 'Au café', en: 'Ordering at the café' }],
      }),
    });
    setActiveUser(uid);

    assert.equal(await recoverJournal(), 1, 'the old envelope was read, not discarded');
    assert.ok((await loadDeck()).some((card) => card.id === 'phrase:autre chose'));
    assert.equal(disk.has(`luvani.u.${uid}.journal`), false);
  });

  test('a batch that arrives after the recap does not erase the phrases waiting beside it', async () => {
    const uid = nextUid();
    const disk = installDisk();
    setActiveUser(uid);

    await journalRecap(recap(), { savedAt: NOW });
    await journalDrills([drill('gen:late', 'phrase:ça marche')], NOW);

    const written = JSON.parse(disk.get(`luvani.u.${uid}.journal`)!) as { phrases: unknown[]; drills: unknown[] };
    assert.equal(written.phrases.length, 2, 'the recap phrases are still in the envelope');
    assert.equal(written.drills.length, 1, 'and so is the batch');
  });

  test('a recap landing on a journal that already holds drills carries them across', () => {
    // The ordinary order is recap then drills, so this is usually a no-op. When
    // it is not, the alternative is a write that silently deletes a batch that
    // is banked nowhere else.
    const withDrills = journalWithDrills(null, [drill('gen:first', 'phrase:one')], NOW);
    assert.equal(isWorthKeeping(withDrills), true, 'a batch with no phrases is still worth keeping');
    assert.equal(recoveryPlan(withDrills)?.drills.length, 1, 'and worth recovering on its own');
    assert.deepEqual(recoveryPlan(withDrills)?.phrases, [], 'without inventing a phrase to go with it');
  });

  test('a batch of drills nobody can identify is not banked at all', () => {
    const plan = recoveryPlan({
      version: JOURNAL_VERSION,
      savedAt: NOW,
      phrases: [phrase('Ça marche', 'coming up')],
      topics: [],
      drills: [drill('gen:good', 'phrase:ça marche'), { id: 'gen:bad' }, 'nonsense'],
    });
    assert.deepEqual(plan?.drills.map((d) => d.id), ['gen:good'], 'the readable half still lands');
  });
});

/**
 * When it is safe to delete the only copy of a conversation.
 *
 * `bankPractice` is the whole answer, and every test below is one way it can be
 * wrong. Three stores write, three answer, and the journal goes only if all
 * three said `durable`. Anything else keeps the batch for a later launch, which
 * is safe because every merge in the path is by content identity and the
 * conversation counts fold by max rather than by addition.
 */

const journalKeyOf = (uid: string): string => `luvani.u.${uid}.journal`;

/**
 * A learner model with the counts the brain kept, in the shape the recap
 * carries it. Built from `createProfile()` rather than hand-rolled, so this
 * test cannot drift away from what `repairProfile` accepts.
 */
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
      timesAssisted: 0,
      mastered: false,
    };
  }
  return profile;
}

/** A conversation that reached the recap and the drills, and was never banked. */
async function journalledSession(disk: Map<string, string>, uid: string, profile?: unknown): Promise<PracticeBatch> {
  await journalRecap(recap(), { savedAt: NOW, profile });
  await journalDrills([drill('gen:one', 'phrase:ça marche')], NOW);
  const plan = recoveryPlan(JSON.parse(disk.get(journalKeyOf(uid))!));
  assert.ok(plan, 'the session was journalled before anything tried to bank it');
  return plan;
}

/**
 * The app is closed and opened again: the same disk, and not one byte of any
 * store's in-memory cache. Dropping the caches is the point — a "next launch"
 * that still held this launch's cache would prove nothing about what survived.
 */
function relaunch(disk: Map<string, string>, uid: string, faults: DiskFaults = {}): Map<string, string> {
  const next = installDisk(Object.fromEntries(disk), faults);
  setActiveUser(null);
  setActiveUser(uid);
  return next;
}

/** What one banked conversation looks like, however many times it was banked. */
async function assertBankedExactlyOnce(where: string): Promise<void> {
  const deck = await loadDeck();
  assert.equal(deck.filter((card) => card.id === 'phrase:ça marche').length, 1, `${where}: the deck holds two of the same card`);
  assert.equal(deck.filter((card) => card.id === 'phrase:autre chose').length, 1, `${where}: the deck holds two of the same card`);
  const topics = await loadTopics();
  assert.equal(topics.length, 1, `${where}: the same conversation produced two topics`);
  assert.deepEqual(topics[0]!.discussed.length, 1, `${where}: one sitting was recorded as two`);
  assert.equal(
    (await loadDrillBank()).filter((exercise) => exercise.id === 'gen:one').length,
    1,
    `${where}: the bank holds two copies of one drill`,
  );
}

describe('banking a conversation, and what it takes to stop keeping it', () => {
  test('a session journal survives until every practice store acknowledges its write', async () => {
    // The bug this closes: the stores resolved whether or not they wrote, so a
    // full phone cleared the journal and the conversation was gone from both
    // places at once. The drills key is the one with no room here; the journal
    // must stay for as long as that is true.
    const uid = nextUid();
    const disk = installDisk({}, { full: (key) => key === `luvani.u.${uid}.drills` });
    setActiveUser(uid);
    const batch = await journalledSession(disk, uid);

    assert.equal(await bankPractice(batch), 'kept', 'a bank with a refused write called itself finished');
    assert.ok(disk.has(journalKeyOf(uid)), 'the only copy of the conversation was deleted anyway');
    assert.equal(disk.has(`luvani.u.${uid}.drills`), false, 'the test disk did not actually refuse the drills');
    assert.ok(disk.has(`luvani.u.${uid}.review`), 'the two stores that could write still wrote');

    // The phone has room again, which is what a later launch usually finds.
    const after = relaunch(disk, uid);
    assert.equal(await recoverJournal(), 2, 'the kept batch did not bank on the launch that could take it');
    assert.equal(after.has(journalKeyOf(uid)), false, 'and only then is the journal gone');
    await assertBankedExactlyOnce('after a kept batch was banked later');
  });

  test('a storage-full bank keeps the journal for the next launch', async () => {
    // One store at a time, because a quota bites one key at a time and any one
    // of the three going down has to be enough to keep the batch.
    for (const suffix of ['topics', 'review', 'drills']) {
      const uid = nextUid();
      const disk = installDisk({}, { full: (key) => key === `luvani.u.${uid}.${suffix}` });
      setActiveUser(uid);
      const batch = await journalledSession(disk, uid);

      assert.equal(await bankPractice(batch), 'kept', `${suffix}: a refused write did not keep the batch`);
      assert.ok(disk.has(journalKeyOf(uid)), `${suffix}: the journal was cleared with the batch unwritten`);

      relaunch(disk, uid);
      assert.equal(await recoverJournal(), 2, `${suffix}: the retry never happened`);
      await assertBankedExactlyOnce(`${suffix} after the retry`);
    }
  });

  test('a launch that still cannot write keeps the journal for the launch after it', async () => {
    // The retry is the next launch and nothing else — there is no loop in the
    // session, because a phone that is out of space this second is out of space
    // next second. So a launch that finds a journal and still cannot write it
    // has to leave it exactly where it found it, however many launches that
    // takes. This is the one that catches a recovery which banks and then
    // clears regardless, which is what recovery did before this contract.
    const uid = nextUid();
    const noRoom = { full: (key: string) => key === `luvani.u.${uid}.review` };
    let disk = installDisk({}, noRoom);
    setActiveUser(uid);
    await journalledSession(disk, uid);

    disk = relaunch(disk, uid, noRoom);
    assert.equal(await recoverJournal(), 0, 'a launch that banked nothing reported work it did not do');
    assert.ok(disk.has(journalKeyOf(uid)), 'the journal was cleared by a launch that could not write the deck');

    disk = relaunch(disk, uid);
    assert.equal(await recoverJournal(), 2, 'the batch never banked once the phone had room');
    assert.equal(disk.has(journalKeyOf(uid)), false);
    await assertBankedExactlyOnce('after two launches');
  });

  test('a crash between acknowledgement and clear replays the batch without double banking', async () => {
    // Every store said durable, and the process died before the delete ran. The
    // journal is therefore still on disk holding a batch that is already banked,
    // and the next launch will bank it again. That has to cost nothing: no
    // second card, no second topic, no second drill, no inflated count, and —
    // the one that would hurt most — no reset of scheduling the learner earned.
    const uid = nextUid();
    const disk = installDisk({}, { neverDeletes: true });
    setActiveUser(uid);
    const batch = await journalledSession(disk, uid, profileWith({ 'Ça marche': 2 }));

    assert.equal(await bankPractice(batch), 'banked', 'the practice reached every store, so the bank succeeded');
    assert.ok(disk.has(journalKeyOf(uid)), 'the crash left the journal behind, which is the whole scenario');

    // A sitting in between, so the replay has something of the learner's to
    // ruin: a rep, a due date pushed out, and the retrieval that earned them.
    await gradeCards([{ id: 'phrase:ça marche', grade: 'good', attempt: 'typed' }]);
    const graded = (await loadDeck()).find((card) => card.id === 'phrase:ça marche')!;
    assert.equal(graded.reps, 1);
    assert.equal(evidenceOf(graded).retrievals, 1, 'the store did not carry what earned the grade through to the card');

    const after = relaunch(disk, uid);
    assert.equal(await recoverJournal(), 2, 'the leftover journal was not banked');
    assert.equal(after.has(journalKeyOf(uid)), false, 'and this time it cleared');

    await assertBankedExactlyOnce('after the replay');
    const replayed = (await loadDeck()).find((card) => card.id === 'phrase:ça marche')!;
    assert.equal(replayed.reps, 1, 'the replay reset scheduling the learner had earned');
    assert.equal(replayed.due, graded.due, 'the card came back due when it was not');
    assert.equal(evidenceOf(replayed).retrievals, 1, 'the replay erased a retrieval the learner made');
    assert.equal(evidenceOf(replayed).convoUses, 2, 'a replayed batch inflated the count of what the learner has used');
  });

  test('a banked conversation raises used-in-conversation evidence for its phrases', async () => {
    // The count exists on the brain's side of the wire and used to stop there,
    // so a phrase someone had genuinely started using looked, in the deck,
    // exactly like one they had read once.
    const uid = nextUid();
    const disk = installDisk();
    setActiveUser(uid);
    const batch = await journalledSession(disk, uid, profileWith({ 'Ça marche': 2 }));

    assert.deepEqual(batch.convoUses, [{ fr: 'Ça marche', uses: 2 }], 'the counts did not survive the journal');
    assert.equal(await bankPractice(batch), 'banked');

    const deck = await loadDeck();
    assert.equal(evidenceOf(deck.find((card) => card.id === 'phrase:ça marche')!).convoUses, 2);
    assert.equal(
      evidenceOf(deck.find((card) => card.id === 'phrase:autre chose')!).convoUses,
      0,
      'a phrase the learner never used unprompted was credited with using it',
    );
    assert.equal(disk.has(journalKeyOf(uid)), false, 'the counts rode the phrases write, so one acknowledgement covered both');
  });

  test('two spellings of one phrase raise its card once, to the larger count', async () => {
    // The learner model keys phrases on the written form when it has one, so
    // one deck card can be named twice in a single batch. The card takes the
    // larger of the two rather than whichever happened to be last.
    const uid = nextUid();
    installDisk();
    setActiveUser(uid);

    assert.equal(
      await bankPractice({
        batchId: null,
        phrases: [phrase('Ça marche', 'coming up')],
        topics: [],
        drills: [],
        convoUses: [{ fr: 'Ça marche', uses: 3 }, { fr: 'ça marche', uses: 1 }],
      }),
      'banked',
    );

    const card = (await loadDeck()).find((c) => c.id === 'phrase:ça marche')!;
    assert.equal(evidenceOf(card).convoUses, 3);
  });

  test('a crash at any point in banking replays the whole batch exactly once', async () => {
    // The four places the app can die with a journal still on disk. Each one is
    // replayed from the beginning by the next launch, because a batch is banked
    // whole or not at all — there is no half-written marker to reason about.
    const boundaries: readonly { readonly where: string; got(batch: PracticeBatch): Promise<unknown> }[] = [
      { where: 'after the topics landed', got: (batch) => bankPractice({ ...batch, phrases: [], drills: [], convoUses: [] }) },
      { where: 'after the phrases landed', got: (batch) => bankPractice({ ...batch, drills: [] }) },
      { where: 'after the drills landed', got: (batch) => bankPractice(batch) },
      { where: 'between the last acknowledgement and the clear', got: (batch) => bankPractice(batch) },
    ];

    for (const boundary of boundaries) {
      const uid = nextUid();
      // Nothing this batch writes ever gets to delete the journal: either the
      // process died first, or the partial bank had no business clearing it.
      const disk = installDisk({}, { neverDeletes: true });
      setActiveUser(uid);
      const batch = await journalledSession(disk, uid, profileWith({ 'Ça marche': 1 }));

      await boundary.got(batch);
      assert.ok(disk.has(journalKeyOf(uid)), `${boundary.where}: the journal went before the batch was safe`);

      relaunch(disk, uid);
      assert.equal(await recoverJournal(), 2, `${boundary.where}: the interrupted batch never finished`);
      await assertBankedExactlyOnce(boundary.where);
      const card = (await loadDeck()).find((c) => c.id === 'phrase:ça marche')!;
      assert.equal(evidenceOf(card).convoUses, 1, `${boundary.where}: the count climbed on a replay`);
    }
  });

  test('the same batch delivered twice changes nothing the second time', async () => {
    // A duplicate delivery is not a crash: the recap arrives twice on an
    // ordinary session, once plain and once enriched. Idempotence here is
    // content identity, not a batch name, which is why banking the very same
    // batch object again is a no-op rather than a second conversation.
    const uid = nextUid();
    const disk = installDisk();
    setActiveUser(uid);
    const batch = await journalledSession(disk, uid, profileWith({ 'Ça marche': 3 }));

    assert.equal(await bankPractice(batch), 'banked');
    const first = await loadDeck();
    assert.equal(await bankPractice(batch), 'banked', 'a second delivery of a banked batch is still banked');

    await assertBankedExactlyOnce('after a duplicate delivery');
    const second = await loadDeck();
    assert.deepEqual(second, first, 'the second delivery changed the deck');
    assert.equal(evidenceOf(second.find((card) => card.id === 'phrase:ça marche')!).convoUses, 3, 'max, not add');
  });

  test('a conversation is never banked into the account that signed in after it', async () => {
    // The scope check the journal has always had, held against the new path.
    // Banking one learner's conversation into the next learner's deck is the
    // worst thing this file could do, and it is one await away at all times.
    const mine = nextUid();
    const theirs = nextUid();
    setActiveUser(mine);
    let disk = installDisk();
    await journalledSession(disk, mine);

    // The account changes while the launch is reading the journal off disk.
    disk = relaunch(disk, mine, {
      during: (key) => {
        if (key === journalKeyOf(mine)) setActiveUser(theirs);
      },
    });

    assert.equal(await recoverJournal(), 0, 'a journal was banked for an account that had already gone');
    assert.equal((await loadDeck()).length, 0, "the next learner's deck holds a conversation they never had");
    assert.ok(disk.has(journalKeyOf(mine)), 'and nothing was deleted: the journal waits for the launch that can bank it');
  });

  test('a batch banked straight from the live session clears the journal it was written into', async () => {
    // The ordinary path, and the one ConvoScreen takes: the recap is journalled
    // when it arrives, and seconds later the same conversation is banked from
    // memory, where nothing ever knew the batch's name. A bank with no name to
    // match on clears the key, exactly as it did before names existed.
    const uid = nextUid();
    const disk = installDisk();
    setActiveUser(uid);
    await journalRecap(recap(), { savedAt: NOW });
    assert.ok(disk.has(journalKeyOf(uid)), 'the recap was written down first, which is the whole point');

    const live: PracticeBatch = {
      batchId: null,
      phrases: recap().phrases,
      topics: [{ title: { fr: 'Au café', en: 'Ordering at the café' }, phraseKeys: ['phrase:ça marche'] }],
      drills: [],
      convoUses: [],
    };
    assert.equal(await bankPractice(live), 'banked');
    assert.equal(disk.has(journalKeyOf(uid)), false, 'the journal outlived the session that was already banked');
  });

  test('a bank does not clear a journal a later session wrote', async () => {
    // The narrow window `batchId` exists for. If a newer recap has landed on the
    // key while the acknowledgements were coming back, the clear must not take
    // it: that conversation is banked nowhere.
    const uid = nextUid();
    const disk = installDisk();
    setActiveUser(uid);
    const batch = await journalledSession(disk, uid);
    assert.ok(batch.batchId, 'a v3 journal names its batch');

    // The next conversation, written down while the first is still banking.
    await journalRecap(recap({ phrases: [phrase('À demain', 'see you tomorrow')] }), { savedAt: NOW + 60_000 });
    assert.equal(await bankPractice(batch), 'banked');

    const left = JSON.parse(disk.get(journalKeyOf(uid))!) as { phrases: { fr: string }[] };
    assert.deepEqual(left.phrases.map((p) => p.fr), ['À demain'], 'the later session was deleted by the earlier bank');
  });

  test('a journal from the build before this one banks, and claims no counts it never had', async () => {
    // Repair forward, never reinterpret in place. A v2 envelope is on every
    // phone running the previous build and has neither a batch name nor counts;
    // both of those come back empty rather than invented.
    const uid = nextUid();
    const disk = installDisk({
      [journalKeyOf(uid)]: JSON.stringify({
        version: 2,
        savedAt: NOW,
        phrases: [phrase('Ça marche', 'coming up'), phrase('Autre chose', 'something else')],
        topics: [{ fr: 'Au café', en: 'Ordering at the café' }],
        drills: [drill('gen:one', 'phrase:ça marche')],
      }),
    });
    setActiveUser(uid);

    const plan = recoveryPlan(JSON.parse(disk.get(journalKeyOf(uid))!));
    assert.equal(plan?.batchId, null, 'a name was minted for a batch this build was not there for');
    assert.deepEqual(plan?.convoUses, []);

    assert.equal(await recoverJournal(), 2, 'the old envelope was read, not discarded');
    await assertBankedExactlyOnce('a v2 journal');
    assert.equal(evidenceOf((await loadDeck()).find((card) => card.id === 'phrase:ça marche')!).convoUses, 0);
    assert.equal(disk.has(journalKeyOf(uid)), false);
  });
});

describe('the counts a conversation earned', () => {
  test('a recap carries the counts off the learner model it arrived with', () => {
    const uses = convoUsesFrom(profileWith({ 'Ça marche': 3, 'Autre chose': 1 }));
    assert.deepEqual(
      [...uses].sort((a, b) => a.fr.localeCompare(b.fr)),
      [{ fr: 'Autre chose', uses: 1 }, { fr: 'Ça marche', uses: 3 }],
    );
  });

  test('a phrase nobody has used yet is not worth carrying', () => {
    // A zero raises nothing on the way in, so keeping it would be weight in the
    // envelope with no effect on any card.
    assert.deepEqual(convoUsesFrom(profileWith({ 'Ça marche': 0 })), []);
  });

  test('a profile nobody can read costs the counts and nothing else', () => {
    // Through repairProfile, which answers junk with a fresh profile rather than
    // a throw. A skipped fold loses nothing that was ever on disk; a throw here
    // would lose the recap that was on its way to being written down.
    const junk = [
      null,
      undefined,
      'nonsense',
      42,
      { phrases: 'not a record' },
      { phrases: { a: 5 } },
      // Plausible counts inside something that is not a learner profile. This
      // is the case that says repairProfile is the door: read field by field,
      // these numbers look exactly like evidence.
      { phrases: { 'ça marche': { fr: 'Ça marche', timesUsedWell: 9 } } },
    ];
    for (const blob of junk) {
      assert.deepEqual(convoUsesFrom(blob), [], `${JSON.stringify(blob)} produced counts out of nothing`);
    }
  });

  test('the journal keeps the counts it was given, and the recovery reads them back', () => {
    const journal = journalFor(recap(), NOW, profileWith({ 'Ça marche': 2 }));
    assert.deepEqual(journal.convoUses, [{ fr: 'Ça marche', uses: 2 }]);
    assert.equal(journal.version, JOURNAL_VERSION);
    assert.match(journal.batchId, /^b[0-9a-z]+\.[0-9a-z]+$/, 'the batch has a name, minted from when it was saved');
    assert.notEqual(journalFor(recap(), NOW).batchId, journal.batchId, 'two batches saved at once are still two batches');

    const plan = recoveryPlan(journal);
    assert.deepEqual(plan?.convoUses, [{ fr: 'Ça marche', uses: 2 }]);
    assert.equal(plan?.batchId, journal.batchId);
  });

  test('a count nobody can read is dropped, and the rest of the batch is not', () => {
    const journal = journalFor(recap(), NOW, profileWith({ 'Ça marche': 2 }));
    const plan = recoveryPlan({ ...journal, convoUses: [...journal.convoUses, { fr: 'Autre chose' }, 'nonsense', { uses: 3 }] });
    assert.deepEqual(plan?.convoUses, [{ fr: 'Ça marche', uses: 2 }], 'the readable half still lands');
    assert.equal(plan?.phrases.length, 2, 'and the phrases are untouched by a bad count');
  });

  test('drills journalled onto an older envelope keep their place and gain a name', () => {
    // The one path where an envelope written by another build is carried
    // forward rather than rebuilt, so it is the one that has to repair it.
    const v2 = {
      version: 2,
      savedAt: NOW,
      phrases: [phrase('Ça marche', 'coming up')],
      topics: [{ fr: 'Au café', en: 'Ordering at the café' }],
      drills: [],
    } as unknown as Parameters<typeof journalWithDrills>[0];

    const carried = journalWithDrills(v2, [drill('gen:late', 'phrase:ça marche')], NOW);

    assert.equal(carried.version, JOURNAL_VERSION);
    assert.equal(carried.phrases.length, 1, 'the phrases waiting in the old envelope were dropped by the upgrade');
    assert.match(carried.batchId, /^b/, 'a carried envelope with no name would be cleared by anything');
    assert.deepEqual(carried.convoUses, []);
  });
});

/**
 * A lesson deck the disk refused, and the summary that earned it.
 *
 * `cafe-01` and `t1-greet` are real content, so `buildCardsFromSummary` produces
 * a real card rather than an empty list that would let a broken retry look like
 * a working one.
 */
const lessonSummary = (lessonId = 'cafe-01'): SessionSummary => ({
  lessonId,
  durationSec: 120,
  pronunciation: { stats: [], focus: null, overall: 0, wins: [] },
  pronunciationStatus: 'unavailable' as SessionSummary['pronunciationStatus'],
  unassistedRate: 0.5,
  wordsProduced: [],
  longestTurnSec: 0,
  speakingShare: 0.5,
  turnsCompleted: 4,
  rescues: 0,
  utterancesScored: 0,
  struggledTurnIds: ['t1-greet'],
  nextStartRung: 1 as SessionSummary['nextStartRung'],
});

/**
 * Whether the batch on disk is worth surviving the disk.
 *
 * Phase 4 proved a conversation outlives the app that had it. What it never
 * asked was what the surviving batch contains, and the answer was: everything
 * the recap said, ungrouped, uncurated and unedited. So the crash path handed a
 * learner the twelve-card flood that the practice editor exists to prevent, and
 * did it by being reliable.
 */
describe('what the crash path is allowed to bank', () => {
  const dozen = (): RecapPayload =>
    recap({
      phrases: Array.from({ length: 12 }, (_, i) => phrase(`Phrase ${'abcdefghijkl'[i]}`, `line ${i}`)),
    });

  test('a recovered journal banks at most what curation would have kept', async () => {
    const uid = nextUid();
    const disk = installDisk();
    setActiveUser(uid);
    await journalRecap(dozen(), { savedAt: NOW });

    const plan = recoveryPlan(JSON.parse(disk.get(journalKeyOf(uid))!));
    assert.equal(plan?.phrases.length, MAX_RECOVERED_PHRASES, 'the crash path banked the uncurated set');
    assert.equal(MAX_RECOVERED_PHRASES, 5, "and not curation's own cap of five");
    assert.deepEqual(
      plan?.phrases.map((p) => p.fr),
      ['Phrase a', 'Phrase b', 'Phrase c', 'Phrase d', 'Phrase e'],
      'the phrases met first are the ones kept, exactly as the leave-early fallback keeps them',
    );
    assert.equal(
      plan?.topics[0]?.phraseKeys.length,
      MAX_RECOVERED_PHRASES,
      'the topic still points at cards the recovery did not bank',
    );

    // End to end, because a cap that only holds inside the plan is not a cap.
    relaunch(disk, uid);
    assert.equal(await recoverJournal(), MAX_RECOVERED_PHRASES);
    assert.equal((await loadDeck()).length, MAX_RECOVERED_PHRASES, 'the learner woke up to a wall of cards');

    // The same cap on the envelope every phone was running before this build,
    // which has no curated grouping in it and never will.
    const v3 = recoveryPlan({
      version: 3,
      savedAt: NOW,
      batchId: 'b-old',
      phrases: dozen().phrases,
      topics: dozen().topics,
      drills: [],
      convoUses: [],
    });
    assert.equal(v3?.phrases.length, MAX_RECOVERED_PHRASES, 'an older envelope escaped the cap');
  });

  test('a batch the practice editor did edit is banked whole, cap and all', async () => {
    // The cap is a stand-in for curation, not a second opinion about it. A
    // curated batch runs to seven — five kept plus two authored extensions —
    // and capping it would drop the extensions, which are the one thing in the
    // batch that exists nowhere else.
    const uid = nextUid();
    const disk = installDisk();
    setActiveUser(uid);
    await journalRecap(dozen(), { savedAt: NOW });

    const curated = dozen().phrases.slice(0, 7);
    await journalPractice(
      {
        batchId: null,
        phrases: curated,
        topics: [{ title: { fr: 'Au café', en: 'Ordering at the café' }, phraseKeys: curated.map((p) => phraseKeyOf(p.fr)) }],
        drills: [],
        convoUses: [],
      },
      NOW,
    );

    const plan = recoveryPlan(JSON.parse(disk.get(journalKeyOf(uid))!));
    assert.equal(plan?.phrases.length, 7, "the cap overruled the editor it is standing in for");
  });
});

/**
 * What a retry is allowed to deliver.
 *
 * Phase 4 made the batch survive the disk. It did not make the batch the right
 * one: only the recap and the drills were ever written down, so a bank that
 * failed came back at the next launch as a bigger, differently grouped set than
 * the session had curated, and the tutor's authored extensions — which the
 * recap never carried — were lost with no record that they had existed.
 */
describe('the curated batch, and the retry that has to match it', () => {
  const EXTENSION = phrase('On y va', 'Off we go');

  /** A session curated into two topics, one of them carrying an extension. */
  const curatedBatch = (): PracticeBatch => ({
    batchId: null,
    phrases: [phrase('Ça marche', 'coming up'), phrase('Autre chose', 'something else'), EXTENSION],
    topics: [
      { title: { fr: 'Au café', en: 'Ordering at the café' }, phraseKeys: ['phrase:ça marche'] },
      { title: { fr: 'Partir', en: 'Leaving' }, phraseKeys: ['phrase:autre chose', 'phrase:on y va'] },
    ],
    drills: [],
    convoUses: [],
  });

  test('a curated batch that fails to bank is banked identically on the next launch', async () => {
    const uid = nextUid();
    // The recap wrote down everything the conversation touched, including two
    // phrases curation went on to drop.
    const disk = installDisk({}, { full: (key) => key === `luvani.u.${uid}.drills` });
    setActiveUser(uid);
    await journalRecap(
      recap({
        phrases: [
          phrase('Ça marche', 'coming up'),
          phrase('Autre chose', 'something else'),
          phrase('Bof', 'meh'),
          phrase('Tant pis', 'never mind'),
        ],
      }),
      { savedAt: NOW },
    );
    const named = await journalPractice({ ...curatedBatch(), drills: [drill('gen:one', 'phrase:ça marche')] }, NOW);
    assert.ok(named.batchId, 'the curated batch took the name the recap already had, so the clear can match on it');

    const onDisk = JSON.parse(disk.get(journalKeyOf(uid))!) as { phrases: { fr: string }[]; curated: unknown[] };
    assert.deepEqual(
      onDisk.phrases.map((p) => p.fr),
      ['Ça marche', 'Autre chose', 'On y va'],
      'the disk still held the pre-curation set, so the retry would bank different content',
    );
    assert.equal(onDisk.curated.length, 2, 'and the grouping curation decided on was recorded nowhere');

    // The drills key has no room, so nothing may be deleted.
    assert.equal(await bankPractice(named), 'kept');
    assert.ok(disk.has(journalKeyOf(uid)), 'the only copy of the curated batch was deleted anyway');

    // The launch after the crash, on a phone with room again.
    const after = relaunch(disk, uid);
    const plan = recoveryPlan(JSON.parse(after.get(journalKeyOf(uid))!))!;
    assert.deepEqual(plan.phrases.map((p) => p.fr), ['Ça marche', 'Autre chose', 'On y va']);
    assert.deepEqual(plan.topics, curatedBatch().topics, 'the replay regrouped the batch it was meant to repeat');

    assert.equal(await recoverJournal(), 3);
    assert.equal(after.has(journalKeyOf(uid)), false, 'and only then is the journal gone');

    const deck = await loadDeck();
    assert.deepEqual(
      deck.map((card) => card.id).sort(),
      ['phrase:autre chose', 'phrase:on y va', 'phrase:ça marche'],
      'the retry banked the recap instead of what the session curated',
    );
    assert.equal(
      deck.some((card) => card.id === 'phrase:bof'),
      false,
      'a phrase curation dropped came back through the crash path',
    );
    const topics = await loadTopics();
    assert.deepEqual(topics.map((t) => t.title.en), ['Ordering at the café', 'Leaving']);
    assert.deepEqual(topics[1]!.phraseKeys, ['phrase:autre chose', 'phrase:on y va'], 'the grouping did not survive the replay');

    // Proven, not assumed: deliver the very same batch a third time and nothing
    // may move. Identity is the French line itself, in every merge in the path.
    const before = await loadDeck();
    assert.equal(await bankPractice(plan), 'banked');
    assert.deepEqual(await loadDeck(), before, 'the third delivery changed the deck');
    assert.equal((await loadTopics()).length, 2, 'the same conversation produced four topics');
    assert.deepEqual((await loadTopics())[0]!.discussed.length, 1, 'one sitting was recorded as two');
  });

  test('nothing that lands after curation puts the uncurated batch back', async () => {
    // The recap arrives twice, and the second one races the practice message:
    // the agent runs memory extraction and curation concurrently, so the
    // enriched recap can land on a key curation has already edited. It carries
    // the same phrases the first one did, and writing them back would
    // un-curate a batch seconds before it banks. Drills land after it too.
    const uid = nextUid();
    const disk = installDisk();
    setActiveUser(uid);
    const full = recap({
      phrases: [phrase('Ça marche', 'coming up'), phrase('Autre chose', 'something else'), phrase('Bof', 'meh')],
    });
    await journalRecap(full, { savedAt: NOW });
    await journalPractice(curatedBatch(), NOW);

    // The enriched recap, arriving late, bringing the counts and nothing else
    // this envelope should take.
    await journalRecap(full, { savedAt: NOW, profile: profileWith({ 'Ça marche': 2 }) });
    await journalDrills([drill('gen:late', 'phrase:ça marche')], NOW);

    const plan = recoveryPlan(JSON.parse(disk.get(journalKeyOf(uid))!))!;
    assert.deepEqual(
      plan.phrases.map((p) => p.fr),
      ['Ça marche', 'Autre chose', 'On y va'],
      'a late recap put the uncurated set back on disk',
    );
    assert.deepEqual(plan.topics, curatedBatch().topics, 'and threw away the grouping curation decided on');
    assert.deepEqual(plan.convoUses, [{ fr: 'Ça marche', uses: 2 }], 'the counts the late recap existed to deliver were dropped');
    assert.deepEqual(plan.drills.map((d) => d.id), ['gen:late']);
  });

  test('a sign-out mid-bank costs the journal entry, never the screen', async () => {
    // `serialized` binds the account by calling `userKey()`, which throws by
    // design when nobody is signed in — synchronously, so a `.catch()` on the
    // returned promise would miss it and the caller's effect would be left
    // holding an exception on the beat a session ends.
    installDisk();
    setActiveUser(null);
    const batch = curatedBatch();
    assert.deepEqual(await journalPractice(batch, NOW), batch, 'the batch came back named by a journal nobody wrote');
    assert.equal(await bankLesson(lessonSummary()), 'failed');
  });

  test('journalling the curated batch does not lose the drills or the counts beside it', async () => {
    // Drills and counts reach the journal by other routes and arrive in any
    // order, so a write that knows neither must not be able to erase either.
    const uid = nextUid();
    const disk = installDisk();
    setActiveUser(uid);
    await journalRecap(recap(), { savedAt: NOW, profile: profileWith({ 'Ça marche': 2 }) });
    await journalDrills([drill('gen:one', 'phrase:ça marche')], NOW);

    await journalPractice(curatedBatch(), NOW);

    const plan = recoveryPlan(JSON.parse(disk.get(journalKeyOf(uid))!))!;
    assert.deepEqual(plan.drills.map((d) => d.id), ['gen:one']);
    assert.deepEqual(plan.convoUses, [{ fr: 'Ça marche', uses: 2 }]);
  });
});

/**
 * The scripted lesson, on the outbox the conversation already had.
 *
 * `addFromSummary` awaited a durability answer and threw it away, so a learner
 * who finished a lesson on a full phone lost the whole deck without a word,
 * while a conversation in the same second was journalled and retried. Nothing
 * about a lesson makes it worth less.
 */
describe('a lesson deck and the disk that refused it', () => {
  test('a lesson deck that fails to save is kept and retried, not dropped', async () => {
    const uid = nextUid();
    const disk = installDisk({}, { full: (key) => key === `luvani.u.${uid}.review` });
    setActiveUser(uid);

    assert.equal(await bankLesson(lessonSummary()), 'failed', 'a refused deck write called itself finished');
    assert.ok(disk.has(journalKeyOf(uid)), 'the lesson was lost with nothing on disk saying it had been earned');

    // A conversation ends before the phone has room. Its recap lands on the same
    // key, and must not take the waiting lesson with it.
    await journalRecap(recap(), { savedAt: NOW });
    assert.equal(
      (recoveryPlan(JSON.parse(disk.get(journalKeyOf(uid))!))?.lessons ?? []).length,
      1,
      'the next conversation wrote over a lesson nothing else was holding',
    );

    const after = relaunch(disk, uid);
    await recoverJournal();

    assert.ok(
      (await loadDeck()).some((card) => card.id === 'turn:cafe-01:t1-greet'),
      'the lesson deck never reached the deck on the launch that could take it',
    );
    assert.equal(after.has(journalKeyOf(uid)), false, 'banked, then cleared — never the other order');
  });

  test('a lesson that saves touches the journal not at all', async () => {
    // The key is where an unbanked conversation waits. An ordinary lesson has
    // no business writing to it, and a lesson that journalled every time would
    // be one more way to overwrite a session nobody has banked.
    const uid = nextUid();
    const disk = installDisk();
    setActiveUser(uid);

    assert.equal(await bankLesson(lessonSummary()), 'durable');
    assert.equal(disk.has(journalKeyOf(uid)), false);
    assert.ok((await loadDeck()).some((card) => card.id === 'turn:cafe-01:t1-greet'));
  });

  test('the same lesson refused twice is one deck to bank, not two', async () => {
    const uid = nextUid();
    const disk = installDisk({}, { full: (key) => key === `luvani.u.${uid}.review` });
    setActiveUser(uid);

    await bankLesson(lessonSummary());
    await bankLesson(lessonSummary());
    await bankLesson(lessonSummary('cafe-02'));

    const plan = recoveryPlan(JSON.parse(disk.get(journalKeyOf(uid))!))!;
    assert.deepEqual(
      (plan.lessons ?? []).map((l) => l.lessonId),
      ['cafe-01', 'cafe-02'],
      'one lesson was kept twice, or one was lost',
    );
  });

  test('a lesson nobody can read is dropped, and the rest of the batch is not', () => {
    // Same reasoning as every other guard here: a launch that crashes on a
    // half-written lesson takes the conversation sitting beside it down too.
    const plan = recoveryPlan({
      ...journalFor(recap(), NOW),
      lessons: [lessonSummary(), { lessonId: 'cafe-01' }, 'nonsense', null],
    });
    assert.equal((plan?.lessons ?? []).length, 1, 'the readable half still lands');
    assert.equal(plan?.phrases.length, 2, 'and the phrases are untouched by a bad lesson');
  });
});
