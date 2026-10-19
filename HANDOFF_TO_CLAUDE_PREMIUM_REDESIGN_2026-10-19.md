# Luvani handoff — premium paywalls and account surfaces

> **Status, 19 October 2026: completed and superseded.** This note describes where Codex stopped; the work it describes is now done. Claude designed the P2 Luvani screens in Figma, built them and committed them on this branch (`7809abd5`…`6b77f08b`). The full gate is green.
> The current state, what remains and the next steps are in `/Users/pravz_07/Documents/StartUps/handoffs/LATEST.md`, outside the repo. The sections below are kept as the original brief.

## Handoff checkout

- **Path:** `/Users/pravz_07/.codex/worktrees/3957/Luvani-handoff-2026-10-19`
- **Branch:** `codex/luvani-session-handoff-2026-10-19`
- **Base revision:** `21c8bb497a24f82414e3dc7099de502d131c935a`
- This checkout is a verified copy of the source session's tracked changes and non-ignored untracked files. This handoff note is the only additional file.
- Do not work in `/Users/pravz_07/Documents/StartUps/Luvani`; that is the permanent integration checkout.

## Where the work stopped

The accepted next piece of work was a **Figma revision only** for premium paywalls, Profile and Settings. No new mobile-source implementation was started for this premium revision.

The user confirmed these decisions:

1. Premium screens should be led by **typography and spacing**, with **no illustration**.
2. Design both a post-onboarding **seven-day trial paywall** and a separate **standard, no-trial subscription paywall**.
3. Redesign Profile and Settings around existing functionality, plus clearly-labelled, useful proposed additions.

The new Figma foundation is ready but the actual screen layouts have not yet been drawn:

- Figma file: `sjAwoGinWQKvhGrWbgMO18` — *Luvani — Four onboarding worlds · October 2026*
- New page: `P1 · Premium paywalls & account` (`471:364`)
- Light board wrapper: `471:390`; dark board wrapper: `471:391`; component/library wrapper: `471:392`
- Variables: `P1 · Premium appearance` (`VariableCollectionId:471:365`) with Light (`471:0`) and Dark (`471:1`) modes
- Typography styles: `P1/Premium/display`, `title`, `heading`, `body`, `row`, `small`, `meta`, `button`, and `nav`

Existing M2/M3 app designs remain in the same Figma file. Do not delete them while producing the P1 premium screens.

## Design direction

Treat the Headspace trial layout as a structural reference, not a visual copy. The result should be quiet, editorial, native-feeling and easy to scan.

- No illustration, gradient, fake social proof, metallic treatment, glass effect, oversized badge, or decorative pill clutter.
- Premium palette: warm ivory `#F7F5F0`, near-black ink `#202229`, dark background `#141923`, dark surface `#1D2430`, soft white `#F4F1EA`, muted `#B6BEC9`, and reserved warm sand `#DBC49C` for emphasis.
- Use native-style typography and generous whitespace. The Figma foundation uses SF Pro.
- Use 28pt page gutters, 44pt minimum hit targets, and a 56pt primary CTA.
- Keep the close affordance at a 44pt hit target and keep Restore purchases, Terms and Privacy visible near the footer.

### Trial paywall (390×844)

Build a calm page that fits all essential truth above the CTA:

1. Compact top bar: close and Luvani wordmark.
2. Headline: **How your 7-day trial works**.
3. Exact selected offer text below it. All money, duration and trial terms must be supplied by App Store / RevenueCat configuration; use clearly marked sample values in the design only.
4. Annual / Monthly segmented selector. It changes the billing period; it must not be an on/off control for the trial.
5. A concise annual saving line when Annual is selected.
6. Three-step timeline:
   - **Today:** Start speaking with your tutor and use the included allowance.
   - **Before day 7:** Manage or cancel in Apple Subscriptions at least 24 hours before the trial ends.
   - **Day 7:** The selected plan continues at the exact displayed price.
7. Current-tier summary and a quiet **Compare plans** route. Do not stack a plan selector inside the billing switcher.
8. Footer CTA: **Start 7-day free trial**, with exact post-trial disclosure directly adjacent to the CTA.

Suggested vertical rhythm: header 55–99, title 112–154, offer 166–212, selector 232–280, timeline 334–590, CTA 650–706, disclosures 716–756, legal links 762–806.

### Standard subscription paywall

