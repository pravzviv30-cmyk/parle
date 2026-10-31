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
    assert.match(mic, /<View \{\.\.\.decorative\} pointerEvents="none" style=\{st\.slot\}> \{live && \( <LevelSquish/, 'Cloud shows when the mic is not listening, or is reachable');
    assert.match(mic, /if \(!cloud\) return mic;/, 'Cloud shows on a surface that did not ask for it');
    assert.match(mic, /<LevelSquish level=\{voice\.metered \? voice\.level : null\} on=\{live\}/, 'Cloud squishes to something other than the heard level');
    assert.match(mic, /<Cloud expression="listening"/);
    assert.match(mic, /<LevelRing level=\{voice\.level\} size=\{size\} color=\{ring\} \/>/);
  });

  test('every speak drill uses the one mic with Cloud, and keeps its labels and its typed way out', () => {
    const say = read('./kinds/RepeatThisView.tsx');
    assert.match(say, /<SpeakMic live=\{mic === 'live'\} voice=\{voice\} size=\{SPEAK\} ring=\{colour\.mint\} cloud> <SpeakCircle/);
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
});
