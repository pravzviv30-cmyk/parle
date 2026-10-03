# Luvani design review across 100 apps

3 October 2026. This is the dated research and recommendation record. An
implementation pass later on 3 October changed the local screens; the proposal
table below remains the original audit, not a current to-do list. See
[REVAMP_B_CONTINUATION.md](REVAMP_B_CONTINUATION.md) for implementation and
verification limits.

The local pass now puts Practice's exact next action before an optional sound
example, labels the first recorded reply as a demonstration and offers a worked
practice example on request, and makes the suggested routine editable. Recap
pages appear only when their lines, saved phrase, sound check, earned can-do or
next action exist; a correction can be tried from the recap. Progress links
earned claims to available evidence. Account and privacy copy was revised at
the action it describes. These are code and local-test observations; physical
audio, native accessibility, actual French calibration and hosted integrations
retain their separate holds.

Luvani's strongest direction is a warm, recognisably French learning product that makes small improvements visible. Its paper, ink, Outfit type and original drawings already support that direction. The missing distinction is a clearer connection between **what I tried, what needs practice and what I can now do**.

## Evidence and limits

I visually inspected **300 published iPhone screenshots from 100 distinct apps**, selected as first, middle and last listed images before inspection: 40 language/learning, 18 AI/language utility, 25 wellbeing/daily practice and 17 consumer navigation/trust references. **21 appeared in Apple's UK top 100 free chart** retrieved on 3 October; the other 79 are selected relevant peers, not chart leaders. The AI group includes consumer-accessible work tools. This is a comparison of published depictions, not 100 installed-app walkthroughs, a ranking of quality or validation of marketing claims. Some imagery is dated, including Rosetta Stone Classic and Falou. [Apple chart](https://rss.marketingtools.apple.com/api/v2/gb/apps/top-free/100/apps.json).

The [100-row reference inventory](REVAMP_B_100_APP_REFERENCES.csv) records each source, observation, lesson, screenshot indices and hashes. The [visual index](revamp-evidence/app-reference-panels/README.md) opens all ten preserved panels; the [manifest](revamp-evidence/100-app-manifest.json) preserves image metadata.

For Luvani I inspected the then-current anonymous onboarding through its unsubmitted name form, existing 390 × 844 local review captures of Practice, Shadowing, Profile, Friends and voice selection, and the [simulator Home capture](revamp-evidence/audit-current-native-home.png). These are development states, not production accounts. Fresh evidence includes [first French exchange](revamp-evidence/audit-current-onboarding.png), [first line result](revamp-evidence/audit-current-first-line-finished.png), [plan](revamp-evidence/audit-current-plan.png) and [name form](revamp-evidence/audit-current-save-plan.png). Source checks clarified the authored Practice fallback. Those captures precede the local implementation noted above.

## 1 Where Luvani still feels generic or mismatched

The first French exchange and three concrete café/hotel steps are good product previews. Elsewhere, a large coloured card can take precedence over useful content. Practice's mouth guide occupies much of the first viewport; the learner's immediate task and saved work deserve earlier visibility. “Your sound to tune” can suggest a personal diagnosis, although the existing café-source subtitle correctly qualifies the default authored lesson. Make that distinction more prominent.

The onboarding's recorded reply is a demonstration. “A marked line is one you have made yours” after tapping it can imply independent learning evidence. Home and Progress should clearly distinguish trying, saving, guided completion and demonstrated ability. Friends' “Your circle starts with one friend” is warm but could belong to almost any social app; a named shared French task would establish purpose.

## 2 Patterns from the strongest relevant references

