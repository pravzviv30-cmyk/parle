/**
 * Leaving a screen never touches a sound that expo-audio has already let go.
 *
 * expo-audio's useAudioPlayer and useAudioRecorder make a native object and
 * release it from an effect cleanup of their own when the screen unmounts
 * (useReleasingSharedObjectWithLifecycle, in expo-modules-core). React runs a
 * component's effect cleanups in the order the effects were declared, so a
 * useEffect declared after the hook is cleaned up after the release. If that
 * cleanup then calls the player, iOS throws "Unable to find the native shared
 * object", React unmounts the whole app, and with no error boundary the
 * learner is left on a white screen. That was F792: pre-account onboarding
 * paused its player on the way out, so creating an account at the end of
 * onboarding emptied the screen. The web player takes the late call quietly,
 * which is why it only ever showed on a phone. F693 was the same release,
 * reached through a recorder.
 *
 * The release stops the sound itself, so a late cleanup has nothing to do
 * with the player. One that has to reach it anyway does so inside a try, as
 * releaseDailyPlayback and recorderUri do. Layout effects are cleaned up
 * before any passive effect, so they may touch it freely.
 *
 * The walk follows what a cleanup runs: its own body, the helpers it calls,
 * the app functions it hands the sound to, the members of the app's own hooks
 * that hold one, second names for the sound, and the callbacks the cleanup
 * hands out, such as a timer, which run later still. Effects are recognised by
 * what they resolve to, so a renamed import counts. Inside an async helper it
 * reads only up to the first await; an async function rejects rather than
 * throwing into its caller, so that only errs towards flagging. A late
 * rejection is a smaller fault of its own, F793, which recorderRelease.test.ts
 * covers by running the two screens it was found in. It does not follow a
 * sound kept in a ref, returned whole from an app hook, or handed to a child
 * or another hook; no screen does any of that today.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const APP_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** expo-audio's hooks that make a native object and release it on unmount. */
const RELEASING = new Set(['useAudioPlayer', 'useAudioRecorder', 'useAudioPlaylist', 'useAudioStream']);
/** Effects whose cleanups run after that release. Layout effects run before it. */
const LATE_EFFECTS = new Set(['useEffect', 'useFocusEffect']);

type Fn = ts.FunctionLikeDeclaration & { body: ts.ConciseBody };
/** What a name holds: the released object, an app hook's result, or one member of that result. */
type Holder =
  | { kind: 'object' }
  | { kind: 'hook'; unsafe: Map<string, string[]> }
  | { kind: 'member'; touches: string[] };
type Binding = { symbol: ts.Symbol; holder: Holder; start: number; label: string; alias?: boolean };
type Late = { owner: string; touch: string };

function appConfig(): ts.ParsedCommandLine {
  const configPath = ts.findConfigFile(APP_ROOT, ts.sys.fileExists, 'tsconfig.json');
  assert.ok(configPath, 'apps/mobile has no tsconfig.json for this test to read');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  return ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configPath));
}

const isFn = (node: ts.Node): node is Fn => ts.isFunctionLike(node) && 'body' in node && node.body !== undefined;
const inApp = (node: ts.Node) =>
  !node.getSourceFile().isDeclarationFile && !node.getSourceFile().fileName.includes('/node_modules/');
