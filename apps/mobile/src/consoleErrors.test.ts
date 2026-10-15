/**
 * The app logs no error just by being used.
 *
 * The web build logged two errors on every onboarding render: "Unexpected text
 * node" 238 times in one walk through, and "BackHandler is not supported on
 * web". Neither showed on iOS, which is why they lasted. These tests hold the
 * two causes shut across the whole app, not only where they were found.
 *
 * The first is a condition that is not a yes or no. `{issue && <View/>}` with
 * an empty `issue` renders the empty string itself. React Native drops an empty
 * string on iOS, but the web logs it under every View, and the same pattern with
 * a number renders "0", which crashes iOS and Android outright ("Text strings
 * must be rendered within a <Text> component"). So every operand that can
 * short-circuit out of a JSX child `&&` chain must be unable to be '' or 0. The
 * check reads the compiler's types, so it sees through variables, props and
 * optional chains that a text search cannot.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const APP_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** The app as the compiler sees it, built once for both tests. */
let program: ts.Program | undefined;
function appProgram(): ts.Program {
  if (program) return program;
  const configPath = ts.findConfigFile(APP_ROOT, ts.sys.fileExists, 'tsconfig.json');
  assert.ok(configPath, 'apps/mobile has no tsconfig.json for this test to read');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configPath));
  program = ts.createProgram(parsed.fileNames, parsed.options);
  return program;
}

/** The app's own source files: no tests, nothing installed. */
function appFiles(program: ts.Program, extension: RegExp): ts.SourceFile[] {
  return program.getSourceFiles().filter((file) => {
    const path = relative(APP_ROOT, file.fileName);
    return !path.startsWith('..') && !path.includes('node_modules') && !/\.test\.tsx?$/.test(path) && extension.test(path);
  });
}

/** Whether a value of this type can be '' or 0, the falsy values React renders. */
function canRenderWhenFalsy(type: ts.Type): boolean {
  if (type.isUnion()) return type.types.some(canRenderWhenFalsy);
  if (type.isStringLiteral()) return type.value === '';
  if (type.isNumberLiteral()) return type.value === 0;
  if (type.flags & ts.TypeFlags.BigIntLiteral) return (type as ts.BigIntLiteralType).value.base10Value === '0';
  return Boolean(type.flags & (ts.TypeFlags.String | ts.TypeFlags.Number | ts.TypeFlags.BigInt | ts.TypeFlags.TemplateLiteral));
}

/** Every operand that can short-circuit out of an && chain: all but the last. */
function shortCircuitOperands(expression: ts.Expression): ts.Expression[] {
  const flatten = (node: ts.Expression): ts.Expression[] => {
    while (ts.isParenthesizedExpression(node)) node = node.expression;
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      return [...flatten(node.left), ...flatten(node.right)];
    }
    return [node];
  };
  return flatten(expression).slice(0, -1);
}

