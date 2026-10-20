# Headspace interface review and Luvani redesign recommendations

11 October 2026. Prepared for Luvani's product and design team.

## 1 The recommended direction

Headspace's strongest visible quality is coherence. Navigation, illustration, content grouping and reassurance feel like parts of one product. It offers a short route into a useful activity while keeping a larger catalogue available. Luvani should apply that discipline to a more demanding task: helping a hesitant beginner actually speak French, understand what happened and return with confidence.

The priority is **a clear next action, a supportive speaking experience and visible evidence of improvement**. More decoration, a darker background or fewer tabs alone will not deliver that. Luvani already has valuable foundations: original French scene artwork, Outfit typography, accessible layout primitives, a shared next-task component, an honest learning ladder and durable progress rules. Improve their arrangement and continuity before replacing them.

The recommended sequence is:

1. Put the recommended practice and its French preview before artwork and category choices on Practice.
2. Put an earned ability or an honest supported-practice result before saved-phrase totals on Progress.
3. Give Home, Speak and Practice distinct jobs while keeping their next-task decision consistent.
4. Make session start, listening, speaking, help, interruption and completion one understandable journey.
5. Improve native sign-in and account creation; preserve the first-practice and onboarding investment through every account detour.
6. Apply one visual and interaction system across secondary pages, sheets, permissions and payment recovery.
7. Add a complete optional dark appearance after the hierarchy works. Preserve the warm light appearance and original identity.

“10x better” is an ambition, not a measured result. Judge the redesign by fewer wrong turns, faster access to useful practice, successful first exchanges and stronger understanding of progress. Establish a baseline before claiming an uplift.

This is a review and implementation brief. It does not implement the proposed app changes or adopt new product policy.

## 2 Evidence and confidence

### Headspace evidence

Both supplied recordings were inspected through chronological frame sequences, with the static screenshots used for closer reading. This is a visual flow review; it does not establish audio quality, haptic behaviour, accessibility support or backend reliability.

| Evidence | Coverage | What it establishes |
|---|---|---|
| H1: `IMG_5417.PNG` | Today and essentials | Expanded recommended activity, compact alternatives, recents/favourites, discovery cards, selected tab treatment |
| H2: `IMG_5418.PNG` | Profile | Illustrated identity, grouped zero-history statistics, encouraging streak introduction, progress invitation |
| H3: `IMG_5415.PNG` | Annual trial offer | Visible 14-day trial, £49.99 price, £4.17 monthly equivalent, reminder timeline, close, restore and purchase action |
| H4: `IMG_5416.PNG` | Monthly trial offer | Visible 7-day trial, £9.99 monthly price and corresponding timeline |
| H5: `ScreenRecording_10-11-2026 17-27-15_1.MP4` | 63.64 seconds | Today, Explore, collections, profile loading/empty history, and Meditate/Sleep/Move/Focus category pages |
| H6: `ScreenRecording_10-11-2026 17-18-53_1.MP4` | 29.26 seconds | Welcome, terms checkbox, combined account entry, web authentication, email/password steps, and switching to account creation |

Approximate navigation landmarks in H5: Today at 0-10 seconds; Explore and a collection at 10-26; profile at 26-38; Explore again at 38-46; category pages at 46-59; Today at 60-64. H6 shows welcome at 0-3 seconds, the authentication web surface from about 3 seconds, the password step at about 15 seconds, and account creation at about 25 seconds. These are capture-relative landmarks, not measured app response times. User pauses and recording edits cannot be separated from performance.

Headspace's visible native app is dark. Its authentication surface in this recording is light. The right-edge grey chevron overlay has uncertain ownership and is excluded from the app-design assessment. The supplied account history is empty; recommendations about experienced Headspace users would need further evidence. The recordings do not show a completed account creation, a purchased subscription, playback, cancellation or a completed meditation.

### Luvani evidence

The source audit uses the attached checkout at **`21c8bb49`**, not another session's worktree. Runtime ownership comes from `apps/mobile/App.tsx`, the mounted navigator and the rendered branches of the relevant screens. Comments and historical recommendations are secondary evidence.

The current navigator mounts four tabs and 30 stack routes, including the `Tabs` container. Authentication, onboarding, recaps and several settings/social panels have additional in-place states. The coverage register below addresses those surfaces as well as the stack routes.

[DESIGN.md](../DESIGN.md) records the 9 October direction and responsive foundations. The [existing vibrant design review](../artifacts/paywall-mockups-2026-10-09/REVIEW.md) contains 74 app screens and 56 billing states. That file explicitly distinguishes proposed visuals from implemented foundations. It is not proof that all 130 states have shipped. The [3 October review](REVAMP_B_DESIGN_REVIEW.md) is a dated comparison, not a current backlog; its five-tab proposal is superseded by the mounted four-tab navigator.

Source-backed findings below are identified as such. Page specifications are recommendations. The inspected presentation preview uses synthetic data and does not prove production authentication, native keyboard behaviour, real voice, store transactions or the appearance of the build installed on the founder's phone.

The running web preview was inspected at 375 × 812. Sign-in visibly fits the provider choices, two fields, recovery, primary action and account switch. Switching to signup opens the same visual family, with an additional confirmation field and strength guidance. This supports improving an existing coherent form rather than replacing it solely for visual consistency. The preview is a development fixture, not an authenticated account journey.

## 3 What Headspace does well

### A clear distinction between doing and browsing

Today gives the user a suggested starting point. Explore offers search, categories and collections. The personalised tab carries identity and history. This makes the three destinations conceptually different rather than three arrangements of the same catalogue. H1 and H5 support the observation; reduced decision effort is the design inference, not a measured conversion result.

For Luvani, translate this into **continue today, choose a situation, revisit your French, understand your progress**. A language tutor has enough distinct work to justify four tabs. Copying Headspace's tab count would not prove that the resulting structure is easier.

### One recommendation receives more space than its alternatives

In H1, the active essentials item expands into an illustrated card with its title, media type and duration. Other activities collapse into short rows beside a path. H5 shows the expanded emphasis changing between essentials items. The visual hierarchy answers “Where should I begin?” before asking the user to browse.

Luvani should expand the actual recommended scene or saved practice. Other choices can remain compact rows. A visual path must mean something precise: current recommendation, completed with support, independently earned, or available later. It must never imply that the learner earned a capability merely by tapping or finishing a guided example.

### Content is packaged in repeatable formats