The most useful pattern is a visible learning loop: a situational attempt, feedback on the actual words, then targeted review. [Speak](https://apps.apple.com/gb/app/speak-language-learning/id1286609883?uo=4), [Langua](https://apps.apple.com/gb/app/langua-ai-language-learning/id6737520234?uo=4) and [Speechling](https://apps.apple.com/gb/app/speechling-learn-any-language/id1239983313?uo=4) depict parts of this loop. [Mango](https://apps.apple.com/gb/app/mango-languages-learning/id443516516?uo=4) and [French Today](https://apps.apple.com/gb/app/french-today-audiobook-player/id1141277436?uo=4) make listening/comparison controls explicit. These depictions do not validate scoring accuracy.

Substantive French content conveys credibility: reading and vocabulary in context in [LingQ](https://apps.apple.com/gb/app/lingq-learn-languages/id379385811?uo=4), authored cultural exercises in [Frantastique](https://apps.apple.com/gb/app/learn-french-with-frantastique/id614603569?uo=4). Calm hierarchy in [Things 3](https://apps.apple.com/gb/app/things-3/id904237743?uo=4), purposeful illustration in [Headspace](https://apps.apple.com/gb/app/headspace-sleep-meditation/id493145008?uo=4) and categorical colour in [How We Feel](https://apps.apple.com/gb/app/how-we-feel/id1562706384?uo=4) show different ways to make a product feel considered. The synthesis is clear purpose and consistent craft, not copying their screens.

## 3 Recommended direction and hierarchy

Keep warm paper, ink and Outfit. Preserve blue for scenes, coral for recap, sun for sound/plan and mint for earned completion; use lilac within original artwork. Put more colour into relevant scene illustrations and clearly labelled state details while retaining the existing contrast rules. Let the French phrase, its audio and its action lead; colour should help explain the task.

Keep five tabs with distinct jobs: **Home** continues today's useful task; **Speak** selects the next situation; **Practice** retries saved work; **Progress** explains actual evidence; **Friends** supports a shared challenge. Profile holds preferences and account controls. Preview a complete, labelled café example through attempt → correction → retry → saved phrase, before asking for commitment. State the present A0/A1 scope honestly.

Trust should come from precise controls and inspectable examples. Show what is recorded, processed, saved and deletable beside the relevant action. The name form's “No person hears you” and absolute other-purpose assurance need verification against actual vendor terms and operations before reuse. Naming vendors elsewhere does not substantiate those absolutes. Use factual processing language; identify recordings, AI suggestions and human-reviewed content distinctly. [DeepL's alternatives](https://apps.apple.com/gb/app/deepl-translate/id1552407475?uo=4) illustrate user agency; [Monzo's settings](https://apps.apple.com/gb/app/monzo-bank-mobile-banking/id1052238659?uo=4) illustrate visible controls, not transferable financial assurances.

## 4 Specific proposed changes

| Priority | Proposed change | Why |
|---|---|---|
| First | Put attempt, correction and one next retry together in the recap | Makes the session's value visible |
| First | Label the onboarding exchange as a demonstration; revise its mastery implication | A playback tap is not independent ability |
| First | Lead Practice with a compact next task; move the full mouth guide into its detail | Useful actions appear earlier |
| First | Promote “From the café lesson” versus actual measured evidence | Avoids implying an unperformed assessment |
| First | Review absolute privacy copy against real processing and retention | Creates credible, supportable trust |
| Next | Show a dated scene/attempt behind each earned capability | Explains progress; keep uncalibrated evidence features off |
| Next | Group saved phrases by situation with the existing review queue | Helps learners retrieve usable French |
| Next | Add context-specific original scene art and restrained colour details | Adds richness within the established identity |
| Next | Replace general Friends encouragement with the next shared French task | Gives collaboration a learning purpose |
| Next | Preview the full teaching loop and explain A0/A1 coverage and real audio modes | Sets accurate expectations before commitment |

## 5 AI-like writing and design to revise

Interchangeable reassurance such as “never makes you feel silly” and “make room for French together” weakens specificity. Prefer a supported action: “Ask for a slower reply” or “Practise ordering together.” Repeated oversized rounded hero cards can make distinct pages feel like the same template. Use a sentence, list or audio control where that better serves the task. Preserve the clear AI-tutor disclosure and separate Hear/select controls. Avoid borrowed human testimonials, fluency promises, invented scores, model badges and all-purpose chatbot menus.

The proposal table records what the audit asked for before the local pass above.
French calibration, physical audio/Walk checks, signed purchase flows and hosted
integration still require their separate verification.
