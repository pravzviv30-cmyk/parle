> Independent read-only review of [../motion-sound.md](../motion-sound.md), 2026-10-05.

## Verification: Motion, sound and haptics system

Checked on 2026-10-05 against the worktree source, the evidence files and the Expo SDK 57 install at `/Users/pravz_07/.codex/worktrees/adac/Luvani/node_modules` (expo 57.0.18, expo-audio 57.0.4, expo-haptics 57.0.3, expo-speech 57.0.2, expo-dev-menu 57.0.16, react-native 0.86.3, react-native-web 0.21.2, react-native-svg 15.15.4, react-native-screens 4.26.2, @expo/fingerprint 0.20.11). Reanimated and Worklets are not installed anywhere locally, so their claims were checked against unpkg `react-native-reanimated@4.5.1` and `react-native-worklets@0.10.1`.

### Findings

1. **MAJOR. Rebuilding `OnceConfetti` on `Burst` strands a flat drawing and fails a pinned-count test.**
   Claim (§8.1 stage3 row, §3 Burst): rebuild `OnceConfetti` on `Burst`, keeping only the names.
   Truth: `recap/OnceConfetti.tsx:29` is the only call site of `<Illustration name="celebrate-confetti" />` (grep across `src/`). `surfaceContract.test.ts:408-450` ("every flat drawing reaches a screen or is on the not-yet-drawn list, which only shrinks") requires every one of the 29 registry names to be drawn by name somewhere, with `UNDRAWN_YET: string[] = []` and the comment "never add one". Deleting the drawing is not an option either: the 29 is in the pinned F599 title at `art/registry.test.ts:149` ("names all 29 drawings…").
   Fix: keep one `<Illustration name="celebrate-confetti" />` render in production source, for example as `Burst`'s reduced-motion or web fallback inside `OnceConfetti`, or as the static art of the PracticeComplete stage. Add this to the §8.1 table.

2. **MAJOR. The pinned F597 `components.test.ts` title will still fail after the listed regex changes.**
   Claim (§8.1): the regexes become `pressTo(scale, depth === 'tile' ? …)`, `<Reanimated.View style={[style, pressStyle]}>`, the import line, and the reduced branch.
   Truth: that test (`components.test.ts:684-722`) also asserts `useEffect(() => () => running.current?.stop(), [])` (`:703`), `stiffness: 439, damping: 29\.3, mass: 1` inside the `pressTo` slice of `motion.ts` (`:712`), and the literal `export const PRESS_SCALE = 0\.97;` in `motion.ts` (`:713`; the same literal is asserted at `motion.test.ts:102`). The draft's `pressTo` calls `spring(to, SPRING.press, reduced)` (no numbers in motion.ts) and "re-exports" `PRESS_SCALE` from `tokens.ts` (no literal in motion.ts). Both fail.
   Fix: keep `export const PRESS_SCALE = 0.97;` as a literal in `motion.ts` (make `tokens.ts` not the source of that one value, or have `tokens.test.ts` compare text); change `:703` to the Reanimated teardown you write (e.g. `cancelAnimation(scale)`); change `:712` to match `SPRING.press` plus the `tokens.ts` numbers. List all three in §8.1.

3. **MAJOR. Ledger entry M4 has no `verified-by`, which blocks every commit.**
   Claim (§8.2): proposed entries M1-M5, M4 with an empty verified-by cell.
   Truth: `scripts/gate.mjs:429-430` fails any entry with no severity or no verified-by, and those checks run before the `if (fast) continue` at `:442`, so `gate:fast` (the pre-commit hook) refuses the commit. The heading must match `^###\s+(\S+)\s+[-—]+\s+(.+)$` (`:410`).
   Fix: give M4 a real title from the new `sound/audioSession.test.ts` (e.g. "every file calling .record() references holdMic or silenceRecordingHaptics") and write all five as `### F716 — …` / `- severity: P2` / `- status: [ ]` / `- verified-by: \`…\``.

