import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import { momentShown } from './momentShown.ts';

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
    // 2026-10-20 UI-008, artboard B-Today: a node may ask for the moment only
    // after the first answer (`afterTry`), so Today's fix stays attempt first.
    // Drill B v2 (UI-016): the card is the frame's `lead`, which DrillFrame
    // draws first in the answer area, above the kind's controls.
    const drawn = screen.indexOf("node?.moment !== undefined && momentShown({ afterTry: node.afterTry, answering: feedback !== null, answered: session?.answered.length ?? 0 }) ? <MomentCard moment={node.moment} /> : undefined,");
    const frame = flat(read('./DrillFrame.tsx'));
    assert.match(frame, /<View style=\{s\.area\}> \{lead\} \{children\} <\/View>/, 'the frame draws the moment somewhere other than above the exercise');
    assert.match(nodeProp, /afterTry\?: boolean;/, 'the drill screen cannot hold the moment back until a try');
    assert.match(routes, /afterTry\?: boolean \}/, 'the drill route cannot ask for the moment after a try');
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
    // 2026-10-20, B3, B-Practice: the replay left Practice for Your fixes.
    // There a fix's first try opens the drill on the better line's key with
    // NO moment, because the moment card shows the better line above the
    // exercise; only "Say it once more", after the comparison is on screen,
    // carries the moment along.
    const fixes = read('../practice/fixesView.ts').replace(/\s+/g, ' ');
    const attempt = fixes.slice(fixes.indexOf('function attemptRoute('), fixes.indexOf('/** After a try'));
    const again = fixes.slice(fixes.indexOf('function againRoute('), fixes.indexOf('export function fixRows('));
    assert.match(attempt, /id: `fix:\$\{fix\.packId\}:\$\{fix\.key\}`/, 'a fix opens a node the marks cannot name');
    assert.match(attempt, /phraseKeys: \[fix\.key\]/, 'a fix opens on something other than the better line');
    assert.doesNotMatch(attempt, /moment/, 'a fix\'s first try shows the better line before the attempt');
    assert.match(again, /moment: \{ quote, better, why \}/, 'saying a tried fix once more drops the moment');
  });
});

// 2026-10-20 UI-008, artboard B-Today (learning-science review): attempt first.
test('an afterTry moment stays hidden before the first answer and shows after it', () => {
  assert.equal(momentShown({ afterTry: true, answering: false, answered: 0 }), false, 'the comparison is shown before the try');
  assert.equal(momentShown({ afterTry: true, answering: true, answered: 0 }), true);
  assert.equal(momentShown({ afterTry: true, answering: false, answered: 1 }), true);
  assert.equal(momentShown({ answering: false, answered: 0 }), true, 'a replay that asked for the moment up front lost it');
});
