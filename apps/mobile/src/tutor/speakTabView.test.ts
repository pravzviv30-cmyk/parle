/**
 * What the direction B Speak tab decides (2026-10-20, B2, B-Speak).
 *
 * Every link's target, the less-help card's presence rule and its rung, the
 * minutes band, and the lock badges, asked of `speakTabView.ts` directly.
 */

import assert from 'node:assert/strict';
import { TUTOR_NAME } from './tutorName.ts';
import { describe, test } from 'node:test';
import { FIRST_MISSION, SCENE_SPINE, getMission, missionStates, replayRung, type Rung } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { minutesLine, missionMinutes } from '../home/estimate.ts';
import { learningSuggestions } from '../main/learningSuggestions.ts';
import { planStatusFor, type PlanStatusView } from '../purchases/planStatus.ts';
import { nextConversation } from './nextConversation.ts';
import {
  CHANGE_VOICE_ROUTE,
  DONE_WITHOUT_HELP,
  EVERY_SCENE,
  HELP_WORDS,
  MINUTES_CHECKING,
  MODE_CHOICES,
  OWN_TOPIC,
  PREFERENCES_ROUTE,
  LESS_HELP_LINE,
  MAX_MEMORY_TOPICS,
  MAX_TOPIC_CHARS,
  PREPARE_FIRST,
  STARTER_TILE,
  SEE_MINUTES,
  SPEAK_TAB_COPY,
  correctionsChip,
  lessHelp,
  minutesBand,
  paceChip,
  recommended,
  speakSubtitle,
  speakTiles,
  tileColumns,
  tileLayout,
  wordEm,
  starterScenes,
  stageWord,
  talkChips,
  sampleCaption,
  sceneIcon,
} from './speakTabView.ts';

const NOW = new Date(2026, 9, 20, 9, 0, 0).getTime();
const locked = () => 'locked' as const;
const unlocked = () => 'unlocked' as const;

describe('the header and the Recommended card', () => {
  test('the subtitle names the tutor', () => {
    assert.equal(speakSubtitle('Tutor'), 'Choose what to talk about with Tutor');
  });

  test('a scene leads with its authored goal and minutes, and Prepare first opens its preview', () => {
    const next = nextConversation(missionStates([], [], NOW), null, false);
    const rec = recommended(next);
    const mission = getMission(FIRST_MISSION)!;
    assert.equal(rec.title, mission.titleEn);
    assert.equal(rec.sentence, mission.goalEn, 'the sentence is not the scene\'s authored goal');
    assert.match(rec.sentence, /^[A-Z][a-z]+ /, 'the sentence is not led by a verb');
    assert.equal(rec.minutes, minutesLine(missionMinutes(mission)));
    assert.deepEqual(rec.prepare, { screen: 'ScenePreview', params: { missionId: FIRST_MISSION } });
  });

  test('a thread with no scene behind it claims no minutes and offers no preview', () => {
    const rec = recommended({ title: 'Ma journée', body: 'You were telling me about your day.', minutes: null, params: { seedTopic: {}, continuationPackId: 'p1' } });
    assert.deepEqual(rec, { title: 'Ma journée', sentence: 'You were telling me about your day.', minutes: null, prepare: null });
  });

  test('Prepare first says free and claims no duration nothing estimates', () => {
    assert.equal(PREPARE_FIRST, 'Prepare first, free');
    assert.doesNotMatch(PREPARE_FIRST, /\d|·/);
  });

  test('Speak and Type are the two start modes', () => {
    assert.deepEqual(MODE_CHOICES.map((m) => [m.label, m.textMode]), [['Speak', false], ['Type', true]]);
  });

  test('the preference chips say the setting and open the preferences screen', () => {
    assert.equal(correctionsChip('Balanced'), 'Corrections: Balanced');
    assert.equal(paceChip('Tutor', 'normal'), 'Tutor’s pace: Normal');
    // The setting simplifies the sentences; it never slows the voice.
    assert.equal(paceChip('Tutor', 'slow'), 'Tutor’s pace: Simpler');
    assert.deepEqual(PREFERENCES_ROUTE, { screen: 'LearningPreferences' });
  });
});

