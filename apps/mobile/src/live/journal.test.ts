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
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DrillExercise, RecapPayload } from '@parle/core';

import { loadDrillBank } from '../drill/store.ts';
import { loadDeck } from '../review/store.ts';
import { setActiveUser } from '../storage/scope.ts';
import { journalDrills, journalRecap, recoverJournal } from './journal.ts';
import { JOURNAL_VERSION, isWorthKeeping, journalFor, journalWithDrills, recoveryPlan } from './journalRules.ts';

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
function installDisk(initial: Record<string, string> = {}): Map<string, string> {
  const map = new Map<string, string>(Object.entries(initial));
  const shared = AsyncStorage as unknown as Record<string, unknown>;
  shared.getItem = (key: string): Promise<string | null> => Promise.resolve(map.get(key) ?? null);
  shared.setItem = (key: string, value: string): Promise<void> => {
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
const nextUid = (): string => `22222222-2222-4222-8222-${String(++uids).padStart(12, '0')}`;

describe('the drills a conversation leaves behind', () => {
  test('drills that arrived before the app closed are banked on the next launch', async () => {
    // The whole point of the outbox: the batch is written down the moment it
    // arrives, the app dies before anything banks it, and the next launch finds
    // it and puts it in the bank.
    const uid = nextUid();
    const disk = installDisk();
    setActiveUser(uid);

    await journalRecap(recap(), NOW);
    await journalDrills([drill('gen:crashed', 'phrase:ça marche')], NOW);

    // The app is gone. Nothing merged the batch, nothing cleared the journal.
    assert.ok(disk.has(`parle.u.${uid}.journal`), 'the batch was on disk when the app died');

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
    assert.equal(disk.has(`parle.u.${uid}.journal`), false, 'banked, then cleared — never the other order');
  });

  test('a journal written by the build before this one still banks everything it holds', async () => {
    // Repair forward, never reinterpret in place. A learner whose app died the
    // day they updated has a version 1 envelope on disk with no drills field,
    // and dropping it would lose the session to the upgrade that was meant to
    // protect it.
    const uid = nextUid();
    const disk = installDisk({
      [`parle.u.${uid}.journal`]: JSON.stringify({
        version: 1,
        savedAt: NOW,
        phrases: [phrase('Autre chose', 'something else')],
        topics: [{ fr: 'Au café', en: 'Ordering at the café' }],
      }),
    });
    setActiveUser(uid);

    assert.equal(await recoverJournal(), 1, 'the old envelope was read, not discarded');
    assert.ok((await loadDeck()).some((card) => card.id === 'phrase:autre chose'));
    assert.equal(disk.has(`parle.u.${uid}.journal`), false);
  });

  test('a batch that arrives after the recap does not erase the phrases waiting beside it', async () => {
    const uid = nextUid();
    const disk = installDisk();
    setActiveUser(uid);

    await journalRecap(recap(), NOW);
    await journalDrills([drill('gen:late', 'phrase:ça marche')], NOW);

    const written = JSON.parse(disk.get(`parle.u.${uid}.journal`)!) as { phrases: unknown[]; drills: unknown[] };
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
