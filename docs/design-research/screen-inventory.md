# Screen inventory and coverage

Source: current `apps/mobile/src/nav/RootNavigator.tsx` and `nav/types.ts`, plus conditional source states. Tabs is a navigator container, not a separate user screen. Scores are provisional source/design judgements described in `app-audit.md`, ordered P/U/H/C/A/R/I/S/Q. No all-device claim is implied.

| Registered screen | Current assessment | Change | Figma reference | Required state coverage |
|---|---|---|---|---|
| Home | 3/4/3/3/3/3/4/4/3 | Evolve | [B-home](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=121-655) | first visit, returning, loading, offline, unread |
| Tutor | 4/4/4/4/3/3/4/4/4 | Refine | [app-tutor](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-2711) | voice preview, history loading/unread, no allowance, start refusal |
| Practice | 3/4/3/3/3/3/4/4/3 | Evolve | [B-practice](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=121-671) | due, empty, own words, mixed deck, saved conversation |
| MyFrench | 3/4/3/3/3/3/4/4/3 | Evolve | [B-progress](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=121-672) | earned, no evidence yet, loading, unread |
| Profile | 4/4/4/4/3/3/4/4/4 | Refine | [profile](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-5675) | name edit, voice choice, pending save, error |
| Friends | 4/4/4/4/3/3/4/4/4 | Refine | [B-friends](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=121-673) | empty, requests, list, report/block, offline |
| AddFriends | 4/4/4/4/3/3/4/4/4 | Refine | [friends-invite](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-6353) | invite/share, username search, no match, request pending |
| SocialSettings | 4/4/4/4/3/3/4/4/4 | Refine | [friends-privacy](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-1542) | privacy choices, save failure |
| DailyPractice | 4/4/4/4/3/3/4/4/4 | Refine | [practice-phrase](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4330) | hear, shadow, record, playback, permission denied, missing item |
| DailyLibrary | 3/4/3/3/3/3/4/4/3 | Evolve | [B-daily-library](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=121-666) | Saved/Words/Phrases, query, no match, empty starters, unread, pagination |
| Postcards | 4/4/4/4/3/3/4/4/4 | Refine | [postcards](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-5304) | list, detail, empty, unread, share |
| WeekWrapped | 4/4/4/4/3/3/4/4/4 | Refine | [week-wrap](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-5126) | earned summary, no evidence, unread |
| Streak | 3/4/3/3/3/3/4/4/3 | Evolve | [B-streak](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=121-667) | current run, calendar, freeze, repair, milestones, unread |
| Settings | 4/4/4/4/3/3/4/4/4 | Refine | [settings-main](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-5783) | reminder, export, delete, acknowledgements, policy/terms, intro |
| Lesson | 4/4/4/4/3/3/4/4/4 | Refine | [live-listen](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-3740) | connecting, active, pause, reconnect, end, summary |
| Convo | 3/4/3/3/3/3/4/4/3 | Evolve | [B-live](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=121-657) | listen/speak/think, text/help, pause, leave, error, real recap |
| Drill | 4/4/4/4/3/3/4/4/4 | Refine | [practice-shadow](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4406) | node/mix/ownWords/pack, recording, result, retry |
| Review | 4/4/4/4/3/3/4/4/4 | Refine | [review-card](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4690) | due, empty, reveal, next, finished |
| SoundCheck | 4/4/4/4/3/3/4/4/4 | Refine | [practice-sound](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4534) | primer, record, measured result, unmeasured, failed |
| SoundJourney | 3/4/3/3/3/3/4/4/3 | Evolve | [B-sound-journey](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=121-670) | history, none, unread, details, rehear/retry |
| GoalStep | 3/4/3/3/3/3/4/4/3 | Evolve | [B-goal](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=121-668) | next authored scene, trail, deleted goal, unread |
| Missions | 4/4/4/4/3/3/4/4/4 | Refine | [scenes](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-3082) | catalogue, selected scene, text mode, cold link |
| FirstScene | 4/4/4/4/3/3/4/4/4 | Refine | [onboard-mic](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-2114) | primer, consent/permission, text alternative |
| RealMoment | 3/4/3/3/3/3/4/4/3 | Evolve | [B-real-moment](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=121-669) | Max-owned, locked, checking, failed access, selection/draft, start refused |
| TutorMemory | 4/4/4/4/3/3/4/4/4 | Refine | [tutor-memory](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-3002) | facts/goals, edit, forget, loading/error |
| TutorIntro | 4/4/4/4/3/3/4/4/4 | Refine | [tutor-voices](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-2833) | explanation and voice selection; shared pattern, not exact route replica |
| Phrasebook | 4/4/4/4/3/3/4/4/4 | Refine | [practice-phrase](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4330) | list/search/detail, empty, no match, unread; shared pattern |
| Conversations | 4/4/4/4/3/3/4/4/4 | Refine | [practice-conversations](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4765) | library, filters, saved pack, delete, missing pack |
| SavedConversationText | 4/4/4/4/3/3/4/4/4 | Refine | [conversation-saved](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4800) | text list/detail, no data, unread; shared pattern |
| ConversationPractice | 4/4/4/4/3/3/4/4/4 | Refine | [practice-recorded](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4453) | pack drill, missing pack, resume/result; shared pattern |
| Wall | 3/4/3/3/3/3/4/4/3 | Reimagine | [B-paywall](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=121-656) | offers, eligibility, purchase, restore, all subscription lifecycle states |
| Policy | 4/4/4/4/3/3/4/4/4 | Retain | [policy](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-3327) | full document, back/link |
| Terms | 4/4/4/4/3/3/4/4/4 | Retain | [terms](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-3418) | full document, back/link |

