/**
 * LEARN-018: the assisted retry writes nothing.
 *
 * "Practise the one still settling" restarts DrillScreen on just the exercises
 * that did not come out first time. That sitting is help with the answer
 * already seen, so it may not grade, record evidence, count first tries, pay
 * XP, mark an activity day, settle, write history, save a practice resume or
 * send a take to be scored. The writes live inside a React screen a node test
 * cannot mount, so, as DrillScreen.test.ts does, this pins the one guard
 * (`recordsNothing`) at the head of every write path, and pins that no write
 * call sits outside a guarded path.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { retryEnd, retrySitting } from '../practice/stillSettling.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const strip = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const SCREEN = strip(read('../DrillScreen.tsx'));
const FLAT = SCREEN.replace(/\s+/g, ' ');

function region(from: string, to: string): string {
  const start = SCREEN.indexOf(from);
  assert.ok(start >= 0, `${from} moved; this test is stale`);
  const end = SCREEN.indexOf(to, start + from.length);
  assert.ok(end > start, `${to} moved; this test is stale`);
  return SCREEN.slice(start, end);
}

describe('the assisted retry writes nothing (LEARN-018)', () => {
  test('one guard, set before the retry sitting is dealt', () => {
    assert.match(SCREEN, /const retryRef = useRef\(false\);/);
    assert.match(SCREEN, /const recordsNothing = \(\): boolean => retryRef\.current;/, 'the retry guard is not the one flag');
    const start = region('const startRetry = useCallback(', 'const finishAndLeave = useCallback(');
    assert.ok(start.indexOf('retryRef.current = true;') >= 0, 'starting a retry does not shut the writes');
    assert.ok(start.indexOf('retryRef.current = true;') < start.indexOf('setSession('), 'the retry sitting is dealt before the writes are shut');
    assert.doesNotMatch(start, /retryRef\.current = false/, 'something reopens the writes');
    assert.equal((SCREEN.match(/retryRef\.current = /g) ?? []).length, 1, 'the retry flag is set somewhere else too');
  });

  test('no grade, evidence, first-try count, XP, activity day, settle or history: persistGrades is shut first', () => {
    const persist = region('const persistGrades = useCallback(', 'const answer = useCallback(');
    assert.match(persist, /^const persistGrades = useCallback\(\(state: DrillSessionState\) => \{\s*if \(recordsNothing\(\) \|\| persistedRef\.current\) return;/, 'grading runs before the retry guard');
    // Everything a sitting writes on its way out is behind that one line.
    for (const write of ['gradeCards(', 'recordActivity(', 'settleSitting(', 'finishPractice(state)', 'expect(', 'firstTry(state)', 'drillXp(']) {
      assert.ok(persist.indexOf(write) > persist.indexOf('recordsNothing()'), `${write} is reachable before the guard`);
    }
  });

  test('no practice save, and the completion owner is reached only through the guarded paths', () => {
    const save = region('const savePractice = useCallback(', 'const finishPractice = useCallback(');
    assert.match(save, /^const savePractice = useCallback\(\(state: DrillSessionState\) => \{\s*if \(recordsNothing\(\)\) return;/, 'a retry saves a practice resume');
    // Each store write appears once, inside its guarded owner.
    for (const [call, owner] of [
      ['gradeCards(', 'const persistGrades = useCallback('],
      ['recordActivity(', 'const persistGrades = useCallback('],
      ['settleSitting(', 'const persistGrades = useCallback('],
      ['savePracticeSession(', 'const savePractice = useCallback('],
      ['completePracticeSitting(', 'const finishPractice = useCallback('],
    ] as const) {
      const uses = [...SCREEN.matchAll(new RegExp(call.replace('(', '\\('), 'g'))].map((m) => m.index ?? -1);
      assert.equal(uses.length, 1, `${call} is called from more than one place`);
      const at = SCREEN.indexOf(owner);
      assert.ok(uses[0]! > at && uses[0]! < SCREEN.indexOf('}, [', at), `${call} sits outside ${owner}`);
    }
    // finishPractice runs only from persistGrades (guarded) and the Retry save,
    // which is drawn only on the practice end, never on the retry's end.
    const callers = [...SCREEN.matchAll(/finishPractice\(/g)].length;
    assert.equal(callers, 2, 'finishPractice is reached from a new path');
    const retryEndBranch = region('if (isRetry && session.finished) {', 'if (practice !== undefined && session.finished && !hasAnsweredWork(session))');
    assert.doesNotMatch(retryEndBranch, /retryPractice|PRACTICE_END\.retry/, 'a retry offers to save itself');
  });

  test('no score upload and no finished signal', () => {
    const spoke = region('const spoke = useCallback(', 'const checkOwnWords = useCallback(');
    assert.ok(spoke.indexOf('if (recordsNothing()) return discardRecording(uri);') >= 0, 'a retry take is sent to be scored');
    assert.ok(spoke.indexOf('if (recordsNothing()) return discardRecording(uri);') < spoke.indexOf('scoreRecordedAttempt('), 'the take is scored before the guard');
    assert.match(FLAT, /if \(!session\?\.finished \|\| !node \|\| finishedRef\.current\) return; if \(recordsNothing\(\)\) return; if \(!hasAnsweredWork\(session\)\) return; finishedRef\.current = true; onFinished\?\.\(node\.id\);/, 'a retry marks its node finished');
    assert.match(FLAT, /if \(!session\?\.finished \|\| held === null \|\| finishedRef\.current\) return; if \(recordsNothing\(\)\) return; if \(!hasAnsweredWork\(session\)\) return;/, 'a retry marks its pack practised');
  });

  test("the retry's end never calls firstTry, shows no XP, no confetti and Done only", () => {
    const branch = region('if (isRetry && session.finished) {', 'if (practice !== undefined && session.finished && !hasAnsweredWork(session))');
    assert.match(branch, /const shown = retryEnd\(\);/);
    assert.doesNotMatch(branch, /firstTry\(/, 'the retry end counts first tries');
    assert.doesNotMatch(branch, /delta=|xp|XP|release=/, 'the retry end draws a delta, XP or celebrates');
    assert.doesNotMatch(branch, /startRetry|retry=\{/, 'the retry end offers a second retry');
    assert.match(branch, /<EndActions done=\{\{ label: 'Done', onPress: finishAndLeave \}\} \/>/);
    assert.match(branch, /<EndScene count=\{shown\.firstTry\} title=\{DRILL_END\.title\} sub=\{DRILL_END\.deck\} \/>/);
    // It comes before every other finished branch, so a retry never reaches the practice or drill end.
    assert.ok(SCREEN.indexOf('if (isRetry && session.finished) {') < SCREEN.indexOf('if (practice !== undefined && session.finished) {'));
    assert.ok(SCREEN.indexOf('if (isRetry && session.finished) {') < SCREEN.indexOf('if (session.finished) {\n    const s = summariseDrill(session);'));
    // The scene throws confetti only when celebrating a delta.
    const scene = strip(read('../celebrate/EndScene.tsx'));
    assert.match(scene, /if \(delta === null\) return <Body view=\{null\}[^\n]*band=\{null\}/, 'a scene with no delta can throw confetti');
    assert.equal((scene.match(/<Confetti\b/g) ?? []).length, 1);
    assert.ok(scene.indexOf('<Confetti') > scene.indexOf('function Celebrated('), 'the confetti is drawn outside the celebrated scene');
    // And the rule itself: no first try, no XP, Done only, no second retry.
    assert.deepEqual(retryEnd(), { firstTry: null, xp: 0, actions: ['done'] });
    assert.equal(retrySitting([{ id: 'x', phraseKey: 'p', outcome: 'good', attempts: 2 }], [], { isRetry: true }), null);
  });

  test('both finished drill ends offer the retry only from a first sitting', () => {
    assert.equal((SCREEN.match(/retrySitting\(session\.answered, (?:askedRef\.current|held\.exercises), \{ isRetry \}\)/g) ?? []).length, 2);
    assert.match(SCREEN, /const again = card\.retry \? null : retrySitting\(session\.answered, held\.exercises, \{ isRetry \}\);/, 'a practice end that is not saved offers a retry before Retry save');
  });

  test('a retry keeps no phrase and sets no quiet-mic window (verifier round 1)', () => {
    const keep = region('const keepPhrase = useCallback(', 'keepInPhrasebook(');
    assert.match(keep, /if \(recordsNothing\(\) \|\| keeping \|\| kept\) return;/, 'a retry can keep a phrase');
    assert.equal((SCREEN.match(/keepInPhrasebook\(/g) ?? []).length, 1, 'a phrase is kept outside the guarded path');
    assert.match(FLAT, /outcome=\{isRetry \? \{ \.\.\.holding, keep: false \} : holding\}/, 'a retry offers Keep phrase on a held outcome');
    assert.match(FLAT, /outcome=\{isRetry && ownWords !== null \? \{ \.\.\.ownWords, keep: false \} : ownWords\}/, 'a retry offers Keep phrase');
    const silent = region('const goSilent = useCallback(', 'savePractice(quiet)');
    assert.match(silent, /if \(!recordsNothing\(\)\) void setMicSuppressed\(/, 'Type instead in a retry turns spoken drills off for the next sitting');
  });
});
