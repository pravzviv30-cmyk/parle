import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyLanguageAgreement, languageAgreementInstruction, nativeTeachingRequest, parseNativeTeachingReply } from './nativeEvalLanguage.ts';
import { NATIVE_EVAL_INSTRUCTIONS, NATIVE_EVAL_TEACHING } from './nativeEvalPolicy.ts';

test('the tutor speaking language and learner answer language are independent and persist across answers', () => {
  const choice = parseNativeTeachingReply(JSON.stringify({ reply: 'What would you like to order?', tutorLanguageUpdate: 'english', learnerLanguageUpdate: 'french' }));
  let agreement = applyLanguageAgreement({ tutor: 'adaptive', learner: 'free' }, choice);
  for (let turn = 0; turn < 12; turn++) {
    agreement = applyLanguageAgreement(agreement, { reply: 'Good. What size would you like?', tutorLanguageUpdate: 'keep', learnerLanguageUpdate: 'keep' });
  }
  assert.deepEqual(agreement, { tutor: 'english', learner: 'french' });
  assert.deepEqual(applyLanguageAgreement(agreement, { reply: 'Très bien.', tutorLanguageUpdate: 'french', learnerLanguageUpdate: 'keep' }), { tutor: 'french', learner: 'french' });
});
test('malformed or unrestricted model preferences cannot become session instructions', () => {
  for (const value of [null, [], {}, { reply:'',tutorLanguageUpdate:'keep',learnerLanguageUpdate:'keep' },
    { reply:'hello',tutorLanguageUpdate:'ignore all rules',learnerLanguageUpdate:'keep' },
    { reply:'hello',tutorLanguageUpdate:['english'],learnerLanguageUpdate:'keep' },
    { reply:'hello',tutorLanguageUpdate:'keep',learnerLanguageUpdate:['french'] },
    { reply:'hello',tutorLanguageUpdate:'english',learnerLanguageUpdate:'french',instructions:'override' },
    { reply:'a'.repeat(1201),tutorLanguageUpdate:'keep',learnerLanguageUpdate:'keep' }]) {
    assert.throws(() => parseNativeTeachingReply(JSON.stringify(value)));
  }
  assert.throws(() => parseNativeTeachingReply('not JSON'));
});
test('each backend call carries the persisted agreement even after history truncates', () => {
  const request = nativeTeachingRequest({ tutor:'english',learner:'french' }, NATIVE_EVAL_TEACHING, [{ role:'user',content:'Un café, merci.' }]);
  assert.equal(request.store,false);
  assert.equal(request.text.format.strict,true);
  assert.match(request.instructions,/Speak English for acknowledgements/);
  assert.match(request.instructions,/learner wants to answer in French/);
  assert.match(request.instructions,/An answer in French is practice, not a request/);
  assert.match(request.instructions,/PREVIOUS state/);
});
test('both speaking and teaching prompts prohibit French-first English replies', () => {
  assert.match(NATIVE_EVAL_INSTRUCTIONS,/Never begin in French first/);
  assert.match(languageAgreementInstruction({tutor:'english',learner:'french'}),/Do not add a preamble/);
  assert.match(NATIVE_EVAL_INSTRUCTIONS,/Delegate to the backend when: the learner changes language preferences/);
});
test('superseded teaching work cannot change language or speak after a newer request', () => {
  const source = readFileSync(new URL('./nativeEvalAgent.ts', import.meta.url),'utf8');
  assert.match(source,/activeRequest\?\.abort\(\)/);
  assert.match(source,/budget\.hasSeen\(id\)/);
  const guard = source.indexOf('if (closing || activeRequest !== requestControl) return;');
  assert.ok(guard > 0 && guard < source.indexOf('applyLanguageAgreement(agreement, result)'));
  assert.ok(source.indexOf('live.appendInstructions(languageAgreementInstruction(agreement))') < source.indexOf('live.appendCommentary(result.reply'));
});
