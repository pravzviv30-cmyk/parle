# Video UX implementation

Implementation of [the five-video production review](VIDEO_UX_PRODUCTION_REVIEW.md), baseline `2cbea8655b90c22fcac00412d008d4540e69954d`, 4 October 2026. The founder authorised staged implementation and delegated routine product choices. The audit and its PDF remain historical baseline evidence. This file describes the resulting code, decisions, verification and remaining work.

**Status: the report’s implementable UX changes are in the branch `codex/video-ux-implementation`. Production release remains held by the external acceptance requirements below.** No retention, addiction, fluency or conversion improvement has been measured. The video examples are evidence for design decisions, not instructions to copy manipulation or fabricated learning.

## Stage 1: truthful task availability

Removed `SessionScreen` from the application navigator. A lesson can mount only the real live session; its finish handler requires an owned authenticated account. The old simulated driver remains an unreachable development/test module. Neither an unavailable lesson nor a failed probe can silently supply a reference answer, fabricated sound observations or normal learner evidence.

Unavailable tutoring now leads to a specific bundled café task. It uses the selected tutor’s actual recording, shows the French and meaning before the action, and labels the recording as temporary and ungraded. Connection retry is a secondary control. The lesson and conversation gates scroll at small sizes. No new dependency, service, schema, pricing rule or permission was introduced.

Home and Speak share `NextTaskCard`; empty Practice uses it too. The priority is unfinished or usable personal practice, genuine scheduled review, then an available scene. Without that local material, a known exhausted trial can offer plans; unavailable tutoring offers the actual café task. Unknown billing is never converted into an exhausted trial or an invented entitlement. Owned results and navigation are guarded against account changes.

Testing a real UI save exposed legacy authored review cards which the balanced practice selector intentionally does not treat as personal exercises. The shared card now recognises their actual due review separately. It shows French without exposing the hidden meaning before the review. A saved review action remains available offline and before a used-trial gate. Duplicate review links on Home and empty Practice were removed.

## Stage 2: less setup, genuine first value

The pre-account journey has five named setup pages: recorded exchange, authored reply choice, starting level, plan and save. A learner can silently choose coffee or water, receive relevant authored guidance and request help. The response is explicitly unassessed. It does not record voice, award mastery, write a learning record or send free text to an AI service. The choice is temporary screen state; setup choices continue to use the existing local draft.

Name and conversation-goal questions moved out of required setup; their Profile controls remain. Older drafts on the retired reason page resume at Plan and retain existing answers, name, routine, tutor and consent. No learner data migration or deletion was needed.

The plan leads with actual scene outcomes and the reason for the suggested start. Routine and tutor are editable compact controls. Fresh zero-level setup suggests five minutes; no fixed target remains an explicit option. Non-certified/non-tailored scope and method are in named details, and trial allowance remains derived from configuration. The inactive reminder clock is absent from setup. Analytics defaults off, AI/raw-audio information remains visible, and explicit age confirmation/refusal remains before account creation.

A learner reporting that they can get by may start at the authored café scene while the underlying beginner spine stays unearned. Starting-point selection stays visible and editable until the learner taps Continue; the choice animation cannot skip the page. Actual unfinished work takes priority. A self-report never earns an A1 certificate or scene completion. Setup ordinals say `Setup n of 5`, separate from learning evidence.

## Stage 3: task, result and navigation hierarchy

Scene briefs and the first-scene primer place outcome and one real French model before artwork. More examples and listening are optional. The blue brief uses a white brand/header foreground. Its microphone and live-minute notice sits beside Start; the chooser states that connected speaking and typing consume live minutes. Duplicate introductory prose was cut. On the 320 × 568 web view, the complete model is visible above the fixed start area and remaining content can scroll.

The first recap result now shows the actual kept French and translation with truthful saving status and retry. Practice is offered only after its save is confirmed. The saved message explicitly says this phone; it does not assert that another device has reconciled. The learner’s lines, sound, next scene and optional details remain reachable. Counts and illustrations no longer delay the useful phrase.

Correction retries have no learner countdown. Request timeouts, aborts, account ownership and lifecycle cleanup remain. Failed or blank transcription preserves the existing typed draft, and temporary retry recordings are discarded. A three-minute regression scenario reproduces the original expiry and passes with the new deliberate-exit behavior.

Primary navigation is Home, Speak, Practice and Progress. Friends is an optional Profile route with its existing URL, privacy, invitations, requests, moderation and challenges. A cold Friends link exits to Tabs when there is no stack to return through; normal Profile entry returns to Profile. Testing caught and fixed the otherwise circular cold-link fallback.

