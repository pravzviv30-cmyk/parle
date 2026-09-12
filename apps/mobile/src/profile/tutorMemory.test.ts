/**
 * The memory card and screen, read as text — F562's drawn half.
 *
 * `memory.test.ts` holds the rules; this holds that the two surfaces draw
 * them and decide nothing of their own: every write goes through a door in
 * `memory.ts`, every word is `tutorMemory.ts`'s, the summary is words and
 * never a count, and the screen is reachable from Profile through a route
 * with an address.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createProfile, type LearnerProfile, type RememberedFact } from '@luvani/brain/profile';

import { guiltIn } from '../copy/guilt.ts';
import { createStoredProfile, type StoredProfile } from './store.ts';
import { withFactForgotten, withLearnerGoal } from './memory.ts';
import { TUTOR_MEMORY_COPY, memoryLabel, memorySummary } from './tutorMemory.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const CARD = stripComments(read('./TutorMemoryCard.tsx'));
const SCREEN = stripComments(read('./TutorMemoryScreen.tsx'));
const FLAT = SCREEN.replace(/\s+/g, ' ');

const NOW = Date.parse('2026-09-12T10:00:00Z');

function fact(en: string, kind: RememberedFact['kind'] = 'life-event'): RememberedFact {
  return { kind, fr: null, en, happensAround: null, notedAt: '2026-09-01T00:00:00.000Z' };
}

function learner(facts: readonly RememberedFact[]): StoredProfile {
  const brain: LearnerProfile = { ...createProfile(), memory: { facts: [...facts], opener: null, name: null } };
  return { ...createStoredProfile({ name: 'Camille', ageConfirmed: true, motivation: 'travel' }, NOW), brain };
}

describe('what the tutor remembers, drawn', () => {
  test('the memory card says how much is held in words, and the screen writes only through the memory doors', () => {
    // Words, never a count, and the tutor's own name rather than a literal.
    const none = learner([]);
    assert.equal(memorySummary(none, 'Camille'), 'Camille is still getting to know you.');
    assert.equal(memorySummary(learner([fact('Has a dog')]), 'Camille'), 'Camille remembers one thing about you.');
    assert.equal(memorySummary(learner([fact('a'), fact('b'), fact('c')]), 'Camille'), 'Camille remembers a few things about you.');
    const lots = learner(Array.from({ length: 6 }, (_, i) => fact(`fact ${i}`)));
    assert.equal(memorySummary(lots, 'Camille'), 'Camille remembers quite a lot about you.');
    assert.equal(memorySummary(withLearnerGoal(lots, 'Order bread'), 'Camille'), 'Camille remembers quite a lot about you. And the goal you wrote.');
    // A forgotten fact is not counted as held.
    assert.equal(memorySummary(withFactForgotten(learner([fact('Has a dog')]), 'Has a dog'), 'Camille'), 'Camille is still getting to know you.');
    assert.equal(memoryLabel('Camille'), 'Camille remembers');
    for (const line of [...TUTOR_MEMORY_COPY, memorySummary(lots, 'Camille'), memoryLabel('Camille')]) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries "${guiltIn(line)}"`);
      assert.doesNotMatch(line, /\d|—/, `"${line}" counts or dashes`);
    }

    // The card: the tutor's name from the persona, the summary from the
    // module, one row into the screen, and no read of its own.
    assert.match(CARD, /<Label>\{memoryLabel\(name\)\}<\/Label>/, 'the card spells its own heading');
    assert.match(CARD, /\{memorySummary\(profile, name\)\}/, 'the card works out its own summary');
    assert.match(CARD, /const name = tutorNameOf\(profile\);/, 'the card names the tutor some other way');
    assert.match(CARD, /nav\.navigate\('TutorMemory'\)/, 'the card leads nowhere');
    assert.ok(!CARD.includes('useFocusEffect') && !CARD.includes('load'), 'the card reads the disk; the live profile is in context');
    assert.ok(!CARD.includes('.length'), 'the card counts something itself');

    // The screen: every write is a memory.ts door through the context's update.
    for (const door of ['withFactForgotten(profile, fact.en)', 'withMemoryCleared(profile)', 'withLearnerGoal(profile, draft)', 'withoutLearnerGoal(profile, goal)', 'withStrictness(profile, value)']) {
      assert.ok(FLAT.includes(`update(${door})`), `the screen does not write through ${door}`);
    }
    assert.ok(!SCREEN.includes('forgottenFacts') && !SCREEN.includes('memory.facts'), 'the screen reaches past memory.ts into the stored shape');
    assert.match(SCREEN, /const facts = visibleFacts\(profile\);/, 'the screen lists facts the learner forgot');
    assert.match(FLAT, /accessibilityLabel=\{`\$\{FORGET_ONE\}: \$\{fact\.en\}`\}/, 'a forget button does not say which fact it forgets');
    assert.match(FLAT, /\{facts\.length === 0 \? \( <Text[^>]*>\{NOTHING_YET\}<\/Text> \)/, 'an empty memory draws an empty list rather than a sentence');
    assert.match(FLAT, /\{facts\.length > 0 && \( <View style=\{st\.all\}> <OutlineButton label=\{FORGET_ALL\}/, 'forget everything is offered with nothing to forget');
    assert.match(SCREEN, /maxLength=\{MAX_GOAL_CHARS\}/, 'a goal can outgrow the wire');
    assert.match(SCREEN, /const room = profile\.learnerGoals\.length < MAX_LEARNER_GOALS;/, 'a fourth goal can be typed');
    assert.match(SCREEN, /accessibilityRole="header"/, 'the title is not a heading to assistive tech');
    assert.doesNotMatch(SCREEN, /<PillButton/, 'a pushed editing screen carries a primary pill');
    assert.match(SCREEN, /\{WHAT_LEAVES\}/, 'the screen does not say what leaves the phone');
    assert.match(SCREEN, /const name = tutorNameOf\(profile\);/, 'the screen names the tutor some other way than the persona');

    // Reachable: a root route with an address, registered like every other.
    const types = stripComments(read('../nav/types.ts'));
    assert.match(types, /TutorMemory: undefined;/, 'the route is not declared');
    assert.match(stripComments(read('../nav/theme.ts')), /TutorMemory: 'tutor-memory'/, 'the route has no web address');
    const navigator = stripComments(read('../nav/RootNavigator.tsx'));
    assert.match(navigator, /<Stack\.Screen name="TutorMemory" component=\{TutorMemoryRoute\} \/>/, 'the route is not registered');
    const profile = stripComments(read('../tabs/ProfileTab.tsx'));
    assert.match(profile, /<FrenchLifeCard \/>\s*<TutorMemoryCard \/>\s*<PlanCard \/>/, 'the French life block does not run week, memory, plan');
  });
});
