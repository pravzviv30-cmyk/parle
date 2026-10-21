# Design

<!-- Recorded from the built artifact, not from intentions. Every value below is
     read out of apps/mobile/src/palette.ts and theme.ts, and palette.test.ts
     fails if this document and the code disagree on a colour. -->

## One system: Bright Luvani

Luvani has one design system, direction B, "Bright Luvani" (DECISIONS.md,
19 October 2026). It replaces the three that ran side by side: the C2 "bold
rhythm" onboarding look, the Luvani theme on the paywall and account screens,
and the earlier revamp B composition. The tokens are already one set. Screens
move onto the shared parts in two later steps: A2 rebuilds the buttons and
cards in `components.tsx`, and A3 changed the tab bar to five tabs. The old
token names (`boldRhythm`, `mainApp.light`, `boldType`, `paper.lineOnCard`)
stay exported as aliases, so nothing breaks and nothing drifts.

The world is warm paper, white cards, one deep ink and Outfit. Four saturated
colours lead a screen or report the tutor's state, and four soft pastels
(butter, lavender, peach, sage) carry illustrated Explore cards. Chartreuse is
a highlighter pen, never a surface. One soft lift sits under an illustrated
Explore card and nowhere else. There are no gradients, no uppercase metadata,
no italic French and no nested white cards.

The game layer is real and earned: the streak (`StreakScreen`), the level and
its XP (`game/LevelXpCard`), today's quests (`game/QuestsCard`) and badges.
Every number comes from saved records, never from a guess, and a missed day is
never a punishment. There are no visible Friends ranks and no rank names.

Learners see five stages: Starter, Basics, Everyday, Chatting and Confident.
CEFR levels (A0, A1 and up) stay internal, in code and in these docs.