4. **MAJOR. Streak copy collides with the banned-word list and two pinned tests the draft never mentions.**
   Claim (§5.3, §5.4, §5.2): "day streak", "days in a row", "This practice still counts for your streak."
   Truth: `copy/guilt.ts:30-45` bans `streak`, `missed`, `lost`, `lose`, `break`, `keep it up`, `don't`, `do not`, `again tomorrow or`, `failed`, `behind`, `owe` and is imported by 20 copy suites (TutorTab, HomeTab, ProfileTab, settings, home/*, wall/*, purchases/*). `copy/guilt.test.ts:62` ("the shared ban list still carries every word each surface ever banned", pinned at `KNOWN_ISSUES.md:3510`) fails the moment `streak` leaves the list, because `ONCE_BANNED` (`:40`) records it. `copy/guilt.test.ts:129` ("PRODUCT.md records why days active is not the streak it refused — F414", pinned three times) requires PRODUCT.md to keep "No streak guilt" and "Days active". `HomeTab.test.ts:329` bans the substring `streak` in `HomeTab.tsx` and `MissionHero.tsx` source; `TutorTab.test.ts:121-122` bans it in `TutorTab.tsx` source (so even `import { useStreak }` fails there).
   Fix: add to "Tests and docs to change": strike `'streak'` from `BANNED_IN_COPY` and from `ONCE_BANNED` (title unchanged), rewrite `PRODUCT.md:90-119` and edit the F414 assertions (title unchanged), and edit `HomeTab.test.ts:329` / `TutorTab.test.ts:122` where the Home flame lands. State that the words `break`, `lose`, `lost`, `missed`, `behind`, `don't` remain banned in every streak or reminder string.

5. **MAJOR. The voice-mode handoff can still cut the tutor's TTS line.**
   Claim (§6.4): "Voice stays audible in silent mode on every voice path."
   Truth: `AudioModule.swift:816-820` applies `setCategory` immediately on every `setAudioModeAsync`, and `AudioModule.swift:828-838` deactivates the session with `.notifyOthersOnDeactivation` 100 ms after the last expo-audio playable stops. expo-speech (`speech/tutorVoice.ts:66-80`) is not an expo-audio playable. A `correct` SFX (300 ms) that starts just before a Drill replay calls `Speech.speak` will finish during the line and trigger that deactivation; the voice hold only prevents the opposite order.
   Fix: `enterVoicePlayback()` must `await` the end of any in-flight SFX (pause the SFX players first) before `Speech.speak`, and S1 must include the sequence "drill right → tap Hear within 1 s" on a device with the switch on and off.

6. **MINOR. `profile/dailyGoal.ts` does not export `dailyGoalMin`, and its tiers are not the founder's.**
   Claim (§5.5): goal from `dailyGoalMin` (`profile/dailyGoal.ts`).
   Truth: `profile/dailyGoal.ts:23` is `GoalMinutes = 5 | 10 | 15`, `:70` exports `dailyGoalOf(profile)`, `:38` `GOALS`. No 20-minute tier exists.
   Fix: cite `dailyGoalOf` and name the onboarding section as the owner of extending `GoalMinutes` to `5 | 10 | 15 | 20` before GoalMet can show "Intense".

7. **MINOR. The lifetime line already exists as a function.**
   Claim (§5.3): "{total} days you have practised" "reuses the dayCount.ts phrasing".
   Truth: `progress/dayCount.ts:3-6` exports `lifetimeDayLine(days)` returning exactly that string with singular handling.
   Fix: call `lifetimeDayLine(await loadActiveDays())`; do not re-spell it.

8. **MINOR. Wrong test cited for the `celebrated` suffix.**
   Claim (§4.3): add `'celebrated'` to `USER_KEY_SUFFIXES` and the doc "(storage/storageDoc.test.ts:216)".
   Truth: `storageDoc.test.ts:202-216` is F408 and checks a fixed `STORES` list (and requires `registerSyncAdopter` for those only); nothing there reads `USER_KEY_SUFFIXES`. The enforcing test is `storage/scope.test.ts:100` ("every key the app writes for a learner is one a reset clears").
   Fix: cite `scope.test.ts:100`; keep the STATE_AND_STORAGE.md entry as documentation, not as a test requirement. Do not register a sync adopter for a device-only ledger.

9. **MINOR. `/<Chip/i` is banned in `PreAccountOnboarding.tsx`, and it matches `<ChipFlight`.**
   Claim (§3 ChipFlight, §5.1): ChipFlight is a general primitive; ReplyAccepted plays in place on `PreAccountOnboarding.tsx`.
   Truth: `conversationPacks/practiceDisclosure.test.ts:26` asserts `doesNotMatch(screen, /<Chip|<Label|<ProgressDots|<TutorMark|mascot/i)` on `PreAccountOnboarding.tsx`.
   Fix: state in the ChipFlight contract that it must not be mounted (`<ChipFlight`, `<Chip`) from `PreAccountOnboarding.tsx`; the onboarding section must launch it through `useChipFlight().launch({ chip: … })` with a differently named element, or edit that assertion deliberately.

10. **MINOR. The `Animated` naming rule must be explicit; the trap list is incomplete.**
    Claim (§8.1): HomeTab, TutorTab and Recap are the substring bans to loosen.
    Truth: also `tutor/orbRest.test.ts:183` (orb glyph), `nav/tabBar.test.ts:117`, `components.test.ts:786,790` (Skeleton, QuietLine), `daily/carousel.test.ts:25` (`\bAnimated\b|Easing|setTimeout|useReduceMotion` in `DailyCard.tsx`, so DailyCard may not call `useReduceMotion` even for the voice hold), `sessionScreens.test.ts:104` (`\bAnimated\.`), `surfaceContract.test.ts:216` (J7), `motion.test.ts:296` (`\bAnimated\.`). All of them pass only if Reanimated's default export is imported as `Reanimated`, never as the documented `Animated`.
    Fix: add rule 0 to §8.2: "`import Reanimated from 'react-native-reanimated'`; the identifier `Animated` means the RN legacy module and nothing else", and add the five files above to the §8.1 table.

11. **MINOR. Line references that are off (harmless, but the engineer greps by them).**
    `storage/scope.ts:96-99` is `:96-101`; `live/globals.native.ts:29-39` is `:28-38`; `components.tsx:1765` (Sheet) is `:1759`; `onboarding/firstRun.test.ts:108` is `:110` and bans `SceneMark|state="earned"|awardXp|pronunciationScore`, not XP in general; `REMOTE_UPDATES.md:93` is `:95`; `DEVICE_VERIFICATION.md:568` is `:569`; `PreAccountOnboarding.tsx:195` (status) is `:193-194`; `motion.ts:27-45` is `:28-45`.

12. **MINOR. `RootNavigator` already avoids a native slide on purpose, and `animationDuration` will not apply to it.**
    Claim (§3 Page transitions): default `slide_from_right`, `animationDuration: DUR.base` "where react-native-screens honours it".
    Truth: `nav/RootNavigator.tsx:682-684` sets `animation: 'fade'` with the comment "a native slide is not in it". react-native-screens honours `animationDuration` on iOS only for `fade`, `fade_from_bottom`, `slide_from_bottom` and `simple_push`.
    Fix: either keep `fade` as the default and use `fade_from_bottom` for full-screen flows (both honour the duration), or state that the slide is a deliberate reversal with no duration control on iOS.

13. **MINOR. Web `play()` rejections cannot be swallowed with try/catch.**
    Claim (§6.3): "Swallow `play()` rejections (autoplay policy)."
    Truth: `expo-audio/build/AudioPlayer.web.js:82-86` calls `this.media.play()` and discards the promise, so a `NotAllowedError` surfaces as an unhandled rejection, not as a thrown error.
    Fix: on web, play only from inside a user-gesture task (celebrations triggered by async store writes are not gesture-bound) or install one scoped `unhandledrejection` listener that drops `NotAllowedError` from `HTMLMediaElement`.

14. **MINOR. `ReducedMotionConfig` warns on mount in development.**
    Truth: `react-native-reanimated@4.5.1/src/component/ReducedMotionConfig.tsx:20-26` logs "Reduced motion setting is overwritten with mode …" under `__DEV__`. One mount at the root means one warning per launch; the bridge's `[mode]` effect restores the previous value on each change, which is the behaviour the draft wants. Note it in §1.4 so nobody "fixes" the warning by removing the bridge.

15. **MINOR. Acknowledgements and owners.**
    `legal/Acknowledgements.tsx:36-56` uses `{ name, by, licence, note }`; the test (`legal/acknowledgements.test.ts:26`) only pins Outfit, so adding Reanimated is safe. Add `react-native-worklets` (Software Mansion, MIT) in the same notice. `docs/TEAM.md:39` gives `progress-retention-engineer` goals, reminders and return cues; constraints.md §6 gives it `progress/*`. The GoalMet data path (`profile/dailyGoal.ts`, `progress/activity.ts`) and the durable catch-up on Home focus should name that owner alongside `data-engineer`.

16. **MINOR. `npm ci` in the worktree contradicts the documented rule.**
    Claim (§1.1 step 1): install inside the worktree so resolution stops there.
    Truth: `docs/TESTING.md:12-14` says "Run from the repo root, never from a worktree", and `.github/workflows/ci.yml:93-95` repeats it. The draft's reasoning is sound (a worktree `node_modules` is what makes the rule unnecessary), but the engineer will be reading a doc that says the opposite.
    Fix: add a one-line TESTING.md edit ("a worktree with its own `npm ci` is a root") to the docs list, and note the canonical checkout is on `redesign/notebook` (verified) with 564 packages and no `expo-updates`, so its install is not reusable.

17. **MINOR. `type.hero` is 112 pt.**
    Claim (§5.3): hero `{n}` in `type.hero`.
    Truth: `theme.ts:50` sets `fontSize: 112, lineHeight: 95, letterSpacing: -4.5`. A three-digit milestone at the largest Dynamic Type size will not fit a 390 pt column without the `fitHero` steps (`theme.ts:97-100`) that `HeroNumber` already applies (used at `wall/WallScreen.tsx:331`).
    Fix: use `HeroNumber` (which also satisfies the F597 "no new hero" convention) rather than raw `type.hero`.

18. **MINOR. Never write "icon-only" into DESIGN.md.**
    `surfaceContract.test.ts:1309-1312` (F313) asserts DESIGN.md contains no `icon-only` (case-insensitive). The brief's KEEP wording uses that phrase; the §9 outline must say "icon buttons" or "controls with no visible label".

### Claims spot-checked and found correct (34)

`motion.ts:131-139` pressTo numbers and `:117-125` derivation comment; `useReduceMotion` subscribes to `reduceMotionChanged` and treats a rejection as reduced; `SETTLE_MS` at `:51`; `hapticPreference.ts:7-18` and the single `silenceRecordingHaptics` caller `GuestRecording.tsx:5,95`; the four `.catch(() => {})` and the "never a pattern" comment in `haptics.native.ts:11`; every `setAudioModeAsync` line in the §6.4 table (DrillScreen 598/608, SpokenAttempt 25/59, PrivatePractice 47/63/88/89/95/102/113, DailyPracticeScreen 65/91/112/116/120/131, DailyCard 73, ListeningPreview 104, recordedPlayer 94, SoundCheck 107/156/181/188, GuestRecording 37/49/83/92/112) including which ones omit `playsInSilentMode`; the four mode-less players (`PreAccountOnboarding.tsx:328`, `OnboardingFlow.tsx:187`, `TutorTab.tsx:112`, `ProfileTab.tsx:155`) and `tutorVoice.ts:66-80`; `daily/playback.ts` records ownership only; expo-audio `ExpoAudio.js:404-406` passes the iOS mode through, `AudioRecords.swift:4` defaults `playsInSilentMode = false`, `AudioModule.swift:767-772` stops recorders, `:781-786` selects `.ambient`, `:212-216` `play` activates the session, `AudioUtils.swift:182-183` throws, `AudioModule.web.js:27` no-op and `:38-48` blob preload, `ExpoAudio.web.js:8-13` `downloadFirst`; `createAudioPlayer(source, options)` and `seekTo(): Promise<void>`; `expo-dev-menu` `DevMenuPreferences.swift:9,29,49` key and default; `babel-preset-expo/build/configs/expo.js:96-101` auto plugin; SDK 57 pins reanimated 4.5.1 and worklets 0.10.1; Reanimated 4.5.1 peers `react-native: 0.83 - 0.86`, `react-native-worklets: 0.10.x`, `src/ReducedMotion.ts` module-load sample, `ReducedMotionConfig`, `ReduceMotion`, `useReducedMotion`, `cancelAnimation`, `useAnimatedProps`, `useDerivedValue`, `FadeOut`, `createAnimatedComponent` exports; worklets 0.10.1 exports `scheduleOnRN`; `@expo/fingerprint` CLI has `fingerprint:generate` and `fingerprint:diff`; `47fbc2ea` is HEAD; `_headers` CSP has `default-src 'self'` and no `media-src`/`blob:`; `app.json:17-19`, `.gitignore:47`, `eas.json:16-30`, `REMOTE_UPDATES.md:77-78` (11 October 2026), `RELEASE_GATE.md:16-17`, `ci.yml:95-105` (no `build:web`), `TESTING.md:18-28`, `build-onboarding-audio.mjs:52`, `package.json` `audit:ci`/`gate:bless`/`postinstall`/`luvani.dependencyAudit`, `evidenceContract.test.ts:1211`; `motion.test.ts` titles at `:72, :91, :117, :136, :259, :295, :304` and the TARGET list; `surfaceContract.test.ts` F569 `:170`, J7 `:199` (regex `\bAnimated\b` indeed misses `<AnimatedIcon`), J12 `:280`, F407 `:2134-2138` with the exact DESIGN.md sentence at `DESIGN.md:698-699`; `components.test.ts` `:431, :684, :780, :782, :291`; `haptics.test.ts:18-38`; `feedbackPolicy.ts` (no ctor arg) and its test `:11-14`; `HomeTab.test.ts:121`, `TutorTab.test.ts:121`, `RecapScreen.test.ts:100`, `stage3.test.ts:86-87`; `legal/policy.test.ts:831-838`; `scope.ts:111` and `scopeGeneration` at `:66`; `levels.ts:47-59, 133-142, 144-150`; `activity.ts:53, 240 (async), 338`; `RecapScreen.tsx:176, 317`; `DrillScreen.tsx:1620` and `summariseDrill(...).resolved` (`packages/core/src/drill/session.ts:468-495`); `ReviewScreen.tsx:109-116`; `WallScreen.tsx:324-335`; `DailyCard.tsx:89`; `StarterContinuation.tsx:89`; `copy.test.ts:44`; `punctuation.test.ts:88` (pinned); `palette.test.ts:530`; `SettingsScreen.tsx:861-873`; `responsiveLayout.ts:2-6`; palette/theme tokens `colour.{blue,coral,sun,mint}`, `paper.{ground,card}`, `highlight`, `lilac`, `segmentPending`, `radius.control = 16`, `decorative`; `tutor/SafetyStopView.tsx:35` effect; `ConvoScreen.tsx:457, 571`; `RootNavigator.tsx:200`; `App.tsx:22-24, 444, 682, 699-700`; `DESIGN.md:276-285, 454-519, 518-519, 649-654, 696-760, 789-792, 807`; constraints.md next id F716 and the pinned-title table; spring derivations and overshoot figures (pop 322/19.7 at ζ 0.55 gives 12.6 %, settle 158/21.4, snap 987/50.3) all within ±1 of the formula; owner names all exist in `docs/TEAM.md:19-43`.

Verdict: needs fixes