## Conditional and overlay screens

| Surface | Designs / pattern | Required behaviour |
|---|---|---|
| Auth bootstrap/profile adoption | loading/recovery shell | Never show previous account data; retry failed reads |
| Sign in / sign up / password reset | sign-in, sign-up, password-reset, reset-sent | validation, keyboard, pending, failure, user-controlled submission |
| Set-new-password / partial device-erasure notice | B-password-new / B-account-erased | expiry, invalid link, successful change; partial local erase warning; no false signed-in state |
| Pre-account onboarding | existing 16-screen story and new B welcome | coffee/tea, reason, level, time, plan, voice, age, consent, microphone, practice, recap, reminder, save |
| Onboarding sheets | existing voice/privacy/reminder patterns | plan edit, hear sample, help, opt-in, back/dismiss; preserve draft |
| Profile sheets | profile-edit, tutor-voices | name/voice; cancel and save distinction |
| Settings sheets | reminder/time/privacy/account/delete plus shared utility patterns | export pending/ready/error, acknowledgements; system permission handoff |
| Live overlays | live-help/type/paused/leave-live/failed | separate controls, text input, keyboard, reconnect, explicit leave |
| Learning feedback | sound-result, recap-line/earned/next | factual measured results; no fabricated praise before completion |
| Social overlays | requests, friend-detail, report-review | explicit report/block, cancel, success/failure; no auto-send |
| Purchase lifecycle | existing full state set + new Weekly series | unknown/partial, pending, verification, cancellation, restore, grace/retry/lapsed/revoked |

Coverage distinction: references labelled “shared pattern” specify the shell and behaviour, not a pixel-complete bespoke rendering of every conditional combination. Those remain implementation acceptance items; the file is a design blueprint, not proof of production readiness.

## Existing editable state index

The existing detailed flow remains in “Play the app”. New alternatives are on “Design evolution · October 9 · approval”. Historical Weekly frames remain as before-evidence; use the new B Weekly series for the adopted brief.

- [onboard-welcome](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-1480)
- [onboard-goal](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-1558)
- [onboard-level](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-1689)
- [onboard-voice](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-1756)
- [onboard-scene](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-1866)
- [onboard-age](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-1955)
- [age-refusal](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-1995)
- [onboard-privacy](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-2042)
- [onboard-mic](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-2114)
- [onboard-save](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-2162)
- [app-home](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-2242)
- [home-first](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-2384)
- [home-offline](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-2528)
- [home-loading](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-2630)
- [app-tutor](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-2711)
- [tutor-voices](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-2833)
- [tutor-memory](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-3002)
- [memory-removed](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-3041)
- [scenes](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-3082)
- [scene-cafe](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-3339)
- [scene-hotel](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-3416)
- [scene-market](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-3499)
- [scene-directions](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-3610)
- [live-connecting](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-3671)
- [live-listen](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-3740)
- [live-speak](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-3820)
- [live-thinking](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-3904)
- [live-paused](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-3973)
- [live-help](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4051)
- [live-type](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4101)
- [leave-live](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4134)
- [live-failed](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4158)
- [practice-home](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4200)
- [practice-phrase](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4330)
- [practice-shadow](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4406)
- [practice-recorded](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4453)
- [practice-sound](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4534)
- [sound-result](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4579)
- [practice-review](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4643)
- [review-card](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4690)
- [practice-conversations](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4765)
- [conversation-saved](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4800)
- [progress-home](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4839)
- [progress-empty](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-5007)
- [week-wrap](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-5126)
- [postcard](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-5220)
- [postcards](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-5304)
- [recap-line](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-5435)
- [recap-earned](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-5509)
- [recap-next](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-5593)
- [profile](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-5675)
- [profile-edit](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-5756)
- [settings-main](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-5783)
- [settings-notifications](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-5863)
- [settings-time](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-5931)
- [settings-sound](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-5972)
- [settings-privacy](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-6019)
- [settings-account](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-6090)
- [delete-account](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-6142)
- [friends-home](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-6168)
- [friends-empty](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-6256)
- [friends-requests](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-6318)
- [friends-invite](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-6353)
- [friends-find](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-6418)
- [friend-detail](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-1480)
- [friends-privacy](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-1542)
- [friend-report](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-1576)
- [report-review](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-1611)
- [sign-in](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-1639)
- [sign-up](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-1682)
- [password-reset](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-1730)
- [reset-sent](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-1753)
- [policy](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-3327)
- [terms](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-3418)
- [first-recap](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-3440)
- [home](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-3476)
- [later-recap](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-3547)
- [locked](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-3583)
- [welcome-empty](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-3618)
- [free-settings](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-3657)
- [reinstall](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-3709)
- [yearly-trial](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-3763)
- [monthly](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-3864)
- [weekly](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-3955)
- [yearly-paid](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-4047)
- [yearly-unknown](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-4138)
- [unselected](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-4230)
- [max](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-4317)
- [return](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-4391)
- [two-offer](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-4482)
- [partial-offers](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-4574)
- [offers-loading](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-4658)
- [offers-unavailable](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-4699)
- [store-opening](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-4744)
- [confirming](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-4782)
- [pending](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-4826)
- [checkout-cancelled](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-4871)
- [payment-failed](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-4964)
- [slow-verify](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5056)
- [restore-found](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5100)
- [restore-none](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5144)
- [restore-linked](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5182)
- [restore-offline](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5220)
- [success-trial](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5258)
- [success-weekly](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5306)
- [success-monthly](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5347)
- [success-yearly](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5388)
- [success-max](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5430)
- [paid-empty](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5471)
- [trial-empty](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5513)
- [max-empty](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5551)
- [manage-trial](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5586)
- [manage-weekly](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5638)
- [manage-monthly](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5690)
- [manage-yearly](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5742)
- [manage-max](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5794)
- [cancelled-paid](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5846)
- [cancelled-trial](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5898)
- [grace](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5950)
- [retry](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5995)
- [lapsed](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-6037)
- [revoked](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-6079)
- [status-unknown](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-6121)
- [change-scheduled](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-6163)
- [change-review](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-6201)
- [reminder-scheduled](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-6238)
- [reminder-denied](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-6275)
- [reminder-off](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-6313)
- [metering](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-6351)
- [billing-reminder](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-6413)