test('no JSX child is drawn on a condition that can be an empty string or zero', () => {
  const program = appProgram();
  const checker = program.getTypeChecker();
  const files = appFiles(program, /\.tsx$/);
  assert.ok(files.length > 50, `only ${files.length} screens were read, so the check is looking in the wrong place`);
  const leaks: string[] = [];
  for (const file of files) {
    const visit = (node: ts.Node): void => {
      if (
        ts.isJsxExpression(node) &&
        node.expression &&
        (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
      ) {
        for (const operand of shortCircuitOperands(node.expression)) {
          const type = checker.getTypeAtLocation(operand);
          if (canRenderWhenFalsy(type)) {
            const { line } = file.getLineAndCharacterOfPosition(operand.getStart());
            leaks.push(`${relative(APP_ROOT, file.fileName)}:${line + 1}  ${operand.getText()}  (${checker.typeToString(type)})`);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  assert.deepEqual(
    leaks,
    [],
    `these JSX children render '' or 0 when their condition is empty; compare with '' or use a ternary:\n${leaks.join('\n')}`,
  );
});

test('the Android back button is listened for only on Android', () => {
  // React Native Web logs an error for every BackHandler listener, and iOS has
  // no back button, so each listener stands behind an Android check. A focused
  // route may register through an arrow declared after an effect's early guard.
  const program = appProgram();
  const listeners: string[] = [];
  const excludesOtherPlatforms = (condition: ts.Expression): boolean => {
    if (ts.isParenthesizedExpression(condition)) return excludesOtherPlatforms(condition.expression);
    if (!ts.isBinaryExpression(condition)) return false;
    if (condition.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
      return excludesOtherPlatforms(condition.left) || excludesOtherPlatforms(condition.right);
    }
    return condition.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken
      && condition.left.getText() === 'Platform.OS'
      && ts.isStringLiteral(condition.right) && condition.right.text === 'android';
  };
  const returns = (statement: ts.Statement): boolean => ts.isReturnStatement(statement)
    || (ts.isBlock(statement) && statement.statements.length === 1 && ts.isReturnStatement(statement.statements[0]!));
  const guarded = (node: ts.Node): boolean => {
    let child = node;
    for (let parent = child.parent; parent; child = parent, parent = parent.parent) {
      if (ts.isBlock(parent)) {
        for (const statement of parent.statements) {
          if (statement.getStart() >= child.getStart()) break;
          if (ts.isIfStatement(statement) && statement.elseStatement === undefined
              && excludesOtherPlatforms(statement.expression) && returns(statement.thenStatement)) return true;
        }
      }
      // A hoisted declaration could run before an outer guard. Only its own
      // body, or a non-hoisted callback defined after a guard, establishes one.
      if (ts.isFunctionDeclaration(parent) || ts.isMethodDeclaration(parent)) break;
    }
    return false;
  };
  for (const file of appFiles(program, /\.tsx?$/)) {
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && node.expression.getText(file) === 'BackHandler.addEventListener' && !guarded(node)) {
        const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
        listeners.push(`${relative(APP_ROOT, file.fileName)}:${line + 1}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  assert.deepEqual(listeners, [], `these back button listeners are not behind an Android check:\n${listeners.join('\n')}`);
});

test('the Babel-compiled sign-in footer contains no raw text outside Text in either keyboard state', () => {
  const source = ts.createSourceFile('SignInScreen.tsx', readFileSync(new URL('./auth/SignInScreen.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let footer: ts.Expression | undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) && node.tagName.getText(source) === 'Frame') {
      const attribute = node.attributes.properties.find(item => ts.isJsxAttribute(item) && item.name.getText(source) === 'footer');
      if (attribute && ts.isJsxAttribute(attribute) && attribute.initializer && ts.isJsxExpression(attribute.initializer)) footer = attribute.initializer.expression;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(footer, 'read the actual sign-in Frame footer, not a copied fixture');
  const require = createRequire(import.meta.url);
  const { transformSync } = require('@babel/core') as { transformSync: (input: string, options: object) => { code?: string } | null };
  type Element = { type: string; children: unknown[] };
  const compile = (jsx: string, keyboardVisible: boolean): Element => {
    const result = transformSync(`const footer = ${jsx};`, { configFile: false, babelrc: false,
      plugins: [[require.resolve('@babel/plugin-transform-react-jsx'), { runtime: 'classic' }]] });
    assert.ok(result?.code, 'the installed Babel JSX transform must produce the actual children');
    const bindings = {
      React: { Fragment: 'Fragment', createElement: (type: string, _props: unknown, ...children: unknown[]) => ({ type, children }) },
      View: 'View', BoldButton: 'BoldButton', Press: 'Press', Text: 'Text', keyboardVisible,
      pending: null, busy: false, authButtonLabel: () => 'Sign in', liveFontMultiplier: 2,
      st: { switchRow: {}, switchWord: {} }, type: { small: {} }, paper: { inkSoft: '#666' }, c: { violet: '#4328e7' },
    };
    return new Function(...Object.keys(bindings), result.code + '\nreturn footer;')(...Object.values(bindings)) as Element;
  };
  // Same-line JSX whitespace survives Babel; newline indentation does not.
  assert.equal(compile('<>      <View /></>', false).children[0], '      ');
  const unwrappedText = (node: unknown, insideText = false): string[] => {
    if (typeof node === 'string') return insideText ? [] : [node];
    if (!node || typeof node !== 'object') return [];
    const element = node as Element;
    return element.children.flatMap(child => unwrappedText(child, insideText || element.type === 'Text'));
  };
  for (const keyboardVisible of [false, true]) {
    const rendered = compile(footer.getText(source), keyboardVisible);
    assert.deepEqual(unwrappedText(rendered), [], 'a raw whitespace child inside the native footer View triggers the Text warning');
    assert.deepEqual(rendered.children.filter(Boolean).map(child => (child as Element).type), keyboardVisible ? [] : ['View', 'Press'],
      'removing whitespace must retain both footer actions and their existing keyboard visibility');
  }
});