Use the same layout shell, but remove all trial claims. Suggested headline: **Keep speaking with Luvani**. Show selected store price, plan comparison and three tangible benefits:

- Speak with the tutor about real situations.
- Revisit and practise language from past conversations.
- Explore situation-based modules matched to the learner's needs.

The CTA is **Subscribe**. The screen must never say “nothing due today.”

## Entitlement and paywall behaviour

Existing product modelling in this checkout supports Starter and Max plans:

- Starter: 180 minutes per 30 days; a seven-day trial allowance of 42 minutes.
- Max: 300 minutes per 30 days; a seven-day trial allowance of 70 minutes.
- Saved learning and local practice remain available without claiming unlimited live tutoring.

Required UI states to design and implement:

- Eligible trial offer.
- Ineligible / standard paid offer.
- Eligibility or offer loading state; reserve layout space and do not show a made-up price.
- Offer unavailable / offline state with a retry action.
- Purchase pending, successful, cancelled and failed states.
- Restore success and restore failure states.
- Current entitlement / manage subscription state.

The app must only render verified App Store / RevenueCat products, eligibility and purchase state. Treat an unknown eligibility result as unknown, not eligible. Do not promise a reminder unless that reminder is a real product feature.

## Profile and Settings information architecture

### Profile

Use a compact **Profile** header with a settings gear, clear identity and an Edit name action. Surface genuine actions:

- Learning preferences summary and entry point.
- Tutor voice (six existing choices).
- Tutor memory.
- Progress summary.
- Shortcut to the existing conversation library / **My French** only where it adds value; do not duplicate its content.

### Learning preferences

Existing settings that should be presented clearly:

- Practice routine.
- Corrections preference.
- Simpler French.
- Start with typing.

Proposed addition, labelled as requiring persisted storage and logic: **Conversation starting point**. It can update future recommendations and tutor support but must never rewrite an earned level. “Simpler French” means shorter, clearer French with one idea at a time; it is not an audio-speed control.

### Settings index

Use grouped, familiar categories and navigate to detail pages/sheets:

- Account: email/provider, sign out, delete account.
- Subscription: verified current plan, manage subscription, restore purchases.
- Reminders.
- Appearance & sound.
- Privacy & data.
- Help & about.

When the entitlement cannot be checked, say that it could not be checked and offer Retry; do not label the user Free. Saving errors should revert the control or preserve its previous value and show a clear local error.

## Research basis

- RevenueCat's Mimo case study reports large improvements after an honest, timeline-led trial explanation, but it is a single case study rather than a universal conversion claim: https://www.revenuecat.com/blog/growth/optimize-funnel-metrics-mimo
- RevenueCat rules and conditional product presentation: https://www.revenuecat.com/docs/tools/paywalls/creating-paywalls/rules
- RevenueCat advises against a free-trial on/off toggle, which has been associated with App Review rejection: https://www.revenuecat.com/blog/growth/rip-toggle-paywall
- RevenueCat paywall case studies and conversion guidance: https://www.revenuecat.com/blog/growth/paywall-redesigns-case-studies/ and https://www.revenuecat.com/blog/growth/paywall-conversion-boosters
- Intro-offer eligibility guidance: https://revenuecat.github.io/codelabs/guides/check-intro-eligibility.html
- Apple cancellation guidance: https://support.apple.com/en-gb/118428

## Important repository context

This handoff contains a broad, uncommitted app revision, not only the premium mock-up work. It includes:

- C2-led onboarding and main-app visual changes, including cloud-based artwork and motion layers.
- A restructured Home, Explore, tutor and My French / conversation-practice experience.
- Modules, practice library, conversation revisit routes and ability-aware personalisation.
- Trial/offer/paywall domain changes and RevenueCat preparation documentation.
- Profile/Settings preference work, dark-theme and responsive layout changes.
- Associated tests, native preview guards, research reports, design artefacts and state documentation.

Before changing source, read `CONTEXT.md`, then the one relevant document selected through `docs/README.md`, and preserve current owner boundaries. The mobile UI owns presentation; entitlements and store truth must remain server/store-adapter authority.

## Validation expectation

After any implementation, run focused tests while working and `npm run gate` before calling it complete. Also exercise onboarding → account/name → trial paywall → purchase/restore error paths → Home → Explore → Speak → conversation revisit → Profile/Settings on the iOS simulator.
