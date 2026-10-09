# App audit · design approval baseline

## Scope and evidence

This is a source/Figma audit of the current worktree, supported by the prior October 9 native screenshots and test record. It is not a fresh end-to-end device run of every authenticated state. The current app contains substantial earlier, uncommitted user-authorised work; this research phase preserves it. See `screen-inventory.md` for every registered screen and its design coverage, and `qa-report.md` for the evidence boundary.

Stack: Expo 57, React Native 0.86, React 19.2.3, TypeScript 6. Four tabs in `RootNavigator.tsx`: Home, Tutor (Speak), Practice, MyFrench (Progress). Focused and metered sessions sit above tabs. Auth/profile/bootstrap gates wrap the navigator; onboarding has its own page/sheet state machine. RevenueCat/native store operations, server billing projection, LiveKit/audio, local account-scoped storage and sync are separate dependencies. No credentials were inspected or changed.

## Findings

| Priority | Evidence | User impact | Decision / acceptance |
|---|---|---|---|
| P0 | `meter.ts` and purchase contract allow only month/year; adapter only accepts configured P1M/P1Y | A Weekly-looking screen cannot sell or meter the agreed product | Add explicit week contract and authoritative 7-day windows before enabling Weekly |
| P0 | Report-approved Weekly coexists with proposed monthly/annual prices and native GBP/trial fixtures | Design could imply approval or mix currencies/allowances | Label fixtures outside UI; approve catalogue; render one storefront; annual-only trial policy |
| P1 | Existing paywall contains repeated feature/allowance explanations and multiple trial variants | More reading before a purchase decision | Compact three-duration choice; essential terms next to CTA; details on demand |
| P1 | Source guards distinguish loading, unread, empty and unavailable in DailyLibrary/Tutor/Goal/SoundJourney | Simplified designs could accidentally show empty or upsell on failed reads | Preserve those states; retry without losing draft/selection; never fabricate zeros |
| P1 | Current navigation is four tabs while App.tsx commentary still describes an older structure | Future work can regress the navigation using obsolete instructions | Update implementation documentation after approval; runtime route map is canonical |
| P1 | Profile has name/voice sheets; Settings has export/reminder/delete/legal/acknowledgements states | “Every tab” is insufficient coverage | Explicit overlay inventory and keyboard/focus tests; no buried deletion/export outcomes |
| P1 | RealMoment is Max-gated and GoalStep starts authored beginner scenes | New copy could overpromise access or a personalised curriculum | Gate before effort; personalise ordering without claiming bespoke mastery |
| P1 | 390×844 designs alone do not prove all-device behaviour | Footer clipping at large fonts/keyboard; decorative art steals space | 375pt compact proof, large-text/keyboard acceptance, safe-area constraints; scrolling when needed |
| P2 | Home/Practice/Progress have several competing destinations | Main action can disappear among cards | One leading task, secondary evidence one tap away; remove decorative labels |
| P2 | Source and Figma type roles differ for some hero sizes (native 112, Figma 88) | Translation can produce unexpected wrapping | Specify role and responsive range; do not blindly copy a pixel size |
| P2 | Friends is optional but includes invites, privacy and moderation | Social UI can interrupt learning or imply unwanted sharing | Secondary destination, explicit share action, visible block/report/privacy |

## Screen assessment rubric

`screen-inventory.md` includes a provisional 1–5 assessment vector per registered screen: **P/U/H/C/A/R/I/S/Q** = polish, usability, hierarchy, clarity, accessibility, responsiveness, interaction, consistency, perceived quality. A 3 means workable with material refinement; 4 means a strong foundation; 5 requires direct validation not available for the complete native matrix. Scores describe the current source/design baseline and are expert judgement, not measured user outcomes. Accessibility and responsive scores are provisional until VoiceOver/Dynamic Type/physical-device checks. No current screen receives an evidence-free production sign-off.

## Preserve

Account-scope generation guards, truthful billing state, saved-learning retention, text-mode alternatives, audio teardown on blur/unmount, native confirmation of purchases and destructive actions, optional permissions at point of use, age/consent requirements, and explicit empty/error distinctions. Visual freedom does not justify deleting these behaviours.