Explore combines category controls, featured collections, programme rows and compact content lists. The category pages reuse a featured activity, recommended list and essentials grouping. Artwork varies while the structure remains recognisable. Familiar structure lets the user spend attention on the content rather than relearn the controls.

Luvani needs a small, intentional family: recommendation card, scene row, saved phrase row, evidence card, playback/recording controls and settings row. Use the existing component system. Do not turn every feature into a new card style.

### The interface communicates effort before entry

Headspace commonly pairs a title with a media type and duration or range. The user can decide whether an activity fits the moment. For Luvani, duration alone is insufficient: a scene also needs its practical goal and whether it uses live minutes. “Order a coffee · about 5 min · live speaking” is clearer than an attractive scene name with hidden consumption.

Use authored estimates as estimates. Never treat them as an actual meter reading, an exact promise or a progress score.

### Dark surfaces retain warmth and personality

The supplied views use a very dark navy ground, brighter card surfaces, pale text and vivid illustration. Bright colour is concentrated in imagery, category headers and selected controls. The background provides a stable reading field while illustration gives the brand emotional range.

The lesson is controlled hierarchy across surfaces, not “make everything black.” Luvani can keep its warm light mode and offer an equally coherent dark mode. A complete theme includes inputs, sheets, navigation, authentication, permissions, live states and legal pages.

### Illustration is recognisable across contexts

Headspace uses a consistent friendly visual vocabulary in welcome, collections, profile and subscription. Curved transitions connect hero artwork with the dark content area. This makes commercial and utility pages feel related to the rest of the app.

Luvani should use its original café, restaurant, travel and everyday French drawings with consistent crops and compositions. Keep the founder's existing no-mascot/no-faces direction from the [come-alive programme](come-alive/README.md). Headspace's smiling character is not a reason to introduce a new Luvani mascot. Use scenery, objects and the existing tutor orb where it already belongs.

### Generous grouping creates a calm reading rhythm

The screenshots use clear headings, large rounded containers and space between sections. Statistics form one group. Recommended content forms another. The tab bar has both icon and label, with a conspicuous selected pill. These are visible distinctions rather than claims about exact Headspace spacing tokens or font sizes, which cannot be recovered reliably from screenshots alone.

Luvani already has 4-point spacing, 24/28-point card radii and a defined type scale. Apply them consistently, with stronger differences between section, card and metadata hierarchy. Preserve French as the largest text in its learning block.

### Empty history is explained without punishment

H2 and H5 show zero statistics, a forward-looking streak introduction, an optional check-in and an activity suggestion when history is absent. Headspace makes the account feel usable before the user has accumulated data.

Luvani can improve further: show one meaningful first action instead of a dashboard of zeroes. After supported practice, show that practice honestly. After independent evidence, show the earned ability. Keep lifetime practice days beside a reset streak, as the current product rules require.

### Commitment receives a timeline

H3 and H4 explain immediate access, a reminder and the future charge as a sequence. A close control, restore and cancellation wording help the user understand the commitment. The main design value is anticipation: what happens now and what happens later.

Luvani should use the same explanatory shape with its own verified offer, allowance, renewal and reminder state. It must not copy Headspace's trial lengths or prices. Its reminders should be described as scheduled only after scheduling succeeds.

### Loading resembles the destination

Around 27 seconds in H5, profile placeholders roughly match the identity, statistics and subsequent sections. This maintains spatial continuity while data loads. Luvani already distinguishes loading from empty data in several screens. Standardise the visual language and preserve readable status text for longer waits; never use decorative fake “analysing” sequences.

## 4 What Luvani should improve on rather than copy

| Visible weakness or limit | Professional judgement | Luvani response |
|---|---|---|
| £ prices with “Try for $0.00” in both offer screenshots | The locale inconsistency undermines billing clarity, even though the immediate price is zero | Use one store-localised offer summary and action; keep the full eventual charge beside the purchase decision |
| Much of Today and Explore is visibly locked in the supplied account | It advertises breadth but can leave an unpaid user with little obvious useful work | Keep a genuine free offline practice route visible before presenting paid access |
| Dark native welcome opens a white authentication web surface | Clear form, but a sharp visual/context change | Keep Luvani email authentication native; use expected platform browser/provider surfaces for OAuth |
| Combined welcome action opens “Log in”; signup is a smaller link | Simplifies entry wording but does not eliminate the user's login/signup decision | Preserve explicit “Save my progress” and “Sign in” contexts; make switching easy |
| Several social providers are displayed only as marks | Compact, but recognition and accessibility depend on labels that the recording cannot prove | Use readable provider action labels and accessible names; offer only configured providers |
| Long Explore catalogue | Useful breadth can become browsing work, especially for a beginner | Curate a small relevant scene set first; expose the full catalogue on request |
| Profile leads with zero numerical activity | Legible statistics can still provide weak emotional value on day one | Show the next achievable French exchange before totals; show real evidence once it exists |
| Floating tab bar overlaps the scroll viewport in captures | Looks polished, but bottom content clearance must be tested | Reserve actual bar and safe-area height; no content or action should remain unreachable beneath it |

H3's annual reminder is shown for day 7 of a 14-day trial; H4's monthly reminder is day 6 of a 7-day trial. Do not rewrite these into a uniform “day before billing” claim. The screenshots show different schedules. They do not verify whether either reminder was delivered.

Do not import social-proof claims such as “What's helping others” without substantiated Luvani data. Use “Useful for your trip” or an authored “Try next” grouping where the content and targeting actually support the label.

## 5 Luvani's current hierarchy and the proposed structure

### Keep the four destinations and clarify their jobs

| Destination | Its job | What should lead |
|---|---|---|
| Home | Resume a useful French moment now | One task chosen by the existing next-task rule, with its practical outcome |
| Speak | Choose a situation or conversation with the tutor | Recommended scene, then current-level scenes and tutor identity |
| Practice | Revisit and strengthen French already encountered | Resume/due practice, exact French preview, free alternative |
| Progress | Understand what improved | Earned ability or supported-practice evidence, then personal history |

Keep Profile accessible from the labelled avatar, with Settings and optional Friends behind it. Keep the existing route identifiers and deep links. Hide tabs during a focused sitting as the current navigator already does. Preserve explicit leave/pause behaviour so a navigation change never leaves a metered voice room running.

