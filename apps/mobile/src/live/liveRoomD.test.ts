/**
 * The live room, direction D (UI-014): the rules its parts share, and the
 * seams in their source a renderer would otherwise check (docs/TESTING.md).
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { CELEBRATION_MAX_MS } from '../motion/tokens.ts';
import { CHEER_MS, freshGoals } from './liveRoomView.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const PARTS = ['./StageParts.tsx', './NotebookParts.tsx', './DockParts.tsx'];

describe('goals reached since the room first looked', () => {
  const goals = (done: string[]) => ['a', 'b', 'c'].map((id) => ({ id, achieved: done.includes(id) }));

  test('the first look takes what is already done and calls none of it news', () => {
    const first = freshGoals(null, goals(['a']));
    assert.deepEqual([...first.firstLook], ['a']);
    assert.deepEqual(first.fresh, []);
  });

  test('a goal reached later is fresh, and one done at first sight never is', () => {
    const { firstLook } = freshGoals(null, goals(['a']));
    assert.deepEqual(freshGoals(firstLook, goals(['a', 'b'])).fresh, ['b']);
    assert.deepEqual(freshGoals(firstLook, goals(['a', 'b', 'c'])).fresh, ['b', 'c']);
    assert.equal(freshGoals(firstLook, goals(['a'])).firstLook, firstLook, 'the first look is kept, not retaken');
  });

  test('a scene with no goals has nothing fresh', () => {
    assert.deepEqual(freshGoals(null, []).fresh, []);
  });

  test('the cloud cheers inside the celebration budget', () => {
    assert.ok(CHEER_MS > 0 && CHEER_MS <= CELEBRATION_MAX_MS);
  });
});

describe('the room parts, from source', () => {
  test('no part draws a literal colour', () => {
    for (const path of [...PARTS, './C2LiveRoom.tsx', '../motion/MascotMotion.tsx', '../tutor/OrbPortraitMotion.tsx']) {
      assert.doesNotMatch(stripComments(read(path)), /#[0-9a-f]{3,8}\b|rgba?\(/i, `${path} draws a colour outside palette.ts`);
    }
  });

  test('no control in the parts asks for a haptic: the room stays silent', () => {
    for (const path of PARTS) {
      const code = stripComments(read(path));
      for (const press of code.match(/<Press\b[^>]*>/g) ?? []) assert.match(press, /haptic="none"/, `${path}: ${press.slice(0, 80)}`);
    }
  });

  test('the state is still spoken, from a live region that is not drawn', () => {
    const room = stripComments(read('./C2LiveRoom.tsx'));
    assert.match(room, /<Text accessibilityLiveRegion="polite" style=\{st\.spoken\}>\{caption\}<\/Text>/);
    assert.match(room, /spoken: \{ position: 'absolute', left: 0, top: 0, width: 1, height: 1, overflow: 'hidden', color: t\.brand \}/);
    assert.doesNotMatch(room, /spoken: \{[^}]*opacity: 0/, 'opacity 0 hides it from VoiceOver too');
  });

  test('the goal stamps are one element that says the goals in words', () => {
    const stage = stripComments(read('./StageParts.tsx'));
    assert.match(stage, /<View style=\{s\.stamps\} accessible accessibilityRole="text" accessibilityLabel=\{view\.spoken\}>/);
    assert.match(stage, /tickAnnouncement\(labels\)/);
    assert.match(stage, /AccessibilityInfo\.announceForAccessibility\(line\)/);
  });

  test('narration is English and never marked French', () => {
    const notebook = stripComments(read('./NotebookParts.tsx'));
    const narration = notebook.slice(notebook.indexOf("if (item.kind === 'narration')"), notebook.indexOf("if (item.kind === 'tutor')"));
    assert.ok(narration.length > 0);
    assert.doesNotMatch(narration, /frenchText|lang=/);
  });

  test('the notebook keeps the transcript\'s replay label, partial wording and reply announcement', () => {
    const notebook = stripComments(read('./NotebookParts.tsx'));
    assert.match(notebook, /accessibilityLabel=\{`Hear that line again: \$\{item\.fr\}`\}/);
    assert.match(notebook, /You, still listening/);
    assert.match(notebook, /announceReply && Platform\.OS === 'ios'\) AccessibilityInfo\.announceForAccessibility\(replyAnnouncement\(latest\.tutor, tutorName\)\)/);
    assert.match(notebook, /accessibilityLabel="Your conversation so far"/);
    assert.match(notebook, /accessibilityLabel="Why this form\?" accessibilityState=\{\{ expanded \}\}/);
    assert.match(notebook, /<BubbleIn who=/);
  });

  test('the cloud mic keeps the room\'s names, its disabled dim, and a 44pt target', () => {
    const room = stripComments(read('./C2LiveRoom.tsx'));
    assert.match(room, /<CloudMic expression=\{face\} label=\{micOpen \? 'Listening' : 'Paused'\} accessibilityLabel=\{micOpen \? 'Pause microphone' : 'Open microphone'\}/);
    assert.match(room, /cheer=\{cheer\} disabled=\{modePending\} onPress=\{onMic\}/);
    const dock = stripComments(read('./DockParts.tsx'));
    assert.match(dock, /disabled: \{ opacity: 0\.55 \}/);
    assert.match(dock, /cloudHit: \{ minWidth: HIT, minHeight: Math\.max\(HIT, CLOUD_HEIGHT\)/);
  });

  test('Help, the room menu and the report sheet share one layer and close each other', () => {
    const room = stripComments(read('./C2LiveRoom.tsx'));
    assert.match(room, /useEffect\(\(\) => \{ if \(helpOpen\) setMenuOpen\(false\); \}, \[helpOpen\]\);/);
    assert.match(room, /\{menuOpen && !helpOpen && !reportOpen \? <View style=\{\[st\.sheetLayer/);
    assert.match(room, /setHelpOpen\(false\); setReportOpen\(false\); setMenuOpen\(value => !value\)/);
  });
});

describe('the room at large text', () => {
  test('a goal stamp grows with the digit and never shrinks under 26', async () => {
    const { stampSize } = await import('./liveRoomView.ts');
    assert.equal(stampSize(1), 26);
    assert.equal(stampSize(0.8), 26);
    assert.equal(stampSize(Number.NaN), 26);
    assert.ok(stampSize(2) >= 18 * 2 + 8, 'the digit at 2x does not fit its disc');
    assert.ok(stampSize(3.1) >= Math.ceil(18 * 3.1) + 8);
  });

  test('the portrait yields before it overlaps: full, then compact, then none', async () => {
    const { portraitFit } = await import('./liveRoomView.ts');
    assert.equal(portraitFit(400, 1, false), 'full');
    assert.equal(portraitFit(400, 1, true), 'compact', 'typing or a short screen asks for compact');
    assert.equal(portraitFit(140, 1, false), 'compact');
    assert.equal(portraitFit(60, 1, false), 'none');
    assert.equal(portraitFit(170, 1, false), 'full');
    assert.equal(portraitFit(170, 3, false), 'compact', 'a large name line takes the full portrait\'s room');
    assert.equal(portraitFit(0, 1, false), 'none', 'an unmeasured stage draws nothing over its neighbours');
  });

  test('the room measures its stage and clips nothing outside it', () => {
    const room = stripComments(read('./C2LiveRoom.tsx'));
    assert.match(room, /onLayout=\{\(event\) => setStageHeight\(event\.nativeEvent\.layout\.height\)\}/);
    assert.match(room, /portraitFit\(stageHeight, fontScale, compact\)/);
    assert.match(room, /stage: \{ flex: 1, minHeight: 0, overflow: 'hidden'/);
    const stage = stripComments(read('./StageParts.tsx'));
    assert.match(stage, /const disc = stampSize\(fontScale\);/);
  });
});