describe('the starter scenes', () => {
  test('a first run: a stage word, never CEFR, the next scene marked Next, every row opening its preview', () => {
    const scenes = starterScenes(missionStates([], [], NOW));
    // 2026-10-20, B4 review, B-Speak: the founder's stage word, "Starter scenes".
    assert.equal(scenes.heading, 'Starter scenes');
    assert.equal(stageWord('A0'), 'Starter');
    assert.doesNotMatch(scenes.heading, /A0|A1/);
    assert.equal(scenes.rows[0]!.missionId, SCENE_SPINE[0]);
    assert.equal(scenes.rows.filter((row) => row.next).length, 1);
    assert.ok(scenes.rows[0]!.next);
    for (const row of scenes.rows) {
      const mission = getMission(row.missionId)!;
      assert.equal(row.french, mission.title);
      assert.equal(row.line, mission.canDoEn);
      assert.deepEqual(row.route, { screen: 'ScenePreview', params: { missionId: row.missionId } });
    }
    assert.deepEqual(EVERY_SCENE, { label: 'Every scene', route: { screen: 'Missions' } });
    assert.equal(stageWord('A1'), 'Basics');
    assert.equal(stageWord('A2'), 'Everyday', 'an A2 scene was headed Basics');
  });

  // 2026-10-20 UI-008, artboard B-Speak: each row's tile and mark follow its state.
  test('an earned scene sits on sage with the check, the next on sun with Next, one ahead on lavender with a chevron', () => {
    assert.deepEqual(STARTER_TILE, {
      earned: { ground: 'sage', trailing: 'check' },
      here: { ground: 'sun', trailing: 'next' },
      ahead: { ground: 'lavender', trailing: 'chevron' },
    });
    const scenes = starterScenes(missionStates([{ id: FIRST_MISSION, at: NOW - 1000, rung: 4 }], [], NOW));
    for (const row of scenes.rows) assert.deepEqual(row.tile, STARTER_TILE[row.state]);
    assert.equal(scenes.rows[0]!.tile.trailing, 'check');
    assert.equal(scenes.rows[1]!.tile.trailing, 'next');
  });

  test('a café scene wears the café cup and the hotel the suitcase, at the artboard sizes', () => {
    assert.deepEqual(sceneIcon('cafe'), { name: 'icon-cafe', width: 30, height: 28 });
    assert.deepEqual(sceneIcon('hotel'), { name: 'icon-suitcase', width: 24, height: 28 });
    assert.equal(sceneIcon('street').name, 'icon-suitcase', 'a place with no canvas icon takes a café cup');
    for (const row of starterScenes(missionStates([], [], NOW)).rows) {
      assert.deepEqual(row.icon, sceneIcon(getMission(row.missionId)!.place));
    }
  });

  test('"Done without help" only when the scene itself was finished on your own', () => {
    const own = starterScenes(missionStates([{ id: FIRST_MISSION, at: NOW - 1000, rung: 4 }], [], NOW));
    assert.equal(own.rows[0]!.line, DONE_WITHOUT_HELP);
    assert.equal(own.rows[0]!.state, 'earned');
    assert.ok(own.rows[1]!.next);

    const helped = starterScenes(missionStates([{ id: FIRST_MISSION, at: NOW - 1000, rung: 2 }], [], NOW));
    assert.notEqual(helped.rows[0]!.line, DONE_WITHOUT_HELP, 'a finish with help in play is called without help');
  });
});

