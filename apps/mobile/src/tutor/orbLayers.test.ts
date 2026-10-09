/**
 * The living orb's layers (come alive, core loop 3.3; F764, the orb half).
 *
 * Which layer draws is `orbLayers.ts`, run here over every state and every
 * room fact. The layers themselves load the animation engine, which a Node
 * suite cannot, so the last test reads `VoiceOrb.tsx` and the layer files as
 * text and holds them to drawing what the rule says, in the state's colours,
 * with a name a screen reader is told once.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { streakGuiltIn } from '../copy/guilt.ts';
import type { OrbRoom } from '../live/OrbAudio.tsx';
import { HEARING_YOU, orbLayers, type OrbLayerState } from './orbLayers.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Comments may say anything; only what reaches glass is under test. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const STATES: readonly OrbLayerState[] = ['ready', 'idle', 'connecting', 'speaking', 'listening', 'thinking', 'error'];
/** A room in front of the learner, with both levels measured and the learner heard. */
const HEARD: OrbRoom = { inputLive: true, outputLive: true, hearing: true, awake: true };
/** A room whose levels are not measured: a processor that never started. */
const UNMEASURED: OrbRoom = { inputLive: false, outputLive: false, hearing: false, awake: true };
const MOVING = { reduced: false, paused: false };

