/**
 * F953: on iOS 27, an app built with the iOS 27 SDK that has not adopted the UIScene life
 * cycle is killed at launch. Expo 57 ships the scene delegate but its prebuild template does
 * not wire it, so `plugins/withSceneLifecycle.js` does. The AppDelegate fixture is Expo
 * 57.0.27's template verbatim (node_modules/expo/template.tgz).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { addSceneManifest, adoptSceneDelegate } = require('../../plugins/withSceneLifecycle.js');
const template = readFileSync(new URL('../../test/expo57-AppDelegate.swift', import.meta.url), 'utf8');

const manifest = {
  UIApplicationSupportsMultipleScenes: false,
  UISceneConfigurations: {
    UIWindowSceneSessionRoleApplication: [
      { UISceneConfigurationName: 'Default Configuration', UISceneDelegateClassName: 'EXExpoAppSceneDelegate' },
    ],
  },
};

test('the iOS build adopts the scene life cycle so iOS 27 does not kill it at launch', () => {
  const plist = addSceneManifest({ CFBundleName: 'Luvani' });
  assert.deepEqual(plist, { CFBundleName: 'Luvani', UIApplicationSceneManifest: manifest });
  assert.deepEqual(addSceneManifest(plist), plist);

  const swift = adoptSceneDelegate(template);
  assert.equal(
    swift,
    template
      .replace('class AppDelegate: ExpoAppDelegate {', 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {')
      .replace(
        '\n#if os(iOS) || os(tvOS)\n    window = UIWindow(frame: UIScreen.main.bounds)\n    factory.startReactNative(\n      withModuleName: "main",\n      in: window,\n      launchOptions: launchOptions)\n#endif\n',
        '',
      ),
  );
  assert.match(swift, /reactNativeFactory = factory/);
  assert.doesNotMatch(swift, /startReactNative|UIWindow\(frame/);
  assert.equal(adoptSceneDelegate(swift), swift);

  assert.throws(() => adoptSceneDelegate('class AppDelegate: NSObject {}'), /withSceneLifecycle/);
});