Empty Progress offers a usable local first task, with no invented achievement. A genuinely earned result can lead with mint evidence; a quiet scene-path row replaces a second competing blue level card. Saved-but-unrecalled phrases keep that explicit distinction.

## Stage 4: retrieval and copy

At twelve saved entries, Phrasebook adds local French/English search. Search ignores accents and equivalent curly apostrophes, requires all query words, and never changes stored phrases, recall evidence or source groups. Twelve is an implementation starting point, not a measured usability threshold. Small libraries keep a simpler surface. Search hides unrelated exercises; a miss shows an honest no-results message. A saved-only library no longer displays a first-phrase empty prompt. Audio availability, source context and the distinction between deleted history and retained learning remain intact.

The following ledger accounts for all forty source-checked rows in the report. A retained or relocated line is deliberate; shorter copy is not a reason to conceal processing, assistance, failed persistence or billing.

| # | Report row | Implemented decision |
|---|---|---|
| 1 | Welcome benefit | `Try ordering a coffee.` |
| 2 | Example instruction | Replaced passive saying prompt with the actual authored question, `Which reply orders a coffee?`; playback remains optional. |
| 3 | Example scope | `Try this line. Nothing is recorded or assessed here.` |
| 4 | Extra playback reassurance | Removed from the rendered choice page; Continue remains enabled without audio. Legacy constant is harmless retained data. |
| 5 | Worked demo scope | `Example feedback. Your French is not assessed.`; optional demonstration remains reachable. |
| 6 | Choice hint | `You can change this later.` |
| 7 | Optional name | Removed the setup field; optional name editing stays in Profile and old drafts retain it. |
| 8 | Routine heading | `Daily practice`, compact and editable. |
| 9 | Routine allowance distinction | `Practice goal, separate from live minutes.` |
| 10 | Beginner coverage | Short visible suggestion plus full non-certified/non-tailored scope in Route details. |
| 11 | Goal context | Deferred question; legacy context says scene order stays the same. |
| 12 | Inactive reminder | Removed setup row. Offer comes after useful recap; Settings remains available. |
| 13 | First-scene permission/cost | One compact notice by Start; connected typing is still metered. |
| 14 | Examples | `More examples`. One model remains visible. |
| 15 | Empty Practice purpose | `A short first practice.`; populated personal practice keeps its contextual purpose. |
| 16 | Scheduled review source | `Phrases due for review.`; only genuine due review qualifies. |
| 17 | Resume | Retained `Pick up where you stopped.` for actual resumable work. |
| 18 | Recall result | `You recalled some phrases without choices.` |
| 19 | Scheduling consequence | `These phrases will return in review.` |
| 20 | Save failure | `Practice was not saved on this phone.` |
| 21 | Save retry | `Retry save`. Payload/operation preserved. |
| 22 | Typing preference | `Start by typing. You can still speak. Tutor audio stays on.` |
| 23 | Correction retry | `Try again, keeping the corrected part.` |
| 24 | Transcript | `Check the transcript, then tap Check.` |
| 25 | Correction scope | `Text check only. This retry is not saved.` |
| 26 | Correction success | Retained `That fixes the part we practised.` |
| 27 | Minute expiry | Removed timer behavior and expiry message together. |
| 28 | Friends repeated purpose | Short secondary purpose: `Optional shared practice.` |
| 29 | Friends heading | `Practise with a friend.` |
| 30 | Friends setup body | Username then invitation described; recordings/text privacy remains a separate visible sentence. |
| 31 | Challenge idea/counter | Short café idea; counter still says conversations completed rather than task passes. |
| 32 | Friends action | Retained `Set up Friends`, because it opens setup before inviting. |
| 33 | Friends privacy | `Friends privacy`; existing policy route retained. |
| 34 | First-value playback | Retained `Hear the exchange`. |
| 35 | First-value help | Retained `I'm stuck`; assistance remains explicit. |
| 36 | Age/account | Explicit 13-or-older account action and refusal retained. |
| 37 | Trial | Derived `30 free minutes, no card needed`; no invented time-limited trial. |
| 38 | Days off | Retained `A day off takes nothing away.` where useful. |
| 39 | Practice help | Retained `Show the phrase`; helped work remains distinct from recall. |
| 40 | Friends zero state | Retained `No points this week`; no invented starting credits. |

The useful-result reminder now has Change time and the existing four labelled presets before opt-in. It retains Not now, permission refusal, save/schedule failure and later Settings editing. No OS prompt occurs merely by opening recap or changing its draft time. Pending permission/save cannot schedule for a different account or update an exited recap. The reminder remains the product’s fixed, gentle daily notification; it carries no progress, guilt or private French on a lock screen. Physical notification delivery, time-zone changes and disabling still require device acceptance.