const where = (node: ts.Node) => {
  const file = node.getSourceFile();
  return `${relative(APP_ROOT, file.fileName)}:${file.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
};

function ownerName(fn: Fn): string {
  if (fn.name && ts.isIdentifier(fn.name)) return fn.name.text;
  return ts.isVariableDeclaration(fn.parent) && ts.isIdentifier(fn.parent.name) ? fn.parent.name.text : '(anonymous)';
}

function declarationOf(symbol: ts.Symbol | undefined, checker: ts.TypeChecker): ts.Declaration | undefined {
  if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  return symbol?.valueDeclaration ?? symbol?.declarations?.[0];
}

/** An expression without the parentheses, casts and non-null marks that leave its value alone. */
function bare(node: ts.Node): ts.Node {
  while (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isNonNullExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isTypeAssertionExpression(node)
  ) {
    node = node.expression;
  }
  return node;
}

/** The app function an expression stands for: itself, a name for one, or one made by useCallback or useMemo. */
function functionOf(node: ts.Node | undefined, checker: ts.TypeChecker): Fn | undefined {
  node = node && bare(node);
  if (!node || !inApp(node)) return undefined;
  if (isFn(node)) return node;
  if (ts.isCallExpression(node)) {
    const name = node.expression.getText().replace(/^React\./, '');
    if (name === 'useCallback') return functionOf(node.arguments[0], checker);
    const factory = name === 'useMemo' ? functionOf(node.arguments[0], checker) : undefined;
    return factory && !ts.isBlock(factory.body) ? functionOf(factory.body, checker) : undefined;
  }
  if (!ts.isIdentifier(node) && !ts.isPropertyAccessExpression(node)) return undefined;
  return declaredFunction(declarationOf(checker.getSymbolAtLocation(node), checker), checker);
}

/** The app function a declaration names: a function, or a variable or property that holds one. */
function declaredFunction(declaration: ts.Declaration | undefined, checker: ts.TypeChecker): Fn | undefined {
  if (!declaration || !inApp(declaration)) return undefined;
  if (isFn(declaration)) return declaration;
  if (ts.isVariableDeclaration(declaration) || ts.isPropertyAssignment(declaration)) {
    return functionOf(declaration.initializer, checker);
  }
  if (ts.isShorthandPropertyAssignment(declaration)) {
    return declaredFunction(declarationOf(checker.getShorthandAssignmentValueSymbol(declaration), checker), checker);
  }
  return undefined;
}

/** Calls `visit` on each node a function runs before its first await, skipping functions it only defines. */
function eachSyncNode(fn: Fn, visit: (node: ts.Node) => void): void {
  let firstAwait = Infinity;
  if (fn.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)) {
    const find = (node: ts.Node): void => {
      if (node !== fn.body && isFn(node)) return;
      if (ts.isAwaitExpression(node) || (ts.isForOfStatement(node) && node.awaitModifier)) {
        firstAwait = Math.min(firstAwait, node.end);
      }
      ts.forEachChild(node, find);
    };
    find(fn.body);
  }
  const go = (node: ts.Node): void => {
    if ((node !== fn.body && isFn(node)) || node.getStart() >= firstAwait) return;
    visit(node);
    ts.forEachChild(node, go);
  };
  go(fn.body);
}

/** Whether a throw at this node lands in a catch inside the same function. */
function caught(node: ts.Node, fn: Fn): boolean {
  for (let at = node; at !== fn && at.parent; at = at.parent) {
    if (ts.isTryStatement(at.parent) && at.parent.tryBlock === at && at.parent.catchClause) return true;
  }
  return false;
}

/** What an effect hands back as its cleanup. */
function cleanupsOf(effect: ts.CallExpression, checker: ts.TypeChecker): ts.Expression[] {
  const callback = functionOf(effect.arguments[0], checker);
  if (!callback) return [];
  if (!ts.isBlock(callback.body)) return [callback.body];
  const cleanups: ts.Expression[] = [];
  const visit = (node: ts.Node): void => {
    if (isFn(node)) return;
    if (ts.isReturnStatement(node) && node.expression) cleanups.push(node.expression);
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(callback.body, visit);
  return cleanups;
}

class ReleaseWalk {
  private readonly hooks = new Map<Fn, Holder | null>();
  private readonly checker: ts.TypeChecker;
  constructor(checker: ts.TypeChecker) {
    this.checker = checker;
  }

  /** The sound objects a function's own hooks make, in the order the hooks run. */
  bindings(fn: Fn): Binding[] {
    const found: Binding[] = [];
    const visit = (node: ts.Node): void => {
      if (node !== fn.body && isFn(node)) return;
      const value = ts.isVariableDeclaration(node) && node.initializer ? bare(node.initializer) : undefined;
      if (ts.isVariableDeclaration(node) && value && ts.isCallExpression(value)) {
        const call = value;
        const label = (name: string) => `${name} from ${call.expression.getText()} at ${where(call)}`;
        const made = this.isExpoRelease(call)
          ? ({ kind: 'object' } as const)
          : this.hookHolder(functionOf(call.expression, this.checker));
        if (made) found.push(...this.named(node.name, made, call.getStart(), label));
      } else if (ts.isVariableDeclaration(node) && value && ts.isIdentifier(value)) {
        // A second name for a sound, or a hook's result taken apart after the hook.
        const symbol = this.checker.getSymbolAtLocation(value);
        const original = found.find((binding) => binding.symbol === symbol);
        const label = (name: string) => `${name}, another name for ${original?.label}`;
        if (original) found.push(...this.named(node.name, original.holder, original.start, label).map((binding) => ({ ...binding, alias: true })));
      }
      ts.forEachChild(node, visit);
    };
    visit(fn.body);
    return found;
  }

  /** The bindings a declared name makes for something a hook holds: the whole of it, or the members taken out of it. */
  private named(name: ts.BindingName, holder: Holder, start: number, label: (name: string) => string): Binding[] {
    if (ts.isIdentifier(name)) return [{ symbol: this.symbol(name), holder, start, label: label(name.text) }];
    if (holder.kind !== 'hook' || !ts.isObjectBindingPattern(name)) return [];
    return name.elements.flatMap((element) => {
      if (!ts.isIdentifier(element.name)) return [];
      const touches = holder.unsafe.get((element.propertyName ?? element.name).getText()) ?? [];
      return [{ symbol: this.symbol(element.name), holder: { kind: 'member' as const, touches }, start, label: label(element.name.text) }];
    });
  }

  /** Whether a call is an effect whose cleanup runs after expo's release, by what it resolves to rather than its spelling. */
  private isLateEffect(call: ts.CallExpression): boolean {
    let symbol = this.checker.getSymbolAtLocation(call.expression);
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = this.checker.getAliasedSymbol(symbol);
    const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
    if (!symbol || !declaration) return LATE_EFFECTS.has(call.expression.getText().replace(/^React\./, ''));
    return LATE_EFFECTS.has(symbol.name) && !inApp(declaration);
  }

  /** Every cleanup in this function that runs after one of its sounds is released and still touches it. */
  late(fn: Fn): Late[] {
    const owned = this.bindings(fn);
    if (!owned.length) return [];
    const found: Late[] = [];
    const visit = (node: ts.Node): void => {
      if (node !== fn.body && isFn(node)) return;
      if (ts.isCallExpression(node) && this.isLateEffect(node)) {
        const released = owned.filter((binding) => binding.start < node.getStart());
        const held = new Map(released.map((binding) => [binding.symbol, binding.holder]));
        for (const cleanup of released.length ? cleanupsOf(node, this.checker) : []) {
          for (const touch of this.cleanupTouches(cleanup, held)) {
            const after = released.map((binding) => binding.label).join(' and ');
            found.push({ owner: ownerName(fn), touch: `${touch}  (cleanup of the effect at ${where(node)}, which runs after ${after} is released)` });
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(fn.body);
    return found;
  }

  /** Where a function, run now, touches a held object outside a catch. */
  touches(fn: Fn, held: Map<ts.Symbol, Holder>, seen = new Set<string>()): string[] {
    const key = `${fn.getSourceFile().fileName}:${fn.pos}:${[...held.keys()].map((symbol) => symbol.name).join(',')}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const found: string[] = [];
    eachSyncNode(fn, (node) => {
      if (caught(node, fn)) return;
      if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
        const holder = this.holderOf(node.expression, held);
        const called = ts.isCallExpression(node.parent) && node.parent.expression === node;
        if (holder?.kind === 'object') found.push(`${where(node)} ${node.getText()}${called ? '()' : ''}`);
        const inner = called ? this.memberTouches(node, held) : [];
        if (inner.length) found.push(`${where(node)} ${node.getText()}() -> ${inner.join(' -> ')}`);
      }
      if (!ts.isCallExpression(node)) return;
      const member = this.holderOf(node.expression, held);
      if (member?.kind === 'member' && member.touches.length) {
        found.push(`${where(node)} ${node.expression.getText()}() -> ${member.touches.join(' -> ')}`);
      }
      const passed = node.arguments.map((argument) => this.holderOf(argument, held));
      const target = functionOf(node.expression, this.checker);
      if (target) {
        const inner = new Map(held);
        target.parameters.forEach((parameter, index) => {
          const holder = passed[index];
          if (holder && ts.isIdentifier(parameter.name)) inner.set(this.symbol(parameter.name), holder);
        });
        const deeper = this.touches(target, inner, seen);
        if (deeper.length) found.push(`${where(node)} ${node.expression.getText()}() -> ${deeper.join(' -> ')}`);
      } else if (passed.some((holder) => holder?.kind === 'object')) {
        found.push(`${where(node)} ${node.getText()}, code this walk cannot read`);
      }
      // A callback written out here, for a timer, a listener or a promise, runs
      // later still, so only a catch inside it can stop its throw.
      for (const argument of node.arguments) {
        const callback = bare(argument);
        const later = isFn(callback) ? this.touches(callback, held, seen) : [];
        if (later.length) found.push(`${where(node)} a callback handed to ${node.expression.getText()}() -> ${later.join(' -> ')}`);
      }
    });
    return found;
  }

  /** Where a cleanup an effect hands back, function or hook member, touches a held object. */
  private cleanupTouches(returned: ts.Node, held: Map<ts.Symbol, Holder>): string[] {
    const cleanup = bare(returned);
    if (ts.isConditionalExpression(cleanup)) {
      return [...this.cleanupTouches(cleanup.whenTrue, held), ...this.cleanupTouches(cleanup.whenFalse, held)];
    }
    if (ts.isBinaryExpression(cleanup) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(cleanup.operatorToken.kind)) {
      return [...this.cleanupTouches(cleanup.left, held), ...this.cleanupTouches(cleanup.right, held)];
    }
    const fn = functionOf(cleanup, this.checker);
    const direct = fn ? this.touches(fn, held) : [];
    const holder = this.holderOf(cleanup, held);
    const member = holder?.kind === 'member' ? holder.touches : this.memberTouches(cleanup, held);
    return member.length ? [...direct, `${where(cleanup)} ${cleanup.getText()} -> ${member.join(' -> ')}`] : direct;
  }

  /** What `hook.member` reaches when the name holds an app hook's result. */
  private memberTouches(node: ts.Node, held: Map<ts.Symbol, Holder>): string[] {
    if (!ts.isPropertyAccessExpression(node)) return [];
    const holder = this.holderOf(node.expression, held);
    return holder?.kind === 'hook' ? (holder.unsafe.get(node.name.text) ?? []) : [];
  }

  private holderOf(node: ts.Node, held: Map<ts.Symbol, Holder>): Holder | undefined {
    const value = bare(node);
    const symbol = ts.isIdentifier(value) ? this.checker.getSymbolAtLocation(value) : undefined;
    return symbol && held.get(symbol);
  }

  /** What an app hook's result holds, if the hook makes a releasing sound object itself or through another. */
  private hookHolder(hook: Fn | undefined): Holder | undefined {
    if (!hook || !/^use[A-Z]/.test(ownerName(hook))) return undefined;
    if (this.hooks.has(hook)) return this.hooks.get(hook) ?? undefined;
    this.hooks.set(hook, null);
    const owned = this.bindings(hook);
    if (!owned.length) return undefined;
    const held = new Map(owned.map((binding) => [binding.symbol, binding.holder]));
    let holder: Holder = { kind: 'hook', unsafe: new Map() };
    const returned: ts.Node[] = ts.isBlock(hook.body) ? [] : [hook.body];
    const visit = (node: ts.Node): void => {
      if (isFn(node)) return;
      if (ts.isReturnStatement(node) && node.expression) returned.push(node.expression);
      ts.forEachChild(node, visit);
    };
    if (ts.isBlock(hook.body)) ts.forEachChild(hook.body, visit);
    for (const value of returned) {
      if (this.holderOf(value, held)?.kind === 'object') holder = { kind: 'object' };
      if (holder.kind !== 'hook' || !ts.isObjectLiteralExpression(value)) continue;
      for (const property of value.properties) {
        const member = ts.isShorthandPropertyAssignment(property)
          ? functionOf(property.name, this.checker)
          : ts.isPropertyAssignment(property)
            ? functionOf(property.initializer, this.checker)
            : isFn(property)
              ? property
              : undefined;
        const touches = member ? this.touches(member, held) : [];
        if (touches.length && property.name) holder.unsafe.set(property.name.getText(), touches);
      }
    }
    this.hooks.set(hook, holder);
    return holder;
  }

  private isExpoRelease(call: ts.CallExpression): boolean {
    if (!ts.isIdentifier(call.expression) || !RELEASING.has(call.expression.text)) return false;
    const declaration = declarationOf(this.checker.getSymbolAtLocation(call.expression), this.checker);
    return declaration?.getSourceFile().fileName.includes('/expo-audio/') ?? false;
  }

  private symbol(name: ts.Identifier): ts.Symbol {
    const symbol = this.checker.getSymbolAtLocation(name);
    assert.ok(symbol, `the compiler has no symbol for ${name.text} at ${where(name)}`);
    return symbol;
  }
}

