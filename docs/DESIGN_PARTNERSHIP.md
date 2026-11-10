# Design partnership

How the founder and Claude improve Luvani's screens together, one screen at a time,
and what has been learned about the founder's taste. Started 2026-10-29.

`DESIGN.md` records what is built. `DECISIONS.md` records each approved direction as a
UI entry. This file holds the working method, the taste log and the screen queue, so a
new session can pick up the design work without asking again.

## Why this exists

The 2026-10-29 assessment found that many screens work but feel flat. The causes were
systemic, not one screen at a time:

1. The spec described inventories, not compositions. `DESIGN.md` lists each screen's
   content in order, with data rules, and never says what the screen is for or where
   the eye should land. So every screen became a stack.
2. Every tab shared one skeleton: `ScrollScreen`, `TabHeader` with the avatar, then
   five to eight cards.
3. Parts sprawled: about 65 card, tile and hero components, about 70 local card
   re-creations, 8 button types, 9 row types, three type scales, 260 literal radii.
4. Motion was well built but sat in the wrong places: the live tutor barely moved and
   every route used the same fade.
5. Reviews checked function and fidelity to an artboard, not quality, and only on web.
6. The direction came from AI-drawn canvases and the founder's taste was never written
   down.

## The method, per screen

0. **Journey pass.** A new feature, or every third screen, starts from its journey's flow
   map on the [Journey map board](https://claude.ai/artifact/WYeAGkxrmLwyYCSxarHi3T)
   (founder, 2026-11-02).
1. **Brief.** Claude writes half a page: who the learner is here and how they feel,
   the one focal point, the primary action, what must stay (data, locks, flows), and
   what makes this screen unlike the others. The founder corrects it.
2. **Direction board.** Two or three genuinely different directions as interactive
   phone-size prototypes on a Design canvas, using the real palette, Outfit and motion
   timing, beside today's screen. References from Appllama are described with what to
   take and what to leave. The founder picks, mixes or says "more of / less of".
3. **Decision.** Recorded as a `DECISIONS.md` UI entry, plus a line in the taste log
   below.
4. **Build.** An implementer works in a worktree to an exact spec. A change to a shared
   part names its blast radius first.
5. **Inspect.** On the iOS simulator and on web, at 320 and 375 pt, light and dark,
   large text and reduced motion. Claude fixes the top defects in one pass and shows
   before and after. Anything not inspected is said to be unverified.
6. **Review together.** What works, what is still weak, what is unverified. The next
   screen waits for the founder's OK.

Every third screen, look for a weakness that keeps recurring and fix it once in the
shared parts instead of again on each screen.

### Brief template

```
Screen:
Who and how they feel:
The job of the screen (one sentence):
Focal point:
Primary action / secondary actions:
Must stay:
Unlike other screens because:
Today's problems (with screenshot):
```

### Inspection checklist

Hierarchy and focal point, composition (not a generic stack), type and spacing on the
tokens, colour pairs on the contrast contract, interaction feedback, motion purpose and
reduced motion, safe areas and keyboard, 44 pt targets and screen reader labels,
loading, empty, error and success states, and performance of any looping animation.

## Taste log

Each line is a preference with its source. One answer is not yet a rule; a preference
becomes a principle once it holds across two or more screens.

| Date | Preference | Source |
|---|---|---|
| 2026-10-29 | Deepen Bright Luvani: keep the paper, ink, Outfit and the four colours; add composition, focal points and fewer cards. Do not change the identity. | Founder, direction question |
| 2026-10-29 | The cloud and the toast become Luvani's mascots, with expressions and animation. | Founder, characters question |
| 2026-10-29 | Motion is alive where it matters (the live room, wins, moving between places); everything else stays calm and quick. | Founder, motion question |
| 2026-10-29 | The tutor's identity is their portrait (founder decision 25, F945). Mascots are companions and must never be mistaken for the tutor. | Stream E, decision 25 |
| 2026-10-29 | Live room: B (face to face) as the base, with C's visible script, margin fixes and cloud mic, and A's goal stamps. Not taken: A's stage, seated mascots and speech bubble, B's goal bar and mascot pop-up, C's highlighter. D still marks the learner's lines in sun so they stand apart from the tutor's. | Founder, mix question on the direction board |
| 2026-10-29 | Remove words and elements that distract, as long as no core feature is lost. | Founder, same answer |
| 2026-10-29 | Direction D accepted as drawn (including the sun mark on the learner's lines) when the founder asked for its build spec with dark mode. Recorded as UI-014 (main's UI-013 is Stream E's). | Founder, build spec request |
| 2026-10-30 | Today: A's morning sky (a sky that follows the hour, Bonsoir after dark, the greeting and profile in the sky, one hero card that is the first stop of today's path) over Today as it ships (the rest of the path, Today's three, Coming up and the week, flattened), keeping the icon tab bar. Not taken: A's sideways rail (it hides the third item) and text-only tabs. Recorded as UI-015. | Founder, mix question on the Today direction board |
| 2026-10-31 | The stats become chunky game-style tiles: a solid tile on a darker lip like a pressable game button, a coloured coin, a big number and one word. With no streak the tile says "Start" over "today", under a minute is "<1" with "/10", and the nudge sits in the sky. | Founder, board comment (version 18) and the build session's three questions |
| 2026-10-31 | Drill and practice feedback: B (sheet and coins) picked, on every practice page, made more alive. | Founder, drill board |
| 2026-10-31 | Cloud appears at moments only: the right sheet, listening on speak drills, endings. Never on the question. | Founder, drill board |
| 2026-10-31 | One stage tint per drill family from existing tokens: Choose lavender, Build butter, Write sage, Speak peach, Review butter. | Founder, drill board |
| 2026-10-31 | The still-settling retry stays at zero XP (LEARN-018 stands), and the approved copy stays: "Practise the one still settling" and "Notice". | Founder, finish-off brief |
| 2026-10-31 | Cloud stays out of Today's sky, under "Cloud at moments only". Proposed by the design session; the founder can reverse it. | Design session, proposed |
| 2026-11-02 | Look check after Chris Ashby's design-first video: keep Bright Luvani as is (Outfit, Hum); no mascot-led icon, no second face for French. | Founder, Journey map board |
| 2026-11-02 | Mascots and play: 1C (Cloud and Toast, with poses alive at moments), 3A (the streak is the hero) and 4A (quiet moments, centre stage). Recorded as UI-019. | Founder, Mascots and play board |
| 2026-11-02 | One sky everywhere (2B). The founder first took 2A, then chose 2B when asked and confirmed it. Council warning, not a founder decision: the shared sky must not become one header skeleton for every tab; each tab keeps its own focal point. | Founder, Mascots and play board; council |
| 2026-11-02 | Cloud budget: 3 to 4 Cloud moments in a 5-minute sitting, the live mic not counted. The moments it listed were the first right answer, the end of the set, the recap ending and the streak. | Founder, other session ("Luvani video reverse engineering review") |
| 2026-11-03 | Cloud cheers on every right answer, in its cheer pose. That is more often than the budget above lists, and the two are not reconciled. | Founder, answer inside 1C |
| 2026-11-03 | Cloud listening on a speak drill is part of the mic, like the live room's cloud mic, and does not count toward the Cloud budget. | Founder, answer inside 1C |
| 2026-11-03 | Add Cloud's blink now, while a speak drill's mic is live. | Founder, answer inside 1C |
| 2026-11-03 | Keep Bright Luvani; change what sits under it: one systemic pass before onboarding, and watch 3 French beginners on the iPhone build before the onboarding board | Founder, design council |
| 2026-11-04 | Quiet moments (4A): centre stage on the two drawn screens (the phrasebook with nothing kept, Speak out of the free conversation), and the two nothing-to-review cards take the posed Cloud cheer so its arms show in dark mode. Other empty states keep their cards. | Founder, answer inside 4A |
| 2026-11-04 | On Speak the quiet moment replaces the out-of-time card in place, See the plans in flow; the scene hero and the rest of Speak wait for the Speak tab redesign. | Founder, answer inside 4A |
| 2026-11-06 | Profile and Settings: a mix, Direction A's Settings (one page, five groups, Account and Your plan as top rows, legal in one About Luvani page) with Direction B's Profile (identity and the stage word on a blue band). The plan leaves Profile and shows in Settings only; the name, tutor voice and display sheets become the phone's own sheet; Friends stays in Profile's More group. | Founder, [Profile and Settings board](https://claude.ai/artifact/XsB1g1G2V8t4j244S5P8zS) |

Working principles drawn from these (to confirm on the first screens):

- Mascots appear at moments (welcome, the live room, wins, empty states, help), not on
  every card. Ordinary cards use place and object drawings.
- A screen is designed around one focal point first; content is arranged to serve it.
- A card is used to group related things, never as the default container.

## Screen queue

| Order | Screen | State |
|---|---|---|
| 1 | Live conversation room | Landed on main at `d1b216c3` (UI-014, [changes/live-room-d.md](changes/live-room-d.md)) |
| 2 | Today | Landed on main at `9c7ad093` (UI-015, [changes/today-sky.md](changes/today-sky.md)); open items finished on main at `fdeeed2b` |
| 3 | Drill and practice feedback | Landed on main at `06b5ac8d` (UI-016, LEARN-018, [changes/drill-b.md](changes/drill-b.md)); open items finished on main at `fdeeed2b` |
| 4 | Conversation recap | Next, one design session then one build session |
| 5 | Systemic pass: one card family, eyebrow labels folded into headings, one quiet-action style and radius tokens. Folds in most of the 11 open push-check proposals and re-counts, before and after (apps/mobile/src, tests excluded): literal borderRadius values (244 on 0483a80a), eyebrows (75), Card/Tile/Hero exports (64), Button/Pill components (21), Row components (31), files on ScrollScreen (65) | Queued |
| 6 | Onboarding: the road to first spoken French, 12 screens from launch to the first scene | Queued |
| 7 | Speak tab (choose a scene) | Queued |
| 8 | Practice tab hub | Queued |
| 9 | Journey (My French) | Queued |
| 10 | Profile and Settings: A's Settings with B's Profile ([board](https://claude.ai/artifact/XsB1g1G2V8t4j244S5P8zS)). The 2026-11-01 "Profile, Pause personal memory" proposal stays in its side lane; the build takes its line only if that lane has not landed it | Board picked (founder, 2026-11-06); build queued after Journey |

Founder's order, 2026-10-31: one screen per session, each starting only after the one before lands.
Reordered by journey on 2026-11-02 (founder, Journey map board): recap, onboarding (added after
the recap), Speak tab, Practice hub, Journey.
On 2026-11-03 the founder put one systemic pass between the recap and onboarding (design council).
On 2026-11-06 the founder added Profile and Settings as item 10, after Journey (Profile and Settings board).

Mascots and play (UI-019, [changes/cast.md](changes/cast.md)) runs across screens, not as a screen of its own. Its briefs go in this order: brief 1 (1C, Cloud's poses and blink) landed at `7ddb04e3`; brief 4 (4A, quiet moments, [changes/quiet-moments.md](changes/quiet-moments.md)) is building on `claude/quiet-moments`; briefs 2 (2B, one sky) and 3 (3A, the streak hero) follow the Journey board. The queued screen sessions apply the picks to their own screens.

Systemic fixes waiting for evidence from the first screens: one card system, a type
scale named by role, native sheet and modal presentation, and route transitions that
show where you went.

## Proposals from push-check

The Impeccable reviewer in `/push-check` looks at every frontend push. What breaks our own
rules it fixes in the push; redesign ideas it would not apply land here, and the founder
chooses per row. A screen's redesign session reads its rows here before its brief.

| Date | Screen | Problem | Direction | Branch | State |
|---|---|---|---|---|---|
| 2026-11-01 | Today, out of time past Starter | The hero holds the out-of-time words with a plain "Review N phrases" button, and Today's path still has its own Review row with the same words, so one intent shows twice. | Make the hero's single action a LipTile "Review N phrases" with the watering-plant art on sage, and drop the duplicate path row, so the screen keeps one focal point. | `claude/finish-fixes` | built in `claude/quiet-moments` (4A, UI-019) |
| 2026-11-01 | Today's starter-line sheet | It reads as a form: the only practice surface without a stage. | Put the prompt and translation on a Write-family sage stage band, as Drill B does, with the field and pill below; the offline note becomes one muted caption under the field. | `claude/finish-fixes` | picked in 2B (UI-019), built with brief 2 |
| 2026-11-01 | Today and the drills (eyebrows) | Labels above headings ("One fix to try", "Build it in French", "Today's phrase") add a line the craft floor avoids; DESIGN.md defines `eyebrow` tokens, so this is not slop. | Fold the label into the heading ("One fix to try" becomes the heading and the question its caption) and retire the eyebrow tokens one screen at a time. | `claude/finish-fixes` | folded into brief 2 (2B) |
| 2026-11-01 | Tab bar at accessibility sizes | Icons only (F947) removes every word, including the one that says where you are; a long press now shows it large on iOS. | Keep the selected cell's word under the sun glyph and hide only the four resting tabs' words. This revisits the founder's F947 decision. | `claude/finish-fixes` | passed to finish-off (`claude/phone-fixes`) |
| 2026-11-01 | Speak tab, offline | The bundled practice card sits inside the "Your tutor cannot connect right now." card (a card in a card), with two blue buttons competing to be the focal point. | Make the bundled line the one focal point as a LipTile-style card on the ground; reduce the connection notice to one warm line above it with "Check again" as a quiet text link. | `claude/finish-tidy` | folded into Speak tab (screen 6) redesign |
| 2026-11-01 | Speak drill (Say) | The lower half of the screen is empty and the mic sits mid-screen, away from the thumb. | Move the mic and "Unable to speak right now?" into the thumb zone; if the speak-drill rule allows, Cloud listens in the freed space only while the mic is open. | `claude/finish-tidy` | built in `claude/cast` (UI-019) |
| 2026-11-02 | Today, held at Starter | One card holds two groups, the held words and the café lesson; its 28pt French line pulls the eye from the single primary, the same line can repeat in Today's path, and at 320 the card fills the first screen. | Keep the hero to the held words and See the plans; let the café line live once, as the path's Today's phrase row marked free and offline, or as its own Speak-tint LipTile under the hero. | `claude/bug-fix` | queued for a board |
| 2026-11-02 | Today hero actions | The stat tiles above use the lipped game-button language, but the hero card's pills are flat; the hero's secondaries are borderless on the white card. | Give the hero's primary the opt-in 4pt `primaryLip` the drills use, and give hero secondaries a pastel fill so they read as buttons. | `claude/bug-fix` | queued for a board |
| 2026-11-02 | Today path rows | The "Today's phrase" accent label is another eyebrow, and the rows' underlined text actions ("Say it", "Practise") make a second link style next to the hero's; "Practise" and the hero's "Review 4 phrases" name one intent twice. | Fold the label into the row's tile or the timeline dot, settle on one quiet-action style for Today, and name the review action once. | `claude/bug-fix` | queued for a board |
| 2026-11-02 | Speak drill (Say), eyebrow | "Say it aloud" is an eyebrow above the French, though the peach stage tint already names the family (adds to the thumb-zone row above). | Drop the stage eyebrow and let the French lead. | `claude/bug-fix` | queued for a board |
| 2026-11-01 | Live room at 320 | The tutor portrait drops out and the transcript's top line is cut through its letters at the sheet's edge. | Fade the top of the transcript, or scroll so the newest turn sits flush, so no line is ever cut mid-letter. | `claude/finish-tidy` | queued for a board |
| 2026-11-01 | Privacy notice, "Who else sees it" | One paragraph of about 290 words now lists everything the model receives, and what pause covers sits in the middle; at 320 it runs past a full screen. | Split it into short body paragraphs (the live turn, remembered details and goals, the curated correction, the earlier mistake) and close with one paragraph on what pause covers, using only the existing heading and body styles. | `claude/tutor-recall` | yes, side lane, with the founder approving the new wording (founder, 2026-11-06) |
| 2026-11-01 | Public legal pages | The generated pages use the platform system font at a 1.6 line height, while the app sets Outfit at body 17/25, so the public notice does not sound like Luvani. | Self-host Outfit Regular and ExtraBold as woff2 from `assets/fonts/`, body 17/25 and the title at ExtraBold 34/38, as in DESIGN.md Type. | `claude/tutor-recall` | yes, side lane (founder, 2026-11-06) |
| 2026-11-01 | Profile, Pause personal memory | Pause now keeps out notes, goals and the earlier-mistake example, but only the notice says so. | One `small` line under the control in inkSoft naming what pause keeps out, plain and warm, no new component. | `claude/tutor-recall` | yes, side lane (founder, 2026-11-06) |
| 2026-11-06 | Privacy notice, "Who else sees it" | "One earlier mistake ... may also be sent" and "One curated correction ... may also reach the language model" open the same way three sentences apart, though pause covers the first and not the second, so they are easy to mix up. | Put the two side by side and say the difference once (pausing memory leaves the first out; the second is separate). Founder-gated copy. | `claude/tutor-recall` | yes, side lane, with the founder approving the new wording (founder, 2026-11-06) |
| 2026-11-06 | Privacy sheet header at 320 | Scrolled, the top body line slides under the "Privacy" title and is cut mid-letter with no edge between them (already so on main). | Show the existing `paper.line` divider under the sheet title once the content has scrolled, the iOS scroll-edge convention. | `claude/tutor-recall` | yes, side lane (founder, 2026-11-06) |
| 2026-11-03 | Tab bar, dark mode | The ink capsule sits close to the dark ground, so where only bare ground is behind it the floating bar loses its edge. | A dark-only capsule one step lighter (the raised surface tone of the dark cards), still no shadow or hairline, so the pill and the sun glyph read the same in both modes. | `claude/phone-fixes` | done: the founder marked the capsule too dark on the lane E board; dark capsule keeps the ink with a 1.5pt `#65599A` rim, 3.0 on the ground (founder, 2026-11-07; F966) |
| 2026-11-03 | Live, daily limit reached | Honest but a dead end: the words sit in the top 40% with Back as the only door. | Treat it as a drawing moment: the existing waiting drawing centred like the wait screen, the one line, Back, and a quiet "Practise offline" link to Practice. One focal point, no scolding. | `claude/phone-fixes` | queued for a board (founder, 2026-11-04) |
| 2026-11-03 | Today's sky, one-line greeting | On one line the cloud lands on the name's baseline under its last letters, which reads as a collision. | Give the cloud a fixed place in the band: in the gap between the greeting and the tiles, offset right under the avatar, or behind the last word's cap height at lower opacity. The greeting stays the focal point. | `claude/phone-fixes` | queued for a board (founder, 2026-11-04) |
| 2026-11-03 | Speak tab foot | The three tool tiles are fixed half-width cards that leave the right column empty at 320 and 375. | A two-up grid on RHYTHM.item with the third tile full width, or full-width LipTile rows with the drawing on the left. | `claude/phone-fixes` | queued for a board (founder, 2026-11-04) |
| 2026-11-03 | Say it aloud, live and at rest | While listening, Cloud sits at the top of the answer area, about 220pt above the mic it listens to, so the screen has two focal points; at rest about 330pt of empty cream sits between the stage and the mic. | Anchor Cloud to the bottom of the answer area, just above the foot, so Cloud and the mic read as one group; at rest let the peach stage take the height (a larger sentence, more room for Hear it). | `claude/cast` | queued for a board |
| 2026-11-03 | Right sheets, every family | A right answer stacks the tile's pop and sparkle, the sheet rising, Cloud's pop and hop, and Cloud's two sun stars: two star motifs and four movements at once. | One sparkle per moment: drop the tile's sparkle when Cloud cheers, or Cloud's stars, and start the hop after the tile's pop settles. | `claude/cast` | queued for a board |
| 2026-11-03 | Speak drills, the blink | A cross-fade blink shows ghosted half-open eyes in its middle frames. | Switch the lids on at full opacity, hold about 80ms, then fade them out quickly; or close the lid with a vertical scale. Changes DESIGN.md's "fades them in and out". | `claude/cast` | queued for a board |
| 2026-11-03 | Say it aloud, no microphone | The inert muted mic drawing still carries the caption "Speak", and the foot's hairline now separates it from its controls, so it reads as a control that does nothing. | Drop the "Speak" caption under the drawing and let it stand alone as a state picture; "Type instead" and "I said it" in the foot say what to do. A copy change, the founder's call. | `claude/cast` | queued for a board |
| 2026-11-04 | Review and the drill bank, nothing to review (light) | The white Cloud sits on the white card, so its body loses its edge; only the underside, face and arms read (it did with the old drawing too). | Put both cards on `ground="butter"`, Review's own stage tint and an existing EmptyGround, so the body gets its edge without the control-only ink outline. | `claude/quiet-moments` | yes, into the systemic pass, queue 5 (founder, 2026-11-06) |
| 2026-11-04 | Phrasebook, nothing kept | The 44pt "Your phrases" page title sits over the 26pt stage title, two headlines on a screen the moment is meant to be. | While the book is empty, keep the back header but drop or shrink the page title so the stage title is the only headline. | `claude/quiet-moments` | yes, into the systemic pass, queue 5 (founder, 2026-11-06) |
| 2026-11-04 | Speak, out of the free conversation | See the plans hugs its words while the phrasebook's Choose a scene is full width; the board drew it full width. | Give the stage action the same full-width lip pill as the phrasebook foot, in flow under the words: one primary treatment for centre stage. | `claude/quiet-moments` | not now (founder, 2026-11-06) |
| 2026-11-04 | Centre stage title | The board drew 28/32; the build uses 26/31 (`title26`), while `bandTitle` (28/31) exists. | Take `bandTitle` for the stage title, or keep 26; DESIGN.md records the choice. | `claude/quiet-moments` | yes, into the systemic pass, queue 5 (founder, 2026-11-06) |
| 2026-11-06 | Today, the hero card | "One fix to try", then "How would you say this in French?", then "A croissant, please.": three text levels before the focal line, the first working as a kicker. | Let "A croissant, please." lead and fold the fix framing into the question line, for example "One fix: how would you say this?" | `claude/tab-edge` | yes, into the systemic pass, queue 5 (founder, 2026-11-06) |
| 2026-11-06 | Journey, the header | The "Starter stage" kicker above "Your journey" repeats the stage rail below, which already says "Starter, You're here". | Drop the kicker and let the XP level pill carry the stage, so the rail has one owner. | `claude/tab-edge` | yes, into the Journey redesign, queue 9 (founder, 2026-11-06) |
| 2026-11-06 | Journey, the stat tiles | Plain white rounded rectangles, not Today's coin, number and word LipTiles; at 320 "days in a row" and "min practised" wrap to two lines. | Use Today's LipTile stat pattern with a coin and one word (days, minutes, saved), so both tabs share one stat language. | `claude/tab-edge` | yes, into the Journey redesign, queue 9 (founder, 2026-11-06) |
| 2026-11-06 | Today, the path rows | "Say it" and "Practise" are bare underlined links, a third action style beside the LipTile and the chevron row, and may be under 44pt (not measured). | Make the whole row the target with a chevron, as on the first row, or keep an inline action as a small LipTile in the stage tint (lavender for the phrase, butter for Review). | `claude/tab-edge` | yes, into the systemic pass, queue 5 (founder, 2026-11-06) |
| 2026-11-06 | Tab bar, during a drag | The sun glyph and Bold word stay on the open tab while the pill sits on another, so the bar shows two half selections mid-drag. | While a drag is held, move the sun glyph and Bold weight to the cell under the finger at once, with no new animation, so the selected look travels with the pill. | `claude/tab-drag-haptics-da4049` | queued for a board (founder, 2026-11-06) |
| 2026-11-06 | Speak, tutor unavailable | The yellow "Order a coffee" card sits inside the lavender panel (a card in a card); "Check again" is left-aligned under a centred heading; at 375 "now." sits alone on a line. | Put the error (Cloud, heading, Check again, centred together) on the plain ground, and let the offline line stand as the screen's one card on its butter tint. | `claude/tab-drag-haptics-da4049` | queued for a board (founder, 2026-11-06) |
| 2026-11-06 | Tab bar, dark mode | The capsule is the same ink in both themes and nearly vanishes on the dark ground. | Keep no shadow, hairline or wash, but in dark only set the capsule one B-token step lighter than the ground so it separates by value. | `claude/tab-drag-haptics-da4049` | done with the row above (F966, 2026-11-06) |
| 2026-11-06 | Today, hero loading | The hero loads in two looks in a row: the sand blocks (`TodayLoadingHero`), then a plain "Finding your next task…" line inside the real card. | Keep the hero card's sand-block shape until `NextTaskCard` has its value, so loading has one look; an existing part, no new copy. | `claude/today-resume-greeting-67fd7d` | queued for a board (founder, 2026-11-06) |
| 2026-11-06 | Today, labels above titles | "Next scene, 2 of 3", "Today's phrase" and "One fix to try" sit as small labels over a heading (DESIGN.md defines `eyebrow`, so not slop). | Let the title stand alone and move the count to the meta line ("Scene 2 of 3, about 3 minutes"); on the phrase row the French can lead alone. | `claude/today-resume-greeting-67fd7d` | queued for a board (founder, 2026-11-06) |
| 2026-11-06 | Today at 320, hero title | "Order at a / café" leaves one word alone on the second line. | Step `bandTitle` down by length at narrow widths through the `fitDisplay()` seam (28, 24, 20), so short scene titles stay on one line or break evenly. | `claude/today-resume-greeting-67fd7d` | queued for a board (founder, 2026-11-06) |
| 2026-11-06 | Speak, tutor cannot connect | The yellow "Order a coffee" card sits inside the lavender cannot-connect panel (a card in a card), and the screen has two focal points: "Check again" and the offline line's "Try this line". | Make the lavender panel a short status band (Cloud, one line, Check again), then the offline line as its own Speak-peach stage below, so the one focus is the line the learner can practise. | claude/error-copy-ff7a03 | queued for a board |
| 2026-11-06 | Speak, Start while offline | Tapping Start with the tutor offline gives no visible answer; only a refused health check runs. | Disable Start with a short line beside it ("Your tutor is offline. Try the line above."), or have the tap scroll back to the cannot-connect panel and pulse it, so a tap always answers. | claude/error-copy-ff7a03 | queued for a board |
| 2026-11-06 | Speak, cannot-connect copy | "Try again, or practise a bundled line offline." says "bundled", an engineering word, and at 375 the heading wraps with "now." alone. | "Try again, or practise a line offline." and "Your tutor cannot connect." (or a balanced break). | claude/error-copy-ff7a03 | queued for a board |
| 2026-11-06 | Live failure, support details | With one row left, the disclosure costs a tap to reveal four words. | Show the code inline under the actions as one small muted line ("Reference: server-unreachable"), selectable and copyable, with no disclosure. | claude/error-copy-ff7a03 | queued for a board |
| 2026-11-07 | Speak offline and any sun card, dark | A full-strength sun panel (12:1 on the ground) is the brightest thing on a night screen and takes the focal point from the tutor notice. | In dark the card takes the butter stage tint with cream words; sun stays for its LipTile lip and the pill, so the tint is the stage and sun the accent. | `claude/dark-contrast` | queued for a board (founder, 2026-11-07) |
| 2026-11-07 | Postcards, dark | The whole mint page is a glare field around one dark card. | Theme ground in dark, with the postcard as a LipTile on a mint lip, so mint stays the earned moment and the page stays night. | `claude/dark-contrast` | queued for a board (founder, 2026-11-07) |
| 2026-11-07 | Practice "Comes up often" and the Streak hero, dark | Butter `#493C2E` reads as muddy brown at hero size. | In dark keep butter for small drill-family tiles and give large hero surfaces the hero ground `#363064` on a butter lip. | `claude/dark-contrast` | queued for a board (founder, 2026-11-07) |
| 2026-11-07 | Privacy, "Who else sees it" | Five named services plus one condition sit in a 16-to-21-line paragraph, so "who gets my voice" cannot be scanned. | Inside the existing card, a quiet list with one row per service: the name in heading weight, then what it gets and when in body text; no new container, no icons. | `claude/adaptive-interruption` | queued for a board |
| 2026-11-07 | Privacy, top scroll edge | At 375 the text slides under the opaque band behind the back disc and is cut through a line, which reads as clipped rather than designed. | Once the display title scrolls away, collapse it into a small title in the back-disc row with a hairline in the existing border token. | `claude/adaptive-interruption` | queued for a board |
| 2026-11-07 | Privacy, body colour | The whole notice is set in `t.muted` (`PolicyScreen.tsx:76`); it passes contrast but is the weakest reading for a long legal text. | `t.text` for section bodies, `t.muted` for the intro line only. | `claude/adaptive-interruption` | queued for a board |
| 2026-11-07 | Privacy, length | With eight or more sections, reaching "Who else sees it" is a long scroll. | A short list of section headings under the intro, each jumping to its section; plain text rows, no numbers, no eyebrows. | `claude/adaptive-interruption` | queued for a board |
| 2026-11-08 | Today hero and path, eyebrows | "Next scene, 2 of 3" and "Today's phrase" are small accent labels above a heading; DESIGN.md endorses eyebrows, the Impeccable floor bans them. | The drawing tile and the family's stage tint carry the category, the position joins the meta line ("About 3 minutes, scene 2 of 3"), the heading stands alone. | `claude/council-fixes` | asked, no answer yet |
| 2026-11-08 | Today, held state | The "speaking time used" hero is a white card holding a tinted LipTile: two surfaces compete and the card is the default container. | Set the sentence on the paper and let the "Review 4 phrases" LipTile be the single focal point, as a game button. | `claude/council-fixes` | asked, no answer yet |
| 2026-11-08 | Today, tutor unreachable | A full ink "Start speaking" pill sits above a line saying the tutor can't connect, with "Type instead" and "Check again" also present: three ways forward and the main one is likely to fail. | While the tutor is unreachable the primary pill becomes the offline line practice and "Check again" stays the one quiet link. | `claude/council-fixes` | asked, no answer yet |
| 2026-11-08 | Guest live room, dark header | The band keeps full-chroma morning indigo above a near-black sheet, the hottest contrast in the app. | In dark mode the room header takes `sky.dark.day.ground`, as Today does, so the room and Today read as one sky. | `claude/council-fixes` | asked, no answer yet |


## Tools and how they are used

- **Figma** (claude.ai connector, signed in): read the canvas file
  `sjAwoGinWQKvhGrWbgMO18` and the B screens `M2K7xWepBhsLA0QAtXTjvx`. Writing to Figma
  only with the founder's OK, once a direction is chosen.
- **Appllama** (claude.ai connector, 1,500 credits a month): two to four targeted
  references per screen. Media links expire in an hour.
- **Impeccable**: a reviewer for critique and polish. Its detector reads web markup, so
  every suggestion is checked for React Native fit before use. Its
  `impeccable-finish-reviewer` reviews every frontend push in `/push-check`: slop is fixed
  in the push, redesign ideas are asked of the founder and logged under "Proposals from
  push-check".
- **Design canvas** (Artifact): direction boards with interactive prototypes.
- **iOS simulator**: a dev client built with `npx expo run:ios` (needs a UTF-8 locale:
  `LANG=en_US.UTF-8`, or CocoaPods fails). The `luvani-metro-design` launch entry serves
  Metro on port 8097; open it with
  `exp+luvani://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8097`. Capture
  with `xcrun simctl io <udid> screenshot`, which stays fresh.
- **Web screenshots**: `npm run shots` (see `scripts/shots/README.md`).
- **Rive** runs on iOS (checked 2026-10-29: the streak flame plays, no Rive errors in
  the device log) and shows still frames on web by design. Mascot animation that must
  move on web too needs Reanimated with SVG, or the Rive web runtime added on purpose.