describe('same scene, a bit less help', () => {
  test('absent with nothing finished', () => {
    assert.equal(lessHelp([]), null);
  });

  test('a scene finished with help is offered at core\'s replayRung, said in help words', () => {
    const card = lessHelp([{ id: FIRST_MISSION, at: NOW - 1000, rung: 1 }])!;
    assert.ok(card !== null);
    assert.equal(card.missionId, FIRST_MISSION);
    assert.equal(card.lastRung, 1);
    assert.equal(card.startRung, replayRung(1));
    assert.ok(card.startRung > card.lastRung);
    // 2026-10-20 UI-008, artboard B-Speak: the drawn line is the artboard's; the help word rides the spoken label.
    assert.equal(card.line, LESS_HELP_LINE);
    assert.equal(LESS_HELP_LINE, 'A bit less help this time');
    assert.equal(card.help, HELP_WORDS[card.startRung]);
    assert.deepEqual(card.params, { missionId: FIRST_MISSION });
  });

  test('a scene last finished on your own has no help left to take away, so it is not offered', () => {
    assert.equal(replayRung(4), 4);
    assert.equal(lessHelp([{ id: FIRST_MISSION, at: NOW - 1000, rung: 4 }]), null);
  });

  test('the latest finish of each scene decides, and the newest scene with help left wins', () => {
    const second = SCENE_SPINE[1]!;
    const card = lessHelp([
      { id: FIRST_MISSION, at: NOW - 3000, rung: 1 },
      { id: second, at: NOW - 2000, rung: 4 },
      { id: FIRST_MISSION, at: NOW - 1000, rung: 2 },
    ])!;
    assert.equal(card.missionId, FIRST_MISSION);
    assert.equal(card.lastRung, 2);
  });

  test('a record for a scene this build does not know is not a replay', () => {
    assert.equal(lessHelp([{ id: 'no-such-scene', at: NOW, rung: 1 }]), null);
  });

  test('the lock comes only from the seam', () => {
    const stored = [{ id: FIRST_MISSION, at: NOW - 1000, rung: 1 }];
    assert.equal(lessHelp(stored)!.locked, false, 'an unknown plan shows a lock (2026-10-20, lock seam wiring: the seam fails open)');
    assert.equal(lessHelp(stored, unlocked)!.locked, false);
    assert.equal(lessHelp(stored, locked)!.locked, true);
  });

  test('help is named only as Line given, Choices, Hint or On your own', () => {
    assert.deepEqual(([1, 2, 3, 4] as Rung[]).map((r) => HELP_WORDS[r]), ['Line given', 'Choices', 'Hint', 'On your own']);
  });
});

