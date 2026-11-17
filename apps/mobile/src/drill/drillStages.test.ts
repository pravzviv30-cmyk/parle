/**
 * F995, Q5 of the systemic pass: the drill stages fold their eyebrow. The
 * kind's tag joins the meta line under the prompt (tag first, a full stop,
 * then any existing line); Listen and type's tag is its header prompt; Say it
 * aloud lets the French lead; Sound check and the sound drill carry no kicker.
 * Source pins, as the drill's other tests are: there are no testIDs.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/\s+/g, ' ');

const STAGES = ['./DrillFrame.tsx', './kinds/write.tsx', './kinds/choose.tsx', './kinds/build.tsx', './kinds/OwnWordsView.tsx', './kinds/RepeatThisView.tsx', './FocusDrillPlayer.tsx', '../soundcheck/SoundCheckScreen.tsx', '../ReviewScreen.tsx'];

test('the drill stages draw no eyebrow', () => {
  for (const path of STAGES) {
    assert.doesNotMatch(read(path), /\beyebrow\b/, `${path} still draws or passes an eyebrow`);
  }
  assert.doesNotMatch(read('../soundcheck/SoundCheckScreen.tsx'), /"Sound check"/, 'Sound check still names itself on its stage');
  assert.doesNotMatch(read('./FocusDrillPlayer.tsx'), /Nothing to practise/, 'the empty sound drill still carries its kicker');
});

test("a drill's task joins its meta line", async () => {
  const { taskLine } = await import('./drillStage.ts');
  assert.equal(taskLine('Fill the blank', 'I would like a coffee.'), 'Fill the blank. I would like a coffee.');
  assert.equal(taskLine('Choose a reply'), 'Choose a reply');

  const write = read('./kinds/write.tsx');
  const listen = write.slice(write.indexOf('export function ListenTypeView'), write.indexOf('export function TranslationView'));
  assert.match(listen, /prompt=\{kindTag\(exercise\)\} promptIsHeader/, 'Listen and type has no prompt, so its tag is the header prompt');
  assert.match(write.slice(write.indexOf('export function TranslationView')), /english=\{taskLine\(kindTag\(exercise\)\)\}/);

  const choose = read('./kinds/choose.tsx');
  assert.equal((choose.match(/english=\{taskLine\(kindTag\(exercise\)\)\}/g) ?? []).length, 2, 'both choose kinds carry their tag on the meta line');

  const build = read('./kinds/build.tsx');
  assert.match(build, /english=\{taskLine\(kindTag\(exercise\), exercise\.en\)\}/, 'fill the blank: the tag, then the English');
  assert.match(build, /prompt=\{exercise\.en\} promptIsHeader english=\{taskLine\(kindTag\(exercise\), TAP_LINE\)\}/, 'build it: the tag, then the tap line');

  assert.match(read('./kinds/OwnWordsView.tsx'), /english=\{taskLine\(kindTag\(exercise\), OWN_WORDS_HINT\)\}/);

  const say = read('./kinds/RepeatThisView.tsx');
  assert.doesNotMatch(say, /kindTag/, 'Say it aloud still carries its tag; the French leads');
  assert.match(say, /prompt=\{exercise\.reference\} english=\{exercise\.referenceEn\}/);

  assert.match(read('./FocusDrillPlayer.tsx'), /english=\{drill\.title\}/, 'the sound drill names itself on the meta line');
  assert.match(read('../ReviewScreen.tsx'), /english=\{view\.tag\}/, 'the review card names its task on the meta line');
});
