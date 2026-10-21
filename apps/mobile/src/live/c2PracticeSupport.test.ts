import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import { liveRoomControlsVisible } from './c2TranscriptPolicy.ts';

const room = readFileSync(new URL('./C2LiveRoom.tsx', import.meta.url), 'utf8');
const begin = room.indexOf('  const [helpOpen, setHelpOpen] = useState(');
const end = room.indexOf('  const submit = async () => {', begin);
assert.ok(begin > 0 && end > begin, 'execute the room’s actual support state and lifecycle effects');
const setup = `${stripTypeScriptTypes(room.slice(begin, end))}\nreturn { helpOpen, controlsVisible, setHelpOpen };`;
const toggle = room.match(/onPress=\{(\(\) => setHelpOpen\(value => !value\))\}/)?.[1];
const focus = room.match(/onFocus=\{\(\) => \{([^}]+)\}\}/)?.[1];
assert.ok(toggle && focus, 'the actual support toggle and composer focus must remain wired');

function supportRoom(initialSupport?: object) {
  let choice: boolean | undefined, focused = false, keyboardOpen = false, effectIndex = 0;
  const effects: { dependencies: unknown[]; cleanup?: () => void }[] = [];
  const keyboard = new Map<string, () => void>();
  const setHelpOpen = (value: boolean | ((previous: boolean) => boolean)) => { choice = typeof value === 'function' ? value(choice!) : value; };
  const useState = (initial: boolean) => { if (choice === undefined) choice = initial; return [choice, setHelpOpen]; };
  const useEffect = (run: () => (() => void) | undefined, dependencies: unknown[]) => {
    const index = effectIndex++, old = effects[index];
    if (old && old.dependencies.length === dependencies.length && dependencies.every((value, at) => Object.is(value, old.dependencies[at]))) return;
    old?.cleanup?.(); effects[index] = { dependencies, cleanup: run() };
  };
  let support = initialSupport, supportKey = 'opening', typing = false;
  const mounted = { current: true };
  const input = { current: { blur() { focused = false; } } };
  const world = { useState, useEffect, liveRoomControlsVisible, mounted, input, active: true,
    Keyboard: { dismiss() { keyboardOpen = false; }, addListener(event: string, handler: () => void) { keyboard.set(event, handler); return { remove() { keyboard.delete(event); } }; } },
    Platform: { OS: 'ios' }, setKeyboardOpen: (value: boolean) => { keyboardOpen = value; },
    setFocused: (value: boolean) => { focused = value; }, setFocusRevision: () => {},
  };
  const render = (next: { support?: object; key?: string; typing?: boolean } = {}) => {
    if ('support' in next) support = next.support;
    if (next.key !== undefined) supportKey = next.key;
    if (next.typing !== undefined) typing = next.typing;
    effectIndex = 0;
    const bindings = { ...world, support, supportKey, typing, focused, keyboardOpen };
    return new Function(...Object.keys(bindings), setup)(...Object.values(bindings)) as { helpOpen: boolean; controlsVisible: boolean };
  };
  render();
  return { render, isOpen: () => choice,
    toggle: () => new Function('setHelpOpen', `return (${toggle});`)(setHelpOpen)(),
    focus: () => new Function(...Object.keys(world), 'setHelpOpen', focus!)(...Object.values(world), setHelpOpen),
    showKeyboard: () => keyboard.get('keyboardWillShow')?.(), hideKeyboard: () => keyboard.get('keyboardDidHide')?.(),
  };
}

test('practice support starts collapsed even when the first tutor reply contains support', () => {
  const h = supportRoom({}); assert.equal(h.isOpen(), false, 'support must wait for the learner’s explicit action');
});

test('new tutor replies and support changes never reopen a manually closed support panel', () => {
  const h = supportRoom(undefined);
  h.render({ support: { kind: 'hint' }, key: 'reply-1' });
  assert.equal(h.isOpen(), false, 'a reply must not expand the support panel');
  h.toggle(); assert.equal(h.isOpen(), true);
  h.render({ support: { kind: 'model' }, key: 'reply-2' }); assert.equal(h.isOpen(), true);
  h.toggle(); assert.equal(h.isOpen(), false);
  h.render({ support: { kind: 'hint' }, key: 'reply-3' }); assert.equal(h.isOpen(), false);
});

test('mode and keyboard changes hide support without changing the learner’s explicit choice', () => {
  const h = supportRoom(undefined); h.toggle(); assert.equal(h.isOpen(), true);
  h.render({ typing: true }); h.focus(); h.showKeyboard();
  assert.equal(h.render().controlsVisible, false, 'keyboard editing still hides support and the bottom controls');
  assert.equal(h.isOpen(), true, 'editing must not rewrite an explicit support choice');
  h.hideKeyboard(); assert.equal(h.render().controlsVisible, true); assert.equal(h.isOpen(), true);
  h.toggle(); h.render({ typing: false }); h.showKeyboard(); h.hideKeyboard(); h.render();
  assert.equal(h.isOpen(), false, 'a closed panel must stay closed after switching modes or closing the keyboard');
});

test('practice support retains its explicit toggle, accessible state and current session tools', () => {
  // 2026-10-21 UI-008, artboards B-Live and B-LiveHelp: support is the Help control and its sheet.
  assert.match(room, /accessibilityLabel=\{helpOpen \? 'Close help' : 'Get help'\} expanded=\{helpOpen\}/);
  assert.match(room, /helpOpen && controlsVisible && helpAvailable[\s\S]*?<ScrollView[^>]*>[\s\S]*?\{support\}[\s\S]*?\{tools\}\s*<\/ScrollView>/);
});
