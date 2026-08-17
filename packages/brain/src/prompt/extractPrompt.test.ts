import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildExtractionRequest, type ExtractionInput } from './extractPrompt.ts';
import type { MemoryFact } from '../contract/types.ts';

const tennis: MemoryFact = { kind: 'interest', fr: null, en: 'Plays tennis on weekends', happensAround: null };
const interview: MemoryFact = { kind: 'life-event', fr: 'Un entretien', en: 'Has a job interview', happensAround: 'Tuesday' };

function request(overrides: Partial<ExtractionInput> = {}): string {
  return buildExtractionRequest({
    history: [
      { role: 'user', text: 'Bonjour !' },
      { role: 'assistant', text: 'Salut, ça va ?' },
      { role: 'system', text: '[the learner stayed silent]' },
    ],
    knownFacts: [],
    ...overrides,
  });
}

describe('the extraction request draws the fiction line', () => {
  test('the fiction-vs-fact rule is present', () => {
    // The one hard problem of this call. If this sentence ever falls out of
    // the instruction, the learner gets greeted with a life they never had.
    assert.ok(request().includes('Nothing that happened inside the scene is a fact about them.'));
  });

  test('the drop-when-unsure rule is present', () => {
    assert.ok(request().includes('When you are not sure a thing is real, leave it out.'));
  });

  test('the opener rules are present', () => {
    const r = request();
    assert.ok(r.includes('openerFr and openerEn'));
    assert.ok(r.includes(`Never reference the scene's fiction.`));
  });
});

describe('known facts render for deduplication', () => {
  test('facts render one per line, with the loose when only when present', () => {
    const r = request({ knownFacts: [tennis, interview] });
    assert.ok(r.includes('Already on file:'));
    assert.ok(r.includes('- [interest] Plays tennis on weekends'));
    assert.ok(r.includes('- [life-event] Has a job interview (Tuesday)'));
    assert.ok(!r.includes('Plays tennis on weekends ('));
  });

  test('no facts, no block', () => {
    assert.ok(!request().includes('Already on file:'));
  });
});

describe('the transcript renders with honest speaker labels', () => {
  test('roles map to learner, tutor and app, in original order', () => {
    const r = request();
    const transcript = r.slice(r.indexOf('TRANSCRIPT'));
    const learner = transcript.indexOf('learner: Bonjour !');
    const tutor = transcript.indexOf('tutor: Salut, ça va ?');
    const app = transcript.indexOf('app: [the learner stayed silent]');
    assert.ok(learner > -1 && tutor > -1 && app > -1);
    assert.ok(learner < tutor && tutor < app);
  });
});
