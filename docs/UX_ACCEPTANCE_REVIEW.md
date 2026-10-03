# UX acceptance session: iPhone and French review

Prepared 3 October 2026 for the UX psychology PDF and the 100-app review.
This is a runnable review kit, not a completed device or learner study. Use the
exact candidate commit and record it below. No participant names, credentials,
conversation recordings or payment details belong in this repository.

Candidate: record the exact source commit used to build each test candidate.
The founder authorised source landing on 3 October; that does not complete
the physical or learner checks in this worksheet. Do not record a branch name
or a changing working tree as the tested revision.
iPhone is connected/trusted; iOS 27.0 was reported by devicectl. The founder
reports Expo Go opens. Developer Mode was disabled at the last device read,
and this Mac has no development signing identity. Reviewer qualification and
dated beginner findings are pending. Android: unavailable, not passed.

Source verification on 3 October: 4,231 tests pass in the full gate; typechecks
and web export pass. Browser QA observed silent onboarding, a route/goal rationale,
no fixed routine, name placeholder, mock account recovery, deliberate voice
selection, first-scene brief, usable offline Home/Practice, starting-path labels,
Settings and unavailable-plan recovery. Practice has no horizontal document
overflow at 320×568 and 768×1024, with sampled visible controls at least 44px.
Screenshots: `docs/revamp-evidence/ux-*.png`. None of these observations closes a
physical row below or validates French judgment thresholds.

## iPhone session

Connect and trust the Mac, unlock the phone and enable Developer Mode if required
by Xcode. Expo Go can preview compatible screens and local practice. Use a Luvani development build for the LiveKit microphone, interruption, screen-lock and native purchase rows. Start with local review
accounts; the authenticated storage and purchase checks require disposable
staging accounts and sandbox store configuration. Do not use a real purchase to
fill an unavailable sandbox row. An unsigned simulator build cannot prove these
hardware or store behaviors.

Record pass/fail/not run, environment and evidence for each row. Before networked
voice testing confirm the remaining approved test budget and the service setup;
do not start an unbounded conversation or enable held rollout switches.

| ID | Journey | Required observation | Result |
|---|---|---|---|
| U01 | Fresh onboarding, silent | No autoplay; French/English captions and Continue work without Hear | Not run |
| U02 | Hear, stop, back and leave | One recording at a time; audio stops; no earned tick or assessed-voice claim | Not run |
| U03 | All plan answers and restart | Actual first scene/reason persist; No fixed target remains unset; no notification request | Not run |
| U04 | Account recovery | OAuth/email/cancel/relaunch preserve or discard the draft as intended; existing account does not adopt it | Not run |
| U05 | Denied microphone | Honest explanation; typed start only when service can accept it; Back closes room | Not run |
| U06 | Speaking/typing rescue | Captions, help, slower reply, stop and editable transcript reachable; no double reply | Not run |
| U07 | Listening/thinking/failure | Announced state matches real audio; terminal failure stops meter; confirmed failure refunds actual charged minutes once | Not run |
| U08 | Ordinary stop | Live replies stop; recap/pack may finish; exit does not cancel a durable save or double charge | Not run |
| U09 | Recap to exact retry | Empty evidence pages absent; actual attempt/alternative together; saved phrase opens exact practice; save failure remains retryable | Not run |
| U10 | Local comparison | Hear model, record take, hear take and try again understandable; private take deleted on exit/background/interruption | Not run |
| U11 | Retrieval and own words | Answer withheld until attempt; recognition text editable; checked feedback is specific and remains a suggestion | Not run |
| U12 | Owned work | Collection query/page restored; packs versus saved full text clear; unread read offers retry; late account A result cannot appear in B | Not run |
| U13 | Progress | Starting path not certified placement; dated independent proof survives supported replay; quiet week has no reset/penalty | Not run |
| U14 | Preferences/privacy | Voice Hear versus select, clear routine, correction and memory controls reversible; text deletion and account deletion scopes clear | Not run |
| U15 | Unavailable plans | Local practice remains reachable; no claim paid learner is free and no duplicate-purchase advice | Not run |
| U16 | Sandbox billing | Localised full price/period, allowance, pending purchase, renewal, cancellation, refund and restore agree with server | Not run |
| U17 | Friends | Optional real challenge, no rank/points; conversation counter not a French assessment; no shared private recordings/text | Not run |
| U18 | Accessible layouts | Small phone, largest supported text, keyboard, landscape, VoiceOver, reduced motion: labels/controls/read order usable | Not run |
| U19 | Walk hardware | Explicit start, lock, interruption/phone call, Bluetooth/route changes, minute and 15-minute limits; no listening after exit | Not run, flag stays off |

