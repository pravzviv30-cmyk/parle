// F953: iOS 27 kills an iOS 27 SDK app at launch unless it adopts the UIScene life cycle.
// Expo 57 ships EXExpoAppSceneDelegate but its prebuild template does not wire it.
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const PROVIDER = 'ExpoReactNativeFactoryProvider';
const CLASS_LINE = 'class AppDelegate: ExpoAppDelegate {';
const START_BLOCK =
  '\n#if os(iOS) || os(tvOS)\n    window = UIWindow(frame: UIScreen.main.bounds)\n    factory.startReactNative(\n      withModuleName: "main",\n      in: window,\n      launchOptions: launchOptions)\n#endif\n';

function addSceneManifest(plist) {
  return {
    ...plist,
    UIApplicationSceneManifest: {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          { UISceneConfigurationName: 'Default Configuration', UISceneDelegateClassName: 'EXExpoAppSceneDelegate' },
        ],
      },
    },
  };
}

function adoptSceneDelegate(contents) {
  if (contents.includes(`ExpoAppDelegate, ${PROVIDER} {`) && !contents.includes(START_BLOCK)) return contents;
  if (!contents.includes(CLASS_LINE) || !contents.includes(START_BLOCK)) {
    throw new Error(
      'withSceneLifecycle: AppDelegate.swift no longer matches the Expo 57 template; update the plugin or iOS 27 will kill the app at launch (F953).',
    );
  }
  return contents.replace(CLASS_LINE, `class AppDelegate: ExpoAppDelegate, ${PROVIDER} {`).replace(START_BLOCK, '');
}

const withSceneLifecycle = (config) => {
  config = withInfoPlist(config, (c) => {
    c.modResults = addSceneManifest(c.modResults);
    return c;
  });
  return withAppDelegate(config, (c) => {
    c.modResults.contents = adoptSceneDelegate(c.modResults.contents);
    return c;
  });
};

module.exports = withSceneLifecycle;
module.exports.addSceneManifest = addSceneManifest;
module.exports.adoptSceneDelegate = adoptSceneDelegate;
