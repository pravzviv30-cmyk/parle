# Direction B implementation · 9 October 2026

Approved reference: https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=127-1132

The approved colourful direction is implemented in the React Native codebase. The Figma review board records the approval. Existing detailed Figma screens and the native work from the preceding design session remain intact.

## Changes

- Blue onboarding welcome with the café illustration, one short invitation and yellow primary action; continuation enters the existing personalised drink/goal flow. Drafts, account entry and consent logic remain in place.
- Sun Home with a single scene-led next action. Additional daily options are in a sheet.
- Mint Practice with three compact routes and the real recommended practice action. Additional choices are in a sheet.
- Sun Progress with real earned counts for returning learners; new learners get an immediate offline café practice. Detailed progress remains available.
- Compact paywall with explicit Weekly, Monthly and Yearly choices, selected allowance, billed amount, recurring terms, restore/legal links and “No Commitment, Cancel Anytime”. Max remains a separate comparison. The reading column is capped at 560pt; the footer remains capped at 480pt.
- Cloud orb surface is retained for the live tutor and now also appears in the tutor identity card. Existing reduced-motion, background and audio lifecycle controls remain intact.
- Shared navigation choices have button semantics rather than toggle semantics. Web sheets expose dialog/modal semantics. Secondary profile/settings/friends routes retain the calm utility treatment and existing data and privacy actions.

## Weekly contract

The agreed US target is $5.49 every seven days with 45 AI tutor minutes, no trial and no rollover. Production UI reads localized store prices; no UK price is invented.

Set the same configured product identifier on both sides:

- Client: `EXPO_PUBLIC_REVENUECAT_STARTER_WEEKLY_PRODUCT_ID`
- Server: `REVENUECAT_STARTER_WEEKLY_PRODUCT_ID`

The RevenueCat offering must contain this exact product with period P1W and no introductory offer. The readiness response must match the product and 2700-second allowance before purchase can proceed. Existing monthly configuration remains required. No store or RevenueCat products were created or published during this work.

Verified paid Weekly transactions use the existing replay-safe entitlement projection with a 2700-second grant. A replay keeps consumed minutes; renewal resets rather than accumulates minutes. Unknown products, mismatched configuration and Weekly trials do not grant Weekly access. Server status exposes the actual allowance so confirmation and settings do not describe a 180-minute month. Purchase settlement, account scoping and usage charging remain in their existing guarded paths.

Yearly pricing proposals in Figma are still proposals. Native pricing comes from the actual offering. The existing Starter annual trial grant remains 42 minutes, and Max 70; the proposed trial allowance was not silently substituted.

## Verified

- All workspace TypeScript checks pass.
- Mobile: 2,603 tests pass; billing server: 428; tutor agent: 609. Earlier complete brain/core/playground runs passed 468/794/26 tests. No tests were skipped in the final mobile/server/tutor runs.
- Production web export succeeds.
- Phone screenshots: onboarding, Home, Practice and empty Progress at 375pt; Weekly and Yearly paywall at 375pt; Yearly at 430pt. Navigation and sheet open/close/focus return checked through the real app UI.
- 320pt Practice stress check has no horizontal overflow; vertical scrolling remains available. Tablet paywall inspection exposed stretched cards and led to the 560pt reading-column fix. The retained tablet screenshot is explicitly the before-fix evidence.
- Profile and Friends remain reachable. Browser checks use local development data. Paywall screenshots use the actual production components with an isolated fixture offering, not a real store transaction; the fixture is archived under artifacts and is not an app entry point.
- `git diff --check` passes. The original App entry is restored; no preview-only screen is shipped.

## Release qualification still required

Figma and browser checks do not establish physical-device readiness. Native StoreKit sandbox purchase/restore/refund/account-switch checks, maximum Dynamic Type and VoiceOver traversal, device safe areas/keyboard, and release-build orb performance still need real simulator/device execution. No native purchase, production billing configuration or deployment was performed.

This project uses Expo SDK 57, whose minimum iOS version is 16.4. iPhone X cannot run that version and is not supported by this stack. Future device names are not used as layout specifications; layout responds to the available size and safe-area insets.

Evidence: `artifacts/direction-b-implementation-2026-10-09/`.
