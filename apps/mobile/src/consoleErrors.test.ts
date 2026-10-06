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
  // no back button, so each listener stands behind an Android check.
  const program = appProgram();
  const listeners: string[] = [];
  for (const file of appFiles(program, /\.tsx?$/)) {
    const source = file.getFullText();
    for (let at = source.indexOf('BackHandler.addEventListener('); at >= 0; at = source.indexOf('BackHandler.addEventListener(', at + 1)) {
      const before = source.slice(Math.max(0, at - 240), at);
      const { line } = file.getLineAndCharacterOfPosition(at);
      if (!/if \(Platform\.OS !== 'android'\) return\b[^;]*;\s*(?:const \w+ = )?$/.test(before)) {
        listeners.push(`${relative(APP_ROOT, file.fileName)}:${line + 1}`);
      }
    }
  }
  assert.deepEqual(listeners, [], `these back button listeners are not behind an Android check:\n${listeners.join('\n')}`);
});
