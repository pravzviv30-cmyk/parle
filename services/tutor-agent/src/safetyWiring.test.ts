import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

const convo = readFileSync(path.join(import.meta.dirname, 'convo.ts'), 'utf8');
const tutor = readFileSync(path.join(import.meta.dirname, 'tutor.ts'), 'utf8');

describe('safety is a code boundary, not prompt advice', () => {
  test('free-conversation text and speech are guarded before scene or brain calls', () => {
    assert.match(convo, /msg\.t === 'say' && this\.handleSafety\(msg\.text\)/);
    // Safety now also closes the captured timing record before the same stop.
    assert.match(convo, /if \(this\.handleSafety\(text\)\) \{\s*timing\?\.finish\('cancelled'\);\s*throw new voice\.StopResponse\(\)/);
    const brainTurn = convo.indexOf('private async runBrainTurn');
    const guard = convo.indexOf("input.type === 'spoke' && this.handleSafety", brainTurn);
    const prepare = convo.indexOf('prepareTurn(this.state, input)', brainTurn);
    assert.ok(brainTurn > 0 && guard > brainTurn && prepare > guard);
  });

  test('scripted typed and spoken answers are guarded before grading', () => {
    assert.match(tutor, /\(msg\.t === 'say' \|\| msg\.t === 'choice'\) && this\.handleSafety\(msg\.text, session\)/);
    const spokenGuard = tutor.indexOf('this.handleSafety(transcript, this.session)');
    // Both the background score and the grade come after the guard: unsafe
    // speech is neither sent to the scoring vendor nor graded.
    const scoring = tutor.indexOf('this.scoreInBackground(', spokenGuard);
    const grading = tutor.indexOf("await this.enqueue(this.session, {", spokenGuard);
    assert.ok(spokenGuard > 0 && scoring > spokenGuard && grading > spokenGuard);
  });

  test('a spoken mission turn is guarded before its audio is scored', () => {
    const spokenGuard = convo.indexOf('if (this.handleSafety(text)) {');
    // Unsafe speech never reaches the scoring vendor.
    const scoring = convo.indexOf('this.scoring.score(', spokenGuard);
    assert.ok(spokenGuard > 0 && scoring > spokenGuard);
    assert.equal(convo.indexOf('this.scoring.score('), scoring, 'and nothing scores before the guard');
  });

  test('scoring never sits on the reply path', () => {
    for (const name of ['private speakEarly(', 'private async performBrainTurn(', 'private async runBrainTurn(']) {
      const start = convo.indexOf(name);
      const body = convo.slice(start, convo.indexOf('\n  }\n', start));
      assert.ok(start > 0 && body.length > name.length, name);
      assert.doesNotMatch(body, /scoring/, `${name} never touches the scorer`);
    }
  });

  test('stop decisions end the session so crisis handling is never metered as more roleplay', () => {
    // `closeAfterStop` finishes the session and then closes the room. The
    // behaviour both halves of that promise is held to lives in convo.test.ts,
    // which drives the real classes; this file only checks the wire is there.
    assert.match(convo, /decision\.action === 'stop'\) void this\.closeAfterStop\(/);
    assert.match(tutor, /decision\.action === 'stop'\) void this\.closeAfterStop\(/);
  });
});
