import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('the moment a replay drill replays (F556)', () => {
  test('a drill node may carry the moment it replays, and the screen draws it above the exercise', () => {
    // The route carries it as plain strings, so navigation state stays
    // serialisable. Matched on the flattened text and field by field rather
    // than as one line: the node grew a fifth field with the own-words sitting
    // (F581), and a pin on the whole line would read that as the moment going.
    const flat = (source: string): string => source.replace(/\s+/g, ' ');
    const routes = flat(read('../nav/types.ts'));
    assert.match(routes, /node\?: \{ id: string; title: string; phraseKeys: readonly string\[\];/, 'the drill route cannot carry a node');
    assert.match(routes, /moment\?: \{ quote: string; better: string; why: string \}/, 'the drill route cannot carry the moment');
    // The screen draws it above the exercise, and only when it is there.
    const screen = read('../DrillScreen.tsx');
    const nodeProp = flat(screen).slice(flat(screen).indexOf('node?: {'), flat(screen).indexOf('* Today’s mix'));
    assert.ok(nodeProp.length > 0, 'the drill screen no longer declares a node prop; this test is reading the wrong thing');
    assert.match(nodeProp, /id: string; title: string; phraseKeys: readonly string\[\];/, 'the drill screen does not accept a node');
    assert.match(nodeProp, /moment\?: DrillMoment;/, 'the drill screen does not accept the moment');
    const drawn = screen.indexOf("{node?.moment !== undefined && <MomentCard moment={node.moment} />}");
    const exercise = screen.indexOf("{exercise.kind === 'fill-blank' && (");
    assert.ok(drawn > 0, 'the drill screen never draws the moment');
    assert.ok(drawn < exercise, 'the moment is drawn somewhere other than above the exercise');
    // The card says what was said, a better way, and why, in the module's words.
    const card = read('./MomentCard.tsx');
    assert.match(card, /<Label>\{MADE_FROM\.replay\.said\}<\/Label>/, 'the card spells its own heading');
    assert.match(card, /\{moment\.quote\}/);
    assert.match(card, /\{moment\.better\}/);
    assert.match(card, /\{moment\.why\}/);
    // F582: the better line can be heard as well as read. Two French sentences
    // to compare by eye is the wrong exercise; the difference is audible first.
    assert.match(card, /tutorVoice\.speak\(moment\.better\)/, 'the better way cannot be heard');
    assert.match(card, /accessibilityLabel=\{`Hear \$\{moment\.better\}`\}/, 'the speaker does not say what it will play');
    assert.match(card, /<SpeakerGlyph\b/, 'the speaker is not drawn with the one speaker mark');
    // And the replay card opens the drill on the better line's key with the moment along.
    const tab = read('../tabs/PracticeTab.tsx').replace(/\s+/g, ' ');
    assert.match(tab, /id: `replay:\$\{made\.value!\.replay!\.packId\}`/, 'the replay opens a node the marks cannot name');
    assert.match(tab, /phraseKeys: \[made\.value!\.replay!\.key\]/, 'the replay opens on something other than the better line');
    assert.match(tab, /moment: \{ quote: made\.value!\.replay!\.quote, better: made\.value!\.replay!\.better, why: made\.value!\.replay!\.why \}/, 'the replay drill opens without the moment');
  });
});
