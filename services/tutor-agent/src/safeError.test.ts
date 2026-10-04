import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import { test } from 'node:test';
import { BrainParseError } from '@luvani/brain';
import { safeError } from './safeError.ts';
import { parseSpeechace } from '../../shared/speechace.ts';
import { parseTonePerfect } from '../../shared/toneperfect.ts';

test('error logging preserves only allowlisted diagnostic fields, never raw learner text', () => {
  const marker = 'private-learner-and-provider-key-marker';
  const error = Object.assign(new BrainParseError(marker, marker), { status: 429, code: 'ECONNRESET', cause: new Error(marker) });
  const fields = safeError(error);
  assert.deepEqual(fields, { type: 'BrainParseError', status: 429, code: 'ECONNRESET' });
  assert.equal(inspect(fields).includes(marker), false);
  assert.deepEqual(safeError({ name: marker, status: marker, code: marker, raw: marker }), { type: 'Error' });
});

test('malicious error getters and nonobjects cannot break safe logging', () => {
  const error = Object.defineProperties({}, Object.fromEntries(['name', 'status', 'code'].map(field => [field, { get() { throw new Error('secret'); } }])));
  assert.deepEqual(safeError(error), { type: 'Error' });
  for (const value of [null, undefined, 'private', 42]) assert.deepEqual(safeError(value), { type: 'Error' });
});
test('unknown scoring symbols report only a count, never provider or learner content', t => {
  const marker='SYNTHETIC_PRIVATE_REFERENCE_MARKER';
  const lines:unknown[][]=[]; t.mock.method(console,'warn',(...args:unknown[])=>{lines.push(args);});
  parseSpeechace({text_score:{word_score_list:[{word:marker,phone_score_list:[{phone:marker,quality_score:50}]}]}});
  parseTonePerfect({status:'completed',assessable:true,words:[{word:marker,phones:[{expected:marker,score:50}]}]});
  assert.equal(lines.length,2);assert.equal(JSON.stringify(lines).includes(marker),false);
  for(const line of lines)assert.deepEqual(line[1],{count:1});
});
