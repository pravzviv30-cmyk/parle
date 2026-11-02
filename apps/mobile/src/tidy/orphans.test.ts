/**
 * What the 2026-11-01 orphan sweep must not break, and what it must keep gone.
 *
 * The sweep deleted code and assets that nothing loaded: the onboarding Rive
 * scenes, the bold-rhythm `.riv` files, `ContinuityCard`, `continuityRow`, three
 * unread constants and a glyph. A 2026-11-02 follow-up removed the web Rive
 * runtime, its two wasm files and the four orphan onboarding scene sources. `tsc` checks imports but not `require('...')`, and
 * Metro only complains at bundle time, so a dangling asset would pass every other
 * test here. These checks read the source, as the rest of this workspace does
 * (docs/TESTING.md: there is no renderer), and each one can fail on a real
 * regression. See "Deleted" rows dated 2026-11-01 in docs/DELETION_LEDGER.md.
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { firstNameOf, TUTOR_ORB_SUBLINE, TUTOR_PURPOSE } from '../tutor/dashboard.ts';
import { ICON_NAMES } from '../icons/names.ts';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.resolve(SRC, '..');
const ROOT = path.resolve(APP, '..', '..');
const SELF = fileURLToPath(import.meta.url);

const read = (file: string): string => readFileSync(file, 'utf8');
const src = (relative: string): string => path.join(SRC, relative);

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const SOURCES = walk(SRC).filter((f) => /\.(ts|tsx)$/.test(f) && f !== SELF);
const PRODUCTION = SOURCES.filter((f) => !/\.test\.tsx?$/.test(f));

describe('every static require in the app points at a file that exists', () => {
  const RESOLVE_AS = ['', '.ts', '.tsx', '.js', '.json', '/index.ts', '/index.tsx'];
  const requires = (file: string): string[] =>
    [...stripComments(read(file)).matchAll(/\brequire\(\s*(['"])(\.{1,2}\/[^'"]+)\1\s*\)/g)].map((m) => m[2]!);

  test('no require in src, App.tsx or index.ts is left dangling by a deletion', () => {
    const files = [...PRODUCTION, path.join(APP, 'App.tsx'), path.join(APP, 'index.ts')];
    const all: Array<{ from: string; target: string }> = [];
    for (const file of files) for (const target of requires(file)) all.push({ from: file, target });

    // A scan that found nothing would pass for the wrong reason.
    assert.ok(all.length > 100, `only ${all.length} requires found, so the scan is not reading the sources`);
    for (const wanted of ['.riv', '.m4a', '.svg']) {
      assert.ok(all.some((r) => r.target.endsWith(wanted)), `the scan found no ${wanted} require, so it is not covering assets`);
    }

    const dangling = all
      .filter(({ from, target }) => !RESOLVE_AS.some((suffix) => existsSync(path.resolve(path.dirname(from), target + suffix)) && statSync(path.resolve(path.dirname(from), target + suffix)).isFile()))
      .map(({ from, target }) => `${path.relative(APP, from)} -> ${target}`);
    assert.deepEqual(dangling, [], 'a require points at a file that is gone; Metro fails the bundle on it and tsc does not');
  });
});

describe('Rive is kept for the streak flame and nothing else', () => {
  test('streak.riv is the only compiled Rive file left in the app, and it is a Rive file', () => {
    const rive = path.join(APP, 'assets', 'rive');
    assert.deepEqual(readdirSync(rive).filter((f) => f.endsWith('.riv')), ['streak.riv'], 'a second compiled scene is bundled again');
    assert.equal(read(path.join(rive, 'streak.riv')).slice(0, 4), 'RIVE', 'streak.riv is not a compiled Rive file');
    const bold = path.join(APP, 'assets', 'bold-rhythm');
    assert.deepEqual(readdirSync(bold).filter((f) => f.endsWith('.riv')), [], 'compiled bold-rhythm scenes are bundled again');
  });

  test('the flame still requires it, Metro still treats .riv as an asset and the runtime is still a dependency', () => {
    const flame = stripComments(read(src('streak/StreakFlame.native.tsx')));
    assert.match(flame, /require\('\.\.\/\.\.\/assets\/rive\/streak\.riv'\)/, 'the native flame no longer loads streak.riv');
    assert.match(read(path.join(APP, 'metro.config.js')), /assetExts[^\n]*'riv'/, "Metro would treat streak.riv as source code without 'riv' in assetExts");
    const pkg = JSON.parse(read(path.join(APP, 'package.json'))) as { dependencies: Record<string, string> };
    assert.ok('@rive-app/react-native' in pkg.dependencies, 'the flame has no Rive runtime to play it');
    assert.match(read(src('streak/StreakFlame.native.tsx')), /from '@rive-app\/react-native'/);
  });

  test('the web Rive runtime, its wasm and the four onboarding scene sources stay gone', () => {
    const pkg = JSON.parse(read(path.join(APP, 'package.json'))) as { dependencies: Record<string, string>; devDependencies?: Record<string, string> };
    const deps = { ...pkg.dependencies, ...(pkg.devDependencies ?? {}) };
    for (const name of ['@rive-app/react-webgl2', '@rive-app/webgl2']) assert.ok(!(name in deps), `${name} is a dependency again, and nothing loads it`);
    const bold = path.join(APP, 'assets', 'bold-rhythm');
    for (const wasm of ['rive.wasm', 'rive_fallback.wasm']) assert.ok(!existsSync(path.join(bold, wasm)), `${wasm} is back, and nothing loads it`);
    assert.deepEqual(readdirSync(path.join(APP, 'assets', 'rive', 'source')), ['streak'], 'assets/rive/source holds a scene other than streak again');
  });
});

describe('OnboardingScenes keeps the two exports other screens use', () => {
  const SCENES = 'onboarding/motion/OnboardingScenes.tsx';
  const exported = (): string[] =>
    [...stripComments(read(src(SCENES))).matchAll(/^export (?:function|const) (\w+)/gm)].map((m) => m[1]!);
  const LIVE: Record<string, string[]> = {
    'launch/LaunchScreen.tsx': ['GlowAction'],
    'auth/SignInScreen.tsx': ['RevealItem'],
    'onboarding/FirstSessionResult.tsx': ['RevealItem'],
  };

  test('GlowAction and RevealItem are still exported', () => {
    for (const name of ['GlowAction', 'RevealItem']) assert.ok(exported().includes(name), `${SCENES} lost ${name}`);
  });

  test('each live screen imports exactly what it draws from it, and the module exports all of it', () => {
    for (const [file, names] of Object.entries(LIVE)) {
      const code = stripComments(read(src(file)));
      const imported = /import \{([^}]*)\} from '[./]+(?:onboarding\/)?(?:motion\/)?OnboardingScenes\.tsx'/.exec(code);
      assert.ok(imported, `${file} no longer imports from OnboardingScenes.tsx`);
      const got = imported[1]!.split(',').map((n) => n.trim()).filter(Boolean).sort();
      assert.deepEqual(got, [...names].sort(), `${file} imports a name that is unused or gone`);
      for (const name of names) {
        assert.ok(exported().includes(name), `${file} imports ${name}, which OnboardingScenes.tsx no longer exports`);
        assert.match(code, new RegExp(`<${name}\\b`), `${file} imports ${name} and never draws it`);
      }
    }
  });
});

describe('the Tutor words module keeps what the app reads from it', () => {
  test('firstNameOf, TUTOR_PURPOSE and TUTOR_ORB_SUBLINE still exist and behave', () => {
    assert.equal(typeof firstNameOf, 'function');
    assert.equal(firstNameOf('  Amina Rahman '), 'Amina');
    assert.equal(typeof TUTOR_PURPOSE, 'string');
    assert.ok(TUTOR_PURPOSE.length > 0);
    assert.equal(TUTOR_ORB_SUBLINE, TUTOR_PURPOSE);
  });

  test('their live readers still import them', () => {
    const readers: Array<[string, string]> = [
      ['home/greeting.ts', 'firstNameOf'],
      ['tabs/HomeTab.tsx', 'firstNameOf'],
      ['profile/avatar.ts', 'firstNameOf'],
      ['tutor/orbState.ts', 'TUTOR_ORB_SUBLINE'],
    ];
    for (const [file, name] of readers) {
      const code = stripComments(read(src(file)));
      assert.match(code, new RegExp(`import \\{[^}]*\\b${name}\\b[^}]*\\} from '[./]*(?:tutor/)?dashboard\\.ts'`), `${file} stopped importing ${name}`);
      assert.ok((code.match(new RegExp(`\\b${name}\\b`, 'g')) ?? []).length >= 2, `${file} imports ${name} and never uses it`);
    }
  });
});

describe('the slow speaker is drawn from the generated icon set now that its glyph is gone', () => {
  test('speaker-slow is a registered icon with its dashed arc', () => {
    assert.ok(ICON_NAMES.includes('speaker-slow'), 'the icon name is gone from the set');
    const registry = stripComments(read(src('icons/index.ts')));
    assert.match(registry, /import \{ SpeakerSlow \} from '\.\/SpeakerSlow\.tsx'/);
    assert.match(registry, /'speaker-slow': SpeakerSlow,/, 'the registry no longer maps speaker-slow to its drawing');
    assert.ok(existsSync(src('icons/SpeakerSlow.tsx')), 'the drawing file is gone');
    assert.match(read(src('icons/SpeakerSlow.tsx')), /strokeDasharray/, 'the slow speaker lost its dashed arc');
  });

  test('IconAction draws any icon through the registry, and its live callers still ask for this one', () => {
    const components = stripComments(read(src('components.tsx')));
    const action = components.slice(components.indexOf('export function IconAction('));
    assert.match(action, /icon: IconName \| 'orb'/, 'IconAction no longer accepts a registry icon name');
    assert.match(action, /<Icon name=\{icon\}/, 'IconAction no longer draws the name it is given through Icon');
    assert.match(stripComments(read(src('icons/Icon.tsx'))), /ICONS\[name\]/, 'Icon no longer reads the registry');
    for (const caller of ['daily/DailyCard.tsx', 'walk/WalkRoom.tsx', 'conversationPacks/ConversationPracticeScreen.tsx']) {
      assert.match(stripComments(read(src(caller))), /icon="speaker-slow"/, `${caller} stopped drawing the slow speaker`);
    }
  });
});

describe('what the sweep deleted stays deleted', () => {
  const GONE = [
    'apps/mobile/src/tutor/ContinuityCard.tsx',
    'apps/mobile/src/tutor/ContinuityCard.test.ts',
    'apps/mobile/src/onboarding/motion/RiveSceneRenderer.tsx',
    'apps/mobile/src/onboarding/motion/RiveSceneRenderer.native.tsx',
    'apps/mobile/src/onboarding/motion/SceneStill.tsx',
    'apps/mobile/src/onboarding/motion/boldSceneFiles.ts',
    'apps/mobile/src/art/flat/onboardingRiveStills.ts',
    'apps/mobile/src/art/flat/boldSceneAssets.ts',
    'apps/mobile/assets/rive/welcome.riv',
    'apps/mobile/assets/rive/level.riv',
    'apps/mobile/assets/rive/plan.riv',
    'apps/mobile/assets/rive/account.riv',
    'apps/mobile/assets/bold-rhythm/stills.json',
    'scripts/build-onboarding-rive.py',
  ];
  const NAMES = [
    'QUIET_DOOR', 'showQuietDoor', 'OPEN_MIC_LABEL', 'SpeakerSlowGlyph', 'ContinuityCard', 'continuityRow',
    'OnboardingScene', 'RiveSceneRenderer', 'boldSceneFiles', 'boldSceneAssets',
  ];

  test('the removed files and assets are not restored', () => {
    const back = GONE.filter((relative) => existsSync(path.join(ROOT, relative)));
    assert.deepEqual(back, [], 'a deleted orphan has come back; the ledger rows dated 2026-11-01 say why it went');
  });

  test('no production source declares or re-exports a removed name', () => {
    const declares = (name: string) =>
      new RegExp(`\\bexport\\s+(?:declare\\s+)?(?:async\\s+)?(?:const|let|function|class|type|interface|enum)\\s+${name}\\b|\\bexport\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`);
    const found: string[] = [];
    for (const file of PRODUCTION) {
      const code = stripComments(read(file));
      for (const name of NAMES) if (declares(name).test(code)) found.push(`${path.relative(APP, file)} exports ${name}`);
    }
    assert.deepEqual(found, [], 'a removed export is back in production code');
  });

  test('no production source imports a removed module', () => {
    // A static import or re-export, a require() or a dynamic import(), in either quote style.
    const importing = /(?:\bfrom\s+|\brequire\(\s*|\bimport\(\s*)(['"])[^'"]*\/(?:ContinuityCard|RiveSceneRenderer|SceneStill|boldSceneFiles|boldSceneAssets|onboardingRiveStills)(?:\.\w+)*\1/;
    const found = PRODUCTION.filter((file) => importing.test(stripComments(read(file)))).map((f) => path.relative(APP, f));
    assert.deepEqual(found, [], 'a file imports a module that was deleted');
  });
});
