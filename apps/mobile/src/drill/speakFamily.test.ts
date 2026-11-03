/**
 * The speak family on the one frame (drill B v2, UI-016; drill-b.md "Screens
 * and states" 5 and 8): one mic, Cloud only while listening, and the sound
 * drill and Sound Check on the peach stage. Source pins, as the drill's other
 * tests are: there are no testIDs.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/\s+/g, ' ');

describe('the speak family, drill B v2', () => {
  test('Cloud listens beside the mic only while it is live, decorative, squishing to the level', () => {
    const mic = read('./SpeakMic.tsx');
    assert.equal((mic.match(/<Cloud\b/g) ?? []).length, 1);
    assert.match(mic, /<View \{\.\.\.decorative\} pointerEvents="none" style=\{st\.slot\}> <ListeningCloud live=\{live\} voice=\{voice\} \/> <\/View>/, 'Cloud is not in the mic slot, or is reachable');
    const listening = mic.slice(mic.indexOf('export function ListeningCloud('));
    assert.match(listening, /^export function ListeningCloud\([^]*?if \(!live\) return null;/, 'Cloud shows while the mic is not live');
    assert.match(mic, /if \(!cloud\) return mic;/, 'Cloud shows on a surface that did not ask for it');
    assert.match(mic, /<LevelSquish level=\{voice\.metered \? voice\.level : null\} on=\{live\}/, 'Cloud squishes to something other than the heard level');
    assert.match(listening, /<Blink active=\{live\} lids=\{<CloudLids pose="listen" size=\{CLOUD\} \/>\}> <Cloud pose="listen" size=\{CLOUD\} ink=\{text\} \/> <\/Blink>/, 'Cloud listens without its pose, its blink, or the screen ink');
    assert.match(mic, /<LevelRing level=\{voice\.level\} size=\{size\} color=\{ring\} \/>/);
  });

  test('every speak drill uses the one mic with Cloud, and keeps its labels and its typed way out', () => {
    const say = read('./kinds/RepeatThisView.tsx');
    assert.match(say, /<SpeakMic live=\{mic === 'live'\} voice=\{voice\} size=\{SPEAK\} ring=\{colour\.mint\}> <SpeakCircle/);
    assert.match(say, /accessibilityLabel=\{mic === 'live' \? 'Stop recording' : 'Record yourself saying it'\}/);
    assert.match(say, /<PillButton label="Type instead"/);
    const own = read('./SpokenAttempt.tsx');
    assert.match(own, /<SpeakMic live=\{recording\} voice=\{voice\} size=\{SPEAK\} ring=\{colour\.mint\} cloud> <SpeakCircle/);
    assert.match(own, /label=\{RECORDING_TYPE\}/);
    // Sound Check has the one mic but no Cloud: it is not a sitting's moment.
    const check = read('../soundcheck/SoundCheckScreen.tsx');
    assert.match(check, /<SpeakMic live=\{shownPhase === 'recording'\} voice=\{voice\} size=\{SPEAK\} ring=\{t\.mint\}> <SpeakCircle/);
    assert.match(check, /accessibilityLabel=\{shownPhase === 'recording' \? 'Finish recording' : 'Start recording'\}/);
  });

  test('the sound drill stands on the peach frame, never records, and keeps both ways out', () => {
    const player = read('./FocusDrillPlayer.tsx');
    assert.match(player, /drillStage\('sound-drill', t\.mode\)/);
    assert.match(player, /leave=\{\{ onPress: onDone, label: 'Finish here', accessibilityLabel: 'Leave the sound drill', close: true \}\}/);
    assert.match(player, /<ProgressDots total=\{steps\.length\} index=\{index\}/);
    assert.match(player, /<PillButton label=\{last \? 'Done' : 'Next'\} onPress=\{next\} lip \/>/);
    assert.match(player, /\{!last && <GhostButton label="Finish here" onPress=\{onDone\} \/>\}/);
    assert.match(player, /Say it out loud if you can\. Nothing is listening\./);
    assert.match(player, /accessibilityLabel="Hear it again"/);
    assert.doesNotMatch(player, /useAudioRecorder|SpeakMic|SpeakCircle|useSafeAreaInsets/);
  });

  test('Sound Check stands on the peach frame, its result as the calm sheet with the one Done', () => {
    const check = read('../soundcheck/SoundCheckScreen.tsx');
    assert.match(check, /stage=\{drillStage\('sound-check', t\.mode\)\}/);
    assert.match(check, /eyebrow="Sound check"/);
    assert.match(check, /sheet=\{resultSheet\}/);
    assert.match(check, /<ResultSheet result=\{shownResult\} done=\{done\} \/>/);
    assert.equal((check.match(/<PillButton\b/g) ?? []).length, 1, 'Sound Check grew a second primary');
    assert.match(check, /label="I said it without assessment"/);
    assert.doesNotMatch(check, /<Cloud\b/);
  });

  test('say it aloud keeps its whole speak block in the pinned primary, the thumb zone', () => {
    const say = read('./kinds/RepeatThisView.tsx');
    assert.match(say, /primary=\{speak\}/, 'the speak block is not passed through primary');
    const block = say.match(/const speak = \([\s\S]*?\n?\);/)?.[0] ?? '';
    for (const part of [/<SpeakMic /, /<Pressable onPress=\{onNoMic\}/, /'Done' : 'Speak'/, /label="Type instead"/]) {
      assert.match(block, part, `the primary lost ${part}`);
    }
  });

  test("the quiet control's spoken name is its visible words", () => {
    // F951: Voice Control finds a control by the words on screen, so the
    // label and the visible text are one string. Resolve each side, whether a
    // literal or a module constant, and compare.
    const src = read('./kinds/RepeatThisView.tsx');
    const block = src.match(/<Pressable onPress=\{onNoMic\}[\s\S]*?<\/Pressable>/)?.[0];
    assert.ok(block, 'the quiet control is no longer the onNoMic Pressable');
    const resolve = (raw: string): string => {
      const lit = raw.match(/^["'](.*)["']$/);
      if (lit) return lit[1] ?? "";
      const name = raw.match(/^\{(\w+)\}$/)?.[1];
      assert.ok(name, `cannot read "${raw}"`);
      const def = src.match(new RegExp(`const ${name} = (["'])(.*?)\\1;`));
      assert.ok(def, `${name} is not a string constant in this file`);
      return def[2] ?? "";
    };
    const label = block.match(/accessibilityLabel=("[^"]*"|'[^']*'|\{\w+\})/)?.[1];
    const text = block.match(/<Text [^>]*>\s*(\{\w+\}|[^<{]+?)\s*<\/Text>/)?.[1];
    assert.ok(label && text, 'the quiet control lost its label or its visible words');
    const visible = text.startsWith('{') ? resolve(text) : text;
    assert.equal(resolve(label), visible, 'the quiet control is named something other than what it says');
    assert.equal(visible, 'Unable to speak right now?', 'the quiet control changed its wording');
  });
});

describe('say it aloud on a small phone', () => {
  test('the pinned foot fits under the screen\'s foot cap, with the quiet control in sight', async () => {
    const { sayFootHeight } = await import('./speakFoot.ts');
    const { screenGeometry } = await import('../responsiveLayout.ts');
    const none = { top: 0, bottom: 0, left: 0, right: 0 };
    for (const [w, h, insets] of [[320, 640, none], [375, 667, { ...none, top: 20 }], [375, 812, { top: 47, bottom: 34, left: 0, right: 0 }]] as const) {
      assert.ok(sayFootHeight(108, insets.bottom) <= screenGeometry(w, h, insets).footerMaxHeight, `${w}x${h}: the foot is over its cap`);
    }
  });

  test('Cloud listens in the answer area, not the foot, only while the mic is live', () => {
    const say = read('./kinds/RepeatThisView.tsx');
    const block = say.match(/const speak = \([\s\S]*?\);/)?.[0] ?? '';
    assert.doesNotMatch(block, /ListeningCloud|\bcloud\b/, 'the listening Cloud is in the foot');
    assert.match(say, /primary=\{speak\} > \{\} <View \{\.\.\.decorative\} pointerEvents="none" style=\{\{ alignItems: 'center' \}\}> <ListeningCloud live=\{mic === 'live'\} voice=\{voice\} \/> <\/View> <\/DrillFrame>/, 'the listening Cloud is not in the answer area, or not tied to the live mic');
  });
});
