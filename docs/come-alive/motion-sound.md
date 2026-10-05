> Detailed draft spec, written 2026-10-04 and checked against `47fbc2ea`. Where it disagrees with
> [README.md](README.md) Parts 1, 6 or 7 (decisions, resolutions, gate traps), README wins. Read the
> matching review in [reviews/](reviews/) before building from it.

## Motion, sound and haptics system

This section sets up the motion, sound and haptics foundation the other sections build on. It specifies one motion engine (Reanimated 4.5.1), a shared token table, a set of primitives, one celebration host, a sound effects seam that hands the audio session back and forth safely, and a haptic vocabulary. It also lists the replacement contract tests. Every current-state claim below was checked against source on 2026-10-04. Where the evidence files were wrong or incomplete, the correction is noted.

### 0. Verified current state, and corrections to the evidence

| Fact | Where | Consequence |
|---|---|---|
| Motion today is RN `Animated`. The press spring is `pressTo` (stiffness 439, damping 29.3, mass 1). | `apps/mobile/src/motion.ts:131-139` | Kept as `SPRING.press`. |
| `useReduceMotion` subscribes to `reduceMotionChanged`. An error or unknown value counts as reduced. | `motion.ts:27-45` | Every primitive takes its reduced-motion state from here. |
| Reanimated 4.5.1 reads the system reduce-motion setting **once, at module load** (`IS_REDUCED_MOTION_ENABLED_IN_SYSTEM = isReducedMotionEnabledInSystem()`). `ReducedMotionConfig` calls `ReducedMotionManager.setEnabled` and restores the old value on unmount. | unpkg `react-native-reanimated@4.5.1/src/ReducedMotion.ts`, `src/component/ReducedMotionConfig.tsx` (fetched 2026-10-04) | Confirms the trap described in tech.md. The bridge in §1.4 closes it. |
| `babel-preset-expo` auto-adds `react-native-worklets/plugin` when that package resolves. | `node_modules/babel-preset-expo/build/configs/expo.js:96-101` | No `babel.config.js` is needed. |
| Reanimated 4.5.1 peers are `react-native: "0.83 - 0.86"` and `react-native-worklets: "0.10.x"`. There is no config plugin. | unpkg `package.json` | No `app.json` plugin entry is needed. |
| `react-native-worklets@0.10.1` exports `scheduleOnRN`, `scheduleOnUI`, `runOnJS` and `runOnUI`. | unpkg `src/index.ts` | Use `scheduleOnRN`. |
| **Correction.** On iOS, an expo-audio mode with fields left out does **not** default to `playsInSilentMode: true`, despite the TS doc comment. JS passes the iOS mode through as given (`expo-audio/build/ExpoAudio.js:404-406`), and the Swift record defaults `playsInSilentMode = false` (`ios/AudioRecords.swift:4`). So `setAudioModeAsync({ allowsRecording: false })` selects `.ambient` (`ios/AudioModule.swift:781-786`). | `GuestRecording.tsx:37,49,92,112`; `PrivatePractice.tsx:47,63,89,95,102`; `DailyPracticeScreen.tsx:91,116,120` | Today these calls silently make later voice playback follow the silent switch. |
| **Correction.** Four voice players and the TTS path never set an audio mode before playing. expo-audio does not set a category when a player is created; `play` only activates the session (`AudioModule.swift:212-216`). | `onboarding/PreAccountOnboarding.tsx:328`, `onboarding/OnboardingFlow.tsx:187`, `tabs/TutorTab.tsx:112`, `tabs/ProfileTab.tsx:155`, `speech/tutorVoice.ts:66-80` (expo-speech) | Once an SFX switches the session to `.ambient`, these paths would go silent in silent mode. The code suggests they may already be silent on a fresh launch with the switch on, but that needs checking on a device. They must be fixed in the same change (§6.4). |
| Setting `allowsRecording:false` **stops any recorder that is running** (`AudioModule.swift:768-773`). `playsInSilentMode:false` together with `allowsRecording:true` throws (`AudioUtils.swift:182-183`). | — | An SFX must never change the audio mode while a microphone is open. |
| **Correction.** `silenceRecordingHaptics()` has exactly one caller, `onboarding/GuestRecording.tsx:95`. None of the other recorders hold it: `DrillScreen.tsx:608-610`, `drill/SpokenAttempt.tsx:59`, `recap/PrivatePractice.tsx:88`, `daily/DailyPracticeScreen.tsx:112`, `soundcheck/SoundCheckScreen.tsx:181`, and the live room (`live/globals.native.ts:29-39`). | `motion/hapticPreference.ts:9-18` | Haptics, and any future SFX, are not silenced while those microphones are open. §6.4 fixes this. |
| `daily/playback.ts:1-11` records which daily player **owns** playback, not whether it is **playing**. | — | It cannot be the "tutor audio is playing" gate. A new voice hold replaces it for that purpose. |
| **Correction.** The canonical checkout `/Users/pravz_07/Documents/StartUps/Luvani` is on `redesign/notebook`. Its `node_modules` has no `expo-updates`. | `git branch --show-current` | Install inside this worktree (§1.1). Do not borrow the root `node_modules`. |
| The web CSP has `default-src 'self'`, no `media-src`, and no `blob:`. | `apps/mobile/public/_headers` | A same-origin `<audio src>` works. `preload()` (a `blob:` URL, `AudioModule.web.js:38-48`) is blocked. |
| `HomeTab.test.ts:121`, `RecapScreen.test.ts:100` and `TutorTab.test.ts:121` ban the **substring** `Animated`. | — | They would reject `<AnimatedIcon`. Tighten them to `/\bAnimated\./` (§8). |
| `PRESS_SCALE = 0.97` appears in a ledger-pinned title ("every tappable part presses through one spring: 0.97, …", F597). | `components.test.ts:684` | Keep 0.97 for controls. The "stronger" press goes to tiles (§2). |

### 1. Adding Reanimated 4.5.1 and Worklets 0.10.1

#### 1.1 Exact install (deploy-engineer)

1. `cd /Users/pravz_07/Documents/StartUps/Luvani/.claude/worktrees/app-engagement-animations-de9910 && npm ci`
   - This creates `node_modules` inside the worktree, so Node resolution stops there rather than climbing into the canonical checkout (`docs/TESTING.md:12-28`).
   - `postinstall` runs `scripts/patchExpoModulesJsi.mjs` and the hooks installer.
2. `cd apps/mobile && npx expo install react-native-reanimated react-native-worklets`
   - Expect `"react-native-reanimated": "~4.5.1"` and `"react-native-worklets": "~0.10.1"` in `apps/mobile/package.json`, and an updated root `package-lock.json`.
   - npm auto-installs the `@react-native/metro-config` peer of worklets. Confirm it appears in the lock.
3. `npm ls react-native-reanimated react-native-worklets` should show 4.5.1 and 0.10.1 with one copy each. `npx expo install --check` should be clean.
4. From the repo root, run `npm run audit:ci`. Record any new high advisory under `package.json` → `luvani.dependencyAudit`, or stop.
5. `cd apps/mobile && npx expo start --clear`. The Babel plugin list has changed, so the Metro cache must be cleared.
6. `app.json`: add `"EXDevMenuShowFloatingActionButton": false` to `ios.infoPlist` (`app.json:17-19`).
   - The key is read at `expo-dev-menu/ios/Modules/DevMenuPreferences.swift:29` (57.0.16), defaulting to `true` at `:49`.
   - It is harmless in staging and production builds.
   - It is a `UserDefaults` default, so if the founder has toggled the button by hand, that explicit value still wins. The shake gesture still opens the menu.
   - No other `app.json` change is needed. Do not add a plugin for Reanimated.
7. Fingerprint proof, which closes `docs/REMOTE_UPDATES.md:93`:
   - Run `npx @expo/fingerprint fingerprint:generate --platform ios > /tmp/before.json` on `47fbc2ea` and again after steps 2 and 6.
   - Then `npx @expo/fingerprint fingerprint:diff /tmp/before.json /tmp/after.json`. Expect `expoAutolinkingConfig:ios` and `expoConfig` to differ.
   - Paste the hashes into `REMOTE_UPDATES.md`.
8. Native builds, before **11 Oct 2026**, when the Personal Team profile expires (`REMOTE_UPDATES.md:77-80`):
   - `npx expo prebuild --platform ios --clean && npm run ios:device`. `/ios` is git-ignored (`apps/mobile/.gitignore:47`), so a clean prebuild is needed to pick up the plist key and the pods.
   - Then build EAS `staging` (`eas.json:16-30`). OTA updates published after this step only reach the new binaries.
9. Web: `npm run build:web` from the root must exit 0 (`docs/RELEASE_GATE.md:17`). CI does not build web (`.github/workflows/ci.yml:95-105`), so this is a manual release step.
10. `npm run gate`, then `npm run gate:bless` once the new tests exist. Add the matching `**N tests` bullet to `docs/IMPLEMENTATION_EVIDENCE.md` (evidenceContract `:1211`).

#### 1.2 Module-boundary rules (so Node suites do not drop silently)

`node --test` loads `.ts` files only, and a suite that fails to load disappears silently (`TESTING.md:18-28`). Therefore:

- `react-native-reanimated`, `react-native-worklets`, `expo-audio` and `expo-haptics` may be imported only from:
  - `.tsx` files;
  - `*.native.ts` / `*.web.ts` files;
  - `motion/drive.ts`;
  - `sound/audioSession.ts`.
- Pure modules hold the numbers, logic and data so they can be tested: `motion/tokens.ts`, `celebrate/queue.ts`, `celebrate/particles.ts`, `celebrate/timelines.ts`, `sound/sfxIds.ts`, `sound/audioModes.ts`, `sound/audioFocus.ts`, `sound/sfxGate.ts`, `motion/countTicks.ts`.
- A new guard in `motion.test.ts` (§8.2 rule 7) fails if any `*.test.ts` imports a file that imports those packages.

#### 1.3 Web