Test a three-tab alternative only if research finds sustained confusion between Speak and Practice. Its cost would be a larger combined catalogue, reduced visibility of review and navigation migration. The evidence here does not justify paying that cost first.

### Source-backed findings

**Practice is currently ordered like a category landing page.** In [PracticeTab.tsx](../apps/mobile/src/tabs/PracticeTab.tsx), the visible body places a notebook illustration and “Saved phrases / Sound practice / Conversations” choices before the recommended primary. The exact recommended phrase sits inside the “Explore practice” sheet. The nearby comment says the next action stays in the first viewport, but the rendered order does not establish that. Reorder the real component tree: recommendation and French preview first, the three retrieval doors next, optional details last. Verify the result at default and large text rather than trusting the comment.

**Progress leads with collection size.** In [MyFrenchTab.tsx](../apps/mobile/src/tabs/MyFrenchTab.tsx), a returning user sees a large saved-phrase count, week/postcard links and a phrasebook action. The independently earned ability card appears inside “See all progress.” This weakens the product's visible-improvement promise. Promote the best relevant evidence card, with a dated scene link; use the collection count as secondary context. If there is no independent finish, show supported practice or an actual first-task invitation, not a mastery claim.

**Home, Speak and Practice already share a useful seam.** [NextTaskCard.tsx](../apps/mobile/src/practice/NextTaskCard.tsx) chooses account-bound practice, review, plans, a scene or local practice. Retain that decision owner. Screen-specific composition may explain why a task is shown, but must not introduce three independent recommendation policies. Home can remain concise; Speak should place the situation before optional tutor audition; Practice should show the exact task before its archive categories.

**Important content is increasingly placed in broad sheets.** Home's “More for today”, Practice's “Explore practice” and Progress's “See all progress” are visible in the rendered source. Sheets are appropriate for a small choice or short explanation. Core evidence and full libraries need normal scrollable pages or inline sections, with a clear return path. Do not make useful learning work depend on finding a generic “more” link. Keep a limited sheet for voice selection, reminder time and brief confirmations; reuse existing stack routes for libraries and detail.

**The palette is shared but does not establish a complete dark theme.** `palette.ts` and `theme.ts` largely expose the warm paper system, with scoped dark live surfaces and other contextual treatments. A navy live room is not proof of dark appearance across the app. Implement a semantic appearance layer through the current palette/theme owners, rather than scatter colour substitutions through screens.

**Authentication already has strong infrastructure, with opportunities in presentation.** The current forms offer Apple where supported, Google, labelled fields, autofill, request locks and recovery. Signup adds password confirmation. Both forms conditionally hide their primary button while the software keyboard is visible; the sign-in account-switch control is also hidden in that state. That source fact merits a native keyboard review: a web preview cannot reproduce the iOS software keyboard. A keyboard return action is useful but should not be the only discoverable way to proceed or change intent.

### Three critical screen compositions

**Home:** short greeting and profile access → illustrated next task with real goal, effort estimate and start action → quiet typing/free-practice alternative → compact practice-day context → optional daily phrase or recent evidence. Limit the opening viewport to one prominent start decision. A returning user should see their unfinished work without re-answering setup questions.

**Practice:** “Practise your French” → resume or due task with French and gloss → one practice action and a truthful live/free label → compact saved phrases, sound practice and conversations rows → optional authored sound example or current sound-check evidence. Artwork belongs with the selected task, or shrinks below it, rather than competing for the top of the screen.

**Progress:** “Your French is growing” → dated earned can-do, or honest practice record → related scene/attempt → compact CEFR scene path → weekly reflection → saved French and optional streak/XP/badges. CEFR independence evidence and numbered XP levels must remain visibly distinct. Quantity saved, time spent and XP cannot become proof of fluency.

## 6 A complete consumer journey

### First visit

Welcome should promise a concrete outcome: “Speak a little French today.” Keep a visible sign-in link for an existing learner. Collect only setup choices that materially shape the first task; keep the approved level and daily-goal decisions, and test moving confidence/focus questions later if they do not change that task. Explain the reason for any retained question. Do not silently remove mandatory eligibility or processing disclosures to shorten the flow.

Show an editable personal plan, make tutor audition optional, and explain microphone processing immediately before voice entry. The first exchange needs readable French, support, a typing alternative and a real fallback if the service is unavailable. Show a result only for what occurred. Ask for a reminder after useful practice, then offer to keep progress. Keep the existing commercial sequencing and access rules; improve its clarity rather than add a second first-run flow.

### Returning visit

Open onto relevant unfinished practice or the next usable scene. Explain its reason briefly: “From your café conversation” or “Ready to recall.” Preserve the selected tutor, preferred typing mode, saved data and task after a failed connection. A refresher must not cover the last usable account-owned content with a full-screen loader. On a new device, account restore takes precedence over assuming an empty learner.

### A quiet or interrupted moment

Offer “Type instead” and available listening/recall practice before a microphone prompt. Explain which modes still need the network or use live minutes. Backgrounding, an audio interruption, pause, connection loss and explicit exit need different factual statuses. Resume from persisted work where the existing sitting supports it; do not simulate continued voice or meter activity. Keep the transcript readable and prevent two sounds from playing at once.

### No minutes or no network

Explain the actual live limitation and offer meaningful free practice. A plan wall can answer “How do I get more live time?”, while Practice answers “What can I still do now?” Do not make a store retry the only useful action. A temporary failed entitlement read is an unknown status, not proof that a paying learner has lost access.

### Returning after a break

Use a welcoming next task and retained evidence. Keep lifetime practice days alongside the current streak. Show a reset or repair option only under the existing programme rules. Never introduce a warning, sad character, countdown or repeated loss message to induce return.

## 7 Login and account creation recommendations

### What the recording actually shows

H6 starts with a dark illustrated welcome and a combined “Log in or create an account” action. A terms/privacy checkbox changes between checked and unchecked states during the recording; this does not prove its initial default. The action opens `auth.headspace.com` in a light browser sheet. The first form asks for email, offers Continue and social-provider marks, and links to signup. Submitting email exposes the password field, an edit-email route, visibility control and password recovery. Later the user returns to the first form and switches to “Create your account.” The recording ends at its email step.

The staged form makes each screen simple and preserves the chosen email at the password step. However, it adds an action, changes visual context and leaves signup discovery dependent on a smaller link. No successful account creation or sign-in is shown, so it cannot prove completion speed or recovery quality.

### The decision for Luvani

