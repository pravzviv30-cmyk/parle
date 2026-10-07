/**
 * The focused sound journey screen, read as source (Stage 4, item 2).
 *
 * There is no renderer in this suite (docs/TESTING.md), so the ceiling is the
 * usual one: this proves the screen reads the store behind the account guard,
 * draws only what `journey.ts` decided, leads with a word rather than a symbol
 * and opens the sound check for the row's own situation. It cannot prove a
 * phone drew any of it. The judgements themselves are `journey.test.ts`'s.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

import { JOURNEY_COPY } from './journey.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const SCREEN = stripComments(read('./SoundJourneyScreen.tsx'));
const FLAT = SCREEN.replace(/\s+/g, ' ');

describe('the sound journey screen — Stage 4 item 2', () => {
  test('it reads the sound checks itself, on focus, and drops an answer from another account', () => {
    assert.match(FLAT, /useFocusEffect\(/, 'the journey is not re-read when the learner comes back from a check');
    assert.equal((SCREEN.match(/loadSoundChecks\(\{ strict: true \}\)/g) ?? []).length, 1, 'the visible journey must refuse corrupt or unavailable evidence');
    assert.match(FLAT, /const owner = \{ scope: scopeGeneration\(\), userId: activeUserId\(\) \};/, 'the read is not bound to the account it started under');
    assert.match(FLAT, /scopeGeneration\(\) === owner\.scope && activeUserId\(\) === owner\.userId/, 'a result from the previous account can be drawn for this one');
    assert.match(FLAT, /const ownerMatches = readOwner\?\.scope === scopeGeneration\(\) && readOwner\.userId === activeUserId\(\)/, 'an old result can appear before the next account focus effect runs');
    assert.match(FLAT, /const shownStatus = ownerMatches \? status : 'loading'/);
  });

  test('loading, could-not-load and nothing-to-show are three different screens', () => {
    assert.match(FLAT, /useState<'loading' \| 'ready' \| 'unread'>\('loading'\)/, 'the screen does not tell loading from a failed read');
    for (const words of ['JOURNEY_COPY.loading', 'JOURNEY_COPY.unread', 'JOURNEY_COPY.retry', 'JOURNEY_COPY.none']) {
      assert.ok(SCREEN.includes(words), `the screen never says ${words}`);
    }
    // A failed read offers the same read again, not an empty journey.
    assert.match(FLAT, /label=\{JOURNEY_COPY\.retry\}[^>]*onPress=\{\(\) => \{ if \(!ownerMatches\) return; setStatus\('loading'\); setAttempt\(\(n\) => n \+ 1\); \}\}/);
    assert.match(FLAT, /if \(sameAccount\(\)\) setStatus\('unread'\)/, 'a failed current-account read can retain stale measured claims');
  });

  test('the empty state offers a quiet way on, to the chooser — Stage 4 review (2026-09-25)', () => {
    // Back alone left a learner with no journey nowhere to go. The door is in
    // the same words the sound check's cold state uses, and it is a ghost link,
    // not a pill, because a record is not a task.
    assert.equal(JOURNEY_COPY.choose, 'Choose a situation');
    assert.match(stripComments(read('./SoundCheckScreen.tsx')), /<IconAction layout="inline" icon="map" label="Choose a situation"/, 'the sound check changed its words, and this door no longer matches them');
    assert.match(
      FLAT,
      /\{shownStatus === 'ready' && journey === null && \( <View style=\{st\.block\}> <Text style=\{st\.soft\}>\{JOURNEY_COPY\.none\}<\/Text> <IconAction layout="inline" icon="map" label=\{JOURNEY_COPY\.choose\} onPress=\{\(\) => nav\.navigate\('Missions'\)\} \/> <\/View> \)\}/,
      'a learner with no journey yet is offered only the way back',
    );
  });

  test('every judgement is journey.ts’s; the screen never reads an evidence kind', () => {
    assert.match(FLAT, /soundJourney\(checks, Date\.now\(\)\)/);
    for (const kind of ["'assessed-focus'", "'assessed-clear'", "'self-guided'", "'unavailable'", 'isMeasuredCheck']) {
      assert.ok(!SCREEN.includes(kind), `the screen decides for itself what ${kind} means`);
    }
  });

  test('a word leads, and the symbol waits behind a toggle', () => {
    assert.match(FLAT, /soundInWord\(journey\.example\)/, 'the heading is not the example word');
    assert.match(FLAT, /<MouthGuide ipa=\{journey.phoneme\}/);
    const notation = SCREEN.indexOf('{journey.phoneme}/</Text>');
    assert.notEqual(notation, -1, 'the symbol is not offered at all');
    const gate = SCREEN.lastIndexOf('detail &&', notation);
    assert.ok(gate !== -1 && notation - gate < 120, 'the IPA is drawn outside the detail toggle');
    assert.match(FLAT, /detail \? SOUND_DETAIL\.hide : SOUND_DETAIL\.show/);
    assert.match(FLAT, /accessibilityState=\{\{ expanded: detail \}\}/, 'the toggle does not say whether it is open');
  });

  test('each line offers its own check, and the clear line only where it is true', () => {
    assert.match(FLAT, /journey\.lines\.map\(\(line\) =>/);
    assert.match(FLAT, /nav\.navigate\('SoundCheck', \{ missionId: line\.missionId \}\)/, 'a row opens some other situation');
    assert.match(FLAT, /againLabel\(line, checks\)/, 'a row promises a line the check may not open on');
    assert.match(FLAT, /line\.clearAt !== null && /, 'the clear line is drawn without a clear check behind it');
    assert.match(FLAT, /JOURNEY_COPY\.lineClear/);
  });

  test('the only number on the screen is how many measured checks called the sound out', () => {
    assert.match(FLAT, /calledOutLine\(journey\.flaggedTimes,/);
    for (const count of ['journey.unmeasured}', 'journey.flaggedTimes}', '.length}', '.at}', 'clearAt}', 'lastFlaggedAt}']) {
      assert.ok(!SCREEN.includes(count), `the screen prints ${count} as a number`);
    }
    assert.match(FLAT, /journey\.unmeasured > 0 && /, 'unmeasured practice is either hidden or counted aloud');
    assert.doesNotMatch(SCREEN, /%|score|master|trend|improv/i, 'the screen claims more than was measured');
  });

  test('it is built on the frame, with one way back and no primary pill', () => {
    assert.match(SCREEN, /<ScrollScreen\b/);
    assert.equal((SCREEN.match(/<ScreenHeader\b/g) ?? []).length, 1, 'the screen has other than one way back');
    assert.equal((SCREEN.match(/<PillButton\b/g) ?? []).length, 0, 'a record is not a task, so it carries no pill');
    assert.match(FLAT, /nav\.canGoBack\(\) \? nav\.goBack\(\) : nav\.navigate\('Tabs'\)/, 'a cold link leaves a dead back');
    assert.match(SCREEN, /accessibilityRole="header"/, 'the screen has no heading for a screen reader');
    for (const capped of ['fontSize', 'numberOfLines', 'maxFontSizeMultiplier', 'allowFontScaling', 'paper.inkFaint', 'useSafeAreaInsets', '<ScrollView']) {
      assert.ok(!SCREEN.includes(capped), `the screen carries ${capped}`);
    }
    assert.doesNotMatch(SCREEN, /#[0-9a-fA-F]{3,8}\b/, 'the screen writes a raw colour');
    assert.doesNotMatch(SCREEN, /—/, 'an em dash reached learner copy');
  });
});

describe('the journey is a route of its own', () => {
  test('declared with no params, given an address, and registered', () => {
    assert.match(stripComments(read('../nav/types.ts')), /^ {2}SoundJourney: undefined;$/m);
    assert.match(stripComments(read('../nav/theme.ts')), /SoundJourney: 'sound-journey',/);
    const navigator = stripComments(read('../nav/RootNavigator.tsx'));
    assert.match(navigator, /<Stack\.Screen name="SoundJourney" component=\{SoundJourneyScreen\} \/>/);
    assert.match(navigator, /import \{ SoundJourneyScreen \} from '\.\.\/soundcheck\/SoundJourneyScreen\.tsx';/);
  });
});
