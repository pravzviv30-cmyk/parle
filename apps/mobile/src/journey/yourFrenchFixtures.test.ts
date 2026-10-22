/**
 * The Your French screenshot fixtures (2026-10-22) draw the state they are
 * named for. Each one is fed to the real `yourFrenchView`, so a fixture that
 * drifted (a phrase no longer retained, a sound no longer clear) would put the
 * wrong card in the evidence screenshots; these catch that first.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { JOURNEY_TEASERS, YOUR_FRENCH_FORWARD, isEmptyJourney, yourFrenchView } from './journeyView.ts';
import { FIXTURE_NOW, YOUR_FRENCH_STATES, yourFrenchFixture, type YourFrenchState } from './yourFrenchFixtures.ts';

const viewOf = (state: YourFrenchState) => yourFrenchView(yourFrenchFixture(state));

/** What each state promises, said once so every state is checked the same way. */
const EXPECTED: Record<YourFrenchState, { open: readonly string[]; forward: boolean; phrasesTeaser: boolean; soundsTeaser: boolean }> = {
  full: { open: ['phrases', 'sounds', 'scenes'], forward: false, phrasesTeaser: false, soundsTeaser: false },
  sounds: { open: ['sounds'], forward: false, phrasesTeaser: false, soundsTeaser: false },
  scenes: { open: ['scenes'], forward: false, phrasesTeaser: false, soundsTeaser: false },
  forward: { open: [], forward: true, phrasesTeaser: false, soundsTeaser: false },
  free: { open: ['scenes'], forward: false, phrasesTeaser: true, soundsTeaser: true },
};

describe('your french fixtures — each screenshot state draws what it is named for', () => {
  test('there are five states, and the fixed clock is a Tuesday at noon', () => {
    assert.deepEqual([...YOUR_FRENCH_STATES], ['full', 'sounds', 'scenes', 'forward', 'free']);
    const now = new Date(FIXTURE_NOW);
    assert.equal(now.getDay(), 2, 'the fixtures are not dated on a Tuesday, so day words could drift');
    assert.equal(now.getHours(), 12, 'the fixtures are not dated at noon, so a time zone could move the day');
  });

  for (const state of YOUR_FRENCH_STATES) {
    test(`the ${state} learner opens exactly the parts the state names, with its forward line and teasers`, () => {
      const v = viewOf(state);
      const want = EXPECTED[state];
      assert.deepEqual(v.open, want.open, `${state} opens the wrong parts in the card`);
      assert.equal(v.forward !== null, want.forward, `${state} ${want.forward ? 'lost' : 'shows'} the forward line`);
      assert.equal(v.phrases?.teaser != null, want.phrasesTeaser, `${state} ${want.phrasesTeaser ? 'lost' : 'shows'} the phrases teaser`);
      assert.equal(v.sounds?.teaser != null, want.soundsTeaser, `${state} ${want.soundsTeaser ? 'lost' : 'shows'} the sounds teaser`);
    });
  }

  test('the full learner shows the featured phrase, a held tag and the "more in your phrasebook" line', () => {
    const p = viewOf('full').phrases!;
    assert.notEqual(p.featured, null, 'the full card has no featured phrase, so the one highlighter is not in the screenshot');
    assert.ok(p.featured!.held || p.chips.some((c) => c.held), 'no phrase in the full card carries the held tag');
    assert.notEqual(p.moreLine, null, 'the full card draws every phrase, so the more line is not in the screenshot');
    assert.equal(p.locked, false);
  });

  test('only the full learner has a featured phrase on the card', () => {
    for (const state of YOUR_FRENCH_STATES.filter((s) => s !== 'full')) {
      assert.equal(viewOf(state).phrases?.featured ?? null, null, `${state} draws a featured phrase it should not`);
    }
  });

  test('the free learner has phrases and sounds behind their locks, and scenes drawn free', () => {
    const v = viewOf('free');
    assert.equal(v.phrases!.locked, true, 'phrases are open on the free plan');
    assert.equal(v.sounds!.locked, true, 'sounds are open on the free plan');
    assert.equal(v.phrases!.teaser, JOURNEY_TEASERS.used);
    assert.equal(v.sounds!.teaser, JOURNEY_TEASERS.sounds);
    assert.notEqual(v.scenes, null, 'scenes are free, yet the free learner draws none');
    assert.ok(v.open.includes('scenes'), 'the free learner\'s scenes are not drawn in the card');
  });

  test('the forward learner has practised, but reads only the forward line', () => {
    const v = viewOf('forward');
    assert.equal(v.forward, YOUR_FRENCH_FORWARD);
    assert.equal(v.phrases, null);
    assert.equal(v.sounds, null);
    assert.equal(v.scenes, null);
    // Even on a first visit, a finished scene is a practised journey (the tab's own rule), so the tab draws this card.
    assert.equal(isEmptyJourney(true, yourFrenchFixture('forward').completions ?? []), false, 'the forward learner has no journey, so the tab would draw the empty journey instead');
  });
});
