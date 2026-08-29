# Graph Report - forge-phases-status-c74034  (2026-08-29)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 4925 nodes · 11524 edges · 244 communities (194 shown, 50 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 174 edges (avg confidence: 0.7)
- Token cost: 172,305 input · 3,778 output

## Graph Freshness
- Built from commit: `d31cea0d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Entitlement Plan Store
- Topic Curation Pipeline
- Session Metering And Plans
- Pronunciation Drill Bank
- Sync Engine Types
- Phrasebook Screen And Storage
- Brain Playground Chat CLI
- Claude CLI Run And Usage
- Expo App Config
- Mobile App Shell And Auth Flow
- Tutor Agent Package Manifest
- Safety Policy Corpus Tests
- Dev Boot Plan
- Autonomous Build Loop Runner
- Difficulty Ladder State
- Auth Adapter And Modes
- Talk Again And Authored Path
- TTS Cache Streaming
- Hand Drawn Illustrations
- Supabase Live Environment Checks
- Drill Exercise Generation
- Brain Package Manifest
- Token Server Manifest
- Brain Playground Manifest
- Mock Speech And Session Screen
- Dev Process Launcher
- Live Conversation Controller
- Drill Session Grading
- Core Package Manifest
- App Agent Wire Protocol
- Shared TypeScript Config
- HTTP Retry And OpenAI Client
- LiveKit Tutor Agent
- Friends Store Adapter
- Mobile TypeScript Config
- Root Package Dependency Audit
- First Run Disclosure Copy
- Mobile App Dependencies
- Mobile Package Manifest
- Learner Profile Updates
- Tutor Onboarding Marks Store
- Brain TS Config
- Core TS Config
- Brain Playground TS Config
- Token Server TS Config
- Tutor Agent TS Config
- Convo Screen Disk Tests
- Mobile npm Scripts
- Native LiveKit Audio Globals
- Session Journal Recovery
- Environment Preflight Probes
- Drill Bank Store
- Claude CLI Brain Client
- Practice Record Ledger Tests
- Voice Session Lifecycle Checks
- Expo Metro Runtime
- Expo Sharing
- Review Cards And Evidence
- Age Gate And Upgrade
- Expo Web Browser
- Account Deletion And Product Events
- Secret Scanning Tool
- Review Card View
- Graphify Guard Hook
- React Native Core
- Async Storage Dependency
- Brain Contract Zod Schemas
- Upstash Live Checks
- Conversation Screen And Profile
- Onboarding Profile Store
- Release Gate Runner
- Friendly Error Copy
- Tutor Behaviour Bug Ledger
- Agent Fleet Frontmatter Checks
- Gate Evidence Contract
- Mission Chooser View
- Auth Adapter Interface
- Rate Limiting And Session Leases
- LiveKit React Native WebRTC
- Analytics Events And Onboarding Answers
- Pronunciation Scoring & IPA
- React Native Screens
- Database Migration Contract Tests
- Sync Retention Policy Limits
- Supabase Client
- Paper UI Primitives
- Cafe Lesson Definitions
- Sound Check Store
- Pedagogy Doc
- Live Session Hook Tests
- Live Voice Doc
- Loop Doc
- State & Storage Doc
- Testing Doc
- Bug Hunter Agent
- Architecture Doc
- Docs Index
- Conversation Flow Orchestration
- Fix Verifier Agent
- Live Session React Context
- Guilt Free Copy Checks
- Status Line & Tutor Name
- Sync Engine Reconciliation
- French Authenticity Pack
- Deploy Engineer Agent
- Observability Engineer Agent
- Revenue Engineer Agent
- Scene Support Controls
- LiveKit React Native SDK
- Safe Area Context
- Coach Output Samples And Checks
- Forge Command Doc
- Paper Palette Tokens
- Mobile Copy Tests
- Secure Session Storage
- User Scope Data Reset
- Profile Merge Rules
- API Engineer Agent
- Performance Engineer Agent
- Security Engineer Agent
- Auth Engineer Agent
- Backend Engineer Agent
- Data Engineer Agent
- Frontend Engineer Agent
- Team Doc
- Design Architect Agent
- Scaling Engineer Agent
- Tab Bar Icons
- Release Engineer Agent
- Work Judge Agent
- Review Deck Store
- Pre-commit Git Hook
- Pre-push Git Hook
- Git Hook Installer
- Android App Config
- Session Token Grants
- Drill Screen And Tracking
- Device Verification Checklist
- Sync Diagnostics And Alarms
- Store Binding Integration Tests
- Turn Timing Instrumentation
- Motion And Transcript UI
- Server User Resolution
- Dependency Lockfile Resolution
- Practice Data Export & History
- XP And Levels
- Land Command Doc
- Privacy And Safety Review
- Test Brain Doubles
- Motion Usage Tests
- Ledger Entry Tests
- Implementation Evidence Matrix
- Retired Label Tests
- Onboarding Doc
- Keyboard Tap Tests
- Activity Sync Policy
- Token Logging Hygiene
- Fresh Device Startup
- Mission Completion Store
- Agent Prompt And Turn Queue
- Tutor Brain Doc
- Review Deck Merge
- Join Metadata Tests
- Expo Plugins & File Saving
- LiveKit Client
- Spaced Repetition Engine Tests
- HTTP Origin & Security Headers
- Token Server URL Selection
- Supabase Runbook
- Retry Backoff Policy
- Pronunciation Session Feedback
- Supabase Test Doubles
- Server Config Validation
- Product Orchestrator Agent
- Current State Map
- Risk Register
- Repository Archaeologist Agent
- Data Sync Engineer Role
- Learning Science Engineer Role
- Privacy Safety Engineer Role
- QA Release Engineer Role
- Tutor Behaviour Engineer Role
- Voice Platform Engineer Role
- Server Security Contract Tests
- Audio Recorder Component
- Safety Wiring Tests
- Expo Linking
- Expo Secure Store
- TTS Voice Cache Build
- Parle Core Package
- React DOM
- React Native Web
- Native Stack Navigation
- Design System Engineer Role
- Onboarding UX Engineer Role
- Practice UX Engineer Role
- Progress Retention Engineer Role
- Social Systems Engineer Role
- Session Domain Types
- Safety Category Taxonomy
- Mock Auth Adapter
- Coach Copy Rules
- Product Principles & Design World
- Source Text Encoding Tests
- Phrasebook Mix Offers
- Attempt Audio Cleanup
- Delivery Roadmap Phases
- Pipeline Failure Classification
- Anthropic Brain Client
- Progress History Store
- Drill Exercise Bank Merge
- Drill Batch Validation
- Memory Fact Extraction Prompt
- Audio Session Globals And Safety
- Free Text Drill Grading
- Drill Exercise Types
- React
- LiveKit Expo Plugin
- Expo Audio
- Recap Wait Surface
- Session Lease Store
- Turn Handling Thresholds
- Busy Label Screen Tests
- Delivery Roadmap Contract Tests
- Device Verification Criteria
- Fake LiveKit Room
- Safety Category Corpus
- Drill Screen Tests
- Agent Usage Reporting
- Session View Typing Ping
- Acknowledged Persistence Stores
- Set New Password Screen Tests
- Storage Doc Tests
- Brain Spend Metering Tests
- Learner State Sync Engine
- Expo Speech
- Safety Output Guard
- Expo SDK

## God Nodes (most connected - your core abstractions)
1. `Format` - 282 edges
2. `space()` - 88 edges
3. `ParleConversation` - 63 edges
4. `LlmUsage` - 54 edges
5. `paper` - 52 edges
6. `ConvoScreen()` - 42 edges
7. `react` - 40 edges
8. `type` - 39 edges
9. `Rung` - 38 edges
10. `DrillExercise` - 32 edges

## Surprising Connections (you probably didn't know these)
- `A real spoken exchange inside one five-minute session` --rationale_for--> `createSession()`  [INFERRED]
  PRODUCT.md → packages/core/src/session/session.ts
- `Drill mode and the recognition-to-production ramp` --conceptually_related_to--> `bestDrillFor()`  [INFERRED]
  README.md → packages/core/src/phonemes/drills.ts
- `Words-right and sounds-right are separate questions` --rationale_for--> `TurnFeedback`  [INFERRED]
  PRODUCT.md → packages/core/src/session/session.ts
- `Words-right and sounds-right are separate questions` --rationale_for--> `grade()`  [INFERRED]
  PRODUCT.md → packages/core/src/session/session.ts
- `A missing score is never an invented penalty` --rationale_for--> `grade()`  [INFERRED]
  README.md → packages/core/src/session/session.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **The four-rung scaffolding system, from principle to pixel** — product_scaffolding_ladder, product_never_stranded_never_scolded, design_support_colours_cool, packages_core_src_ladder_ladder_applyturn, apps_mobile_src_theme_rungcolor, readme_agent_authoritative [INFERRED 0.85]
- **The trustworthy-pronunciation chain** — product_trustworthy_pronunciation, product_french_only_depth, product_say_one_thing, readme_missing_score_no_penalty, packages_core_src_phonemes_inventory_french_phonemes, packages_core_src_phonemes_drills_drills, packages_core_src_phonemes_scoring_buildreport, services_shared_speechace_scoreutterance [INFERRED 0.85]
- **Unit economics and metering enforcement** — product_metered_minutes, product_cascaded_voice_pipeline, readme_metering_at_token_issuance, readme_tts_warm_cache, readme_risk_cost_per_session, packages_core_src_metering_meter_plans, packages_core_src_metering_meter_estimatesessioncost [INFERRED 0.85]

## Communities (244 total, 50 thin omitted)

### Community 0 - "Entitlement Plan Store"
Cohesion: 0.11
Nodes (9): Entitlement, Plan, DevelopmentEntitlementStore, entitlementFrom(), EntitlementStore, FileEntitlementStore, InMemoryEntitlementStore, SupabaseEntitlementRow (+1 more)

### Community 1 - "Topic Curation Pipeline"
Cohesion: 0.06
Nodes (46): NewPhrase, applyCuration(), buildCurationRequest(), CuratedTopic, CurationInput, CurationSchema, extensionViolations(), INSTRUCTION (+38 more)

### Community 2 - "Session Metering And Plans"
Cohesion: 0.17
Nodes (23): canStartSession(), DEFAULT_COST_MODEL, estimateSessionCost(), Margin, MIN_VIABLE_SESSION_SEC, planMargin(), PLANS, PlanSpec (+15 more)

### Community 3 - "Pronunciation Drill Bank"
Cohesion: 0.13
Nodes (34): bestDrillFor(), BY_ID, Drill, DrillKind, DRILLS, drillsFor(), DrillWord, getDrill() (+26 more)

### Community 4 - "Sync Engine Types"
Cohesion: 0.08
Nodes (31): SyncCode, SyncEngineOptions, SyncFetch, SyncHttpResponse, SyncMergeRequest, SyncMergeResult, SyncPhase, SyncPolicy (+23 more)

### Community 5 - "Phrasebook Screen And Storage"
Cohesion: 0.07
Nodes (40): PhrasebookCard(), st, TodayRow(), hasPhrases(), Hold, LESSONS_GROUP, Phrase, Phrasebook (+32 more)

### Community 6 - "Brain Playground Chat CLI"
Cohesion: 0.10
Nodes (42): SessionRecap, applyNonSpokenInput(), supportViewForAssistance(), createProfile(), learnerSnapshotFrom(), main(), pickClient(), Command (+34 more)

### Community 7 - "Claude CLI Run And Usage"
Cohesion: 0.07
Nodes (37): ClaudeCliRun, blocks(), envelope(), EXTRACTION, recordingRun(), addLlmUsage(), billedNothing(), mergedModel() (+29 more)

### Community 8 - "Expo App Config"
Cohesion: 0.10
Nodes (19): expo, icon, ios, name, newArchEnabled, orientation, scheme, slug (+11 more)

### Community 9 - "Mobile App Shell And Auth Flow"
Cohesion: 0.09
Nodes (33): Read the exact versioned Expo docs before writing code, App(), Gate(), st, AuthFlow(), AuthScreen, AuthAction, authButtonLabel() (+25 more)

### Community 10 - "Tutor Agent Package Manifest"
Cohesion: 0.05
Nodes (37): @livekit/agents, @livekit/agents-plugin-anthropic, @livekit/agents-plugin-deepgram, @livekit/agents-plugin-elevenlabs, @livekit/agents-plugin-openai, @livekit/agents-plugin-silero, dependencies, dotenv (+29 more)

### Community 11 - "Safety Policy Corpus Tests"
Cohesion: 0.05
Nodes (30): recordSafetyDecision(), SafetyRecord, ANSWERS_PATH, APP, callCount(), codeOnly(), CONDUCT_PATH, CONVO_PATH (+22 more)

### Community 12 - "Dev Boot Plan"
Cohesion: 0.12
Nodes (18): AgentSecret, APP_PORT, bootPlan(), BootStep, brainOf(), Env, EnvGap, envGaps() (+10 more)

### Community 13 - "Autonomous Build Loop Runner"
Cohesion: 0.07
Nodes (18): ALLOWED_TOOLS, argv, BRANCH, branchNow, current, deadEnds, DRY_RUN, final (+10 more)

### Community 14 - "Difficulty Ladder State"
Cohesion: 0.14
Nodes (27): No number and no scolding mid-session, applyTurn(), clamp(), directiveFor(), initialState(), INSTRUCTION_BY_RUNG, LadderState, nextSessionRung() (+19 more)

### Community 15 - "Auth Adapter And Modes"
Cohesion: 0.19
Nodes (11): build(), AuthMode, AuthModeEnvironment, selectAuthMode(), installationId(), startGoogleSignIn(), createSecureSessionStorage(), createSupabaseAdapter() (+3 more)

### Community 16 - "Talk Again And Authored Path"
Cohesion: 0.12
Nodes (21): offersTalkAgain(), seedTopicFor(), TALK_AGAIN, talkAgainLabel(), AUTHORED_PATH, AuthoredNode, authoredPhraseKeys(), AuthoredUnit (+13 more)

### Community 17 - "TTS Cache Streaming"
Cohesion: 0.06
Nodes (22): CachedChunkedStream, CachedTTS, CachedTTSOptions, defaultMissTransport(), normaliseLine(), ResolvedCachedTTSOptions, FakeChunkedStream, FakeSynthesizeStream (+14 more)

### Community 18 - "Hand Drawn Illustrations"
Cohesion: 0.14
Nodes (38): Frame(), Moving(), Scene(), SceneProps, Stipple(), SpeakBubbles(), HeroCafe(), NobodyYet() (+30 more)

### Community 19 - "Supabase Live Environment Checks"
Cohesion: 0.09
Nodes (24): anonKeyOf(), blockedReport(), CheckOutcome, CheckResult, codeOf(), Environment, Learner, makeRedactor() (+16 more)

### Community 20 - "Drill Exercise Generation"
Cohesion: 0.09
Nodes (21): AppropriateReplyZ, BASE, BestSentenceZ, buildDrillGenerationRequest(), FillBlankZ, GeneratedExerciseZ, INSTRUCTION, ListenTypeZ (+13 more)

### Community 21 - "Brain Package Manifest"
Cohesion: 0.07
Nodes (26): @anthropic-ai/sdk, dependencies, @anthropic-ai/sdk, @parle/core, zod, description, devDependencies, @types/node (+18 more)

### Community 22 - "Token Server Manifest"
Cohesion: 0.08
Nodes (24): jose, livekit-server-sdk, dependencies, dotenv, jose, livekit-server-sdk, @parle/core, devDependencies (+16 more)

### Community 23 - "Brain Playground Manifest"
Cohesion: 0.08
Nodes (25): dependencies, dotenv, @parle/brain, @parle/core, description, devDependencies, @types/node, typescript (+17 more)

### Community 24 - "Mock Speech And Session Screen"
Cohesion: 0.15
Nodes (18): ANGLOPHONE_WEAKNESS, CARRIER, carrierWord(), estimateDurationSec(), jitter(), LearnerProfile, mockObservations(), Phase (+10 more)

### Community 25 - "Dev Process Launcher"
Cohesion: 0.20
Nodes (18): AGENT_ENV_FILE, children, COLOURS, die(), hasClaudeCli(), launch(), main(), probe() (+10 more)

### Community 26 - "Live Conversation Controller"
Cohesion: 0.11
Nodes (6): LearnerTurnInput, ParleConversation, postSessionDeadlineMs(), strictnessOf(), sttLanguageFor(), withDeadline()

### Community 27 - "Drill Session Grading"
Cohesion: 0.14
Nodes (27): DrillVerdict, gradeAnswer(), answerCurrent(), AnsweredExercise, applyDrillResults(), buildDrillSession(), DRILL_STAGES, DrillFeedback (+19 more)

### Community 28 - "Core Package Manifest"
Cohesion: 0.10
Nodes (19): devDependencies, @types/node, typescript, exports, ./ladder, ./lessons, ./metering, ./phonemes (+11 more)

### Community 29 - "App Agent Wire Protocol"
Cohesion: 0.07
Nodes (35): thinkingAfter(), asTheAgentReadsIt(), asTheAppReadsIt(), CLIENT_TAGS, ConvoCoachItem, ConvoSpeakerLine, decodeAs(), decodeClientMessage() (+27 more)

### Community 30 - "Shared TypeScript Config"
Cohesion: 0.10
Nodes (19): DOM, ES2023, compilerOptions, allowImportingTsExtensions, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules (+11 more)

### Community 31 - "HTTP Retry And OpenAI Client"
Cohesion: 0.12
Nodes (22): FetchLike, realSleep(), RETRY_AFTER_CAP_MS, RETRY_AFTER_FALLBACK_MS, retryAfterMs(), SleepLike, cacheKeyFor(), ContractSchema (+14 more)

### Community 32 - "LiveKit Tutor Agent"
Cohesion: 0.19
Nodes (3): currentPrompt(), ParleTutor, rescueOnce()

### Community 33 - "Friends Store Adapter"
Cohesion: 0.08
Nodes (40): build(), caches, createLocalAdapter(), defaultStore(), FriendsStore, isStore(), KEY(), listeners (+32 more)

### Community 34 - "Mobile TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, noEmit, noUncheckedIndexedAccess, strict, types, exclude, extends (+8 more)

### Community 35 - "Root Package Dependency Audit"
Cohesion: 0.05
Nodes (38): advisories, auditFailsAbove, note, reviewed, description, engines, node, name (+30 more)

### Community 36 - "First Run Disclosure Copy"
Cohesion: 0.08
Nodes (29): FIRST_RUN_COPY, FIRST_RUN_SURFACES, FirstRunSurface, MEET_AI, MEET_MIC, MEET_MORE, MEET_PILL, MEET_PRIVACY (+21 more)

### Community 37 - "Mobile App Dependencies"
Cohesion: 0.12
Nodes (17): dependencies, expo-crypto, expo-file-system, expo-font, expo-status-bar, @parle/brain, react-native-svg, @react-navigation/bottom-tabs (+9 more)

### Community 38 - "Mobile Package Manifest"
Cohesion: 0.17
Nodes (11): devDependencies, @types/node, @types/react, typescript, @types/node, typescript, main, name (+3 more)

### Community 39 - "Learner Profile Updates"
Cohesion: 0.15
Nodes (25): normalizeErrorTag(), applyExtractionToProfile(), applyTurnToProfile(), bandIndex(), coachedThisTurn(), EVIDENCE_WINDOW, FACT_KINDS, finishSession() (+17 more)

### Community 40 - "Tutor Onboarding Marks Store"
Cohesion: 0.28
Nodes (15): userKey(), markDirty(), adoptCoachMarks(), adoptTutorIntro(), COACH_MARKS_KEY(), hasSeenTutorIntro(), idsOf(), loadSeenCoachMarks() (+7 more)

### Community 41 - "Brain TS Config"
Cohesion: 0.25
Nodes (7): compilerOptions, types, extends, include, node, src/**/*.ts, ../../tsconfig.base.json

### Community 42 - "Core TS Config"
Cohesion: 0.25
Nodes (7): compilerOptions, types, extends, include, node, src/**/*.ts, ../../tsconfig.base.json

### Community 43 - "Brain Playground TS Config"
Cohesion: 0.25
Nodes (7): compilerOptions, types, extends, include, node, src/**/*.ts, ../../tsconfig.base.json

### Community 44 - "Token Server TS Config"
Cohesion: 0.25
Nodes (7): compilerOptions, types, extends, include, node, src/**/*.ts, ../../tsconfig.base.json

### Community 45 - "Tutor Agent TS Config"
Cohesion: 0.25
Nodes (7): compilerOptions, types, extends, include, node, src/**/*.ts, ../../tsconfig.base.json

### Community 46 - "Convo Screen Disk Tests"
Cohesion: 0.16
Nodes (12): DiskFaults, drill(), earlyExitBatch(), journalledSession(), NOW, ordinaryBatch(), phrase(), PRACTICE (+4 more)

### Community 47 - "Mobile npm Scripts"
Cohesion: 0.25
Nodes (8): scripts, android, export:web, ios, start, test, typecheck, web

### Community 49 - "Session Journal Recovery"
Cohesion: 0.10
Nodes (41): acknowledged(), bankLesson(), bankPractice(), clearAt(), clearJournal(), journalDrills(), journalPractice(), journalRecap() (+33 more)

### Community 50 - "Environment Preflight Probes"
Cohesion: 0.14
Nodes (20): tutorLLM(), frameDeadlineMs(), turnDeadlineMs(), Brain, BRAIN_KEY, Env, FetchLike, missingRequired() (+12 more)

### Community 51 - "Drill Bank Store"
Cohesion: 0.17
Nodes (22): adoptDrillBank(), caches, defaultStore(), DrillStore, getMicSuppressedUntil(), hasGeneratedExercises(), isExercise(), isMicSuppressed() (+14 more)

### Community 52 - "Claude CLI Brain Client"
Cohesion: 0.10
Nodes (29): MemoryExtraction, ScenarioFrame, TutorTurn, Curation, DrillBatch, ClaudeCliBrainClient, extractJson(), jsonSchemaText() (+21 more)

### Community 53 - "Practice Record Ledger Tests"
Cohesion: 0.09
Nodes (20): Entry, EVIDENCE, EXTERNAL, FILES, flat(), LEDGER, NEVER_TRUE, outstandingBlockers() (+12 more)

### Community 54 - "Voice Session Lifecycle Checks"
Cohesion: 0.07
Nodes (63): CostModel, Check, checkAgentSecret(), checkConcurrentStart(), checkDepartureClosesRoom(), checkExactlyOnceDebit(), checkHardStop(), checkInsecureUrlRefused() (+55 more)

### Community 57 - "Review Cards And Evidence"
Cohesion: 0.11
Nodes (43): holdFor(), sittingView, buildCardsFromSummary(), addEvidence(), count(), EVIDENCE_STATES, evidenceOf(), EvidenceState (+35 more)

### Community 58 - "Age Gate And Upgrade"
Cohesion: 0.19
Nodes (12): ageConfirmedFromDob(), ageOn(), AgeStopCandidate, MIN_AGE, TODAY, storedGoal(), storedStop(), NOW (+4 more)

### Community 60 - "Account Deletion And Product Events"
Cohesion: 0.10
Nodes (28): adminHeaders(), deleteSupabaseUser(), signedInRecently(), agentDebitAllowed(), exactKeys(), insertProductEvent(), missionId(), nonNegativeCount() (+20 more)

### Community 61 - "Secret Scanning Tool"
Cohesion: 0.11
Nodes (33): ALLOW_MARKER, BINARY_EXTENSIONS, BUNDLE_DIRECTORIES, bundleFiles(), Finding, formatFinding(), git(), isCamelCaseName() (+25 more)

### Community 62 - "Review Card View"
Cohesion: 0.12
Nodes (19): AttemptKind, CARD_START, CardAnswer, cardView, faces(), frenchSide(), hearable(), INTRODUCTION_TAG (+11 more)

### Community 63 - "Graphify Guard Hook"
Cohesion: 0.29
Nodes (4): GRAPH, ROOT, ROUTING, SOURCE_EXTS

### Community 66 - "Brain Contract Zod Schemas"
Cohesion: 0.06
Nodes (50): AssessmentZ, CefrBandZ, CoachItemZ, CoachKindZ, MemoryExtractionSchema, MemoryFactZ, NewPhraseZ, OptionZ (+42 more)

### Community 67 - "Upstash Live Checks"
Cohesion: 0.16
Nodes (23): blockedReport(), CheckResult, CheckStatus, expect(), freePort(), Instance, isHashedSegment(), keyShapeProblem() (+15 more)

### Community 68 - "Conversation Screen And Profile"
Cohesion: 0.05
Nodes (70): Ctx, useProfile(), ConvoScreen(), practiceBatch(), st, CONNECTING_STAGES, CONNECTING_TICK_MS, ConnectingStage (+62 more)

### Community 69 - "Onboarding Profile Store"
Cohesion: 0.09
Nodes (35): ProfileGate(), ProfileValue, learner(), adoptProfile(), completeProfile(), confirmedFrom(), createStoredProfile(), KEY() (+27 more)

### Community 70 - "Release Gate Runner"
Cohesion: 0.08
Nodes (18): AGENT_MODELS, agentFiles, args, asJson, auditOnly, bless, counts, entries (+10 more)

### Community 71 - "Friendly Error Copy"
Cohesion: 0.18
Nodes (8): deletionFailure(), friendly(), GENERIC_FAILURE, GOOGLE_START_FAILED, passwordProse(), ProviderFailure, REPO_ROOT, weakPassword()

### Community 72 - "Tutor Behaviour Bug Ledger"
Cohesion: 0.01
Nodes (282): A1 — A spoken answer has to match the script exactly, A2 — An empty transcript is graded as a wrong answer, A3 — A freeze at the top rung still asks the learner to invent French, A4 — A rescue can skip the beat the learner froze on, A5 — Two different opening-rung formulas, A6 — A focus point vanishes when the worst sound has no drill, A7 — A v2 snapshot with no memory crashes the worker, B0 — ParleTutor cannot be tested at all (+274 more)

### Community 73 - "Agent Fleet Frontmatter Checks"
Cohesion: 0.20
Nodes (11): AgentFrontmatter, agentProblems(), FRONTMATTER_FIELDS, frontmatterBlock(), parseAgentFrontmatter(), pinnedAgents(), READ_ONLY_AGENTS, routedAgents() (+3 more)

### Community 74 - "Gate Evidence Contract"
Cohesion: 0.06
Nodes (34): classify(), evidence, EVIDENCE_PATH, evidenceFlat, FLOORS_PATH, GateRun, ledger, LEDGER_PATH (+26 more)

### Community 75 - "Mission Chooser View"
Cohesion: 0.06
Nodes (56): CHOOSER_HEADLINE, CHOOSER_SUB, ChooserCard, ChooserInput, chooserView, FINISHED_LINE, hasSpokenBefore(), headMissionId() (+48 more)

### Community 77 - "Rate Limiting And Session Leases"
Cohesion: 0.08
Nodes (19): CONSUME_SCRIPT, Counter, createRateLimiter(), createSessionLeaseStore(), FetchLike, MemoryRateLimiter, MemorySessionLeaseStore, privateSignal() (+11 more)

### Community 79 - "Analytics Events And Onboarding Answers"
Cohesion: 0.09
Nodes (28): REPORTED_BY_PAGE, UNION, AGE_QUESTION, AGE_REFUSAL, AGE_RETURN_SUB, AGE_RETURN_TITLE, AGE_SUB, answersFrom() (+20 more)

### Community 80 - "Pronunciation Scoring & IPA"
Cohesion: 0.18
Nodes (9): A missing score is never an invented penalty, ALIASES, FRENCH_IPA, toInventoryIpa(), parseSpeechace(), ScoreFetch, ScoreRequest, scoreUtterance() (+1 more)

### Community 82 - "Database Migration Contract Tests"
Cohesion: 0.08
Nodes (30): and3(), branchTaken(), claimOutcome(), CreatedObject, createdObjects(), debitFixMigration, effectiveBody(), effectiveClaimTrialBody() (+22 more)

### Community 83 - "Sync Retention Policy Limits"
Cohesion: 0.07
Nodes (15): ACTIVITY_KEEP_DAYS, MAX_COMPLETIONS_PER_MISSION, MAX_HISTORY_SESSIONS, MAX_SOUND_CHECKS, SYNC_EXCLUSIONS, adoptedNamespaces(), BASE, blobFor() (+7 more)

### Community 85 - "Paper UI Primitives"
Cohesion: 0.06
Nodes (85): ArrowRight(), Card(), ChevronLeft(), EarGlyph(), GhostButton(), HelpGlyph(), Label(), LineBullet() (+77 more)

### Community 86 - "Cafe Lesson Definitions"
Cohesion: 0.15
Nodes (23): Chrome is plain English, French only where it is content, CAFE_LESSON, BY_ID, getLesson(), LESSONS, AcceptanceMatch, AcceptanceRoute, candidatesFor() (+15 more)

### Community 87 - "Sound Check Store"
Cohesion: 0.29
Nodes (13): adoptSoundChecks(), isEvidence(), isKind(), KEY(), loadSoundChecks(), persisted(), read(), recordSoundCheck() (+5 more)

### Community 88 - "Pedagogy Doc"
Cohesion: 0.20
Nodes (9): One focus, one drill, The four rungs, The invariants, The pedagogy, The rescue, Two independent axes, What counts as a right answer, What counts as learned (+1 more)

### Community 89 - "Live Session Hook Tests"
Cohesion: 0.06
Nodes (33): ABANDON, asJs(), AsyncFunction, AUDIO_BLOCKS, deliver(), DISMISS, EVERY_FAILURE, fragment() (+25 more)

### Community 90 - "Live Voice Doc"
Cohesion: 0.25
Nodes (7): Audio, and what may be claimed about it, Serialisation, The four modes, The live path, The route, The wire, When it fails

### Community 91 - "Loop Doc"
Cohesion: 0.29
Nodes (7): Giving it a goal, Running it, The agents, The bar, The loop, The other half: building something new, Verifying UI work

### Community 92 - "State & Storage Doc"
Cohesion: 0.17
Nodes (12): Attempt audio, and the one thing on the phone that is not a key, Banking a conversation, and when the journal is allowed to go, Device-level keys, and the one that retired, On the device, Server side, Sessions and progress, State and storage, The age stop, and exactly how strong it is (+4 more)

### Community 93 - "Testing Doc"
Cohesion: 0.29
Nodes (6): Never, Running, Testing, The rule that matters most, What is not covered, Writing

### Community 94 - "Bug Hunter Agent"
Cohesion: 0.33
Nodes (5): House style, How you work, Product invariants — a change that breaks one of these is a bug, however green, What counts as a finding, What you must never do

### Community 95 - "Architecture Doc"
Cohesion: 0.40
Nodes (5): Architecture, Mock or live, No build step, Two paths, one ladder, Who owns what

### Community 96 - "Docs Index"
Cohesion: 0.22
Nodes (3): Deletion and supersession ledger, Known issues — the goal file, docs

### Community 97 - "Conversation Flow Orchestration"
Cohesion: 0.04
Nodes (53): supportViewFor(), ActivitySpend, asSentence(), BRAIN_ACTIVITIES, BrainActivity, brainClient(), cacheHitRate(), chargedInput() (+45 more)

### Community 100 - "Live Session React Context"
Cohesion: 0.08
Nodes (40): Ctx, LiveProvider(), LiveValue, useLive(), loadDrillBank(), DrillScreen(), verdictColor(), assertBankedExactlyOnce() (+32 more)

### Community 101 - "Guilt Free Copy Checks"
Cohesion: 0.16
Nodes (11): BANNED_IN_COPY, guiltIn(), normalise(), ONCE_BANNED, between(), FLAT, markTag(), SCREEN (+3 more)

### Community 102 - "Status Line & Tutor Name"
Cohesion: 0.26
Nodes (6): PathNodeRow(), MOMENT_ANSWER_MS, momentAnswer(), statusLine(), SRC, TUTOR_NAME

### Community 103 - "Sync Engine Reconciliation"
Cohesion: 0.07
Nodes (31): SyncEngine, createSyncPolicy(), dirtySettled(), anonKeyOf(), blockedReport(), CheckOutcome, CheckResult, Device (+23 more)

### Community 104 - "French Authenticity Pack"
Cohesion: 0.09
Nodes (31): FR_PACK, renderAuthenticityPack(), AuthenticityPack, ContrastPair, Filler, RegisterDef, SlangEntry, LearnerSnapshot (+23 more)

### Community 105 - "Deploy Engineer Agent"
Cohesion: 0.22
Nodes (8): How you work, Product invariants — a change that breaks one of these is wrong, however green, Ship the smallest real thing, Start by being honest about where this is, The order this has to happen in, What you must never do, When there is nothing to deploy to, say so, Your territory

### Community 106 - "Observability Engineer Agent"
Cohesion: 0.22
Nodes (8): How you work, Product invariants — a change that breaks one of these is wrong, however green, The line you do not cross, The seam to cut, when the time comes, What exists, and what does not, What you must never do, When there is no seam yet, say so, Your territory

### Community 107 - "Revenue Engineer Agent"
Cohesion: 0.20
Nodes (9): Copy about money is still learner copy, Handoff contract, How you work, Product invariants — a change that breaks one of these is wrong, however green, The rule enforcement lives at, What already exists, What you must never do, Where a purchase lands (+1 more)

### Community 108 - "Scene Support Controls"
Cohesion: 0.27
Nodes (9): hasSayableSupportLine(), sceneControls, controls(), fullLine, hint, none, options, ClientMessage (+1 more)

### Community 111 - "Coach Output Samples And Checks"
Cohesion: 0.05
Nodes (74): sampleCoachItem(), sampleSupport(), sampleTurn(), Assessment, CoachItem, SpeakerLine, SupportView, copyViolations() (+66 more)

### Community 112 - "Forge Command Doc"
Cohesion: 0.22
Nodes (9): /forge, Looping it, Not wired yet: the unattended loop, The contract, The gate watches the wiring too, Watch for judge drift, Who actually builds it, Why the judge's findings go in the ledger (+1 more)

### Community 113 - "Paper Palette Tokens"
Cohesion: 0.14
Nodes (16): accents, HASHED, ink, Paper, PaperName, papers, ALL, CARRIED (+8 more)

### Community 115 - "Secure Session Storage"
Cohesion: 0.22
Nodes (10): chunkKey(), KeyValueStorage, metaKey(), parseMeta(), readSecure(), removeAllGenerations(), removeGeneration(), StoredMeta (+2 more)

### Community 116 - "User Scope Data Reset"
Cohesion: 0.16
Nodes (16): SignedInRoot(), AttemptAudioSweepResult, sweepAttemptAudio(), ATTEMPT_AUDIO_NOT_SWEPT, clearActiveUserData(), ClearHooks, LEGACY_KEYS, migrateLegacyStores() (+8 more)

### Community 117 - "Profile Merge Rules"
Cohesion: 0.10
Nodes (37): ANSWER_FIELD_SET, compareEvidence(), compareStrings(), coreSlice(), DEVICE_FIELD_SET, finish(), finiteOr(), identityOf() (+29 more)

### Community 118 - "API Engineer Agent"
Cohesion: 0.25
Nodes (7): How you work, Product invariants — a change that breaks one of these is wrong, however green, The LLM layer, The rule that matters most, The shape of the API, What you must never do, Your territory

### Community 119 - "Performance Engineer Agent"
Cohesion: 0.25
Nodes (7): How the TTS cache actually works, How you work, Product invariants — a change that breaks one of these is wrong, however green, Prompt caching, The number, What you must never do, Your territory

### Community 120 - "Security Engineer Agent"
Cohesion: 0.22
Nodes (8): Handoff contract, How you work, Product invariants — a change that breaks one of these is wrong, however green, The habits already in the code, which you should extend, What is actually true today, unvarnished, What you must never do, When dispatched by /ship, Your territory

### Community 121 - "Auth Engineer Agent"
Cohesion: 0.29
Nodes (6): How you work, Product invariants — a change that breaks one of these is wrong, however green, The seam, and why it is shaped this way, The server side, What you must never do, Your territory

### Community 122 - "Backend Engineer Agent"
Cohesion: 0.29
Nodes (6): How you work, Product invariants — a change that breaks one of these is wrong, however green, Running it locally, What this stack does not have, What you must never do, Your territory

### Community 123 - "Data Engineer Agent"
Cohesion: 0.29
Nodes (6): How you work, Product invariants — a change that breaks one of these is wrong, however green, What is actually true today, What you must never do, When a database is proposed, Your territory

### Community 124 - "Frontend Engineer Agent"
Cohesion: 0.29
Nodes (6): How you work, Product invariants — a change that breaks one of these is wrong, however green, The constraints that are not negotiable, The one thing that catches everyone out, What you must never do, Your territory

### Community 125 - "Team Doc"
Cohesion: 0.29
Nodes (7): Calling them, Territory is the point, The gate defends the fleet, The independent reviewers, The team, Three of them are ahead of the code, Who owns what

### Community 126 - "Design Architect Agent"
Cohesion: 0.33
Nodes (5): Orienting yourself, The ledger format is parsed, not read, The question you are actually answering, What you must never do, Your output — the contract

### Community 127 - "Scaling Engineer Agent"
Cohesion: 0.33
Nodes (5): Default answer, The checks, What genuinely blocks a second instance today, What you must never do, Your output

### Community 128 - "Tab Bar Icons"
Cohesion: 0.21
Nodes (12): HomeIcon(), MyFrenchIcon(), PracticeIcon(), ProfileIcon(), TabIconProps, TutorIcon(), announceTab(), ICONS (+4 more)

### Community 129 - "Release Engineer Agent"
Cohesion: 0.40
Nodes (4): The bar, The checks, What you must never do, Your output

### Community 130 - "Work Judge Agent"
Cohesion: 0.40
Nodes (4): The bar for sending work back, The checks, You may not grow the job, Your output

### Community 131 - "Review Deck Store"
Cohesion: 0.21
Nodes (19): addFromSummary(), addPhrases(), adoptDeck(), caches, CardGrade, foldConvoUses(), gradeCard(), gradeCards() (+11 more)

### Community 138 - "Android App Config"
Cohesion: 0.20
Nodes (10): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, package, permissions, predictiveBackGestureEnabled (+2 more)

### Community 139 - "Session Token Grants"
Cohesion: 0.20
Nodes (14): developmentEntitlementsEnabled(), GrantResult, grantSession(), ROOM_LIFECYCLE, roomNameFor(), SeedTopic, SessionGrant, SessionMode (+6 more)

### Community 140 - "Drill Screen And Tracking"
Cohesion: 0.06
Nodes (48): ProductEvent, trackProductEvent(), auth, authHeaders(), fitDisplay(), MicGlyph(), SpeakCircle(), AppropriateReplyView() (+40 more)

### Community 141 - "Device Verification Checklist"
Cohesion: 0.12
Nodes (17): Android, Before you start, D15 — a keystore key invalidated by a lock-screen change, D16 — restored from an Android backup, Device verification — auth, session storage, deletion, and the first run, O1 — every first-run screen is reachable, O2 — the same at the largest text size, O3 — reduce motion (+9 more)

### Community 142 - "Sync Diagnostics And Alarms"
Cohesion: 0.10
Nodes (27): startAccountSync(), ALARM_CODES, ALARM_STATUSES, counter(), createSyncDiagnostics(), elapsed(), record(), formatSyncDiagnostic() (+19 more)

### Community 143 - "Store Binding Integration Tests"
Cohesion: 0.09
Nodes (12): landingOf(), localProfile, nextUid(), phraseKeysOnDisk(), profileAfterConvo, QUEUED_WRITES, QueuedWrite, recap (+4 more)

### Community 144 - "Turn Timing Instrumentation"
Cohesion: 0.24
Nodes (11): TokenMeta, createTurnTiming(), formatTiming(), formatVendorMetrics(), mark(), SEGMENTS, TimingStage, TurnTiming (+3 more)

### Community 145 - "Motion And Transcript UI"
Cohesion: 0.11
Nodes (21): MissionWin(), SETTLE_MS, settleIn(), useReduceMotion(), orb, STROKE, Line(), Recast() (+13 more)

### Community 146 - "Server User Resolution"
Cohesion: 0.25
Nodes (5): createUserResolver(), ResolvedUser, SIGN_IN_REQUIRED, UserResolver, VerifierConfig

### Community 147 - "Dependency Lockfile Resolution"
Cohesion: 0.14
Nodes (13): accepted, AdvisoryDecision, dependencyClosure(), fixed, lock, LockEntry, Lockfile, manifest (+5 more)

### Community 148 - "Practice Data Export & History"
Cohesion: 0.26
Nodes (12): buildEntries(), csvField(), ExportEntry, toAnkiTsv(), toCsv(), buildReport(), buildTrends(), mean() (+4 more)

### Community 149 - "XP And Levels"
Cohesion: 0.25
Nodes (17): clamp(), ConversationEvidence, conversationXp(), DAILY_XP_CAP, DatedXp, DrillEvidence, drillXp(), LessonEvidence (+9 more)

### Community 150 - "Land Command Doc"
Cohesion: 0.25
Nodes (7): 1. Who else is in this tree, 2. Where you are standing, 3. The gate, 4. The shape of the branch, 5. Deciding, 6. Landing, 7. Say what happened

### Community 151 - "Privacy And Safety Review"
Cohesion: 0.11
Nodes (18): An under-13 stop is remembered on this device, Analytics: consent, opt-out and retention, Antifraud identifiers: purpose, retention and disclosure, Deletion and export, Disclosure at first run, Escalation and what Parle is not, Known limits of a deterministic net, Not true yet (+10 more)

### Community 152 - "Test Brain Doubles"
Cohesion: 0.11
Nodes (6): DeadBrain, HeldAnalystBrain, HeldFrameBrain, MeteredBrain, SlowBrain, SlowFrameBrain

### Community 153 - "Motion Usage Tests"
Cohesion: 0.33
Nodes (3): FILES, SRC, stripComments()

### Community 154 - "Ledger Entry Tests"
Cohesion: 0.29
Nodes (5): GROUNDS, HERE, LEDGER, REPO, RULE_TEST

### Community 155 - "Implementation Evidence Matrix"
Cohesion: 0.13
Nodes (14): Applying the schema to whatever project ships, Credential state, measured 2026-08-25, Current focused verification, Current landing snapshot, Failed-room billing: the P0 the phase found, then closed, Feature matrix, Found and fixed during Phase 1, Historical Phase 1 baseline (+6 more)

### Community 156 - "Retired Label Tests"
Cohesion: 0.40
Nodes (5): KEPT, labelsInSource(), RETIRED, sourceFiles(), SRC

### Community 157 - "Onboarding Doc"
Cohesion: 0.29
Nodes (7): Onboarding — everything before the first French word, The files, The shape now, What changed, and why each one, What is measured here, and what is not, What it looked like before, Who never sees any of this

### Community 159 - "Activity Sync Policy"
Cohesion: 0.12
Nodes (42): stableStringify(), ACTIVITY_KINDS, ActivityEntryish, arrayOf(), compareExercises(), compareText(), envelopeOf(), exerciseIdentity() (+34 more)

### Community 160 - "Token Logging Hygiene"
Cohesion: 0.22
Nodes (8): authSources(), callArguments(), loggingCalls(), PLAINTEXT_WRITERS, REPO_ROOT, Source, sources, withoutComments()

### Community 161 - "Fresh Device Startup"
Cohesion: 0.17
Nodes (11): adoptBeforeReady(), adoptedAnything(), FAILED, FRESH_DEVICE_BUDGET_MS, FreshStart, FreshStartKind, FreshStartOptions, settled() (+3 more)

### Community 162 - "Mission Completion Store"
Cohesion: 0.18
Nodes (16): source, adoptMissionCompletions(), COMPLETIONS_PER_MISSION, isCompletion(), KEY(), MissionCompletion, persistedCompletions(), readCompletions() (+8 more)

### Community 163 - "Agent Prompt And Turn Queue"
Cohesion: 0.09
Nodes (16): TEXT_SILENCE_MS, baseInstructions(), buildPrompt(), turnInstructions(), TurnQueue, forgetReportedSessions(), noteSessionReported(), Publisher (+8 more)

### Community 164 - "Tutor Brain Doc"
Cohesion: 0.33
Nodes (5): Acceptance checks, Cost envelope, Product contract, Provider decision, The free-form tutor brain

### Community 165 - "Review Deck Merge"
Cohesion: 0.30
Nodes (13): canonical(), CARD_KINDS, counted(), countersOf(), deckOf(), gradesApplied(), higherCounts(), isFiniteNumber() (+5 more)

### Community 167 - "Expo Plugins & File Saving"
Cohesion: 0.25
Nodes (6): plugins, expo-font, expo-secure-store, expo-sharing, expo-web-browser, @livekit/react-native-expo-plugin

### Community 169 - "Spaced Repetition Engine Tests"
Cohesion: 0.09
Nodes (31): Card, deckPolicy, engineFor(), FakeRow, FoldCall, foldingStore(), keyFor(), manualScheduler() (+23 more)

### Community 170 - "HTTP Origin & Security Headers"
Cohesion: 0.39
Nodes (7): applyHttpSecurity(), createOriginPolicy(), DEVELOPMENT_ORIGINS, originAllowed(), OriginPolicy, parseAllowedOrigins(), requestOrigin()

### Community 171 - "Token Server URL Selection"
Cohesion: 0.38
Nodes (4): selectTokenServerUrl(), SRC, TOKEN_SERVER, TokenServerEnvironment

### Community 172 - "Supabase Runbook"
Cohesion: 0.25
Nodes (7): Apply, Backup, Restore, Rollback, Rollback evidence, Supabase runbook, When something goes wrong

### Community 173 - "Retry Backoff Policy"
Cohesion: 0.16
Nodes (7): Backoff, BACKOFF_BASE_MS, BACKOFF_CAP_MS, backoffCeiling(), backoffDelay(), BackoffOptions, createBackoff()

### Community 174 - "Pronunciation Session Feedback"
Cohesion: 0.14
Nodes (27): PhonemeObservation, CORRECTION_COOLDOWN_TURNS, createSession(), FEEDBACK, FEEDBACK_FAMILIES, feedbackMessage(), grade(), INTELLIGIBLE (+19 more)

### Community 175 - "Supabase Test Doubles"
Cohesion: 0.15
Nodes (10): expect(), main(), newEmail(), newPassword(), PostgrestFilter, PostgrestTable, runSupabaseVerification(), signal() (+2 more)

### Community 176 - "Server Config Validation"
Cohesion: 0.53
Nodes (4): exactHttpsOrigin(), productionConfigurationProblems(), secureUrl(), ServerEnvironment

### Community 177 - "Product Orchestrator Agent"
Cohesion: 0.40
Nodes (4): Boundaries and escalation, Completion, Decision rights, Handoff contract

### Community 178 - "Current State Map"
Cohesion: 0.40
Nodes (4): Current-state map, Replacement/dependency graph, Runtime path, Sources of truth

### Community 179 - "Risk Register"
Cohesion: 0.29
Nodes (6): Abandoned rooms: a risk this register overstated, Failed-room billing: a control this register claimed, lost, and rebuilt, Phase 4 practice: one risk closed, three accepted, one question left open, Phase 5 tutor: two repairs, and six risks kept open on purpose, Risk register, Trial farming: theoretical no longer

### Community 180 - "Repository Archaeologist Agent"
Cohesion: 0.50
Nodes (3): Boundaries and escalation, Handoff contract, Output

### Community 192 - "TTS Voice Cache Build"
Cohesion: 0.17
Nodes (12): CONVO_LINES, buildTTS(), DEFAULT_CACHE_DIR, LANGUAGE_CODE, MODEL, PROBE_LINE, SETTINGS_FINGERPRINT, ENV_KEYS (+4 more)

### Community 203 - "Session Domain Types"
Cohesion: 0.21
Nodes (14): PracticeBatch, SessionJournal, LiveSession, PhraseUse, SessionViewProps, ReplayLine, Rung, ConvoPhrase (+6 more)

### Community 204 - "Safety Category Taxonomy"
Cohesion: 0.06
Nodes (32): AGE_STANDS_ALONE, APPROACH_DIRECT, APPROACH_REQUEST, DANGEROUS, DANGEROUS_OBJECT, DEPENDENCY, GUARDIAN_SECRECY, HATE_ATROCITY (+24 more)

### Community 205 - "Mock Auth Adapter"
Cohesion: 0.25
Nodes (9): createMockAdapter(), notify(), setSession(), emptyStore(), MockAccount, MockStore, readStore(), toUser() (+1 more)

### Community 206 - "Coach Copy Rules"
Cohesion: 0.08
Nodes (28): CoachKind, ANGLICISM, BLOCKING_ERROR, BY_KIND, coachFallbackLine(), CopyRule, EM_DASH_RE, ENGLISH_HAND_BACK (+20 more)

### Community 207 - "Product Principles & Design World"
Cohesion: 0.17
Nodes (12): Paper colour token set, Paper & Ink design world, Absolute-beginner audience (CEFR A0-A2), Everything spoken must also be readable, Absent evidence must not be fabricated, Parle (working name), Expo + TypeScript npm-workspaces monorepo, Trustworthy pronunciation needs a reference text (+4 more)

### Community 209 - "Phrasebook Mix Offers"
Cohesion: 0.13
Nodes (23): card(), days(), NOW, topic(), MIX_OFFER, offersMix(), sittingTitle(), CAFE (+15 more)

### Community 211 - "Delivery Roadmap Phases"
Cohesion: 0.22
Nodes (8): Delivery roadmap, Phase 4 execution order, and what was built against it, Phase 5: what the exit criterion means, and where it stands, Phase 6: what the exit criterion means, and where it stands, Phase boundary: Phase 3 landed, Phase 4 branched from it, then Phase 4 landed too, What each noun means, What Phase 4 did not verify, What Phase 6a did not verify

### Community 213 - "Pipeline Failure Classification"
Cohesion: 0.07
Nodes (27): AUDIO_ONLY, classifyPipelineError(), COPY, KIND_FAILURE, KIND_NOTICE, LiveFailure, PIPELINE_ALARM_PREFIX, PIPELINE_LOG_PREFIX (+19 more)

### Community 214 - "Anthropic Brain Client"
Cohesion: 0.33
Nodes (5): AnthropicBrainClient, outputConfig(), parse(), toProviderMessages(), usageOf()

### Community 215 - "Progress History Store"
Cohesion: 0.29
Nodes (12): adoptHistory(), isSession(), KEY(), loadHistory(), persistedHistory(), readHistory(), recordSession(), registerAdopter() (+4 more)

### Community 216 - "Drill Exercise Bank Merge"
Cohesion: 0.20
Nodes (6): MAX_DRILL_EXERCISES, mergeExerciseBank(), check(), checkDrill(), DRILL_FIXTURES, DrillExercise

### Community 217 - "Drill Batch Validation"
Cohesion: 0.27
Nodes (13): DrillDifficulty, checkAccepted(), checkDistinct(), englishGlosses(), expectedDifficulty(), inRange(), LabelledString, learnerVisibleStrings() (+5 more)

### Community 218 - "Memory Fact Extraction Prompt"
Cohesion: 0.31
Nodes (9): MemoryFact, ChatMessage, buildExtractionRequest(), ExtractionInput, factLine(), INSTRUCTION, interview, request() (+1 more)

### Community 219 - "Audio Session Globals And Safety"
Cohesion: 0.07
Nodes (51): classifyFailure(), micApiUnavailable(), ensureAudioSession(), ensureLiveKitGlobals(), releaseAudioSession(), afterDismiss(), OPENING_TAGS, opensSession() (+43 more)

### Community 220 - "Free Text Drill Grading"
Cohesion: 0.40
Nodes (8): acceptedFor(), gradeFreeText(), GradeResult, realWordSet(), damerauLevenshtein(), sameWord(), TYPO_MAX_DISTANCE, TYPO_MIN_LENGTH

### Community 221 - "Drill Exercise Types"
Cohesion: 0.17
Nodes (18): typed(), withOptions(), AppropriateReplyExercise, BestSentenceExercise, DrillExerciseBase, FillBlankExercise, ListenTypeExercise, RepeatThisExercise (+10 more)

### Community 225 - "Recap Wait Surface"
Cohesion: 0.36
Nodes (6): LEAVE_LABEL, RECAP_COMING, RECAP_COMING_NOTE, RecapWaitState, RecapWaitSurface, convo

### Community 227 - "Turn Handling Thresholds"
Cohesion: 0.29
Nodes (6): ENDPOINTING_MIN_DELAY_MS, INTERRUPTION_MIN_DURATION_MS, INTERRUPTION_MIN_WORDS, SessionMode, TurnHandling, turnHandlingFor()

### Community 228 - "Busy Label Screen Tests"
Cohesion: 0.33
Nodes (5): ACTIONS, openingTag(), SCREENS, SRC_DIR, tags()

### Community 229 - "Delivery Roadmap Contract Tests"
Cohesion: 0.07
Nodes (20): CHOOSING_VIEW_PATH, choosingView, criteriaFor(), declares(), implementationClauses(), KNOWN_ISSUES_PATH, MOBILE_SRC, NounDefinition (+12 more)

### Community 230 - "Device Verification Criteria"
Cohesion: 0.12
Nodes (16): D0 — the build is on the Supabase adapter, D10 — deletion demands a recent Google reauthentication, D11 — a failed local wipe is reported honestly, D12 — no bearer token in logs, in AsyncStorage, or in the bundle, D13 — two accounts on one device never see each other's learning, D14 — the installation signal survives deletion, D1 — a session survives backgrounding, cold start and reboot, D2 — the session is in the keychain, not in plaintext storage (+8 more)

### Community 232 - "Safety Category Corpus"
Cohesion: 0.14
Nodes (14): MinorSexualRule, OutputRule, SAFETY_CATEGORIES, SafetyCategory, CategoryCorpus, CORPUS, everyLine(), FALSE_POSITIVES (+6 more)

### Community 233 - "Drill Screen Tests"
Cohesion: 0.21
Nodes (8): asTheScreenSends(), card(), installDisk(), nextUid(), NOW, withDeck(), DrillSessionState, summarise()

### Community 234 - "Agent Usage Reporting"
Cohesion: 0.40
Nodes (4): reportUsage(), report, UsageReport, UsageReportOptions

### Community 235 - "Session View Typing Ping"
Cohesion: 0.25
Nodes (5): convo, screen, view, shouldPingTyping(), TYPING_PING_MS

### Community 236 - "Acknowledged Persistence Stores"
Cohesion: 0.13
Nodes (17): PersistAck, AcknowledgingStore, STORES, dirtyStamp(), registerSyncAdopter(), resetSyncRegistry(), SyncNamespace, adoptTopics() (+9 more)

### Community 238 - "Storage Doc Tests"
Cohesion: 0.22
Nodes (4): AGENT, CONVO, DOC, REPO

### Community 239 - "Brain Spend Metering Tests"
Cohesion: 0.32
Nodes (6): DEBIT_HOSTS, FULL_TURNS, runSession(), SHORT_TURNS, stubSession(), tapped()

### Community 240 - "Learner State Sync Engine"
Cohesion: 0.30
Nodes (15): startSync(), clearIfRunning(), event(), flushDirty(), headers(), outcome(), pull(), queue() (+7 more)

### Community 244 - "Safety Output Guard"
Cohesion: 0.25
Nodes (8): forms(), has(), loosen(), minorSexualRulesFor(), MinorSexualSignals, normalise(), outputGuard(), safetyDecision

## Knowledge Gaps
- **1658 isolated node(s):** `CurationCheckId`, `CurationProblem`, `CurationScore`, `CurationSummary`, `Environment` (+1653 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **50 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Rung` connect `Session Domain Types` to `Difficulty Ladder State`, `Turn Timing Instrumentation`, `Mock Speech And Session Screen`, `Live Conversation Controller`, `App Agent Wire Protocol`, `LiveKit Tutor Agent`, `Agent Prompt And Turn Queue`, `Learner Profile Updates`, `Pronunciation Session Feedback`, `Conversation Screen And Profile`, `Onboarding Profile Store`, `Mission Chooser View`, `Paper UI Primitives`, `Cafe Lesson Definitions`, `Audio Session Globals And Safety`, `Conversation Flow Orchestration`, `Live Session React Context`, `French Authenticity Pack`, `Coach Output Samples And Checks`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `react` connect `Mobile App Shell And Auth Flow` to `Tab Bar Icons`, `Mobile TypeScript Config`, `Live Session React Context`, `Conversation Screen And Profile`, `Phrasebook Screen And Storage`, `Mission Chooser View`, `Drill Screen And Tracking`, `Motion And Transcript UI`, `Hand Drawn Illustrations`, `Paper UI Primitives`, `Mock Speech And Session Screen`, `Audio Session Globals And Safety`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `ParleConversation` connect `Live Conversation Controller` to `Conversation Flow Orchestration`, `Onboarding Profile Store`, `Session Domain Types`, `Mission Chooser View`, `Coach Output Samples And Checks`, `Turn Timing Instrumentation`, `Brain Spend Metering Tests`, `Claude CLI Brain Client`, `App Agent Wire Protocol`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `CurationCheckId`, `CurationProblem`, `CurationScore` to the rest of the system?**
  _1658 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Entitlement Plan Store` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `Topic Curation Pipeline` be split into smaller, more focused modules?**
  _Cohesion score 0.06019871420222092 - nodes in this community are weakly interconnected._
- **Should `Pronunciation Drill Bank` be split into smaller, more focused modules?**
  _Cohesion score 0.13472706155632985 - nodes in this community are weakly interconnected._