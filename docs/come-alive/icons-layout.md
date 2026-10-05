> Detailed draft spec, written 2026-10-04 and checked against `47fbc2ea`. Where it disagrees with
> [README.md](README.md) Parts 1, 6 or 7 (decisions, resolutions, gate traps), README wins. Read the
> matching review in [reviews/](reviews/) before building from it.

## Icons and layout

Paths are relative to `apps/mobile/src/` unless they start with `scripts/`, `docs/`, `DESIGN.md` or `package.json`. Those four are relative to the repo root, `/Users/pravz_07/Documents/StartUps/Luvani/.claude/worktrees/app-engagement-animations-de9910`.

Every current-state claim below was checked against the source on 2026-10-04. Where the evidence files were wrong, the source wins and the difference is noted.

### 0. Facts this section relies on

**GhostButton call sites:**
- There are 222 `<GhostButton` tags in 63 files: 220 under `src/` in 62 files, plus 2 in `App.tsx` (lines 230 and 421). They sit on 215 source lines, because some lines hold 2 or 3 tags. This matches design-system.md.
- The component is `components.tsx:399-418`. It is an underlined `type.label` through `Press`, with `minHeight: HIT` (style `ghost`, `components.tsx:991-996`).

**Existing glyphs (41 line glyphs and 2 brand marks):**
- `components.tsx:74-268` and `:1573-1593`, `:1979-1989`.
- `glyphs.tsx:44-358`.
- `nav/icons.tsx:26-92`.
- Unused today: `FlameGlyph`, `SproutGlyph`, `TargetGlyph`, `ClockGlyph`, `CoffeeCupGlyph`, `ChevronDownGlyph`, `PlayGlyph`, `MicOffGlyph`, `PlusGlyph`, `SearchGlyph`, `SettingsGlyph`, `LockGlyph`, `ShareGlyph`, `CardsGlyph`, `InfoGlyph` and `PostcardGlyph`. Each has 0 `<Name` tags.
- The four tab icons are rendered through the `ICONS` map at `nav/LuvaniTabBar.tsx:24-29`. ProfileIcon and FriendsIcon have no callers.

**Tests that block icon and tab-bar animation:**
- `motion.test.ts:117-134`: no `Animated.createAnimatedComponent` anywhere.
- `:259-265`: glyph files never animate.
- `:295-301`: an exact list of the files that use `\bAnimated\.`.
- `:304-308`: the tab bar never animates.
- `glyphs.test.ts:44-176`: one stroke, at most one `fill={color}`, an exact export list, and a fixed count of 14.
- `nav/tabBar.test.ts:112-156`: no `Animated`, `useReduceMotion` or `interpolate` in `LuvaniTabBar.tsx`.

**iPad width (correcting the brief):**
- `app.json` sets `"orientation": "portrait"` and `"requireFullScreen": true` (`app.json:6,12`).
- Real iPad widths are therefore 744 to 1032 pt. 1366 pt only exists in landscape, which iOS never shows this app.
- The web preview can be any width.

### 1. Icon system

#### 1.1 Licence decision: Iconsax free (verified), with Phosphor MIT as the fallback

I fetched https://docs.iconsax.io/license-and-terms/license read-only on 2026-10-04.

**Section "1.B For Developers":**
- It reads: "Permitted Use: Integrate into Source Code (Personal and Commercial)".
- On redistribution it says loose icons may be shared "Only as PART of code (w/ notice). NO loose files."
- Its cheat sheet answers YES to "Embedding Free icons in a mobile app or software you develop for a client" and "Share Your Source Code with Integrated Free Icons".
- It answers NO to uploading icons for bulk download or to marketplaces.
- The free licence is "Users: ONE (Individual)" and non-transferable.

**Conclusion:** compiled use in a paid subscription app is allowed. Iconsax is the choice, with three conditions:
1. Never commit the raw Iconsax SVGs. Only the generated `.tsx` components go in the repo.
2. Every generated file carries a notice header.
3. The founder is the individual licensee.

**Fallback trigger.** Use `@phosphor-icons/core` 2.1.1 (MIT, raw SVGs under `assets/duotone/*.svg`) if either of these happens:
- the founder cannot accept the one-user licence; or
- a name in the mapping table (§1.4) is missing from the pinned Iconsax package and no close free equivalent exists.

**Source package:**
- npm `iconsax` 0.1.1 (MIT code, "1200+ free icons out of the box").
- Icon data lives in `dist/data/<category>.json`, for example `video-audio-image.json` and `users.json`.
- Each entry has the shape `{ "<name>": { "bold", "broken", "bulk", "linear", "outline", "twotone": "<svg …>" } }`.
- The SVG strings use `fill="white"` / `stroke="white"` and `stroke-width="1.5"`, with a `clip-path` wrapper and `<defs>`.

**Names may differ from Iconsax v1.** My read of `dist/manifest.json` was truncated, but showed names like `arrow-left-01`, `refresh-left`, `information`, `sand-timer`, `cloud-remove` and `fire`. So every source name in §1.4 is a candidate, and the build fails on any name the manifest does not contain.

Add it as an exact-pinned root devDependency (`package.json` `devDependencies`: `"iconsax": "0.1.1"`). It is never an app dependency, so it never enters the bundle. Before adding it, run `npm view iconsax@0.1.1 scripts` and refuse the package if it has any install script. Note it in `luvani.dependencyAudit` if `audit:ci` flags it.

#### 1.2 Conversion pipeline (`scripts/icons/`)

This follows the conventions of `scripts/illustrations.mjs`: strict, deterministic and idempotent, with a generated header and stale-file removal (`scripts/illustrations.mjs:1-27`).

| File | Role |
|---|---|
| `scripts/icons/icons.config.mjs` | The one map: `semanticName → { source: 'iconsax' \| 'phosphor' \| 'luvani', from: '<source name>', variants: ['linear'] \| ['linear','bulk'], rotate?: 45, parts?: { body: [0], arc1: [1], arc2: [2] } }`. Sorted by key. |
| `scripts/icons/svg.mjs` | Pure functions: `parseSvg`, `clean`, `toTsx`. Unit-testable from Node. |
| `scripts/icons/build-icons.mjs` | CLI: `node scripts/icons/build-icons.mjs` writes the output; `--check` exits 1 on any drift without writing. Root script: `"icons": "node scripts/icons/build-icons.mjs"`. |
| `scripts/icons/custom/*.svg` | Luvani's own drawings, which may be loose files because they are not third party: `check.svg` (`M5 12.5l4.5 4.5L19 7`, from `components.tsx:1589`), `speaker-slow.svg`, `mouth.svg` (from `glyphs.tsx:237,353`), `tea.svg` (a cup plus a tag line, Luvani-drawn), and `flame.svg` (from `components.tsx:170-171`, only if Iconsax `fire` is absent). |
| `scripts/icons/icons.lock.json` | Generated. Per icon and variant: source package and version, source name, sha256 of the source string, sha256 of the generated TSX. |

**Cleanup steps (SVGO-like, in order):**
1. Drop `width`, `height`, `xmlns`, `<title>`, `id`, `clip-path`, `<defs>` and `<clipPath>`.
2. Unwrap the now-empty `<g>`, and keep `transform` only when it is not the identity.
3. Convert kebab-case attributes to camelCase.
4. Round numbers to 3 decimals and strip trailing zeros.
5. Map colours:
   - `white`, `#292D32` and `currentColor` become `{color}`.
   - An element with an `opacity` below 1 (the Bulk and TwoTone second layer) becomes `fill|stroke={secondary}` plus `opacity={SECONDARY_OPACITY}` (0.4, exported from `icons/Icon.tsx`).
   - `none` stays `"none"`.
6. Map every `stroke-width` to `{STROKE}` (`theme.ts:135`, value 2). This keeps one pen across the app.
7. Apply `rotate: 45`, used for a bare close cross if Iconsax has no plain X.
8. Split into `parts` where configured.

**Hard failures:**
- any element other than `path`, `circle`, `rect`, `line`, `polyline`, `polygon` or `g`;
- any gradient, filter, mask or `url(`;
- any unknown colour;
- a missing source name;
- a part index out of range.

**Output:**
- One file per semantic name, `src/icons/<Pascal>.tsx`, exporting `export const <Pascal>: IconDrawings = { linear: (p) => <Svg …/>, bulk?: (p) => … }`. Each `<Svg>` is `width={p.size} height={p.size} viewBox="0 0 24 24" {...decorative}`.
- The first line is the header:
  `// Generated by scripts/icons/build-icons.mjs from iconsax@0.1.1 (<source name>). Do not edit by hand. Iconsax icon used inside Luvani's source under the Iconsax free licence (https://docs.iconsax.io/license-and-terms/license); not for redistribution as loose icon files.`
- Phosphor-sourced files say MIT instead. Luvani-sourced files say "Luvani original".
- `src/icons/index.ts` (generated) holds the registry `ICONS: Record<IconName, IconDrawings>`.
- `src/icons/names.ts` (generated) holds `export type IconName = 'add' | 'alert' | …` and `ICON_NAMES`.
- `docs/design-assets/ICONS.md` (generated): one row per icon (name, source, variants, licence, where used). This creates the ICONS.md that DESIGN.md has cited without it existing (design-system.md §0).
- Files with the generated header that are no longer in the config are deleted. Hand-written files in `src/icons/` have no header and are never touched.
- Unchanged files are not rewritten, so running the script twice leaves `git status` clean.