Plans already implement the report’s truthful comparison: full store price and period, monthly minutes, illustrative conversation counts, the actual allowance, cancellation reassurance and restore. These were preserved. No default paid recommendation, fabricated popular badge, false anchor or urgency was added. Real store comprehension and entitlement/restore testing remain required; the web unavailable state cannot prove them.

## Stage 5: colour and motion

The existing warm paper, Outfit typography and accessible saturated palette remain the identity. Blue leads usable personal practice and scheduled review; sun leads the genuinely available local café task. The scene brief is blue with a white reading card. Mint is reserved for real earned evidence. French/English foregrounds now respect their sun/mint grounds. Lists and Settings stay calm. No arbitrary hex colours, gradients, glows, extra illustration set or animation package was needed.

All eight motion specifications have an implementation or a retained existing authority:

| ID | Treatment and trigger | Truth/fallback |
|---|---|---|
| M01 | 200 ms settle on a changed OptionRow check mark. | A default selection does not play a fake achievement; immediate selected/accessibility state. |
| M02 | 260 ms context response to the actual setup scene/routine summary. | No pretend plan generation, delayed result or awarded learning. |
| M03 | 440 ms settle on confirmed save status, with a bounded once-per-recent-kept-phrase haptic. | French and translation stay still; pending/failed save cannot trigger success; local save wording. |
| M04 | Existing OnceConfetti, bounded to 650 ms and first independently earned scene result. | Real core evidence gates it; reduced motion shows existing static earned result. |
| M05 | 320 ms response after durable practice completion. | Local take remains ungraded; failed sitting persistence has retry and no success treatment. |
| M06 | 200 ms explicit help reveal. | Assistance is recorded accurately and never removes a reward or shames a learner. |
| M07 | 260 ms phrase-library response on deliberate reopening. | Account-scoped recent-event deduplication; search rerender cannot replay it; failed read shows retry. |
| M08 | Existing orb driven by actual capture, audio and request lifecycle. | No fake listening, idle recording waveform or decorative tutor loop. |

`Feedback` animates opacity and at most four points of translation, never layout or an imposed delay. The engine assumes reduced motion conservatively until known. Reduced-motion changes, navigation blur, unmount and background/inactive state stop new motion and settle to the final visible content. Recent event identifiers stay in bounded session memory and are never persisted or transmitted. Existing press/haptic behavior remains. There is no claim of measured native frame performance; timings are production-candidate starting values for the device matrix.

## Disposition of all report findings

“Implemented” means code and local verification, not certified launch acceptance. Findings that depend on physical devices, representative people or external services keep their evidence requirements.

| Finding | Disposition |
|---|---|
| F01 | Implemented: simulated speech is absent from application navigation; real lesson/auth/ownership guard; genuine local alternative. |
| F02 | External release hold: existing launch/trust gate remains unticked; no fabricated release proof. |
| F03 | Implemented: silent authored choice task and honest guidance before signup. Beginner comprehension and qualified French review remain. |
| F04 | Implemented: outcome-led compact plan, editable routine/tutor, optional details, no inactive clock. |
| F05 | Implemented: conversation goal deferred; neutral common route; legacy answers preserved. |
| F06 | Implemented: five Setup ordinals; self-report and authored choice never create learning credit. |
| F07 | Implemented: no setup name field; explicit consent, AI processing, age/refusal and sign-in remain. Real provider/device journeys remain. |
| F08 | Implemented: known reversible tutor/routine/starting-scene defaults, visible change/no-target controls; no paid or analytics default. |
| F09 | Implemented: shared owned next action and real due review; actual saved-work priority exercised. |
| F10 | Implemented: unavailable tutor and failed probes offer the selected tutor’s bundled ungraded café line. |
| F11 | Implemented: compact chooser, focused French-first brief, optional extra examples, smaller art, truthful Start notice. |
| F12 | Implemented: ground-aware header/French/proof foregrounds and clear task-first hierarchy. |
| F13 | Implemented: exact kept phrase, translation, durable save state/retry on the first recap result; count/art follow. Live/native recap acceptance remains. |
| F14 | Implemented: deliberate exit instead of countdown; failed transcription preserves draft; request/lifecycle cancellation retained. |
| F15 | Implemented: useful empty Progress task and independently earned proof ahead of level prominence. |
| F16 | Implemented: Friends is a secondary Profile route; URLs/features retained, cold-link back loop fixed. Findability research remains. |
| F17 | Implemented: conditional local retrieval and honest populated/no-results states; historical evidence/deletion semantics preserved. Representative learner retrieval study remains. |
| F18 | Implemented: setup clock removed; recap offer has editable time, skip and explicit opt-in; account-safe pending flow. Native delivery acceptance remains. |
| F19 | Existing fair billing UI retained; unknown prices/status remain unknown. Native purchase/restore and comprehension evidence remain release work. |
| F20 | Local recovery safeguards retained/improved; recap explicitly confirms local save; existing sync remains connected. Deployed export, migration, restart and two-device reconciliation evidence remain. |
| F21 | Local labels, contrast, scroll, motion and cancellation checked. Physical VoiceOver/TalkBack, large text, permissions, interruption and frame behavior remain release work. |
| F22 | Implemented: contextual empty/personal/saved wording and current README, state map, onboarding and design documentation. |
| F23 | Implemented: all forty ledger rows addressed above, preserving consequential information. |
| F24 | Implemented/retained M01–M08 with bounded motion, real triggers and static fallbacks; native runtime acceptance remains. |
| F25 | Implemented within current accessible tokens; one useful colour focus rather than colouring every row. User/vision/performance evaluation remains. |

