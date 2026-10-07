/**
 * The beats of every celebration (F743): short enough, sounds the founder
 * approved, and silent and still whenever a microphone or a live room is open.
 *
 * The beats are data, so the frame that plays them and these tests read the
 * same thing. The last test reads the templates' source, because a template
 * that waits for a beat its timeline lacks would throw on the device and
 * nowhere else.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { CELEBRATION_MAX_MS } from '../motion/tokens.ts';
import { SFX_APPROVED, SFX_IDS } from '../sound/sfxManifest.ts';
import type { SfxId } from '../sound/sfxIds.ts';
import { TAKEOVER_ORDER } from './events.ts';
import { TIMELINES, beatAt, beatEffects, beatSpan, beatTimes, playsStill, springSettleMs, stillEffects, type HapticCue, type TimelineId } from './timelines.ts';

const ALL = Object.values(TIMELINES);
const HELD = [
  { micLive: true, liveRoom: false },
  { micLive: false, liveRoom: true },
  { micLive: true, liveRoom: true },
];
const FREE = { micLive: false, liveRoom: false };

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');

function cues(id: TimelineId): { sounds: SfxId[]; haptics: HapticCue[] } {
  const beats = TIMELINES[id].beats;
  return {
    sounds: beats.flatMap((beat) => (beat.sound === undefined ? [] : [beat.sound])),
    haptics: beats.flatMap((beat) => (beat.haptic === undefined ? [] : [beat.haptic])),
  };
}

describe('celebration timelines — F743', () => {
  test('every celebration timeline ends within CELEBRATION_MAX_MS', () => {
    for (const type of TAKEOVER_ORDER) assert.ok(TIMELINES[type], `${type} has no timeline`);
    for (const timeline of ALL) {
      assert.ok(timeline.end <= CELEBRATION_MAX_MS, `${timeline.id} ends at ${timeline.end} ms, past ${CELEBRATION_MAX_MS}`);
      assert.ok(timeline.beats.length > 0, `${timeline.id} has no beats`);
      for (const beat of timeline.beats) {
        assert.ok(beat.t >= 0, `${timeline.id} ${beat.element} starts before the card does`);
        assert.ok(beat.t + beatSpan(beat) <= timeline.end, `${timeline.id} ${beat.element} is still moving at ${beat.t + beatSpan(beat)} ms, after its own end`);
      }
      const times = beatTimes(timeline);
      assert.deepEqual(times, [...times].sort((a, b) => a - b));
      assert.equal(times[times.length - 1], timeline.end, `${timeline.id}'s clock never reaches its end`);
    }
    // A spring's span is read from its own description: four time constants.
    assert.equal(springSettleMs('pop'), 406);
    assert.equal(springSettleMs('snap'), 160);
  });

  test('every sound a celebration plays is one the founder approved', () => {
    for (const timeline of ALL) {
      const sounds = [...cues(timeline.id).sounds, ...(timeline.still.sound === null ? [] : [timeline.still.sound])];
      assert.ok(sounds.length > 0, `${timeline.id} plays no sound at all`);
      for (const id of sounds) {
        assert.ok(SFX_IDS.includes(id), `${timeline.id} plays "${id}", which is not one of the twelve`);
        assert.equal(SFX_APPROVED[id], true, `${timeline.id} plays "${id}", which the founder has not approved by ear`);
      }
    }
  });

  test('no beat sounds or is felt while a microphone or a live room is open', () => {
    for (const timeline of ALL) {
      for (const beat of timeline.beats) {
        for (const focus of HELD) {
          assert.deepEqual(beatEffects(beat, focus), { sound: null, haptic: null }, `${timeline.id} ${beat.element} plays into an open microphone or a live room`);
        }
        assert.deepEqual(beatEffects(beat, FREE), { sound: beat.sound ?? null, haptic: beat.haptic ?? null });
      }
      for (const focus of HELD) {
        assert.deepEqual(stillEffects(timeline, focus), { sound: null, haptic: null }, `${timeline.id}'s still frame plays into an open microphone or a live room`);
      }
      assert.deepEqual(stillEffects(timeline, FREE), timeline.still);
    }
  });

  test('a card a hold or a skip lands before it starts makes no sound', () => {
    assert.equal(playsStill({ reduced: true, stopped: false }), true, 'a card shown still under reduced motion lost its one sound');
    assert.equal(playsStill({ reduced: true, stopped: true }), false, 'a card a sheet or a skip landed sounded anyway');
    assert.equal(playsStill({ reduced: false, stopped: true }), false, 'a card a hold landed before it started sounded anyway');
    assert.equal(playsStill({ reduced: false, stopped: false }), false);
    // The clock asks once, the first time the card is final, and only sounds a card that is still for reduced motion.
    const clock = read('./useTimeline.ts');
    assert.match(clock, /if \(latest\.current\.still\) latest\.current\.onStill\(\);/, 'the clock sounds every card that is final before it started');
    assert.match(read('./Takeover.tsx'), /still: playsStill\(\{ reduced, stopped: landed \|\| paused \}\),/, 'a takeover a hold or a skip landed still sounds');
    assert.match(read('./EndCard.tsx'), /still: playsStill\(\{ reduced, stopped: !first \}\),/);
    assert.match(read('./Toast.tsx'), /still: playsStill\(\{ reduced: still, stopped: false \}\),/);
  });

  test('each moment sounds and feels the way the master table says', () => {
    assert.deepEqual(cues('streak-extended').sounds, ['streak']);
    assert.deepEqual(cues('streak-extended').haptics, ['thump', 'arrived']);
    assert.deepEqual(cues('streak-milestone').sounds, ['streak', 'badge']);
    assert.deepEqual(cues('streak-milestone').haptics, ['thump', 'celebrate']);
    assert.deepEqual(cues('level-up').sounds, ['levelup']);
    assert.deepEqual(cues('level-up').haptics, ['celebrate']);
    assert.deepEqual(cues('badge-earned').sounds, ['badge']);
    assert.deepEqual(cues('badge-earned').haptics, ['arrived']);
    assert.deepEqual(cues('purchase-confirmed').sounds, ['complete']);
    assert.deepEqual(cues('purchase-confirmed').haptics, ['celebrate']);
    assert.deepEqual(cues('end-card').sounds, ['complete']);
    assert.deepEqual(cues('end-card').haptics, ['celebrate']);
    // All three quests done (D22): the same end card, and the quest sound with its quiet line. No haptic of its own.
    assert.deepEqual(cues('end-card-quests').sounds, ['complete', 'quest']);
    assert.deepEqual(cues('end-card-quests').haptics, ['celebrate']);
    // Shown still under reduced motion, the line still lands with the quest sound D22 pairs it with.
    assert.deepEqual(TIMELINES['end-card-quests'].still, { sound: 'quest', haptic: 'celebrate' });
    assert.deepEqual(cues('toast').sounds, ['save']);
    assert.deepEqual(cues('toast').haptics, ['arrived']);
    // Shown still, a card plays one of its own sounds and one of its own haptics, once.
    for (const timeline of ALL) {
      const own = cues(timeline.id);
      assert.ok(timeline.still.sound !== null && own.sounds.includes(timeline.still.sound), `${timeline.id} shown still plays a sound of another moment`);
      assert.ok(timeline.still.haptic !== null && own.haptics.includes(timeline.still.haptic), `${timeline.id} shown still gives a haptic of another moment`);
    }
  });

  test('every element a template waits for has a beat in its timeline', () => {
    const asked = (body: string): string[] => [
      ...[...body.matchAll(/reached\('([a-z-]+)'\)/g)].map((m) => m[1]!),
      ...[...body.matchAll(/beatAt\((?:TIMELINE|timeline|TIMELINES\['[a-z-]+'\]), '([a-z-]+)'\)/g)].map((m) => m[1]!),
    ];
    const templates: [TimelineId, string][] = [
      ['streak-extended', './templates/StreakExtended.tsx'],
      ['streak-milestone', './templates/StreakMilestone.tsx'],
      ['level-up', './templates/LevelUp.tsx'],
      ['badge-earned', './templates/BadgeEarned.tsx'],
      ['purchase-confirmed', './templates/PurchaseConfirmed.tsx'],
      ['end-card', './EndCard.tsx'],
      ['end-card-quests', './EndCard.tsx'],
      ['toast', './Toast.tsx'],
    ];
    for (const [id, path] of templates) {
      const elements = asked(read(path));
      assert.ok(elements.length > 0, `${path} waits for no beat, so this check reads nothing`);
      for (const element of elements) assert.doesNotThrow(() => beatAt(TIMELINES[id], element), `${path} waits for "${element}", which ${id} has no beat for`);
    }
    // The frame's words: every takeover's lines, a streak's number, a level's new title.
    const frame = read('./Takeover.tsx');
    for (const element of ['lines', 'number', 'title']) assert.ok(frame.includes(`'${element}'`), `the frame no longer waits for "${element}", so this check is stale`);
    for (const type of TAKEOVER_ORDER) beatAt(TIMELINES[type], 'lines');
    beatAt(TIMELINES['streak-extended'], 'number');
    beatAt(TIMELINES['streak-milestone'], 'number');
    beatAt(TIMELINES['level-up'], 'title');
  });
});