## New review frames

- [A-onboarding](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=121-650)
- [A-home](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=121-651)
- [A-paywall](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=121-652)
- [A-live](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=121-653)
- [B-onboarding](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=121-654)
- [B-home](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=121-655)
- [B-paywall](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=121-656)
- [B-live](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=121-657)
- [B-monthly](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=121-658)
- [B-yearly](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=121-659)
- [B-weekly-success](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=121-660)
- [B-weekly-manage](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=121-661)
- [B-weekly-pending](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=121-662)
- [B-weekly-empty](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=121-663)
- [B-weekly-cancelled](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=121-664)
- [B-weekly-failed](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=121-665)
- [B-daily-library](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=121-666)
- [B-streak](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=121-667)
- [B-goal](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=121-668)
- [B-real-moment](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=121-669)
- [B-sound-journey](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=121-670)
- [B-practice](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=121-671)
- [B-progress](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=121-672)
- [B-friends](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=121-673)

## Additional current detailed states

- [app-start](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=99-3210)
- [onboard-coffee](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=99-3341)
- [onboard-tea](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=99-3455)
- [onboard-time](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=99-3775)
- [onboard-guest-first](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=99-4250)
- [onboard-first-recap](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=99-4295)
- [onboard-reminder](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=99-4364)
- [onboard-trip-practice](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=99-4523)
- [onboard-trip-recap](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=99-4568)
- [max-monthly](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=99-6368)
- [compare-plans](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=99-6426)
- [trial-details](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=99-6453)
- [compare-plans-monthly](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=99-6481)
- [monthly-trial-details](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=99-6508)
- [max-trial-details](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=99-6536)
- [max-monthly-trial-details](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=99-6564)
- [monthly-paid](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=102-6623)
- [max-paid](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=102-6670)
- [max-monthly-paid](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=102-6718)
- [compare-plans-paid](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=102-6766)
- [compare-plans-paid-monthly](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=102-6792)

## Added utility/recovery frames

- [B-password-new](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=125-7158)
- [B-account-erased](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=125-7159)
- [B-export](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=125-7160)
- [B-acknowledgements](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=125-7161)
- [B-goal-missing](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=125-7162)
- [B-collection-no-match](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=125-7163)
- [B-read-failed](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=125-7164)
- [B-access-unknown](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=125-7165)

## Completed subscription lifecycle extension

- [B-compare](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=130-1364)
- [B-max](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=130-1365)
- [B-monthly-pending](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=130-1366)
- [B-monthly-success](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=130-1367)
- [B-yearly-pending](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=130-1368)
- [B-yearly-success](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=130-1369)
- [B-yearly-paid](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=130-1370)
- [B-yearly-unknown](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=130-1371)
- [B-restore-none](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=130-1372)
- [B-restore-offline](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=130-1373)
- [B-max-pending](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=130-1374)
- [B-max-success](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=130-1375)
- [B-weekly-grace](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=130-1376)
- [B-weekly-lapsed](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=130-1377)
- [B-weekly-revoked](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=130-1378)
- [B-weekly-unknown](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=130-1379)
- [B-monthly-manage](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=133-1541)
- [B-yearly-manage](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=133-1542)
- [B-max-manage](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=133-1543)
- [B-yearly-paid-pending](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=133-1544)
- [B-yearly-paid-success](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=133-1545)