describe('the living orb — F764, the orb half', () => {
  test("the orb draws the room's real levels only when they are measured, and today's loops otherwise", () => {
    // Listening with a measured microphone: the ring swells with the voice.
    const listening = orbLayers({ state: 'listening', room: HEARD, ...MOVING });
    assert.equal(listening.ring, true, 'the learner speaks and the orb shows no sign of hearing them');
    assert.equal(listening.caption, 'hearing');
    assert.equal(listening.loopsRest, false, 'the listening orb stopped breathing while it heard the learner');

    // Speaking with the tutor's voice measured: live bars and a pulsing core,
    // and today's loop rests so the core does not move two ways at once.
    const speaking = orbLayers({ state: 'speaking', room: HEARD, ...MOVING });
    assert.equal(speaking.bars, 'live', 'the bars kept their pretend sine with the tutor\'s real voice to hand');
    assert.equal(speaking.pulse, true);
    assert.equal(speaking.loopsRest, true, 'the core breathes on its loop and pulses with the voice at once');

    // Nothing measured: today's orb exactly. A level is never invented.
    for (const state of STATES) {
      const layers = orbLayers({ state, room: UNMEASURED, ...MOVING });
      assert.equal(layers.ring, false, `${state}: a ring swelled with no level measured`);
      assert.equal(layers.bars, 'loop', `${state}: live bars drew with no voice measured`);
      assert.equal(layers.pulse, false);
      assert.equal(layers.caption, 'state', `${state}: "Hearing you" with nothing measured`);
      assert.equal(layers.loopsRest, false, `${state}: today's loops stopped although nothing replaced them`);
    }

    // Each layer belongs to its own state: no ring on the tutor's turn, no live
    // bars while the learner speaks, the arc only while really thinking.
    for (const state of STATES) {
      const layers = orbLayers({ state, room: HEARD, ...MOVING });
      assert.equal(layers.ring, state === 'listening', `${state}: the ring is drawn on the wrong turn`);
      assert.equal(layers.bars === 'live', state === 'speaking', `${state}: the live bars are drawn on the wrong turn`);
      assert.equal(layers.arc === 'turning', state === 'thinking', `${state}: the thinking arc turns when nobody is thinking`);
      assert.equal(layers.caption === 'hearing', state === 'listening', `${state}: "Hearing you" outside the learner's turn`);
    }
    // Measured but not heard: the ring may be still, the word stays the state's.
    assert.equal(orbLayers({ state: 'listening', room: { ...HEARD, hearing: false }, ...MOVING }).caption, 'state');

    // Outside a room there are no layers at all: the Tutor tab, the intro and
    // the waiting screens keep the orb they always had.
    for (const state of STATES) {
      const layers = orbLayers({ state, room: null, ...MOVING });
      assert.deepEqual(
        { ring: layers.ring, bars: layers.bars, pulse: layers.pulse, arc: layers.arc, ripple: layers.ripple, caption: layers.caption, loopsRest: layers.loopsRest },
        { ring: false, bars: 'loop', pulse: false, arc: 'off', ripple: false, caption: 'state', loopsRest: false },
        `${state}: the orb outside a room grew a layer`,
      );
      assert.equal(orbLayers({ state, room: null, reduced: false, paused: true }).loopsRest, true, 'a parked orb outside a room kept looping');
    }
  });

  test('every living layer rests behind another screen, with the app away, when paused or with movement reduced', () => {
    const ASLEEP: OrbRoom = { ...HEARD, awake: false };
    for (const state of STATES) {
      for (const why of [
        { room: ASLEEP, reduced: false, paused: false, name: 'asleep' },
        { room: HEARD, reduced: false, paused: true, name: 'paused' },
      ]) {
        const layers = orbLayers({ state, room: why.room, reduced: why.reduced, paused: why.paused });
        assert.equal(layers.ring, false, `${state} ${why.name}: the ring swells for nobody`);
        assert.equal(layers.bars, 'loop', `${state} ${why.name}: the live bars run for nobody`);
        assert.equal(layers.ripple, false, `${state} ${why.name}: a ripple plays for nobody`);
        assert.equal(layers.loopsRest, true, `${state} ${why.name}: today's loops run behind another screen`);
        assert.notEqual(layers.arc, 'turning', `${state} ${why.name}: the thinking arc turns for nobody`);
        assert.equal(layers.caption, 'state');
      }
      // Reduced motion: nothing travels; the arc holds still and the ripple never plays.
      const reduced = orbLayers({ state, room: HEARD, reduced: true, paused: false });
      assert.equal(reduced.bars, 'loop', `${state}: live bars moved with movement reduced`);
      assert.equal(reduced.ripple, false, `${state}: a ripple played with movement reduced`);
      assert.notEqual(reduced.arc, 'turning', `${state}: the arc turned with movement reduced`);
    }
    // Resting is never blanking: the thinking arc is still drawn, still.
    assert.equal(orbLayers({ state: 'thinking', room: ASLEEP, ...MOVING }).arc, 'still');
    assert.equal(orbLayers({ state: 'thinking', room: HEARD, reduced: true, paused: false }).arc, 'still');
  });

  test("the orb's layers sit in VoiceOrb in the state's own colours, and its accessible name never changes with them", () => {
    const orb = stripComments(read('./VoiceOrb.tsx'));
    // The rule is asked once, and its answer is what the face draws.
    assert.match(orb, /const layers = orbLayers\(\{ state: props\.state, room: audio === null \? null : audio\.room, reduced, paused: props\.paused === true \|\| !active \}\);/);
    assert.match(orb, /paused=\{layers\.loopsRest\}/, 'today\'s loops do not rest while a live layer moves in their place');
    assert.match(orb, /layers\.ring && audio !== null \? <OrbLevelRing level=\{audio\.input\} size=\{size\} color=\{look\.colour\} \/>/, 'the ring is not the learner\'s level in the state colour');
    assert.match(orb, /layers\.bars === 'live' && audio !== null && <View/);
    assert.match(orb, /<LiveBars bands=\{audio\.bands\} heights=\{BAR_HEIGHTS\} size=\{meterSize\} width=\{barWidth\} gap=\{barGap\} color=\{paper\.ink\} \/>/);
    assert.match(orb, /<OrbPulse level=\{audio === null \? null : audio\.output\} on=\{layers\.pulse\}>/);
    assert.match(orb, /<OrbThinkingArc size=\{size\} color=\{look\.colour\} active=\{layers\.arc === 'turning'\} \/>/);
    assert.match(orb, /<OrbRipple cue=\{cue\} size=\{size\} color=\{look\.colour\} allowed=\{layers\.ripple\} \/>/);
    // Today's loop is still the fallback, drawn whenever the live bars are not.
    assert.doesNotMatch(orb, /BAR_HEIGHTS\.map\(/);

    // "Hearing you" is a word drawn under the orb, never what a screen reader
    // is told: the name stays the state's own, and nothing announces it.
    assert.match(orb, /<Text style=\{st\.caption\} accessibilityLabel=\{look\.caption\}>/, 'the caption tells a screen reader "Hearing you" every time the learner pauses for breath');
    assert.match(orb, /accessibilityLabel: `Tutor: \$\{look\.caption\}`/, 'the orb\'s name follows the hearing word');
    assert.doesNotMatch(orb, /accessibilityLiveRegion|announceForAccessibility/, 'the orb announces its own changes');
    assert.equal(HEARING_YOU, 'Hearing you');
    assert.equal(streakGuiltIn(HEARING_YOU), undefined);
    assert.doesNotMatch(HEARING_YOU, /[—–·]/);

    // Every layer is decorative and moves by transform and opacity only, from
    // the room's levels, never from a clock of its own pretending to be a voice.
    for (const file of ['./OrbLevelRing.tsx', './LiveBars.tsx', './OrbPulse.tsx', './OrbThinkingArc.tsx', './OrbRipple.tsx']) {
      const body = stripComments(read(file));
      assert.match(body, /decorative|pointerEvents: 'none'/, `${file} can be read out or catch a touch`);
      assert.doesNotMatch(body, /shadow|elevation|borderWidth/i, `${file} casts a shadow or draws a ring in views`);
      assert.doesNotMatch(body, /sound\/|haptics|celebrate\/effects/, `${file} plays a sound or a haptic in the room`);
    }
    assert.match(stripComments(read('./LiveBars.tsx')), /bands\.value\[index\]/, 'the bars do not read the tutor\'s bands');
    assert.match(stripComments(read('./OrbPulse.tsx')), /level\.value/, 'the core does not read the tutor\'s level');
    assert.match(stripComments(read('./OrbLevelRing.tsx')), /<LevelRing level=\{level\}/, 'the ring is not the shared level ring');
  });
});