**Adopt the clarity and continuity. Improve Luvani's existing native flows first. Do not copy the web authentication experience wholesale.** Apple and Google already exist in source; no new provider list is needed. Email-first authentication is an experiment, not a prerequisite for better UX.

The recommended production-facing structure uses three contexts:

| Context | Recommended presentation | Account action |
|---|---|---|
| Brand-new visitor | Concrete welcome, Start learning French, visible Sign in | Begin the approved first-practice journey without forcing account creation earlier |
| Guest after useful practice | “Keep your French” and a concise summary of the actual saved investment | Continue with Apple, Continue with Google, or Create account with email; Sign in is a clear alternative |
| Returning signed-out learner | “Welcome back”, available providers, email/password form and recovery | Sign in; Create an account remains easy to find |

Keep email signup and sign-in as clear modes within the same visual family. They can share a frame and account-method component while retaining their current adapter operations. Let the user's chosen intent determine the form. Do not build a public “does this email already exist?” lookup just to imitate Headspace; such a lookup would require separate privacy, abuse and backend review.

### The changes worth making

1. **Use explicit provider actions.** Prefer full, platform-compliant “Continue with Apple” and “Continue with Google” treatments over a bare provider name. Stack them on narrow or large-text layouts; avoid adding providers that the adapter cannot support. Apple/provider screens can use their expected platform presentation, with a clean return to Luvani.
2. **Keep the primary action reachable during editing.** Use the shared keyboard-aware scroll/layout seam so the email action can remain visible or reachable above the keyboard. Preserve return-key submission, focus scrolling and request locks. Keep the mode switch reachable as well.
3. **Reduce signup repetition carefully.** Test one password field with Show/Hide, platform password generation/autofill and concise requirements. Removing confirmation is a proposed form simplification, not a change to password policy. Preserve correct new-password autofill, validation and recovery. Keep confirmation until the replacement proves it prevents common entry mistakes acceptably.
4. **Preserve the learner's investment.** Email and harmless setup selections survive signup/sign-in/provider detours. Guest practice transfers exactly once into the correct confirmed account. Keep passwords ephemeral; the current in-memory form draft must never become durable storage or analytics data.
5. **Make recovery its own clear state.** After requesting a reset, show the destination email, change-email and sign-in routes, and resend only under the current rate limits. Expired or invalid links explain how to request a new one. A pending verification is not a completed account.
6. **Make errors local and recoverable.** Invalid email guidance belongs beside email; provider failure belongs beside the chosen provider; connection failure preserves the form. A cancelled OAuth attempt returns calmly to the same intent. Do not clear a plan or recreate a guest session after an auth error.
7. **Separate permissions and consent.** Account creation, microphone processing, optional learning memory, analytics and notifications are different decisions. Keep current eligibility order, optional choices and the working terms/privacy links. A checkbox in Headspace is not authority to alter Luvani's consent defaults.
8. **Retain one auth authority.** Share visual components through `src/auth/`; keep session/adoption decisions in the existing flow, adapter and App bootstrap. A unified presentation is not a second identity store or client-side entitlement source.

### Should Luvani use email-first screens?

Test two explicit-intent variants: the current single form versus email → password, with the same providers and copy. In the staged version, Continue first validates the email locally; the user already selected Sign in or Create account. The next screen displays the email with Change and the correct password action. Back retains the email. It need not disclose account existence before an authenticated attempt.

Prefer the single form unless staging improves task completion, errors or perceived ease enough to justify its extra action. Do not infer that fewer visible fields means fewer total steps. Magic links, email codes and passkeys are separate authentication changes with delivery/recovery implications; this evidence does not justify adding them to the redesign scope.

### Required account acceptance checks

Verify new guest → email signup → confirmation → exactly-once progress handoff; guest → existing-account sign-in without merging unrelated progress; returning sign-in; Apple/Google success, cancel and failure; wrong password; malformed email; verification pending; recovery deep link; expired recovery; no network; app interruption; new-device restore; large text; software keyboard; VoiceOver focus and error announcements. Use disposable test identities in a named test environment. Never test account deletion or purchases against a real learner as part of visual QA.

## 8 Visual system for every page

### Keep the identity, improve the hierarchy

Use the existing Outfit family, original flat artwork and palette ownership. Keep blue for scenes/brand, coral for recap, sun for sound/plan and mint for a turn or earned completion. The 9 October direction permits richer colour and supersedes older one-card restrictions; it does not remove contrast or truthful state rules.

Use a normal screen title for working pages; reserve the larger display style for a short welcome or emotional result. The exact French to read or say should dominate its learning block. English gloss and metadata stay readable rather than pale decoration. Prefer practical action labels: “Start this scene”, “Practise this phrase”, “Hear the model”, “Hear my take.” Distinguish “Save phrase” from “Save conversation text.”

Maintain the 4-point spacing system, consistent card radii and flat controls. Group by purpose rather than put a card around every line. Use one prominent primary action per decision region; playback, slower, help and typing remain clearly discoverable as secondary controls. Avoid a global search feature until the catalogue and retrieval needs justify it; phrasebook search already has its own seam.

### Dark appearance as a complete system

Offer System, Light and Dark after the hierarchy pass. Persist appearance through the existing device-preference mechanism. Keep semantic roles for page, card, elevated sheet, text, field, selected state and focus. A screen should ask for a role rather than hard-code an alternate colour. Preserve state words and glyphs when colours change. Keep the live orb's established speaking/your-turn/thinking meanings.

The following are **candidate dark tokens for prototyping**, not adopted palette values. They show a possible reading hierarchy while retaining Luvani's purple/navy character. Primary action colour requires an approved dark-theme role; do not repurpose illustration-only lilac or chartreuse as button paint.

| Proposed role | Candidate | Intended use |
|---|---|---|
| Base surface | `#111028` | Page ground |
| Card surface | `#1C1A39` | Grouped content |
| Elevated surface | `#292646` | Sheets and overlays |
| Primary text | `#F5F2FF` | Titles, French, body |
| Secondary text | `#B8B3CD` | Readable gloss and metadata |
| Control/focus border | `#817B9F` | Required input boundary or focus mark |
| Dark primary action | `#B1A8FF` with `#16123A` text | Prominent actionable control |

Calculated candidate ratios: primary text is at least 13.03:1 across the three dark surfaces; secondary text at least 7.10:1; the required border at least 3.61:1; action lettering 8.39:1. These checks cover the listed solid pairs only, not final components, artwork, animation or every interaction state.