**Hand-written runtime files in `src/icons/`:**
- `Icon.tsx`: `Icon({ name, variant = 'linear', size = 24, color = paper.ink, secondaryColor })`. It draws `ICONS[name][variant] ?? ICONS[name].linear`. It is the only consumer of the registry and exports `SECONDARY_OPACITY`.
- `IconTile.tsx`:
  - A coloured rounded square holding a Bulk icon. Signature: `IconTile({ name, ground: 'blue'|'coral'|'sun'|'mint'|'ink'|'sand', size = 48 })`.
  - Radius is `Math.round(size * 0.3)`, which is 12 at 40 and 14 at 48. This matches the `ChoiceArt` rx 12 precedent (`onboarding/ChoiceArt.tsx:22`).
  - The icon is 0.55 of the tile size, coloured `textOn[ground]` (white on blue, coral and ink; ink on sun, mint and sand = `paper.skeleton`). This respects the forbidden pairs (`DESIGN.md:108-110`).
- `GoalDial.tsx`: a static 24-box ring showing a quarter, half, three-quarter or full fill, for the daily-goal tiers (§1.4). It is a still drawing at `STROKE` and decorative.
- `AnimatedIcon.tsx`: see §1.7.

#### 1.3 Coexistence with the ICONS.md stroke glyphs

There is one family. The generated set replaces the drawings, and the old exported names survive one release as deprecated delegates, so no call site has to move in the same commit:

- `components.tsx`:
  - The bodies of `ArrowRight`, `ChevronLeft`, `ChevronRight`, `MicGlyph`, `EarGlyph`, `HelpGlyph`, `FlameGlyph`, `SproutGlyph`, `BookmarkGlyph`, `TargetGlyph`, `BadgeGlyph`, `CloseGlyph`, `CheckGlyph` and `AlertGlyph` become `return <Icon name="…" size={size} color={color} />`.
  - This edits bodies in place and adds no new export in the middle of the file, so the append-only rule (`components.tsx:11-13`) holds.
  - `GoogleMark` and `AppleMark` stay drawn. They are brand marks.
- `glyphs.tsx`: every export becomes a delegate the same way. `PlaceGlyph` delegates to `PLACE_ICON: Record<MissionPlace, IconName>` in `icons/places.ts`. The `Record` type makes a missing place a typecheck error.
- `nav/icons.tsx`: `HomeIcon`, `PracticeIcon`, `MyFrenchIcon`, `ProfileIcon` and `FriendsIcon` delegate to `Icon` with `variant={p.focused ? 'bulk' : 'linear'}`. `TabIconProps` gains `focused?: boolean`. `TutorIcon` becomes a local delegate to `microphone`.
- New code imports `Icon` directly. A later cleanup deletes the delegates once their call sites are 0.

**Test changes this forces** (assertions only; no pinned title is renamed):

| Test | Current assertion | New assertion |
|---|---|---|
| `glyphs.test.ts:45` "every glyph draws in the one stroke weight and hides from assistive technology" (F589) | walks `glyphs.tsx` and `nav/icons.tsx` for `<Svg`, `STROKE` and a single `fill={color}` | walks every generated file in `src/icons/` (those with the header): each `<Svg` has `{...decorative}`; each `strokeWidth={STROKE}`; fills and strokes are only `{color}`, `{secondary}` or `"none"`; `opacity` is only `{SECONDARY_OPACITY}`; no `#hex`, `rgba` or `url(` |
| `glyphs.test.ts:78` "every place … has a mark of its own" | `case '<place>':` in `glyphs.tsx` | `PLACE_ICON` in `icons/places.ts` has a key per `MissionPlace` and each value is in `ICON_NAMES` |
| `glyphs.test.ts:90` (F598, pinned) | exact export list, 14 Round 1 marks, path strings | the `glyphs.tsx` export list is unchanged (delegates); every delegate renders `<Icon name=`; `icons/names.ts` equals `Object.keys(config)`; the speaker re-export is replaced by `name="speaker"` |
| `motion.test.ts:233` "both glyph files are here" | `glyphs.tsx`, `nav/icons.tsx` | `icons/` plus `glyphs.tsx` (unpinned) |
| `motion.test.ts:259` "a glyph moves nothing at all" (unpinned) | no `Animated`, `useEffect` or `interpolate` in the glyph files | same, over the generated `icons/*.tsx` and `glyphs.tsx`. `icons/AnimatedIcon.tsx` is the one named exception |
| `components.test.ts:647` (F598) | exactly 2 `fill={color}` in `components.tsx` | unchanged; it stays true because fills live in `icons/` |
| `components.test.ts:735-743` (RoundButton) | `<ChevronLeft size={24}`, `<CloseGlyph size={24}`, close and check path strings | keep the `<ChevronLeft size={24}` and `<CloseGlyph size={24}` lines; replace the path-string checks with `part('CloseGlyph')` containing `<Icon name="close"` and `part('CheckGlyph')` containing `<Icon name="check"` |
| `components.test.ts:490, 800` | `<EarGlyph size={22}` | `<AnimatedIcon kind="speaker-waves" size={22}` (FrenchBlock, §1.7) |
| `theme.test.ts:197` "STROKE is 2" | unchanged | unchanged |

#### 1.4 Icon list

**Format of the tables:**
- "Iconsax candidate" must be confirmed against `node_modules/iconsax/dist/manifest.json`, and the build fails if it is missing.
- "Phosphor" is the fallback name.
- L = Linear, B = Bulk.
- No icon depicts a face (founder decision 1). Exclude `emoji-*`, `happyemoji` and the like. The AI tutor is always the orb (`tutor/OrbGlyph.tsx`), never a person icon.

**Controls and replaced glyphs**

| Semantic name | Iconsax candidate | Var | Phosphor | Replaces / used for |
|---|---|---|---|---|
| `back` | `arrow-left` (chevron form, `arrow-left-0x`) | L | `caret-left` | `ChevronLeft` `components.tsx:86`, RoundButton back, onboarding "Back" `PreAccountOnboarding.tsx:692` |
| `forward` | `arrow-right` | L | `arrow-right` | `ArrowRight` `:74`, NextButton, round next |
| `chevron-right` | `arrow-right` (chevron) | L | `caret-right` | `ChevronRight` `:99`, LedgerRow trailing `:1173` |
| `chevron-down` | `arrow-down` (chevron) | L | `caret-down` | `ChevronDownGlyph` `glyphs.tsx:219`; More/Less toggles |
| `close` | `add` with rotate 45, or a bare cross | L | `x` | `CloseGlyph` `:1573`, Sheet close `:1816`, clear search |
| `check` | Luvani custom (`components.tsx:1589` path) | L | `check` | `CheckGlyph` `:1585`, choice disc, SceneMark |
| `tick-circle` | `tick-circle` | L/B | `check-circle` | `BadgeGlyph` `:235`; done, accept, "I said it" |
| `add` | `add` | L | `plus` | `PlusGlyph` `glyphs.tsx:271` |
| `search` | `search-normal` | L | `magnifying-glass` | `SearchGlyph` `:280` |
| `settings` | `setting-2` | L | `gear-six` | `SettingsGlyph` `:290`; Profile header action |
| `share` | `share` | L | `share-network` | `ShareGlyph` `:310`; share postcard or invite |
| `edit` | `edit-2` | L | `pencil-simple` | Change plan, Edit goal, Change voice |
| `info` | `info-circle` / `information` | L | `info` | `InfoGlyph` `:331`; feedback details, how the tutor works |
| `alert` | `danger` / `warning-2` | L | `warning` | `AlertGlyph` `:1979` (Field errors stay ink) |
| `help` | `message-question` | L | `question` | `HelpGlyph` `:138` (Help me out tile, onboarding Help) |
| `lock` / `unlock` | `lock` / `unlock` | L/B | `lock-simple` / `lock-simple-open` | `LockGlyph` `:300`; plans |
| `login` | `login` | L | `sign-in` | Sign in tile |
| `more` | `more` | L | `dots-three` | Friend options |
| `sort` | `sort` | L | `sort-ascending` | "Newest conversations" |
| `download` | `document-download` | L | `download-simple` | Save conversation text, Export to Anki, Load sample |
| `eye` | `eye` | L | `eye` | "Try it from memory, then reveal" |
| `hint` | `lamp-charge` | L | `lightbulb` | Drill help |

**Voice and audio**

| Semantic name | Iconsax candidate | Var | Phosphor | Replaces / used for |
|---|---|---|---|---|
| `microphone` | `microphone-2` | L/B | `microphone` | `MicGlyph` `:111`, Speak tab, record, "Practise this phrase" |
| `microphone-off` | `microphone-slash` | L | `microphone-slash` | `MicOffGlyph` `glyphs.tsx:248` |
| `speaker` | `volume-high`, parts body/arc1/arc2 | L/B | `speaker-high` | `EarGlyph` `:125` and `SpeakerGlyph` `glyphs.tsx:44`; every Hear control |
| `speaker-slow` | Luvani custom (speaker, outer arc dashed) | L | none | `SpeakerSlowGlyph` `glyphs.tsx:237`; Simpler, Slow replay, Play slowly |
| `speaker-off` | `volume-slash` | L | `speaker-slash` | "I can't listen now" |
| `play` / `pause` / `stop` | `play` / `pause` / `stop` | L/B | same | `PlayGlyph` `:228` |
| `replay` | `rotate-left` | L | `arrow-counter-clockwise` | `ReplayGlyph` `:105`; Retry this line, Say it again |
| `refresh` | `refresh-2` / `refresh-left` | L | `arrows-clockwise` | every error retry |
| `keyboard` | `keyboard` | L | `keyboard` | `KeyboardGlyph` `:261`; Type instead |
| `translate` | `translate` | L | `translate` | "In English" |
| `moment` | `timer-pause` | L | `hourglass` | "Give me a moment" |
| `waveform` | `sound` | L/B | `waveform` | `WaveformGlyph` `:128`; Your sounds |
| `headphones` | `headphone` | L/B | `headphones` | Hear, say and compare; Walk mode |
| `mouth` | Luvani custom (`glyphs.tsx:353`) | L | none | `MouthGlyph` (WallYoursPage) |