- Reanimated runs on react-native-web through JS `requestAnimationFrame`. There is no `eval` and no WASM, so the CSP is fine.
- Layout-animation `<style>` injection is covered by `style-src 'unsafe-inline'`.
- Haptics stay as no-ops (`motion/haptics.ts`).
- SFX use HTMLAudio without preload (§6.3).
- **Open risk:** `useAnimatedProps` on `react-native-svg` under react-native-web 0.21. Acceptance check W2 covers it. If it fails, add `motion/ProgressRing.web.tsx`, which drives `strokeDashoffset` from React state at most 30 times a second.

#### 1.4 Reduced motion: belt and braces

- **Belt.** New `motion/ReduceMotionBridge.tsx`, mounted once in `App.tsx`:
  ```tsx
  const reduced = useReduceMotion();
  return <ReducedMotionConfig mode={reduced ? ReduceMotion.Always : ReduceMotion.Never} />;
  ```
  This keeps Reanimated's global flag in step with the **live** OS setting. Unknown counts as reduced, so a cold start is conservative.
- **Braces.** Every primitive calls `useReduceMotion()` itself:
  - When reduced, it assigns final values directly (`sv.value = final`) and starts nothing.
  - Otherwise it calls the wrappers in `motion/drive.ts`. Every wrapper takes `reduced` and sets `reduceMotion: reduced ? ReduceMotion.Always : ReduceMotion.Never` on the config or builder.
- **Banned everywhere:** Reanimated `useReducedMotion`, `ReduceMotion.System`, and `ReducedMotionConfig` outside the bridge.
- One-shot celebrations wait on `useReduceMotion(true) === null` for at most 300 ms, then play the reduced version.

### 2. `motion/tokens.ts` (pure, no imports)

| Group | Token | Value | Use |
|---|---|---|---|
| `DUR` | `instant` | 0 | reduced motion |
| | `micro` | 120 | fades on exit, icon nudges |
| | `fast` | 180 | selection fill, glow, label swaps |
| | `base` | 260 | entrances, page-level fades |
| | `settle` | 380 | (equals `SETTLE_MS`, motion.ts:51) |
| | `slow` | 420 | Bloom, card expand |
| | `flight` | 480 | ChipFlight X travel |
| | `reveal` | 650 | ring draw, art rise |
| | `count` | 900 | CountUp |
| | `celebrate` | 900 | template core beat |
| | `burst` | 1400 | confetti lifetime |
| `STAGGER` | `tight` / `base` / `loose` / `tiles` | 40 / 60 / 90 / 140 | words / rows / icon rows / stat tiles |
| `EASE` (cubic-bezier tuples) | `out` | `[0.22, 1, 0.36, 1]` | default entrances |
| | `settle` | `[0.33, 1, 0.68, 1]` | equivalent to `Easing.out(Easing.cubic)` today |
| | `inOut` | `[0.65, 0, 0.35, 1]` | ring draw, expand/collapse, X flight |
| | `in` | `[0.55, 0, 1, 0.45]` | exits that "set" |
| | `linear` | `[0, 0, 1, 1]` | Glint, spinner |
| `SPRING` (Reanimated `withSpring`; mass 1) | `press` | `{ stiffness: 439, damping: 29.3, mass: 1 }` | response 0.3 s, ζ 0.7. **Unchanged** from `motion.ts:136`. |
| | `pop` | `{ stiffness: 322, damping: 19.7, mass: 1 }` | response 0.35 s, ζ 0.55, ≈12.6 % overshoot. Chips, medals, numbers. |
| | `settle` | `{ stiffness: 158, damping: 21.4, mass: 1 }` | response 0.5 s, ζ 0.85, <1 % overshoot. Bars, cards. |
| | `snap` | `{ stiffness: 987, damping: 50.3, mass: 1 }` | response 0.2 s, ζ 0.8. Detents, knob release. |
| `PRESS` | `scale` | `0.97` (**keep the name `PRESS_SCALE`**) | pills, links, rows |
| | `scaleTile` | `0.95` (`PRESS_SCALE_TILE`) | option tiles, IconButton, quest and goal tiles: the "stronger press" |
| | `selectPop` | `1.03` | one pop when a tile becomes selected |
| Budgets | `INPUT_READY_MS` | 600 | the longest a takeover may delay input |
| | `CELEBRATION_MAX_MS` | 2600 | end of any template's last beat |
| | `BURST_MAX` | phone 36, iPad (width ≥ 744) 56, web 24 | particles |

Derivations: stiffness = (2π / response)², damping = 2ζ√stiffness. They go in a comment in the same file, as at `motion.ts:117-125`.

`motion.ts` re-exports `PRESS_SCALE`, `PRESS_SCALE_TILE` and `SPRING`. It keeps `useReduceMotion`, `SETTLE_MS`, `settleIn`, `drawIn`, `DRAW_MS` and `NATIVE_DRIVER` for the remaining RN `Animated` files. Its `pressTo` becomes:

```ts
export function pressTo(value: SharedValue<number>, to: number, reduced: boolean): void {
  if (reduced) { value.value = to; return; }
  value.value = spring(to, SPRING.press, reduced);
}
```

`spring` comes from `./motion/drive.ts`. `motion/drive.ts` is the **only** file allowed to call `withTiming`, `withSpring`, `withDelay`, `withSequence`, `withRepeat` or `withDecay`. It exports:

- `timing(to, dur, ease, reduced)`
- `spring(to, cfg, reduced)`
- `delay(ms, anim, reduced)`
- `sequence(reduced, ...anims)`
- `repeat(anim, count, reverse, reduced)`
- `bezier(tuple)` (which wraps `Easing.bezier`)
- `cancel(sv)`

### 3. Primitives (`apps/mobile/src/motion/`)

Common contract for every primitive:

- reduced motion comes from `useReduceMotion()`;
- everything decorative carries `pointerEvents="none"` and `{...decorative}` (J6);
- no loop unless §8.2 rule 4 allows it;
- all animation runs on the UI thread, and JS work per frame is limited to CountUp text (at most 30 updates a second);
- everything stops at its final frame on unmount, on `AppState` leaving `active`, or when the Host calls `skipToEnd`.

