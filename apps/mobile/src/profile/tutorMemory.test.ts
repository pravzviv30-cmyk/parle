/**
 * The tutor card and the memory screen, read as text — F562's drawn half, F576's shape.
 *
 * `memory.test.ts` holds the rules; this holds that the two surfaces draw them
 * and decide nothing of their own: every write goes through a door in
 * `memory.ts`, every word is `tutorMemory.ts`'s, how much is held is said in
 * words and never as a count, and the screen is reachable from Profile through
 * a route with an address.
 *
 * ## What moved, and why the summary is not on the card any more
 *
 * Revamp A folded the standalone memory card into row two of Profile's "Your
 * tutor" card, beside the tutor's own name. A row has a title and one gloss,
 * and the gloss that earns its place there is the one that says what can be
 * DONE behind it, because that is the half a learner is deciding about. How
 * much the tutor holds is a sentence, and it is said on the screen itself,
 * under the title, where there is room for it and where it is not the second
 * line running to open with the tutor's name. So it is drawn exactly once, and
 * this file checks it is drawn exactly once: two sites for one sentence are two
 * sentences waiting to disagree.
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

/**
 * `first` is present, `second` is present, and `first` comes first.
 *
 * The two presence checks are the whole point: `indexOf` answers -1 for
 * something that was deleted, and -1 sorts before every real position, so the
 * obvious spelling of an ordering check passes most confidently in the one case
 * it exists to catch.
 */
function writtenBefore(source: string, first: string, second: string): boolean {
  const at = source.indexOf(first);
  const then = source.indexOf(second);
  return at !== -1 && then !== -1 && at < then;
}

