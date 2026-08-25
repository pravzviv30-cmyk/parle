# Graph Report - Parle  (2026-08-26)

## Corpus Check
- 449 files · ~437,768 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3529 nodes · 8371 edges · 203 communities (156 shown, 47 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 94 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7d99fb65`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Entitlement
- drill/index.ts
- metering/index.ts
- phonemes/index.ts
- DrillScreen.tsx
- LeaderboardTab.tsx
- openaiResponses.ts
- sessionLoop.ts
- expo
- App.tsx
- Tutor Agent Dependencies
- safety.ts
- devPlan.ts
- Autonomous Bug Loop
- conversation.ts
- supabaseAdapter.ts
- path.ts
- ttsCache.test.ts
- illustrations/index.ts
- supabaseLive.ts
- generate.ts
- brain/package.json
- Token Server Manifest
- Playground Package Manifest
- session/session.ts
- SessionSummary
- ParleConversation
- LlmUsage
- Core Package Manifest
- useLiveSession.ts
- Shared TypeScript Config
- copy.ts
- ParleTutor
- localAdapter.ts
- compilerOptions
- scripts
- profile.ts
- dependencies
- mobile/package.json
- space
- tutorVoice.ts
- Brain TypeScript Config
- Core TypeScript Config
- Playground TypeScript Config
- Token Server TypeScript Config
- Tutor Agent TypeScript Config
- RootNavigator.tsx
- scripts
- Native Audio Globals Setup
- journal.ts
- preflight.ts
- drill/store.ts
- client.ts
- ConvoScreen.tsx
- voiceLifecycle.ts
- Metro Runtime Dependency
- Expo Sharing Dependency
- Expo Speech Dependency
- openaiCompat.ts
- Expo Web Browser Dependency
- server.ts
- secretScan.ts
- choosingView.ts
- Graph Guard Script
- React Native Dependency
- AsyncStorage Dependency
- contract/types.ts
- upstashLive.ts
- coachMarks.test.ts
- drill/types.ts
- gate.mjs
- scheduler.ts
- Format
- Agent Fleet Validation
- evidenceContract.test.ts
- MissionsScreen.tsx
- AuthAdapter
- rateLimit.ts
- LiveKit WebRTC Dependency
- OnboardingFlow.tsx
- shared/speechace.ts
- React Native Screens
- databaseContract.test.ts
- main
- Supabase Client Dependency
- src/theme.ts
- lessons/types.ts
- SoundCheckScreen.tsx
- The pedagogy
- normalise
- Live Voice Doc
- Forge Loop Guide
- State and Storage Docs
- Testing Guide
- Bug Hunter Role
- Architecture Overview Doc
- docs/README.md
- convo.ts
- Fix Verifier Role
- engine/grading.ts
- profile/store.ts
- core/src/index.ts
- plugins
- sceneControls.test.ts
- Deploy Engineer Agent
- Observability Engineer Agent
- revenue-engineer.md
- protocol.ts
- LiveKit React Native
- Safe Area Context
- client.test.ts
- Forge Workflow Docs
- palette.test.ts
- Copy Style Tests
- secureSessionStorage.ts
- brain/src/index.ts
- Expo File System
- API Engineer Agent
- Performance Engineer Agent
- security-engineer.md
- Auth Engineer Role
- Backend Engineer Role
- Data Engineer Role
- Frontend Engineer Role
- The team
- Design Architect Role
- Scaling Engineer Role
- paper
- release-engineer.md
- work-judge.md
- review/store.ts
- Pre-commit Hook
- Pre-push Hook
- Git Hook Installer
- dev.mjs
- tokens.ts
- LiveContext.tsx
- iOS
- drill/grading.ts
- claudeCli.ts
- agent.ts
- runEval.ts
- auth.ts
- ciContract.test.ts
- tutor.ts
- activity.ts
- land.md
- Privacy and safety
- ServerMessage
- motion.test.ts
- enterRecord.test.ts
- Implementation evidence
- labels.test.ts
- Device verification — iOS and Android auth, session storage and deletion
- keyboardTaps.test.ts
- typingPing.ts
- tokenHygiene.test.ts
- topics.ts
- Paper & Ink design world
- surfaceContract.test.ts
- The free-form tutor brain
- expo-audio
- joinMeta.test.ts
- voice.ts
- livekit-client
- react
- httpSecurity.ts
- turnHandling.ts
- Supabase runbook
- LiveSession
- productEvents.ts
- PostgrestTable
- config.ts
- product-orchestrator.md
- Current-state map
- Risk register
- repository-archaeologist.md
- data-sync-engineer.md
- learning-science-engineer.md
- privacy-safety-engineer.md
- qa-release-engineer.md
- tutor-behaviour-engineer.md
- voice-platform-engineer.md
- serverSecurityContract.test.ts
- Recorder
- safetyWiring.test.ts
- expo-linking
- expo-secure-store
- @livekit/react-native-expo-plugin
- @parle/core
- react-dom
- react-native-web
- @react-navigation/native-stack
- design-system-engineer.md
- onboarding-ux-engineer.md
- practice-ux-engineer.md
- progress-retention-engineer.md
- social-systems-engineer.md

## God Nodes (most connected - your core abstractions)
1. `Format` - 139 edges
2. `space()` - 86 edges
3. `paper` - 51 edges
4. `LlmUsage` - 50 edges
5. `ParleConversation` - 50 edges
6. `react` - 39 edges
7. `type` - 38 edges
8. `MockLlmClient` - 31 edges
9. `Rung` - 30 edges
10. `ConvoScreen()` - 28 edges

## Surprising Connections (you probably didn't know these)
- `A real spoken exchange inside one five-minute session` --rationale_for--> `CAFE_LESSON`  [INFERRED]
  PRODUCT.md → packages/core/src/lessons/cafe.ts
- `Drill mode and the recognition-to-production ramp` --conceptually_related_to--> `bestDrillFor()`  [INFERRED]
  README.md → packages/core/src/phonemes/drills.ts
- `460pt centred web column` --rationale_for--> `App()`  [INFERRED]
  DESIGN.md → apps/mobile/App.tsx
- `Paper colour token set` --rationale_for--> `paper`  [EXTRACTED]
  DESIGN.md → apps/mobile/src/theme.ts
- `Signal colours kept out of the rung set` --rationale_for--> `signal`  [EXTRACTED]
  DESIGN.md → apps/mobile/src/theme.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **The four-rung scaffolding system, from principle to pixel** — product_scaffolding_ladder, product_never_stranded_never_scolded, design_support_colours_cool, packages_core_src_ladder_ladder_applyturn, apps_mobile_src_theme_rungcolor, readme_agent_authoritative [INFERRED 0.85]
- **The trustworthy-pronunciation chain** — product_trustworthy_pronunciation, product_french_only_depth, product_say_one_thing, readme_missing_score_no_penalty, packages_core_src_phonemes_inventory_french_phonemes, packages_core_src_phonemes_drills_drills, packages_core_src_phonemes_scoring_buildreport, services_shared_speechace_scoreutterance [INFERRED 0.85]
- **Unit economics and metering enforcement** — product_metered_minutes, product_cascaded_voice_pipeline, readme_metering_at_token_issuance, readme_tts_warm_cache, readme_risk_cost_per_session, packages_core_src_metering_meter_plans, packages_core_src_metering_meter_estimatesessioncost [INFERRED 0.85]

## Communities (203 total, 47 thin omitted)

### Community 0 - "Entitlement"
Cohesion: 0.11
Nodes (10): Entitlement, Plan, developmentEntitlementsEnabled(), DevelopmentEntitlementStore, entitlementFrom(), EntitlementStore, FileEntitlementStore, InMemoryEntitlementStore (+2 more)

### Community 1 - "drill/index.ts"
Cohesion: 0.13
Nodes (31): check(), checkDrill(), DRILL_FIXTURES, DrillVerdict, gradeAnswer(), answerCurrent(), AnsweredExercise, applyDrillResults() (+23 more)

### Community 2 - "metering/index.ts"
Cohesion: 0.17
Nodes (23): canStartSession(), DEFAULT_COST_MODEL, estimateSessionCost(), Margin, MIN_VIABLE_SESSION_SEC, planMargin(), PLANS, PlanSpec (+15 more)

### Community 3 - "phonemes/index.ts"
Cohesion: 0.12
Nodes (36): bestDrillFor(), BY_ID, Drill, DrillKind, DRILLS, drillsFor(), DrillWord, getDrill() (+28 more)

### Community 4 - "DrillScreen.tsx"
Cohesion: 0.18
Nodes (14): AppropriateReplyView(), BestSentenceView(), DrillScreen(), ds, FillBlankView(), kindTag(), ListenTypeView(), RepeatThisView() (+6 more)

### Community 5 - "LeaderboardTab.tsx"
Cohesion: 0.14
Nodes (21): useProfile(), build(), friends, AddFriendsScreen(), Hit, RowStatus, sheet, st (+13 more)

### Community 6 - "openaiResponses.ts"
Cohesion: 0.13
Nodes (19): ContractSchema, DEFAULT_OPENAI_ANALYST_MODEL, DEFAULT_OPENAI_TURN_MODEL, FetchResponse, FORMAT_NAME, inputMessages(), instructionsFor(), OpenAiResponsesBrainClient (+11 more)

### Community 7 - "sessionLoop.ts"
Cohesion: 0.14
Nodes (32): SessionRecap, applyNonSpokenInput(), supportViewForAssistance(), LearnerProfile, learnerSnapshotFrom(), main(), pickClient(), Command (+24 more)

### Community 8 - "expo"
Cohesion: 0.07
Nodes (29): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, package, permissions, predictiveBackGestureEnabled (+21 more)

### Community 9 - "App.tsx"
Cohesion: 0.11
Nodes (21): Read the exact versioned Expo docs before writing code, App(), Gate(), SignedInRoot(), st, AuthFlow(), AuthProvider(), RootNavigator() (+13 more)

### Community 10 - "Tutor Agent Dependencies"
Cohesion: 0.05
Nodes (37): @livekit/agents, @livekit/agents-plugin-anthropic, @livekit/agents-plugin-deepgram, @livekit/agents-plugin-elevenlabs, @livekit/agents-plugin-openai, @livekit/agents-plugin-silero, dependencies, dotenv (+29 more)

### Community 11 - "safety.ts"
Cohesion: 0.05
Nodes (37): DANGEROUS, DEPENDENCY, forms(), GROOMING_APPROACH, GROOMING_SECRECY, has(), HATE_OR_HARASSMENT, HOMOGLYPH_RE (+29 more)

### Community 12 - "devPlan.ts"
Cohesion: 0.12
Nodes (19): resolvedPlan(), AgentSecret, APP_PORT, bootPlan(), BootStep, brainOf(), Env, EnvGap (+11 more)

### Community 13 - "Autonomous Bug Loop"
Cohesion: 0.07
Nodes (18): ALLOWED_TOOLS, argv, BRANCH, branchNow, current, deadEnds, DRY_RUN, final (+10 more)

### Community 14 - "conversation.ts"
Cohesion: 0.06
Nodes (64): No number and no scolding mid-session, CoachItem, SpeakerLine, SupportMaterial, SupportView, AssistanceDepth, BASE_RUNG_BY_CEFR, beatOf() (+56 more)

### Community 15 - "supabaseAdapter.ts"
Cohesion: 0.10
Nodes (22): auth, authHeaders(), build(), AuthMode, AuthModeEnvironment, selectAuthMode(), installationId(), createMockAdapter() (+14 more)

### Community 16 - "path.ts"
Cohesion: 0.19
Nodes (15): AUTHORED_PATH, AuthoredNode, authoredPhraseKeys(), AuthoredUnit, buildPath(), discussedInWords(), drillableKeys(), GENERATED_PREFIX (+7 more)

### Community 17 - "ttsCache.test.ts"
Cohesion: 0.06
Nodes (21): CachedChunkedStream, CachedTTS, defaultMissTransport(), normaliseLine(), ResolvedCachedTTSOptions, FakeChunkedStream, FakeSynthesizeStream, FakeTTS (+13 more)

### Community 18 - "illustrations/index.ts"
Cohesion: 0.14
Nodes (39): Frame(), Moving(), Scene(), SceneProps, Stipple(), SpeakBubbles(), HeroCafe(), NobodyYet() (+31 more)

### Community 19 - "supabaseLive.ts"
Cohesion: 0.08
Nodes (32): anonKeyOf(), blockedReport(), CheckOutcome, CheckResult, codeOf(), Environment, expect(), Learner (+24 more)

### Community 20 - "generate.ts"
Cohesion: 0.06
Nodes (37): NewPhraseZ, NewPhrase, applyCuration(), buildCurationRequest(), CuratedTopic, CurationInput, CurationSchema, INSTRUCTION (+29 more)

### Community 21 - "brain/package.json"
Cohesion: 0.08
Nodes (25): @anthropic-ai/sdk, dependencies, @anthropic-ai/sdk, @parle/core, zod, description, devDependencies, @types/node (+17 more)

### Community 22 - "Token Server Manifest"
Cohesion: 0.08
Nodes (24): jose, livekit-server-sdk, dependencies, dotenv, jose, livekit-server-sdk, @parle/core, devDependencies (+16 more)

### Community 23 - "Playground Package Manifest"
Cohesion: 0.08
Nodes (24): dependencies, dotenv, @parle/brain, @parle/core, description, devDependencies, @types/node, typescript (+16 more)

### Community 24 - "session/session.ts"
Cohesion: 0.09
Nodes (36): ANGLOPHONE_WEAKNESS, CARRIER, carrierWord(), estimateDurationSec(), jitter(), LearnerProfile, mockObservations(), Phase (+28 more)

### Community 25 - "SessionSummary"
Cohesion: 0.24
Nodes (14): buildEntries(), csvField(), ExportEntry, toAnkiTsv(), toCsv(), buildReport(), buildTrends(), mean() (+6 more)

### Community 26 - "ParleConversation"
Cohesion: 0.15
Nodes (5): LearnerTurnInput, ParleConversation, postSessionDeadlineMs(), sttLanguageFor(), withDeadline()

### Community 27 - "LlmUsage"
Cohesion: 0.20
Nodes (10): AnthropicBrainClient, outputConfig(), parse(), toProviderMessages(), usageOf(), ClaudeCliBrainClient, extractJson(), jsonSchemaText() (+2 more)

### Community 28 - "Core Package Manifest"
Cohesion: 0.10
Nodes (19): devDependencies, @types/node, typescript, exports, ./ladder, ./lessons, ./metering, ./phonemes (+11 more)

### Community 29 - "useLiveSession.ts"
Cohesion: 0.16
Nodes (20): classifyFailure(), COPY, failureCopy, LiveFailure, micApiUnavailable(), EVERY_FAILURE, TokenServerError, ensureAudioSession() (+12 more)

### Community 30 - "Shared TypeScript Config"
Cohesion: 0.10
Nodes (19): DOM, ES2023, compilerOptions, allowImportingTsExtensions, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules (+11 more)

### Community 31 - "copy.ts"
Cohesion: 0.08
Nodes (30): ANGLICISM, BLOCKING_ERROR, BY_KIND, coachFallbackLine(), CopyRule, copyViolations(), EM_DASH_RE, ENGLISH_HAND_BACK (+22 more)

### Community 32 - "ParleTutor"
Cohesion: 0.26
Nodes (3): currentPrompt(), ParleTutor, rescueOnce()

### Community 33 - "localAdapter.ts"
Cohesion: 0.09
Nodes (34): defaultStore(), FriendsStore, isStore(), KEY(), listeners, loadStore(), mutate(), notify() (+26 more)

### Community 34 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, noEmit, noUncheckedIndexedAccess, strict, types, exclude, extends (+8 more)

### Community 35 - "scripts"
Cohesion: 0.05
Nodes (37): advisories, auditFailsAbove, note, reviewed, description, engines, node, name (+29 more)

### Community 36 - "profile.ts"
Cohesion: 0.11
Nodes (30): normalizeErrorTag(), applyExtractionToProfile(), applyTurnToProfile(), bandIndex(), createProfile(), evictOverflowPhrases(), evictStalePatterns(), EVIDENCE_WINDOW (+22 more)

### Community 37 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, expo, expo-crypto, expo-font, expo-status-bar, @parle/brain, react-native-svg, @react-navigation/bottom-tabs (+9 more)

### Community 38 - "mobile/package.json"
Cohesion: 0.17
Nodes (11): devDependencies, @types/node, @types/react, typescript, @types/node, typescript, main, name (+3 more)

### Community 39 - "space"
Cohesion: 0.09
Nodes (40): AuthScreen, SetNewPasswordScreen(), st, SignInScreen(), st, SignUpScreen(), st, AuthContext (+32 more)

### Community 40 - "tutorVoice.ts"
Cohesion: 0.43
Nodes (6): available(), frenchVoice(), loadVoices(), speak(), speakLines(), withTimeout()

### Community 41 - "Brain TypeScript Config"
Cohesion: 0.25
Nodes (7): compilerOptions, types, extends, include, node, src/**/*.ts, ../../tsconfig.base.json

### Community 42 - "Core TypeScript Config"
Cohesion: 0.25
Nodes (7): compilerOptions, types, extends, include, node, src/**/*.ts, ../../tsconfig.base.json

### Community 43 - "Playground TypeScript Config"
Cohesion: 0.25
Nodes (7): compilerOptions, types, extends, include, node, src/**/*.ts, ../../tsconfig.base.json

### Community 44 - "Token Server TypeScript Config"
Cohesion: 0.25
Nodes (7): compilerOptions, types, extends, include, node, src/**/*.ts, ../../tsconfig.base.json

### Community 45 - "Tutor Agent TypeScript Config"
Cohesion: 0.25
Nodes (7): compilerOptions, types, extends, include, node, src/**/*.ts, ../../tsconfig.base.json

### Community 46 - "RootNavigator.tsx"
Cohesion: 0.08
Nodes (31): useLive(), LiveSessionScreen(), resumableMission(), asRung(), DrillRoute(), LazyConvoScreen, LazyLiveSessionScreen, LessonRoute() (+23 more)

### Community 47 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, android, export:web, ios, start, test, typecheck, web

### Community 49 - "journal.ts"
Cohesion: 0.19
Nodes (18): clearJournal(), journalRecap(), KEY(), recoverJournal(), serialized(), NOW, phrase(), recap() (+10 more)

### Community 50 - "preflight.ts"
Cohesion: 0.17
Nodes (17): tutorLLM(), turnDeadlineMs(), Brain, BRAIN_KEY, Env, FetchLike, missingRequired(), preflight() (+9 more)

### Community 51 - "drill/store.ts"
Cohesion: 0.16
Nodes (18): MAX_DRILL_EXERCISES, mergeExerciseBank(), defaultStore(), DrillStore, getMicSuppressedUntil(), hasGeneratedExercises(), isMicSuppressed(), isStore() (+10 more)

### Community 52 - "client.ts"
Cohesion: 0.10
Nodes (21): MemoryExtraction, ScenarioFrame, TutorTurn, Curation, DrillBatch, BrainCurateRequest, BrainDrillsRequest, BrainExtractRequest (+13 more)

### Community 53 - "ConvoScreen.tsx"
Cohesion: 0.06
Nodes (44): fitDisplay(), ConvoScreen(), MissionWin(), st, source, COMPLETIONS_PER_MISSION, isCompletion(), KEY() (+36 more)

### Community 54 - "voiceLifecycle.ts"
Cohesion: 0.07
Nodes (35): CostModel, Check, CheckKind, CheckNeeds, CheckResult, CheckStatus, estimateVendorSpend(), foreignAgentWorkers() (+27 more)

### Community 58 - "openaiCompat.ts"
Cohesion: 0.17
Nodes (12): FetchLike, realSleep(), RETRY_AFTER_CAP_MS, RETRY_AFTER_FALLBACK_MS, retryAfterMs(), SleepLike, ChatCompletion, ContractSchema (+4 more)

### Community 60 - "server.ts"
Cohesion: 0.12
Nodes (24): adminHeaders(), deleteSupabaseUser(), signedInRecently(), agentDebitAllowed(), insertProductEvent(), clientIp(), installationSignal(), privateSignal() (+16 more)

### Community 61 - "secretScan.ts"
Cohesion: 0.11
Nodes (32): ALLOW_MARKER, BINARY_EXTENSIONS, BUNDLE_DIRECTORIES, bundleFiles(), Finding, formatFinding(), git(), isCodeReference() (+24 more)

### Community 62 - "choosingView.ts"
Cohesion: 0.24
Nodes (11): MAX_TURNS, TurnLine, ANYTHING_GOES, ChoosingOrb, ChoosingState, choosingView, LiveMode, QUIET_DOOR (+3 more)

### Community 63 - "Graph Guard Script"
Cohesion: 0.29
Nodes (4): GRAPH, ROOT, ROUTING, SOURCE_EXTS

### Community 66 - "contract/types.ts"
Cohesion: 0.08
Nodes (33): AssessmentZ, CefrBandZ, CoachItemZ, CoachKindZ, MemoryExtractionSchema, MemoryFactZ, OptionZ, PhraseZ (+25 more)

### Community 67 - "upstashLive.ts"
Cohesion: 0.12
Nodes (25): RATE_LIMITS, UpstashSessionLeaseStore, blockedReport(), CheckResult, CheckStatus, expect(), freePort(), Instance (+17 more)

### Community 68 - "coachMarks.test.ts"
Cohesion: 0.19
Nodes (13): COACH_MARK_TEXT, CoachMarkId, coachMarksAfter(), coachMarksAt(), CoachMarkState, CoachSignals, dismissCoachMark(), SEQUENCE (+5 more)

### Community 69 - "drill/types.ts"
Cohesion: 0.18
Nodes (17): typed(), withOptions(), AppropriateReplyExercise, BestSentenceExercise, DrillExerciseBase, FillBlankExercise, ListenTypeExercise, RepeatThisExercise (+9 more)

### Community 70 - "gate.mjs"
Cohesion: 0.08
Nodes (18): AGENT_MODELS, agentFiles, args, asJson, auditOnly, bless, counts, entries (+10 more)

### Community 71 - "scheduler.ts"
Cohesion: 0.14
Nodes (27): cardsFor(), MIX_OFFER, offersMix(), CAFE, due(), JOB, later(), topic() (+19 more)

### Community 72 - "Format"
Cohesion: 0.01
Nodes (139): A1 — A spoken answer has to match the script exactly, A2 — An empty transcript is graded as a wrong answer, A3 — A freeze at the top rung still asks the learner to invent French, A4 — A rescue can skip the beat the learner froze on, A5 — Two different opening-rung formulas, A6 — A focus point vanishes when the worst sound has no drill, A7 — A v2 snapshot with no memory crashes the worker, B0 — ParleTutor cannot be tested at all (+131 more)

### Community 73 - "Agent Fleet Validation"
Cohesion: 0.20
Nodes (11): AgentFrontmatter, agentProblems(), FRONTMATTER_FIELDS, frontmatterBlock(), parseAgentFrontmatter(), pinnedAgents(), READ_ONLY_AGENTS, routedAgents() (+3 more)

### Community 74 - "evidenceContract.test.ts"
Cohesion: 0.08
Nodes (28): classify(), evidence, EVIDENCE_PATH, evidenceFlat, FLOORS_PATH, ledger, LEDGER_PATH, LedgerEntry (+20 more)

### Community 75 - "MissionsScreen.tsx"
Cohesion: 0.09
Nodes (43): ProductEvent, trackProductEvent(), CHOOSER_HEADLINE, CHOOSER_SUB, ChooserCard, ChooserInput, chooserView, FINISHED_LINE (+35 more)

### Community 77 - "rateLimit.ts"
Cohesion: 0.08
Nodes (16): CONSUME_SCRIPT, Counter, createRateLimiter(), createSessionLeaseStore(), FetchLike, MemoryRateLimiter, MemorySessionLeaseStore, RateLimitDecision (+8 more)

### Community 79 - "OnboardingFlow.tsx"
Cohesion: 0.14
Nodes (24): AGE_CONFIRM, AGE_DENY, AGE_QUESTION, AGE_REFUSAL, AGE_SUB, ageGate, answersFrom(), MOTIVATIONS (+16 more)

### Community 80 - "shared/speechace.ts"
Cohesion: 0.18
Nodes (9): A missing score is never an invented penalty, ALIASES, FRENCH_IPA, toInventoryIpa(), parseSpeechace(), ScoreFetch, ScoreRequest, scoreUtterance() (+1 more)

### Community 82 - "databaseContract.test.ts"
Cohesion: 0.09
Nodes (27): and3(), branchTaken(), claimOutcome(), CreatedObject, createdObjects(), debitFixMigration, effectiveBody(), effectiveClaimTrialBody() (+19 more)

### Community 83 - "main"
Cohesion: 0.20
Nodes (28): checkAgentSecret(), checkConcurrentStart(), checkDepartureClosesRoom(), checkExactlyOnceDebit(), checkHardStop(), checkInsecureUrlRefused(), checkJoinTokenExpiry(), checkLeaseReleased() (+20 more)

### Community 85 - "src/theme.ts"
Cohesion: 0.06
Nodes (63): ArrowRight(), Card(), EarGlyph(), GhostButton(), HelpGlyph(), Label(), LineBullet(), MicGlyph() (+55 more)

### Community 86 - "lessons/types.ts"
Cohesion: 0.17
Nodes (21): Chrome is plain English, French only where it is content, CAFE_LESSON, BY_ID, getLesson(), LESSONS, AcceptanceMatch, AcceptanceRoute, candidatesFor() (+13 more)

### Community 87 - "SoundCheckScreen.tsx"
Cohesion: 0.20
Nodes (18): nextSoundCheckReference(), SELF_GUIDED, soundCheckDecision, SoundCheckEvidence, SoundCheckKind, emptyReport, sheet, SoundCheckScreen() (+10 more)

### Community 88 - "The pedagogy"
Cohesion: 0.22
Nodes (8): One focus, one drill, The four rungs, The invariants, The pedagogy, The rescue, Two independent axes, What counts as a right answer, Where the next session opens

### Community 89 - "normalise"
Cohesion: 0.22
Nodes (14): DrillDifficulty, checkAccepted(), checkDistinct(), englishGlosses(), expectedDifficulty(), inRange(), LabelledString, learnerVisibleStrings() (+6 more)

### Community 90 - "Live Voice Doc"
Cohesion: 0.25
Nodes (7): Audio, and what may be claimed about it, Serialisation, The four modes, The live path, The route, The wire, When it fails

### Community 91 - "Forge Loop Guide"
Cohesion: 0.29
Nodes (7): Giving it a goal, Running it, The agents, The bar, The loop, The other half: building something new, Verifying UI work

### Community 92 - "State and Storage Docs"
Cohesion: 0.29
Nodes (6): On the device, Server side, Sessions and progress, State and storage, The brain's learner model, The round trip, and where it broke

### Community 93 - "Testing Guide"
Cohesion: 0.29
Nodes (6): Never, Running, Testing, The rule that matters most, What is not covered, Writing

### Community 94 - "Bug Hunter Role"
Cohesion: 0.33
Nodes (5): House style, How you work, Product invariants — a change that breaks one of these is a bug, however green, What counts as a finding, What you must never do

### Community 95 - "Architecture Overview Doc"
Cohesion: 0.40
Nodes (5): Architecture, Mock or live, No build step, Two paths, one ladder, Who owns what

### Community 96 - "docs/README.md"
Cohesion: 0.29
Nodes (3): Deletion and supersession ledger, Delivery roadmap, docs

### Community 97 - "convo.ts"
Cohesion: 0.05
Nodes (44): supportViewFor(), APERO_FRAME, asSentence(), brainClient(), chooseFrame(), ConversationPhase, CONVO_LINES, ConvoView (+36 more)

### Community 100 - "engine/grading.ts"
Cohesion: 0.08
Nodes (36): ContrastPair, Filler, RegisterDef, SlangEntry, Assessment, ANSWERS_RATHER_THAN_INTERRUPTS, assessmentToQuality(), INLINE_CAP (+28 more)

### Community 101 - "profile/store.ts"
Cohesion: 0.13
Nodes (22): Ctx, ProfileGate(), ProfileValue, needsOnboarding(), ageConfirmedFromDob(), ageOn(), MIN_AGE, TODAY (+14 more)

### Community 102 - "core/src/index.ts"
Cohesion: 0.10
Nodes (26): card(), days(), NOW, topic(), PathNodeRow(), st, MOMENT_ANSWER_MS, momentAnswer() (+18 more)

### Community 103 - "plugins"
Cohesion: 0.25
Nodes (6): plugins, expo-audio, expo-font, expo-secure-store, expo-sharing, @livekit/react-native-expo-plugin

### Community 104 - "sceneControls.test.ts"
Cohesion: 0.29
Nodes (9): hasSayableSupportLine(), sceneControls, controls(), fullLine, hint, none, options, typedTurn() (+1 more)

### Community 105 - "Deploy Engineer Agent"
Cohesion: 0.22
Nodes (8): How you work, Product invariants — a change that breaks one of these is wrong, however green, Ship the smallest real thing, Start by being honest about where this is, The order this has to happen in, What you must never do, When there is nothing to deploy to, say so, Your territory

### Community 106 - "Observability Engineer Agent"
Cohesion: 0.22
Nodes (8): How you work, Product invariants — a change that breaks one of these is wrong, however green, The line you do not cross, The seam to cut, when the time comes, What exists, and what does not, What you must never do, When there is no seam yet, say so, Your territory

### Community 107 - "revenue-engineer.md"
Cohesion: 0.20
Nodes (9): Copy about money is still learner copy, Handoff contract, How you work, Product invariants — a change that breaks one of these is wrong, however green, The rule enforcement lives at, What already exists, What you must never do, Where a purchase lands (+1 more)

### Community 108 - "protocol.ts"
Cohesion: 0.12
Nodes (23): asTheAgentReadsIt(), asTheAppReadsIt(), CLIENT_TAGS, ClientMessage, ConvoCoachItem, ConvoSpeakerLine, decodeAs(), decodeClientMessage() (+15 more)

### Community 111 - "client.test.ts"
Cohesion: 0.13
Nodes (10): sampleCoachItem(), sampleSupport(), sampleTurn(), ParseCapableSdk, addLlmUsage(), BrainRefusalError, AnyRecord, completion() (+2 more)

### Community 112 - "Forge Workflow Docs"
Cohesion: 0.22
Nodes (9): /forge, Looping it, Not wired yet: the unattended loop, The contract, The gate watches the wiring too, Watch for judge drift, Who actually builds it, Why the judge's findings go in the ledger (+1 more)

### Community 113 - "palette.test.ts"
Cohesion: 0.15
Nodes (15): accents, HASHED, ink, Paper, PaperName, ALL, CARRIED, channels() (+7 more)

### Community 115 - "secureSessionStorage.ts"
Cohesion: 0.22
Nodes (10): chunkKey(), KeyValueStorage, metaKey(), parseMeta(), readSecure(), removeAllGenerations(), removeGeneration(), StoredMeta (+2 more)

### Community 116 - "brain/src/index.ts"
Cohesion: 0.11
Nodes (27): FR_PACK, renderAuthenticityPack(), AuthenticityPack, carriesFrench(), ENGLISH_ACCENTED_WORDS, blocks(), ZERO_USAGE, blocks() (+19 more)

### Community 118 - "API Engineer Agent"
Cohesion: 0.25
Nodes (7): How you work, Product invariants — a change that breaks one of these is wrong, however green, The LLM layer, The rule that matters most, The shape of the API, What you must never do, Your territory

### Community 119 - "Performance Engineer Agent"
Cohesion: 0.25
Nodes (7): How the TTS cache actually works, How you work, Product invariants — a change that breaks one of these is wrong, however green, Prompt caching, The number, What you must never do, Your territory

### Community 120 - "security-engineer.md"
Cohesion: 0.22
Nodes (8): Handoff contract, How you work, Product invariants — a change that breaks one of these is wrong, however green, The habits already in the code, which you should extend, What is actually true today, unvarnished, What you must never do, When dispatched by /ship, Your territory

### Community 121 - "Auth Engineer Role"
Cohesion: 0.29
Nodes (6): How you work, Product invariants — a change that breaks one of these is wrong, however green, The seam, and why it is shaped this way, The server side, What you must never do, Your territory

### Community 122 - "Backend Engineer Role"
Cohesion: 0.29
Nodes (6): How you work, Product invariants — a change that breaks one of these is wrong, however green, Running it locally, What this stack does not have, What you must never do, Your territory

### Community 123 - "Data Engineer Role"
Cohesion: 0.29
Nodes (6): How you work, Product invariants — a change that breaks one of these is wrong, however green, What is actually true today, What you must never do, When a database is proposed, Your territory

### Community 124 - "Frontend Engineer Role"
Cohesion: 0.29
Nodes (6): How you work, Product invariants — a change that breaks one of these is wrong, however green, The constraints that are not negotiable, The one thing that catches everyone out, What you must never do, Your territory

### Community 125 - "The team"
Cohesion: 0.29
Nodes (7): Calling them, Territory is the point, The gate defends the fleet, The independent reviewers, The team, Three of them are ahead of the code, Who owns what

### Community 126 - "Design Architect Role"
Cohesion: 0.33
Nodes (5): Orienting yourself, The ledger format is parsed, not read, The question you are actually answering, What you must never do, Your output — the contract

### Community 127 - "Scaling Engineer Role"
Cohesion: 0.33
Nodes (5): Default answer, The checks, What genuinely blocks a second instance today, What you must never do, Your output

### Community 128 - "paper"
Cohesion: 0.21
Nodes (12): HomeIcon(), MyFrenchIcon(), PracticeIcon(), ProfileIcon(), TabIconProps, TutorIcon(), announceTab(), ICONS (+4 more)

### Community 129 - "release-engineer.md"
Cohesion: 0.40
Nodes (4): The bar, The checks, What you must never do, Your output

### Community 130 - "work-judge.md"
Cohesion: 0.40
Nodes (4): The bar for sending work back, The checks, You may not grow the job, Your output

### Community 131 - "review/store.ts"
Cohesion: 0.21
Nodes (18): addFromSummary(), addPhrases(), caches, dueCount(), gradeCard(), gradeCards(), KEY(), loadDeck() (+10 more)

### Community 138 - "dev.mjs"
Cohesion: 0.21
Nodes (17): AGENT_ENV_FILE, children, COLOURS, die(), hasClaudeCli(), launch(), main(), probe() (+9 more)

### Community 139 - "tokens.ts"
Cohesion: 0.22
Nodes (13): GrantResult, grantSession(), ROOM_LIFECYCLE, roomNameFor(), SeedTopic, SessionGrant, SessionMode, config (+5 more)

### Community 140 - "LiveContext.tsx"
Cohesion: 0.24
Nodes (7): Ctx, LiveProvider(), LiveValue, selectTokenServerUrl(), SRC, TOKEN_SERVER, TokenServerEnvironment

### Community 141 - "iOS"
Cohesion: 0.12
Nodes (16): D0 — the build is on the Supabase adapter, D10 — deletion demands a recent Google reauthentication, D11 — a failed local wipe is reported honestly, D12 — no bearer token in logs, in AsyncStorage, or in the bundle, D13 — two accounts on one device never see each other's learning, D14 — the installation signal survives deletion, D1 — a session survives backgrounding, cold start and reboot, D2 — the session is in the keychain, not in plaintext storage (+8 more)

### Community 142 - "drill/grading.ts"
Cohesion: 0.40
Nodes (8): acceptedFor(), gradeFreeText(), GradeResult, realWordSet(), damerauLevenshtein(), sameWord(), TYPO_MAX_DISTANCE, TYPO_MIN_LENGTH

### Community 143 - "claudeCli.ts"
Cohesion: 0.12
Nodes (18): AnthropicBrainConfig, ClaudeCliConfig, ClaudeCliRun, CliEnvelope, ContractSchema, spawnClaude(), envelope(), EXTRACTION (+10 more)

### Community 144 - "agent.ts"
Cohesion: 0.24
Nodes (11): TokenMeta, createTurnTiming(), formatTiming(), formatVendorMetrics(), mark(), SEGMENTS, TimingStage, TurnTiming (+3 more)

### Community 145 - "runEval.ts"
Cohesion: 0.22
Nodes (14): CoachKind, defaultModel(), EVAL_CASES, EvalCase, EvalExpectation, CaseResult, expectationMisses(), hardRules() (+6 more)

### Community 146 - "auth.ts"
Cohesion: 0.25
Nodes (5): createUserResolver(), ResolvedUser, SIGN_IN_REQUIRED, UserResolver, VerifierConfig

### Community 147 - "ciContract.test.ts"
Cohesion: 0.14
Nodes (13): accepted, AdvisoryDecision, dependencyClosure(), fixed, lock, LockEntry, Lockfile, manifest (+5 more)

### Community 148 - "tutor.ts"
Cohesion: 0.08
Nodes (17): baseInstructions(), buildPrompt(), turnInstructions(), TurnQueue, forgetReportedSessions(), Publisher, REPLAYED_SESSION_MESSAGE, reportedSessions (+9 more)

### Community 149 - "activity.ts"
Cohesion: 0.08
Nodes (44): TodayRow(), ActivityEntry, ActivityKind, backfillFrom(), chain, empty(), mutate(), prune() (+36 more)

### Community 150 - "land.md"
Cohesion: 0.25
Nodes (7): 1. Who else is in this tree, 2. Where you are standing, 3. The gate, 4. The shape of the branch, 5. Deciding, 6. Landing, 7. Say what happened

### Community 151 - "Privacy and safety"
Cohesion: 0.13
Nodes (14): Analytics: consent, opt-out and retention, Antifraud identifiers: purpose, retention and disclosure, Deletion and export, Escalation and what Parle is not, Known limits of a deterministic net, Not true yet, Privacy and safety, Raw speech is never stored (+6 more)

### Community 152 - "ServerMessage"
Cohesion: 0.60
Nodes (3): thinkingAfter(), ServerMessage, The agent is authoritative over session state

### Community 153 - "motion.test.ts"
Cohesion: 0.33
Nodes (3): FILES, SRC, stripComments()

### Community 154 - "enterRecord.test.ts"
Cohesion: 0.29
Nodes (5): GROUNDS, HERE, LEDGER, REPO, RULE_TEST

### Community 155 - "Implementation evidence"
Cohesion: 0.14
Nodes (13): Applying the schema to whatever project ships, Baseline, Credential state, measured 2026-08-25, Current focused verification, Failed-room billing: the P0 the phase found, then closed, Feature matrix, Found and fixed during Phase 1, Implementation evidence (+5 more)

### Community 156 - "labels.test.ts"
Cohesion: 0.40
Nodes (5): KEPT, labelsInSource(), RETIRED, sourceFiles(), SRC

### Community 157 - "Device verification — iOS and Android auth, session storage and deletion"
Cohesion: 0.17
Nodes (10): Android, Before you start, D15 — a keystore key invalidated by a lock-screen change, D16 — restored from an Android backup, Device verification — iOS and Android auth, session storage and deletion, Recording the result, The matrix, What a device proves that this machine cannot (+2 more)

### Community 160 - "tokenHygiene.test.ts"
Cohesion: 0.22
Nodes (8): authSources(), callArguments(), loggingCalls(), PLAINTEXT_WRITERS, REPO_ROOT, Source, sources, withoutComments()

### Community 161 - "topics.ts"
Cohesion: 0.42
Nodes (6): MAX_DISCUSSED_DATES, MAX_STORED_TOPICS, mergeTopics(), STAGGER_DUE_NOW, staggerNewCards(), topicId()

### Community 162 - "Paper & Ink design world"
Cohesion: 0.17
Nodes (12): Paper colour token set, Paper & Ink design world, Absolute-beginner audience (CEFR A0-A2), Everything spoken must also be readable, Absent evidence must not be fabricated, Parle (working name), Expo + TypeScript npm-workspaces monorepo, Trustworthy pronunciation needs a reference text (+4 more)

### Community 163 - "surfaceContract.test.ts"
Cohesion: 0.40
Nodes (3): APP, SOURCES, stripComments()

### Community 164 - "The free-form tutor brain"
Cohesion: 0.33
Nodes (5): Acceptance checks, Cost envelope, Product contract, Provider decision, The free-form tutor brain

### Community 167 - "voice.ts"
Cohesion: 0.22
Nodes (8): CachedTTSOptions, DEFAULT_CACHE_DIR, LANGUAGE_CODE, MODEL, PROBE_LINE, SETTINGS_FINGERPRINT, ENV_KEYS, VOICE_SETTINGS

### Community 170 - "httpSecurity.ts"
Cohesion: 0.39
Nodes (7): applyHttpSecurity(), createOriginPolicy(), DEVELOPMENT_ORIGINS, originAllowed(), OriginPolicy, parseAllowedOrigins(), requestOrigin()

### Community 171 - "turnHandling.ts"
Cohesion: 0.29
Nodes (6): ENDPOINTING_MIN_DELAY_MS, INTERRUPTION_MIN_DURATION_MS, INTERRUPTION_MIN_WORDS, SessionMode, TurnHandling, turnHandlingFor()

### Community 172 - "Supabase runbook"
Cohesion: 0.25
Nodes (7): Apply, Backup, Restore, Rollback, Rollback evidence, Supabase runbook, When something goes wrong

### Community 173 - "LiveSession"
Cohesion: 0.33
Nodes (7): LiveSession, SessionViewProps, ReplayLine, ConvoView, RecapPayload, SessionPrompt, The conversation upgrade

### Community 174 - "productEvents.ts"
Cohesion: 0.48
Nodes (5): exactKeys(), missionId(), nonNegativeCount(), parseProductEvent(), ProductEvent

### Community 176 - "config.ts"
Cohesion: 0.53
Nodes (4): exactHttpsOrigin(), productionConfigurationProblems(), secureUrl(), ServerEnvironment

### Community 177 - "product-orchestrator.md"
Cohesion: 0.40
Nodes (4): Boundaries and escalation, Completion, Decision rights, Handoff contract

### Community 178 - "Current-state map"
Cohesion: 0.40
Nodes (4): Current-state map, Replacement/dependency graph, Runtime path, Sources of truth

### Community 179 - "Risk register"
Cohesion: 0.40
Nodes (4): Abandoned rooms: a risk this register overstated, Failed-room billing: a control this register claimed, lost, and rebuilt, Risk register, Trial farming: theoretical no longer

### Community 180 - "repository-archaeologist.md"
Cohesion: 0.50
Nodes (3): Boundaries and escalation, Handoff contract, Output

## Knowledge Gaps
- **1184 isolated node(s):** `st`, `name`, `slug`, `version`, `orientation` (+1179 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **47 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `plugins` connect `plugins` to `expo`, `supabaseAdapter.ts`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `expo` connect `expo` to `plugins`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `react` connect `space` to `paper`, `compilerOptions`, `review/store.ts`, `DrillScreen.tsx`, `profile/store.ts`, `LeaderboardTab.tsx`, `core/src/index.ts`, `App.tsx`, `MissionsScreen.tsx`, `LiveContext.tsx`, `RootNavigator.tsx`, `OnboardingFlow.tsx`, `illustrations/index.ts`, `src/theme.ts`, `ConvoScreen.tsx`, `SoundCheckScreen.tsx`, `session/session.ts`, `useLiveSession.ts`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `st`, `name`, `slug` to the rest of the system?**
  _1184 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Entitlement` be split into smaller, more focused modules?**
  _Cohesion score 0.10668563300142248 - nodes in this community are weakly interconnected._
- **Should `drill/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12685560053981107 - nodes in this community are weakly interconnected._
- **Should `phonemes/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12323232323232323 - nodes in this community are weakly interconnected._