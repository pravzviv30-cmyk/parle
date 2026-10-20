/**
 * What the direction B Speak tab decides (2026-10-20, B2, B-Speak).
 *
 * Every link's target, the less-help card's presence rule and its rung, the
 * minutes band, and the lock badges, asked of `speakTabView.ts` directly.
 */

import assert from 'node:assert/strict';
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
  PREPARE_FIRST,
  REVISIT,
  SEE_MINUTES,
  SPEAK_TAB_COPY,
  correctionsChip,
  lessHelp,
  minutesBand,
  paceChip,
  recommended,
  speakSubtitle,
  speakTiles,
  starterScenes,
  stageWord,
  talkChips,
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
    assert.equal(card.line, `A bit less help this time: ${HELP_WORDS[card.startRung]}`);
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
    assert.equal(lessHelp(stored)!.locked, false, 'something shows as locked before gating exists');
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

  test('tile locks come only from the seam, and only for sounds and memory', () => {
    assert.deepEqual(speakTiles('A').map((t) => t.locked), [false, false, false], 'something shows as locked before gating exists');
    assert.deepEqual(speakTiles('A', locked).map((t) => t.locked), [true, true, false]);
    const asked: string[] = [];
    speakTiles('A', (feature) => { asked.push(feature); return 'unlocked'; });
    assert.deepEqual(asked, ['sounds', 'tutorMemory']);
  });

  test('Revisit a conversation opens Conversations', () => {
    assert.equal(REVISIT.title, 'Revisit a conversation');
    assert.deepEqual(REVISIT.route, { screen: 'Conversations' });
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
