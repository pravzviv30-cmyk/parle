import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

const convo = readFileSync(path.join(import.meta.dirname, 'convo.ts'), 'utf8');
const tutor = readFileSync(path.join(import.meta.dirname, 'tutor.ts'), 'utf8');

describe('safety is a code boundary, not prompt advice', () => {
  test('free-conversation text and speech are guarded before scene or brain calls', () => {
    assert.match(convo, /msg\.t === 'say' && this\.handleSafety\(msg\.text\)/);
    assert.match(convo, /if \(this\.handleSafety\(text\)\) throw new voice\.StopResponse\(\)/);
    const brainTurn = convo.indexOf('private async runBrainTurn');
    const guard = convo.indexOf("input.type === 'spoke' && this.handleSafety", brainTurn);
    const prepare = convo.indexOf('prepareTurn(this.state, input)', brainTurn);
    assert.ok(brainTurn > 0 && guard > brainTurn && prepare > guard);
  });

  test('scripted typed and spoken answers are guarded before grading', () => {
    assert.match(tutor, /msg\.t === 'say' && this\.handleSafety\(msg\.text, session\)/);
    const spokenGuard = tutor.indexOf('this.handleSafety(transcript, this.session)');
    const grading = tutor.indexOf('scoreUtterance({', spokenGuard);
    assert.ok(spokenGuard > 0 && grading > spokenGuard);
  });

  test('stop decisions end the session so crisis handling is never metered as more roleplay', () => {
    assert.match(convo, /decision\.action === 'stop'\) void this\.finish\(\)/);
    assert.match(tutor, /decision\.action === 'stop'\) void this\.finish\(\)/);
  });
});