Dark mode is on for the main app (DECISIONS.md UI-008). Every screen stays
light until it is rebuilt to its artboard in both themes and its route joins
`DARK_READY`; onboarding stays light by rule. See
[Dark mode and the B tokens](#dark-mode-and-the-b-tokens-ui-008).

### Layout

Layout follows viewport size, safe areas, font scale and rotation, never phone
model names. Compress decorative art first, keep every target at least 44
points, and let reading and action regions scroll at large text or in
landscape. Frames have 24-point gutters and a reading column at most 560 points
wide; on the web the app is a 460pt centred column. The full billed amount and
period stay near a purchase action, and large text is never capped to fit.

### Composition rules

- Five tabs: Today, Explore, Speak, Practice and Journey (route names `Home`,
  `Explore`, `Tutor`, `Practice`, `MyFrench`). Profile opens from the
  labelled avatar; Settings is its first row and optional Friends follows it.
  Route identifiers and the Friends URL stay stable.
- Every view model below lives in a plain module (`home/todayView.ts`,
  `main/exploreView.ts`, `tutor/speakTabView.ts`,
  `practice/practiceTabView.ts`, `journey/journeyView.ts`,
  `scenes/scenePreview.ts`, `practice/fixesView.ts`,
  `journey/thenNowView.ts`); the screens are layout. A design line with no
  data behind it is not drawn, and a section with nothing true to say is
  hidden rather than filled.
- Lock badges come from one seam. A surface draws `LockBadge` only when
  `access/featureAccess.ts` answers locked, and that seam mirrors
  `purchases/featureLocks.ts` (`featureLockedNow`, failing open). A locked
  item that has no route of its own opens the Wall through `tapThrough`.
- Stage words, never CEFR: Starter (A0) and Basics (A1) on Journey, Speak and
  the scene preview of a guided mission, then Everyday, Chatting and Confident
  as Journey's future stages that claim nothing. "Starting out" survives only
  as Explore's tier filter chip, and a daily scene's tier.
- Help is said in words only, the ladder's four: Line given, Choices, Hint and
  On your own (`HELP_WORDS`). No number, percentage or dot stands for help.
- Live speaking time is a band in words (plenty, a little, none) from
  `purchases/planStatus.ts`, never a count of minutes or a date. A scene's
  length is an estimate said as "about n min".
- Today, top to bottom: "Bonjour, Name." (one word all day, no question under
  it), a white stats row of three tiles (streak, today's goal ring, numbered
  level) with decorative discs, the sun next scene card with its stage place
  ("Next scene, 2 of 3") and a "Uses" chip only when the last conversation's
  phrase is one of the scene's lines, today's three quests ("n of 3 done", XP
  chips in butter and sage), one fix to try (English only before the try, and
  only when the drill would open on an exercise that hides the French; "Your
  line from {day}" when the conversation's day is known, and the drill then
  shows the moment after the first answer), today's phrase on lavender, Coming
  up (the latest life event the tutor remembers, "{when}, {tutor} remembers",
  the trial pill from the tutorMemory lock, Rehearse now to RealMoment and Not
  now for this app session; no countdown or checklist until Phase C; hidden
  with no event or with memory paused), and the blue week card ("n minutes
  practised, n phrases saved" over seven local days, with "See your week" in
  the Monday line's slot and the cloud-heart drawing; absent with no evidence).
  Rebuilt to the artboard in light and dark on 2026-10-20 (UI-008); the blue
  practice and review leads, "Where you're starting" and the friends card left
  Today. Loading never claims the learner has no history.
- Explore: search, then four filter chips (Starting out, Under 5 min, Free,
  offline, With your tutor), Prepare for something real with its badge, the
  topic tiles, situations, a blue "Live with your tutor, picked for you" card
  from the learner's own answers, a little practice, and words and phrases.
  Each situation opens the scene preview. Rebuilt to the artboard in light and
  dark on 2026-10-20 (UI-008) from `explore/ExploreParts.tsx`, with the art,
  pastels and badges decided in `main/exploreArt.ts`: the chips and A little
  practice (every real door) run off the right edge; the topic tiles carry
  their canvas drawing on a circle and floor ellipse with the lift; Take the
  conversation further shows the lavender "Free sample" pill or the round lock
  from the Explore access labels. "free, offline" never appears on a live
  situation.
- Scene preview: a full-bleed `heroGround` band at the top (sun in light,
  plum in dark; under the status bar, radius 0 0 36 36, the back button and
  the scene's topic drawing inside it, the café table where the canvas has
  none) with topic and stage, the English and French
  titles and minutes; what you'll practise; "The barista might say" only where
  an authored opener ships on the device, otherwise "You could start with" the
  learner's own opening line; the lines with hear buttons; the 56pt Start
  with the tutor; and the 48pt free practice of the lines, which uses no speaking time. An
  unknown id says so and returns to Explore.
- Speak (rebuilt to B-Speak in light and dark, UI-008, 2026-10-20): the
  subtitle names the tutor; the `heroGround` Recommended card carries the
  café drawing, the scene's goal, its minutes and "Uses speaking time" as
  `heroChip` pills, the Speak/Type radios on the `butter` track (the chosen
  cell on `heroChip` with a tick), the two preference chips outlined in
  `heroText`, "Prepare first, free" to the preview and the 54pt `heroCta`
  Start; the stage's starter scenes as one card of rows on sage, sun or
  lavender tiles with the check, the brand Next pill or a chevron; "Same
  scene, a bit less help" on a card with a dashed `periwinkle` edge only when
  a replay would really start with less help (the twist; authored twists wait
  for D2); the `brand` Talk about anything card whose chips are the learner's
  remembered interests and life events (else their own suggestions) and their
  own topic on `violet2`; the tutor row (orb, Change voice, lavender speaker;
  the signature shows while the sample plays); three drawn pastel tiles
  (three, two or one to a row from `tileColumns`, so a title never breaks
  inside a word); and the minutes band with See your minutes.
- Practice leads with the learner's conversations: a search over this page's
  titles and summaries (on the device), topic tabs, Pick up where you stopped,
  Comes up often (one authored pattern, never a count; the card opens Your
  fixes and "Practise this" a drill when one exists), the newest conversation
  as the large butter-banded card (its fixes, three steps, Talk about it
  again) and older ones as small cards (Practise it, Talk again), then the
  Mix, Saved phrases ("Used n times" from each card's own counter, never a
  count of conversations) and Saved conversation text, then the sound guide
  and compare. No minutes on a step, the mix or a pattern. With no
  conversation, the empty page offers a first one, Café basics (its cost
  line, no "free") and Sounds of French, each with the round lock when the
  seam says `sounds` is locked, and the dashed saved box. Rebuilt to
  B-Practice and B-Empty-Practice in light and dark (UI-008, 2026-10-21).
  Shadowing plays the tutor's bundled audio, records a temporary local take
  and offers comparison without judging it; finishing records an active date
  only after a durable write.
- Your fixes: This conversation or All conversations, then Comes up often.
  Attempt before reveal: the first untried fix is the try-first card (its
  English only, Say it or Type it), every other untried fix a collapsed row
  with Try it, and the learner's line, the better French and the reason show
  only after a try. Phrases from the conversation follow, and Practise all
  fixes is free. Rebuilt to B-Fixes in light and dark (UI-008, 2026-10-21).
- Journey ("Your journey"): with no finished scene, the butter card with the
  map-route drawing and its one 46pt "Start {scene}". Otherwise a full-bleed
  brand band (stage eyebrow, title, card-filled avatar, the sun Level pill with
  its 8pt XP bar, and up to three white stat tiles: days in a row, min
  practised, phrases saved; an unread figure is left out), Where you are (five
  38pt nodes on a track, the current one brand with a lavender ring and
  "You’re here" under its name), What you can do (check, half ring or empty
  ring, with no "n of m" count), Then and now (first and best cells, dashed
  until there is a best), French you've used as lavender chips, the mint Help
  you needed card with the tutor-orb, Your sounds (letter tiles, one Practise
  link) only with a saved check, Your week in words as three dot rows, and the
  Postcards and Badges tiles. A locked section keeps its heading and badge with
  one teaser line. Rebuilt to B-Journey and B-Empty-States in light and dark
  (UI-008, 2026-10-21); the Badges sheet stays light until its parts are.
- Then and now: the help legend (four bars: Line given, Choices, Hint, On your
  own), then one card per guided scene with its icon tile, the first try we
  still have next to the best (each a help word, a bar and its date), a dashed
  "Try again to see your best here" and a 44pt Try it again (to the scene
  preview) while there is no best, and a one-line card for a scene not tried.
  Free conversations do not appear, and the footer says why. Rebuilt to
  B-ThenNow in light and dark (UI-008, 2026-10-21).
- Review (B-Review, B-ReviewReveal, UI-008, 2026-10-21, light and dark): the
  butter ground (M3 ochre in dark) and the 44pt close disc, with the header's
  centre left empty because the founder holds the "3 of 5" count back. The
  white card (radius 28) carries the tag pill, "From {conversation}" when the
  phrase came from a pack's correction, "How would you say this in French?",
  the prompt at 27 bold and the cafe-table drawing in its corner; I said it
  (56, mic glyph only, nothing records) and Type it (50, which opens the field)
  sit under it with "Have a go first. The answer shows after." Turned over, the
  French sits in the mint panel with a 48pt speaker, "Also fine:" shows the
  drill bank's other accepted French when there is one, "You said it" or "You
  typed" follows, and the grades are three filled 64pt tiles (Again, Got it,
  Easy) with no interval line, held by the founder.
- Drill (B-Drill, UI-008, 2026-10-21, light and dark): the lavender ground
  (plum in dark), the close disc, the sitting bar where Phase B drew it and
  "Phrase four of eight" only in a practice sitting. The build exercise is the
  brand eyebrow, the English at 26/800, "Tap the words in order.", the answer
  box (2pt periwinkle) with brand word tiles, and the bank, where a placed word
  leaves a dashed slot and a free word is a white tile on a ring lip. Other
  exercise kinds keep their cards, drawn from the theme.
- Empty states (B-Empty-States anatomy, `empty/EmptyStateCard.tsx`): radius 26,
  padding 20/18, the drawing, a 19 bold title, a 15/1.45 body and one 46pt ink
  button. Review and the drill bank with nothing due use cloud-cheer with Done;
  Speak's away card is lavender with coffee-break, the retry and the bundled
  offline line; Speak's out-of-time card (clock-calendar) shows only on the
  free plan with nothing left, says the refill in the plan band's own words
  and opens the plans. The phrase, conversation and memory pages use the
  phrasebook drawing with Choose a scene; those three routes stay pinned light.
- Live rooms keep the real start, pause, type, help, slower, English and leave
  paths. Since 2026-10-21 (UI-008, B-Live and B-LiveHelp) the room keeps its
  blue ground in both themes: the leave disc, the scene and its pace ("About N
  min", the scene's own pace, never the allowance), the goals strip (done,
  current, to do), the tutor-orb art pulsing with the real room levels, the
  tutor's last line in a card bubble and the learner's words in sun, then
  Type, the sun mic and Help. Help opens the cream sheet (the M3 ground in
  dark): what the tutor asked, the ladder Hint, Choices, Line given over the
  live rung, the rung's content, "More help: show the line", "Say your choice"
  and the footnote; Simpler, Give me a moment and In English sit under it.
  The full transcript stays one tap away. Parts in `live/LiveParts.tsx`, rules
  in `live/liveRoomView.ts`.
- The end of a conversation reads After a session (blue: the cheer, "Bien
  joué.", minutes, new phrases and XP, the line said well with "Hear it said",
  the day and this week's bars), then the Celebration only for a core-earned
  can-do (blue: "You can now", the ability, the postcard, "Next:"), then the
  Recap (lavender band with the goals, your lines with "Hear it said", one
  phrase kept on the sun card, small fixes), a sound page only for a saved
  check and a next page only when there is a useful next action. "Hear it
  said" is the tutor's device voice, never a recording of the learner.
  Closing is always there. Parts in `recap/RecapParts.tsx`, rules in
  `recap/afterSessionView.ts`.
- Voice, name and reminder choices open on a modal sheet over their page.
  Choosing updates the choice; Done closes it. Hear is separate from choosing.
- Paid amounts come from the catalogue and prices from the store. A room that
  runs out of minutes opens the central plans wall. Purchase success needs a
  freshly confirmed entitlement.
- French carries its language and sits larger than its English gloss. One
  primary pill per door, followed by quiet secondary actions.

### Onboarding and first arrival

The onboarding flow follows the approved
[Figma flow](https://www.figma.com/design/sjAwoGinWQKvhGrWbgMO18?node-id=58-364);
release holds live in the [change plan](docs/changes/bold-rhythm.md). Its
colours are the B pastels and colours above, reached through the
`boldRhythm` alias table, and its type is `boldType`, which A2 folds into the
one scale.

**Direction B rebuild (2026-10-21, UI-008, artboards B-OB-Welcome, B-Question,
B-OB-Q2 to Q6, B-OB-Plan, B-OB-Tutor, B-OB-Ready, B-OB-FirstScene,
B-OB-Consent).** Onboarding stays pinned light (founder decision): the parts in
[BOnboardingParts.tsx](apps/mobile/src/onboarding/BOnboardingParts.tsx) read
`useB()`, which resolves to `b.light` outside the main appearance provider.

- **Welcome:** the brand page with the canvas friends drawing on a sun disc,
  confetti and three French speech bubbles; "A little French." with "A bigger
  world." in sun (40/800), three deep-blue promise chips and the 60 sun button
  with its pressed edge.
- **Questions:** each page bleeds a band under the clock (bottom corners 48):
  the 6-point progress bar and "n of 6", then a 156 halo and its canvas
  drawing. Reason is sun with voice-chat, interests brand with phrasebook,
  level mint with watering-plant, confidence sun with coffee-break, time brand
  with clock-calendar, focus mint with star-jar. Answer rows are white, radius
  18, min-height 64 (58 on the reason page, which carries the small icon
  drawings and no sublines); a chosen row fills brand with a sun tick disc, or
  a rounded sun square for interests, which are checkboxes.
- **Plan:** a sun band with map-route and the learner's answers as white chips;
  then the five stages with the learner at Starter, the first three scenes and
  the blue How it works card.
- **Tutor:** a brand band with the canvas orb (never a face); six white voice
  rows, the chosen one brand, each with a 44 speaker. Hearing never chooses.
- **Before we start:** a brand band with the orb; an info card with three
  tinted-disc rows (AI, microphone, what is kept), then the optional choices as
  50 by 30 switches, off by default.
- **First scene and Save your plan:** a sun band with the café table and a
  brand band with the star jar.

The artboards' back discs keep their 44 place empty: onboarding has no visible
previous control (F352); platform back still goes back. Bands read the top
inset from the onboarding frame (`useOnboardingTopInset`), and the status bar is
light on blue bands and dark on sun and mint.

The original illustration family is 127 local SVG layers exported from Figma,
with provenance and hashes in
[manifest.json](apps/mobile/assets/c2/manifest.json), composed by
[C2Scene.tsx](apps/mobile/src/onboarding/motion/C2Scene.tsx) through
`motion/drive.ts`. Screen activity, `SceneActivity`, AppState and live Reduce
Motion control the clock; unknown motion preference shows still art. Plan art
pauses while its edit sheet is open.

Page changes use the shared interruptible 300 ms fade and slide with one
advancement lock. Progress fills four route-derived stages. Sign in, the account
welcome and Today have no onboarding strip. Welcome to Luvani is a still page
with an explicit Continue; only its logo ring turns, after 800 ms, over 8.8
seconds, and the page never dismisses itself.

Every live tutor surface uses the shared room: a soft blue and lavender orb
above tutor and learner bubbles, a transcript control, a composer in typing
mode, and a compact Speaking/Typing control beside End session. Focus or a
visible keyboard hides the mode and end controls. Tapping the composer reveals
the latest sent learner bubble and keeps it above the composer through keyboard
changes; a manual scroll takes control, and reading older lines offers Jump to
latest. Practice support starts closed and opens only on the learner's tap. A
text-only grant cannot turn on speech. A tutor leaving an otherwise connected
room shows the existing connection failure and keeps an earned recap. See
[live voice](docs/LIVE_VOICE.md#c2-room-presentation).

An earned first session ends on a blue Well done page with a celebrating cloud
and one confetti burst, then an achievements page. Counts, phrases and
completion claims come from saved records; a partial session stays calm, and
opening a streak page awards nothing. Terms and Privacy notices come before
Start practice, Create account and repair Continue. The 13+ declaration is not
age verification. Before we start keeps the AI notice and retention summary on
the main page. When anonymous live admission is off, the same layout offers
Create account to start, an existing-account link and retry; the answered plan
and chosen tutor survive account and Back detours. See the
[onboarding contract](docs/ONBOARDING.md#account-handoff-when-guest-live-is-unavailable).

### Paywall and account

Paywalls and their states, Profile, Settings, Learning preferences and
Subscription use the B tokens through the `mainApp.light` aliases and Outfit.
The single action is the primary pill. The Yearly/Monthly switch sits on a
lavender track with the chosen segment white. The trial timeline uses sun
markers with ink glyphs on a sun rail. There is no hero art. The billed amount
is the most prominent price, and a reminder line appears only when a reminder
is really scheduled. Text links use the brand blue; destructive labels and the
purchase-failed title use `danger`.

- Subscription timelines use real store trial eligibility, duration and local
  prices. Restore, terms, privacy and a clear exit stay visible.
- Profile, Settings, tutor memory and their sheets keep their existing
  confirmations, validation and operation owners.


## Colour

Bright Luvani: one warm paper ground, white cards, one deep ink, four
saturated colours that each lead a screen or report the tutor's state, and four
soft pastels for illustrated cards. The 19 October 2026 consolidation folded the
C2 and Luvani-theme duplicates into these values: their muted text is `inkSoft`,
their borders and the old hairline are the one `line`, and the C2 sand is
`inset`. Every raw value lives in `apps/mobile/src/palette.ts`, which
imports nothing so that `palette.test.ts` can hold it to a contract. `theme.ts`
composes its tokens from there and carries no raw hex of its own, and no other
source file writes one either. The tables below are that palette, read back out
of the code: `palette.test.ts` fails if this document and the export disagree on
a single value, or if either names a token the other lacks.

The contract has three floors. Words clear 4.5 against whatever they sit on. A
mark that reports state clears 3. Two colours that mean different things stay a
Delta-E of 30 apart, so neither reads as the other.

### Paper and ink

One ground, one white, one ink, one soft ink and one hairline. B has no pressed
wash, no third ink and no second hairline, so the old names that asked for one
(`groundDeep`, `inkFaint`, `lineOnCard`) are aliases of the one B value until
their screens move. `inset` is the recessed well inside a white card (a track,
a quiet field), and `inkOnPastel` is the secondary line on a pastel. `skeleton` is new: loading blocks, and the one fill the
first three rungs share. `field` arrived with Stage 2: the border of an input
and the ring of an unchosen option, a mark and never words.

| Token | Value | Role |
|---|---|---|
| `paper.ground` | `#FFF6E9` | The page. Every working screen sits directly on it |
| `paper.skeleton` | `#EFE6D6` | Loading blocks, and the rung fill |
| `paper.groundDeep` | `#EFE6D6` | Alias of `skeleton` until Stage 6 |
| `paper.card` | `#FFFFFF` | Cards and tiles. White, no hairline, no shadow |
| `paper.ink` | `#16123A` | Primary text, the primary button, the dark live ground |
| `paper.inkSoft` | `#5C5A74` | Secondary text on paper or white, never on a colour |
| `paper.inkFaint` | `#5C5A74` | Alias of `inkSoft`: counts and placeholders are words |
| `paper.line` | `#F0E6D6` | The one hairline, for decorative dividers only |
| `paper.lineOnCard` | `#F0E6D6` | Alias of `line` |
| `paper.inset` | `#F5EEE2` | A recessed well inside a white card, never on the ground |
| `paper.inkOnPastel` | `#4A4766` | The secondary line on a pastel (6.5 or more on each) |
| `paper.onInk` | `#FFFFFF` | Text and icons on a filled ink, blue or coral control |
| `paper.field` | `#8A8499` | The 1.5pt input border and the unchosen option ring. A mark, never words |

Ink clears 16.6 on the ground, 17.8 on a card and 14.4 on the skeleton. Soft
ink clears 6.2 on the ground and 6.6 on a card. The card lifts off the ground by
a Delta-E of 7.9, the hairline sits 5.8 off the ground and 12.3 off a card, and
the skeleton 5.9 off the ground. The hairline is decorative and never the only
edge of a control. Soft ink clears 5.8 on the inset. The field border clears 3.6 on a card, the
floor for a mark.

### Four colours

One colour leads a screen at most; the rest is paper, white and ink. What may
sit on each is fixed, and the other way round is a forbidden pair: no white on
sun or mint, no ink on blue or coral, and no soft ink on any colour.

| Token | Value | Text on it |
|---|---|---|
| `colour.blue` | `#3B2FE0` | White (7.9). The brand: onboarding, the next-scene card, the selected tab |
| `colour.coral` | `#D63A22` | White only (4.7), never below 14pt. The tutor speaking, the recap cover |
| `colour.sun` | `#FFC93C` | Ink (11.6). Thinking, the plan, the focus sound |
| `colour.mint` | `#2FD18B` | Ink (9.0). Your turn, a can-do earned, a done tick |
| `colour.bluePressed` | `#2A20B0` | White (10.9). A blue control under a finger |
| `colour.mintWash` | `#D4F5E5` | Ink or `mintWords`. A pale wash behind a done or earned state |
| `colour.mintWords` | `#1F7A52` | Green words: 5.3 on white, 4.5 on `mintWash`. The only green that letters text |
| `colour.ring` | `#D9CFE9` | No words. A decorative ring or track, 1.5 on white, so never the only edge of a control or a mark that means something |
| `colour.violet2` | `#5A50EA` | White only (5.6). A chip ground on a blue card. `onColour.blue` is 4.4 on it, so it never sits behind that text |

Where the artboards write a near twin of `onColour.blue` for the soft line on
blue, the app uses `onColour.blue` itself, so there is one value, not two.

### Pastels

Four soft grounds for illustrated Explore cards and gentle section cards. They
never carry a primary action. Words on them are ink; a secondary line is
`inkOnPastel` (7.1 on lavender, 7.3 on butter, 6.5 on peach and on sage). The
onboarding answer cards use the same four through `boldRhythm`.

| Token | Value | Role |
|---|---|---|
| `pastel.butter` | `#FFE8AB` | Butter card |
| `pastel.lavender` | `#E9E3FA` | Lavender card, and the paywall's switch track |
| `pastel.peach` | `#F7D8C7` | Peach card |
| `pastel.sage` | `#D4E2D7` | Sage card |

### Streak celebration

The earned streak screen has a scoped darker green ground, warm original flame
layers and cream summary. Text and the completed-day check use the same navy
ink; these pairs clear the text contrast floor. Flame layers and grounding shadow
are decorative.

| Token | Value | Role |
|---|---|---|
| `streakCelebration.ground` | `#1CB982` | Earned streak screen |
| `streakCelebration.flame` | `#EE6031` | Outer flame |
| `streakCelebration.orange` | `#FF9539` | Inner orange layer |
| `streakCelebration.gold` | `#FFD45A` | Inner golden layer |
| `streakCelebration.tipHighlight` | `#FFF0B6` | Tip highlight |
| `streakCelebration.coreHighlight` | `#FFF6D4` | Core highlight |
| `streakCelebration.shadow` | `#146B55` | Decorative grounding shadow |
| `streakCelebration.cream` | `#FFF6E9` | Summary (aliases `paper.ground`) |
| `streakCelebration.ink` | `#16123A` | Text and check (aliases `paper.ink`) |

### On a colour ground

The words on each ground and the secondary line under them are fixed per
ground, so a part set on colour never chooses. `textOn` is the words: white on
blue and coral, ink on sun and mint. `onColour` is the secondary line, a meta
line or the English under a French line, because soft ink is never set on a
colour; coral has one text colour and takes white, and `ink` is the live
session's dark ground. Every one is words and clears 4.5.

| Token | Value | On |
|---|---|---|
| `textOn.blue` | `#FFFFFF` | Blue, 7.9 (aliases `paper.onInk`) |
| `textOn.coral` | `#FFFFFF` | Coral, 4.7, never below 14pt (aliases `paper.onInk`) |
| `textOn.sun` | `#16123A` | Sun, 11.6 (aliases `paper.ink`) |
| `textOn.mint` | `#16123A` | Mint, 9.0 (aliases `paper.ink`) |
| `onColour.blue` | `#E4E1FF` | Blue, 6.2 |
| `onColour.coral` | `#FFFFFF` | Coral, 4.7: white is coral's only text colour (aliases `paper.onInk`) |
| `onColour.sun` | `#3E3A56` | Sun, 7.0 |
| `onColour.mint` | `#3E3A56` | Mint, 5.5 |
| `onColour.ink` | `#C9C6DE` | Ink, 10.7 |

The story segments draw the done bars in the ground's `textOn` and the pending
bars in `segmentPending`, a decorative tint of the ground that says nothing on
its own: the segments are one element to a screen reader, "Step 2 of 6".

| Token | Value | Pending bar on |
|---|---|---|
| `segmentPending.blue` | `#7F78EB` | Blue |
| `segmentPending.coral` | `#E47F6F` | Coral |
| `segmentPending.sun` | `#D0A43C` | Sun |
| `segmentPending.mint` | `#2AAB7B` | Mint |
| `segmentPending.paper` | `#F0E6D6` | Paper: the one hairline (aliases `paper.line`) |

`lilac` belongs to the flat illustrations and to nothing else, as
ILLUSTRATIONS.md allows it. `palette.test.ts` walks the source: the token is
spelled only in `palette.ts`, `theme.ts` and the files under `src/art/flat/`.

| Token | Value | Role |
|---|---|---|
| `lilac` | `#B9A7FF` | A fill inside the flat illustrations only |

### Ink identity, one highlighter

The primary action and the labels are ink, and `accent.label` equals
`accent.primary`. `accent.brand` is the blue, pinned to `colour.blue` so a second
brand cannot creep in, and held a Delta-E of 30 from every orb state, the
highlighter, the rung fill and the tutor's mark. The chartreuse is one pen,
`highlight`, legal in exactly two places: the `Highlight` band behind a French
line and the `LevelPath` "you are here" stop. The brand mark, Hum, carries none
(see Brand mark and launch). At most one per screen, always under ink, and never
the ground of a panel, tile, avatar, tab, title, card or button.

`accent.feature` is retired. `palette.test.ts` refuses the alias in the palette
and any use in production source, with no transitional allowances.

| Token | Value | Role |
|---|---|---|
| `accent.primary` | `#16123A` | The one ink pill (aliases `paper.ink`) |
| `accent.label` | `#16123A` | Labels (aliases `paper.ink`) |
| `accent.brand` | `#3B2FE0` | The brand blue (aliases `colour.blue`) |
| `highlight` | `#D8FF54` | The highlighter: a band behind a French line and the "you are here" stop |

Ink clears 15.5 on the highlighter and soft ink 5.8. The highlighter stays a
Delta-E of 30 from every signal, orb state, the rung fill, the ground and the
card, so it never reads as a state, a support level or the page.
`palette.test.ts` walks the source: the hex lives only in `palette.ts`, the
token is spelled only in `palette.ts`, `theme.ts` and `components.tsx`, and
inside `components.tsx` only within `Highlight` and `LevelPath`.

**An accent is typographic; a signal is a mark.** A label, a chip, or a
drawing's one solid fill may take the accent. A dot, a ring, or anything
reporting state never may.

### Signals: words in ink, and one mark

B carries meaning in words and puts colour only on marks. The two signals that
letter words, a sound that is working and something to change, are the ink
itself, so they clear the text floor by being ink. The tutor's coral only ever
marks the orb, so it is held to the 3 floor for a mark (4.4 on the ground, 4.7
on a card) and its caption is ink. It stays a Delta-E of 30 from ink, the rung
fill, the ground and the card.

| Token | Value | Role |
|---|---|---|
| `signal.good` | `#16123A` | A sound that is working, in ink (aliases `paper.ink`) |
| `signal.correspondance` | `#16123A` | Something to change, in ink (aliases `paper.ink`) |
| `signal.live` | `#D63A22` | The tutor's voice, a mark and never words (aliases `colour.coral`) |

Earned marks use a mint fill with an ink glyph. The sound judgement remains
words in ink; colour never substitutes for its stated result.

### The voice circle

Coral, the tutor is talking; mint, your turn; sun, it is thinking; ink, ready to
be tapped. TutorIntro teaches these states in words and never by colour name,
because the glyph and the caption carry the state for a learner who cannot tell
the colours apart. The three lights stay a Delta-E of 30 from each other and
from the rung fill.

Mint and sun are far too light to be a mark on paper (1.85 and 1.43), so the
fill is never the only signal. The orb is SNIPPETS' two rings and a core in the
state colour, and every state carries one mark in the core: the seven voice
bars while the tutor speaks, a microphone whenever it is your turn or the room
is getting ready, three dots while the tutor thinks. The mark and the embedded
status are in the colour `onOrb` pairs with the fill, held to the 4.5 floor for
words on it: white on coral 4.7, ink on mint 9.0, ink on sun 11.6, white on ink
17.8. The coral and the ink ready core still clear 3 on the ground. Below 64 the
rings are too fine to read, so the tutor mark and the tutor card draw the core
alone.

| Token | Value | Caption / role |
|---|---|---|
| `orb.speaking` | `#D63A22` | Listen: the tutor is speaking (aliases `colour.coral`) |
| `orb.yourTurn` | `#2FD18B` | Speak: your turn (aliases `colour.mint`) |
| `orb.thinking` | `#FFC93C` | One moment: the tutor is thinking (aliases `colour.sun`) |
| `orb.ready` | `#16123A` | Tap to talk: the untapped control (aliases `paper.ink`) |

| Token | Value | The glyph on |
|---|---|---|
| `onOrb.speaking` | `#FFFFFF` | Coral: white bars and status |
| `onOrb.yourTurn` | `#16123A` | Mint: ink bars and status |
| `onOrb.thinking` | `#16123A` | Sun: ink bars and status |
| `onOrb.ready` | `#FFFFFF` | The ink ready orb: its white microphone and status. SNIPPETS draws ready as ink rings and an ink core with a white mic, so it stays white |

Ink is not a fourth traffic light. A closed microphone waiting to be tapped is
the primary control of the whole product, so it takes the primary colour exactly
as the primary action does, and it changes to a state colour when the orb
reports state.

**The living orb** (come alive, October 2026). Inside a conversation room the
orb answers the room's real audio, in the same state colours and the same
drawing, through layers that move by transform and opacity only and are decided
in `tutor/orbLayers.ts`. While it is the learner's turn, two rings behind it
swell with their real microphone level (`OrbLevelRing`, the shared `LevelRing`),
and the word under it reads "Hearing you" once they have been heard for a
quarter second; the orb's accessible name keeps the state's own word, so a
screen reader is never told twice a sentence. While the tutor speaks, the seven
bars follow the tutor's voice band by band and the core grows a little with its
loudness (`LiveBars`, `OrbPulse`), and the breathing loop rests so the core never
moves two ways at once. While the tutor is really thinking, a sun segment of the
outer ring goes round once every 1.2 seconds (`OrbThinkingArc`). On the goal
tick that completes a scene the orb ripples once, two rings and eight dots in
the state colour (`OrbRipple`). A level that is not measured draws nothing new:
the orb keeps the loops above, so it never invents a voice. Every layer rests
behind another screen, with the app in the background, when paused and with
movement reduced (the arc then holds still and the ripple never plays). Outside
a room (the Tutor tab, the intro, the waiting screens) the orb is exactly the
drawing above. The lesson's Speak circle wears the same level ring.

### The rungs share one fill

A rung colour is a fill under an ink numeral, not a state mark, so it is held to
ink at 4.5 on the fill rather than to the mark floor against the ground. B puts
no further colours on the rungs: the first three share the skeleton fill under
an ink numeral (14.4), the words in `rungLabel` say which rung is which, and
rung four is plain ink under a white numeral, no line left to follow. The fill
sits 5.9 off the ground and 12.2 off a card, and a Delta-E of 30 from ink, the
tutor's mark, the three orb lights and the highlighter.

| Token | Value | Meaning |
|---|---|---|
| `rungColor[1]` | `#EFE6D6` | Echo, repeat after the tutor (aliases `paper.skeleton`) |
| `rungColor[2]` | `#EFE6D6` | Cued, choose a reply and say it (aliases `paper.skeleton`) |
| `rungColor[3]` | `#EFE6D6` | Prompted, say it in your own words (aliases `paper.skeleton`) |
| `rungColor[4]` | `#16123A` | Free, plain ink, no line left to follow (aliases `paper.ink`) |

### The six old tints stay retired

The pastels above are the only soft grounds. The six place tints of the
notebook era, their role tables and the tinted primitives stay deleted, and
`surfaceContract.test.ts` rejects them in production source.

### Shadow

One shadow: the soft lift, `shadow.lift` in `theme.ts`, under an illustrated
Explore card and nowhere else. It is offset 12 down, blurred 24, spread -16,
in ink at 0.45 (`liftInk` in `palette.ts`). `css` carries the same lift for the
web. This reverses the old no-shadow rule for that one card (DECISIONS.md,
19 October 2026). Every other card is flat white on paper; the live microphone
glow and the reviewed sign-in glow stay the only other shadows, and
`surfaceContract.test.ts` still refuses a shadow style anywhere else. The
selected glow is a ring layer, not a shadow. `theme.test.ts` holds the theme to
exactly one shadow token. Cards are never nested.

### Dark mode and the B tokens (UI-008)

Dark mode is on for the main app (DECISIONS.md UI-008, 20 October 2026).
Screens read colour through `useB()` (`main/bTheme.tsx`, re-exported by
`main/MainAppearance.tsx`), which returns `b.light` or `b.dark` with the mode,
and build their sheets with `useThemedStyles(make)`, which builds each sheet
once per mode. `b.light` is read off the canvas artboards and equals the paper,
colour and pastel values above, so nothing pinned light moved by a pixel. `b.dark`
is the Figma page "M3 Reviewed main app, Dark" (file sjAwoGinWQKvhGrWbgMO18,
node 307:364): the M3 ground, surface and inset; pastel tiles become its tints
(butter to ochre, lavender to plum, peach to rose, sage and the mint wash to
teal); the yellow hero becomes the M3 hero with a gold button, ink words on the
button and cream words on the card; the ink primary becomes violet; links become
the M3 periwinkle. Violet cards, the sun, the mint and the art stay as they are.
The tab capsule is ink in both modes (Figma `C2/Main2/Navigation`, 292:1103).
`palette.test.ts` holds every text pair in both modes to 4.5 and every mark to 3.

**Pinned light until rebuilt.** A screen follows the device only once it is
rebuilt to its artboard in both themes. `nav/darkReady.ts` exports `DARK_READY`,
empty to start; each rebuild step adds its route. Both navigators wrap every
screen through `screenLayout` in `RouteTheme`, which renders `<PinLight>` for a
route not in the set; the tab bar, the scene ground, the container theme and
the status bar follow the focused route the same way. `ALWAYS_LIGHT` holds the
first scene and the paywall, which stay light whatever `DARK_READY` says.
Onboarding, sign up and the launch are mounted under `<PinLight>` in `App.tsx`
and sit outside the one `MainAppearanceProvider`. The shared parts in
`components.tsx` and `layout.tsx` read the theme; parts on a colour ground
(blue, coral, sun, mint, the white pill on blue) keep their values in both modes.

**Canvas art.** The 22 drawings the artboards use are in
`apps/mobile/assets/b-art/` (`svg/<name>.svg`, `manifest.json` with each root size,
sha256 and canvas blob, and `svg.json` inlined), drawn by
`<BArt name width height? />` (`src/art/BArt.tsx`) through `SvgXml`, with each
copy's definition IDs namespaced and the drawing hidden from screen readers. Art
is drawn unchanged in both modes. `art/bArt.test.ts` pins the set at 22.

| Token | Value | Role |
|---|---|---|
| `b.light.ground` | `#FFF6E9` | The page |
| `b.light.card` | `#FFFFFF` | Cards, sheets, the white disc |
| `b.light.inset` | `#F5EEE2` | A recessed well inside a card |
| `b.light.line` | `#F0E6D6` | The one hairline |
| `b.light.text` | `#16123A` | Words and marks on the ground and cards |
| `b.light.muted` | `#5C5A74` | Secondary words |
| `b.light.secondary` | `#4A4766` | Secondary words on a tint |
| `b.light.field` | `#8A8499` | Radio ring, input border, switch-off track. A mark |
| `b.light.skeleton` | `#EFE6D6` | Loading blocks, pressed wash, disabled fill |
| `b.light.brand` | `#3B2FE0` | Blue cards, selected states, the select ring |
| `b.light.brandPressed` | `#2A20B0` | A pressed blue control |
| `b.light.onBrand` | `#FFFFFF` | Words on blue |
| `b.light.onBrandSoft` | `#E4E1FF` | Soft words on blue |
| `b.light.violet2` | `#5A50EA` | Chip ground and decor on a blue card |
| `b.light.violetDeep` | `#2E24B8` | Live controls, Welcome chips |
| `b.light.periwinkle` | `#B9A7FF` | Dashed accent borders, confetti |
| `b.light.ring` | `#D9CFE9` | Empty rings, dashed borders. Decoration only |
| `b.light.sun` | `#FFC93C` | Sunshine accents |
| `b.light.mint` | `#2FD18B` | Done ticks |
| `b.light.mintWash` | `#D4F5E5` | The success panel |
| `b.light.mintWords` | `#1F7A52` | Success words |
| `b.light.onMint` | `#16123A` | The tick and the star stroke on a mint disc (B-Today, 2026-10-20) |
| `b.light.coral` | `#D63A22` | The tutor speaking. A mark |
| `b.light.butter` | `#FFE8AB` | Butter tile |
| `b.light.lavender` | `#E9E3FA` | Lavender tile, the lock pill |
| `b.light.peach` | `#F7D8C7` | Peach tile |
| `b.light.sage` | `#D4E2D7` | Sage tile |
| `b.light.heroGround` | `#FFC93C` | The hero card |
| `b.light.heroText` | `#16123A` | Words on the hero |
| `b.light.heroCta` | `#16123A` | The hero button |
| `b.light.heroCtaText` | `#FFFFFF` | Words on the hero button |
| `b.light.heroChip` | `#FFFFFF` | A chip on the hero |
| `b.light.primary` | `#16123A` | The one primary pill |
| `b.light.onPrimary` | `#FFFFFF` | Words on the primary pill |
| `b.light.quiet` | `#F5EEE2` | The quiet secondary button and chip |
| `b.light.link` | `#3B2FE0` | Links and the lock mark |
| `b.light.avatar` | `#16123A` | The avatar disc |
| `b.light.onAvatar` | `#FFFFFF` | The avatar initial |
| `b.light.scrim` | `#16123A` | The sheet scrim, at 0.4 |
| `b.light.danger` | `#C2341F` | A destructive action |
| `b.light.tabCapsule` | `#16123A` | The tab bar capsule |
| `b.light.tabSelected` | `#3B2FE0` | The selected tab cell |
| `b.light.tabGlyphSelected` | `#FFC93C` | The selected tab glyph |
| `b.light.tabLabel` | `#FFF6E9` | Tab labels and unselected glyphs |
| `b.light.hint` | `#7E8AFF` | The Hint bar of the help legend (B-ThenNow); a mark |
| `b.light.sunDeep` | `#E0A800` | The half arc of an ability practised with help (B-Journey); a mark |
| `b.light.stageTrack` | `#EFE7F9` | The five-stage track behind the nodes (B-Journey) |
| `b.light.peachSoft` | `#FCEADF` | The art panel inside the peach Postcards tile (B-Journey) |
| `b.light.lavenderSoft` | `#F5F1FE` | The art panel inside the lavender Badges tile (B-Journey) |
| `b.light.orbRing` | `#4A3FE6` | The live room's outer orb ring and the mic's rim on blue (B-Live); a mark |
| `b.light.haloSun` | `#FFE08A` | The halo behind a question's drawing on a sun band (B-Question; onboarding is pinned light); a mark |
| `b.light.haloMint` | `#8BEBC0` | The halo behind a question's drawing on a mint band (B-OB-Q3); a mark |
| `b.light.sunShadow` | `#C99400` | The pressed-edge shadow under the welcome's sun button (B-OB-Welcome); a mark |
| `b.light.mark` | `#3B2FE0` | A selected mark on the paywall: chosen-plan border, radio, benefit tick; never words (2026-10-21 UI-008) |
| `b.light.onMark` | `#FFFFFF` | The dot inside a filled mark radio |
| `b.light.onSun` | `#16123A` | The ink glyph on a sun disc (the paywall's trial timeline) |

| Token | Value | Role |
|---|---|---|
| `b.dark.ground` | `#151127` | The page |
| `b.dark.card` | `#25203D` | Cards, sheets, the white disc |
| `b.dark.inset` | `#302A48` | A recessed well inside a card |
| `b.dark.line` | `#514967` | The one hairline |
| `b.dark.text` | `#FFF6E9` | Words and marks on the ground and cards |
| `b.dark.muted` | `#C6BED8` | Secondary words |
| `b.dark.secondary` | `#C6BED8` | Secondary words on a tint |
| `b.dark.field` | `#8A8499` | Radio ring, input border, switch-off track. A mark |
| `b.dark.skeleton` | `#302A48` | Loading blocks, pressed wash, disabled fill |
| `b.dark.brand` | `#3B2FE0` | Blue cards, selected states, the select ring |
| `b.dark.brandPressed` | `#2A20B0` | A pressed blue control |
| `b.dark.onBrand` | `#FFFFFF` | Words on blue |
| `b.dark.onBrandSoft` | `#E4E1FF` | Soft words on blue |
| `b.dark.violet2` | `#5A50EA` | Chip ground and decor on a blue card |
| `b.dark.violetDeep` | `#2E24B8` | Live controls, Welcome chips |
| `b.dark.periwinkle` | `#B9A7FF` | Dashed accent borders, confetti |
| `b.dark.ring` | `#514967` | Empty rings, dashed borders. Decoration only |
| `b.dark.sun` | `#FFC93C` | Sunshine accents |
| `b.dark.mint` | `#2FD18B` | Done ticks |
| `b.dark.mintWash` | `#233F41` | The success panel |
| `b.dark.mintWords` | `#2FD18B` | Success words |
| `b.dark.onMint` | `#16123A` | The tick and the star stroke on a mint disc (B-Today, 2026-10-20) |
| `b.dark.coral` | `#D63A22` | The tutor speaking. A mark |
| `b.dark.butter` | `#493C2E` | Butter tile |
| `b.dark.lavender` | `#322B50` | Lavender tile, the lock pill |
| `b.dark.peach` | `#49333F` | Peach tile |
| `b.dark.sage` | `#233F41` | Sage tile |
| `b.dark.heroGround` | `#363064` | The hero card |
| `b.dark.heroText` | `#FFF6E9` | Words on the hero |
| `b.dark.heroCta` | `#FFC93C` | The hero button |
| `b.dark.heroCtaText` | `#16123A` | Words on the hero button |
| `b.dark.heroChip` | `#4A4170` | A chip on the hero |
| `b.dark.primary` | `#3B2FE0` | The one primary pill |
| `b.dark.onPrimary` | `#FFFFFF` | Words on the primary pill |
| `b.dark.quiet` | `#302A48` | The quiet secondary button and chip |
| `b.dark.link` | `#A79AFF` | Links and the lock mark |
| `b.dark.avatar` | `#302A48` | The avatar disc |
| `b.dark.onAvatar` | `#FFF6E9` | The avatar initial |
| `b.dark.scrim` | `#000000` | The sheet scrim, at 0.4 |
| `b.dark.danger` | `#FF9A85` | A destructive action |
| `b.dark.tabCapsule` | `#16123A` | The tab bar capsule |
| `b.dark.tabSelected` | `#3B2FE0` | The selected tab cell |
| `b.dark.tabGlyphSelected` | `#FFC93C` | The selected tab glyph |
| `b.dark.tabLabel` | `#FFF6E9` | Tab labels and unselected glyphs |
| `b.dark.hint` | `#7E8AFF` | The Hint bar of the help legend (B-ThenNow); a mark |
| `b.dark.sunDeep` | `#E0A800` | The half arc of an ability practised with help (B-Journey); a mark |
| `b.dark.stageTrack` | `#302A48` | The five-stage track behind the nodes (B-Journey) |
| `b.dark.peachSoft` | `#5A3F4C` | The art panel inside the peach Postcards tile (B-Journey) |
| `b.dark.lavenderSoft` | `#3D3560` | The art panel inside the lavender Badges tile (B-Journey) |
| `b.dark.orbRing` | `#4A3FE6` | The live room's outer orb ring and the mic's rim on blue (B-Live); a mark |
| `b.dark.haloSun` | `#FFE08A` | The halo behind a question's drawing on a sun band (B-Question; onboarding is pinned light); a mark |
| `b.dark.haloMint` | `#8BEBC0` | The halo behind a question's drawing on a mint band (B-OB-Q3); a mark |
| `b.dark.sunShadow` | `#C99400` | The pressed-edge shadow under the welcome's sun button (B-OB-Welcome); a mark |
| `b.dark.mark` | `#A79AFF` | A selected mark on the paywall; violet is 2.4 on the dark ground, under the 3.0 mark floor |
| `b.dark.onMark` | `#151127` | The dot inside a filled mark radio |
| `b.dark.onSun` | `#16123A` | The ink glyph on a sun disc (the paywall's trial timeline) |

The status bar style is a token too: `dark` in light, `light` in dark.

## Type

**Outfit** is the only face: every word on the screen, French and English
alike, in five cuts (Regular 400, Medium 500, SemiBold 600, Bold 700, ExtraBold
800). It is OFL, committed in `assets/fonts/` with its licence and credited in
Acknowledgements; Fraunces and DM Sans have left the bundle. Weight and size say
what a line is, never a second face, and nothing is set in italics or in caps.
French keeps its own tokens by name, set in SemiBold, and the French line is
always the largest text in its block. All callers use the five canonical font names.

Sizes are points and scale with the OS reading size. Line heights are STYLE's
ratios rounded to whole points, and tracking is STYLE's em value at the size.
`theme.test.ts` pins every row below. It fails if the theme names a face
`App.tsx` does not load or the fonts folder carries one nothing loads, if the
French hero is smaller than the screen title, and if `frenchLg` is not larger
than a heading. Since 19 October 2026 the screen title is 34 at ExtraBold, the
same size as the French hero, and section heads are ExtraBold.

`boldType` is the onboarding's scale, kept as it is until A2 folds it into this
one; where a value differs it still wins on the onboarding screens.

| Style | Face / size | Use |
|---|---|---|
| `hero` | Outfit ExtraBold 112/95, -4.5 | The one giant number on a story or colour card, at most one per screen |
| `display` | Outfit ExtraBold 44/44, -1.3 | A headline on colour, or the centred Profile identity |
| `title` | Outfit ExtraBold 34/38, -0.6 | The title of a working screen |
| `eyebrow` | Outfit Bold 13/18 | A short label above a card title, such as "Next scene · 2 of 3". Sentence case |
| `heading` | Outfit ExtraBold 20/25, -0.2 | Card titles and section heads |
| `cardTitle` | Outfit ExtraBold 20/25, -0.2 | The title of a card, the same style as `heading` |
| `frenchHero` | Outfit SemiBold 34/42, -0.3 | The French line that leads a screen (`fitHero()` steps 34, 30, 26 by length, from `heroFit`) |
| `frenchLg` | Outfit SemiBold 28/34, -0.3 | The French line that leads a card or scene (`fitDisplay()` steps 28, 24, 20 by length) |
| `french` | Outfit SemiBold 20/26 | French in lists, rows and thread bubbles |
| `frenchSm` | Outfit SemiBold 17/23 | French in a chip, where the phrase is a sample |
| `body` | Outfit Regular 17/25 | Sentences |
| `bodyStrong` | Outfit SemiBold 17/25 | A sentence that carries more weight |
| `label` | Outfit SemiBold 16/20 | Buttons and row titles, sentence case, no tracking |
| `button` | Outfit SemiBold 16/20 | Pill and outline lettering, the same style as `label` |
| `small` | Outfit Medium 14/20 | Metadata lines, captions, the English under a French line |
| `tabLabel` | Outfit SemiBold 12/12 | Unused since UI-008: the tab bar sets C2 `small` 13/18 (`boldType.small`) |
| `notation` | Outfit Medium 14/20, 0.4 | IPA: real notation, not mono-as-costume |

`bType` (UI-008, 2026-10-20) holds the direction B artboards' own sizes where
the scale above has no exact token. Explore and Scene preview added
`section21` (ExtraBold 21/26, a tab's section head), `section19` (ExtraBold
19/24, a pushed screen's section head), `bandTitle` (ExtraBold 28/31, the
scene band's title), `bold14` and `semi14` (the selected and resting filter
chip), `semi13` (a field label) and `bold12` (the small "Free sample" pill).
The live room, Recap, After a session and the Celebration (2026-10-21) added
`display40` (ExtraBold 40/44, "Bien joué."), `ability34` (ExtraBold 34/37,
-0.4, the ability earned), `title30` (ExtraBold 30/33, the Recap band's title)
and `para17` (Regular 17/24, a sentence on a blue page).
Streak, Profile and Settings (2026-10-21) added `initial34` (ExtraBold 34/40,
the Profile avatar's initial), `name30` (ExtraBold 30/34, -0.3, the Profile
name) and `run52` (ExtraBold 52/56, -1, the streak's run on its band).

## Surfaces and controls

### Buttons

Built in A2 (UI-004, UI-005), all through `PillButton` in `components.tsx`.

- **Primary**: the ink pill, `PILL_HEIGHT` 54pt, `radius.pill`, white `button`
  label and an optional leading icon. One per door. `onboarding/BoldButton` is
  a thin alias that adds only its come-alive glint; `onboarding/NextButton`
  keeps its own off face and hint but draws the same 54pt ink pill. The old
  `design="bold-rhythm"` prop is still accepted and does nothing.
- **Secondary**: `variant="secondary"`, a `SECONDARY_HEIGHT` 46pt white pill
  with ink words, or a pastel one with `pastel="butter|lavender|peach|sage"`.
- **Chip**: 36pt visible, with a 1.5pt ink outline; its touch target still
  reaches 44pt. Not a shared part yet: the chips in use are local to the drill
  and conversation screens and move with their screens.
- The quiet text links (`OutlineButton`, `GhostButton`) are tertiary, not the
  secondary pill, and are unchanged.
- The wall's own CTA (`wall/WallParts`) still draws its own pill until the
  wall is recomposed.
- A pressed blue control darkens to `colour.bluePressed`. Radii stay card 24,
  feature 28, tile 20, field 16, pill 999.

### Parts

The shared parts in `components.tsx`, drawn to the SNIPPETS.md parts. Every
screen picks the system up through them. A2 rebuilds the buttons and cards to
the targets above. The old primitives that screens still call are deprecated wrappers drawing
the new look, listed at the end, and they go with their call sites.

- **Press**: every tappable part below shrinks to 0.97 on the
  press spring while the finger is down, springs back on lift, and answers
  with a light impact or, for a choice, a selection tick (see Motion).
- **Card**: the one card (SNIPPETS card-white): white at the card radius, no
  hairline, no shadow, no outline, never nested inside another card.
  `tone="feature"` is deprecated and draws white; `journal` keeps the ground
  for the phrase card. `lift` adds the one soft lift (`liftStyle`), for an
  illustrated Explore tile only.
- **Ledger / LedgerRow**: how a list is drawn. The ledger rules a hairline
  above its first row and is a list to assistive tech; each row rules the
  hairline under itself. A row is one `Press` at 56pt with an optional 24pt
  ink glyph and no disc, an optional caps label, a title in `heading`, a gloss, an optional note on its
  own line, trailing meta, an earned state, and the faint chevron that says it
  opens. It names itself once, says disabled in soft ink rather than opacity,
  and grows rather than clips at the largest reading size.
- **PillButton**: the one button (see Buttons): the ink pill
  (`accent.primary`) with white lettering, 54pt, fully rounded; `tone="white"`
  is the white pill with ink lettering on a blue or coral ground. The returning
  sign-in form uses `tone="brand"` for its purple primary action; compact
  provider pills retain the touch floor and wrap their labels.
- **OutlineButton / GhostButton**: the second action. `GhostButton` is
  SNIPPETS' link-text, an underlined ink word at the touch floor (white on blue
  and coral, which the caller passes), never a box, so nothing competes with the
  one pill. `OutlineButton` is the older quiet link until Stage 6.
- **OptionCard**: a legacy tappable choice: French in Outfit, English gloss under,
  quiet arrow, optional replay ear. Selection is a heavier ink rule on white; a
  replay ear that is sounding is drawn in ink on a `paper.groundDeep` disc.
- **Field, TabBar, ProgressDots**: inputs are white, 56 tall, with a 1.5
  `paper.field` rule that turns ink on focus, and a secure field carries a 44pt
  **Show / Hide** at its trailing edge so a password is not typed blind; the
  label above is small ink at SemiBold. `TabBar` is SNIPPETS' segmented: a sand
  track with a white chosen segment, ink at Bold on the chosen word and soft ink
  at SemiBold on the rest, never ink capsules. Each segment stays at the 44
  floor, presses as a choice, can stand with nothing chosen, names its group for
  a screen reader and says which segment is selected on the web as well as on a
  device. `ProgressDots` is SNIPPETS' story segments: equal bars, the done ones
  in the ground's words colour and the rest in `segmentPending`, read once as
  "Step 2 of 6".
- **Label**: the meta line a card may carry: small, soft ink, sentence case.
- **Tab bar** (UI-008, 2026-10-20, Figma C2/Main2/Navigation 292:1103): an
  ink capsule (`b.tabCapsule`, the same in both themes) 12pt in from each edge
  inside the safe areas and at most 640 wide, radius 32, padded 8 across and 6
  down, on a strip of the focused route's `ground` (8pt above, the safe area or
  8pt below). The bar stays in layout, so nothing scrolls under it, and it has
  no shadow, hairline or chartreuse wash. Five equal 62pt cells, radius 20,
  padding 4, gap 4: a 22pt Iconsax glyph over its word in C2 small (13/18).
  Selected is the `tabSelected` violet cell with the Bulk glyph in
  `tabGlyphSelected` sun and the word in `tabLabel` cream at Outfit Bold;
  unselected is the Linear glyph and the word in cream at Outfit Medium on the
  ink. The bar itself moves nothing: when a tab becomes the selected one its
  icon pops once in `nav/TabGlyph.tsx` (up 2pt and to 1.15, home on the pop
  spring, the Bulk drawing fading in over the Linear), never on launch or on a
  tap of the open tab, and under Reduce Motion it simply swaps. The Practice
  dot is 6pt sun, so it reads on the ink, and pops in once when practice
  becomes due while the bar is open. Cells keep the 62pt floor and labels wrap
  at large text: from a 1.3 reading size each cell takes a fixed fifth. The
  words are Today, Explore, Speak, Practice and Journey (routes `Home`,
  `Explore`, `Tutor`, `Practice`, `MyFrench`) over `home`, `exploring`,
  `microphone`, `cards` and `progress`; the decisions live in
  `nav/tabBarModel.ts`. Friends is an optional Profile route.
- **Highlight**: the highlighter (SNIPPETS highlight): a still band in
  `highlight` behind one French line, at most once per screen and only on white
  or paper. The band is decorative; the line on it is what is read, marked as
  French (`frenchText`) so a screen reader reads it in a French voice.
- **SoundTag**: a sound, named: its IPA as notation beside one French example
  word, such as /ʁ/ rouge, read as one element.
- **LadderMark**: the four rungs in `rungColor`, the current one drawn taller,
  beside the rung's sentence from `rungLabel`. The rungs are decorative.
- **LevelPath**: each level (A0, A1), its can-dos in order, and one "You are
  here" stop in the highlighter. A done stop is an ink dot, a stop ahead a
  hairline ring, and each stop is one sentence to a screen reader.
- **TutorCard**: the orb, the tutor's name, the voice in words, the signature
  line in French, a 44pt sample that says Stop while it sounds, and a quiet
  "Change tutor" link. No face and no initial.
- **SceneBrief**: the brief for one scene: an optional level and label as the
  one caps line, the French title as the fitted French hero, the title, "You'll
  be able to" and the can-do, two or three lines to say, minutes, support and
  tutor, the reason, then the caller's one Start and quiet "Type instead". The
  Start and the corner (the 44pt bookmark slot, in flow) arrive as nodes the
  caller built, so the one-primary-action rule stays countable from the
  screen's own file.
- **PhraseCard**: one French line, large, sized by `fitDisplay` rather than
  clipped, with a round white 44pt speaker beside it on a paper hairline and
  the ink speaker mark. It says "Hear" before it sounds and "Stop" while it does.
- **TutorMark**: the tutor, drawn as the orb at 36 in a 44pt box with no disc,
  and hidden from assistive tech. There is no face anywhere in this app and no
  initial either: the monogram is the learner's mark, never the tutor's.
- **SpeakCircle**: THE microphone: one 108pt circle used by every speaking
  surface. Green-ringed when waiting, green-filled (with the live glow, the
  only shadow in the app) when live — green means "you speak", matching the
  voice circle — hairline-muted when the tutor holds the floor.
- **Icons**: Iconsax-sourced, generated, Linear for controls, Bulk for tiles
  and states. One family: Iconsax free icons (held by the founder under the
  Iconsax free licence) plus a few of Luvani's own drawings, generated by
  `npm run icons` from `scripts/icons/icons.config.mjs` into `src/icons/`, every
  stroke at the one pen of 2 on a 24 box, coloured only by the tokens the
  caller passes, and decorative: the control around an icon names it. A screen
  draws `<Icon name="..." />`; `IconTile` sets a Bulk icon on one of six grounds
  with the one mark colour that may sit on it, and `GoalDial` draws a daily
  goal's size. What moves is `AnimatedIcon`, around a still drawing, and only
  for a real event. The older names in `components.tsx`, `glyphs.tsx` and
  `nav/icons.tsx` are delegates to the set until their callers move, and Speak
  is still the same microphone as the control. No Iconsax file is ever
  committed loose; each generated file carries the licence notice, and
  `docs/design-assets/ICON_SET.md` lists every icon. The Apple and Google marks
  stay drawn by hand, filled in the one colour they are given.
- **Art**: the single raster renderer, using registry sizes or its compact
  variant. Illustrations sit within content panels, never behind headings.
- **TabHeader**: the tab's title block. A `display` title on the left, one plain
  purpose line beneath it in soft ink, and an optional trailing `Monogram` on the
  title row. It mounts as the first child of a tab's scroll body, never in the
  frame's `header` slot, so the fixed title and purpose can scroll at large text.
  It still has a centred variant, but since P2 (19 October 2026) no screen
  uses it: Profile draws its own large title and identity row instead. The
  shared `ScreenHeader` rules a paper hairline under itself, and its way back is
  the round white back button at the touch floor.
- **Monogram**: the learner's initial drawn one way (SNIPPETS header-tab). A
  white initial in Outfit Bold on an ink disc, hidden from assistive tech, at
  `HIT` in the header button. Its initial comes from `firstNameOf`, the
  greeting's own name rule (`profile/avatar.ts`); with no name it draws the
  neutral `user` glyph in white instead of a letter. Profile's own identity disc is the exception since
  P2: 64pt `colour.sun` with the initial in `paper.ink` at `title`, drawn once,
  because the design gives the learner's page a warmer mark than the header.
- **Grouped list** (`settings/SettingsGroup.tsx`, P2): what Profile, Learning
  preferences, Settings and Subscription are built from. A quiet header in
  `small` muted ink inset 16, a `surface` list at `radius.tile` (20), clipped, a
  footer in the same ink, and 28 between groups. Rows (`SettingsRow`,
  `SwitchRow`, `ChoiceRow`) take 16 across and 13 down with a 52 floor; the
  label is `body` in text ink, a long answer is a muted subtitle under it, a
  short one a muted value at the trailing edge, a chevron when the row leads
  somewhere, and a destructive label is `danger`. Separators sit inset 16 from
  the left in `border` at 70%. Outside a group the same rows keep their older
  card shape, so the memory screen, social settings and onboarding are
  unchanged. Switches stay on `accent.brand`; the off track is `paper.field`
  everywhere (3:1 on white), no longer the grouped list's hairline.

More shared parts:

- **RoundButton**: back and close are a white disc at the touch floor with the
  set's back or close icon; next is a 64 disc (sun on blue or coral, ink on
  sun) with its word beside it.
- **ColourCard**: the feature card: one colour ground, or a pastel one
  (`ground="pastel.sage"` and so on), at the feature radius 28 with no hairline
  or shadow, words in `textOn`, the secondary in `onColour`. `lift` is for an
  illustrated Explore tile only. The whole card
  is a target only when it holds no pill of its own.
- **StatTile / HeroNumber**: a number and one plain line on white, and the one
  giant number with its unit on a colour board. Each is one phrase to a screen
  reader.
- **StatRow**: three stats in one white card, three equal columns, as on
  Today. It lays out `StatTile compact` children (the number in `statSm`, the
  line under it in `caption`, centred) and draws nothing of its own. A tile may
  carry a decorative `mark` disc above its number, hidden from a screen reader;
  a ring or bar that means something is labelled by its caller. `valueNode`
  draws in the number's place when it moves (Today's count-ups) while `value`
  is still what a screen reader hears; `compact` is the smaller centred cut
  the row lays out. Words wrap
  rather than shrink at a large reading size.
- **Chip**: the one small pill, two variants. `filter` is a choice in a row of
  them: 44pt tall (`minHeight: HIT`, so the floor holds at any reading size),
  white with a hairline, and when chosen filled with ink, with white words and
  a tick, so the state is never colour alone. It says selected on a device
  (`accessibilityState`) and on the web (`aria-selected`, F522), as a tab by
  default or a button. `meta` is a still fact such as "About 6 min" or a
  scene's state: never pressable, on white, ink or lavender, with an optional
  mark before the words. Today's quest XP chips use the `butter` and `sage`
  meta tones, ink words on both pastels. On a blue card a filter chip may take
  `ground="violet2"` (Speak's own topic chip): white words only, never
  `onColour.blue`, and it falls back to the chosen ink fill when selected. The
  archive's filters and My French's situation state both draw it.
- **LockBadge**: the trial's lock, two forms. The pill reads "Included with
  your trial" in blue `badge` words beside a blue lock, 26 tall, on lavender
  (or white when it sits on a lavender card). The round form is a 28pt white
  disc with the blue lock alone, named "Included with your trial" to a screen
  reader. It is pure presentation and never decides whether something is
  locked: `access/featureAccess.ts` does, and a surface draws the badge only
  when that seam says locked. The seam reads the D24 billing standing
  (`featureLockedNow`) and fails open, so a plan nobody could read shows no
  lock. Inside a control whose label already says "Included with your trial",
  the badge is hidden from screen readers so the words are heard once. A
  locked Journey section keeps its heading and badge and shows one teaser line
  that opens the Wall, never its content.
- **OptionRow**: a one-tap choice, now a thin name for `Choice` as a button
  row: white with a title and a line under it and the field ring when not
  chosen, the brand blue with white words and a white disc holding the blue
  check when chosen. A Hear is its own speaker button beside it. The choice is
  said on a device and on the web.
- **Sheet**: a bottom sheet under an ink scrim at 0.45 that closes it, modal to
  VoiceOver, with a grabber and a title. No drag to dismiss.
- **Skeleton / QuietLine**: still sand blocks that say Loading once, and a
  small centred reassurance.
- **FrenchBlock**: a French line, large and marked as French, the English
  under it, and a 44pt hear disc that says Stop while the line sounds.

The icon controls, appended in come alive (D2, F727). Each presses through
`Press`, casts no shadow, says off in colour rather than opacity, and plays no
sound of its own:

- **IconButton**: a button with no visible label carries a spoken label. It
  draws one of six marks every phone reads the same way (back, close, hear,
  keep, replay and remind), and anything else is an `IconAction` with its word
  on screen. The label is required and is what a screen reader says; the mark
  is decorative. The target is the 44pt touch floor, or a 56pt disc for the main
  audio on a page, both from `HIT`. Plain is the mark in its ground's ink, disc
  is the white disc with an ink mark, ink is the ink disc with a white mark. A
  toggle that is on (kept, reminders on) turns its mark Bulk, in brand blue
  where it would be ink, and says so on a device and on the web; it moves only
  through `AnimatedIcon`, on a real event. Off is soft ink on paper or white, a
  sand disc, or the ground's own secondary on a colour. It presses as deep as a
  tile.
- **IconAction / IconActionRow**: an icon with its short word, for every
  other action. A tile is the icon over the word in a white tile, 72pt tall,
  two to four sharing a row and wrapping two to a line at the largest reading
  sizes; inline is the icon beside the word at the touch floor, in the ground's
  words colour. A chosen tile takes the blue ground's pale secondary, a 2pt
  brand border and a Bulk brand icon, pops once and lights the ring layer; on a
  blue or coral ground it takes the sun with ink. Busy turns the icon into the
  turning refresh and says busy. Off is the sand tile with soft ink.
- **Choice**: the one choice, for every option, plan, voice, level, goal and
  time: a 72pt row with the tile at its head, the title, a line under it and a
  28pt disc, or a tile for a grid of two. Not chosen, it is white with a 2pt
  hairline (the paper on a white sheet), so it never matches its ground.
  Chosen, it is the brand blue with white words and a white disc holding the
  blue check, or the sun with ink on a blue ground; the tile inside turns white
  with a brand mark, and it pops once and lights the ring layer. It is a radio
  by default, said on a device and on the web. A Hear is its own speaker button
  beside it, so hearing never chooses. `OptionRow` and the first run's `Choice`
  are thin names for it, and `ChoiceArt` draws an `IconTile`. `OptionCard`, the
  answer row in sittings and drills, still draws its own until it joins them.

The deprecated TintRow, TintPanel, TintDisc, IconRowCard and HeroCard wrappers
are deleted. Callers use LedgerRow, Card and SceneBrief directly. No tint or
retired wrapper is allowed in production source.
## Illustrations

### Flat drawings

Revamp B's pictures are ILLUSTRATIONS.md's flat drawings, one illustrator's
hand: flat fills from the palette only, no gradients, no outlines except
deliberate 3pt ink or white strokes, no words and no faces. They are vectors,
generated rather than drawn in code by hand. `node scripts/illustrations.mjs
<kit>/ILLUSTRATIONS.md` converts each drawing's `<svg>` into a react-native-svg
component at `src/art/flat/<id>.tsx` and writes the one registry,
`src/art/flat/index.ts`: the component, its viewBox, and the sizes the
catalogue displays it at. Every hex goes through one map to a palette token,
and `lilac` exists for these drawings alone. An element, an attribute or a
colour the map does not know stops the script, so a new drawing cannot bring a
colour, a gradient or a word in unannounced. Running it twice changes nothing.
Never edit a generated file: change the catalogue and run the script.

Screens draw through `Illustration` (`src/art/flat/Illustration.tsx`), by name:
`<Illustration name="state-offline" />` at the catalogue's large size, or
`fit="small"` for its second size. A caller never writes a width. On a narrow
phone the box narrows to its column and the drawing is contained in it, centred.
Every drawing is decorative, since the words beside it say what it shows, and
at most one sits on a board (STYLE section 9). `src/art/flat/scenes.ts` maps
each scene to its place drawing, `sceneIllustration(id)`, by mission rather
than by place because the café has two scenes and two drawings.

The registry ships 29 original drawings:

| Drawings | Sits on | Large | Small |
|---|---|---|---|
| `place-cafe-counter`, `place-cafe-terrace`, `place-hotel`, `place-market`, `place-directions`, `place-day`, `place-apero` | A blue or coral card | 350 by 220 | 262 by 165, a hero spot |
| `state-notebook`, `state-waiting`, `state-offline`, `state-microphone`, `state-headphones`, `state-postcard-frame` | Paper, where their ink lines carry the shapes | 160 by 160 | 120 by 120, under a headline |
| `celebrate-confetti` | Blue or coral, laid over the whole card | 390 by 260 | |
| `celebrate-wrapped` | Blue | 350 by 260 | |
| `celebrate-first-line` | Blue | 350 by 220 | |
| `postcard-cafe-counter`, `postcard-cafe-terrace`, `postcard-hotel`, `postcard-market`, `postcard-directions`, `postcard-day`, `postcard-apero` | Mint or paper, in their own white border | 300 by 190 | 165 by 105, in a row |

The six mouth guides (`mouth-y`, `mouth-u`, `mouth-r`, `mouth-nasal-an`,
`mouth-nasal-on`, `mouth-zh`) are recovered from the original local design kit,
converted at 200 by 160. Practice's sound card and the measured sound journey
map the exact IPA symbol to the corresponding guide, with an authored cue in
words. Unknown sounds draw no substitute. The seven place drawings, state drawings,
recaps, earned postcards and the weekly story reach their relevant screens.

### Raster scenes, retired

The place watercolours, `apps/mobile/assets/art/`, `Art.tsx`, the raster
registry and its map retired with revamp B (F599). Nothing in the app imports
`Image`, and every picture is a vector. The welcome, cake, wave, empty table,
recap postcard, phrasebook and wall-map rasters went before them.

The daily library and today's phrase show no pictures of places. Their French,
glosses, notes, examples and audio remain.

### Inline SVG

The static pen in `src/illustrations/pen.tsx` uses ink strokes at the one
`STROKE` (2 since revamp B), round caps and joins, a 200x150 viewBox and stipple shading. Frame spreads `decorative` on
every SVG. `NobodyYet` and `StillWriting` retain their empty-state marks but no
longer animate. `RewardMark` remains the static tick beside a drill verdict.

SpeakBubbles, OnboardWave, the unused onboarding drawings and LearnStack are
deleted. All twenty daily-pack drawings, their selector and their unused card
are deleted. The illustration animation hook and moving layers are gone.
`motion.test.ts` and `surfaceContract.test.ts` enforce static illustrations;
Legacy illustrations stay static; C2's scoped layer host and the other bounded
motion hosts are listed in the Motion section.

### Game art

The streak flame, the medal, the level crest and the freeze and repair marks
are flat vectors built in code (come alive, decisions D10 and D22), not
catalogue drawings, so they live in `src/game/art/` and stay out of the flat
registry and its pinned 29. Each is a list of named parts on a 100 by 100 box in
`src/game/art/shapes.ts`, and every part names its fill by palette token
(`colour.coral`, `paper.field`), never by value, and never the highlighter or
lilac. They keep the one hand: flat fills, no outlines, gradients, shadows,
faces or words. A waiting state is the same drawing in the paper greys: the
unlit flame before the day's first practice, the next medal on the badge shelf,
a used freeze. On a colour ground, a drawing that uses the ground's own colour
trades it with white, so the flame on the coral milestone card is white and
sun. Every one is decorative: the words beside it carry the meaning, and the
crest draws no level number or name. The flame lights from an ember and
flickers three times while in view, by moving whole layers with transform and
opacity; the rest are still. There is no chest (D22).
`node --experimental-strip-types scripts/art/game-art-sheet.mjs` writes the
contact sheet, `artifacts/game-art/index.html`: every drawing in every state at
48, 96 and 160 px on paper and the four colours. The founder approves the art by
eye on that sheet before it ships, and `src/game/art/shapes.test.ts` (F746)
holds every part to the palette and its 100 box, and every Svg to `decorative`.

The celebrations draw this art on their stages: the flame on the streak cards,
the crest on a level and the medals on a badge card. Where a confetti burst cannot be its own final frame (under reduced
motion, and on the web once it has fallen) the catalogue's `celebrate-confetti`
is laid over the stage instead, through `src/celebrate/ConfettiStill.tsx`, which
is also what keeps that drawing on a screen. On a mint, sun or paper ground its
pieces of the ground's own colour fall away into it; the rest still read.

## Structure

First run builds the learner's plan through purpose, interests, self-reported
level, confidence, focus and daily goal, then a deliberate tutor choice.
“Meet your tutor” says “Listen, then choose your tutor.”; tutor cards keep names
without an AI Tutor suffix, and hearing a sample never selects it. The linked
Terms/Privacy declaration and processing disclosures precede real guest
practice. A refused microphone offers typing. Name and conversation goals
remain optional Profile choices after setup. Returning learners sign in; the
repair flow retains its existing account-scoped questions and known refusal
gate, with a Terms notice in place of an age question.

Returning Sign in uses “Good to have you back” above a centred form and embedded
official Apple/Google buttons. It omits onboarding progress, password-strength
requirements and guest-practice copy. Create account retains progress and
“Your practice stays with you”, together with its actual password guidance.
Provider configuration and real authentication outcomes remain authoritative;
the presentation does not imitate a successful sign-in. Email Next explicitly
advances to Password; typing alone never changes focus.
The primary action hides while the software keyboard is open, and native
insets scroll the focused field into view. Live Dynamic Type changes refresh
text measurements without capping the system size. Shorter viewports tighten
spacing; tall windows centre the reading column.
Keyboard and accessibility overflow remains scrollable to keep fields reachable.

The signed-in app has five tabs (Today, Explore, Speak, Practice, Journey),
each opening Profile from the labelled avatar. Explore's content is the
catalogue ported from the Codex branch; the other four still show their
revamp B content until Phase B rebuilds them. Friends is a Profile route and retains shared challenges and moderation.

| Tab | What it is |
|---|---|
| Today | The greeting, then the hero (`game/TodayHero`): the flame and the run, which open the Streak screen, today's goal ring in measured minutes and the level chip, each from the game layer and absent rather than nought when unread; one factual nudge line only while a run is waiting on today. Then one shared next task: unfinished personal practice, usable practice, then a scene on the blue brief with its place drawing; a truthful plans gate when the free allowance is used; genuine local practice offline; a lifetime day count; starting scenes or two week sentences; today's three quests (`game/QuestsCard`, the one quiet line once all three are done, no chest); today's French with Practise it, Save and More phrases; friends. A number that rose since Home last drew it counts up once and never counts down. |
| Explore | Topic tiles with their drawings, conversation ideas shaped by learning preferences, skill and practical collections, and search over scenarios, missions and phrases. A collection or scenario opens `ExploreCollection`; the last rows open the word library and Journey. |
| Speak | The chosen tutor or real continuity, the same next task as Home, then the current level scene path. The grouped scene list opens a brief before starting. |
| Practice | One ready next practice made from the learner's saved work or due review, with its French line first, then an optional sound example and guide. The three rows for replay, own phrase and due review appear only when they can start. Shadowing is free offline. The archive is one level down in Conversations. |
| Journey | A first task when empty. Once there is practice: the numbered level and its XP (`game/LevelXpCard`, never a rank name), the run and this week holding the weekly day line (`game/StreakSummaryCard`), four counts that open their sources (`game/CountsGrid`) and the badges earned with at most three ahead, never locked (`game/BadgeShelf`). Then independently earned can-dos before the A0/A1 level card, the one pill; earned postcards as a shelf of drawings and a week story, only with evidence; saved phrases, sound evidence, conversations and goals as rows, each led by its tile. |
| Profile (avatar) | B-Profile (2026-10-21): the back disc and the 44pt gear, the 76pt sun disc with the initial, the 30/800 name (the page's heading), "Learning French since" when known, and an Edit pill. A white stats card (stage, level over XP, the run) opening Journey and Streak; the blue plan card ("Your plan" in sun, the plan's name, what Free includes, See plans to the Wall; an unread or unknown plan names no plan and is never called Free). Then Learning (preferences, the tutor as the orb opening the voice sheet, what the tutor remembers with the round lock), Your French (Your journey, Saved phrases with the saved count, Your sounds with "One sound is ready to revisit" only while the sound journey holds one, and the round lock) and More (Friends, Help and feedback only with a contact address, Privacy). The tab bar sits under it with no tab selected. |

Two routes hold the standing choices and the plan (P2, 19 October 2026). Both
are pushed with the shared header's chevron and an inline title, and both are
grouped lists.

| Route | What it is |
|---|---|
| Learning preferences | Opened from Profile. An intro line saying these never change the level earned, then Routine (the daily goal as its five choices, the one editor it has), How your tutor helps (correction style, the same row word for word as the memory screen's, then Tutor speaks more simply and Prefer typing), and Conversation starting point: one row whose subtitle is the chosen sentence, opening the four options, saved through `withStatedLevel` with the footer saying the earned level stays. |
| Subscription | Opened from the plan row on Profile and Settings. The plan's name at `title`, its period in words, and a tutor-time card saying the speaking-time band in words. No minute count, no date and no filled track (F377, F541), and no price row, because nothing on the phone says which product the account holds. Manage in Apple Subscriptions, Compare plans (See plans for a free learner) and Restore. Restore says what the store found: a granted restore says it is on this account and re-reads the plan, and nothing found says so. When the plan cannot be checked, an `inset` notice and a 56pt Try again, with Manage and Restore still there. |

Settings (B-Settings, 2026-10-21) is seven groups in this order: Account,
Plan, Practice, Phone, Appearance and sound, Data and privacy, Help and about,
then Delete account alone in a card with no heading at the foot, standing apart
from every routine row. Rows are the B row: 16/600 label, the answer stacked
under it at 15, a longer line at 13, the 18pt chevron, in a white list at radius
22. Plan adds Free speaking time (the D24 band in words) on the free plan.
Practice has Speaking target and the correction style (into Learning
preferences) and the two switches over the same stores. Phone holds the daily
reminder, its time, the trial-ending reminder, and a refused notification or
microphone permission, with the footnote that at most one reminder comes a day.
Appearance and sound opens the Display choice (Follow device, Light, Dark).
While notifications are denied for Luvani the switch reads off, its line says
the reminder can't be sent, and an Open Settings row sits under it. Summaries that join several
facts join them with commas: middots are out of learner copy.

Three routes carry what used to be a section of a tab. Each is pushed, each opens
with the shared header's one chevron, and each was moved rather than cut, because
a section with a learner's own data behind it is worth a page.

| Route | What it is |
|---|---|
| Friends | Optional shared challenges, privacy and moderation, opened from Profile or existing friend links. |
| Phrasebook | What My French's phrase shelf opens. The one-line card first, a single phrase from the deck with the English showing and the French withheld until an attempt lands, because the thing worth doing should never sit under a list of things already done. At twelve saved entries, local French/English search helps retrieve a line without changing evidence. Then the kept phrases as white cards grouped by where they came from, each with a speaker. Then the cadence set at the foot: ten authored connectors with the note each was written with, the ones the learner has produced unprompted lifted to the top |
| Conversations | What My French's **Your conversations** row opens, and where Practice's archive went. The filters, the vault said in words, then the feed: one row per finished conversation carrying when it was, how long they spoke and what it left behind, each one opening a drill on its own phrases. The pack library opens over it in place rather than as a second push, which is why this screen answers Android's back itself. Deleting a saved conversation, and deleting all of them, is reachable here and nowhere else |

Every tab opens the same way. A **TabHeader** is the first thing in its scroll
body: a display title on the left, one plain purpose line beneath it in soft ink,
and an optional trailing **Monogram** for the learner's initial. It is not passed
to the frame's `header` slot, because a fixed display title over a purpose line is
taller than the screen at the largest reading size and has to scroll with the
content. **Home's purpose line is the hour's question**, "Ready to speak French
this evening?", which is the one purpose line in the app that changes during the
day; `surfaceContract.test.ts` holds Home to reading it from the greeting rather
than spelling it, because a sentence typed into the tab is a sentence that stops
changing and nothing would say so. Home draws no monogram: the initial is
Profile's, once, and the greeting already says the learner's name.
The header can overlap an outgoing and incoming Home greeting in one stable
line-height slot. The caller drives one native value; the frame cross-fades the
two complete phrases and starts no timer of its own.

Two rules ride with the block. **One primary pill per door**, so the eye has one
place to go on each thing it can act on. That used to read "one per tab", and it
has only ever been tightened: the count is pinned per tab at exactly what each
one draws, over the tab AND every card it draws, so a pill that moves into a
component cannot go uncounted. Home's pill is Start conversation on tonight's
card. Practice's is its recommended action: resume, a short practice, or the
first conversation, with exactly one branch shown. Tutor has one explicit
Start action in its recommendation panel, with Speak/Type selection; My French has none, because a list of places is a
list and the next place is the first row of it; Profile has none, because nothing
on it is a thing to start.

Secondary destinations are white list rows or quiet links. Labels use sentence
case and ink; the blue is reserved for brand navigation or its colour ground.

Navigation is React Navigation: a root stack whose first screen is the tab
navigator, with the lesson, the conversation, drills, review, the mission chooser
and the three routes above (`Progress`, `Phrasebook`, `Conversations`) as
siblings *above* it. The chooser is a stack screen rather than a tab
because the same surface is needed from three doors: a first run opens on it, a
Home card pushes it, and the Tutor tab's first two doors lead to it. That is what hides the tab bar on a metered screen, and what makes
leaving a live session an explicit act rather than a tab switch — a room that
survives a tab switch is a room the meter is still counting.

Each tab is a glyph and a word in the ink capsule. The selected tab is the
violet cell with a sun glyph and the others cream on ink, with selected state
announced to assistive technology. Its shared
press supplies interaction feedback; the tab itself has no moving wash.

On web the app is still a **460pt centred column**, and the navigator mounts
inside it, so the tab bar is clamped to the column rather than spanning the
browser.

## Inside a conversation

The C2 scene screen uses the shared orb, transcript, composer and compact mode
controls described above. Current-turn support and Help me out, Simpler,
Give me a moment and In English retain their existing protocol actions behind
the practice-support control. They wrap rather than shrink and retain the
44-point floor. A failed connection and a safety stop keep their dedicated
recovery surfaces.

Three rules the row now keeps that it did not:

- **Hear it is only drawn when there is a line to hear.** `hear` speaks the
  support line, so on a hint turn, an options turn or a bare turn the button
  was pressable and silent. It is hidden instead of being taught to speak the
  tutor's line, which would hand back exactly what the support ladder withheld.
- **Replay lives on the tutor's last bubble**, not on a sixth chip. Tapping it
  plays that line again, and the bubble now shows its ear so the affordance is
  found rather than guessed: ink while quiet, the accent on a `groundDeep`
  disc while the tutor is sounding, exactly as an option card's ear. Every
  tutor bubble carries the tutor's name, so a thread
  read back later still says who spoke.
- **A learner who prefers typing** opens the conversation with the reply box
  already showing and the microphone closed until the circle is tapped; the
  tutor still speaks. It is a standing choice in Profile, not the quiet door,
  which is still taken per session where the learner is standing.
- **Give me a moment stays enabled while the tutor talks.** Everything else in
  the row asks for a line and would talk over them. This one asks the clock to
  wait, and it is answered on screen in the quiet notice slot and never aloud,
  because a spoken acknowledgement of a pause is a remark on the pause. The
  line reports the tutor rather than the learner.

**One quiet line at a time**, in the slot above the control row. A voice hiccup
goes there and clears itself after eight seconds; a connection being rebuilt
goes there and does not, because a blip outlives eight seconds easily and the
one sentence explaining a dead room must not disappear while the room is still
dead. When both are true the reconnect is what shows. Neither is ever how a
safety message is drawn.

**The quiet door is taken where the learner is standing.** "Unable to speak
right now?" and "Continue by typing" both go quiet in the room that is already
open: the microphone goes down, the tutor stops speaking, and the scene, the
meter and the thread all stay. It used to rebuild the session, which asked the
account for a second grant while the first was still running and answered the
learner with a refusal.

**Coach marks** replace the four-page intro: one short note in `groundDeep` at
`radius.chip`, above the control row, dismissed by tapping it or by using any
control. At most one on screen, at most one *new* one per conversation, each
shown once ever. That last pair of rules is what stops three notes becoming the
manual again, spread out.

**The goals tick as they are reached.** The scene's goals sit under its title
with no count. When the learner reaches one, its mint disc pops in and the
check lands in it a beat later, the row glints once, the list scrolls it into
view, and a screen reader hears "Goal reached:" and the goal's own words. At
rest a tick is the ink check on mint it always was (the Iconsax tick-circle's
own disc would set the check on a dark teal and halve its contrast). A goal
already reached when the list appears is simply drawn ticked, and nothing ticks
after a safety stop. On the last goal the orb ripples once, and the scene's card
waits for that ripple (under a second) before it arrives; with movement reduced
it arrives at once.

**The completion moment** is a card in the support card's own place, so the
screen keeps its shape. Above the mission's own sentence about what the learner
did, the kicker **Scene complete** and the scene's place drawing on the
scene's blue (its white parts would vanish on the white card; left out on a
short screen or at a large text size, so the doors never leave the screen);
then one pill (**Keep talking**, with a line under it saying plainly that
carrying on uses minutes) and one ghost (**Finish and see your recap**). A mint
glow opens behind the drawing and 24 pieces of confetti leave the card's top
edge. No score, no
percentage, nothing about how well, and nothing is heard or felt: the room holds
the learner's ears, so the fanfare waits for the recap. Both doors work from the
first frame. It shows exactly once, at the turn the mission completes, and with
movement reduced it is simply there, with no glow and no confetti.

**End cards** close every finished sitting in place, on the page that ran it:
a drill set, a practice set, a review, today's phrase and a lesson. One mint
card under "Practice complete." (`celebrate/EndCard.tsx`) carries up to three
tiles that count up (XP, time and the sitting's own count), the goal ring and
any quest the sitting finished. Every number on it is the GameDelta that
`game/settle.ts` read back from disk once the sitting's writes landed. A tile
appears only when its number exists, and a finish the settle could not read
back stands in words with no number at all. It sounds `complete` with one
`celebrate()`, once per sitting. While a sitting page is open, and from before
it settles until its end card goes, the celebration queue is held, so a streak,
a level or a badge plays only after the learner leaves. A review with
nothing due still says "Nothing waiting." and plays nothing, and a safety stop
has no end card.

**The answer sheet** rises from the foot of a drill after each answer, as the
B-Drill feedback panel (radius 20, the 28pt mint check disc, a 17 bold
headline). A pass is the mint wash with green words and a short warm line,
`correct` and a light arrival haptic, and moves on by itself after 1.4
seconds. A typo the drill accepted is butter, "Nearly." and the real spelling,
`nearly` and a soft haptic. A miss is the plain card under a hairline with no
mark, no sound and no haptic: the first hands nothing over ("This one comes
round again."), and the second shows the French and waits for Continue, drawn
under the panel. With a screen reader on, no sheet moves on by itself. The
living bar sits in the header row between the close disc and the words (8pt,
brand on the card track), fills as phrases settle, carries no digit, glows sun
after three real passes in a row, and never moves back.

**Lines arrive.** A line said while the thread is on screen rises into place
(`BubbleIn`): the learner's a little further, from the orb's side, the tutor's
only fading in. Lines already there when the thread opens are in place.

**The recap is where the conversation is celebrated.** It is the conversation's
end card. Once the room has given the learner's ears back (the microphone
closed, the tutor quiet), its coral result page plays the moment the room held
back: a sun glow behind the drawing, the `complete` sound and one `celebrate()`,
confetti when the scene was finished on the learner's own, and a progress strip
from the settled practice (the XP it credited, the day streak, today's goal
ring). The lines page counts up to the number of lines said. On the can-do page
every finish on the learner's own this session gets its postcard stamped, the
first one louder than the rest; a finish with help shows the postcard still.
Each plays once per recap, and with movement reduced every part is at rest.

## Copy

**Chrome is plain English.** Sentence case on buttons; the caps look lives only
in the micro-`label`. French appears exactly where it is content: tutor lines,
lesson text, phrases and their glosses, review fronts, register vocabulary —
and on Home, where the greeting takes turns through seven words with the
learner's name, and where the word of the day and the daily situation's starting
line are French because they are the content. The greeting is the one place the
chrome speaks French.

**Seven greetings, and the hour decides which.** "Salut", "Hello" and "Coucou"
any time; "Bonjour" and "Morning" while it is still day; "Bonsoir" and "Evening"
after six, through midnight. Teaching somebody to say Bonsoir at breakfast is
teaching them wrong, so the pool is filtered by the hour rather than shuffled.
**The greeting and name move as one phrase.** The outgoing phrase rises one
complete line while the incoming phrase rises from the slot below it, on the
native driver with a cubic ease. The two opacities always add to one, so the
heading never disappears between words, while the full-line separation keeps
the phrases from doubling over the same baseline. React keeps the arriving phrase visible
until it is committed as current, then resets the animation before paint. At
accessibility text sizes the fixed-height animation stands down and the full
title wraps in normal flow. A learner who asked for less movement gets one still
word, the hour's French one, and a screen reader hears that same
line once: a header that renamed itself every few seconds to somebody listening
would be the most hostile thing in the app. The conversation OPENS in English (the spoken question, no menu)
with the French riding along on screen as exposure. The old FRENCH · ENGLISH
paired furniture is retired.

Prose rules: no em dashes where a learner reads, short plain sentences.
Enforced twice — `packages/core/src/copy.test.ts` for core content, and
`apps/mobile/src/copy.test.ts` which walks every non-test app source file and
fails on an em dash outside comments.

Two hard rules, held from the enamel era:

- **No mid-session message contains a number.** End cards may count; a session
  may not score.
- **No mid-session message scolds.** No "wrong", "bad", "failed", "incorrect".
  A rescue reads *"Let's take that one together."*

## Motion

The voice orb, shared press, motion primitives, celebration host and bounded
state feedback animate. Motion answers something that really happened: a
press, a choice, a save, a finished practice. It never stands in for content,
never invents progress, and never holds the learner's next tap for long.
The Hum launch screen keeps its ring turn (2.4 seconds), name entrance and exit
fade (380 ms). It waits for the app's loading holds, draws a still final frame
with Reduce Motion, and hides the underlying app from screen readers until it leaves.

The motion engine, live reduced-motion bridge, press depth, selection feedback,
voice orb, first-run flow and game celebration host are integrated. Persisted
practice outcomes publish through the settlement pipeline; purchase feedback
follows the confirmed store result. The host waits while a live room or recap
holds its queue. No daily chest or extra completion reward is drawn.

### Principles

- Motion answers a real, persisted event. Nothing celebrates a guess, a fake
  count or a safety stop.
- Content is never withheld. Reduced motion shows the final frame, never
  nothing.
- Input is never blocked for more than `INPUT_READY_MS`, 600 ms, and a
  celebration's last beat ends by `CELEBRATION_MAX_MS`, 2600 ms.
- Reduced motion is watched, not sampled. `useReduceMotion` in `motion.ts`
  subscribes to the OS setting. Reanimated reads the setting once, when it
  loads, so `motion/ReduceMotionBridge.tsx`, mounted once in `App.tsx`, hands it
  the live answer, and every call through `motion/drive.ts` passes the same
  answer explicitly. In development Reanimated logs one warning when the bridge
  mounts; that warning is the bridge working.
- Transform, opacity and dash offsets only. Layout props never animate, except
  the busy `MorphButton` closing to a circle.

### Engine and tokens

Reanimated 4.5.1 with Worklets 0.10.1 is the one engine. It is imported as
`Reanimated`; `Animated` always means React Native's legacy module, which the
files still on it keep until they move. That list only shrinks. The numbers are
`motion/tokens.ts`, and nothing else writes a spring:

| Group | Tokens |
|---|---|
| `DUR` (ms) | instant 0, micro 120, fast 180, base 260, settle 380, slow 420, flight 480, reveal 650, count 900, celebrate 900, burst 1400 |
| `STAGGER` (ms) | tight 40 (words), base 60 (rows), loose 90 (icon rows), tiles 140 (stat tiles) |
| `EASE` | out (0.22, 1, 0.36, 1), settle (0.33, 1, 0.68, 1), inOut (0.65, 0, 0.35, 1), in (0.55, 0, 1, 0.45), linear |
| Press | `PRESS_SCALE` 0.97 for controls, `PRESS_SCALE_TILE` 0.95 for tiles, `SELECT_POP` 1.03 |
| Budgets | `INPUT_READY_MS` 600, `CELEBRATION_MAX_MS` 2600, `BURST_MAX` phone 36, iPad 56, web 24 |

Each spring is described the way iOS describes one, a response and a damping
ratio, and converted rather than eyeballed: stiffness = (2π / response)²,
damping = 2 × ratio × √stiffness, mass 1. `tokens.test.ts` holds every spring
to its description.

| Spring | Response | Ratio | Stiffness | Damping | Use |
|---|---|---|---|---|---|
| press | 0.30 s | 0.70 | 439 | 29.3 | the press |
| pop | 0.35 s | 0.55 | 322 | 19.7 | the select pop, chips, medals, numbers |
| settle | 0.50 s | 0.85 | 158 | 21.4 | bars and cards |
| snap | 0.20 s | 0.80 | 987 | 50.3 | detents |

### The press

Every tappable part presses through `Press` in `components.tsx`: the drawn
surface scales to `PRESS_SCALE`, 0.97, on `pressTo` and the press spring, and
springs back on lift. Option tiles and icon buttons pass `depth="tile"` and
press deeper, to 0.95. A ratio of 0.7 overshoots a little on release by design.
Do not round the numbers further; a clamped press is a change to STYLE first.

A choice passes `selected`. When it becomes the chosen one the surface rises to
1.03 and settles home on the pop spring, and a blue ring layer fades in four
points around it, resting at 0.16 opacity. The ring is a view under the
surface, not a shadow. The caller swaps fill and words at once and
`accessibilityState` says what was chosen, so the ring is decorative. There is
no second haptic on select. Under reduced motion the scale lands at once, the
ring shows at rest and nothing pops.

A press is cancelled by Pressable itself: when a scroll takes the responder it
fires `onPressOut` and never `onPress`, so the spring returns and nothing
happens.

The highlighter does not draw in. It is SNIPPETS' band, whole from the first
frame. `drawIn` and `DRAW_MS` stay exported with no caller until Stage 6
retires them.

### Primitives

The primitives live in `motion/`, and screens compose them; a screen never
imports the engine. Each takes its answer from `useReduceMotion()`, is
`pointerEvents="none"` and decorative when it is decoration, and stops on its
final frame when it unmounts or the app leaves the foreground
(`motion/landing.ts`). A one-shot waits at most `ANSWER_WAIT_MS`, 300 ms, for
the OS to say whether movement is reduced, then plays the reduced version. Each
primitive's own numbers are named groups in `motion/tokens.ts`.

- `StaggerIn`: children arrive in turn, once, on first mount, the whole cascade
  starting within 480 ms.
- `CountUp`: a real number counts to its value at most 30 redraws a second; a
  screen reader hears only the final value, and the widest value holds the
  width. Ticks follow `motion/countTicks.ts`: by touch at most 12, 70 ms apart;
  by sound at most 10, 90 ms apart; never on the final value.
- `ProgressRing`: a ring draws by its dash offset to a stored fraction. On the
  web it redraws from state at most 30 times a second, because an animated Svg
  prop there is unproven.
- `LivingBar`: a fill springs to its real position from the left, with a shine,
  a spark at its edge, and one stretch when it fills.
- `Burst`: seeded flat confetti (`motion/particles.ts`) in the four colours and
  the card's white, never the highlighter or lilac, and never the ground's own
  colour, at most `BURST_MAX` pieces. Nothing under reduced motion.
- `DiscBloom`: three flat discs open behind a win. It is the spec's Bloom under
  another name, because `Bloom` is a retired export.
- `TokenFlight`: a chosen token travels to where it is kept, at most two at
  once, drawn by the one `FlightLayer` at the root. It lands at once, with
  nothing drawn, whenever it cannot fly.
- `Glint`: one pass of light across a pill that has just become available.
- `MorphButton`: a button that shows it is busy, and done only from a real
  result; an error opens it back with no shake. Under reduced motion only its
  words change.
- `Enter`, `Reflow`, `Exit`: entrances, reflows and exits in a layout.
- `BubbleIn`: a transcript line added after the transcript opened arrives.
- `LevelRing`: two rings swell with a live sound level; under reduced motion,
  three opacity steps and no scale.

### Celebrations

One host, `celebrate/CelebrationHost.tsx`, is mounted once in `App.tsx`, over
everything the navigator draws and outside it, so it covers the first run too.
It plays every full-screen moment, and only for a fact already on disk: the game
pipeline and the wall publish to it (`celebrate/events.ts`) after their writes
land, and every number it shows comes from the moment's own data. The queue
(`celebrate/queue.ts`) decides; the frame and templates draw.

- **A finished practice ends in place.** The screen draws `celebrate/EndCard.tsx`
  on the page: mint, "Practice complete.", up to three tiles counting up (XP,
  time and the screen's own count, each only when its number exists), the goal
  ring drawing from before to now, the quests this sitting finished, the day so
  far ("2 of 3 quests done today"), and the cap line when the daily XP limit held
  some back. It sounds `complete` with one `celebrate()` once per sitting, and
  holds the queue while it is on screen. On the sitting that finishes the day's
  third quest, the day so far is the one quiet line "All three quests done
  today." and it lands with the `quest` sound, which is also the card's one
  sound under Reduce Motion. It sounds once a day: a day another phone already
  finished reads the line silently. Nothing more: no chest, no extra XP, no
  takeover (D22).
- **Then at most three takeovers**, in one order: a confirmed purchase, the
  streak (a milestone replaces that day's plain streak moment), the level (a
  number from `xpLevelFor`, never a rank name), the badges (up to three to a
  card). What the budget leaves over is
  a quiet row under "Also today" on the last card, never a fourth takeover. A
  moment that arrives while that last card is up joins it as a row; one that
  arrives in the moment after it has gone is left for the game layer's
  catch-up rather than played as a fourth.
- **Holds pause, they never drop.** Nothing starts while a microphone or a live
  room holds the audio focus, a sheet or an end card is up, or the app is away; a
  card already showing lands on its final frame and waits. A moment that waits
  longer than ten minutes is let go. A sign-out clears the queue.
- **Nothing after a safety stop.** `tutor/SafetyStopView.tsx` suppresses the host
  on mount: the queue and the card on screen are cleared, sound effects fall
  silent, and nothing new is taken until the screen has gone (F137).
- **Once only.** An account's moment is checked against the synced `game.seen`
  list and marked there when its card reaches its final frame or is skipped, so
  it plays once across every device; a guest's moment and a toast are remembered
  in memory. A moment waiting to play is also kept on the phone (`gameLocal`);
  replaying it once after a crash is the game pipeline's catch-up, which reads
  that copy back, not the host's.
- **The frame** (`celebrate/Takeover.tsx`) is modal to a screen reader and
  moves focus to its title, whose label is the title with the main value, so
  landing there says the whole moment. It announces the moment only where focus
  cannot land, so the two never talk over each other, and a level's number does
  not change under a screen reader. Words sit in the shared frame's scroll in a
  column at most 520 wide, centred on an iPad, and no line is capped. Continue
  is always there, ready by `INPUT_READY_MS` and at once under reduced motion or
  with a screen reader on; nothing dismisses itself. The first tap anywhere
  skips to the end. Android's back is Continue once Continue is ready; before
  that it skips to the end, so a back press meant for the screen underneath
  never loses a moment unseen. Each card's beats are data in
  `celebrate/timelines.ts`, ending by `CELEBRATION_MAX_MS`.
- **Reduced motion** shows each card's final frame at once, watched live, and
  still plays its one sound and haptic, because they are not motion. A card
  that a hold or a skip landed before it began stays silent. Where a
  burst cannot be its own final frame (reduced motion, and the web once it has
  fallen) the still `celebrate-confetti` drawing stands in, through
  `celebrate/ConfettiStill.tsx`.
- **Silent and still in a live room.** No beat sounds or is felt while a
  microphone or a live room is open. A saved phrase shows a small toast that
  blocks nothing and is hidden from a screen reader, because the screen that
  saved it already says so.

### Loops

The live orb, a busy `MorphButton` and a held icon state such as a playing
speaker have their scoped loops. C2 adds the shared illustration loops and
welcome logo ring defined above, including continuous gentle Home flame
movement. Each loop listens for focus, app state, reduced motion and its own
active/playing/paused state; none owns navigation, storage or repeated reward
events.

### What never moves

The tab bar itself (its selected icon pops once in `nav/TabGlyph.tsx`), the
greeting, the highlighter, the skeleton, the layout primitives, the flat
drawings themselves (a wrapper may move one; the drawing
does not), and legal or consent text. Inside a live room only the orb, the
goal ticks, the arriving lines and the scene's card move, and nothing is heard
or felt; the fanfare waits for the recap.

### Haptics

Through `motion/haptics.native.ts`, with safe no-ops on the web, and on a device
only while the haptic setting is on, no recorder holds the microphone and no
spoken live room holds the audio session (`hapticsEnabled()` in
`motion/hapticPreference.ts`, over the holds in `sound/audioFocus.ts`; a typed
live room opens no audio session, so it takes no hold). Every native call
swallows its own refusal, so a haptic never blocks navigation or learning state.

| Moment | Haptic |
|---|---|
| Any press (the default) | `pressed()`, a light impact |
| A choice, a toggle, a tab | `tapSettled()`, a selection tick |
| A hint arriving | `soft()`, the softest impact |
| Something earned arriving | `arrived()`, one success |
| A step in a count | `tick()`, a selection tick at least 60 ms after the last |
| A weight landing, a flame lighting | `thump()`, a medium impact |
| A real win: a finished practice, a level, a confirmed purchase | `celebrate()`: success, then medium at 140 ms, then light at 280 ms |
| An error, a refusal, a safety stop, anything while a spoken live room holds the audio session | nothing |

Each beat of `celebrate()` asks the setting again as it fires, so a microphone
opening mid-pattern silences the rest, and `cancelHaptics()` drops whatever has
not fired. `Press` takes `haptic`: `light` by default, `selection` for a choice,
and `none` where the caller answers for itself, as the tab bar does.

### Sound

Twelve short sounds, synthesised for Luvani: tap, select, correct, nearly,
complete, streak, levelup, quest, badge, save, count-tick and whoosh. None plays
until the founder has approved it by ear. Sound effects follow the silent
switch, have their own Settings switch, mix with the learner's music, and never
play while a microphone is open, the tutor is speaking or a live room is open.

### Enforcement

`motion.test.ts` holds the rules:

0. `Animated` means React Native's legacy module; Reanimated is imported as
   `Reanimated`.
1. The engine is imported only in `motion/`, `celebrate/`, `game/art/`,
   `onboarding/firstRun/`, `icons/AnimatedIcon.tsx`, `nav/TabGlyph.tsx`,
   `drill/AnswerSheet.tsx`, the orb layers in `tutor/`, `live/RoomLevels`,
   `speech/useRecorderLevel.ts`, `auth/PasswordMeter.tsx`, the guarded
   `auth/WelcomeSignInGlow.tsx`, the scoped C2 host
   `onboarding/motion/C2Scene.tsx`, and in `components.tsx` only by `Press`.
2. The legacy `Animated` file list only shrinks.
3. Every file that moves reads reduced motion from `motion.ts`, and nothing asks
   Reanimated for the system setting: no `useReducedMotion`, no
   `ReduceMotion.System`, and `ReducedMotionConfig` only in the bridge.
4. A loop runs only where it can be paused.
5. The engine's animation calls (`withTiming`, `withSpring` and the rest) live
   only in `motion/drive.ts`, and every spring is a named token.
6. Only dash offsets and opacity animate through props, and only `MorphButton`
   animates a layout prop.
7. No test imports a module that imports the engine, `expo-audio` or
   `expo-haptics`, because a suite that cannot load disappears.

`tokens.test.ts` holds the springs to their derivations, `components.test.ts`
holds the pill, the link, the ledger row and the segmented control to `Press`,
and `motion/haptics.test.ts` holds the haptic vocabulary. `motion/primitives.test.ts`
holds the primitives' shared promises, and `countTicks.test.ts`,
`particles.test.ts` and `flights.test.ts` hold the ticks, the confetti and the
tokens in the air.

No interface surface casts a shadow except the one soft lift (see Shadow).
## Evidence and remaining work

Core owns earned independence. Bounded completion history preserves its strongest
valid rung and recent replays, on the device and after sync. New day counts retain
date keys when detailed activity ages out. A quiet week supplies no story. A failed
read supplies no new achievement claim.

All six mouth guides are recovered from the original local design kit.
New live task judgments, spoken own-words and hands-free background sessions still
require their backend contracts, real-domain evaluation and the required independent
review. Live pronunciation remains disabled under the founder's existing decision.
The worktree continuation report records those gaps and verification limits.

## Brand mark and launch

The mark is **Hum**: the tutor's orb, humming. A coral core sits inside a sun
ring that ripples in seven lobes, one pointing straight up, on the brand blue.
It is the conversation's orb made into a sign, so the icon promises the thing
the app does. On a light ground the ring turns coral and the core blue; the
one-colour versions are ink and white. It carries no chartreuse. The wordmark is
a rounded lowercase "luvani" drawn as paths, so it needs no font file.

One generator, `brand/source/hum_kit.py`, writes every master.
`apps/mobile/assets/brand/` holds the app's slots: the store icon, the iOS dark
and tinted faces, the Android adaptive layers, the favicon and the splash mark.
`brand/` holds the full kit for the web and marketing, and `src/brand/hum.ts`
holds the geometry the launch screen draws. Their README files say which file
goes where.

The launch. The native splash is the mark at 128pt on the brand blue, and it
is held up until `launch/LaunchScreen.tsx` has drawn that exact frame over the
app and been laid out. Only then is it released, so on iPhone the hand-off
cannot be seen. (Android fades its native splash out over 400 ms, so there it
would show; Android is not built yet.) The ring turns, then the mark lifts and
the name settles in beneath it,
which leaves the stacked logo. Once nothing is loading and the name has
arrived, it fades onto wherever the app was already going: the welcome and
onboarding for somebody new, Home for everybody else. The screens decide that,
not the launch. Readiness comes from the waits themselves, each holding the
launch while it is on screen (`launch/launchHold.ts` lists them): App.tsx's
`Loading`, ProfileGate's profile read, and the guest-practice reads in
GuestAccountHandoff and PreAccountOnboarding. A fast launch waits at most
620 ms for the name; a slow one waits only for itself, with the ring turning
instead of a spinner. The launch is capped at 12 s, above the fresh-device
wait, so a stuck load is never hidden behind the mark. Reduce motion draws the
stacked logo at once and keeps the ring still and upright. A screen reader
meets the launch alone, as "Luvani", and reaches the app once it has gone.

## When something breaks

The app has one error boundary, `src/app/errorBoundary.ts`, and it is the
door's own root in App.tsx, so every screen is inside it. A throw while a screen
draws, or in one of its effects or cleanups, no longer empties the screen. The
learner meets the error screen instead, drawn the way the door's other notices
are: a title, one plain line that says the fault was the app's, and one ink
pill, Try again, at the foot. The line is said through TroubleLine, so VoiceOver
hears it. It names no screen and promises nothing about saved work, because it
can follow an account deletion the learner asked for. There is no back arrow,
because there is nothing behind it to go back to. Try again opens everything
behind the door afresh, the way a relaunch does, while the door itself keeps
what this launch must remember. The launch is drawn outside the boundary and
fades onto the error screen like any other. The words are in
`src/app/appErrorCopy.ts`.

## What has no design yet

Alternate app icons (phase 2 of the come-alive programme) and a Liquid Glass
`.icon` assembled in Icon Composer. Today's icon ships as PNG light, dark and
tinted faces, which iOS 26 renders with its own glass treatment.

### Video review implementation, 4 October 2026

The founder approved expanding the motion contract. `motion/Feedback.tsx` is the
shared animation host for the post-onboarding app. It applies opacity and at most 4pt translation to a
real selection, setup-context change, durable save, completed local practice,
requested help or reopened kept material. Timings are 200/260/440/320/200/260ms
in `motion/feedbackPolicy.ts`; the existing earned-only confetti falls once over
650ms. These are prototype timings, not research measurements. Content and
controls remain available throughout. Reduce Motion shows the final state;
unknown settings wait conservatively. Backgrounding and unmount stop motion.
Event identifiers deduplicate responses in bounded session memory and are never persisted or transmitted.
At that review the press spring and the controlled VoiceOrb were the only
spring and continuous movement; the Motion section now governs both. No fake
progress, punitive mascot or artificial processing delay is added.

At that review there were four primary tabs: Home, Speak, Practice, Progress
(five arrive in A3, see Composition rules). Friends is an optional stack
screen reached from Profile, preserving its URL, invitations and privacy controls.
Home and Speak use `NextTaskCard`: unfinished personal practice, usable personal
practice, then the next authored scene; unavailable live service offers the same
bundled coffee line in the selected tutor's voice. Empty Practice uses that same
card. Colour belongs to meaning: blue next task, sun local café practice, coral
recap with a white French reading surface, mint independently earned can-do.
The first recap view leads with actual French, never a count or illustration.

## Earlier onboarding interaction update, October 2026

This pre-C2 composition used existing vibrant vector brand illustrations with no mascot. It omitted decorative eyebrow labels, pills, repeated account pitches and a tall syllabus. Questions led with one readable heading, illustrated full-width options and a deliberate Continue; the shared primary control used radius.control. The current onboarding composition is under Onboarding and first arrival.

Come alive (README Part 5.C, first run). The promise, where, level and daily goal build a visible "Your French plan" card on the sun: one slot per answer, empty until the learner answers, each answer flying into its slot from where it was chosen (TokenFlight, launched by the card). Answers are icon tiles (Iconsax Bulk on a coloured ground), nothing is preselected, and "Suggested" marks only the daily goal the learner's own answers point at. A disabled Continue or pill is the sand skeleton with soft ink words (a white pill on blue or coral takes blue's pale secondary); turning on fades the ink in and glints once. The plan reveal draws the real daily minutes as a ring with a count-up (Choose each time sets no target, so its ring is the empty track with "No fixed goal") and three real tiles, with one select sound and one settled tap, because setup is not learning. The start sheet keeps the legal order and plays nothing. The first win sets the learner's line beside the natural line; only an accepted reply the learner gave turns the page coral with a held bloom, the drawing rising and one burst of confetti, the correct sound and the celebrate haptic, and anything else stays calm on paper with the nearly sound and one soft haptic. Nothing sounds or buzzes while the microphone is open. Under Reduce Motion every part lands on its final frame and the microphone meter becomes words.

After the win (README Part 5.C rows 9 to 12), day one uses darker green (`#1CB982`), navy type and a cream streak summary. An original local Rive flame ignites for 800 ms, then gently deforms its contour and inner layers while visible; web animates the same cubic geometry. A fresh, durably saved qualifying day owns one central flame-and-message entrance: hold, fade, reposition while invisible, then reveal the settled hero and supporting content in a restrained stagger. First days and milestones take 2,120 ms, ordinary daily updates 1,200 ms. One brief confetti burst, the existing streak sound and a preference-aware success haptic accompany ignition. The actual count never counts up from a fabricated value: one day says “Your streak has started.” and longer runs “Your streak continues.” Seven localised weekday indicators start at the achievement's local calendar date, with a golden check for its completed practice, a clear Today label and neutral future dates; a nearby milestone derives its remaining days from the run. No qualifying run or future-only record gets a streak claim. Continue learning opens Save progress; the no-run state offers Start learning French and opens practice. Optional Remind me tomorrow opens the shared time-confirmation sheet only where available and not already enabled; permission is requested only after the learner chooses Remind me. Back stays accessible, a tap skips without activating the revealed action, and event receipts prevent replay on reopening or retry. Reduced motion and native screen readers show the final still composition; backgrounding, navigation and sheets settle the entrance and pause idle motion. Opening the page never awards a day. The save card shows only earned results, with no “On this phone only” label; the guest home retains its actual run, kept natural line and action tiles. The existing-account first-run offer remains the existing wall, once after a kept practice and gated by real account and store status.

Onboarding motion is interruptible and event-driven: card 180 ms; Continue arrow 100/140 ms; page opacity/translation 270 ms; progress transform 220 ms; illustration pulse 140/220 ms or 300 ms success settle; sheet 310/250 ms. The streak entrance is brief and skippable; its quiet contour-deforming idle runs only while the screen is visible and the app is in the foreground, with Reduce Motion showing a still frame. Native uses supported opacity/transform drivers; web uses its supported driver. Live Reduce Motion changes cancel to final states. One accepted-action haptic, no duplicate selection tick and no vibration during recording; honor the Settings preference. Preserve screen-reader heading focus, modal trapping/restoration, keyboard/safe-area behavior and the visible Close/Cancel action.