**Content, progress and places**

| Semantic name | Iconsax candidate | Var | Phosphor | Used for |
|---|---|---|---|---|
| `chat` | `messages-2` | L/B | `chats-circle` | `ChatGlyph` `:85`; conversations, talk freely |
| `bubble-empty` / `bubble-line` / `bubbles` | `message` / `message-text` / `messages-2` | B | `chat-circle` / `chat-circle-text` / `chats` | start level zero / few / getby (`onboarding/plan.ts:29-33`) |
| `quote` | `quote-up` | L/B | `quotes` | `QuoteGlyph` `:118`; Your phrases |
| `cards` | `note-2` | L/B | `cards` | `CardsGlyph` `:321`; review deck row |
| `book` | `book-1` | L/B | `book-open` | daily collection, lesson door, phrasebook |
| `document` | `document-text` | L | `file-text` | conversation text only (`DocumentGlyph` retires as a generic mark) |
| `bookmark` | `bookmark` | L/B | `bookmark-simple` | `BookmarkGlyph` `:197`; keep or save phrase |
| `postcard` | `gallery` | L/B | `image` | `PostcardGlyph` `:342`; Place postcards |
| `path` | `routing-2` | L/B | `path` | Progress tab, scene path row |
| `map` | `map-1` | L | `map-trifold` | Choose a scene or situation |
| `flag` | `flag-2` | L/B | `flag` | goal rows (`TargetGlyph` `:218` retires) |
| `calendar` / `calendar-tick` | `calendar-1` / `calendar-tick` | L/B | `calendar` / `calendar-check` | week, goal met |
| `clock` | `clock` | L/B | `clock` | `ClockGlyph` `:64`; Change time |
| `bell` | `notification` (ring frame: `notification-bing`) | L/B | `bell` / `bell-ringing` | reminders |
| `cloud-add` / `cloud-off` / `cloud` | `cloud-add` / `cloud-remove` or `cloud-cross` / `cloud` | L/B | `cloud-arrow-up` / `cloud-slash` / `cloud-check` | Save progress / offline / account saved |
| `cafe` / `hotel` / `market` / `street` / `home-place` / `friends-place` | `coffee` / `building-4` / `shop` / `location` / `house-2` / `people` | B | `coffee` / `bed` / `storefront` / `map-pin` / `house-line` / `users-three` | `PlaceGlyph` `glyphs.tsx:155-203` |
| reasons: `food`, `trip`, `family`, `moving`, `work`, `exploring` | `reserve`, `airplane`, `heart`, `truck-fast`, `briefcase`, `discover` | B | `fork-knife`, `airplane-tilt`, `heart`, `truck`, `briefcase`, `compass` | `ChoiceArt.tsx` kinds (`:25-52`) |
| drinks: `coffee`, `tea` | `coffee`, Luvani custom `tea` | B | `coffee`, none | Coffee and Tea no longer share a cup (`PreAccountOnboarding.tsx:745,751`) |
| reminder times | `sun-fog`, `sun-1`, `cloud-sunny`, `moon` | B | `sun-horizon`, `sun`, `cloud-sun`, `moon` | `reminders/reminder.ts:116-121` |
| game: `flame`, `star`, `crown`, `medal`, `cup`, `gift`, `quests`, `freeze` | `fire` (else Luvani flame), `star-1`, `crown-1`, `medal-star`, `cup`, `gift`, `task-square`, Phosphor `snowflake` | B | `flame`, `star`, `crown`, `medal`, `trophy`, `gift`, `list-checks`, `snowflake` | streak, XP, level, badges, milestones, quests, streak freeze (paid) |
| people: `user`, `users`, `user-add` | `profile-circle`, `people`, `user-add` | L/B | `user-circle`, `users`, `user-plus` | `ProfileIcon` `nav/icons.tsx:73`, `FriendsIcon` `:83`, invite |
| tabs: `home`, `practice` | `home-2`, `weight-1` (dumbbell) | L/B | `house`, `barbell` | `HomeIcon` `:39`, `PracticeIcon` `:50` |
| settings rows | `profile-circle`, `crown-1`, `card`, `shield-tick`, `notification`, `mobile`, `music`, `message-question`, `info-circle`, `logout` | L | matching | account, plan, subscription, privacy, reminders, haptics, sound effects, help, about, sign out |

**Daily-goal tiers (founder decision 5):**
- Casual 5, Regular 10, Serious 15 and Intense 20 each use `GoalDial` at a quarter, half, three-quarter and full fill, on a sun `IconTile`.
- The glyph itself shows the size of the commitment, which fixes the "three identical clocks" defect at `PreAccountOnboarding.tsx:802` (design-system.md §3).

**Option tile colours by meaning:**
- food: sun; trip: blue; family: coral; moving: mint; work: ink; exploring: sand.
- All three start levels are mint, so the glyph carries the progression from an empty bubble to two bubbles (youtube.md §2.2, mistake 5).

#### 1.5 Tab bar (reverses "the tab bar never animates")

**Selected tab:**
- Uses the Bulk variant in `accent.brand`, as today (`LuvaniTabBar.tsx:119`, `color={focused ? accent.brand : paper.inkSoft}`).
- Unselected tabs use Linear in `paper.inkSoft`.

**The motion lives in a new `nav/TabGlyph.tsx`.** `LuvaniTabBar.tsx` itself stays free of `Animated`, so the pinned F600 assertions (`tabBar.test.ts:117-118, 155`) still pass. The cell renders:

```
<TabGlyph focused={focused}><Icon size={24} color={focused ? accent.brand : paper.inkSoft} focused={focused} /></TabGlyph>
```

The `ICONS` map line pinned at `tabBar.test.ts:168-171` is unchanged.

**The pop on selection** (false to true only; never on mount, never on re-tapping the current tab):
- scale 1 → 1.15 → 1 on `SPRING.pop`;
- translateY 0 → −2 → 0 on the same spring;
- the Bulk layer cross-fades over the Linear over `DUR.micro` (120 ms) with `EASE.out`.

**Other behaviour:**
- Haptic: the existing `tapSettled()` (`LuvaniTabBar.tsx:92`).
- Sound: none.
- Reduce Motion: the variant swaps instantly with no scale.
- Practice badge dot (`:120`): when the due count goes from 0 to more than 0 while the bar is mounted, the dot scales 0 → 1 once on `SPRING.pop`. It is static otherwise.

**Test edits:**
- `motion.test.ts:304` "the tab bar is still: no wash, no lift, no animation" is unpinned and can be retitled. New assertion: `LuvaniTabBar.tsx` has no `Animated`, and `nav/TabGlyph.tsx` uses `useReduceMotion()`, contains no `withRepeat`, and animates only `transform` and `opacity`.
- Add `nav/TabGlyph.tsx` to the `motion.test.ts:299` allow-list.
- `tabBar.test.ts:80` keeps its regexes, because the colour expression is unchanged.

#### 1.6 IconButton, IconAction and Choice

All three are appended to the end of `components.tsx`, after `ControlTile` (`:2003-2013`). This keeps the append-only slicing rule (`components.test.ts:383-414`).

**`IconButton` (icon only)**

```ts
type IconButtonIcon = 'back' | 'close' | 'speaker' | 'bookmark' | 'replay' | 'bell';
function IconButton(p: {
  icon: IconButtonIcon;           // closed union: anything else must be an IconAction with a visible label
  label: string;                  // required; becomes accessibilityLabel (keeps every test that pins label="…")
  onPress: () => void | boolean;
  tone?: 'plain' | 'disc' | 'ink';// plain: no fill, ink mark; disc: white 44 disc (RoundButton look); ink: ink disc, white mark (FrenchBlock look)
  size?: 'md' | 'lg';             // md: 44 hit, 24 mark (default); lg: 56 disc, 28 mark (primary audio)
  selected?: boolean;             // bookmark saved, bell on, speaker playing: Bulk variant in accent.brand; accessibilityState.selected
  animate?: AnimatedIconKind;     // 'bookmark-fill' | 'speaker-waves' | 'bell-ring' | 'refresh-spin'
  trigger?: string | number;      // a real event key; a change plays the one-shot once
  active?: boolean;               // for loops (speaker playing)
  disabled?: boolean; accessibilityHint?: string; haptic?: Haptic; color?: string;
})
```

