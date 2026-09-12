import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { FIRST_MISSION, MISSIONS, missionStates, type MissionProgress } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { PROMISE, missionStatus } from '../missions/chooserView.ts';
import type { ScenarioRecord } from '../missions/progressStore.ts';
import { EXPECTED_TIME, HERO_COPY, HERO_LABELS, RESUME_REASON, fallbackHero, heroLabel, homeMissionFrom } from './homeMission.ts';

/** Nine in the evening, local, on a Saturday. */
const EVENING = new Date(2026, 8, 12, 21, 0, 0).getTime();
const MORNING = new Date(2026, 8, 12, 9, 0, 0).getTime();

function fresh(now = EVENING): MissionProgress[] {
  return missionStates([], [], now);
}

describe('tonight’s French — the one situation Home leads with (F543)', () => {
  test('home leads with one mission, its reason and its time line, and a new learner meets the café', () => {
    // A learner who has never spoken is sent to the café with the promise.
    const first = homeMissionFrom({ progress: fresh(), records: [], spokenBefore: false, now: EVENING });
    assert.ok(first !== null);
    assert.equal(first.kind, 'first');
    assert.equal(first.mission.id, FIRST_MISSION);
    assert.equal(first.label, HERO_LABELS.first);
    assert.equal(first.reason, PROMISE);
    assert.equal(first.timeLine, EXPECTED_TIME, 'an unstarted scene carries an expectation in words, never a measurement');

    // A learner who has spoken meets core's next situation, with the chooser's
    // own status line as the reason, and the hour decides the label.
    const next = homeMissionFrom({ progress: fresh(), records: [], spokenBefore: true, now: EVENING });
    assert.ok(next !== null && next.kind === 'next');
    assert.equal(next.label, HERO_LABELS.evening);
    assert.equal(next.reason, missionStatus(fresh().find((p) => p.mission.id === next.mission.id)!.state, 'new'));
    assert.equal(homeMissionFrom({ progress: fresh(MORNING), records: [], spokenBefore: true, now: MORNING })!.label, HERO_LABELS.day);

    // A scene walked out of part way comes back first, whatever is due.
    const market = MISSIONS.find((m) => m.id === 'mission:marche')!;
    const record: ScenarioRecord = { missionId: market.id, at: EVENING - 60_000, elapsedMs: 120_000, beatsDone: 2 };
    const resume = homeMissionFrom({ progress: fresh(), records: [record], spokenBefore: true, now: EVENING });
    assert.ok(resume !== null && resume.kind === 'resume');
    assert.equal(resume.mission.id, market.id);
    assert.equal(resume.label, HERO_LABELS.resume);
    assert.equal(resume.reason, RESUME_REASON);
    assert.match(resume.timeLine, /^About \d+ min remaining$/, 'a measured scene carries the pace estimate, in the gate’s own words');

    // A record with no pace behind it still resumes, and says the expectation.
    const unpaced = homeMissionFrom({ progress: fresh(), records: [{ ...record, beatsDone: 0 }], spokenBefore: true, now: EVENING });
    assert.ok(unpaced !== null && unpaced.kind === 'resume');
    assert.equal(unpaced.timeLine, EXPECTED_TIME);

    // Nothing to offer from means nothing, never an invented scene.
    assert.equal(homeMissionFrom({ progress: [], records: [], spokenBefore: true, now: EVENING }), null);

    // The fallback claims nothing about a learner nobody could read.
    const fallback = fallbackHero(EVENING);
    assert.equal(fallback.mission.id, FIRST_MISSION);
    assert.equal(fallback.kind, 'next');
    assert.equal(fallback.reason, missionStatus('new', 'new'));
    assert.equal(fallback.timeLine, EXPECTED_TIME);
    assert.equal(heroLabel(EVENING), HERO_LABELS.evening);
    assert.equal(heroLabel(MORNING), HERO_LABELS.day);

    for (const line of HERO_COPY) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries "${guiltIn(line)}"`);
      assert.doesNotMatch(line, /—|\d/);
    }
  });
});
