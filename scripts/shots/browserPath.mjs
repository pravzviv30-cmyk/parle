// Which Chromium to launch. Playwright's own path first; if that exact build is not installed
// (the cache holds an older revision, which still works), fall back to the newest cached one.
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const BINARY = {
  'darwin-arm64': ['chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'],
  'darwin-x64': ['chrome-mac-x64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'],
  'linux-x64': ['chrome-linux64', 'chrome'],
};

export function cacheRoot(env = process.env, platform = process.platform) {
  if (env.PLAYWRIGHT_BROWSERS_PATH && env.PLAYWRIGHT_BROWSERS_PATH !== '0') return env.PLAYWRIGHT_BROWSERS_PATH;
  return platform === 'darwin' ? join(homedir(), 'Library', 'Caches', 'ms-playwright') : join(homedir(), '.cache', 'ms-playwright');
}

/** Cached chromium-<revision> folder names, newest revision first. Headless-shell folders are skipped. */
export function chromiumRevisions(names) {
  return names
    .map((n) => /^chromium-(\d+)$/.exec(n))
    .filter(Boolean)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map((m) => m[0]);
}

export function chromiumPath(chromium, { env = process.env, platform = process.platform, arch = process.arch } = {}) {
  const own = chromium.executablePath();
  if (existsSync(own)) return own;
  const parts = BINARY[`${platform}-${arch}`];
  const root = cacheRoot(env, platform);
  if (parts && existsSync(root)) {
    for (const dir of chromiumRevisions(readdirSync(root))) {
      const candidate = join(root, dir, ...parts);
      if (existsSync(candidate)) return candidate;
    }
  }
  throw new Error(`No Chromium found. Playwright expects ${own}. Run "npx playwright install chromium" once, or set PLAYWRIGHT_BROWSERS_PATH to a folder that has one.`);
}
