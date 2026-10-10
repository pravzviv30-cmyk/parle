// Expo's default Metro config, plus one resolver rule. See metro.platform.cjs for why.
const { getDefaultConfig } = require('expo/metro-config');
const { platformAwareRequest } = require('./metro.platform.cjs');

const config = getDefaultConfig(__dirname);
// Local Rive illustrations are data assets, never source code.
config.resolver.assetExts = [...new Set([...config.resolver.assetExts, 'riv'])];

config.resolver.resolveRequest = (context, moduleName, platform) =>
  context.resolveRequest(context, platformAwareRequest(moduleName), platform);

module.exports = config;