describe('what the tutor remembers, drawn', () => {
  test('the tutor card is two rows, the screen says how much is held in words, and every write goes through a memory door', () => {
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

    // ───────────────────────────────────────── the card: two rows, one heading
    //
    // Row one is who the learner is talking to and opens the voice sheet Profile
    // owns; row two is what that person holds and pushes the editing screen.
    // The tutor's name is resolved once, from the persona, and both rows use it.
    assert.match(CARD, /const name = tutorNameOf\(profile\);/, 'the card names the tutor some other way');
    assert.equal((CARD.match(/<TutorRow\b/g) ?? []).length, 2, 'the tutor card is not the two rows the founder drew');
    assert.match(
      CARD,
      /<TutorRow first mark=\{<TutorMark \/>\} title=\{name\} gloss=\{PARTNER_LINE\} onPress=\{onVoice\} \/>/,
      'the first row is not the tutor, named by the persona, opening the sheet Profile hands it',
    );
    assert.match(CARD, /title=\{memoryLabel\(name\)\}/, 'the memory row spells the tutor name itself');
    assert.match(CARD, /gloss=\{MEMORY_ROW_SUB\}/, 'the memory row says what is behind it in JSX, where no copy sweep can read it back');
    assert.match(CARD, /nav\.navigate\('TutorMemory'\)/, 'the memory row leads nowhere');
    assert.ok(
      writtenBefore(CARD, 'gloss={PARTNER_LINE}', 'title={memoryLabel(name)}'),
      'the memory row is drawn above the tutor it belongs to',
    );
    assert.ok(!CARD.includes('useFocusEffect') && !CARD.includes('load'), 'the card reads the disk; the live profile is in context');
    assert.ok(!CARD.includes('.length'), 'the card counts something itself');
    // One sentence, one site. The summary is the screen's, and a copy of it on
    // the card would be a second thing to keep in step with `visibleFacts`.
    assert.ok(!CARD.includes('memorySummary'), 'how much is held is said on the card as well as on the screen, so there are two of it');

    // ─────────────────────────────────── the screen: the sentence, and the doors
    //
    // The title is the heading, and how much is held is said directly under it,
    // because that is the question somebody arriving here is asking.
    assert.match(
      SCREEN,
      /<Text accessibilityRole="header" style=\{\[type\.mainDisplay, \{ color: colors\.text \}\]\}>\{memoryLabel\(name\)\}<\/Text>/,
      'the screen spells its own title, or does not announce it as a heading',
    );
    assert.match(FLAT, /\{memorySummary\(profile, name\)\}/, 'the screen never says how much the tutor holds');
    assert.ok(
      writtenBefore(FLAT, 'memoryLabel(name)', 'memorySummary(profile, name)'),
      'the summary is drawn above the title it belongs under',
    );
    assert.equal(
      (SCREEN.match(/memorySummary\(/g) ?? []).length,
      1,
      'the summary is worked out more than once on the screen, so two lines can answer one question differently',
    );

    // Privacy writes use the acknowledged queue; correction strictness keeps
    // its ordinary update door. No success is claimed before durable storage.
    for (const door of ['withFactForgotten(current, fact.en)', 'withLearnerGoal(current, text)', 'withoutLearnerGoal(current, goal)', 'commitMemory(withMemoryCleared)']) {
      assert.ok(FLAT.includes(door), `the screen does not write through ${door}`);
    }
    assert.ok(FLAT.includes('update(withStrictness(profile, value))'));
    assert.match(FLAT, /const ok = await updateMemory\(edit\)/);
    assert.match(FLAT, /if \(!ok\) setMemoryError/);
    assert.ok(!SCREEN.includes('forgottenFacts') && !SCREEN.includes('memory.facts'), 'the screen reaches past memory.ts into the stored shape');
    assert.match(SCREEN, /const facts = visibleFacts\(profile\);/, 'the screen lists facts the learner forgot');
    assert.match(FLAT, /accessibilityLabel=\{`\$\{FORGET_ONE\}: \$\{fact\.en\}`\}/, 'a forget button does not say which fact it forgets');
    assert.match(FLAT, /\{facts\.length === 0 \? \( <View[^>]*> <MainIllustration motif="journal" theme=\{mode\} width=\{160\} active=\{focused\} \/> <Text[^>]*>\{memoryEmptyLine\(profile\)\}<\/Text> <IconAction ground=\{mode === 'dark' \? 'blue' : 'paper'\} layout="inline" icon="chat" label="Choose a scene" onPress=\{\(\) => nav.navigate\(\x27Missions\x27\)\} \/> <\/View> \)/, 'an empty memory draws an empty list rather than a sentence');
    assert.match(FLAT, /\{facts\.length > 0 && \( <View style=\{st\.all\}> <GhostButton color=\{colors\.text\} label=\{FORGET_ALL\}/, 'clear is offered with nothing to clear');
    assert.match(FLAT, /<ConfirmSheet visible=\{clearing\}/, 'clearing details requires an explicit confirmation');
    assert.match(SCREEN, /maxLength=\{MAX_GOAL_CHARS\}/, 'a goal can outgrow the wire');
    assert.match(SCREEN, /const room = profile\.learnerGoals\.length < MAX_LEARNER_GOALS;/, 'a fourth goal can be typed');
    assert.doesNotMatch(SCREEN, /<PillButton/, 'a pushed editing screen carries a primary pill');
    assert.match(SCREEN, /\{WHAT_LEAVES\}/, 'the screen does not say what leaves the phone');
    assert.match(SCREEN, /const name = tutorNameOf\(profile\);/, 'the screen names the tutor some other way than the persona');

    // ────────────────────────────────────────────────────────────── reachable
    //
    // A root route with an address, registered like every other, and reached
    // from row two of the one card on Profile that is about the tutor.
    const types = stripComments(read('../nav/types.ts'));
    assert.match(types, /TutorMemory: undefined;/, 'the route is not declared');
    assert.match(stripComments(read('../nav/theme.ts')), /TutorMemory: 'tutor-memory'/, 'the route has no web address');
    const navigator = stripComments(read('../nav/RootNavigator.tsx'));
    assert.match(navigator, /<Stack\.Screen name="TutorMemory" component=\{TutorMemoryRoute\} \/>/, 'the route is not registered');
    const profile = stripComments(read('../tabs/ProfileTab.tsx'));
    assert.match(
      profile,
      // P2 (2026-10-19): the tutor rows sit in Profile's Learning group, under
      // the Learning preferences row, rather than under a heading of their own.
      /<SettingsGroup title=\{LEARNING_GROUP\}>[\s\S]*?<TutorMemoryCard onVoice=\{\(\) => setSheet\('tutorVoice'\)\} \/>\s*<\/SettingsGroup>/,
      'the tutor rows are not in the Learning group, or they cannot open the voice sheet',
    );
    assert.equal(
      (profile.match(/<TutorMemoryCard\b/g) ?? []).length,
      1,
      'the tutor card is drawn more than once on Profile, so the tutor is introduced twice',
    );

    // ─────────────────────────────────────────────────────────── the checks bite
    assert.equal(writtenBefore('b a', 'a', 'b'), false, 'the ordering check passes on the order it exists to catch');
    assert.equal(writtenBefore('a b', 'a', 'b'), true, 'the shape the card ships does not pass its own check');
    assert.equal(writtenBefore('a', 'a', 'gone'), false, 'a deleted second needle passes the ordering check');
  });
});
