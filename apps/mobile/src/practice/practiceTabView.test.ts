/**
 * The direction B Practice tab's view model (B3, 2026-10-20, artboards
 * B-Practice and B-Empty-Practice): what each line is read from, where every
 * door goes, and the design lines dropped because nothing backs them.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  answerCurrent,
  buildConversationPack,
  buildPracticeSession,
  newCard,
  phraseKeyOf,
  type ConversationPack,
  type DrillExercise,
  type PracticeTopic,
  type ReviewCard,
} from '@luvani/core';

import type { LockedFeature } from '../access/featureAccess.ts';
import { packSelection } from './recommendation.ts';
import { toSessionRecord } from './sessionStore.ts';
import {
  COMES_UP_OFTEN_ENABLED,
  EMPTY,
  PATTERN_COPY,
  PATTERN_FREE,
  cafeRow,
  compactArt,
  packsMatching,
  patternCard,
  TALK_AGAIN,
  chosenTopic,
  comesUpOften,
  conversationCard,
  isNewLearner,
  mixCard,
  packTopics,
  packsInTopic,
  phraseStatus,
  pickUp,
  revisitedLines,
  savedPhrasesLine,
  soundsRow,
  thisWeekLine,
  topicChips,
} from './practiceTabView.ts';

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;
const lockedAll = (_feature: LockedFeature) => 'locked' as const;
const unlocked = (_feature: LockedFeature) => 'unlocked' as const;

const card = (fr: string, extra: Partial<ReviewCard> = {}): ReviewCard =>
  ({ ...newCard({ id: phraseKeyOf(fr), kind: 'vocab', front: fr, back: 'x', context: '', ipa: '' }, NOW - 10 * DAY), due: NOW + 3 * DAY, ...extra });
const exercise = (fr: string): DrillExercise =>
  ({ id: `t:${phraseKeyOf(fr)}`, phraseKey: phraseKeyOf(fr), difficulty: 'production', kind: 'translate', fr, en: `meaning ${fr}`, direction: 'en-fr', accepted: [fr] });

function pack(id: string, opts: {
  lines?: string[];
  topics?: { en: string; fr: string }[];
  daysAgo?: number;
  durationSec?: number | null;
  corrections?: { quote: string; better: string; betterEn: string; why: string }[];
  revisedFromPackId?: string;
  wins?: string[];
  state?: 'ready' | 'generating';
} = {}): ConversationPack {
  return buildConversationPack({
    id, sessionId: id, learnerId: 'l', createdAt: new Date(NOW - (opts.daysAgo ?? 1) * DAY).toISOString(),
    state: opts.state ?? 'ready', title: { fr: `Fr ${id}`, en: `Title ${id}` }, summary: `Summary ${id}`,
    durationSec: opts.durationSec ?? null, topics: opts.topics ?? [],
    keyPhrases: (opts.lines ?? []).map((fr) => ({ fr, frWritten: null, en: `en ${fr}` })),
    corrections: opts.corrections ?? [], revisedFromPackId: opts.revisedFromPackId ?? null, wins: opts.wins ?? [],
  });
}

const CAFE = { en: 'Ordering a coffee', fr: 'Commander un café' };
const TRAIN = { en: 'Taking the métro', fr: 'Prendre le métro' };

describe('topic chips map pack topics onto the Explore buckets', () => {
  test('a pack names the buckets its own topics match, and none without topics', () => {
    assert.deepEqual(packTopics(pack('a', { topics: [CAFE] })), ['food']);
    assert.deepEqual(packTopics(pack('b', { topics: [TRAIN] })), ['travel']);
    assert.deepEqual(packTopics(pack('c')), []);
  });
  test('chips are All then only the buckets that hold a conversation, in Explore order', () => {
    const packs = [pack('a', { topics: [TRAIN] }), pack('b', { topics: [CAFE] })];
    assert.deepEqual(topicChips(packs).map((c) => c.label), ['All', 'Cafés', 'Getting around']);
    assert.deepEqual(topicChips([pack('c')]), [], 'All stands alone over nothing to filter');
  });
  test('a chosen bucket filters, and one that left the page falls back to All', () => {
    const packs = [pack('a', { topics: [TRAIN] }), pack('b', { topics: [CAFE] })];
    assert.deepEqual(packsInTopic(packs, 'food').map((p) => p.id), ['b']);
    assert.equal(chosenTopic(packs, 'work'), null);
    assert.equal(packsInTopic(packs, 'work').length, 2);
  });
});

describe('your conversations', () => {
  test('"n this week" counts conversations from the last seven days, and says nothing for none', () => {
    const packs = [pack('a', { daysAgo: 1 }), pack('b', { daysAgo: 6 }), pack('c', { daysAgo: 9 })];
    assert.equal(thisWeekLine(packs, NOW), '2 this week');
    assert.equal(thisWeekLine([pack('c', { daysAgo: 9 })], NOW), null);
  });

  test('a card says when and how long, keeps its kept phrases to two and counts the rest', () => {
    const lines = ['Je voudrais un croissant', 'L’addition, s’il vous plaît', 'Sur place', 'Merci beaucoup'];
    const p = pack('p1', { lines, durationSec: 250 });
    const c = conversationCard({ pack: p, packs: [p], deck: lines.map((fr) => card(fr)), bank: [], now: NOW, revisitAllowed: false });
    assert.equal(c.meta, 'Yesterday, 4 min spoken');
    assert.deepEqual(c.kept, lines.slice(0, 2));
    assert.equal(c.more, '+2 more');
    const untimed = conversationCard({ pack: pack('p2'), packs: [], deck: [], bank: [], now: NOW, revisitAllowed: false });
    assert.equal(untimed.meta, 'Yesterday', 'an untimed conversation claims minutes');
  });

  test('every door on a card: Fixes, the two warm-up stages, recall in a Drill, and the revisit', () => {
    const lines = ['Je voudrais un café', 'Sur place'];
    const p = pack('p1', { lines, corrections: [{ quote: 'Je veux café', better: 'Je voudrais un café', betterEn: 'I would like a coffee', why: 'more polite' }] });
    const c = conversationCard({ pack: p, packs: [p], deck: lines.map((fr) => card(fr)), bank: lines.map(exercise), now: NOW, revisitAllowed: true, access: unlocked });
    assert.deepEqual(c.fixes?.route, { screen: 'Fixes', params: { packId: 'p1' } });
    assert.deepEqual(c.steps?.map((s) => s.route), [
      { screen: 'ConversationPractice', params: { packId: 'p1' } },
      { screen: 'ConversationPractice', params: { packId: 'p1', stage: 'listen' } },
      { screen: 'Drill', params: { practice: 'pack', packId: 'p1' } },
    ]);
    assert.deepEqual(c.steps?.map((s) => s.title), ['Understand it', 'Catch it by ear', 'Remember it']);
    assert.equal(c.revisit?.label, TALK_AGAIN);
    assert.deepEqual(c.revisit?.route, { screen: 'Convo', params: { continuationPackId: 'p1' } });
    assert.match(c.revisit?.uses ?? '', /live minutes/i, 'the revisit does not say it uses live minutes');
  });

  test('no steps without drillable material, no fixes without corrections, no revisit unless the plan opens it', () => {
    const p = pack('p1', { lines: ['Bonjour'] });
    const c = conversationCard({ pack: p, packs: [p], deck: [card('Bonjour')], bank: [], now: NOW, revisitAllowed: false });
    assert.equal(c.steps, null);
    assert.equal(c.fixes, null);
    assert.equal(c.revisit, null);
    const waiting = conversationCard({ pack: pack('g', { state: 'generating' }), packs: [], deck: [], bank: [], now: NOW, revisitAllowed: true });
    assert.equal(waiting.summary, 'Your learning notes are being prepared');
  });

  test('a revisit says the learner\'s own French this time, and never that they asked for less help', () => {
    const source = pack('s1', { daysAgo: 4 });
    const revisit = pack('r1', { revisedFromPackId: 's1', wins: ['on a fait un tour'] });
    const c = conversationCard({ pack: revisit, packs: [source, revisit], deck: [], bank: [], now: NOW, revisitAllowed: false });
    assert.deepEqual(c.revisited, { from: 'Title s1', win: 'on a fait un tour' });
    const lines = revisitedLines(c.revisited!);
    assert.ok(lines.some((l) => l === 'You used “on a fait un tour” this time.'));
    assert.ok(!lines.join(' ').match(/less help/i), 'a revisit claims less help, which nothing records');
    const silent = conversationCard({ pack: pack('r2', { revisedFromPackId: 's1' }), packs: [source], deck: [], bank: [], now: NOW, revisitAllowed: false });
    assert.equal(silent.revisited?.win, null);
  });
});

describe('comes up often', () => {
  const patterns = {
    'gender-agreement': { count: 9, lastSeen: new Date(NOW - DAY).toISOString(), example: 'le table' },
    'ne-retention': { count: 20, lastSeen: new Date(NOW).toISOString(), example: 'je ne sais pas' },
    'made-up-tag': { count: 30, lastSeen: new Date(NOW).toISOString(), example: 'x' },
  };

  test('only tags with authored learner copy are shown, with no count anywhere', () => {
    const rows = comesUpOften({ patterns, packs: [], bank: [] });
    assert.deepEqual(rows.map((r) => r.tag), ['gender-agreement']);
    assert.equal(rows[0]!.title, PATTERN_COPY['gender-agreement']!.title);
    assert.equal(rows[0]!.hint, 'le or la, un or une');
    const said = JSON.stringify(rows);
    assert.doesNotMatch(said, /\b9\b|count/, 'a mistake pattern carries a count');
    assert.equal(comesUpOften({ patterns: undefined, packs: [], bank: [] }).length, 0);
  });

  test('a tag seen once does not appear, and a tag seen twice appears with no count in its copy', () => {
    const once = { 'gender-agreement': { count: 1, lastSeen: new Date(NOW).toISOString(), example: 'le table' } };
    assert.equal(comesUpOften({ patterns: once, packs: [], bank: [] }).length, 0, 'one sighting is called often');
    const twice = { 'gender-agreement': { count: 2, lastSeen: new Date(NOW).toISOString(), example: 'le table' } };
    const rows = comesUpOften({ patterns: twice, packs: [], bank: [] });
    assert.equal(rows.length, 1);
    assert.doesNotMatch(`${rows[0]!.title} ${rows[0]!.hint}`, /\d/, 'the tally reaches the learner');
  });

  test('"Practise this" opens a drill only when the bank can ask for a fix that shows the pattern', () => {
    const p = pack('p1', { corrections: [{ quote: 'le table', better: 'la table', betterEn: 'the table', why: 'table is feminine' }] });
    const none = comesUpOften({ patterns, packs: [p], bank: [] });
    assert.equal(none[0]!.practise, null, 'a pattern with no drill behind it opens an empty sitting');
    const some = comesUpOften({ patterns, packs: [p], bank: [exercise('la table')] });
    assert.deepEqual(some[0]!.practise, { screen: 'Drill', params: { node: { id: 'pattern:gender-agreement', title: 'Gender agreement', phraseKeys: [phraseKeyOf('la table')] } } });
    assert.ok(!JSON.stringify(some[0]!.practise).includes('moment'), 'the pattern drill shows the better line before a try');
  });
});

describe('the stopped sitting, the mix and saved phrases', () => {
  const LINES = ['Je voudrais un café', 'Sur place', 'Ça fait combien'];
  const deck = LINES.map((fr) => card(fr, { reps: 2 }));
  const bank = LINES.map(exercise);
  const packs = [pack('p1', { lines: LINES })];

  test('pick up names the conversation and the place in words, and resumes the saved sitting', () => {
    const selection = packSelection({ packId: 'p1', deck, bank, packs, now: NOW })!;
    const built = buildPracticeSession(selection.targets, bank, deck, NOW);
    const first = built.state.queue[0]!;
    const answered = answerCurrent(built.state, first.kind === 'translate' ? first.fr : '').state;
    const saved = toSessionRecord({ sittingId: 's.1', startedAt: NOW, origin: 'pack', packId: 'p1', exposed: false, micSuppressed: false, targets: built.targets, state: answered });
    const resume = pickUp({ saved, packs, deck, bank, now: NOW })!;
    assert.match(resume.line, /^Title p1, phrase two of three$/);
    assert.deepEqual(resume.route, { screen: 'Drill', params: { practice: 'resume' } });
    // 2026-10-20, lock seam wiring: pick up carries no lock at all; a resumed sitting is free on main's guard.
    assert.equal('locked' in resume, false);
    assert.equal(pickUp({ saved: null, packs, deck, bank, now: NOW }), null);
  });

  test('the mix shows only when it spans topics, says how many are due and no minutes', () => {
    const due = LINES.map((fr) => card(fr, { due: NOW - DAY, reps: 2 }));
    const topics: PracticeTopic[] = [
      { id: 'topic:a', title: { fr: 'a', en: 'a' }, discussed: [], phraseKeys: [phraseKeyOf(LINES[0]!)] },
      { id: 'topic:b', title: { fr: 'b', en: 'b' }, discussed: [], phraseKeys: [phraseKeyOf(LINES[1]!), phraseKeyOf(LINES[2]!)] },
    ];
    const mix = mixCard({ deck: due, bank, topics, now: NOW })!;
    assert.equal(mix.line, '3 phrases due from different talks');
    assert.doesNotMatch(mix.line, /min/);
    assert.deepEqual(mix.route, { screen: 'Drill', params: { mix: true } });
    assert.equal(mixCard({ deck: due, bank, topics: topics.slice(0, 1), now: NOW }), null);
  });

  test('saved phrases say how many are saved and used, or where the first will land', () => {
    // 2026-10-20, sim nits: "saved", not "kept", which overstates retention.
    const used = card('Bonjour', { evidence: { retrievals: 0, convoUses: 2, transfers: 0 } });
    assert.equal(savedPhrasesLine([used, card('Merci')]), '2 saved, 1 used in conversation');
    assert.equal(savedPhrasesLine([]), 'Your first saved phrase lands here.');
  });

  test('phrase status in words: used and recalled times, or not practised yet, never "in n conversations"', () => {
    assert.equal(phraseStatus(card('a', { evidence: { retrievals: 1, convoUses: 3, transfers: 0 } })), 'Used 3 times');
    assert.equal(phraseStatus(card('a', { evidence: { retrievals: 3, convoUses: 0, transfers: 0 } })), 'Recalled 3 times');
    assert.equal(phraseStatus(card('a', { evidence: { retrievals: 1, convoUses: 0, transfers: 0 } })), 'Recalled once');
    assert.equal(phraseStatus(card('a', { reps: 0 })), 'Not practised yet');
    assert.equal(phraseStatus(undefined), 'Not practised yet');
    for (const said of ['Used 3 times', 'Recalled 3 times']) assert.doesNotMatch(said, /conversations/);
  });
});

describe('lock badges come only through the seam', () => {
  // 2026-10-20, lock seam wiring: pick up is free now, a locked revisit is offered with its badge, and each route-less lock names its feature.
  test('a locked seam locks the steps, the revisit, the patterns and the mix; an open one locks nothing', () => {
    const LINES = ['Sur place', 'Merci'];
    const p = pack('p1', { lines: LINES });
    const args = { pack: p, packs: [p], deck: LINES.map((fr) => card(fr)), bank: LINES.map(exercise), now: NOW, revisitAllowed: true };
    const shut = conversationCard({ ...args, access: lockedAll });
    assert.equal(shut.stepsLocked, true);
    assert.equal(shut.revisit?.locked, true);
    assert.equal(shut.revisit?.feature, 'continueArc');
    const unread = conversationCard({ ...args, revisitAllowed: false, access: unlocked });
    assert.equal(unread.revisit, null, 'an unknown plan offers a revisit it cannot vouch for');
    const free = conversationCard({ ...args, revisitAllowed: false, access: lockedAll });
    assert.equal(free.revisit?.locked, true, 'a free learner is not shown the locked revisit');
    const open = conversationCard({ ...args, access: unlocked });
    assert.equal(open.stepsLocked, false);
    assert.equal(open.revisit?.locked, false);
    const patterns = { 'gender-agreement': { count: 2, lastSeen: new Date(NOW).toISOString(), example: 'x' } };
    assert.equal(comesUpOften({ patterns, packs: [], bank: [], access: lockedAll })[0]!.locked, true);
    // 2026-10-20, lock seam wiring: the default is the real seam, open while no plan is read.
    assert.equal(comesUpOften({ patterns, packs: [], bank: [] })[0]!.locked, false);
  });
});

describe('the empty page — B-Empty-Practice', () => {
  test('a learner with nothing on the page, in the cache or unavailable is new', () => {
    assert.equal(isNewLearner({ page: [], packs: [], unavailable: [] }), true);
    assert.equal(isNewLearner({ page: [], packs: [], unavailable: [{}] }), false);
    assert.equal(isNewLearner({ page: [], packs: [{}], unavailable: [] }), false);
  });
  test('the café starter counts the lesson\'s real turns and says what the lesson costs, and nothing claims to be free', () => {
    assert.match(EMPTY.cafe.line, /^\d+ starter phrases$/);
    assert.match(EMPTY.cafe.cost, /live minutes/);
    assert.doesNotMatch(JSON.stringify(EMPTY), /\bfree\b|offline/i);
    assert.equal(EMPTY.start, 'Start your first conversation');
  });
  test('Sounds of French badges only when the seam says sounds is locked', () => {
    // 2026-10-20, sim nits: the row had no badge though sounds is a locked feature.
    const asked: LockedFeature[] = [];
    const locked = soundsRow((f) => { asked.push(f); return 'locked'; });
    assert.deepEqual(asked, ['sounds']);
    assert.deepEqual(locked, { title: 'Sounds of French', gloss: 'One sound at a time', locked: true });
    assert.equal(soundsRow(() => 'unlocked').locked, false);
  });
});

// 2026-10-20, lock seam wiring: the default seam against a stubbed D24 standing.
describe('practice locks against the real standing', () => {
  const FREE = { plan: 'trial' as const, secondsRemaining: 300, periodEnd: null, lapsed: false, canStart: true, reason: null };
  const LINES = ['Sur place', 'Merci', 'Au revoir'];
  const due = LINES.map((fr) => card(fr, { due: NOW - DAY, reps: 2 }));
  const bank = LINES.map(exercise);
  const p = pack('p1', { lines: LINES });
  const topics: PracticeTopic[] = [
    { id: 'topic:a', title: { fr: 'a', en: 'a' }, discussed: [], phraseKeys: [phraseKeyOf(LINES[0]!)] },
    { id: 'topic:b', title: { fr: 'b', en: 'b' }, discussed: [], phraseKeys: [phraseKeyOf(LINES[1]!), phraseKeyOf(LINES[2]!)] },
  ];

  test('a free learner sees the steps, the revisit and the mix locked; each tap opens the Wall', async () => {
    const { setStanding, clearStanding, lockedRouteFeature } = await import('../purchases/featureLocks.ts');
    try {
      setStanding('u1', FREE);
      const c = conversationCard({ pack: p, packs: [p], deck: due, bank, now: NOW, revisitAllowed: false });
      assert.equal(c.stepsLocked, true);
      for (const step of c.steps ?? []) assert.notEqual(lockedRouteFeature(step.route.screen, 'params' in step.route ? step.route.params : undefined), null, `${step.key} is badged but its route is free`);
      assert.equal(c.revisit?.locked, true, 'a free learner is not offered the locked revisit');
      assert.equal(c.revisit?.feature, 'continueArc');
      const mix = mixCard({ deck: due, bank, topics, now: NOW })!;
      assert.equal(mix.locked, true);
      assert.equal(mix.feature, 'conversationPractice');
      assert.equal(lockedRouteFeature(mix.route.screen, 'params' in mix.route ? mix.route.params : undefined), null, 'the mix route is guarded now; the tab gate is redundant');
    } finally {
      clearStanding();
    }
  });

  test('an unknown plan locks nothing and hides the revisit it cannot vouch for', () => {
    const c = conversationCard({ pack: p, packs: [p], deck: due, bank, now: NOW, revisitAllowed: false });
    assert.equal(c.stepsLocked, false);
    assert.equal(c.revisit, null);
    assert.equal(mixCard({ deck: due, bank, topics, now: NOW })!.locked, false);
  });
});

// 2026-10-21 UI-008, artboards B-Practice, B-Empty-Practice and B-Fixes.
describe('the B-Practice additions: search, the pattern card, the smaller cards and the café lock', () => {
  test('search matches every typed word in a title or summary, accents and case aside, on the device', () => {
    const a = buildConversationPack({ ...pack('a'), title: { fr: 'Le premier café', en: 'Your first café' }, summary: 'You ordered a croissant.' });
    const b = buildConversationPack({ ...pack('b'), title: { fr: 'Demander le chemin', en: 'Asking the way' }, summary: 'Finding the métro.' });
    assert.deepEqual(packsMatching([a, b], '').map((p) => p.id), ['a', 'b']);
    assert.deepEqual(packsMatching([a, b], '  CAFE ').map((p) => p.id), ['a']);
    assert.deepEqual(packsMatching([a, b], 'metro').map((p) => p.id), ['b'], 'an unaccented search misses an accented summary');
    assert.deepEqual(packsMatching([a, b], 'chemin').map((p) => p.id), ['b'], 'the French title is not searched');
    assert.deepEqual(packsMatching([a, b], 'café métro').map((p) => p.id), [], 'a search matches on any word rather than every word');
  });

  test('the pattern card shows one authored pattern, opens the newest fixes, and never carries a count', () => {
    assert.equal(COMES_UP_OFTEN_ENABLED, true);
    const patterns = { 'gender-agreement': { count: 7, lastSeen: new Date(NOW).toISOString(), example: 'le table' }, 'verb-conjugation': { count: 3, lastSeen: new Date(NOW - DAY).toISOString(), example: 'je va' } };
    const older = pack('o', { daysAgo: 5, corrections: [{ quote: 'le table', better: 'la table', betterEn: 'the table', why: 'a reason' }] });
    const newer = pack('n', { daysAgo: 1, corrections: [{ quote: 'je va', better: 'je vais', betterEn: 'I go', why: 'a reason' }] });
    const none = pack('z', { daysAgo: 0 });
    const shown = patternCard({ patterns, packs: [older, newer, none], bank: [] })!;
    assert.equal(shown.row.tag, 'gender-agreement', 'more than one pattern, or not the latest seen');
    assert.deepEqual(shown.fixes, { screen: 'Fixes', params: { packId: 'n' } }, 'the card does not open the newest conversation with fixes');
    assert.doesNotMatch(JSON.stringify(shown), /\b7\b|count/);
    assert.equal(patternCard({ patterns, packs: [none], bank: [] })!.fixes, null, 'the card opens a conversation with no fixes');
    assert.equal(patternCard({ patterns: {}, packs: [older], bank: [] }), null);
    assert.equal(patternCard({ patterns, packs: [], bank: [], access: lockedAll })!.row.locked, true);
    assert.doesNotMatch(PATTERN_FREE, /\d/, 'the pattern card claims minutes nothing estimates');
  });

  test('a smaller card draws friends or the map, and Practise it opens the first step through the seam', () => {
    assert.deepEqual(compactArt(pack('t', { topics: [TRAIN] }), 0), { name: 'map-route', ground: 'sage' });
    assert.deepEqual(compactArt(pack('r', { revisedFromPackId: 's' }), 1), { name: 'friends-cheer', ground: 'lavender' });
    assert.deepEqual(compactArt(pack('x'), 1), { name: 'map-route', ground: 'sage' });
    const LINES = ['Sur place', 'Merci'];
    const p = pack('p1', { lines: LINES, corrections: [{ quote: 'a', better: 'Merci', betterEn: 'Thanks', why: 'a reason' }] });
    const args = { pack: p, packs: [p], deck: LINES.map((fr) => card(fr)), bank: LINES.map(exercise), now: NOW, revisitAllowed: true };
    const open = conversationCard({ ...args, access: unlocked, index: 1 });
    assert.deepEqual(open.practiseIt, { route: { screen: 'ConversationPractice', params: { packId: 'p1' } }, locked: false, feature: 'conversationPractice' });
    assert.equal(open.fixes?.locked, false);
    const shut = conversationCard({ ...args, access: lockedAll });
    assert.equal(shut.practiseIt?.locked, true);
    assert.equal(shut.fixes?.locked, true, 'the fixes row hides the lock its route opens');
    const empty = conversationCard({ ...args, bank: [], deck: [] });
    assert.equal(empty.practiseIt, null, 'Practise it opens a sitting that cannot start');
  });

  test('the café row says what it costs, draws no "free" and takes the sounds lock from the seam', () => {
    assert.equal(cafeRow(lockedAll).locked, true);
    assert.equal(cafeRow(unlocked).locked, false);
    const row = cafeRow(unlocked);
    assert.doesNotMatch(`${row.line} ${row.cost}`, /\bfree\b/i, 'the café lesson says free while it uses live minutes');
  });
});
