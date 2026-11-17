import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stt } from '@livekit/agents';
import { CAPTION_MAX_BYTES, LearnerCaptions, joinHeard, learnerCaptionsEnabled, splitHeard } from './learnerCaptions.ts';

const event = (type: stt.SpeechEventType, text: string) => ({ type, alternatives: [{ text, language: 'fr', startTime: 0, endTime: 0, confidence: 1 }] }) as unknown as stt.SpeechEvent;
const interim = (text: string) => event(stt.SpeechEventType.INTERIM_TRANSCRIPT, text);
const preflight = (text: string) => event(stt.SpeechEventType.PREFLIGHT_TRANSCRIPT, text);
const final = (text: string) => event(stt.SpeechEventType.FINAL_TRANSCRIPT, text);

/** A clock the test moves by hand. */
function clock() {
  let now = 0;
  const timers: { at: number; run: () => void }[] = [];
  return {
    now: () => now,
    setTimeout: (run: () => void, ms: number) => { const timer = { at: now + ms, run }; timers.push(timer); return timer; },
    clearTimeout: (timer: unknown) => { const i = timers.indexOf(timer as never); if (i >= 0) timers.splice(i, 1); },
    advance(ms: number) { now += ms; for (const timer of timers.filter((t) => t.at <= now)) { timers.splice(timers.indexOf(timer), 1); timer.run(); } },
  };
}

test('interim and final segments publish a growing caption, only when the text changes', () => {
  const c = clock(), shown: string[] = [];
  const captions = new LearnerCaptions((text) => shown.push(text), c);
  captions.observe(interim('Un'));
  c.advance(300); captions.observe(interim('Un'));
  c.advance(300); captions.observe(preflight('Un café'));
  c.advance(300); captions.observe(final('Un café,'));
  c.advance(300); captions.observe(interim('s’il'));
  c.advance(300); captions.observe(event(stt.SpeechEventType.END_OF_SPEECH, ''));
  c.advance(300); captions.observe(final('s’il vous plaît.'));
  assert.deepEqual(shown, ['Un', 'Un café', 'Un café,', 'Un café, s’il', 'Un café, s’il vous plaît.']);
  assert.equal(captions.take('Un café, s’il vous plaît.').frames, 5);
});

test('captions publish at most four frames a second and are capped in size', () => {
  const c = clock(), shown: string[] = [], at: number[] = [];
  const captions = new LearnerCaptions((text) => { shown.push(text); at.push(c.now()); }, c);
  const words = ['un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix'];
  for (let i = 0; i < words.length; i += 1) { captions.observe(interim(words.slice(0, i + 1).join(' '))); c.advance(50); }
  c.advance(1000);
  for (let i = 1; i < at.length; i += 1) assert.ok(at[i]! - at[i - 1]! >= 250, 'no two frames within 250 ms');
  assert.equal(shown.at(-1), words.join(' '), 'the latest text still lands, after the throttle');
  const long = new LearnerCaptions((text) => shown.push(text), c);
  c.advance(1000);
  long.observe(final('é'.repeat(400)));
  assert.ok(Buffer.byteLength(shown.at(-1)!) <= CAPTION_MAX_BYTES);
  for (let i = 0; i < 100; i += 1) long.observe(final(`mot${i}`));
  assert.ok(long.take('').segments <= 32, 'the segment buffer is bounded');
  assert.equal(long.take('').segments, 0, 'and cleared by every take');
});

test('split finals join without a mid-sentence capital, a dash or a stray ellipsis', () => {
  assert.equal(joinHeard(['On échange --', 'Nos numéros?']), 'On échange nos numéros?');
  assert.equal(joinHeard(['en échange,', 'Nos numéros']), 'en échange, nos numéros');
  assert.equal(joinHeard(['Je voudrais…', 'Un café']), 'Je voudrais un café');
  assert.equal(joinHeard(['Je voudrais...', 'Un café']), 'Je voudrais un café');
  assert.equal(joinHeard(['On échange -- Nos numéros?']), 'On échange nos numéros?');
});

test('a segment after a full stop keeps its capital', () => {
  assert.equal(joinHeard(['Bonjour.', 'Un café, merci.']), 'Bonjour. Un café, merci.');
  assert.equal(joinHeard(['Ah bon ?', 'Oui!', 'Super']), 'Ah bon ? Oui! Super');
});

test('when the captured segments do not match the committed text, the committed text is kept and only dashes go', () => {
  assert.deepEqual(splitHeard(['On échange --', 'Nos numéros?'], 'On échange -- Nos numéros? Merci'),
    { text: 'On échange nos numéros? Merci', overheard: null, dropped: 0 });
  assert.deepEqual(splitHeard(['On échange --', 'Nos numéros?'], 'On échange -- Nos numéros?'),
    { text: 'On échange nos numéros?', overheard: null, dropped: 0 });
});

test('finals before the committed text are split off as overheard', () => {
  assert.deepEqual(splitHeard(['Here we go.', 'Un café', 'S’il vous plaît'], 'Un café S’il vous plaît'),
    { text: 'Un café s’il vous plaît', overheard: 'Here we go.', dropped: 1 });
});

test('the captions switch is off unless LUVANI_LEARNER_CAPTIONS=1', () => {
  assert.equal(learnerCaptionsEnabled({}), false);
  assert.equal(learnerCaptionsEnabled({ LUVANI_LEARNER_CAPTIONS: '0' }), false);
  assert.equal(learnerCaptionsEnabled({ LUVANI_LEARNER_CAPTIONS: '1' }), true);
});

test('a capped caption never splits a character', () => {
  const shown: string[] = [];
  const captions = new LearnerCaptions((text) => shown.push(text), clock());
  // One astral character, then just enough to cross the cap: a code-unit trim
  // would leave its low surrogate at the front.
  captions.observe(interim(`😀${'a'.repeat(CAPTION_MAX_BYTES - 3)}`));
  assert.equal(shown.length, 1);
  assert.doesNotMatch(shown[0]!, /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u, 'no lone surrogate');
  assert.ok(Buffer.byteLength(shown[0]!) <= CAPTION_MAX_BYTES);
});
