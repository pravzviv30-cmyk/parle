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
    assert.match(mic, /<View \{\.\.\.decorative\} pointerEvents="none" style=\{st\.slot\}> <ListeningCloud live=\{live\} voice=\{voice\} size=\{SLOT_CLOUD\} \/> <\/View>/, 'Cloud is not in the mic slot, or is reachable');
    // The slot keeps the 77 it had before poses, so own words' and the fix line's mic never moves.
    assert.match(mic, /const SLOT = 77;/, 'the slot over the mic changed height, so the mic moved');
    assert.match(mic, /slot: \{ height: SLOT,/, 'the slot over the mic is not SLOT high');
    assert.match(mic, /const SLOT_CLOUD = Math\.floor\(\(SLOT \* CLOUD_POSES\.listen\.viewBox\.width\) \/ CLOUD_POSES\.listen\.viewBox\.height\);/, 'Cloud over the mic is not sized to fit its slot');
    const listening = mic.slice(mic.indexOf('export function ListeningCloud('));
    assert.match(listening, /^export function ListeningCloud\([^]*?if \(!live\) return null;/, 'Cloud shows while the mic is not live');
    assert.match(mic, /if \(!cloud\) return mic;/, 'Cloud shows on a surface that did not ask for it');
    assert.match(mic, /<LevelSquish level=\{voice\.metered \? voice\.level : null\} on=\{live\}/, 'Cloud squishes to something other than the heard level');
    assert.match(listening, /<Blink active=\{live\} lids=\{<CloudLids pose="listen" size=\{size\} \/>\}> <Cloud pose="listen" size=\{size\} ink=\{text\} accent=\{link\} \/> <\/Blink>/, 'Cloud listens without its pose, its blink, the screen ink or the link accent');
    assert.match(listening, /const \{ text, link \} = useB\(\);/, 'the listen arcs are not in the theme link colour');
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
      for (const mic of ['armed', 'silent'] as const) {
        assert.ok(sayFootHeight(mic, insets.bottom) <= screenGeometry(w, h, insets).footerMaxHeight, `${w}x${h}: the ${mic} foot is over its cap`);
      }
    }
  });

  test('the foot\'s measured numbers are the real constants', () => {
    // sayFootHeight copies these by hand; a drift here must fail, not overflow a small phone.
    assert.match(read('./speakFoot.ts'), /return top \+ 12 \+ 44 \+ 16 \+ bottomInset;/);
    const styles = read('./kinds/styles.ts');
    assert.match(styles, /export const SPEAK = 108;/, 'the mic is no longer 108');
    assert.match(styles, /speakBlock: \{ alignItems: 'center', gap: space\(2\) \}/, 'the mic and label gap is no longer 8');
    assert.match(styles, /noMic: \{ minHeight: HIT,/, 'the quiet control is no longer HIT high');
    assert.match(read('../theme.ts'), /export const HIT = 44;/, 'HIT is no longer 44');
    const theme = read('../theme.ts');
    const typeScale = theme.slice(theme.indexOf('export const type = {'), theme.indexOf('export ', theme.indexOf('export const type = {') + 1));
    assert.match(typeScale, /label: \{ fontFamily: font\.semiBold, fontSize: 16, lineHeight: 20 \}/, 'the label line is no longer 20');
    assert.match(read('./DrillFrame.tsx'), /const FOOT_BOTTOM = 16;/, 'the frame\'s foot padding is no longer 16');
    const say = read('./kinds/RepeatThisView.tsx');
    assert.match(say, /const speak = \( <View style=\{\{ alignItems: 'center', gap: space\(3\) \}\}>/, 'the gap above the quiet control is no longer 12');
    assert.match(say, /<Text style=\{\[type\.label, \{ color: bt\.text \}\]\}>\{mic === 'live' \? 'Done' : 'Speak'\}<\/Text>/, 'the mic label is no longer set in type.label');
    const components = read('../components.tsx');
    assert.match(components, /export const PILL_HEIGHT = 54;/, 'the pill is no longer 54');
    assert.match(components, /minHeight: PILL_HEIGHT,/, 'the pill is not PILL_HEIGHT high');
    assert.match(say, /<PillButton label="Type instead" onPress=\{onNoMic\} disabled=\{locked\} \/>/, 'Type instead grew a lip or a size');
  });

  test('the live level ring has room above the mic, so the foot does not clip it', async () => {
    const { RING_ROOM } = await import('./speakFoot.ts');
    const { LEVEL_RING } = await import('../motion/tokens.ts');
    assert.equal(RING_ROOM, Math.ceil((108 * LEVEL_RING.grow) / 2), 'the room is not the ring\'s overshoot at full level');
    const block = read('./kinds/RepeatThisView.tsx').match(/const speak = \([\s\S]*?\);/)?.[0] ?? '';
    assert.match(block, /\) : \( <View style=\{\[ds\.speakBlock, \{ paddingTop: RING_ROOM \}\]\}> <SpeakMic /, 'the mic has no room above it for its ring');
    assert.match(read('./speakFoot.ts'), /mic === 'silent' \? 54 \+ 44 : RING_ROOM \+ 108 \+ 8 \+ 20/, 'the foot height leaves out the ring room');
  });

  test('without a mic, the foot holds only the controls; the muted mic picture sits in the answer area', () => {
    const block = read('./kinds/RepeatThisView.tsx').match(/const speak = \([\s\S]*?\);/)?.[0] ?? '';
    assert.doesNotMatch(block, /<Illustration/, 'the muted mic picture is in the foot, over its cap on a small phone');
  });

  test('Cloud listens in the answer area, not the foot, only while the mic is live', () => {
    const say = read('./kinds/RepeatThisView.tsx');
    const block = say.match(/const speak = \([\s\S]*?\);/)?.[0] ?? '';
    assert.doesNotMatch(block, /ListeningCloud|\bcloud\b/, 'the listening Cloud is in the foot');
    assert.match(say, /primary=\{speak\} >[\s\S]*?<View \{\.\.\.decorative\} pointerEvents="none" style=\{\{ alignItems: 'center' \}\}> <ListeningCloud live=\{mic === 'live'\} voice=\{voice\} \/> <\/View> <\/DrillFrame>/, 'the listening Cloud is not in the answer area, or not tied to the live mic');
  });
});
