import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  DAILY_SCENARIOS,
  FIRST_MISSION,
  MISSIONS,
  dailyPick,
  missionStates,
  scenariosForLevel,
  type MissionProgress,
} from '@luvani/core';

import { heroArt } from '../art/maps.ts';
import { guiltIn } from '../copy/guilt.ts';
import type { ScenarioRecord } from '../missions/progressStore.ts';
import { estimateMinutes, readyLine } from './estimate.ts';
import { HERO_COPY, HERO_LABELS, HERO_REASONS, fallbackHero, heroLabel, homeMissionFrom } from './homeMission.ts';

/** Nine in the evening, local, on a Saturday. */
const EVENING = new Date(2026, 8, 12, 21, 0, 0).getTime();
const MORNING = new Date(2026, 8, 12, 9, 0, 0).getTime();

function fresh(now = EVENING): MissionProgress[] {
  return missionStates([], [], now);
}

describe('tonight’s French — the one thing Home leads with (F543, F571)', () => {
  test("home leads with tonight's scene, a resume before it, the café before anything", () => {
    // The ordinary evening. A learner who has spoken before and left nothing
    // unfinished meets today's scene, picked by the day out of their own tier,
    // and the hour decides whether it is called tonight's or today's.
    const today = homeMissionFrom({ progress: fresh(), records: [], spokenBefore: true, levelIndex: 0, now: EVENING });
    assert.ok(today !== null && today.kind === 'today');
    assert.equal(today.label, HERO_LABELS.evening);
    assert.equal(HERO_LABELS.evening, "Tonight's French");
    assert.equal(
      today.scenario.id,
      dailyPick(scenariosForLevel(DAILY_SCENARIOS, 0), EVENING).id,
      'the scene on the card is not the one the day picks out of the learner’s own tier',
    );
    // Every field the card draws comes off the scene itself, so no screen
    // spells a title, a place or a picture.
    assert.equal(today.title, today.scenario.titleEn);
    assert.equal(today.body, today.scenario.bodyEn);
    assert.equal(today.reason, HERO_REASONS.today);
    assert.equal(today.place, today.scenario.place);
    assert.equal(today.art, heroArt(today.scenario.place));
    assert.equal(today.minutes, estimateMinutes({ kind: 'scenario', lines: today.scenario.lines.length }));
    // A learner at a higher tier gets a scene written for them rather than the
    // beginner's pool, on the same day and the same clock reading.
    const pitched = homeMissionFrom({ progress: fresh(), records: [], spokenBefore: true, levelIndex: 3, now: EVENING });
    assert.ok(pitched !== null && pitched.kind === 'today');
    assert.equal(pitched.scenario.id, dailyPick(scenariosForLevel(DAILY_SCENARIOS, 3), EVENING).id);
    // The morning says today rather than tonight.
    const morning = homeMissionFrom({ progress: fresh(MORNING), records: [], spokenBefore: true, levelIndex: 0, now: MORNING });
    assert.equal(morning!.label, HERO_LABELS.day);

    // A scene walked out of part way comes back ahead of the day's: they meant
    // that scene, whatever the pool offers tonight. The minutes on it are
    // measured from their own pace rather than assumed, so they are passed
    // through the estimate untouched.
    const market = MISSIONS.find((m) => m.id === 'mission:marche')!;
    const record: ScenarioRecord = { missionId: market.id, at: EVENING - 60_000, elapsedMs: 120_000, beatsDone: 2 };
    const resume = homeMissionFrom({ progress: fresh(), records: [record], spokenBefore: true, levelIndex: 0, now: EVENING });
    assert.ok(resume !== null && resume.kind === 'resume');
    assert.equal(resume.mission.id, market.id);
    assert.equal(resume.label, HERO_LABELS.resume);
    assert.equal(resume.title, market.titleEn);
    assert.equal(resume.body, market.goalEn);
    assert.equal(resume.reason, HERO_REASONS.resume);
    assert.equal(resume.art, heroArt(market.place));
    assert.ok(resume.minutes > 0, 'a resumed scene is offered with no time on it at all');

    // A record with no pace behind it still resumes, on the mission's own shape
    // rather than on a measurement nobody took.
    const unpaced = homeMissionFrom({
      progress: fresh(),
      records: [{ ...record, beatsDone: 0 }],
      spokenBefore: true,
      levelIndex: 0,
      now: EVENING,
    });
    assert.ok(unpaced !== null && unpaced.kind === 'resume');
    assert.equal(unpaced.minutes, estimateMinutes({ kind: 'mission', beats: market.beatIds.length }));

    // A learner who has never spoken meets the café before anything the pool
    // could offer them. A first conversation is the one the product was built
    // around, and it is not chosen by the calendar.
    const first = homeMissionFrom({ progress: fresh(), records: [], spokenBefore: false, levelIndex: 0, now: EVENING });
    assert.ok(first !== null && first.kind === 'first');
    assert.equal(first.mission.id, FIRST_MISSION);
    assert.equal(first.label, HERO_LABELS.first);
    assert.equal(first.body, first.mission.goalEn);
    assert.equal(first.reason, HERO_REASONS.first);
    assert.equal(first.minutes, estimateMinutes({ kind: 'mission', beats: first.mission.beatIds.length }));

    // Nothing to offer from means nothing, never an invented scene.
    assert.equal(homeMissionFrom({ progress: [], records: [], spokenBefore: true, levelIndex: 0, now: EVENING }), null);

    // The fallback claims nothing about a learner nobody could read: the café,
    // under the hour's own label rather than under "your first", because a
    // learner of two years whose disk would not answer is not on their first
    // anything.
    const fallback = fallbackHero(EVENING);
    // Settled before it is read: a resumed or first scene carries a mission and
    // a day's pick carries a scenario, so the kind decides which one is there.
    assert.ok(fallback.kind === 'first', 'the fallback stopped offering a mission to start');
    assert.equal(fallback.mission.id, FIRST_MISSION);
    assert.equal(fallback.label, HERO_LABELS.evening);
    assert.equal(fallback.reason, HERO_REASONS.fallback);
    assert.equal(fallback.art, heroArt(fallback.mission.place));
    assert.equal(heroLabel(EVENING), HERO_LABELS.evening);
    assert.equal(heroLabel(MORNING), HERO_LABELS.day);

    // Every word this module can put on the card, swept. The time line is the
    // one numeral on the page and it is built elsewhere, so nothing here counts
    // anything at all.
    for (const line of HERO_COPY) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries "${guiltIn(line)}"`);
      assert.doesNotMatch(line, /—|\d|%/);
    }
    assert.equal(readyLine(today.minutes), `Ready for ${today.minutes} min`);
  });

  // Whole-app Stage 3A (2026-09-25). `spokenBefore` counts conversations and
  // lessons only, so a learner who has done typed practice or review but never
  // talked to the tutor still meets the café. Calling that "Your first French"
  // after they have practised French is the app forgetting them; the café is
  // their first conversation, and the label says exactly that.
  test('a learner who has practised but never had a conversation is offered their first conversation, not their first French', () => {
    assert.equal(HERO_LABELS.firstConversation, 'Your first conversation');
    const practised = homeMissionFrom({ progress: fresh(), records: [], spokenBefore: false, practisedBefore: true, levelIndex: 0, now: EVENING });
    assert.ok(practised !== null && practised.kind === 'first', 'the café stopped leading for a learner with no conversation yet');
    assert.equal(practised.mission.id, FIRST_MISSION);
    assert.equal(practised.label, HERO_LABELS.firstConversation, 'practice before a first conversation is still called their first French');

    // Somebody with nothing behind them at all keeps the warmer, still-true label.
    const brandNew = homeMissionFrom({ progress: fresh(), records: [], spokenBefore: false, practisedBefore: false, levelIndex: 0, now: EVENING });
    assert.equal(brandNew!.label, HERO_LABELS.first);

    // A learner who has spoken is past both: practice never pulls them back to a first anything.
    const spoken = homeMissionFrom({ progress: fresh(), records: [], spokenBefore: true, practisedBefore: true, levelIndex: 0, now: EVENING });
    assert.equal(spoken!.kind, 'today');
  });
});
