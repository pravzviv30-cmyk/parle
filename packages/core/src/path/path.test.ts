import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildPath, authoredPhraseKeys, AUTHORED_PATH } from './path.ts';
import { buildDrillSession } from '../drill/session.ts';
import { DRILL_FIXTURES } from '../drill/fixtures.ts';
import type { ReviewCard } from '../review/scheduler.ts';
import type { PracticeTopic } from '../topics/topics.ts';

const NOW = new Date(2026, 0, 15, 12).getTime();
const DAY = 86_400_000;

function card(id: string, due: number, reps = 2): ReviewCard {
  return { id, kind: 'turn', front: id, back: id, context: '', ipa: '', addedAt: NOW - 30 * DAY, due, reps, ease: 2.5, intervalDays: 3, lapses: 0 };
}

const OPTS = { lessonDone: false };

describe('the authored graph', () => {
  test('every fixture phrase lands in exactly one node', () => {
    // The guard that stops a new fixture being silently orphaned: added to the
    // bank, drilled by the deck, and invisible on the map.
    const authored = authoredPhraseKeys();
    const fixtureKeys = [...new Set(DRILL_FIXTURES.map((e) => e.phraseKey))];
    for (const key of fixtureKeys) {
      const homes = authored.filter((k) => k === key);
      assert.equal(homes.length, 1, `${key} should appear in exactly one node, found ${homes.length}`);
    }
  });

  test('no node claims a phrase the bank cannot drill', () => {
    const fixtureKeys = new Set(DRILL_FIXTURES.map((e) => e.phraseKey));
    for (const key of authoredPhraseKeys()) {
      assert.ok(fixtureKeys.has(key), `${key} is on the path but nothing drills it`);
    }
  });

  test('node ids are unique', () => {
    const ids = AUTHORED_PATH.flatMap((u) => u.nodes.map((n) => n.id));
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe('node state follows the deck, not a second store', () => {
  test('an untouched node is available', () => {
    const units = buildPath([], [], [], OPTS, NOW);
    assert.equal(units[0]!.nodes[1]!.state, 'available');
  });

  test('some phrases known makes a node in-progress', () => {
    const units = buildPath([card('phrase:je vais prendre un croissant', NOW + DAY)], [], [], OPTS, NOW);
    const order = units[0]!.nodes.find((n) => n.id === 'cafe:order')!;
    assert.equal(order.state, 'in-progress');
  });

  test('all phrases known and nothing due is complete', () => {
    // 2026-09-27: cafe:order grew a fifth phrase, the opener's "sur place, au
    // comptoir", so "all phrases" is five now.
    const deck = ["phrase:sur place, s'il vous plaît", "phrase:sur place, au comptoir, s'il vous plaît", 'phrase:je vais prendre un croissant', "phrase:oui, c'est tout, merci", 'phrase:ça sera tout, merci'].map((k) => card(k, NOW + DAY));
    const units = buildPath(deck, [], [], OPTS, NOW);
    assert.equal(units[0]!.nodes.find((n) => n.id === 'cafe:order')!.state, 'complete');
  });

  test('a completed node returns to needs-review when the scheduler wants it', () => {
    // Deliberately not how the reference design behaves: the deck stays the
    // single source of truth, so a node can come back.
    // 2026-09-27: five phrases in cafe:order now; see the test above.
    const deck = ["phrase:sur place, s'il vous plaît", "phrase:sur place, au comptoir, s'il vous plaît", 'phrase:je vais prendre un croissant', "phrase:oui, c'est tout, merci", 'phrase:ça sera tout, merci'].map((k) => card(k, NOW - DAY));
    const units = buildPath(deck, [], [], OPTS, NOW);
    const order = units[0]!.nodes.find((n) => n.id === 'cafe:order')!;
    // Both true at once, which is the point of keeping them apart.
    assert.equal(order.state, 'needs-review');
    assert.equal(order.isNext, true);
  });

  test('the guided lesson completes on having been finished, not on the deck', () => {
    const undone = buildPath([], [], [], { lessonDone: false }, NOW);
    const done = buildPath([], [], [], { lessonDone: true }, NOW);
    assert.notEqual(undone[0]!.nodes[0]!.state, 'complete');
    assert.equal(done[0]!.nodes[0]!.state, 'complete');
  });
});

describe('gating', () => {
  test('only the tutor-written node ever locks', () => {
    const units = buildPath([], [], [], OPTS, NOW);
    const locked = units.flatMap((u) => u.nodes).filter((n) => n.state === 'locked');
    assert.equal(locked.length, 1);
    assert.equal(locked[0]!.kind, 'mine');
  });

  test('every authored node is open from the very first launch', () => {
    // Principle 1: support is withdrawn as the learner improves, never
    // withheld until they earn it.
    const units = buildPath([], [], [], OPTS, NOW);
    const authored = units.flatMap((u) => u.nodes).filter((n) => n.kind !== 'mine');
    assert.ok(authored.every((n) => n.state !== 'locked'));
  });

  test('the tutor-written node unlocks once the tutor has written something', () => {
    const bank = [{ ...DRILL_FIXTURES[0]!, id: 'gen:abc', phraseKey: 'phrase:mine' }];
    const units = buildPath([], bank, [], OPTS, NOW);
    const mine = units.flatMap((u) => u.nodes).find((n) => n.kind === 'mine')!;
    assert.notEqual(mine.state, 'locked');
  });
});

describe('exactly one next', () => {
  test('there is never more than one primary action on the map', () => {
    for (const deck of [[], [card('phrase:salut ! ça va ?', NOW - DAY)], [card('phrase:merci beaucoup', NOW + DAY)]]) {
      const units = buildPath(deck, [], [], OPTS, NOW);
      const next = units.flatMap((u) => u.nodes).filter((n) => n.isNext);
      assert.equal(next.length, 1, 'exactly one node should carry the action');
    }
  });

  test('something the scheduler wants back outranks new ground', () => {
    const deck = ['phrase:salut ! ça va ?', 'phrase:ça marche', 'phrase:carrément !'].map((k) => card(k, NOW - DAY));
    const units = buildPath(deck, [], [], OPTS, NOW);
    const next = units.flatMap((u) => u.nodes).find((n) => n.isNext)!;
    assert.equal(next.id, 'amis:greet');
  });

  test('a fully finished path offers nothing rather than inventing something', () => {
    const deck = authoredPhraseKeys().map((k) => card(k, NOW + 10 * DAY));
    const units = buildPath(deck, [], [], { lessonDone: true }, NOW);
    const next = units.flatMap((u) => u.nodes).filter((n) => n.isNext);
    assert.equal(next.length, 0);
  });
});

describe("topic cards — practice from the learner's own conversations", () => {
  const topic = (over: Partial<PracticeTopic> = {}): PracticeTopic => ({
    id: 'topic:ordering-at-the-cafe',
    title: { fr: 'Au café', en: 'Ordering at the café' },
    discussed: ['2026-08-19'],
    phraseKeys: ['phrase:ça marche'],
    ...over,
  });

  /** A generated exercise for one phrase, so a topic's drills count as arrived. */
  const generated = (key: string) => ({ ...DRILL_FIXTURES[0]!, id: `gen:${key}`, phraseKey: key });

  test('each topic becomes one node in the mine unit, state projected from the deck', () => {
    const units = buildPath([card('phrase:ça marche', NOW + DAY)], [generated('phrase:ça marche')], [topic()], OPTS, NOW);
    const mine = units.find((u) => u.id === 'mine')!;
    assert.equal(mine.nodes.length, 1);
    const node = mine.nodes[0]!;
    assert.equal(node.kind, 'topic');
    assert.equal(node.id, 'topic:ordering-at-the-cafe');
    assert.equal(node.title, 'Ordering at the café');
    assert.equal(node.state, 'complete', 'earned and not due — the deck says so');
    assert.deepEqual([...node.phraseKeys], ['phrase:ça marche']);
  });

  test('a due phrase pulls its topic back to needs-review', () => {
    const units = buildPath([card('phrase:ça marche', NOW - 1)], [generated('phrase:ça marche')], [topic()], OPTS, NOW);
    assert.equal(units.find((u) => u.id === 'mine')!.nodes[0]!.state, 'needs-review');
  });

  test('with no topics yet, the generic node still stands, locked until a conversation', () => {
    const units = buildPath([], [], [], OPTS, NOW);
    const mine = units.find((u) => u.id === 'mine')!;
    assert.equal(mine.nodes.length, 1);
    assert.equal(mine.nodes[0]!.id, 'mine:recent');
    assert.equal(mine.nodes[0]!.state, 'locked');
  });

  test('how often it came up reads in words, never digits', () => {
    const rugby = topic({
      id: 'topic:rugby',
      title: { fr: 'Le rugby', en: 'Rugby' },
      discussed: ['a', 'b', 'c', 'd', 'e'],
    });
    const units = buildPath([], [], [topic(), rugby], OPTS, NOW);
    const subs = units.find((u) => u.id === 'mine')!.nodes.map((n) => n.sub);
    assert.deepEqual(subs, ['Talked about once', 'One of your regulars']);
    for (const sub of subs) assert.ok(!/\d/.test(sub), `digit leaked into "${sub}"`);
  });
});


describe('a topic the tutor has not finished writing', () => {
  const KEY = 'phrase:je bosse dans la tech';

  const topic = (keys: string[]): PracticeTopic => ({
    id: 'topic:my-job',
    title: { fr: 'Mon travail', en: 'My job' },
    discussed: ['2026-08-20'],
    phraseKeys: keys,
  });

  const drillable = (key: string) => DRILL_FIXTURES.map((e) => ({ ...e, id: `gen:${key}`, phraseKey: key }))[0]!;

  const topicNodes = (deck: ReviewCard[], bank: ReturnType<typeof drillable>[], topics: PracticeTopic[]) =>
    buildPath(deck, bank, topics, { lessonDone: true }, NOW).find((u) => u.id === 'mine')!.nodes;

  test('a topic node the bank cannot drill yet is locked', () => {
    // The crash window: a conversation banks its phrases and authors its drills
    // from two separate post-session calls. Close the app in between and the
    // phrases are in the deck with nothing able to drill them.
    const nodes = topicNodes([card(KEY, NOW - DAY)], [], [topic([KEY])]);
    assert.equal(nodes[0]!.state, 'locked', 'a door with nothing behind it must not look open');
  });

  test('a still-being-written topic is never the primary action', () => {
    const nodes = topicNodes([card(KEY, NOW - DAY)], [], [topic([KEY])]);
    assert.equal(nodes[0]!.isNext, false, 'the one highlighted next step cannot be the one that goes nowhere');
  });

  test('a topic with even one drillable phrase stays open', () => {
    // Partial arrival is normal and fine: the sitting builds from what exists.
    const other = 'phrase:un café, s’il vous plaît';
    const nodes = topicNodes([card(KEY, NOW - DAY), card(other, NOW - DAY)], [drillable(other)], [topic([KEY, other])]);
    assert.notEqual(nodes[0]!.state, 'locked');
  });

  test('a topic whose drills have all landed behaves exactly as before', () => {
    const nodes = topicNodes([card(KEY, NOW - DAY)], [drillable(KEY)], [topic([KEY])]);
    assert.equal(nodes[0]!.state, 'needs-review');
  });

  test('no tappable node ever opens onto an empty sitting', () => {
    // The invariant behind the fix, checked across the whole map rather than at
    // the one node that prompted it. PEDAGOGY.md: never stranded.
    //
    // One bank, given to both calls, because that is how the app works: the
    // drill store seeds from the fixtures and generated exercises are appended
    // to the same list. Handing buildPath one bank and the sitting another
    // would test a state the learner can never be in.
    const other = 'phrase:un café, s’il vous plaît';
    const decks: ReviewCard[][] = [
      [],
      [card(KEY, NOW - DAY)],
      [card(KEY, NOW + DAY)],
      [card(KEY, NOW - DAY), card(other, NOW - DAY)],
      [card(KEY, NOW - DAY, 0)],
    ];
    const extras = [[], [drillable(other)], [drillable(KEY)], [drillable(KEY), drillable(other)]];
    const topicSets: PracticeTopic[][] = [[], [topic([KEY])], [topic([KEY, other])]];

    let checked = 0;
    for (const deck of decks) {
      for (const extra of extras) {
        const bank = [...DRILL_FIXTURES, ...extra];
        for (const topics of topicSets) {
          for (const lessonDone of [false, true]) {
            const units = buildPath(deck, bank, topics, { lessonDone }, NOW);
            for (const node of units.flatMap((u) => u.nodes)) {
              if (node.kind === 'lesson') continue; // the lesson is a scene, not a sitting
              // Only the states that promise material. 'locked' promises none,
              // and 'complete' means known with nothing due, where "Nothing due
              // right now" is the true answer rather than a dead end.
              if (node.state !== 'needs-review' && node.state !== 'in-progress' && node.state !== 'available') continue;
              const sitting = buildDrillSession(deck, bank, NOW, { only: node.phraseKeys });
              checked += 1;
              assert.ok(
                sitting.queue.length > 0,
                `${node.id} is tappable in state ${node.state} but its sitting is empty`,
              );
            }
          }
        }
      }
    }
    assert.ok(checked > 100, `the sweep should cover real ground, only checked ${checked} nodes`);
  });
});