**Rules:**
- The hit area is always ≥ `HIT` (44) and the size comes from `HIT`, never a literal.
- It presses through `Press`, scaling to 0.92 (needs a `pressScale` prop on the upgraded Press from the motion section) on `SPRING.press`, with `haptic="light"`, or `"selection"` when it toggles `selected`.
- The mark is decorative. The label is spoken.
- Disabled is `paper.inkSoft`, never opacity and never `inkFaint`. That keeps the off-control allow-set at `surfaceContract.test.ts:1498-1513` true.
- It plays no SFX of its own. Outcome sounds come from `useCelebrate` events: for example, `'phrase-saved'` plays `save` and `celebrate()`.

**Why these six may go unlabeled** (Kole Jain 04:18-04:32, youtube.md §2.1): back, close, speaker, bookmark, replay (↺, "do this line again") and bell are universally understood. Every other action keeps a visible short label.

**`IconAction` (icon plus a short visible label)**

```ts
function IconAction(p: {
  icon: IconName | 'orb';         // 'orb' draws OrbGlyph for tutor actions (no person icon)
  label: string;                  // visible; also the default accessibilityLabel
  accessibilityLabel?: string;    // the full sentence when the visible label is short (e.g. label "Details", a11y "Feedback details")
  onPress: () => void | boolean;
  layout?: 'tile' | 'inline';     // tile: icon above label in a white tile, for rows of 2-4; inline: icon left of label, no box
  color?: string;                 // inline only: the ground's word colour (paper.ink, or paper.onInk on blue/coral)
  selected?: boolean; busy?: boolean; disabled?: boolean;
  animate?: AnimatedIconKind; trigger?: string | number;
  accessibilityHint?: string; haptic?: Haptic;
})
function IconActionRow({ children }: { children: ReactNode }) // 2-4 tiles, equal width
```

**Tile layout:**
- Background `paper.card`, `borderRadius: radius.tile` (20), `minHeight: HIT + space(7)` (72).
- `paddingVertical: space(3)`, `paddingHorizontal: space(2)`, `gap: space(1.5)`.
- Icon 24, Bulk in ink, with the secondary layer `accent.brand` at 0.4.
- Label `type.small` in ink, centred, wrapping. No `numberOfLines`.
- Press scale 0.96.

**Inline layout:**
- `minHeight: HIT`, `paddingHorizontal: space(2)`, `gap: space(2)`.
- Icon 20, Linear.
- Label `type.label` (SemiBold 16), not underlined.

**IconActionRow:**
- `flexDirection: 'row'`, `gap: space(3)`. Each child is `{ flex: 1, minWidth: 0 }` (needed by `HomeTab.test.ts:640-648`).
- At `PixelRatio.getFontScale() >= 1.6` (the same threshold as `LuvaniTabBar.tsx:50`), tiles take `flexBasis: '47%'` and wrap to two per line.
- More than 4 actions is not allowed; use a list instead.