describe('talk about anything', () => {
  test('the learner\'s own suggestions, then their own topic, and nothing invented', () => {
    const suggestions = learningSuggestions({ level: 'zero', confidence: null, focus: null } as never);
    const chips = talkChips(suggestions);
    assert.deepEqual(chips.slice(0, -1).map((c) => c.label), suggestions.ideas.map((i) => i.title));
    for (const [i, idea] of suggestions.ideas.entries()) assert.deepEqual(chips[i]!.params, { seedTopic: { fr: idea.fr, en: idea.en } });
    const own = chips.at(-1)!;
    assert.equal(own.label, OWN_TOPIC);
    assert.equal(own.own, true);
    for (const chip of chips) assert.doesNotMatch(chip.label, /Lyon|My trip|My weekend/);
  });

  // 2026-10-20 UI-008, founder decision: personal topics come from what the tutor remembers.
  const fact = (kind: string, en: string, notedAt: string, fr: string | null = null) => ({ kind, en, fr, notedAt });

  test('remembered interests and life events lead, newest first, at most three, with their own topic last', () => {
    const suggestions = learningSuggestions({ level: 'zero', confidence: null, focus: null } as never);
    const facts = [
      fact('interest', 'Cooking Italian food', '2026-10-01T09:00:00Z', 'La cuisine italienne'),
      fact('life-event', 'A trip to Lyon', '2026-10-10T09:00:00Z', 'Un voyage à Lyon'),
      fact('goal', 'Order in French', '2026-10-12T09:00:00Z', 'Commander'),
      fact('preference', 'Short answers', '2026-10-13T09:00:00Z', 'Des réponses courtes'),
      fact('interest', 'Running', '2026-10-05T09:00:00Z', 'La course'),
      fact('interest', 'Jazz', '2026-09-01T09:00:00Z', 'Le jazz'),
      fact('interest', '  ', '2026-10-15T09:00:00Z', 'Rien'),
    ];
    const chips = talkChips(suggestions, { facts, paused: false });
    assert.deepEqual(chips.map((c) => c.label), ['A trip to Lyon', 'Running', 'Cooking Italian food', OWN_TOPIC]);
    assert.equal(MAX_MEMORY_TOPICS, 3);
    assert.deepEqual(chips[2]!.params.seedTopic, { fr: 'La cuisine italienne', en: 'Talk with me about this: Cooking Italian food' });
    assert.ok(chips.slice(0, -1).every((c) => !c.own));
    for (const idea of suggestions.ideas) assert.ok(!chips.some((c) => c.label === idea.title), 'suggestions show beside remembered topics');
  });

  // 2026-10-20, learning-science review: a stored fact reads as a chip, a long one is not a
  // chip, and a fact with no French is skipped (the room keeps a seed only with real French).
  test('a lower-case fact is capitalised, a long fact or one without French is skipped', () => {
    const suggestions = learningSuggestions({ level: 'zero', confidence: null, focus: null } as never);
    const ideas = suggestions.ideas.map((i) => i.title);
    const dog = talkChips(suggestions, { facts: [fact('interest', '  has a dog ', '2026-10-12T09:00:00Z', 'un chien')], paused: false });
    assert.equal(dog[0]!.label, 'Has a dog');
    assert.deepEqual(dog[0]!.params.seedTopic, { fr: 'un chien', en: 'Talk with me about this: Has a dog' });
    for (const fr of [null, '', '   ']) {
      const none = talkChips(suggestions, { facts: [fact('interest', 'has a dog', '2026-10-12T09:00:00Z', fr)], paused: false });
      assert.deepEqual(none.slice(0, -1).map((c) => c.label), ideas, `a fact with French ${JSON.stringify(fr)} became a chip`);
    }
    const long = 'is planning a long walking holiday across Brittany next spring';
    assert.ok(long.length > MAX_TOPIC_CHARS);
    const skipped = talkChips(suggestions, { facts: [fact('life-event', long, '2026-10-12T09:00:00Z', 'Des vacances')], paused: false });
    assert.deepEqual(skipped.slice(0, -1).map((c) => c.label), ideas, 'a long fact did not fall back to the suggestions');
    const mixed = talkChips(suggestions, { facts: [fact('life-event', long, '2026-10-12T09:00:00Z', 'Des vacances'), fact('interest', 'cats', '2026-10-12T08:00:00Z'), fact('interest', 'jazz', '2026-10-11T09:00:00Z', 'le jazz')], paused: false });
    assert.deepEqual(mixed.map((c) => c.label), ['Jazz', OWN_TOPIC]);
    assert.equal(mixed[0]!.params.seedTopic!.fr, 'le jazz');
    assert.equal(MAX_TOPIC_CHARS, 32);
  });

  test('with no remembered topic, or with memory paused, the suggestions stand in', () => {
    const suggestions = learningSuggestions({ level: 'zero', confidence: null, focus: null } as never);
    const ideas = suggestions.ideas.map((i) => i.title);
    const onlyGoals = talkChips(suggestions, { facts: [fact('goal', 'Order in French', '2026-10-12T09:00:00Z')], paused: false });
    assert.deepEqual(onlyGoals.slice(0, -1).map((c) => c.label), ideas);
    const paused = talkChips(suggestions, { facts: [fact('interest', 'Jazz', '2026-10-12T09:00:00Z', 'Le jazz')], paused: true });
    assert.deepEqual(paused.slice(0, -1).map((c) => c.label), ideas, 'a paused memory still offers what it remembers');
    assert.equal(paused.at(-1)!.label, OWN_TOPIC);
    const twice = talkChips(suggestions, { facts: [fact('interest', 'Jazz', '2026-10-12T09:00:00Z', 'Le jazz'), fact('life-event', 'jazz', '2026-10-11T09:00:00Z', 'le jazz')], paused: false });
    assert.deepEqual(twice.map((c) => c.label), ['Jazz', OWN_TOPIC], 'the same topic is offered twice');
  });

  test('their own topic is an open conversation, carrying their free seed only when one exists', () => {
    assert.deepEqual(talkChips({ ideas: [] }).at(-1)!.params, {});
    const seed = { fr: 'Une conversation libre', en: 'Talk about anything.' };
    assert.deepEqual(talkChips({ ideas: [], freeSeed: seed }).at(-1)!.params, { seedTopic: seed });
  });
});

