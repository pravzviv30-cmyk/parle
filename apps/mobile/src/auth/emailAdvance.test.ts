import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EMAIL_ADVANCE_IDLE_MS, emailReadyToAdvance } from './emailAdvance.ts';

test('email focus waits for a complete domain and an idle interval', () => {
  for (const value of ['','you@','you@example','you@example.','you@example.c','you @example.com','you@example..com','you@@example.com','you@-example.com','you@example.com.']) assert.equal(emailReadyToAdvance(value), false, value);
  for (const value of ['you@example.com','you@example.co.uk','you@example.co','first.last+luvani@sub.example.museum',"o'brien@example.com",'josé@exemple.fr']) assert.equal(emailReadyToAdvance(value), true, value);
  assert.ok(EMAIL_ADVANCE_IDLE_MS >= 1000, 'a domain suffix must not interrupt active typing');
});