Calculate every actual foreground/background pair, including pressed, selected, busy, error and disabled contexts where applicable. Use Luvani's existing 4.5:1 floor for text and 3:1 for required state/control marks; decorative surface separation need not meet a text floor. W3C explains the [text contrast threshold](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html). This token proposal is not an accessibility certification.

Recompose illustrations for both modes where necessary; do not invert the artwork. Prevent white flashes during launch, auth return, modal transitions and legal navigation. Ensure status-bar content remains readable on bright hero areas. Check real displays in bright daylight as well as low light; screenshots alone cannot establish comfort.

### Layout, accessibility and motion

Use the existing viewport, safe-area, font-scale and rotation primitives. At default text, expose the task and primary action on a compact iPhone where feasible. At large text, scrolling and stacking are correct responses; shrinking the content to preserve a decorative composition is not. Apple recommends [at least 44 × 44 point touch controls](https://developer.apple.com/design/tips/) and [testing the largest text sizes](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/larger-text-evaluation-criteria).

Do not nest long libraries inside modal reading regions. Make sheet dismissal, keyboard dismissal and back navigation predictable. Restore focus to the launching control after a short sheet closes. Announce factual stage changes politely without repeating every transcript update. French controls/content carry their language. All meaningful audio has readable text; decorative artwork is excluded from the screen-reader order.

Keep motion for acknowledged taps, real voice state and persisted achievements. Reuse current motion and celebration owners. Reduced Motion should present a useful still state; leaving/backgrounding stops optional loops. Do not add celebratory sound while the microphone is open or the tutor is playing. A one-time win should not replay because a page is reopened or a save is retried.

## 9 Coverage of every mounted page

The following is a page specification, not a claim that every current page is defective. Priorities: **P0** establishes a truthful, usable core journey; **P1** makes the product coherent across secondary surfaces; **P2** adds optional polish after the core passes. Each row includes an observable acceptance check. Shared states in section 10 apply to every data-backed row.

### Main pages

| Page and priority | Recommended change | Acceptance check |
|---|---|---|
| Home, P0 | Keep one next task; pair goal, French preview and start; keep optional day/quest details compact | A returning learner identifies and opens the intended next task without entering a broad “more” sheet |
| Speak (`Tutor`), P0 | Lead with a scene/continuation; make tutor audition compact; follow with current-level scenes and explicit other modes | Learner distinguishes choosing a new situation from revisiting saved work; failed start keeps exact intent |
| Practice, P0 | Recommendation and French preview before notebook art and three retrieval doors | Recommended action and exact French appear together; first-run, resumed, due-review and empty states each open useful work |
| Progress (`MyFrench`), P0 | Lead with earned/supported evidence; totals and game cards follow; keep history links outside generic detail sheets | Learner can explain what they can do, why the claim exists and what was merely practised |

### Speaking and learning pages

| Page and priority | Recommended change | Acceptance check |
|---|---|---|
| Scenes (`Missions` list), P0 | Group by current A0/A1 scope; differentiate recommendation, supported finish and independent earn in words | All authored scenes are reachable; support completion never reads as earned independence |
| Scene brief (`Missions` focus), P0 | Goal, useful example, estimate, live-minute note; Start and Type instead | Learner predicts what they will practise and the mode before entering; back retains selection |
| First scene (`FirstScene`), P0 | Short processing/mic primer with useful quiet/failure alternatives | Denied microphone permission leaves a working supported route; required disclosure remains before processing |
| Conversation (`Convo`), P0 | Visible factual stage, transcript, one obvious speaking action and stable help/typing/pause/leave | Begin, get help, type, pause, reconnect and leave without losing intent or leaving an active metered room |
| Guided lesson (`Lesson`), P0 | Same room language; clear model → learner turn → support; interruption recovery | Beginner understands who speaks next; scaffolding remains core-owned and no mid-session score appears |
| Drill (`Drill`), P0 | One prompt, readable support, clear reveal/retry; retain sitting on interruption | The preview does not leak recall targets; completion is recorded once and retry keeps the actual target |
| Review (`Review`), P0 | One recall decision at a time; offer an honest finish when nothing is due | Empty, due, reveal and finished states work; no invented recalled-card credit |
| Sound check (`SoundCheck`), P0 | Reference line, model audio, Record/Stop, actual result or unscored explanation | No numerical/qualitative pronunciation verdict without returned assessment evidence; denied permission and service failure recover |
| Sound journey (`SoundJourney`), P1 | Explain one focus sound from dated checks; make one related retry prominent | History links to actual checks; an authored example is not presented as a personal diagnosis |
| Daily phrase/shadowing (`DailyPractice`), P0 | French and gloss first; distinct model/take controls; explain temporary, ungraded recording | Listen, record, compare, redo and finish; unavailable audio is explicit; only durable completion earns a day |
| Daily library (`DailyLibrary`), P1 | Compact thematic phrase rows; effort/mode where meaningful; no unnecessary catalogue decoration | User finds a usable phrase, including an offline item, without guessing whether its audio exists |
| Conversation practice (`ConversationPractice`), P1 | Name the source scene; stage orientation; optional warm-up; quiet recall door | Missing/deleted pack explains recovery; listening and recall stages preserve meaning and completion truth |
| Real moment (`RealMoment`), P1 | Short examples, a simple context entry and clear start-mode/cost expectation | Selected context reaches the existing conversation start; no learner-private text is introduced into route URLs |
| Goal step (`GoalStep`), P1 | Practical next goal action plus evidence and edit route | Deleted/changed goal has a recovery path; goal self-report and independent scene evidence remain different |
| Tutor introduction (`TutorIntro`), P1 | Demonstrate real support/turn controls and concise AI/processing explanation | User can understand and dismiss it; explanation matches current runtime, including network and typing limits |

### Results and personal history

| Page and priority | Recommended change | Acceptance check |
|---|---|---|
| Conversation recap in place, P0 | Put the learner's actual French, one correction and useful retry together; retain close on every page | No empty story step; save failure is recoverable; sound/can-do pages appear only when supported |
| Lesson/drill/review summaries in place, P0 | Reuse result hierarchy; show the credited sitting and one next action | Save/settle retry cannot double-credit XP, day or badge; safety stop has no success celebration |
| Saved phrases (`Phrasebook`), P1 | Situation grouping, French/English retrieval, compact audio and recall actions | Empty, searched, no-results, unread and offline states are distinguishable; language/reading size preserved |
| Conversations (`Conversations`), P1 | Scene title, date and one useful phrase; continue versus practise clearly distinct | Pagination and refresh preserve current content; unavailable/deleted work has a clear explanation |
| Saved conversation text (`SavedConversationText`), P1 | Plain transcript reading with clear retention/delete wording and separate curated learning content | Text deletion confirmation describes the actual scope; absence is not confused with a load failure |
| Weekly reflection (`WeekWrapped`), P1 | A short evidence-backed story of actual French, then one useful next action | Quiet week receives a calm useful state; weekly/lifetime/streak measures are not mixed |
| Postcards (`Postcards`), P2 | Original scene keepsakes grounded in earned status, with an available scene link | No unearned card reads as achieved; grid and detail scale and remain readable |
| Streak (`Streak`), P1 | Current run plus lifetime days, calendar, factual repair/freeze state | Local dates and paid rules come from existing owners; reset has no guilt; reopening does not re-award a day |
| XP/level/badge takeovers, P1 | Persisted result, clear dismiss/continue, existing bounded queue | Never interrupt a live sitting; seen receipt prevents repeats; XP level is not labelled as CEFR ability |

### Identity, settings and social pages

| Page and priority | Recommended change | Acceptance check |
|---|---|---|
| Profile (`Profile`), P1 | Identity, concise tutor row, compact real progress and preferences; Settings remains obvious | Name edits and voice choice work independently; a sample stops when leaving; large text reflows |
| Voice/name sheets, P1 | Short choices, selection distinct from audition, accurate Save/Done semantics | Audition does not select; choosing does not unexpectedly play; cancellation preserves the relevant existing value |
| Tutor memory (`TutorMemory`), P1 | Explain stored learning context, distinguish facts/goals, visible forget/edit controls | Paused memory is clear; deleted fact does not reappear from stale local data; no invented privacy assurance |
| Settings (`Settings`), P1 | Group Account/Plan, Learning, Sound and feel, Permissions, Data/privacy and Support | Learner locates a reminder, subscription or privacy action without hunting; failures preserve actual settings |
| Plans (`Wall`), P0 | Explain the actual need, verified offer and allowance; retain close, restore and free practice; use the full state matrix in section 11 | Correct localised charge and terms; selection survives legal/store detours; access follows verification; intended practice remains recoverable |
| Reminder/time panels, P1 | Optional explanation, selected time, permission status and explicit saved result | Permission denial opens appropriate recovery; no “reminder set” before scheduling and saving succeed |
| Export/delete/sign-out panels, P0 | Plain consequences and stable verification states; use existing authority | Export/download failure recoverable; deletion pending distinct from completed; cancellation safe; unrelated accounts untouched |
| Friends (`Friends`), P1 | Optional shared French task, readable people and invitation/requests | Empty state useful; private activity respected; no points/ranks/social proof invented |
| Invite/find friend (`AddFriends`), P1 | Explain invitation versus search; keyboard-friendly form and clear result | Cancel, duplicate invite, no result and failed send are explicit; deep-linked invite lands correctly |
| Social privacy (`SocialSettings`), P1 | Explain each sharing choice at the control and show saved state | Private default and failure handling match current rules; update is not silently reported as saved |
| Friend detail/request/report panels, P1 | Clear relationship action; report/block separated; confirm appropriate consequences | Accept/decline, report failure and block state are testable; no unexpected sharing or accidental destructive action |
| Privacy (`Policy`) and Terms (`Terms`), P0 | Readable normal-page layout, stable return and accessible links from onboarding and purchase | Back returns to previous form/offer intact; no clipped legal content at large text |
| Support/acknowledgements panels, P1 | Compact factual help, real contact route and readable attribution | Links reach configured destinations; no promise unsupported by operations |
| `Tabs` container, P0 | Keep four labelled destinations, clear selection and real bottom clearance | Cold deep link, back, tab switch, safe area and large labels behave without orphaned sitting state |

### Onboarding and account surfaces outside the navigator

| Surface and priority | Recommended change | Acceptance check |
|---|---|---|
| Launch/startup/restore, P0 | Brand continuity and truthful load/restore/retry, theme applied early | Restore failure never appears as zero history; no indefinite decorative loader |
| Welcome, P0 | One concrete speaking promise; Start plus visible returning sign-in | New and returning users choose the intended door without account-mode confusion |
| Purpose/level/confidence/focus/time, P1 | Clear choices; keep approved level/time; justify or defer optional questions | Back/resume retain answers; retained answers affect the actual plan; no invented progress percentage |
| Personal plan/edit, P1 | Concrete first situations, editable choices and a single start route | Edit updates the plan once; large-text tiles stack; no fake “analysing your answers” stage |
| Tutor selection, P1 | Recommended/default voice if current policy allows, optional samples, clear selected status | Voice samples and selection are independent; no audition requirement or unavailable voice offered |
| Eligibility/refusal/processing, P0 | Short factual explanation with current ordering and a real exit | Existing age gate precedes processing; a refusal does not retain disallowed data or start a guest session |
| First practice/connect/error/safety, P0 | Supported first reply with text/fallback route and real observed states | No fabricated tutor audio/result; service refusal recoverable; safety exit earns no success |
| First result/partial result, P0 | Actual kept French and distinction between attempt and finish | Interrupted attempt is not called a completed session or independent can-do |
| Day-one celebration/reminder, P1 | Original earned result; optional reminder after useful work | Persisted day owns one entrance; Reduced Motion shows final still; denied reminder remains optional |
| Keep progress/guest Home/starter continuation, P0 | Actual investment and one next action; clear save/sign-in choices | Guest return preserves real work; transfer/retry cannot duplicate it or give it to another account |
| Sign-in/signup/account-method states, P0 | Native coherent frame, explicit intent, provider labels, reachable keyboard action | Complete/cancel/retry each method; large-text and keyboard checks; password stays ephemeral |
| Email verification/account ready, P0 | Waiting and verified states with useful recovery and no premature success | Confirmation pending cannot unlock an authenticated success or erase guest work |
| Reset request/reset sent/new password, P0 | Destination email, edit/resend/sign-in and expired-link recovery | Recovery deep links reach the correct flow without lost session/profile state |
| Erase/deletion-pending notices, P0 | Factual durable outcome and what remains to be done | Local copy retained, server deletion pending and completed removal are visibly different |

Walk mode remains conditional on its existing availability flag. If enabled, audit its intro, screen-off/audio interruption, transcript access, stop and return against the same room requirements. Do not promote a conditional feature as universally available.

## 10 States that make the whole app feel finished

| State | Shared behaviour | Evidence required |
|---|---|---|
| Initial loading | Destination-shaped skeleton or concise text; usable independent actions remain available | Never renders “no history” before the owned read finishes |
| Refreshing | Keep last usable same-account content; small status if needed | No cross-account stale content; no unnecessary blank screen |
| First-use empty | One real first task and clear explanation of what will appear here | No zero dashboard or unearned progress claim |
| No search results | Keep query visible; clear/reset/change-filter route | Distinguished from genuinely empty storage |
| Read/write error | Name what failed, retain input/content, offer exact retry | Retry restores the intended operation without double credit |
| Offline | Cached or bundled work where available; factual live/store limitation | Button does not promise offline capability for a network-only action |
| Permission denied | Explain the affected feature; text/quiet path or system settings route | Permission prompt only at explicit feature use; denial does not strand learner |
| Pending operation | Busy action names the operation; duplicate requests prevented | Pending purchase/auth is not mistaken for failure or success |
| Returning user | Restore owned progress, mode and meaningful task | New device/expired session do not silently restart onboarding |
| Interrupted/background | Stop incompatible audio/motion; preserve resumable sitting | No phantom microphone, tutor, progress or active meter |
| Reduced Motion/VoiceOver | Useful still presentation and logical focus/action sequence | Main journeys completed on native hardware with these features |

Every primary interaction should answer: what am I doing, what is happening now, and what can I do if it fails? Error copy should describe the immediate problem, not expose internal vendors, HTTP codes or diagnostic labels unless they help the learner act.

## 11 Plans and subscription states

Reuse the existing central wall, native offer model, store price source and server entitlement/allowance authority. The current programme and catalogue, not Headspace or the older Figma fixtures, determine Luvani's offers. The product document's historical 30-minute trial and the later programme's offer decisions are not interchangeable inputs; UI must use the verified current catalogue and eligibility result. Paid Starter/Max allowances remain 180/300 minutes under the current documented contract unless that authority changes.

For an eligible trial, put the actual trial duration, allowance, full charge and billing period in the decision area. Explain when access starts, when payment occurs and whether a reminder was actually scheduled. For an ineligible or unknown user, omit a free-trial claim until entitlement/offer facts establish it. Keep close/Not now, restore, terms, privacy and cancellation management available. A monthly equivalent may support comparison, but must not replace the annual billed amount.

The existing 56-state billing design can be refined in these groups:

| State group | Required UX |
|---|---|
| Entry after practice/from Settings/locked scene/no minutes | Explain the user's actual need; preserve intended destination; keep usable free practice |
| Offers loading/unavailable/partially available | No guessed price; retry and dismissal; only genuine available products selectable |
| Eligible/ineligible/unknown trial; returning subscriber | Appropriate exact offer copy; no default free claim or invented discount |
| Selecting monthly/yearly/tier | Selection, billed amount, period, allowance and action update together; legal detour preserves choice |
| Opening store/cancelled/payment failure | Native confirmation is expected; cancellation calm; failed payment keeps selection and specific retry |
| Store success/verifying/slow verification | Distinguish paid transaction from confirmed usable access; prevent repeated repurchase |
| Pending approval | Clear pending state with a safe return; do not offer immediate repeated checkout |
| Restore found/none/other account/offline | Explain each actual result; restore access only after verification; account mismatch has recovery |
| Confirmed trial/paid access | State actual allowance and destination; resume selected scene with an explicit action |
| Trial/Starter/Max exhausted | Exact allowance state and actual reset/expiry if known; free practice and relevant plan path |
| Active/cancelled renewal/grace/retry/lapsed/revoked/unknown | Access and renewal are separate; preserve verified active access; unknown status is never presented as proven expiry |
| Plan change scheduled/store terms review | Effective date and terms from the authority; no invented immediate upgrade |
| Reminder scheduled/denied/off | Claim scheduling only on success; denial/off has calm alternative and correct settings route |
| Metering explanation | Plain description of live time, reset and free practice; estimates distinguished from balance |

Weekly offers and proposed fixture prices in the 9 October design are not configured native products in its implementation record. Do not port them just because they appear in the prototype. A product/price change is a separate commercial and backend change contract.

## 12 Implementation order and ownership

Use this as a refinement of the existing vibrant revision and come-alive programme. Create bounded implementation tasks in the [existing change-contract format](changes/README.md) when coding begins. Do not create an alternate roadmap or alter decision owners in the redesign.

| Order and owner | Allowed write area for a future task | Dependency and observable completion |
|---|---|---|
| 1. Product/design integrator: confirm hierarchy and state map | Existing design/review contract; proposed fixtures | Check current checkout/build identity; approve screen compositions and preserve current policy constraints |
| 2. Presentation owner: core tab hierarchy | `src/tabs/`, `src/practice/NextTaskCard.tsx`, existing home/progress presentation components | Depends on 1; Practice preview/action and Progress evidence visible; four-tab task tests pass |
| 3. Design-system owner: reusable appearance and surfaces | `src/palette.ts`, `src/theme.ts`, `src/components.tsx`, `src/layout.tsx`, `src/responsiveLayout.ts`, relevant contracts | Depends on 1 and agreed dark roles; colour/state pairs checked; shared controls pass compact/large text/sheets |
| 4. Account-flow owner: auth and handoff presentation | `src/auth/`, `src/onboarding/GuestAccountHandoff.tsx`; `App.tsx` only through integrator | Depends on shared form/layout decisions; disposable-account scenarios and exactly-once adoption pass; no duplicate auth policy |
| 5. Voice presentation owner with lifecycle owner | Mobile `ConvoScreen.tsx`, `LiveSessionScreen.tsx`, existing `src/live/` controls; lifecycle service only if separately scoped | Depends on 2/3; native start/help/type/pause/interruption/reconnect/leave verified; meter remains authoritative |
| 6. History/learning presentation owner | Existing phrase, pack, sound, goal, recap and progress screens | Depends on core hierarchy; evidence claims trace to existing records; supported and independent outcomes remain distinct |
| 7. Account/commercial presentation owner with server owner | `src/settings/`, `src/wall/`, `src/purchases/` presentation; authority files only through a separate contract | Depends on 3/4; offers, verification, restore, cancellation and no-minutes matrix pass using real test-store states |
| 8. Integrator: social/secondary consistency and release evidence | Existing friends, legal, support and relevant design docs | Depends on prior owners; full route/state sweep, gate and native journey acceptance recorded |

Paths in this table are relative to `apps/mobile/` unless a document is named. Shared interfaces, `App.tsx`, navigation and shared contracts have one integrator. Build sequentially through dependencies. The table does not authorise unattended runners, parallel agents, new providers, changed prices or server policy changes.

P0 first: Practice/Progress hierarchy, coherent account handoff, session controls, actual results, free fallback and honest billing. P1 next: systematic appearance, libraries, profile/settings and social consistency. P2 last: richer illustration variants and keepsake polish. A beautiful secondary screen cannot compensate for a confusing first exchange or lost progress.

## 13 How to validate a substantial improvement

### Compare the same real tasks

Begin with eight target beginners and eight returning-user scenarios as a formative round. These small samples expose problems; they do not establish statistically reliable retention or conversion uplift. Include users who practise quietly, need larger text, or use a screen reader. Use the current attached-build baseline and the revised build with the same tasks, and avoid teaching one version before testing the other in a way that biases results.

Tasks: choose today's French; identify live versus free practice; complete a first supported exchange; ask for help; type instead; revisit a saved phrase; explain a can-do; save guest progress/sign in; recover a password; understand an offer and restore a purchase; find reminder/privacy controls.

| Measure | How to record it | Proposed acceptance goal |
|---|---|---|
| Find the next action | First choice, wrong doors, elapsed time to correct action | At least 7/8 in each formative group choose it unaided; median identification within 5 seconds |
| First useful French exchange | Completion, human intervention, misunderstanding, freezes | At least 7/8 beginners complete the supported exchange without researcher rescue |
| Retrieval | Correctly reopen a specified saved phrase/conversation | At least 7/8 find it in the intended destination without browsing unrelated tabs |
| Progress comprehension | Ask what improved and what evidence supports it | At least 7/8 distinguish independent ability, supported practice, collection count and XP |
| Account continuity | Compare actual owned records before/after each detour | Zero lost or duplicate guest handoffs in scripted acceptance; formative errors tracked separately |
| Offer comprehension | Ask immediate charge, later charge/period and allowance | At least 7/8 correctly answer all three; no mixed currencies or unsupported trial promises |
| Accessibility | Complete core tasks at largest supported text and with native assistive features | No clipped critical information, unreachable action or blocked focus route |

These are proposed decision thresholds, not measured results or release certifications. If a participant misunderstands a purchase or privacy consequence, repair that problem even if the aggregate threshold passes. Log the reason for errors, not just the completion rate.

### Product outcomes after release

Use the existing consent-aware measurement system to compare first-practice completion, time to first useful exchange, return to a second practice, due-review completion, account handoff completion and subscription comprehension/support problems. Segment connection, service and purchase failures so a UI change is not credited for an unrelated reliability change. Keep raw audio, credentials and private transcript text out of event payloads.

Choose one primary outcome per experiment, define its denominator and time window in advance, and choose an appropriate sample size from the measured baseline. Do not announce a 10x improvement from a polished prototype, a handful of interviews or a movement in one screen's click rate.

## 14 Sources and review boundaries

The supplied six assets are the primary Headspace evidence. Preserved visual excerpts and concept diagrams appear in the companion PDF. No claim is made about Headspace retention, paid conversion, experiment results, hidden implementation or a completed purchase.

Luvani sources used for recommendations:

- [Product commitments](../PRODUCT.md), [design system and latest visual direction](../DESIGN.md), and [binding come-alive decisions](come-alive/README.md).
- [App gates and auth/bootstrap](../apps/mobile/App.tsx), [mounted routes](../apps/mobile/src/nav/RootNavigator.tsx), [route contract](../apps/mobile/src/nav/types.ts), and [tab bar](../apps/mobile/src/nav/LuvaniTabBar.tsx).
- [Home](../apps/mobile/src/tabs/HomeTab.tsx), [Speak](../apps/mobile/src/tabs/TutorTab.tsx), [Practice](../apps/mobile/src/tabs/PracticeTab.tsx), [Progress](../apps/mobile/src/tabs/MyFrenchTab.tsx), [Profile](../apps/mobile/src/tabs/ProfileTab.tsx), and [shared next action](../apps/mobile/src/practice/NextTaskCard.tsx).
- [Auth flow](../apps/mobile/src/auth/AuthFlow.tsx), [sign-in](../apps/mobile/src/auth/SignInScreen.tsx), [signup](../apps/mobile/src/auth/SignUpScreen.tsx), and [synthetic preview](../apps/mobile/src/dev/OnboardingPreview.tsx).
- [Pre-account onboarding](../apps/mobile/src/onboarding/PreAccountOnboarding.tsx), [setup sequence](../apps/mobile/src/onboarding/flow.ts), [guest return](../apps/mobile/src/onboarding/guestProgress.ts), and [first live practice](../apps/mobile/src/onboarding/FirstLivePractice.tsx).
- [Recap](../apps/mobile/src/RecapScreen.tsx), [scene list/brief](../apps/mobile/src/missions/MissionsScreen.tsx), [daily practice](../apps/mobile/src/daily/DailyPracticeScreen.tsx), [settings](../apps/mobile/src/settings/SettingsScreen.tsx), and [central plans wall](../apps/mobile/src/wall/WallScreen.tsx).
- Existing phrasebook, conversation library/practice/text, sound-check/journey and goal-step screen source; [prior 130-state proposal](../artifacts/paywall-mockups-2026-10-09/REVIEW.md) used as a coverage reference, not shipped evidence.

Professional baseline checks use W3C's [text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), Apple's [touch/layout guidance](https://developer.apple.com/design/tips/) and [larger-text evaluation guidance](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/larger-text-evaluation-criteria), reviewed on 11 October 2026. Design interpretations and Luvani proposals remain the analysis of this review.

### Delivery verification

The final verification record is in [the local review record](../artifacts/headspace-ux-review-2026-10-11/REVIEW.md). Physical iPhone/iPad, native software keyboard, VoiceOver, real provider authentication, guest admission, voice quality and store transactions remain implementation acceptance work. This report does not claim they passed. No runtime source, product policy, store configuration or external account was changed.