/** Every sound a hook makes in these files, and every late cleanup that touches one. */
function walkFiles(program: ts.Program, files: readonly ts.SourceFile[]): { made: string[]; late: Late[] } {
  const walk = new ReleaseWalk(program.getTypeChecker());
  const made: string[] = [];
  const late: Late[] = [];
  for (const file of files) {
    const visit = (node: ts.Node): void => {
      if (isFn(node)) {
        made.push(...walk.bindings(node).filter((binding) => binding.holder.kind === 'object' && !binding.alias).map((binding) => binding.label));
        late.push(...walk.late(node));
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  return { made, late };
}

test('no screen touches a sound player or recorder in a cleanup that runs after expo-audio has released it', () => {
  const { fileNames, options } = appConfig();
  const program = ts.createProgram(fileNames, options);
  const files = program.getSourceFiles().filter((file) => {
    const path = relative(APP_ROOT, file.fileName);
    return !path.startsWith('..') && !path.includes('node_modules') && !/\.test\.tsx?$/.test(path) && /\.tsx?$/.test(path);
  });
  const { made, late } = walkFiles(program, files);
  // Tutor previews explicitly own their player, rather than competing with
  // expo-audio hook cleanup. Keep the inventory floor by counting that audited
  // ownership path, while applying the late-release walk only to hook objects.
  const manual: string[] = [];
  const checker = program.getTypeChecker();
  for (const file of files) {
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'createAudioPlayer') {
        const declaration = declarationOf(checker.getSymbolAtLocation(node.expression), checker);
        if (declaration?.getSourceFile().fileName.includes('/expo-audio/')) manual.push(relative(APP_ROOT, file.fileName));
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  assert.deepEqual(manual.sort(), ['src/sound/sfx.native.ts', 'src/sound/sfx.web.ts', 'src/tutor/useTutorPreview.ts'],
    'a manual audio owner was added or removed and needs an explicit disposal audit');
  const previewOwners = manual.filter(name => name === 'src/tutor/useTutorPreview.ts').length;
  // Fifteen voice players and recorders, including the manual tutor preview. A floor, like the gate's:
  // a new sound raises the count freely, and one that disappears has either
  // been removed on purpose, which lowers this by hand, or slipped past the walk.
  assert.ok(made.length + previewOwners >= 15, `only ${made.length + previewOwners} sound objects were found, so the walk lost one or a screen's sound was removed:\n${made.join('\n')}`);
  assert.ok(
    made.some((label) => label.startsWith('player from useAudioPlayer at src/onboarding/PreAccountOnboarding.tsx:')),
    `the walk no longer reads pre-account onboarding's player, where F792 was found:\n${made.join('\n')}`,
  );
  assert.deepEqual(
    late.map((entry) => entry.touch),
    [],
    `these effect cleanups run after expo-audio has released the sound they touch, which throws on iOS and empties the screen. Leave the sound to the release, or reach it inside a try:\n${late.map((entry) => entry.touch).join('\n')}`,
  );
  const preview = files.find(file => relative(APP_ROOT, file.fileName) === 'src/tutor/useTutorPreview.ts')?.text ?? '';
  const controller = files.find(file => relative(APP_ROOT, file.fileName) === 'src/tutor/tutorPreview.ts')?.text ?? '';
  assert.match(preview, /release: \(\) => player\.release\(\)/, 'the manual preview must dispose the native player');
  assert.match(preview, /return \(\) => \{[^]*?controller\.stop\(\);[^]*?\};/, 'unmount must release the preview through its controller');
  assert.match(controller, /const old = owned;\s*owned = null;/, 'detach ownership before disposal so queued status cannot touch the released object');
  assert.match(controller, /safe\(old\.player\.pause\);\s*safe\(old\.player\.release\);/, 'native stop and release must tolerate an already disposed player');
  assert.match(controller, /const safe =[^]*?try \{ run\(\); \} catch/, 'a native disposal throw must never escape into the screen cleanup');
});

test('the release walk catches a late touch directly, through a helper, an app function or an app hook, and nothing else', () => {
  const fixtures: Record<string, string> = {
    'release.ts': `
      export function loud(player: { pause(): void }) { player.pause(); }
      export function quiet(player: { pause(): void }) { try { player.pause(); } catch { /* released */ } }
    `,
    'screens.tsx': `
      import { useCallback, useEffect, useLayoutEffect, useMemo, useEffect as useMountEffect } from 'react';
      import { useAudioPlayer, useAudioRecorder, RecordingPresets, type AudioPlayer } from 'expo-audio';
      import { loud, quiet } from './release.ts';
      export function Aliased() {
        const player = useAudioPlayer();
        const sound = player;
        useEffect(() => () => { sound.pause(); }, [sound]);
        return null;
      }
      export function Cast() {
        const player = useAudioPlayer() as AudioPlayer;
        useEffect(() => () => { player!.pause(); }, [player]);
        return null;
      }
      export function RenamedEffect() {
        const player = useAudioPlayer();
        useMountEffect(() => () => { player.pause(); }, []);
        return null;
      }
      export function Timer() {
        const player = useAudioPlayer();
        useEffect(() => () => { setTimeout(() => player.pause(), 0); }, [player]);
        return null;
      }
      export function Conditional({ ready }: { ready: boolean }) {
        const player = useAudioPlayer();
        useEffect(() => (ready ? () => player.pause() : undefined), [ready, player]);
        return null;
      }
      export function MemoStop() {
        const player = useAudioPlayer();
        const stop = useMemo(() => () => player.pause(), [player]);
        useEffect(() => stop, [stop]);
        return null;
      }
      export function Direct() {
        const player = useAudioPlayer();
        useEffect(() => () => { player.pause(); }, []);
        return null;
      }
      export function Recorder() {
        const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
        useEffect(() => { return () => { if (recorder.isRecording) void recorder.stop(); }; }, [recorder]);
        return null;
      }
      export function Helper() {
        const player = useAudioPlayer();
        const stopSound = () => { player.pause(); };
        useEffect(() => { const app = { remove() {} }; return () => { app.remove(); stopSound(); }; }, []);
        return null;
      }
      export function Handed() {
        const player = useAudioPlayer();
        useEffect(() => () => loud(player), [player]);
        return null;
      }
      function useHeld() {
        const player = useAudioPlayer();
        const stop = useCallback(() => { player.pause(); }, [player]);
        const quietStop = useCallback(() => { quiet(player); }, [player]);
        return { stop, quietStop };
      }
      export function Hooked() {
        const held = useHeld();
        useEffect(() => () => held.stop(), [held]);
        return null;
      }
      export function Destructured() {
        const { stop } = useHeld();
        useEffect(() => stop, [stop]);
        return null;
      }
      export function TakenApartLater() {
        const held = useHeld();
        const { stop } = held;
        useEffect(() => () => stop(), [stop]);
        return null;
      }
      export function DeclaredFirst() {
        useEffect(() => () => { player.pause(); }, []);
        const player = useAudioPlayer();
        return null;
      }
      export function Caught() {
        const player = useAudioPlayer();
        useEffect(() => () => { try { player.pause(); } catch { /* released */ } quiet(player); }, [player]);
        return null;
      }
      export function Layout() {
        const player = useAudioPlayer();
        useLayoutEffect(() => () => { player.pause(); }, []);
        return null;
      }
      export function AfterAwait() {
        const player = useAudioPlayer();
        const finish = async () => { await Promise.resolve(); player.pause(); };
        useEffect(() => () => { void finish(); }, []);
        return null;
      }
      export function QuietHook() {
        const held = useHeld();
        useEffect(() => () => held.quietStop(), [held]);
        return null;
      }
    `,
  };
  const { options } = appConfig();
  const directory = join(APP_ROOT, 'src', '__audioReleaseFixture__');
  const virtual = new Map(Object.entries(fixtures).map(([name, text]) => [join(directory, name), text]));
  const host = ts.createCompilerHost(options, true);
  const { getSourceFile, fileExists, readFile, directoryExists } = host;
  host.getSourceFile = (name, language, ...rest) =>
    virtual.has(name) ? ts.createSourceFile(name, virtual.get(name)!, language, true) : getSourceFile.call(host, name, language, ...rest);
  host.fileExists = (name) => virtual.has(name) || fileExists.call(host, name);
  host.readFile = (name) => virtual.get(name) ?? readFile.call(host, name);
  host.directoryExists = (name) => name === directory || (directoryExists?.call(host, name) ?? true);
  const program = ts.createProgram([...virtual.keys()], options, host);
  const errors = ts.getPreEmitDiagnostics(program).filter((diagnostic) => diagnostic.file && virtual.has(diagnostic.file.fileName));
  assert.deepEqual(
    errors.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')),
    [],
    'the fixture does not compile, so the walk would be reading nonsense',
  );
  const { late } = walkFiles(program, program.getSourceFiles().filter((file) => virtual.has(file.fileName)));
  assert.deepEqual(
    [...new Set(late.map((entry) => entry.owner))].sort(),
    [
      'Aliased',
      'Cast',
      'Conditional',
      'Destructured',
      'Direct',
      'Handed',
      'Helper',
      'Hooked',
      'MemoStop',
      'Recorder',
      'RenamedEffect',
      'TakenApartLater',
      'Timer',
    ],
    `the walk flagged the wrong cleanups:\n${late.map((entry) => `${entry.owner}: ${entry.touch}`).join('\n')}`,
  );
});
