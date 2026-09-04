import assert from 'node:assert/strict';
import { test } from 'node:test';

import { firstNameOf, tutorGreeting, tutorGreetingSubline } from './dashboard.ts';

test('the dashboard greeting uses the learner’s chosen first name and the time of day', () => {
  assert.equal(firstNameOf('  Amina Rahman  '), 'Amina');
  assert.equal(tutorGreeting('Amina Rahman', 8), 'Good morning, Amina');
  assert.equal(tutorGreeting('Amina Rahman', 13), 'Good afternoon, Amina');
  assert.equal(tutorGreeting('Amina Rahman', 20), 'Good evening, Amina');
});

test('the dashboard remains welcoming when a learner skips their name', () => {
  assert.equal(firstNameOf('  '), null);
  assert.equal(tutorGreeting(null, 9), 'Good morning');
  assert.equal(tutorGreeting(undefined, 23), 'Good evening');
  assert.equal(tutorGreetingSubline('Céline'), 'Céline is here when you are ready. Speak naturally, zero judgement.');
});
