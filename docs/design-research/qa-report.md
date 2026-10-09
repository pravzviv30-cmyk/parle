# Design review QA · 9 October 2026

## Review links

Written handoff: [video analysis](video-analysis.md), [app audit](app-audit.md), [screen inventory](screen-inventory.md), [Design DNA](design-dna.md), [UX plan](ux-improvement-plan.md), [paywall strategy](paywall-strategy.md), and [implementation plan](implementation-plan.md).

- [Two directions — B recommended](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=127-1132)
- [Before and after](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=133-7760)
- [Weekly prototype](https://www.figma.com/proto/cJ79urCrmiQEm7MgQnoG3D?page-id=121%3A649&node-id=121-656&starting-point-node-id=121-656)
- [All new frames](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=121-649)
- [Compact 375×812](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=128-1296)
- [150% text stress case](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=130-7893)
- [Tablet](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=128-1406) / [desktop](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=128-1467)

## Completed in this phase

| Check | Evidence / result |
|---|---|
| Master brief | Preserved original; revised copy at `artifacts/weekly-subscription-2026-10-09/master-prompt-with-weekly.txt` includes Weekly and annual-only trial policy |
| Research | Three requested videos identified; transcripts/review and sampled visuals; access limits recorded in video-analysis.md |
| Route inventory | All 33 registered user screens; conditional auth/onboarding/sheets/live/billing states separately inventoried |
| Figma exploration | 53 new editable design/state frames, two directions, before/after board, five responsive/stress examples; existing 151-state detailed flow retained |
| Editability | Final audit: 589 frames, 541 text nodes, 225 instances, 398 vectors, 51 groups, 2 ellipses across the 53 new screens; zero image fills/flattened UI screenshots |
| Typography | Every inspected text node in all 53 new screens uses Outfit; no mismatched font family |
| Components | Existing colour/spacing/radius variables, text styles, artwork, icons, buttons and orb reused; one compact-choice component added |
| Main paywall | Weekly, Monthly and Yearly plus allowance, billed recurrence, CTA, exact reassurance and legal/restore links visible at default 390×844 and 375×812 |
| Compact layout | 375×812: content 460pt inside a 510pt viewport with 24pt vertical padding; no content scroll needed |
| Large text | 150% text: content 733pt; 480pt viewport; readable scrolling allowed; 210pt footer remains visible. This is a Figma stress fixture, not a Dynamic Type simulator test |
| Other widths | 430×932 live, 834×1194 centred Home, 1440×1000 centred paywall layouts created; compact/tablet screenshots inspected |
| Overflow | All 53 default frames fit their content viewport except the intentionally scrollable acknowledgements list |
| Contrast | White/blue 7.87:1, white/coral 4.68:1, ink/sun 11.57:1, ink/mint 8.98:1, soft/paper 6.19:1, ink/paper 16.60:1 from palette values |
| Prototype | 293 reaction nodes; zero unresolved NODE destinations. Weekly, Monthly, eligible Yearly and paid Yearly each reach their own pending path; success opens management, not another buy screen |
| Copy integrity | Weekly paid immediately, 45/7 days, no rollover; annual-only eligible trial; no invented UK price, fake discount or promised conversion uplift |
| Recovery | Unknown plan is not an upsell; cancellation preserves paid access; partial device erasure retains its required warning |

Prototype counts include parent/child hit areas and review navigation, not 293 distinct product features. New-page purchase flows use local transitions. Links into existing detailed app/permission/legal flows open that existing Figma prototype in a new tab. Native store management opens Apple’s subscription-management URL; no purchase, cancellation, refund or account change was executed by this work. Pending/success/restore branches are illustrative scenario fixtures, not live transaction verification. Static review-board copies are for comparison; use the named flow starting points for interaction.

One wiring attempt exceeded the tool response limit and rolled back. The successful retry returned compact evidence; the final audit confirms the written reactions. `prototype-verification.json` records the initial zero-reaction check; `prototype-wired.json` and `final-figma-audit.json` are the successful final evidence.

## Visual evidence

`artifacts/weekly-subscription-2026-10-09/` contains `directions-final.png`, `before-after.png`, `compact.png`, `tablet.png`, `large-text.png`, `max-final.png`, `yearly-final.png`, frame ledgers and final structural/prototype audit. The earlier cloud-orb video remains under `artifacts/orb-onboarding-2026-10-09/`; no new claim of animation performance follows from a static screenshot.

## Native baseline — prior work, not rerun here

The preceding October 9 implementation recorded a passing typecheck and **2,600 tests across 647 suites**, with no failures/skips; see `artifacts/orb-onboarding-2026-10-09/verification.json` and its logs. No production app code was changed during this new research/design phase, so those suites were not rerun for documentation/Figma-only changes. `git diff --check` passed during this phase.

## Still required before production

1. Approve the final direction at the master prompt’s section 9 checkpoint.
2. Confirm proposed Monthly/Yearly/Max prices, annual trial cap and localisation; configure and validate Weekly store/backend support.
3. Implement the approved design route by route, retaining existing account/audio/billing safeguards.
4. Test real native Dynamic Type, VoiceOver, keyboard/focus, landscape, Reduce Motion, physical-device safe areas and performance. Static Figma checks cannot certify every iPhone or a future unverified device format.
5. Run sandbox billing lifecycle and authoritative allowance tests. Verify recovery and account switching with real integration boundaries.
6. Conduct comprehension/usability sessions; measure conversion only with controlled, adequately powered experiments.

This is a design-review handoff, not production release certification. Shared-pattern references in the inventory are deliberately distinguished from bespoke pixel-complete variants. Every data value and purchase result shown in the mockups is a fixture until supplied by verified application state.