describe('the tutor, the tiles and the conversations row', () => {
  test('Change voice opens the Profile voice sheet', () => {
    assert.deepEqual(CHANGE_VOICE_ROUTE, { screen: 'Profile', params: { sheet: 'tutorVoice' } });
  });

  test('three tiles to their screens, with the pronunciation tile never saying "Practise pronunciation"', () => {
    const tiles = speakTiles('Tutor');
    assert.deepEqual(tiles.map((t) => [t.title, t.route.screen]), [
      ['Pronunciation help', 'SoundJourney'],
      ['What Tutor remembers', 'TutorMemory'],
      ['How your tutor works', 'TutorIntro'],
    ]);
    for (const tile of tiles) assert.doesNotMatch(tile.title, /Practise pronunciation/);
  });

  test('a tile title never breaks inside a word: three, two or one to a row', () => {
    // 2026-10-20, sim nits: "Pronunciati / on help" at 375pt in three columns.
    const at = (width: number, fontScale: number, name = TUTOR_NAME) =>
      tileColumns({ contentWidth: width - 40, fontScale, titleSize: 16, gap: 8, padding: 12, titles: speakTiles(name).map((t) => t.title) });
    const wordFits = (width: number, fontScale: number, n: number, word: string) =>
      (width - 40 - 8 * (n - 1)) / n - 24 >= Array.from(word).length * 16 * fontScale * 0.6;
    assert.equal(at(375, 1, 'Bartholomew'), 2, 'a longer tutor name still fits two columns');
    assert.equal(at(375, 1), 2, 'three columns break Pronunciation at 375pt');
    assert.ok(wordFits(375, 1, 2, 'Pronunciation'));
    assert.ok(!wordFits(375, 1, 3, 'Pronunciation'));
    assert.equal(at(1024, 1), 3, 'a wide screen keeps the three tiles in one row');
    assert.equal(at(375, 1.5), 1, 'large text stacks the tiles');
    assert.equal(at(320, 1), 1);
    for (const [width, scale] of [[375, 1], [375, 1.2], [390, 1.35], [430, 1], [768, 1.3]] as const) {
      const n = at(width, scale);
      for (const word of ['Pronunciation', TUTOR_NAME, 'Bartholomew', 'remembers', 'tutor', 'works']) {
        assert.ok(n === 1 || wordFits(width, scale, n, word), `${word} breaks at ${width}pt x${scale} in ${n} columns`);
      }
    }
  });

  // 2026-10-20 UI-008, sim check (402pt): the artboard's three in a row on a phone.
  test('three tiles to a row on a phone at ordinary sizes, wrapping between words, never inside one', () => {
    const layout = (width: number, fontScale: number, name = TUTOR_NAME) =>
      tileLayout({ contentWidth: width - 40, fontScale, titleSize: 14, gap: 8, titles: speakTiles(name).map((t) => t.title) });
    const fits = (width: number, fontScale: number, padding: number, word: string) => (width - 40 - 16) / 3 - padding * 2 >= wordEm(word) * 14 * fontScale;
    assert.deepEqual(layout(402, 1), { columns: 3, padding: 12 });
    assert.equal(layout(390, 1).columns, 3);
    assert.equal(layout(390, 1).padding, 10, 'the padding tightens before a column is given up');
    for (const [width, scale] of [[375, 1], [390, 1], [402, 1], [430, 1], [402, 1.15]] as const) {
      const { columns, padding } = layout(width, scale);
      if (columns !== 3) continue;
      for (const word of ['Pronunciation', TUTOR_NAME, 'remembers', 'tutor', 'works']) assert.ok(fits(width, scale, padding, word), `${word} breaks at ${width}pt x${scale}`);
    }
    assert.ok(layout(375, 1).columns < 3 || fits(375, 1, layout(375, 1).padding, 'Pronunciation'));
    assert.notEqual(layout(402, 1.2).columns, 3, 'larger text keeps the old fallback');
    assert.equal(layout(402, 1.5).columns, 1, 'large text stacks the tiles');
    assert.ok(wordEm('Pronunciation') > wordEm('help'));
  });

  test('tile locks come only from the seam, and only for sounds and memory', () => {
    assert.deepEqual(speakTiles('A').map((t) => t.locked), [false, false, false], 'an unknown plan shows a lock (2026-10-20, lock seam wiring: the seam fails open)');
    assert.deepEqual(speakTiles('A', locked).map((t) => t.locked), [true, true, false]);
    const asked: string[] = [];
    speakTiles('A', (feature) => { asked.push(feature); return 'unlocked'; });
    assert.deepEqual(asked, ['sounds', 'tutorMemory']);
  });

  // 2026-10-20 UI-008, artboard B-Speak: replaces "Revisit a conversation opens Conversations".
  // The artboard draws no revisit row; Conversations is still reached from Journey and Settings.
  test('the revisit row left Speak, and Conversations keeps its ways in', async () => {
    const { readFileSync } = await import('node:fs');
    const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.doesNotMatch(read('./speakTabView.ts'), /Revisit a conversation|screen: 'Conversations'/);
    assert.match(read('../tabs/MyFrenchTab.tsx'), /nav\.navigate\('Conversations'\)/);
    assert.match(read('../settings/SettingsScreen.tsx'), /nav\.navigate\('Conversations'\)/);
  });

  test('the tutor\'s sample is readable while it is heard, and the row at rest is the artboard\'s', () => {
    assert.equal(sampleCaption(true, 'Bonjour, je suis là.'), 'Bonjour, je suis là.');
    assert.equal(sampleCaption(false, 'Bonjour, je suis là.'), null);
  });

  test('each tile carries its canvas drawing and pastel at the artboard sizes', () => {
    assert.deepEqual(speakTiles('A').map((t) => [t.ground, t.art]), [
      ['peach', { name: 'voice-chat', width: 60, height: 55 }],
      ['sage', { name: 'star-jar', width: 60, height: 55 }],
      ['butter', { name: 'compass', width: 55, height: 55 }],
    ]);
  });
});

describe('the minutes footer', () => {
  test('a band in words, from planStatus, never a number', () => {
    assert.equal(minutesBand(null), MINUTES_CHECKING);
    const unknown = planStatusFor(null, NOW);
    assert.equal(minutesBand(unknown), (unknown as Extract<PlanStatusView, { known: false }>).line);
    const known: PlanStatusView = { known: true, planLabel: 'Free minutes', periodLine: 'Your free minutes, once.', band: 'plenty', bandLine: 'Plenty of speaking time left.', canStart: true };
    assert.equal(minutesBand(known), 'Plenty of speaking time left.');
    for (const line of [minutesBand(null), minutesBand(unknown), minutesBand(known)]) assert.doesNotMatch(line, /\d/);
    assert.deepEqual(SEE_MINUTES, { label: 'See your minutes', route: { screen: 'Subscription' } });
  });

  test('the model reads no raw allowance', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(new URL('./speakTabView.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /secondsRemaining|allowanceSeconds|periodEnd/);
  });
});

describe('the copy', () => {
  test('plain, guilt-free, no em dash and no middot', () => {
    for (const line of SPEAK_TAB_COPY) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries "${guiltIn(line)}"`);
      assert.doesNotMatch(line, /—|·/);
    }
  });
});
