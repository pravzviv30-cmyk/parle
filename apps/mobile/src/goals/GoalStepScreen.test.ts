/**
 * The goal screen, read as source (Stage 4, 2026-09-25).
 *
 * No renderer here (docs/TESTING.md), so this holds the wiring: the account
 * guard on every read, three states that are never drawn as one another, one
 * primary pill that opens the mission with the goal step and says what it
 * costs, the authored preview, the trail from `goalEvidence`, and the quiet
 * self-report control. And the words: no digit but a date, and no claim of a
 * result.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const SCREEN = stripComments(read('./GoalStepScreen.tsx'));
const FLAT = SCREEN.replace(/\s+/g, ' ');

/** Quoted strings a learner could read: import paths and style keys excluded. */
function literals(body: string): string[] {
  return (body.match(/'[^']*'|"[^"]*"|`[^`]*`/g) ?? []).filter((line) => !line.includes('/') && !line.includes('${'));
}

describe('the goal screen — Stage 4', () => {
  test('every read is bound to the account before it starts, and a result for another account is dropped', () => {
    assert.match(FLAT, /const scope = scopeGeneration\(\); const userId = user\?\.id \?\? null; const sameAccount = \(\): boolean => !cancelled && scopeGeneration\(\) === scope;/);
    assert.match(FLAT, /Promise\.all\(\[loadGoalSteps\(\), loadConversationPacks\(\), loadPracticeHistory\(\)\]\)/, 'the screen reads its trail from somewhere else');
    assert.match(FLAT, /if \(!sameAccount\(\)\) return;/, 'a read for the previous account can be drawn');
    assert.match(FLAT, /if \(sameAccount\(\)\) \{ setReadScope\(\{ generation: scope, userId \}\); setStatus\('unread'\); \}/, 'a failed read is silent or leaves stale trail visible');
    assert.match(FLAT, /readScope\?\.generation === scopeGeneration\(\) && readScope\.userId === \(user\?\.id \?\? null\)/, 'the old account trail can render before the focus effect runs');
    assert.match(FLAT, /return \(\) => \{ cancelled = true; \};/, 'nothing cancels the reads when the screen goes');
  });

  test('loading, could-not-load and an empty trail are three different things on screen', () => {
    assert.match(FLAT, /useState<'loading' \| 'loaded' \| 'unread'>\('loading'\)/);
    assert.match(FLAT, /visibleStatus === 'loading' && /);
    assert.match(FLAT, /visibleStatus === 'unread' && /);
    assert.match(FLAT, /visibleStatus === 'loaded' && trail\.length === 0 && /, 'an empty trail is drawn before the read answered, or for a failed read');
    assert.match(FLAT, /\{GOAL_LOADING\}/);
    assert.match(FLAT, /\{GOAL_UNREAD\}/);
    assert.match(FLAT, /label=\{GOAL_RETRY\}/, 'a failed read has no way to try again');
    assert.match(FLAT, /\{GOAL_TRAIL_EMPTY\}/);
    assert.match(FLAT, /setAttempt\(\(n\) => n \+ 1\)/, 'Retry does not re-run the read');
  });

  test('the goal is one the learner has now, in their words, or the screen says it is gone and nothing else', () => {
    // Stage 4 review (2026-09-25): the route carries an opaque key, and the
    // goal is looked up again from the profile by it.
    assert.match(FLAT, /const routeKey = route\.params\?\.key \?\? '';/);
    assert.match(FLAT, /const current = profile\.learnerGoals\.find\(\(held\) => goalRouteKey\(held\) === routeKey\) \?\? null;/);
    assert.match(FLAT, /const goalKey = current === null \? '' : factKey\(current\);/);
    assert.ok(!FLAT.includes('route.params?.goal'), 'the goal\'s own words are read from the route again');
    assert.match(FLAT, /current === null && /, 'a goal the learner removed is still drawn');
    assert.match(FLAT, /\{GOAL_GONE\}/);
    assert.match(FLAT, /nav\.navigate\('TutorMemory'\)/, 'a gone goal has no way to where goals are written');
    assert.match(FLAT, /title=\{current \?\? GOAL_LABEL\}/, 'the goal is not drawn in the learner\'s own words');
  });

  test('one primary pill opens the suggested mission with the goal step, and says what it costs under it', () => {
    assert.equal((SCREEN.match(/<PillButton\b/g) ?? []).length, 1, 'the goal screen asks for more than one thing');
    assert.equal((SCREEN.match(/<ScreenHeader\b/g) ?? []).length, 1, 'the screen has no way back, or two');
    assert.match(FLAT, /const next = nextTaskForGoal\(current \?\? '', \{ missions: MISSIONS \}\);/);
    // Stage 4 review (2026-09-25): flat strings, and no goal words. An object
    // param reads "[object Object]" in the web address bar, and the goal key is
    // the goal's own words normalised.
    assert.match(FLAT, /nav\.navigate\('Convo', \{ missionId: mission\.id, goalRef: routeKey, goalTask: goalTaskOf\(next\.task\) \}\)/, 'the pill opens something other than the mission with its goal step');
    const types = stripComments(read('../nav/types.ts')).replace(/\s+/g, ' ');
    assert.match(types, /GoalStep: \{ key: string \};/, 'the goal screen\'s route carries something other than the opaque key');
    assert.match(types, /goalRef\?: string; goalTask\?: string;/, 'a conversation opened from a goal is not two flat strings');
    assert.ok(!/Convo: \{[^}]*goalStep\?:/.test(types), 'the conversation route takes the goal step as an object again');
    assert.ok(!SCREEN.includes('seedTopic'), 'a goal surface passes a seed topic, which is a Max-only door');
    const pill = SCREEN.indexOf('<PillButton');
    const cost = SCREEN.indexOf('{NEEDS_CONNECTION_AND_MINUTES}');
    assert.ok(cost > pill, 'the cost line is not under the pill');
    assert.match(FLAT, /import \{ NEEDS_CONNECTION_AND_MINUTES \} from '\.\.\/copy\/access\.ts'/);
    assert.match(FLAT, /\{nextLine\(mission, next\.fit\)\}/, 'the fit is worded on the screen instead of by next.ts');
  });

  test('the authored preview is mounted for the mission, with its context', () => {
    assert.match(FLAT, /<ListeningPreview selection=\{\{ kind: 'mission', mission \}\} showContext ground="blue" \/>/);
    assert.match(FLAT, /import \{ ListeningPreview \} from '\.\.\/missions\/ListeningPreview\.tsx'/);
  });

  test('the trail comes from goalEvidence against the goals the learner has now, and the report is the learner\'s own tap', () => {
    assert.match(FLAT, /const trail = goalEvidence\(goalKey, steps, packs, history, profile\.learnerGoals\);/);
    assert.match(FLAT, /\{rehearsedOn\(row\.at\)\}|line=\{rehearsedOn\(row\.at\)\}/, 'the rehearsal date is not the step\'s own');
    assert.match(FLAT, /row\.practice !== null \? GOAL_PRACTICE_LINE\[row\.practice\] : null/, 'the practice line is decided on the screen');
    assert.match(FLAT, /row\.usedOutside \?/, 'the report is shown whether or not it was made');
    assert.match(FLAT, /\{USED_OUTSIDE_SAID\}/);
    assert.match(FLAT, /label=\{USED_OUTSIDE_CONTROL\}/);
    assert.match(FLAT, /recordUsedOutside\(\{ stepId: row\.stepId, goalKey, at: Date\.now\(\) \}\)/, 'the report writes something other than this step\'s id and the goal key');
    assert.equal((SCREEN.match(/recordUsedOutside\(/g) ?? []).length, 1, 'the report is written from more than one place');
    // A second tap cannot queue a second write, and a refused write says so.
    assert.match(FLAT, /if \(reporting !== null\) return;/);
    assert.match(FLAT, /\{USED_OUTSIDE_REFUSED\}/);
    // Each trail row opens the conversation it names.
    assert.match(FLAT, /nav\.navigate\('Conversations', \{ packId: row\.pack\.id \}\)/);
  });

  test('no digit but a date, and no word that claims a result', () => {
    for (const line of literals(SCREEN)) {
      assert.doesNotMatch(line, /\d/, `the goal screen spells ${line}; the only digits here are a date`);
      assert.doesNotMatch(line, /achiev|master|\bready\b|score|percent|fluent/i, `the goal screen says ${line}`);
    }
    assert.ok(!SCREEN.includes('%'), 'a percentage reached the goal screen');
    assert.ok(!SCREEN.includes('—'), 'an em dash reached the goal screen');
    for (const capped of ['numberOfLines', 'maxFontSizeMultiplier', 'allowFontScaling', 'fontSize', 'useSafeAreaInsets', '<ScrollView']) {
      assert.ok(!SCREEN.includes(capped), `the goal screen writes ${capped}`);
    }
  });

  test('a cold link has a way out', () => {
    assert.match(FLAT, /const leave = \(\) => \(nav\.canGoBack\(\) \? nav\.goBack\(\) : nav\.navigate\('Tabs'\)\);/);
    assert.match(FLAT, /<ScrollScreen ground=\{colors\.background\} header=\{<ScreenHeader ink=\{colors\.text\} muted=\{colors\.muted\} back=\{\{ onPress: leave \}\} title=\{current \?\? GOAL_LABEL\} \/>\}>/);
  });
});

describe('the goal screen is a route with an address — Stage 4', () => {
  test('GoalStep is declared, registered and linked at goal-step', () => {
    const types = stripComments(read('../nav/types.ts')).replace(/\s+/g, ' ');
    // Stage 4 review (2026-09-25): an opaque key, never the goal's words.
    assert.match(types, /GoalStep: \{ key: string \};/);
    const nav = stripComments(read('../nav/RootNavigator.tsx'));
    assert.match(nav, /<Stack\.Screen name="GoalStep" component=\{GoalStepScreen\} \/>/);
    assert.match(stripComments(read('../nav/theme.ts')), /GoalStep: 'goal-step',/);
  });
});


test('goal trail follows the selected canvas while the suggested lesson keeps its blue editorial surface', () => {
  assert.match(FLAT, /<ScrollScreen ground=\{colors\.background\}/);
  assert.match(FLAT, /<Label color=\{colors\.muted\}>\{GOAL_TRAIL_LABEL\}/);
  assert.match(FLAT, /style=\{\[st\.said, \{ color: colors\.text \}\]\}/);
  assert.match(FLAT, /<ColourCard ground="blue"/);
  assert.match(FLAT, /<Label color=\{paper\.onInk\}>\{GOAL_NEXT_LABEL\}/);
  assert.match(FLAT, /<ListeningPreview[^>]*ground="blue"/);
});