Cross-check the deeper auth/export/deletion matrix in DEVICE_VERIFICATION.md,
the voice lifecycle runbook and store/hosting requirements in RELEASE_GATE.md.
Android rows remain outstanding even if every iPhone row passes.

## French reviewer session

Use consenting adults or an appropriately consented research arrangement for
learners thirteen and over. Obtain explicit consent before any recording or
upload. Prefer written observations and anonymous attempt IDs. Full conversation
text remains an app opt-in; it is not a requirement to join this study.

1. A French teacher or suitably qualified pronunciation reviewer checks each
   authored example, English gloss, mouth diagram and acoustic cue, including
   nasal vowels, French r and u/ou. Record credentials by role, scope, corrections
   and a dated sign-off. Fluent familiarity alone does not establish specialist
   pronunciation validation.
2. Observe a small exploratory group across true beginners, a few words and
   learners who can get by. Ask them to explain Hear/Record/Check, starting path,
   live minutes and saved-text choices in their own words. Record confusion as
   a defect; do not coach an answer and then count it as comprehension.
3. Collect real café task attempts: independently successful, partially done,
   supported/repeated, off-topic, wrong amount, negated, unclear recognition and
   mixed French/English. The reviewer labels the task actually achieved and
   whether the displayed quote supports it. Keep recogniser text and reviewer
   judgment distinct. No sensitive personal topics are needed.
4. Check the real utterance beside each proposed correction and Why explanation:
   accurate, preserves intent, beginner-usable, no invented fault or judgment of
   unobserved sound. Repeated playback is not a newly earned capability.
5. Review the comparison worksheet before authorising any calibration artifact.
   Record disagreements, false successes, missed successes, recogniser errors,
   coverage and limitations. Do not generate humanApproved from unit or synthetic
   examples. Jev shortcuts, new evidence selection, Why and mixed-ASR candidate
   remain off until the existing release/calibration criteria are satisfied.

| Attempt ID | Scenario/source | Support used? | Transcript reliable? | Human task result | Proposed system result | Quote/Why faithful? | Correction/action |
|---|---|---|---|---|---|---|---|
| Pending | | | | | | | |

## Measurement and upgrade experiments: R34 and R44

Use research observations for the pre-account journey. This implementation adds
no pre-account telemetry, identifier, microphone access or analytics consent
assumption. Existing authenticated events still require opt-in and contain no
free text. Observations do not imply that the current event schema measures all
of these outcomes automatically.

| Measure | Denominator and window | What counts |
|---|---|---|
| Demo understood | Consenting new testers, first onboarding visit | Explains that it is a recording and not an assessed attempt; a tap alone does not count |
| First useful French attempt | Testers deliberately starting a task, first session | Reviewer-observed relevant learner utterance/typed line; playback does not count |
| First task achieved | Those attempting that task, first session | Independently achieved authored task with reliable supporting evidence, assessed by reviewer |
| Feedback acted on | Those shown relevant feedback, same session | A fresh attempt uses that correction appropriately, not just a Hear/Next tap |
| Owned phrase retrieved | Those who durably kept a phrase, within seven days | Finds the same phrase and attempts retrieval before revealing its answer |
| Second useful visit | Enrolled testers with seven complete days of observation | A second distinct visit includes French practice; absence is reported without a penalty |
| Billing understood | Testers who choose to inspect plans, first plan visit | Correctly explains full price/period, finite live allowance and connected typing |

Record numerator, denominator, missing observations and support used. A six-person
exploratory review can reveal problems; it cannot establish conversion uplift or
calibrate pronunciation thresholds. Do not infer mastery from time, saved items,
completion animation or payment.

Only after the teaching/device/billing checks pass, compare an optional plan
offer after a useful recap with the existing voluntary Profile plan entry. The
hypothesis is better billing comprehension after experienced value, not a
predetermined revenue increase. Keep a clear free-practice exit and the same
approved prices/allowances. No forced early wall, fake time pressure or discarded
learning. No experiment is started by this document.

Before running a larger comparison, the founder approves enrolment, sample size,
observation period and analysis. Stop immediately for incorrect charge or
entitlement, private-data disclosure, unearned ability, inaccessible exit or
misleading price. Repeated learner confusion also pauses the experiment for a
design repair. Report uncertainty rather than calling a small difference a win.
