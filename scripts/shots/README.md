# Screenshots of the web build

Dev tooling for reviewing the Expo web build at 320 and 375 pt, light and dark. It needs
the root `npm ci` (it uses `playwright`, a root devDependency) and a Chromium. If
Playwright's exact build is not cached, the newest cached one is used, and failing that,
run `npx playwright install chromium` once.

## One shot: `npm run shots`

```
npm run shots -- --url http://localhost:8093 --name home --views phone,small --schemes light,dark --wait-text "Take your time"
npm run shots -- --url "http://localhost:8093/?preview=live-speaking" --name live --views phone
```

Options: `--url` and `--name` (required); `--views` (phone 375x812, small 320x640, desktop
1280x800 or `WxH`; default phone,small); `--schemes` (default light,dark); `--motion reduce`;
`--wait-text`; `--out`. Each view and scheme writes `<out>/<name>-<view>-<scheme>.png`, and
console errors seen on the page are printed at the end. It launches a fresh browser each time,
so there is no saved sign-in.

Pass `--wait-text` for a real screen. Expo web draws a launch screen first, and the script
also waits for it to leave, warning if it does not. Be careful with text that the
launch or welcome screen also carries, such as "Bonjour": it matches too early.

## Several steps: `lv.mjs`

One headless Chrome per profile that stays up between commands, so you can sign in once and
come back. Step scripts export `default async ({ page, context, shot, text, log, sleep }) => {}`.

```
node scripts/shots/lv.mjs start --agent 1 --profile main --port 9231 --view phone --scheme dark
node scripts/shots/lv.mjs eval --port 9231 "await page.goto('http://localhost:8093'); await shot('first')"
node scripts/shots/lv.mjs run --port 9231 step.mjs
node scripts/shots/lv.mjs stop --port 9231
```

`--mic <name>` plays `<name>.wav` from `LUVANI_SHOTS_CLIPS` as the fake microphone, `--mic deny`
refuses the prompt, and `--motion reduce` is accepted. Changing `--mic` needs a restart.
## Env vars

- `LUVANI_SHOTS_DIR`: output root. Default `<os tmpdir>/luvani-shots`. `capture.mjs` writes to
  its `shots` folder, `lv.mjs` to `agentN/shots`, `agentN/log.md` and `agentN/profiles`.
- `LUVANI_SHOTS_CLIPS`: folder of fake-mic WAV files. Default `<LUVANI_SHOTS_DIR>/clips`.

## Reaching states

Start the app from `apps/mobile` with `EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT=1 npx expo start --web --port <port>`.

- **Screen previews.** Add `EXPO_PUBLIC_LUVANI_SCREEN_PREVIEW=1`. This replaces the whole app with
  a preview menu, so Today and the tabs are not reachable in the same run. Open
  `?preview=live-speaking`, `live-typing`, `live-tap-to-send`, `live-wrap-up`, or
  `?preview=your-french-<full|sounds|scenes|forward|free>&theme=<light|dark>&controls=0`.
  Today's hero states are `?preview=today-<state>`, the states listed in
  `TODAY_PREVIEW_STATES` (`apps/mobile/src/dev/todayPreviewFixtures.ts`), among them
  `today-held` (out of minutes past Starter) and `today-held-starter` (lapsed at Starter:
  See plans, then the café line as the inline headphones action). A server started with `CI=1` does not
  watch files, so restart it to shoot an edit. See `docs/TESTING.md`.
- **A signed-in learner with data.** Leave the preview flag off and start a non-production
  web build on mock auth with `EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT=1` and
  `EXPO_PUBLIC_LUVANI_CANVAS_LEARNER=1` (or `fresh`, which clears the account once first).
  After a mock sign-up or sign-in, once the account's storage is open and before the first
  screen draws (the loading screen holds until the seed settles),
  `apps/mobile/src/dev/canvasLearner.ts` seeds Yasmin: a three-day run, 120 XP, sample
  conversations, due cards. The mock account lives in the browser's storage, so a fresh
  `capture.mjs` run is always signed out. Use an `lv.mjs` profile: create an account
  (Get Started, I already have an account, Create an account), finish the six onboarding
  steps (not scripted yet), then reuse the profile and `page.goto` the screen you want.