| Primitive | API | Behaviour | Reduced motion | Web | Budget |
|---|---|---|---|---|---|
| **Press** (upgrade, `components.tsx:1540`) | Existing props plus `depth?: 'control' \| 'tile'` (scale 0.97 or 0.95), `selected?: boolean`, `glowRadius?: number` (default `radius.control`), `sound?: SfxId` (default none) | `Reanimated.View` surface. `onPressIn` calls `pressTo(scale, depth === 'tile' ? PRESS_SCALE_TILE : PRESS_SCALE, reduced)`; `onPressOut` calls `pressTo(scale, 1, reduced)`. When `selected` goes false→true: scale `sequence(timing(1.03, 90, EASE.out), spring(1, SPRING.pop))`, and a glow ring (absolute `top/left/right/bottom: -4`, `borderRadius: glowRadius + 4`, `backgroundColor: colour.blue`) fades opacity 0→0.16 over `DUR.fast` with `EASE.out`. This is a ring layer, **not a shadow** (F569 stands). The caller swaps fill and text colours instantly. Haptics stay as today (`pressed` or `tapSettled` on press). No second tick on select (DESIGN.md:807). `sound` plays on press only when given. | Scale lands instantly. The glow shows at its final opacity. | same | 1 shared value per scale and glow |
| **StaggerIn** | `<StaggerIn step={STAGGER.base} from="down" distance={10} duration={DUR.base} delay={0} max={8}>` | Wraps each direct child in `Reanimated.View` with an `entering` builder: opacity 0→1 and translate `distance`→0, with `EASE.out`, delay `i × min(step, 480 / n)`. Runs on first mount only. | `.reduceMotion(Always)`: all present at once | yes | children ≤ 12 |
| **CountUp** | `<CountUp from={0} to={n} format={(v) => string} duration={DUR.count} tick="haptic" \| "sound" \| "both" \| "none" label={finalA11yLabel} textStyle>` | `useDerivedValue` over `timing(to, duration, EASE.out)`. `scheduleOnRN(setShown)` runs only when the rounded value changes, at most once per 33 ms. Ticks go through `motion/countTicks.ts`: haptic `tick()` at least 70 ms apart and at most 12 per run; `count-tick` sound at least 90 ms apart and at most 10 per run. No tick on the final value; the template's landing beat owns that. `fontVariant: ['tabular-nums']`, plus `minWidth` sized to the final value's width (Outfit's tnum support is unverified). The container is `accessible accessibilityLabel={label}` and the inner text is hidden, as in `recap/OnceCount.tsx:22`. | Shows `to` at once. No ticks. | yes | ≤ 30 JS renders/s |
| **ProgressRing** | `<ProgressRing from={0} to={p} size={168} stroke={12} color track duration={DUR.reveal} delay onDone>{centre}</ProgressRing>` | Svg `Circle` track plus `createAnimatedComponent(Circle)` with `strokeDasharray={C}` and `useAnimatedProps(() => ({ strokeDashoffset: C * (1 - t.value) }))`, `EASE.inOut`. The −90° start is a transform on the wrapper `View`, not an SVG transform. `p` must be a real stored fraction. `onDone` is called through `scheduleOnRN`. | Ring drawn at `to`. `onDone` fires on the next tick. | Risk W2; `.web.tsx` fallback | 1 animated prop |
| **LivingBar** | `<LivingBar from to color track height={10} radius={5} celebrateAtFull onFull>` | The fill is `scaleX` with `transformOrigin: 'left'`, `spring(to, SPRING.settle)`. A shine strip covers the top 30 % in `paper.card` at 0.25 opacity. A leading-edge spark dot goes scale 0→1→0 over 300 ms. When the fill reaches 1 and `celebrateAtFull` is set, the bar goes scaleY 1→1.25→1 with `SPRING.pop` and calls `onFull`. | Fill at `to`. No spark. | yes | 3 shared values |
| **Burst** | `<Burst seed={eventKey} origin={{x, y}} count palette={['blue','sun','mint','paper']} spread={110} power={[600, 1100]} />` | `celebrate/particles.ts` (seeded mulberry32 hashed from `seed`) precomputes each particle: angle −90° ± spread/2, speed, spin ±540°/s, shape (bar 14×6, dot 8, ring 10 with a 2-pt border, from the ILLUSTRATIONS confetti vocabulary), and colour from `colour.*` or `paper.card`. **Never** `highlight` (palette.test:530) or `lilac`. One shared `t` runs 0→1 over `DUR.burst` linearly. Each particle's worklet computes x = x0 + vx·t·(1 − 0.35t) (drag), y = y0 + vy·t + ½·1800·t², rotation, and opacity 1 until t = 0.75 then fading to 0. On finish, `scheduleOnRN(unmount)`. Drop colours that match the ground. | Renders nothing (it is decorative). | `count ≤ 24` | ≤ 56 Views, 1 driver |
| **Bloom** | `<Bloom color={colour.sun} radius={R} hold>` | Three concentric flat discs: 0.6R at 0.30, 0.85R at 0.18, 1.1R at 0.10 opacity. Scale 0.3→1 over `DUR.slow` with `EASE.out`. With `hold`, it rests at 0.92 scale; otherwise it fades out over `DUR.base`. No gradient. | Static at final scale | yes | 3 Views |
| **ChipFlight** | `const flight = useChipFlight(); flight.launch({ from: ref, to: ref, chip: <Chip …/>, onLand })`; `<FlightLayer />` mounted once at the root | Both refs are measured with `measureInWindow`. The chip appears 40 pt above the source centre at scale 0.76. Y travels `timing(…, 360, EASE.out)` and X travels `timing(…, DUR.flight, EASE.inOut)`, which together make the curved path. Scale runs `sequence(timing(1.12, 200, EASE.out), spring(1, SPRING.pop))`. On landing: `onLand()` (the target shows the real chip), `pressed()`, `play('tap')`. Launch plays `play('whoosh')`. Max 2 at once. If a measurement fails, it lands instantly. | No overlay; `onLand()` immediately | yes | 3 shared values per flight |
| **Glint** | `<Glint when={enabled} delay={700} />` inside an `overflow:'hidden'` pill | Three bands in `paper.card`, 12 % / 28 % / 12 % of the width at opacity 0.10 / 0.24 / 0.10, rotated 18°, translateX −0.4W→1.2W over 240 ms linear. **Once per mount**, the first time `when` becomes true. | Nothing | yes | 1 driver |
| **MorphButton** | `<MorphButton label busyLabel doneLabel state: 'idle' \| 'busy' \| 'done' \| 'error' tone onPress />` | idle→busy: label fades over 80 ms, then width W→56 over 220 ms with `EASE.inOut` (the **only** layout prop allowed to animate). A spinner arc (90°) rotates on its wrapper `View`, 800 ms per turn, linear, `repeat(-1)`, and only while busy. busy→done (only from a **resolved real result**, e.g. a confirmed entitlement): the arc closes to a full circle, the check path's `strokeDashoffset` goes L→0 over 160 ms with `EASE.out`, then `arrived()` and `play('save')`; hold 600 ms, then the caller continues. error: width back to W, label back; no shake, no sound, no haptic. `accessibilityState={{ busy }}`; announces `busyLabel` and `doneLabel`. | Label text swaps only | yes | spinner ≤ 30 s, then stops |
| **Page transitions** | `nav/RootNavigator.tsx:679-685` | Stack default `animation: reduced ? 'none' : 'slide_from_right'`. Full-screen flows (Convo, LiveSession, Drill, Review, DailyPractice, Wall, FirstScene) use `reduced ? 'none' : 'fade_from_bottom'`, with `animationDuration: DUR.base` where react-native-screens honours it. Tabs stay without animation. Rewrite the comment at `:682-683`. | `'none'` | web falls back to fade | native |
| **Layout** | `motion/layout.tsx`: `<Enter index from distance>`, `<Reflow>` (`LinearTransition.duration(DUR.base).easing(bezier(EASE.inOut))`), `<Exit>` (`FadeOut.duration(DUR.micro)`) | Screens use these and never import Reanimated themselves. Not inside FlatList for v1. | `.reduceMotion(Always)` | yes | — |

**AnimatedIcon contract** (`icons/AnimatedIcon.tsx`):

```tsx
<AnimatedIcon name variant size color kind trigger={number} playing={boolean} />
```

- An increasing `trigger` plays a one-shot animation.
- `playing` drives a held state.
- Icons are layered static parts from `icons/`. Motion is a transform on the wrapper per layer, or `strokeDashoffset` for draws.

| kind | Motion | Reduced |
|---|---|---|
| `ring` (bell) | rotate about the top pivot 0 → 14° → −12° → 8° → −4° → 0, durations 80/100/100/100/140, `EASE.inOut` | static |
| `fill` (bookmark) | bulk layer opacity 0→1 over `DUR.fast`, scale 1→1.18→1 with `SPRING.pop` | filled |
| `draw` (check) | `strokeDashoffset` L→0 over 260 ms `EASE.out`, ring scale 0.6→1 with `SPRING.pop` | drawn |
| `waves` (speaker) | 2 arcs, opacity 0.3↔1, 120 ms stagger, 600 ms period, **while `playing`** | still arcs |
| `flicker` (flame) | outer scaleY 1↔1.05 (origin bottom) over 1200 ms `EASE.inOut`; inner translateY 0↔−1.5 offset by 300 ms; **3 cycles per focus, then rest** | still |
| `pop` (star) | scale 0→1.25→1 with `SPRING.pop`, rotate −15°→0 | final |
| `spin` (refresh) | rotate 360° per 800 ms, linear, while `playing`; one turn per trigger | still |
| `cloudCheck` | cloud translateY 4→0 with fade over `DUR.base`, then `draw` | final |

### 4. `CelebrationHost` and `useCelebrate`

#### 4.1 Files and mounting

- `celebrate/queue.ts` (pure): types, priorities, merging, budget, TTL and holds. A module-level singleton, so stores and screens can enqueue without context.
- `celebrate/useCelebrate.ts` returns `celebrate(event)`.
- `celebrate/CelebrationHost.tsx` is rendered inside `App.tsx`'s `st.app` View after `{loaded ? … }`, as an absolute fill with `zIndex` above the shell. Alongside it: `<FlightLayer />` and `<ReduceMotionBridge />`.
- Because the Host sits **outside** `NavigationContainer`, it also covers `PreAccountOnboarding` (`App.tsx:444`).
- `celebrate/InPlace.tsx`: non-blocking overlays (`reply-accepted`, `phrase-saved`, `plan-ready`, `scene-won` in-room). Screens render these in place; they claim the same ledger and gates.

#### 4.2 Event envelope

```ts
{ type: CelebrationType; key: string; data: …; origin: 'guest' | 'account'; at: number }
```

`data` fields hold only values read back from the persisted store **after** the write resolved. The game section must make `recordActivity` awaited and have it return the credited delta: today it is fired with `void` at `ConvoScreen.tsx:571` and `nav/RootNavigator.tsx:200`.

| type | Kind | Priority | Key | Durable (never replays) |
|---|---|---|---|---|
| `purchase-confirmed` | takeover | 0 | `purchase:{transactionId}` | yes |
| `scene-won` | in-place in room, takeover after | 1 | `scene:{sessionId}:{missionId}` | no |
| `practice-complete` | takeover | 2 | `practice:{kind}:{entry.at}` | no |
| `goal-met` | takeover, or merged into practice-complete | 3 | `goal:{localDayKey}` | no |
| `streak-milestone` | takeover (replaces same-day `streak-extended`) | 4 | `milestone:{n}:{streakStartDay}` | yes |
| `streak-extended` | takeover | 5 | `streak:{localDayKey}` | no |
| `quest-complete` | takeover (merges up to 3) | 6 | `quest:{dayKey}:{questId}` | no |
| `level-up` | takeover | 7 | `level:{index}` | yes |
| `badge-earned` | takeover (merges up to 3) | 8 | `badge:{id}` | yes |
| `plan-ready` | in-place | — | `plan:{draftRevision}` | no |
| `reply-accepted` | in-place | — | `reply:{attemptId}` | no |
| `phrase-saved` | in-place | — | `saved:{phraseKey}` | no |

#### 4.3 Queue semantics

- **Burst window.** Events enqueued within 250 ms of each other, or while a sequence is running, join the current burst and are sorted by priority.
- **Merging.**
  - A milestone supersedes the same day's streak-extended.
  - Several quests become one card.
  - goal-met merges into practice-complete as its ring row when both are in the burst.
  - Several badges become one card.
- **Budget.** At most **3 takeovers** per burst. The rest become rows under "Also today" on the last card: "Quest complete: {title}", "Badge: {name}".
- **Idempotency.**
  - Extend `motion/feedbackPolicy.ts`: `FeedbackLedger` takes `constructor(limit = 128)`. The Host uses `new FeedbackLedger(256)` with key `${scopeGeneration()}:celebrate:${type}:${key}`.
  - Durable types also check and write `celebrate/ledger.ts`: `userKey('celebrated')`, `{ version: 1, keys: string[] }`, FIFO with a 512 cap. The key is written when the takeover reaches its final frame or is skipped.
  - Add `'celebrated'` to `USER_KEY_SUFFIXES` (`storage/scope.ts:111`) and to `docs/STATE_AND_STORAGE.md` (`storage/storageDoc.test.ts:216`).
  - Guest events (`origin: 'guest'`) use the in-memory ledger only. `userKey` throws without a user (`scope.ts:96-99`), and `PreAccountOnboarding.tsx` must stay free of `AsyncStorage` (`legal/policy.test.ts:833`).
- **Durable catch-up.** On Home focus, the game layer compares persisted level, badges and milestones with the `celebrated` ledger and enqueues any that were missed (for example, the app was killed mid-sequence). A missed moment plays once; a fake one never plays.
- **Holds.** The queue pauses (it does not drop) while any of these hold. TTL is 10 min, then the event is dropped.
  1. **Safety suppression.** `suppressCelebrations()` is called from `tutor/SafetyStopView.tsx`'s mount effect. It **clears** the queue, cancels the current celebration, and refuses new events while held. Producers also skip enqueueing when `stoppedBySafety(live.safety)` (`ConvoScreen.tsx:457`). This is F137.
  2. **Microphone.** `audioFocus.micLive()` or `liveRoom()` (§6.4).
  3. **Sheet.** A `Sheet` is presented: `components.tsx:1765` calls `holdCelebrations()` while `present`. The RN `Modal` would otherwise sit above the Host.
  4. **App state.** `AppState` is not `active`.
  5. **Sign-out.** `scopeGeneration()` changed. The queue is cleared.
- **Interruption.**
  - The first tap anywhere on a takeover calls `skipToEnd()`: every shared value jumps to its final value, CountUps finish, SFX players pause, and haptic timers are cancelled via `cancelHaptics()`.
  - Continue is always visible and enabled by `INPUT_READY_MS = 600`, and at t = 0 under reduced motion or VoiceOver.
  - In-place overlays are `pointerEvents="none"` and never block input.
  - Android hardware back means Continue.
  - Takeovers never auto-dismiss.
- **Background and blur (J7 spirit).** On `AppState` leaving `active`: `skipToEnd()`, stop sounds, pause the queue. On return: keep the current takeover at its final frame (no replay), then resume the next event after 300 ms. In-place overlays unmount when their anchor screen blurs.
- **Accessibility.**
  - Takeovers are `accessibilityViewIsModal`. Focus goes to the title (`accessibilityRole="header"`), and the title plus the main value is announced with `AccessibilityInfo.announceForAccessibility`.
  - In-place overlays are hidden from assistive tech, because the page already states the result.
  - Takeover content sits in a `ScrollView`, with no `numberOfLines` and no font caps (Dynamic Type).
- **iPad.**
  - The content column is centred with `maxWidth: 520` and padding from `screenInsets(width, insets.left, insets.right)` (`responsiveLayout.ts:2-6`).
  - Art stage height is `min(240, 0.3h)` on phone and `min(320, 0.3h)` when width ≥ 744.
  - Burst uses 56 particles with spread scaled by width / 390. Bloom R = 0.45 × min(w, h).
  - The footer is padded by `Math.max(insets.bottom, space(6))`, the pattern at `components.tsx` Sheet.

### 5. Full-screen templates

All templates live in `celebrate/templates/*.tsx` and share one frame, `celebrate/Takeover.tsx`. Timelines are data in `celebrate/timelines.ts`, so the beats are testable and the audition page can reuse them.

Shared rules:
- **Continue** is a `PillButton label="Continue"` (or the label named per template). It fades in from t = 400 over `DUR.fast`.
- **Glint** runs on Continue at t = 1500.
- **Reduced motion** shows the final frame at t = 0. Sound and haptic still fire once at t = 0, because they are not motion. Burst is omitted and Bloom is static.
- Copy is plain English with no em dash, en dash or middot (`copy.test.ts:44`, `copy/punctuation.test.ts:88`).

#### 5.1 ReplyAccepted (in-place on the coral recap page, `PreAccountOnboarding.tsx:436-437`)

Gate: `result.feedback.accepted && result.feedback.evidence !== 'model'`. This is the existing truth gate. No numbers are shown (onboarding bans XP, `onboarding/firstRun.test.ts:108`). The title stays "That reply works." (`:530`). For "Try this small change." nothing below plays except the existing calm settle.

| t (ms) | Element | Transform | Duration / easing | Sound | Haptic |
|---|---|---|---|---|---|
| 0 | Bloom behind the art | scale 0.3→1, rests at 0.92 | 420 `EASE.out` | | |
| 0 | Art wrapper | translateY 30→0; scale 0.9→1.06→1 | 650 `EASE.out`; `SPRING.pop` | | |
| 80 | Burst, 36 (sun, mint, blue, paper; no coral) | physics | 1400 | | |
| 120 | — | — | — | `correct` | `arrived()` (the one accepted-action haptic) |
| 150 | Title words | StaggerIn opacity, translateY 8→0 | 180 per word, 38 stagger | | |
| 300 | French card | translateY 8→0 | 260 `EASE.out` | | |
| 450 | Icon action row | StaggerIn | 60 stagger | | |
| 1200 | Glint on "Finish" | — | 240 linear | | |
| 1600 | end | | | | |

#### 5.2 PracticeComplete (ground `colour.blue`, white text, white tiles)

- Title: "Nicely done."
- Line by kind:
  - convo: "You finished a conversation."
  - drill: "You finished a drill."
  - review: "You finished your review."
  - lesson: "You finished a lesson."
  - daily: "You practised today’s phrase."
- Tiles, 1 to 3. **A tile appears only if its number exists.**

| Tile | Label | Value format | Source |
|---|---|---|---|
| XP | "XP earned" | `+{n}` | credited delta = `totalXp(after) − totalXp(before)` (`packages/core/src/levels/levels.ts:133-142`), so the daily cap of 100 is respected |
| Time | "Time" | `m:ss` under 10 min, else `{m} min` | `ActivityEntry.activeMs` of the entry just written (`progress/activity.ts:53`) |
| Count, convo | "Lines you said" | n | `lines.length` (`RecapScreen.tsx:317`) |
| Count, drill | "Got right" | n | `summariseDrill(s).resolved` (`DrillScreen.tsx:1620`) |
| Count, review | "Remembered" | n | `recalled.current` (`ReviewScreen.tsx:109-116`) |
| Count, lesson | "Words used" | n | `summary.wordsProduced.length` (`nav/RootNavigator.tsx:200-202`) |
| Count, daily | "Days practised" | n | `loadActiveDays()` count (`progress/activity.ts:338`) |

If the credited XP is 0 because of the cap, drop the XP tile and add the line "You reached today’s XP limit. This practice still counts for your streak."

| t | Element | Transform | Duration / easing | Sound | Haptic |
|---|---|---|---|---|---|
| 0 | Ground | opacity 0→1 | 180 `EASE.out` | `whoosh` | |
| 0 | Art (kind art) and Bloom (sun) | scale 0.6→1; Bloom 0.3→1 | `SPRING.pop`; 420 | | |
| 120 | Burst, 36 | | 1400 | `complete` | `celebrate()` |
| 200 / 260 | Title / line | opacity, translateY 12→0 | 260 `EASE.out` | | |
| 420 / 560 / 700 | Tiles 1–3 | scale 0.9→1, opacity | `SPRING.pop`, `STAGGER.tiles` | | |
| tile land | CountUp per tile | number | 900 `EASE.out`; ticks on the XP tile only | `count-tick` (throttled) | `tick()` (throttled) |
| 1300 | Goal ring row (merged goal-met) | ProgressRing `before`→`today/goal` | 650 `EASE.inOut` | | `thump()` at close |
| 1600 | XP tile star | AnimatedIcon `pop` | `SPRING.pop` | | |
| 2400 | end | | | | |

#### 5.3 StreakExtended (ground `paper.ground`, coral and sun flame)

- Hero `{n}` in `type.hero`, label "day streak".
- Line: "You practised today."
- Lifetime line: "{total} days you have practised". This reuses the `progress/dayCount.ts` phrasing, so a reset never shows only 0.
- Data: `useStreak()` (core streak module), which gives days, the 7-day week states and the freeze state. Lifetime count from `loadActiveDays()`.

| t | Element | Transform | Duration / easing | Sound | Haptic |
|---|---|---|---|---|---|
| 0 | Flame (outer) | scale 0→1.15→1 | `SPRING.pop` | `streak` | `thump()` |
| 80 | Flame (inner) | scaleY 0.2→1, origin bottom | `SPRING.pop` | | |
| 160 | Sparks Burst, 12 (sun, coral), upward, spread 50 | | 900 | | |
| 300 | Old number | translateY 0→−24, opacity →0 | 180 `EASE.in` | | |
| 420 | New number | translateY 24→0 | `SPRING.pop` | | `arrived()` |
| 520 | "day streak" | opacity | 260 | | |
| 600 | Week dots (7) | past days static; today's dot scale 0.6→1.2→1, mint fill, check `draw` | `SPRING.pop` + 260 | | `tick()` at 700 |
| 900 | Lines | StaggerIn | 60 | | |
| 1200–4800 | Flame idle | `flicker` × 3 | | | |

#### 5.4 StreakMilestone, n in {7, 30, 100, 365} (ground `colour.coral`, white text, sun and white flame)

- Hero `{n}`, label "days in a row".
- Line by milestone:
  - 7: "A whole week of French."
  - 30: "A month of French, one day at a time."
  - 100: "One hundred days of French."
  - 365: "A full year of French."
- Lifetime line as in 5.3.

| t | Element | Transform | Duration / easing | Sound | Haptic |
|---|---|---|---|---|---|
| 0–420 | Flame ignite | as 5.3 | | `streak` | `thump()` |
| 500 | Medal ring around the flame | ProgressRing 0→1 (white) | 650 `EASE.inOut` | | |
| 1150 | Ring closes: Bloom (sun) and Burst 48 | | 420 / 1400 | `badge` | `celebrate()` |
| 1150 | Hero number | scale 0.6→1 | `SPRING.pop` | | |
| 1350 | Lines | StaggerIn | | | |
| 2600 | end | | | | |

#### 5.5 GoalMet, standalone (ground `colour.mint`, ink text, ink ring on a white track)

- Title: "Daily goal reached".
- Ring centre: `{m} min`.
- Line: "Your goal is {goal} minutes a day."
- Data: the sum of today's `activeMs` over entries whose `localDayKey(at)` is today (`levels.ts:144-150`, `activity.ts:53`). Goal from `dailyGoalMin` (`profile/dailyGoal.ts`; renamed by the onboarding daily-goal decision).

| t | Element | Transform | Duration / easing | Sound | Haptic |
|---|---|---|---|---|---|
| 0 | Ring | `fractionBefore`→1 | 650 `EASE.inOut` | | |
| 0 | Centre CountUp | minutes before→after | 650 | | `tick()` |
| 650 | Bloom (sun) and Burst 24 | | 420 / 1400 | `complete` | `arrived()` |
| 800 | Title and line | StaggerIn | | | |
| 2100 | end | | | | |

#### 5.6 QuestComplete (ground `colour.sun`, ink text, chest art)

- Title: "Quest complete".
- One row per quest, using the quest title from the quests store, with a check `draw`.
- Progress line: "{done} of 3 quests done today". When all three are done: "All three quests done today."

| t | Element | Transform | Duration / easing | Sound | Haptic |
|---|---|---|---|---|---|
| 0 | Chest | translateY −40→0 | `SPRING.pop` | `whoosh` | |
| 300 / 380 | Lid wobble | rotate 6° / −6° | 80 each | | `tick()` ×2 |
| 600 | Lid opens | rotate 0→−28°, translateY −10 | `SPRING.pop` | `quest` | `thump()` |
| 620 | Bloom (blue) and Burst 28 (blue, coral, paper) from the chest mouth | | 420 / 1400 | | |
| 700 | Quest rows | StaggerIn; check `draw` | 60 / 260 | | `arrived()` at 760 |
| 2300 | end | | | | |

#### 5.7 LevelUp (ground `colour.blue`, white text, sun crest)

- Title: "Level {index + 1}".
- Name: the level name, which the game section may rename.
- Line: "{xpAway} XP to {next.name}", or "You reached the top level."
- Data: `levelFor(before)` and `levelFor(after)` (`levels.ts:47-59`).

| t | Element | Transform | Duration / easing | Sound | Haptic |
|---|---|---|---|---|---|
| 0 | LivingBar (white on `segmentPending.blue`) | previous %→1 | 520 `EASE.inOut` | | |
| 0 | Crest and Bloom (sun) | scale 0.4→1 | `SPRING.pop` / 420 | | |
| 200 | — | | | `levelup` | `celebrate()` |
| 520 | Bar full | scaleY 1→1.25→1 | `SPRING.pop` | | |
| 600 | Old name out, new name in | translateY −24 out; 24→0 in | 180 `EASE.in`; `SPRING.pop` | | |
| 600 | Burst 48 | | 1400 | | |
| 900 | Next line | opacity | 260 | | |
| 2400 | end | | | | |

#### 5.8 BadgeEarned (ground `paper.ground`, medal art)

- Title: `{badge.name}`.
- Line: `{badge.description}`, for example "You practised on 7 different days."
- Up to 3 medals in a row when merged.

| t | Element | Transform | Duration / easing | Sound | Haptic |
|---|---|---|---|---|---|
| 0 | Medal | translateY −60→0; rotate −12°→0 | `SPRING.pop`; `SPRING.settle` | | |
| 350 | Ribbon | scaleY 0→1, origin top | 260 `EASE.out` | `badge` | `arrived()` |
| 420 | Medal face | Glint (circular mask) | 300 linear | | |
| 500 | Bloom (sun) | | 420 | | |
| 600 | Text | StaggerIn | | | |
| 1800 | end | | | | |

#### 5.9 PurchaseConfirmed (ground `colour.mint`, `wall/WallScreen.tsx:323-334`)

- Fires only when `wallSuccess(confirmedGrant, latestCatalogue())` is non-null, that is, a **confirmed entitlement**. No countdown, no "limited", no urgency.
- Copy stays as is: "Your plan is ready", `{success.name}`, "Your speaking time each month.", `perWeekLine`.
- Footer stays "Start speaking".

| t | Element | Transform | Duration / easing | Sound | Haptic |
|---|---|---|---|---|---|
| −220–0 | Plans-page MorphButton busy→done | check draw | 160 | `save` | `arrived()` |
| 0 | Mint ground | opacity | 180 | | |
| 200 | Burst 36 (blue, sun, paper) | | 1400 | `complete` | `celebrate()` |
| 200 | HeroNumber CountUp 0→`minutes` | | 900 `EASE.out` | `count-tick` | `tick()` |
| 400 | Name and lines | StaggerIn | | | |
| 1800 | end | | | | |

**scene-won** happens inside a live room, so it plays in place only: the task-list checks `draw`, and the mission card enters with `SPRING.settle`. There is no sound and no haptic, because the microphone is live. The takeover version (place art, Bloom, Burst 36, `complete`, `celebrate()`) is held until `releaseAudioSession` and then plays before the recap's first page.

### 6. Sound

#### 6.1 Deterministic synthesis: `scripts/sfx/`

- `scripts/sfx/synth.mjs` (pure, no I/O):
  - Additive sine and triangle partials with ADSR or exponential decay, plus seeded noise through an RBJ biquad band-pass or low-pass.
  - PRNG is mulberry32, seeded by FNV-1a of `${id}:${RECIPE_VERSION}`. No `Math.random` and no clock.
  - 44.1 kHz, Float64 internally. 3 ms raised-cosine fade in and 8 ms fade out.
  - Peak-normalised to each recipe's target, then 16-bit with seeded TPDF dither.
- `scripts/sfx/recipes.mjs`: the table below. All pitches are in C-major pentatonic (C D E G A), so sounds that overlap still agree.
- `scripts/sfx/generate.mjs`:
  - Renders WAV files (not committed).
  - Encodes with `ffmpeg -nostdin -v error -y -i x.wav -c:a aac -b:a 96k -ac 1 -ar 44100 -map_metadata -1 -fflags +bitexact -flags:a +bitexact -movflags +faststart apps/mobile/assets/sfx/<id>.m4a`. This follows the precedent at `scripts/build-onboarding-audio.mjs:52`.
  - Measures `ebur128` momentary-max loudness for information.
  - Writes `apps/mobile/assets/sfx/manifest.json` with id, durationMs, peakDbfs, momentaryMaxLufs, wavSha256, m4aSha256, approvedOn and approvedWavSha256.
  - Writes the generated `apps/mobile/src/sound/sfxManifest.ts` (`SFX_APPROVED`, `SFX_DURATION_MS`).
- Loudness: the big sounds land around −16 LUFS momentary max, ticks at or below −26. The peak targets are below.

| id | Notes and partials | Length | Envelope | Peak dBFS | Plays on |
|---|---|---|---|---|---|
| `tap` | triangle E6 1318.5 + sine 2637 (0.25) | 40 ms | A 1, τ 12 | −18 | chip landing, IconButton toggles |
| `select` | sine G5 784 + D6 1174.7 (0.5) | 90 ms | A 2, τ 35 | −14 | option tile selected |
| `correct` | C6 1046.5 at 0, E6 1318.5 at 70; partials 1, 2 (0.35), 3 (0.12) | 300 ms | A 3, τ 90 | −8 | reply accepted, drill right |
| `nearly` | G5 784 then A5 880 at 90 ms (rising, never descending) | 220 ms | τ 70 | −12 | drill typo, "close" |
| `complete` | arpeggio C5, E5, G5, C6 at 0/70/140/210 ms; shimmer C7 2093 (0.15) at 260 ms | 760 ms | τ 160 / 300 | −6 | practice complete, goal met, purchase |
| `streak` | noise band-pass sweep 400→2400 Hz (Q 1.2), 0–220 ms; chord D5, A5, D6 from 160 ms, ±4 cent detune | 820 ms | A 20, τ 300 | −6 | streak ignite |
| `levelup` | G4, C5, E5, G5 at 0/60/120/180 ms; chord C6, E6, G6 at 260 ms, 5 Hz ±6 cent vibrato | 1150 ms | S 0.6, R 300 | −5 | level up |
| `quest` | 2 clacks (noise 18 ms, LP 1.2 kHz) at 0 and 110 ms; A6, C7, D7, E7 at 220/260/300/340 ms | 680 ms | τ 80 | −7 | chest open |
| `badge` | bell E6 with partials 1, 2.76 (0.4), 5.40 (0.18), 8.93 (0.06); C6 under it from 40 ms | 950 ms | τ 380 | −7 | badge, milestone medal |
| `save` | sine glide 900→620 Hz over 45 ms, plus a 4 ms noise click (LP 3 kHz, 0.15) | 140 ms | τ 50 | −10 | phrase saved, account saved, reminder set |
| `count-tick` | sine 2400 Hz | 18 ms | A 0.5, τ 5 | −24 | CountUp |
| `whoosh` | noise band-pass sweep 300→1500 Hz (Q 0.9) | 300 ms | A 120, R 180 | −16 | takeover entrance, chip launch |

**Audition and approval (decision 9).**

- `node scripts/sfx/generate.mjs --audition` writes `artifacts/sfx-audition/index.html`. Add `artifacts/sfx-audition/` to `.gitignore`.
- The page has one card per sound: play button, where it plays, length and peak.
- It also has "In context" reels that replay each template's sound and haptic beats from `celebrate/timelines.ts` (inlined as JSON at generation time), for example PracticeComplete: `whoosh` at 0, `complete` at 120, `count-tick` × 10 every 90 ms from 560.
- The founder listens. The agent then records his approval, given **in chat**, in `scripts/sfx/approvals.json` as `{ "<id>": { "on": "YYYY-MM-DD", "wavSha256": "<hash>" } }`.
- `sfx.native.ts` and `sfx.web.ts` play only ids where `SFX_APPROVED[id]` is true. An unapproved or re-recipe'd sound is silent, so a sound that has not been approved cannot ship.

#### 6.2 Native playback seam (`sound/sfx.native.ts`)

```text
play(id):
  1. if !SFX_APPROVED[id], return
  2. if !sfxGate.allowed()
       (soundEnabled(), no mic hold, no live hold, no voice hold,
        AppState active, not safety-suppressed), return
  3. throttle: at most 4 SFX per second in total; count-tick at least 90 ms apart
  4. await audioSession.enterSfx()        (serialised; see 6.4)
     then check the gate again             (a hold may have appeared meanwhile)
  5. p = players.get(id) ?? createAudioPlayer(SOURCES[id])   (lazy, one player per id)
     void p.seekTo(0); p.play()            (inside try/catch; swallow)
```

- `warmSfx(['complete','correct','select','count-tick','save'])` runs from the Host after the first user interaction (native only).
- When `AppState` leaves `active`, all SFX players pause.
- `SOURCES` (`require('../../assets/sfx/<id>.m4a')`) lives in `sound/sfxSources.ts`, which only the platform files import.

#### 6.3 Web and Node

- `sound/sfx.web.ts` has the same gate. It calls `createAudioPlayer(SOURCES[id])` lazily inside the first gesture-driven play, with `downloadFirst` left false. That gives a same-origin `new Audio(uri)`, which the CSP allows (`ExpoAudio.web.js:8-13`). **Never** call `preload` or `preloadAsync` (that path creates a `blob:` URL, `AudioModule.web.js:38-48`). Swallow `play()` rejections (autoplay policy). There is no mode switching (`setAudioModeAsync` is a no-op on web, `AudioModule.web.js:27`).
- `sound/sfx.ts` is the Node twin: the same exports, all no-ops.

#### 6.4 Audio-mode handoff and focus holds

`sound/audioModes.ts` (pure) defines three full modes:

```ts
VOICE_MODE  = { playsInSilentMode: true,  interruptionMode: 'mixWithOthers', allowsRecording: false, shouldPlayInBackground: false, shouldRouteThroughEarpiece: false }
RECORD_MODE = { ...VOICE_MODE, allowsRecording: true }
SFX_MODE    = { playsInSilentMode: false, interruptionMode: 'mixWithOthers', allowsRecording: false, shouldPlayInBackground: false, shouldRouteThroughEarpiece: false }
```

- On iOS, `SFX_MODE` maps to `.ambient`. It mixes with music and **obeys the silent switch** (`AudioModule.swift:781-786`).
- `VOICE_MODE` keeps today's voice behaviour: `.playback` with `mixWithOthers`, which is the Swift default at `AudioRecords.swift:5`.

`sound/audioSession.ts` is the **only** importer of `setAudioModeAsync`:

- It provides `enterVoicePlayback()`, `enterRecording()`, `leaveRecording()` (which goes to `VOICE_MODE`), `enterSfx()` and `markUnknown()`.
- Mode changes are serialised on one promise chain and skipped when the session is already in the target mode.
- `enterSfx()` refuses while any hold exists.

`sound/audioFocus.ts` (pure) provides:

- `holdMic()`, `holdVoice()`, `holdLive()` (each returns a releaser that is safe to call twice);
- `micLive()`, `voiceBusy()`, `liveRoom()`;
- `subscribe(listener)`.

`hapticPreference.ts:7-18` then becomes `hapticsEnabled = enabled && !micLive() && !liveRoom()`. `silenceRecordingHaptics` stays as an alias of `holdMic`, so `GuestRecording.tsx:5,95` keeps working.

`sound/useVoiceHold.ts` provides `useVoiceHold(playing)`, which holds while a player's status reports `playing`.

Every path that must change:

| File:line | Today | Change |
|---|---|---|
| `onboarding/PreAccountOnboarding.tsx:328` | `player.play()` with no mode | `await enterVoicePlayback()` first; `useVoiceHold(playback.playing)` (`:195`) |
| `onboarding/OnboardingFlow.tsx:187` | no mode | same; status `:174` |
| `tabs/TutorTab.tsx:112` | no mode | same; status `:101` |
| `tabs/ProfileTab.tsx:155` | no mode | same; status `:139` |
| `speech/tutorVoice.ts:66-80` (`speak`) | expo-speech, no mode | `enterVoicePlayback()` before `Speech.speak`; `holdVoice()` released in `onDone`/`onError`/`stop()` |
| `daily/DailyCard.tsx:73` | `setAudioModeAsync({…playsInSilentMode:true…})` | `enterVoicePlayback()`; hold on status `:38` |
| `missions/ListeningPreview.tsx:104` | same | same |
| `practice/recordedPlayer.ts:94` | `playWhenCurrent(…, () => setAudioModeAsync(…))` | pass `enterVoicePlayback`; the DI key in `recordedPlayer.test.ts:46` may keep its name; hold on `:40` |
| `daily/DailyPracticeScreen.tsx:65,91,112,116,120,131` | partial modes (`:91,116,120` select `.ambient`) | `enterRecording()` plus `holdMic()` at record; `leaveRecording()` on every exit; `enterVoicePlayback()` at `:131` |
| `recap/PrivatePractice.tsx:47,63,88,89,95,102,113` | partial modes | same pattern |
| `DrillScreen.tsx:598,608` | full modes | `leaveRecording()` / `enterRecording()`; `holdMic()` around `recorder.record()` at `:610` |
| `drill/SpokenAttempt.tsx:25,59` | full modes | same |
| `soundcheck/SoundCheckScreen.tsx:107,156,181,188` | full modes | same |
| `onboarding/GuestRecording.tsx:37,49,83,92,112` | partial modes | `enterRecording()` / `leaveRecording()`; keep `silenceRecordingHaptics()` at `:95` |
| `live/globals.native.ts:29-39` | LiveKit `start`/`stopAudioSession` | `holdLive()` in `ensureAudioSession`; release plus `markUnknown()` in `releaseAudioSession` |

This handoff has three effects:
- The silent switch is honoured for SFX only.
- Voice stays audible in silent mode on every voice path, which also fixes the latent `.ambient` partial-mode trap.
- No SFX ever changes the mode while a recorder or a LiveKit room is open, so no recorder is stopped by `allowsRecording:false`.

#### 6.5 Settings

- New `sound/soundPreference.ts`, mirroring `hapticPreference.ts`: key `@luvani/interaction-sound/v1`, default **on**.
- Loaded in `App.tsx:682` next to `loadHapticPreference`.
- `settings/SettingsScreen.tsx`, in the "Interaction" card (`:862-871`), adds a second `SwitchRow` under "Haptic feedback":
  - `title="Sound effects"`
  - `sub="Short sounds when you finish something. They follow your phone’s silent switch and stay quiet while you speak or listen."`
  - `accessibilityLabel="Sound effects"`
  - The same saving and trouble pattern, with the message "That preference could not be saved. Try again."

### 7. Haptic choreography

New functions in `motion/haptics.native.ts`, each native call with its own `.catch(() => {})`:

- `tick()`: `selectionAsync`, throttled to at least 60 ms apart.
- `thump()`: `impactAsync(Medium)`.
- `celebrate()`: `notificationAsync(Success)` at 0, `impactAsync(Medium)` at +140, `impactAsync(Light)` at +280. Each beat re-checks `hapticsEnabled()`; the timers are cancellable.
- `cancelHaptics()`.

Each has a no-op twin in `motion/haptics.ts`. `celebrate` overturns the "never a pattern" comment at `haptics.native.ts:11`.

| Moment | Haptic | Sound |
|---|---|---|
| Any press (default) | `pressed()` | none |
| Choice, toggle, tab change | `tapSettled()` | `select` on option tiles only |
| Chip lands (ChipFlight) | `pressed()` | `tap` |
| CountUp step | `tick()` (throttled, at most 12) | `count-tick` (at most 10) |
| Reply accepted (onboarding) | `arrived()` (unchanged gate) | `correct` |
| Drill right / typo / miss | `tapSettled()` / `soft()` / none | `correct` / `nearly` / none |
| Phrase saved (`RecapScreen.tsx:176`) | `arrived()` (unchanged) | `save` |
| Other saves (`DailyCard.tsx:89`, `DrillScreen.tsx:1304`, `StarterContinuation.tsx:89`) | `tapSettled()` | `save` |
| Reminder set, account saved (MorphButton done) | `arrived()` | `save` |
| Plan ready (setup, not learning) | `tapSettled()` at ring close | `select`; no Burst |
| Practice complete | `celebrate()` | `complete` |
| Goal met | `arrived()` | `complete` (none when merged) |
| Streak extended | `thump()` at 0, `arrived()` at 420 | `streak` |
| Streak milestone | `thump()`, then `celebrate()` at 1150 | `streak`, `badge` |
| Quest complete | `tick()` ×2, `thump()`, `arrived()` | `whoosh`, `quest` |
| Level up | `celebrate()` | `levelup` |
| Badge earned | `arrived()` | `badge` |
| Purchase confirmed | `arrived()` (button), `celebrate()` | `save`, `complete` |
| Anything while the mic is live or a LiveKit room is open | none | none |
| Error, refusal, safety stop | none | none |

### 8. Test rewrite

#### 8.1 Tests that block this work and what changes

**Pinned titles are never renamed.**

| Test | Line | Pinned? | Change |
|---|---|---|---|
| `motion.test.ts` "no Animated.timing runs without useNativeDriver: true" | :72 | no | keep (legacy RN `Animated`) |
| `motion.test.ts` "the one spring is the press, it lives in motion.ts at the STYLE numbers, and it crosses to the native driver everywhere but the web" | :91 | **F597** | keep the title. New assertions: no `Animated.spring(` anywhere; `motion/tokens.ts` has `press: { stiffness: 439, damping: 29.3, mass: 1 }`; `motion.ts` `pressTo` calls `spring(to, SPRING.press, reduced)` and lands `value.value = to` when reduced; `PRESS_SCALE = 0.97`; `NATIVE_DRIVER` still exported; `stiffness:` appears only in `tokens.ts` |
| "no animated component is built over an SVG or a layout prop" | :117 | no | `createAnimatedComponent` only in `motion/ProgressRing.tsx`, `motion/MorphButton.tsx`, `icons/AnimatedIcon.tsx`, `celebrate/art/*`, `tutor/VoiceOrb.tsx`; `useAnimatedProps` keys ⊆ {strokeDashoffset, opacity, fillOpacity, strokeOpacity} |
| "no interpolation is handed to a geometry or layout prop" | :136 | no | keep; add: `useAnimatedStyle` returning `width\|height\|top\|left\|right\|bottom\|margin*\|padding*` only in `motion/MorphButton.tsx` |
| "a glyph moves nothing at all" | :259 | no | keep (`glyphs.tsx`, `nav/icons.tsx` stay still; motion lives in `icons/AnimatedIcon.tsx`) |
| "the files that animate are the orb, the highlighter and the pending list, and nothing new" | :295 | no | replace the body with rules 1 and 2 below; the legacy list may only shrink |
| "the tab bar is still: no wash, no lift, no animation" | :304 | no | keep (tab bar stays still; ties to pinned `nav/tabBar.test.ts:138`, F600) |
| `surfaceContract.test.ts` J7 "decorative scenes are static even when a mounted tab is not focused" | :199 | J7 | keep; `\bAnimated\b` does not match `<AnimatedIcon` |
| J12 "nothing hand-rolls the reduce-motion check any more" | :280 | J12 | keep the title; add assertions: no `useReducedMotion`, no `ReduceMotion.System`, `ReducedMotionConfig` only in `motion/ReduceMotionBridge.tsx` |
| F569 shadow | :170 | yes | unchanged (the glow is a ring layer) |
| F407 "the design doc and tabs agree on static greetings, picture-free daily French and one Speak primary — F407" | :2134-2138 | **F407** | change the regex to `/voice orb, shared press, motion primitives, celebration host and bounded\s+state feedback animate/` |
| `motion/feedbackPolicy.test.ts` | :11-14 | no | keep the `FEEDBACK_MS` bounds; add "a celebration lets the learner act within 600 ms and ends within 2600 ms" against `celebrate/timelines.ts` |
| `motion/haptics.test.ts` "a press is a light impact, a choice is a selection tick, a hint is soft, and the web half stays silent" | :18-38 | **F597** | `.catch` count 4 → **9**; assert `tick`, `thump`, `celebrate`, `cancelHaptics` exist in both halves; keep the DrillScreen `tapSettled()` and Press assertions |
| `components.test.ts` "every tappable part presses through one spring: 0.97, stiffness 439, damping 29.3, released on lift, instant under reduced motion" | :684-722 | **F597** | regexes become `pressTo\(scale, depth === 'tile' \? PRESS_SCALE_TILE : PRESS_SCALE, reduced\)`, `<Reanimated\.View style=\{\[style, pressStyle\]\}>`, the import `PRESS_SCALE, PRESS_SCALE_TILE, pressTo, useReduceMotion`, and the reduced branch `value\.value = to` |
| `components.test.ts` highlighter :431, skeleton :782, sheets :780 | | pinned | unchanged (no shimmer, no pen draw, Sheet stays RN `Animated`) |
| `art/registry.test.ts:149` | | F570/F599 | unchanged (`art/flat` stays generated and still) |
| `layout.test.ts:120` F388 | | pinned | unchanged (`layout.tsx` drives nothing) |
| `tabs/HomeTab.test.ts:121` "the greeting is static…" | | pinned | `SCREEN.includes('Animated')` → `/\bAnimated\./.test(SCREEN)`; keep the setInterval / setTimeout / requestAnimationFrame bans |
| `tabs/TutorTab.test.ts:121`, `RecapScreen.test.ts:100` | | no | `'Animated'` substring → `/\bAnimated\./` |
| `revamp/stage3.test.ts:86-87` "recap stories…" | | pinned | rebuild `OnceConfetti` and `OnceCount` on Burst and CountUp (names kept); replace `useNativeDriver:true` with `/<Burst\b/` and `clearInterval` with `/<CountUp\b/`; keep `useReduceMotion(true)`, `used.current=true`, `pointerEvents="none"`, `no-hide-descendants` |
| `storage/scope.test.ts`, `storageDoc.test.ts:216` | | | pass once `'celebrated'` is added to `scope.ts` and the doc |

#### 8.2 The new rule set (motion.test.ts and new tests)

1. **Engines.** Only these may import `react-native-reanimated` or `react-native-worklets`: `motion/**`, `celebrate/**`, `icons/AnimatedIcon.tsx`, `tutor/VoiceOrb.tsx`, and `components.tsx` (where Reanimated identifiers are allowed only inside the `Press` region). Screens compose primitives and never import an engine.
2. **Legacy RN `Animated`**, imported from `'react-native'`, is an exact list that may only shrink: `components.tsx` (Sheet), `motion.ts`, `motion/Feedback.tsx`, `tutor/VoiceOrb.tsx`, `onboarding/ChoiceCard.tsx`, `onboarding/NextButton.tsx`, `onboarding/OnboardingMotion.tsx`.
3. **Reduced motion.** Every file in rule 1 or 2, except `tokens.ts` and `drive.ts`, calls `useReduceMotion(` or receives `reduced` from a caller that does.
4. **Loops.** `repeat(…, -1` and `Animated.loop(` appear only in `tutor/VoiceOrb.tsx`, `motion/MorphButton.tsx` and `icons/AnimatedIcon.tsx`, and each of those files references `paused|playing|useIsFocused|AppState`.
5. **One door to the engine.** `with(Timing|Spring|Delay|Sequence|Repeat|Decay)\(` appears only in `motion/drive.ts`; every `spring(` call passes `SPRING.<name>`.
6. **SVG and layout.** As in §8.1: `useAnimatedProps` is limited to dash offsets and opacity, and layout props animate only in `MorphButton`.
7. **Test isolation.** No `*.test.ts` imports a module that imports Reanimated, Worklets, expo-audio or expo-haptics.
8. **Audio.** Enforced in a new `sound/audioSession.test.ts`:
   - only `sound/audioSession.ts` imports `setAudioModeAsync`;
   - every file calling `.play()` on an expo-audio player, or `Speech.speak(`, references `enterVoicePlayback`, `playWhenCurrent` or `useVoiceHold`;
   - every file calling `.record()` references `holdMic` or `silenceRecordingHaptics`.
9. **Pure-module tests.**
   - `celebrate/queue.test.ts`: priority order, merges, the 3-takeover budget, TTL, safety clear, holds, ledger dedupe.
   - `celebrate/particles.test.ts`: same seed gives the same particles; count ≤ `BURST_MAX`; no `highlight` or `lilac`.
   - `celebrate/timelines.test.ts`: Continue ≤ 600 ms; end ≤ 2600 ms; every sound is an `SfxId` and every haptic is a known name.
   - `motion/tokens.test.ts`: spring derivations within ±1 of the formula.
   - `motion/countTicks.test.ts`.
   - `sound/audioFocus.test.ts`.
   - `sound/sfxGate.test.ts`.
   - `sound/sfxAssets.test.ts`: re-synthesise through `scripts/sfx/synth.mjs` and compare `wavSha256`; every m4a exists, is ≤ 30 KB, and matches `m4aSha256`; `SFX_IDS` equals the manifest ids.

Proposed ledger entries (P2). Take ids from **F716** onward at filing time, in this order, because other sections file too:

| Entry | verified-by |
|---|---|
| M1 "Motion runs on one engine with live reduced motion" | `nothing asks Reanimated for the system reduce-motion setting`, `every file that moves reads reduced motion from motion.ts` |
| M2 "Celebrations queue, dedupe, yield to safety and never hold input past 600 ms" | queue and timelines titles |
| M3 "Sound effects follow the silent switch and never touch a live microphone" | audioSession and sfxGate titles |
| M4 "Every recorder and live room silences haptics" | |
| M5 "Approved sounds only" | sfxAssets title |

### 9. DESIGN.md rewrite (outline)

- **Motion** (replaces `DESIGN.md:696-760`). The opening sentence must be exactly: "The voice orb, shared press, motion primitives, celebration host and bounded state feedback animate." This is what F407 matches. Subsections:
  1. **Principles.** Motion answers a real event. Content is never withheld. Input is never blocked past 600 ms. Reduced motion shows the final frame and is watched live through `motion.ts` and the Reanimated bridge.
  2. **Tokens.** The §2 table.
  3. **The press.** Keep the derivation table; add tile depth 0.95 and the selected glow ring.
  4. **Primitives.** One line each.
  5. **Celebrations.** The Host, priorities, the 3-per-burst budget, holds (safety, microphone, live room, sheet, background); a safety stop gets nothing.
  6. **Loops.** The live orb, a busy MorphButton, held icon states, and the Home flame (3 flickers per focus).
  7. **What never moves.** Tab bar, greeting, highlighter, skeleton, layout primitives, the flat drawings themselves, and legal or consent text.
  8. **Haptics.** The §7 table.
  9. **Sound.** Ids, approval, silent switch, never during microphone or voice.
  10. **Enforcement.** The §8.2 rules.
- **Shadow** (`:276-285`). Keep "No interface shadow." Add: "The selected glow is a translucent ring layer, not a shadow. The live microphone glow remains the only shadow."
- **Illustrations** (`:454-519`).
  - The generated flat drawings stay still and are animated only through wrappers.
  - Add a subsection, "Celebration art in code": the flame, chest, medal and crest are flat vectors in the one-illustrator style, built from layered parts. They move by wrapper transforms or dash offsets only, are decorative, and use only `colour.*` and `paper.*` tokens.
  - Replace the last line at `:518-519` with "Illustrations stay still; their wrappers move".
- **Completion moment** (`:649-654`): "No score or percentage in the room. The win shows in place; confetti and sound wait until the room closes."
- **Video review paragraph** (`:789-792`): delete "No animation library … audio". Keep "No fake progress, punitive mascot or artificial processing delay".
- **Onboarding** (`:807`): "No loops or blocking celebrations" becomes "No blocking celebrations; controls answer within 600 ms". The onboarding section owns the rest of that paragraph.
- **`App.tsx:22-24`**, the MOTION line of the direction contract: "MOTION: Reanimated through motion/ primitives; transform, opacity and dash offsets; reduce motion renders the final frame; celebrations are real, skippable and never block for more than 600 ms."

### 10. Acceptance checks

| # | Check |
|---|---|
| N1 | `npm ls` shows reanimated 4.5.1 and worklets 0.10.1; the fingerprint differs before and after (hashes recorded); the dev client and staging are installed; the gear is gone |
| N2 | Reduce Motion turned on **during** PracticeComplete: everything jumps to its final frame, Continue stays, and a later StaggerIn shows content at once |
| S1 | Silent switch on: no SFX. "Hear" plays at full volume on PreAccountOnboarding, the TutorTab sample, the ProfileTab sample, DailyCard, the Practice recorded line and Drill TTS. Silent switch off: SFX audible |
| S2 | Music app playing: SFX mix in and the music continues |
| S3 | While each of the 6 recorders and a live room are active: no SFX and no haptic; every recording completes, so no recorder is stopped by a mode change |
| C1 | Screen recording at 30 fps: Continue is visible and enabled by frame 18 (600 ms); the first tap reaches the final frame |
| C2 | Background the app mid-celebration and return: final frame, no replay. Kill after LevelUp and relaunch: no replay |
| C3 | Safety stop in Convo: no celebration, sound or haptic, and the queue is empty afterwards |
| P1 | Perf Monitor UI frame rate ≥ 58 fps during PracticeComplete with 36 particles on an iPhone 12 class device, and with 56 on the iPad; the JS thread is never blocked over 50 ms at takeover mount |
| A1 | VoiceOver: title announced, focus on the heading, Continue reachable, CountUp reads only its final value. Largest Dynamic Type size: the takeover scrolls and nothing is truncated |
| W1 | `npm run build:web` passes; on the served preview, zero CSP violations and no `blob:` media requests; SFX play after a tap |
| W2 | ProgressRing draws on web (otherwise ship the `.web.tsx` fallback) |
| G1 | The gate is green, floors are re-blessed, and the IMPLEMENTATION_EVIDENCE bullet is added |

### Files touched

**Create**

- `apps/mobile/src/motion/`: `tokens.ts`, `tokens.test.ts`, `drive.ts`, `ReduceMotionBridge.tsx`, `StaggerIn.tsx`, `CountUp.tsx`, `countTicks.ts`, `countTicks.test.ts`, `ProgressRing.tsx`, `LivingBar.tsx`, `Burst.tsx`, `Bloom.tsx`, `ChipFlight.tsx`, `FlightLayer.tsx`, `Glint.tsx`, `MorphButton.tsx`, `layout.tsx`
- `apps/mobile/src/celebrate/`: `queue.ts` and test, `particles.ts` and test, `timelines.ts` and test, `ledger.ts`, `useCelebrate.ts`, `CelebrationHost.tsx`, `InPlace.tsx`, `Takeover.tsx`, `templates/{ReplyAccepted,PracticeComplete,StreakExtended,StreakMilestone,GoalMet,QuestComplete,LevelUp,BadgeEarned,PurchaseConfirmed}.tsx`, `art/{Flame,Chest,Medal,Crest}.tsx` (animation contract here; drawing per the art section)
- `apps/mobile/src/sound/`: `sfxIds.ts`, `sfx.ts`, `sfx.web.ts`, `sfx.native.ts`, `sfxSources.ts`, `sfxManifest.ts` (generated), `sfxGate.ts` and test, `soundPreference.ts`, `audioModes.ts`, `audioSession.ts` and test, `audioFocus.ts` and test, `useVoiceHold.ts`, `sfxAssets.test.ts`
- `apps/mobile/src/icons/AnimatedIcon.tsx`
- `scripts/sfx/`: `synth.mjs`, `recipes.mjs`, `generate.mjs`, `approvals.json`
- `apps/mobile/assets/sfx/`: 12 `.m4a` files and `manifest.json`

**Edit**

- Dependencies and config: `apps/mobile/package.json`, root `package-lock.json`, `apps/mobile/app.json`
- Root: `apps/mobile/App.tsx` (header; mount the bridge, Host and FlightLayer; load the sound preference)
- Motion: `src/motion.ts`, `src/components.tsx` (Press; Sheet hold), `src/motion/haptics.native.ts`, `src/motion/haptics.ts`, `src/motion/hapticPreference.ts`, `src/motion/feedbackPolicy.ts`, `src/recap/OnceConfetti.tsx`, `src/recap/OnceCount.tsx`
- Screens and wiring: `src/settings/SettingsScreen.tsx`, `src/nav/RootNavigator.tsx`, `src/tutor/SafetyStopView.tsx`, `src/live/globals.native.ts`, `src/storage/scope.ts`, `src/legal/Acknowledgements.tsx` (add "Reanimated, Software Mansion, MIT License, Moves the screens and celebrations.")
- Every audio file in the §6.4 table
- Docs: `DESIGN.md`, `.gitignore`, `docs/STATE_AND_STORAGE.md`, `docs/REMOTE_UPDATES.md`, `docs/DEVICE_VERIFICATION.md` (S1–S3, C1–C3 next to O3 at `:568`), `docs/RELEASE_GATE.md` (all SFX approved; `build:web`), `docs/KNOWN_ISSUES.md`, `docs/IMPLEMENTATION_EVIDENCE.md`

### Tests and docs to change

`motion.test.ts`, `components.test.ts`, `motion/haptics.test.ts`, `motion/feedbackPolicy.test.ts`, `surfaceContract.test.ts` (J12 additions; the F407 regex), `tabs/HomeTab.test.ts:121`, `tabs/TutorTab.test.ts:121`, `RecapScreen.test.ts:100` and `revamp/stage3.test.ts:86-87`, exactly as described in §8.1. Pinned titles that keep their names:

- F597 (spring, press, haptics)
- F407
- J7
- J12
- F570 / F599
- F388
- F600
- the HomeTab greeting title
- stage3 "recap stories…"

The new suites are listed in §8.2. Docs are listed in §9 and under "Files touched".

### Owner agent

| Part | Owner |
|---|---|
| Dependencies, `app.json`, builds, fingerprint, `audit:ci` | `deploy-engineer` |
| `motion/`, `motion.ts`, Press, `icons/AnimatedIcon.tsx`, `celebrate/` templates and art motion, `scripts/sfx/` and assets, `motion.test.ts`, `components.test.ts`, haptics, DESIGN.md Motion / Shadow / Illustrations | `design-system-engineer` |
| `App.tsx` mount, RootNavigator transitions, SettingsScreen toggle, `surfaceContract.test.ts`, HomeTab, TutorTab and Recap tests | `frontend-engineer` (one integrator for the cross-cutting tests) |
| `sound/audioSession.ts`, `sound/audioFocus.ts`, `live/globals.native.ts`, `speech/tutorVoice.ts` | `voice-platform-engineer` |
| Recorder and player call sites in Drill, SpokenAttempt, Review, DailyPractice, PrivatePractice, recordedPlayer, SoundCheck | `practice-ux-engineer` |
| PreAccountOnboarding, OnboardingFlow, GuestRecording call sites | `onboarding-ux-engineer` |
| `celebrate/ledger.ts` store, `scope.ts` suffix, STATE_AND_STORAGE | `data-engineer` |
| SafetyStopView suppression | `tutor-behaviour-engineer`, with review by `privacy-safety-engineer` |
| PurchaseConfirmed gate | `revenue-engineer` decides; `frontend-engineer` renders |
| Device runbook | `qa-release-engineer` |

### Risks

1. Nothing in this section reaches the founder's phone until the new dev client is installed, and that must happen before the profile expires on 11 Oct 2026.
2. The reduced-motion sampling trap, if any file bypasses `drive.ts`. Rules 3 and 5 plus the bridge mitigate it.
3. Suites can drop silently if a test imports an engine-backed module. Rule 7 plus the gate floor mitigate it.
4. A race in audio-mode changes could mute voice in silent mode. The serialised chain plus voice holds mitigate it; S1 must pass on a device.
5. Moving Press to Reanimated touches every control. Fallback: keep the RN `Animated` `pressTo` (unchanged numbers) and ship the glow on the legacy driver.
6. `react-native-svg` `useAnimatedProps` on web (W2).
7. AAC priming latency of about 46 ms. If first-play latency measured on a device exceeds 60 ms, switch to 16-bit WAV (about 0.5 MB total).
8. Outfit may lack tabular figures; `minWidth` contains the CountUp jitter.
9. Celebration fatigue. The 3-per-burst budget and durable-only replays limit it.
10. An RN 0.87 bump forces Reanimated 4.7 and Worklets 0.13.
11. CI does not build web, so `build:web` is a manual release step.
12. Haptics during live rooms are now silenced on purpose (iOS also suppresses haptics during recording).

### Open questions for the founder

1. Live conversations will no longer vibrate on any control press, because the microphone is open the whole time. Keep that, or allow press haptics in rooms between the learner's turns?
2. When can you do a 15-minute listening session for the 12 sounds and the context reels (the `--audition` page)? No sound plays in the app until you approve it.

### Critical files for implementation
- /Users/pravz_07/Documents/StartUps/Luvani/.claude/worktrees/app-engagement-animations-de9910/apps/mobile/src/motion.test.ts
- /Users/pravz_07/Documents/StartUps/Luvani/.claude/worktrees/app-engagement-animations-de9910/apps/mobile/src/components.tsx
- /Users/pravz_07/Documents/StartUps/Luvani/.claude/worktrees/app-engagement-animations-de9910/apps/mobile/src/motion/hapticPreference.ts
- /Users/pravz_07/Documents/StartUps/Luvani/.claude/worktrees/app-engagement-animations-de9910/apps/mobile/App.tsx
- /Users/pravz_07/Documents/StartUps/Luvani/.claude/worktrees/app-engagement-animations-de9910/DESIGN.md