**Selected state (founder decision 7: fill and glow, no 3D lip, no shadow):**
- Tile background cross-fades to `onColour.blue` (#E4E1FF) and gains a 2 pt `accent.brand` border.
- The icon swaps to Bulk in `accent.brand`.
- A halo `View` sits behind at inset −4, with `accent.brand` going from opacity 0 to 0.16 and scale 0.94 → 1 over `DUR.base` (260 ms) on `EASE.out`. This uses no `shadow*`, so F569 (`surfaceContract.test.ts:170`) is untouched.
- Pop: 1 → 1.04 → 1 on `SPRING.pop`.
- Haptic `tapSettled()`. Sound `select`.
- On blue or coral grounds the selected fill is `colour.sun` with ink content.
- Contrast: inkSoft on #E4E1FF is about 5.3:1, which clears 4.5.

**Busy:** when `busy`, the `refresh` icon spins (§1.7). The label is the caller's busy label (for example "Checking…"), and `accessibilityState={{ busy: true }}`.

**`Choice` (one choice component)**

This replaces `onboarding/ChoiceCard.tsx` `Choice`, `OptionRow` (`components.tsx:1719-1744`) and legacy `OptionCard` (`:430`).

```ts
function Choice(p: { title: string; detail?: string; tile?: ReactNode /* IconTile or GoalDial */;
  selected: boolean; onPress: () => void; role?: 'radio' | 'button'; layout?: 'row' | 'tile';
  ground?: 'paper' | 'blue' | 'sun'; onHear?: () => void; playing?: boolean; compact?: boolean; accessibilityLabel?: string })
```

- **Row layout:** `minHeight: HIT + space(7)` (72), a 48 tile, title `type.bodyStrong`, a 28 check disc at the end.
- **Tile layout:** used for Coffee and Tea, and for iPad grids. The 56 tile sits above the title, `minHeight: 120`, `flex: 1, minWidth: 0`.
- **Selected on paper:** fill `accent.brand`, title `paper.onInk`, tile switches to a white ground with a blue Bulk icon, white disc with a blue `check`. The transition is `interpolateColor` over `DUR.fast` (180 ms) plus a 1.02 pop on `SPRING.pop`, then the check wipe (§1.7). Selected on blue: fill `colour.sun` with ink words. This fixes the blue-on-blue ring at `ChoiceCard.tsx:63`.
- **Unselected:** `paper.card` with a 2 pt `paper.line` border. It never matches the ground.
- **Feedback:** haptic `tapSettled()`, sound `select`.
- **Accessibility:** the radio role keeps `accessibilityRole="radio"` and `accessibilityState={{ checked: selected }}`. `onHear` renders an `IconButton icon="speaker"` as a separate target, so hearing never selects (`preAccountDraft.test.ts:183`).
- **Migration:** `OptionRow` and `OptionCard` stay exported as thin wrappers over `Choice`, so the regexes in `stage3.test.ts:63` and `RecapScreen` keep passing. `onboarding/ChoiceCard.tsx` re-exports `Choice`. The `firstRun.test.ts:118` assertion ("illustrated full-width choices carry radio state…", pinned) changes to read the `Choice` region in `components.tsx` rather than `ChoiceCard.tsx`.

#### 1.7 AnimatedIcon (`src/icons/AnimatedIcon.tsx`, Reanimated 4.5.1)

**API:** `AnimatedIcon({ kind, size = 24, color, state?: 'off' | 'on', trigger?: string | number, active?: boolean })`.

**Rules shared by every kind:**
- Only `transform` and `opacity` move. Fills and draws are done with counter-translated `overflow: 'hidden'` windows, never SVG attribute animation. This keeps `motion.test.ts:117` (no `createAnimatedComponent`) valid for icons.
- Every `withTiming`, `withSpring` and `withRepeat` passes `reduceMotion: ReduceMotion.Never` and branches on the app's live `useReduceMotion()` from `motion.ts` to render the final frame. Reanimated samples Reduce Motion only once, at module init (tech.md, "Reduce motion").
- Loops run only while `active` is true. They are cancelled on unmount and on AppState `background`, and the caller passes `active={false}` on blur (J7, `surfaceContract.test.ts:199`).
- The icon is decorative. State is spoken by the owning control.
- Add `icons/AnimatedIcon.tsx` to the `motion.test.ts:299` allow-list.

| Kind | Real trigger (truth gate) | Motion | Haptic / sound | Reduce Motion |
|---|---|---|---|---|
| `bell-ring` | reminder actually scheduled after an OS permission grant: `PreAccountOnboarding.tsx:1358-1364`, `RecapScreen.tsx:386-388` accept, `settings/SettingsScreen.tsx:821-845` switch on | Linear → Bulk (`accent.brand`) at t0. Rotate about the top (`transformOrigin: '50% 12%'`): 0 → −16° → 14° → −10° → 6° → −3° → 0 with steps of 90/90/90/90/80/80 ms (520 ms total), each `EASE.out`. Scale 1 → 1.12 → 1 on `SPRING.pop` | `arrived()` (gated) / `save` | Bulk, still |
| `bookmark-fill` | save resolved `true`: `PreAccountOnboarding.tsx:485`, `RecapScreen.tsx:176`, `daily/DailyCard.tsx:89-90`, `DrillScreen.tsx:1304`, `onboarding/StarterContinuation.tsx:89-91`. Never optimistic | Bulk layer revealed bottom to top: outer window translateY +size → 0, inner −size → 0, 220 ms `EASE.out`. At +160 ms pop 1 → 1.2 → 1 on `SPRING.pop`. Three 4 pt `accent.brand` dots at −45°, −90° and −135° travel 0 → 10 pt with opacity 1 → 0 over 260 ms. Unsave reverses over 180 ms with no pop | via `celebrate('phrase-saved')`: `celebrate()` / `save` | Bulk, still |
| `check-draw` | Choice selected; `tutor/MissionTaskList.tsx:12-21` achieved false → true; GoalStep "I used this outside the app"; SoundCheck "I said it" | Disc scale 0.6 → 1 on `SPRING.pop` with fill cross-fade (120 ms). Check wiped left to right: window translateX −size → 0, inner +size → 0, 200 ms `EASE.out`, starting at +60 ms | Choice: `tapSettled()` / `select`. Goal ticks: `arrived()` / `correct` | full tick |
| `speaker-waves` | `active` = the player really is playing (expo-audio status) | Body static. `arc1` opacity 0.35 → 1 → 0.35 over 700 ms in a `withRepeat` loop (`EASE.inOut`); `arc2` the same, 140 ms later. Bulk while playing. On stop, cancel and set the arcs to 1 | none (never SFX over audio) | arcs full, still; the label says Stop |
| `flame-flicker` | ignite on `'streak-extended'`; flicker only while today is already extended and the screen is focused | Ignite: grey Linear (`paper.field`) → Bulk coral and sun, scale 0.3 → 1.25 → 1 on `SPRING.pop`, rotate −8° → 0 (about 420 ms). Flicker: scaleY 1 ↔ 1.06 (`transformOrigin` bottom) plus rotate ±2°, 1600 ms period, `EASE.inOut`; inner layer opacity 0.75 ↔ 1 offset by 400 ms. "Not yet today": still grey Linear, nothing shaming | owned by celebrate (`streak`) | Bulk, still |
| `refresh-spin` | press; or `busy` true | Press: one turn 0 → 360° over 600 ms `EASE.inOut`. Busy: linear 900 ms per turn, finishing the current turn when busy ends | Press light / none | still; busy label |
| `cloud-check` | account saved (`onboarding/GuestAccountHandoff.tsx:101-102` keep success; `App.tsx` `PreAccountProfileBootstrap` done) | Cloud translateY 6 → 0 and opacity 0 → 1 over 180 ms `EASE.out`. Check wipe of 200 ms at +120 ms. Pop to 1.1 | `arrived()` / `save` | final |
| `mic-pulse` | `active` while recording: `onboarding/GuestRecording.tsx`, `daily/DailyPracticeScreen.tsx` record, `drill/SpokenAttempt.tsx`. Not used in live Conversations, where the orb owns this | Two `colour.mint` 2 pt rings behind the mic, scale 1 → 1.35 and opacity 0.6 → 0 over 1100 ms, offset by 550 ms. If expo-audio metering is on, the inner icon scale follows the real level, clamped 1 to 1.15. No invented level | none (`hapticsEnabled()` is false while the mic is live, `motion/hapticPreference.ts:7`) | still mint ring |
| `star-pop` | XP actually recorded (`progress/activity.ts:240` result), quest complete | Scale 0 → 1.3 → 1 on `SPRING.pop` with rotate −30° → 0 (about 360 ms). Four `colour.sun` 2×6 ticks move 0 → 8 pt with opacity 1 → 0 over 220 ms at 0°, 90°, 180° and 270° | owned by celebrate | final |
| `lock-open` | `'purchase-confirmed'` only, after a confirmed entitlement (`wall/WallScreen.tsx:323-334`) | Lock → unlock Bulk mint cross-fade. Shackle part translateY 0 → −3 and rotate 0 → −20° about the left hinge, 260 ms on `SPRING.snap`. Body pop to 1.08 | owned by celebrate | unlock, still |

No AnimatedIcon renders inside `tutor/SafetyStopView.tsx` (F137).

#### 1.8 Acknowledgements

**Change to `legal/Acknowledgements.tsx` `NOTICES` (`:36-56`):** append

```ts
{ name: 'Iconsax', by: 'Vuesax (iconsax.io)', licence: 'Iconsax Free License', note: 'The icons on buttons, rows and choices, built into the app. They are not shared as icon files.' }
```

If the Phosphor fallback is used, also add `{ name: 'Phosphor Icons', by: 'Phosphor Icons', licence: 'MIT License', note: 'Some of the icons in the app.' }`. Its MIT text then ships in-app. Extend `scripts/build-daily-licences.mjs` and its output `legal/dailyLicences.ts` the same way the existing MIT entry was added.

- Copy rules: no em dash and no middot (`copy.test.ts:44`, `copy/punctuation.test.ts`).
- New test in `legal/acknowledgements.test.ts`, "Acknowledgements credits the icon set under its licence": asserts `name: 'Iconsax'` and that every generated `src/icons/*.tsx` starts with the notice header.
- Reanimated's own entry belongs to the motion section.

### 2. GhostButton sweep (222 tags, 63 files)

**Codes:**
- **IB:x** = `IconButton icon="x"`.
- **IA:x** = `IconAction` inline. **IAt:x** = `IconAction` tile inside an `IconActionRow`.
- **FB** = folded into `FrenchBlock onHear`.
- **CH** = becomes a `Choice` option.
- **RM** = removed (redundant).
- **KEEP** = stays a `GhostButton`. That is reserved for legal and billing links, destructive or account-ending actions, decline and "Not now" answers, and leave confirmations, where explicit words beat an icon.

Every converted call site keeps its existing `label` string, either as the visible label or, for IconButton, as the spoken label. Every `label="…"` regex therefore still passes. Only regexes that spell `<GhostButton` change (listed under "Tests and docs to change").

**Rule shared by all error retries:** labels such as "Try again", "Retry …", "Try loading … again" and "Check … again" become `IA:refresh` with `busy` wired to the in-flight flag.

| File (tag line) | Link → replacement |
|---|---|
| `onboarding/PreAccountOnboarding.tsx` (30) | 541 Sign out KEEP; 551 Try a practice now IA:forward (white on blue); 570 skip link CH ("I’m exploring" becomes a sixth reason option with the `exploring` sand tile; "I’m not sure" RM, because zero already means it: set `START_LEVELS.zero.gloss` to "Also right if you are not sure"; "Choose each time" and "No schedule" follow the daily-goal merge in the onboarding section); 651 Cancel KEEP; 660 Type instead IAt:keyboard; 665 Practise offline IAt:cloud-off; 692 Back IB:back `tone="disc"`; 761 Hear/Stop FB; 835 Change plan IAt:edit; 836 Choose tutor IAt:orb; 922 Retry this line IB:replay; 933 Try the next exchange IAt:forward "Next exchange" (or the primary, per the celebration section); 943 Keep this phrase IB:bookmark `animate="bookmark-fill"`, `selected={guest?.kept}`; 954 Feedback details IAt:info "Details"; 959 Save progress RM on recap (the account step follows the reminder ask, founder decision 13); 979 Retry this line IAt:replay "Practise again"; 991 Save progress IAt:cloud-add; 999 Sign in IAt:login; 1008 Set a reminder IAt:bell; 1024 Practise this offline IA:cloud-off; 1036 Try again IA:refresh; 1114 Back to plan choices IA:back; 1184 Hear {persona} IB:speaker inside `Choice onHear`; 1206 I am younger than that KEEP; 1237 Privacy details KEEP; 1243 Try again IA:refresh; 1262 Read privacy policy KEEP; 1290 Hear/Stop FB; 1371 Not now KEEP; 1380 Leave practice KEEP. The hand-rolled "Help" `Press` at 894-909 becomes IA:help with `haptic="none"` and the existing `soft()` |
| `onboarding/StarterContinuation.tsx` (7) | 111 Retry my last line IAt:replay; 112 Speak with my tutor IAt:microphone; 113 See plans IAt:crown (one row of 3 under the pill); 132 Leave practice KEEP; 165 Retry this line IB:replay; 173 Keep this phrase IB:bookmark (fill); 210 Help IA:help |
| `onboarding/GuestAccountHandoff.tsx` 162, 170; `AgeGateScreen.tsx` 53; `AgeRefusal.tsx` 44; `OnboardingFlow.tsx` 270, 400 | all KEEP (account and age decisions; `answers.test.ts` and `voiceStep.test.ts` pin them) |
| `onboarding/GuestRecording.tsx` 137; `drill/SpokenAttempt.tsx` 81 | IA:keyboard |
| `onboarding/FirstSceneScreen.tsx` 117, 148 | 117 secondary IA:keyboard; 148 More/Fewer examples IA:chevron-down (rotates 180°) |
| `App.tsx` 230, 421 | 230 Start a new plan instead IA:edit; 421 Sign out KEEP |
| `tabs/HomeTab.tsx` (3) | 151 retry IA:refresh; 185 Open my circle IA:users; 186 Explore my daily collection moves into DailyCard's row (below) |
| `daily/DailyCard.tsx` (8) | 102 retry IA:refresh; 112 Try it from memory, then reveal IA:eye; 115 Hear FB; 122 Save/Saved IB:bookmark (fill), with label "Save" or "Saved"; 123 More/Less IA:chevron-down; 124 Slow replay IAt:speaker-slow; 125 Say it IAt:microphone; 134 Practise it IAt:microphone, beside a new IAt:book "More phrases" (Home's 186) |
| `daily/DailyLibraryScreen.tsx` (4) | 60 IA:refresh; 68 Clear search IB:close; 70, 71 Previous/Next page IA:back and IA:forward in one row |
| `daily/DailyPracticeScreen.tsx` (4) | 161 Hear model IAt:speaker; 163 Hear my take IAt:speaker; 164 Try again IAt:replay (one row of three); 169 Add to review and practise recall IA:cards with label "Add to review" and that full sentence as the spoken label |
| `tabs/TutorTab.tsx` (4) | 214 `const primary =` IA:refresh; 222 IA:refresh; 261 Try Walk mode IA:headphones; 305 How your AI tutor works IA:info |
| `components.tsx` (2) | 1326 TutorCard {changeLabel} IA:edit; 1816 Sheet Close IB:close `tone="plain"` |
| `home/MissionHero.tsx` (2) | 175 retry IA:refresh (onInk); 185 {modes.other.label} IA:keyboard (onInk) |
| `practice/NextTaskCard.tsx` (2) | 70 IA:refresh; 89 Try the offline café line IA:cloud-off |
| `tabs/PracticeTab.tsx` (2) | 371, 374 IAt:chat "Choose a conversation" and IAt:replay {revisit.label}, in one row. The `doorNote` stays as a small line under the row |
| `practice/TuneSoundCard.tsx` (3) | 39 check IAt:microphone; 46 hear/stop IB:speaker; 55 guide toggle IA:chevron-down |
| `myfrench/PhraseBank.tsx` 81; `missions/ListeningPreview.tsx` 148-149 | one IB:speaker each (148 and 149 merge into a single toggling control) |
| `myfrench/OneLineCard.tsx` 114 | Again IAt:replay (grading row, practice-ux) |
| `RecapScreen.tsx` (8) | 249 footer "Finish conversation" RM (duplicates the header close `RoundButton … accessibilityLabel="Finish conversation"`, `:241`); 250 Previous IA:back, in a row with the pill; 255 IA:refresh; 262, 307 Practise this phrase IA:microphone; 298 Try this version IA:microphone; 378 Change time IA:clock; 382 {offer.decline} KEEP |
| `SummaryScreen.tsx` (2) | 206 Finish lesson IA:tick-circle; 258 Export to Anki IA:download |
| `ConvoScreen.tsx` (4) | 229 {finishLabel} IA:tick-circle; 1054 {QUIET_DOOR} IA:keyboard; 1294 Give me a moment and 1295 In English become IAt:moment and IAt:translate in a second row under the three ControlTiles (`:1289-1292`) |
| `DrillScreen.tsx` (4) | 530 help IA:hint; 652 I said it IA:tick-circle (check-draw); 800 save IB:bookmark (fill); 1585 retry IA:refresh |
| `drill/FixLineSheet.tsx` 49; `drill/FocusDrillPlayer.tsx` 117 | KEEP (Done; Finish here exit) |
| `recap/PrivatePractice.tsx` 122, 124 | IAt:speaker "Hear my tutor" and IAt:speaker "Hear my practice take" |
| `missions/MissionsScreen.tsx` (6) | 126 IA:refresh; 134 TYPE_INSTEAD IA:keyboard (onInk); 144 IA:chevron-down; 172, 174, 175 IAt:book, IAt:keyboard and IAt:chat in one row, with `LESSON_DOOR.minutes` as a small line under it |
| `soundcheck/SoundCheckScreen.tsx` (4) | 217 Choose a situation IA:map; 259 IA:refresh; 269 Open settings IA:settings; 286 I said it without assessment IA:tick-circle |
| `soundcheck/SoundJourneyScreen.tsx` (2) | 91 IA:refresh; 99 choose IA:map |
| `conversationPacks/ConversationPackLibrary.tsx` (8) | 239, 290, 307 Keep… KEEP; 242, 291, 310 Delete… KEEP (a data keep-or-delete pair); 274 Continue talking IA:chat; 297 Newest conversations IA:sort |
| `conversationPacks/ConversationPracticeScreen.tsx` (6) | 112, 141 Back to… IA:back; 118 Load sample IA:download; 166 Play slowly IAt:speaker-slow; 192 I can’t listen now IA:speaker-off; 194 Skip warm-up and recall IA:forward |
| `conversationPacks/ConversationsScreen.tsx` 275, 312; `SaveTextChoice.tsx` 34; `SavedTextScreen.tsx` 73, 76, 77 | 275 IA:document; 312 IA:sort; 34 IA:download; 73 Delete KEEP; 76 Load older IA:chevron-down; 77 IA:refresh |
| `tabs/FriendsTab.tsx` (12) (social-systems approval) | 34 IA:refresh; 43 privacy KEEP; 53 Invite a friend IA:user-add; 64 Join challenge IAt:tick-circle; 65 Decline/Cancel KEEP; 67 Share our postcard IAt:share, Choose a French scene IAt:map, Leave challenge KEEP; 72 Invite to a shared challenge IA:users; 73 Friend options IA:more "Options"; 76 Remove and 77 Block KEEP; 84 Mark updates as read IA:tick-circle; 87 reactions become compact IA chips with their words unchanged (the founder question below) |
| `friends/InviteFriendsScreen.tsx` (4) | 50 Share invitation IAt:share, QR toggle IAt:add; 56 Send friend request IA:user-add; 61 Accept IA:tick-circle; 62 Decline/Cancel KEEP |
| `friends/SocialSettingsScreen.tsx` (4) | 27 IA:refresh; 33 Unblock, the three on line 35, all KEEP; 36 {FRIENDS_START} IA:user-add |
| `goals/GoalStepScreen.tsx` (4) | 162, 189 IA:edit; 196 IA:refresh; 228 I used this outside the app IAt:tick-circle (check-draw plus `arrived()`) |
| `profile/TutorMemoryScreen.tsx` (7) | 102 IA:info; 119, 149 Edit IA:edit; 124, 136, 154 forget and remove KEEP; 204 Cancel edit KEEP |
| `progress/DayCount.tsx` 29; `phrases/PhrasebookScreen.tsx` 166; `nav/RootNavigator.tsx` 239, 393; `tutor/RealMomentScreen.tsx` 193, 270 | IA:refresh |
| `nav/RootNavigator.tsx` 245; `walk/WalkIntro.tsx` 13 | IA:home / IA:back |
| `progress/PostcardsScreen.tsx` 43; `progress/WeekWrappedScreen.tsx` 46, 47, 49 | 43 IA:forward; 46 IA:map; 47 IA:back; 49 IA:refresh |
| `tutor/RealMomentScreen.tsx` 198 | Not now KEEP |
| `walk/WalkRoom.tsx` (4) | 12 End now KEEP; 19 Open microphone IAt:microphone; 20 Say it again IAt:replay; 21 A little slower IAt:speaker-slow |
| `live/LiveErrorView.tsx` 111, 121 | IA:back "Back"; IA:settings "Check microphone settings" |
| `live/OutOfMinutesView.tsx` 15; `live/RoomWait.tsx` 14; `layout.tsx` 439; `tutor/SafetyStopView.tsx` 129 | KEEP (non-pressuring exits, leave, safety) |
| `wall/WallPlansPage.tsx` 130, 134-136; `wall/WallScreen.tsx` 384 | KEEP ("Not now", Privacy, Terms, Restore: billing truth and App Review) |
| `wall/WallScreen.tsx` 319, 347, 358, 383 | IA:refresh |
| `settings/SettingsScreen.tsx` 691, 944 KEEP; 832 | 832 IA:refresh |
| `auth/SignInScreen.tsx` 175; `auth/SetNewPasswordScreen.tsx` 121 | KEEP (counts pinned at `busyLabel.test.ts:113`, `SetNewPasswordScreen.test.ts:185`). The hand-rolled underlines at `SignInScreen.tsx:216` and `SignUpScreen.tsx:241` stay |
| `purchases/Paywall.tsx` (4), `friends/AddFriendsScreen.tsx` (4) | dead files (app-surfaces.md §1, §5): no change. File deletion candidates |

**Result:** about 61 GhostButtons remain, 8 of them in dead files. About 160 are converted.

**Ratchet test** `src/icons/callSites.test.ts`: the count of `<GhostButton\b` across `src/` and `App.tsx` must equal `GHOST_CEILING`, set to the measured post-sweep number, and may only fall. Every `<IconButton` and `<IconAction` tag has `label=`, and IconButton's `icon=` is one of the six.

### 3. Blank space and layout

#### 3.1 Vertical rhythm on the 4 pt scale

Add `export const RHYTHM = { inline: space(2), item: space(3), block: space(5), section: space(8) } as const;` to `theme.ts`, giving 8, 12, 20 and 32. Use it as follows:
- inline: icon to label, chip gaps;
- item: rows inside a card, the gap in an IconActionRow, choice gaps;
- block: card to card. This matches `PageArrival` at `gap 20` (`OnboardingMotion.tsx:85`) and `st.block` `marginTop: space(5)` on Home;
- section: header block to first card, and the bottom pad of every scroll body.

Replace the raw numbers in `PreAccountOnboarding.tsx`: `gap 4/8/10/12/16/20`, `paddingBottom: 20` (`:701`), `marginBottom: compact ? 8 : 12` (`:690`) and `minHeight: 44` (`:688`, use `HIT`). Do not add any `accessibilityRole="header"`: the count is pinned at 2 (`surfaceContract.test.ts:640`).

#### 3.2 Per screen: what fills the space

| Screen | Today (verified) | Change |
|---|---|---|
| 9 hear-it (blue) | Coffee and Tea are full rows with the same cup (`PreAccountOnboarding.tsx:740-753`); the phrase card is clipped under the footer (`layout.tsx:192-208`); "Hear" is a text link inside the card (`:760-765`) | Coffee and Tea become two side-by-side `Choice layout="tile"` (coffee sun tile, tea mint tile), saving about 76 pt. The phrase card becomes `Card` > `FrenchBlock ground="white" onHear` for both drinks, or a plain line "This phrase has no recording yet" (already pinned, `firstRun.test.ts:95`). The scroll body ends on `RHYTHM.section`. The footer hairline appears only when content scrolls under it (§3.5) |
| 8/7/6/5 questions | 3 to 5 cards end at about 52% of the height (youtube.md §2.2) with identical icons; there is a skip link under Next | The plan chip card from the onboarding and motion sections sits at the top (about 96 pt, real answers only). Options are `Choice` rows at 72 pt with 48 `IconTile`s and `RHYTHM.item` gaps. The reason page has six options. The skip links leave the footer, which is now Next only. The progress track is 12 pt on `paper.skeleton` (owned by onboarding). The remaining void is about 10% on a 6.1" phone |
| 4 plan (sun) | Five short lines plus two links, a 26% void (`:820-839`) | Plan card (ring, tiles), then a first-exchange preview (`FrenchBlock` of `task.prompt` with the tutor line), then `IconActionRow` [edit Change plan] [orb Choose tutor], then an AI row (OrbGlyph plus `STARTER_AI`, text unchanged, no `<Label` or `<Chip`: `practiceDisclosure.test.ts:26`) |
| 3 start sheet | Paragraph plus 9 controls; the off switches are invisible (`settings/SwitchRow.tsx:57`); the subtitle is cut off below the fold | Sheet close becomes IB:close. Disclosure becomes three icon rows in the same order: orb `STARTER_AI`, microphone `STARTER_PROCESSING`, lock `STARTER_LOCAL`, all before "I am 13 or older" (`disclosure.test.ts:293`). `SwitchRow` gains `ios_backgroundColor={paper.field}`. Footer: pill plus `IconActionRow` [Type instead] [Practise offline], keeping the exact text `label="Type instead" disabled={busy \|\| !draft.eligibilityConfirmed}` first in the tag (`disclosure.test.ts:442`). Privacy-safety approval required |
| 2 recap / 1 end | 5 and 4 stacked links about 64 pt apart, with voids | One icon row, and the celebration and plan header from the other sections. Back is removed on the success page (youtube.md §2.2, mistake 1) |
| Home | Lone grey `DayCount` (`tabs/HomeTab.tsx:161`), floating week lines (`:177-181`), page ends on a bare link (`:186`) | Hero, then the streak and goal card (streak section; it needs an edit of `HomeTab.test.ts:486`'s "days" ban, owned by that section), then the quests card, then DailyCard with its icon row, then friends. Week sentences go inside the streak card |
| Speak | Grey "See every scene" text inside a pressable card (`tabs/TutorTab.tsx:287`) | That line becomes a trailing `chevron-right` row; links are converted as in §2 |
| Practice | Identical `DocumentGlyph` rows (`tabs/PracticeTab.tsx:325, 362`); the day-one lead duplicates Home's blue hero | Rows get `IconTile`s: Hear, say and compare is headphones on sun; review is cards on mint; ReplayMomentCard is replay on blue; MakePhraseCard is quote on coral. The foot doors become an icon row |
| Progress | `DocumentGlyph` on week, postcards and fallback rows (`tabs/MyFrenchTab.tsx:164, 197, 198, 206`) | Tiles: phrases quote on sun; sounds waveform on mint; conversations chat on blue; goal flag on coral; saved bookmark on blue; week calendar on blue; postcards postcard on coral; unread refresh on sand. Level and streak cards (other sections) fill the first-visit page |
| Profile | The Settings row sits above the person header (app-surfaces.md §1) | Becomes an `IA:settings` "Settings" in the header trailing slot. Goal choices use `GoalDial` tiles |
| Settings | Text-only rows | Leading 40 `IconTile`s, as in the §1.4 settings row |
| Friends, Missions, Daily, Recap, Drill, Wall | stacked links | §2 rows; Wall's legal links stay as one wrapping row of text links |

#### 3.3 Consistency fixes

**Back and close:**
- `RoundButton` (`components.tsx:1611`) and `IconButton` are the only way back or out.
- Onboarding Back (`:692`) becomes IB:back.
- Sheet Close (`:1816`) becomes IB:close.
- `ScreenHeader`'s leave word (`layout.tsx:273-283`) stays a word, because it leaves something metered.

**French with audio:**
- Every French line that has audio uses `FrenchBlock`: onboarding (`:754-767`, `:1290`), `DailyCard` (`:115`), `PhraseBank`, `ListeningPreview`.
- `FrenchBlock`'s ear (`:1886-1894`) becomes `IconButton icon="speaker" tone="ink" animate="speaker-waves" active={playing} label={playing ? 'Stop' : 'Hear this line'}`.
- `OptionRow`'s text "Hear"/"Stop" (`:1739-1741`) becomes the same IB.

**One choice component:** see §1.6.

**Radii:**
- tiles and options: `radius.tile` (20);
- cards: 24;
- icon tiles: 0.3 of their size;
- buttons: `radius.control` (16).

There are no new tokens.

#### 3.4 Disabled Next and disabled pills

**Today:**
- `NextButton.tsx:41` paints disabled as `paper.inkSoft` (#5C5A74) with white words.
- `pillDisabled` (`components.tsx:981`) is the same colour.

Both read as live buttons.

**Change:**
- Ink-tone disabled becomes background `paper.skeleton` (#EFE6D6) with the label and arrow in `paper.inkSoft` (about 5.6:1).
- White-tone disabled, on blue, becomes background `onColour.blue` (#E4E1FF) with `paper.inkSoft` words.

**On enable** (answer chosen):
- background cross-fades to ink over `DUR.fast` (180 ms);
- pop 1 → 1.03 → 1 on `SPRING.pop`;
- one `Glint` (motion primitive).

**Tapping Next while disabled:**
- `NextButton` keeps the prop `disabled={answer == null}`, which `firstRun.test.ts:114` pins.
- It sets `accessibilityState.disabled` but takes the press: `soft()` haptic, the options lift −3 pt → 0 with a 40 ms stagger (never a shake), and the live region says "Choose one to continue."
- Reduce Motion: no lift, the text only.

#### 3.5 Footer hairline

**Today:** the footer rule is drawn on every paper screen (`layout.tsx:127`).

**Change:**
- `ScrollScreen` tracks `overflowing = contentHeight > viewportHeight + 1 && !atBottom`, from `onContentSizeChange`, `onLayout` and `onScroll`.
- It passes this to `Screen`, which draws the rule only when `onPaper && overflowing`.
- It toggles instantly with no animation, because `layout.tsx` drives no movement (`layout.test.ts:120`).
- This gives a "there is more below" cue that fixes the clipped-card illusion on screens 9 and 3.

**Test:** `layout.test.ts:259` (pinned title) changes its regex to `...(onPaper && overflowing ? { borderTopWidth: HAIRLINE, borderTopColor: paper.line } : null)`.

#### 3.6 iPad (portrait 744 to 1032 pt) and the wide web

**New helpers:**
- `responsiveLayout.ts`: `layoutClass(width, left, right): 'compact' | 'regular'`, where regular means usable width ≥ 700. Also `FOOTER_MAX = 480` and `SHEET_MAX = 640`.
- `layout.tsx`: `useLayoutClass()`. First-run screens may not measure the window (`surfaceContract.test.ts:785-803`), so they read the class from the frame, as they already do for `useCompactPhone()` (`layout.tsx:36-39`).
- `layout.tsx`: `<Columns>`. Two equal columns on regular (`flex: 1, minWidth: 0`, gap `RHYTHM.block`); stacked on compact.

**Regular-width rules:**
- The content column stays at max 800 (`responsiveLayout.ts:2-6`) and nav at 640 (`:8-10`). Fix `DESIGN.md:595-597`, which wrongly says 460.
- Home: streak card | quests card in `Columns`. Progress: level | week. Practice: next card | rows.
- Onboarding options: reasons become a 3 × 2 grid of `Choice layout="tile"`; levels and goals become one row of 3 or 4 tiles.
- Illustrations: `fit="large"`.
- The footer content is centred at `maxWidth: FOOTER_MAX`.
- `Sheet` panel: `alignSelf: 'center', width: '100%', maxWidth: SHEET_MAX` (`components.tsx:1811`).
- `IconActionRow` stays at most 4.
- Type is unchanged; Dynamic Type governs.

Two-column layout is never used inside the live room.

### 4. Stray text-node errors on web (335 per onboarding run)

**Cause (verified):**
- react-native-web's dev check (`node_modules/react-native-web/dist/exports/View/index.js:54-59`) logs `"Unexpected text node: " + item + "..."` for any string child of a View.
- The logged item is the **empty string**, not a full stop. That is why the message reads "node: . A".
- The source is `{stringState && (…)}` where the state is initialised to `''`:

| Site | State |
|---|---|
| `onboarding/PreAccountOnboarding.tsx:1014` and `:1047` | `issue` (`:145`) and `storageNote` (`:146`), both `useState('')`, rendered inside `PageArrival`'s `Animated.View` (`OnboardingMotion.tsx:108-124`). Two errors on every render; typing re-renders per keystroke |
| `PreAccountOnboarding.tsx:1163`, `:1238` | `issue` inside the Sheet's ScrollView content |
| `onboarding/StarterContinuation.tsx:216` | `note` |
| `onboarding/GuestAccountHandoff.tsx:177` | `error` |
| `settings/SettingsScreen.tsx:871` | `hapticTrouble` |

**Fix:** use `{issue !== '' ? (…) : null}` and the same shape for every site.

**Guard test** `src/textNodes.test.ts` ("no empty string reaches a view as a text node"):
- For each `.tsx` file, collect the names declared with `useState('')` or `useState<string>('')`.
- Fail on `\{[^}]*\bNAME\b\s*&&\s*[(<]`.

**Acceptance:** `npm run web`, then walk 9 → 1 typing a reply. The DevTools console shows 0 "Unexpected text node" messages (from 335).

### Files touched

**Create:**
- `scripts/icons/build-icons.mjs`, `svg.mjs`, `icons.config.mjs`, `icons.lock.json`, `custom/{check,speaker-slow,mouth,tea}.svg` (plus `flame.svg` if needed)
- `apps/mobile/src/icons/`:
  - generated: about 85 `<Pascal>.tsx`, `index.ts`, `names.ts`
  - hand-written: `Icon.tsx`, `IconTile.tsx`, `GoalDial.tsx`, `AnimatedIcon.tsx`, `places.ts`
  - tests: `icons.test.ts`, `callSites.test.ts`
- `apps/mobile/src/nav/TabGlyph.tsx`
- `apps/mobile/src/textNodes.test.ts`
- `docs/design-assets/ICONS.md` (generated)

**Edit:**
- `package.json`: `iconsax` 0.1.1 devDependency, `icons` script
- `components.tsx`:
  - append `IconButton`, `IconAction`, `IconActionRow`, `Choice`
  - glyph bodies become delegates
  - Sheet close, `OptionRow` hear, `OptionCard` wrapper
  - `FrenchBlock` speaker
  - `pillDisabled` and the disabled label colour
  - TutorCard link
- `glyphs.tsx`, `nav/icons.tsx`, `nav/LuvaniTabBar.tsx`
- `layout.tsx`, `responsiveLayout.ts`, `theme.ts` (`RHYTHM`)
- `onboarding/{PreAccountOnboarding,ChoiceCard,ChoiceArt,NextButton,GuestRecording,StarterContinuation,GuestAccountHandoff,FirstSceneScreen,plan}.tsx/.ts`
- `settings/SwitchRow.tsx`, `settings/SettingsScreen.tsx`
- `legal/Acknowledgements.tsx`
- every screen named in §2

### Tests and docs to change

Edit assertions only. Never rename a ledger-pinned title.

**Allow-lists, slicing and glyph tests:**
- `motion.test.ts:282-301`: add `icons/AnimatedIcon.tsx` and `nav/TabGlyph.tsx`. Lines 233, 259 and 304 are edited as described in §1.3 and §1.5.
- `glyphs.test.ts:45, 78, 90`: §1.3.
- `components.test.ts:484` and `:506-507`: the TutorCard regex `<GhostButton label={changeLabel}` becomes `<IconAction icon="edit" label={changeLabel}`, keeping the ordering checks.
- `components.test.ts:490, 800, 735-743`: §1.3.
- New describe "the icon controls keep their promises":
  - IconButton's `label: string` is required and its `icon` union has exactly 6 names;
  - both controls forward `accessibilityLabel ?? label`;
  - size comes from `HIT`;
  - disabled is inkSoft;
  - there is no `shadow`.

**Tab bar and layout:**
- `nav/tabBar.test.ts`: the F600 regexes stay. Add "the selected tab icon springs in TabGlyph and lands still under Reduce Motion".
- `layout.test.ts:259`: §3.5.

**Tests that spell `<GhostButton` at a converted site** (change only the tag and the icon):

| Test | Line(s) |
|---|---|
| `surfaceContract.test.ts` | 888, 2151 (`const primary = <IconAction`) |
| `tabs/HomeTab.test.ts` | 236, 265, 393, 472, 476 |
| `tabs/TutorTab.test.ts` | 81 |
| `tabs/PracticeTab.test.ts` | 189 |
| `RecapScreen.test.ts` | 123 (75 stays) |
| `recap/pages.test.ts` | 32 (assert the header `RoundButton kind="close" accessibilityLabel="Finish conversation" onPress={onDone}` instead) |
| `daily/carousel.test.ts` | 26-29 |
| `daily/tutorAudio.test.ts` | 121-124 |
| `settings/SettingsScreen.test.ts` | 188 |
| `conversationPacks/SavedTextScreen.test.ts` | 10 |
| `revamp/uxControls.test.ts` | 41 |
| `missions/ListeningPreview.test.ts` | 92 |
| `missions/chooserView.test.ts` | 265 |
| `live/typedDoor.test.ts` | 193 |
| `tutor/RealMomentScreen.test.ts` | 68 |
| `friends/friendsView.test.ts` | 98 |
| `soundcheck/SoundJourneyScreen.test.ts` | 53, 56 |
| `revamp/stage3.test.ts` | 18 (LiveErrorView `/<GhostButton/` becomes `/<IconAction/`) |

**Onboarding tests:**
- `onboarding/firstRun.test.ts:118`: the `Choice` region moves into `components.tsx`.
- `firstRun.test.ts:114`: the skip strings change, owned by the onboarding section.

**Tests that need no change**, because the label strings are kept:
- `practiceDisclosure.test.ts:26` (`label="Back"`)
- `firstRun.test.ts:97, 116, 120`
- `preAccountDraft.test.ts:173-185`
- `disclosure.test.ts:442-446`
- `LiveErrorView.test.ts:57-61`
- `uxControls.test.ts:10`

The pill and LedgerRow counts (`surfaceContract.test.ts:1772-1835`, F342/F406/F569) are also unaffected: IconAction is neither tag. Any GhostButton turned into a `LedgerRow` on a tab must update the `ledger` map at `:1812-1825`, and this plan does none.

**Docs:**
- `DESIGN.md`:
  - Icons bullet (`:403-411`): "Iconsax-sourced, generated, Linear for controls, Bulk for tiles and states".
  - GhostButton bullet (`:348-351`): rare text links, with the KEEP categories.
  - New IconButton, IconAction and Choice bullets.
  - Tab bar bullet (`:367-371`): selected Bulk with one pop.
  - Footer rule, iPad section, and the 460 correction.
  - If the Motion sentence pinned by `surfaceContract.test.ts:2134` (F407) changes, edit that assertion with the motion section.
- `docs/DEVICE_VERIFICATION.md`: add icon, VoiceOver, iPad 834 and 1032, and web-console checks.

**Ledger** (`docs/KNOWN_ISSUES.md`, allocate from F716 at filing, all P2, each with `verified-by` naming the new titles):
- icon set licensed and generated;
- text links replaced by icon controls;
- empty-string text nodes on web;
- disabled Next reads live;
- footer rule only when content scrolls;
- iPad regular-width layout.

### Owner agent

| Part | Owner |
|---|---|
| `scripts/icons`, `icons/`, `IconButton`, `IconAction`, `Choice`, `nav/icons.tsx`, `LuvaniTabBar`, `TabGlyph`, `layout.tsx`, `responsiveLayout.ts`, `theme.ts`, DESIGN.md Icons and Surfaces | `design-system-engineer` (escalates the licence to the founder, `design-system-engineer.md:18-20`) |
| Tab and screen sweeps, `surfaceContract.test.ts` integration | `frontend-engineer` |
| Onboarding sweep, text-node fix, NextButton, ChoiceArt, plan.ts gloss | `onboarding-ux-engineer` |
| Start-sheet disclosure rows, Acknowledgements wording | `privacy-safety-engineer` |
| Drill, Review, Daily, Phrasebook, SoundCheck, ConversationPractice, OneLineCard | `practice-ux-engineer` |
| Reminder bell, DayCount, WeekWrapped, Postcards | `progress-retention-engineer` |
| Wall links stay text | `revenue-engineer` (confirms) |
| Friends | `frontend-engineer` builds; `social-systems-engineer` approves |
| Device evidence (iPhone, iPad, web console) | `qa-release-engineer` |

### Risks

- **Iconsax naming and package maturity:**
  - `iconsax` 0.1.x is new, and its catalogue names (`arrow-left-01`, `refresh-left`) differ from v1.
  - Some needed names (microphone, volume, medal, people) were not visible in my truncated read of the manifest.
  - The build fails loudly; resolve each name or fall back to Phosphor.
- **Stroke weight:** Iconsax is drawn at 1.5. Rendering it at `STROKE` 2 keeps one pen but can clog small details such as the bell dots or the inner lines of `note-2`. Review a contact sheet on device.
- **Licence scope:** the free licence is for one individual, and loose files are forbidden. A raw SVG committed by mistake breaches it; `icons.test.ts` must fail on any `.svg` under `src/`.
- **AnimatedIcon depends on Reanimated** (a native rebuild). Static icons are JS plus react-native-svg and could ship over the air first. AnimatedIcon and TabGlyph ship with the new binary.
- **Test churn:** about 25 regex edits across 18 test files. A rename by mistake breaks the gate through ledger titles.
- **Dynamic Type:** tile rows at AX5 must wrap. Verify on device; there is no renderer in tests.
- **Truthfulness:** bookmark, bell, cloud and lock animations must fire only after the persisted or confirmed result, never optimistically.

### Open questions for the founder

1. **Licence holder.** The Iconsax free licence is personal: "Users: ONE (Individual)", non-transferable. Will you accept it in your own name? If outside contractors will regenerate icons later, the Iconsax Team plan or the Phosphor (MIT) fallback avoids the restriction.
2. **Stroke weight.** Should the line icons use Luvani's current 2 pt pen (bolder, one weight across the app; recommended) or Iconsax's native 1.5 pt (lighter, closer to the Iconly look you referenced)?
3. **Friends reaction words.** The reactions are "Bravo!", "Bien joué!" and "Nicely done" (`friends/socialModel.ts:19`). Founder decision 14 says no French interface praise at wins. Should these friend-to-friend reactions become English, or stay as French chips because a friend sends them, not the app?