## Verification and evidence

Final frozen checks passed: `npm run gate` (4,250 tests: core 711, brain 464, tutor-agent 538, token-server 298, brain-playground 26, mobile 2,213), `npm run build:web`, the working-tree secret scan and the 2,432-file bundle secret scan. The dependency audit passed under the repository’s existing documented exceptions: zero critical, 21 high and 12 moderate advisories; this is not a zero-vulnerability claim. Dependencies and lockfile are unchanged. Graphify completed in AST mode with 10,602 nodes, 27,237 edges, no duplicate node IDs and no dangling edges; its missing SQL parser and 21 node-empty source files remain recorded tool limitations. Compact receipts and exact bundle hashes are in [validation.json](../output/video-ux-implementation/validation.json) and adjacent text receipts. No test floor, ledger checkbox or dependency lock was changed to manufacture a pass. Existing source-layout contracts were updated for the actual new structure; meaningful tests cover choice guidance, legacy draft repair, real offline recordings, next-action priority, draft preservation, account-safe reminder waits, retrieval and bounded event handling.

The browser journeys use synthetic development identities on isolated localhost ports. The twelve-entry library was authored fixture material without recall grades, completed scenes or actual spoken-use evidence. The temporary bootstrap was removed, the original entry restored byte-for-byte, and the ordinary app was cold-reloaded successfully. No real account agreement, purchase, microphone/notification permission, invitation or deletion was performed.

Observed at 390 × 844 and/or 320 × 568: silent choice/wrong choice/help; editable starting point with explicit Continue; editable plan/no target; explicit disclosures; empty local first task; same saved-review lead across Home/Speak/empty Practice; real review entry and leaving without a grade; Profile/Friends normal and cold-link navigation; focused scene/task ordering; offline lesson; French/English/accent search and no results. Selected small-screen checks had zero horizontal control overflow. A final ordinary cold boot had no new error log after reload. Earlier development hot-reload errors from fixture/module-shape changes are not hidden or presented as production defects; cold reload was used for final verification.

Images are in [the implementation evidence folder](../output/video-ux-implementation/). Screenshots establish the rendered web states, not native permissions, speech assessment, store purchases or accessibility certification. Recap and native-only reminder behavior have source/regression coverage here; their complete live/native journey is still an external acceptance item.

## Remaining release work and branch ownership

[RELEASE_GATE.md](RELEASE_GATE.md), the existing device runbook and [UX acceptance review](UX_ACCEPTANCE_REVIEW.md) remain authoritative. Required evidence includes physical iOS/Android and assistive technology, qualified French review, genuine provider sign-in/recovery, live audio/assessment/reconnect, store purchase/renewal/cancellation/restore, exact deployed migration/export/deletion behavior, two-device sync, reviewed vendor retention/policies and operational ownership. Missing evidence remains a release hold. No public launch, policy approval, purchase, deployment or publication was performed.

The canonical checkout `/Users/pravz_07/Documents/StartUps/Luvani` is on another active branch with substantial unrelated uncommitted work. This implementation stays in its isolated worktree and branch. It must not overwrite, stash, sweep into a commit or merge that other session’s work. Local checks used this worktree’s installed dependencies with all workspace suites/count floors, not the canonical checkout’s in-progress tree. Landing/release remains **HOLD** until coordinated integration and exact-release checks are complete.
