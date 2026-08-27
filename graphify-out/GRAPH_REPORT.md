# Graph Report - Parle  (2026-08-27)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 4309 nodes · 10225 edges · 225 communities (174 shown, 51 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 160 edges (avg confidence: 0.69)
- Token cost: 176,430 input · 3,083 output

## Graph Freshness
- Built from commit: `d24913f8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Entitlement Store
- Review Scheduler
- Session Metering & Plans
- Pronunciation Drills
- Sync Engine Core
- Today Activity Feed
- HTTP & OpenAI Transport
- LLM Usage Pricing
- Expo App Config
- Mobile App Auth Flow
- Tutor Agent Dependencies
- Safety Content Filters
- Dev Boot Plan
- Bug Loop Runner
- Difficulty Ladder
- Supabase and Google OAuth
- Learning Path Graph
- TTS Audio Cache
- Illustration Scenes
- Supabase Live Checks
- Phrase Curation
- Brain Package Manifest
- Token Server Manifest
- Brain Playground Manifest
- Device French Voice Speech
- Namespace Merge Policy
- Parle Conversation Controller
- Drill Screen Test Fixtures
- Core Package Manifest
- Live Failure Classification
- Shared TypeScript Config
- Anthropic Brain Client
- Tutor Prompt Building
- Friends Store Adapter
- Mobile TypeScript Config
- Root Package Manifest
- First Run Disclosure
- Mobile Dependencies
- Mobile Package Manifest
- Learner Profile Updates
- Topics Store
- Brain TypeScript Config
- Core TypeScript Config
- Playground TypeScript Config
- Token Server TypeScript Config
- Tutor Agent TypeScript Config
- Tutor Door Gate Copy
- Mobile npm Scripts
- Native LiveKit Audio Globals
- Practice Journal Store
- Environment Preflight
- Drill Bank Store
- Brain Client Contracts
- Practice Record Gate
- Voice Lifecycle Checks
- Expo Metro Runtime
- Expo Sharing
- Expo Speech
- Age Check and Profile Upgrade
- Expo Web Browser
- Account Deletion & Admin Auth
- Secret Scanning
- Review Card View
- Graphify Routing Guard
- React Native Core
- Async Storage
- Brain Zod Schemas
- Upstash Live Checks
- Conversation Screen UI
- Profile Store & Gate
- Release Gate Script
- Mastery Evidence
- Known Issues Ledger
- Agent Fleet Config
- Evidence Ledger Contract
- Product Event Tracking
- Auth Adapter Interface
- Rate Limiting & Session Leases
- React Native WebRTC
- Onboarding Answers
- Speechace Phoneme Scoring
- React Native Screens
- Database Contract Tests
- Sync Retention Policy
- Supabase JS Client
- Auth Screens & UI Primitives
- Lesson Definitions
- Sound Check Store
- Pedagogy Ladder Doc
- Live Session Hook Tests
- Live Voice Path Doc
- Agent Loop Overview
- State and Storage Docs
- Testing Guide
- Bug Hunter Role
- Playground Architecture
- Docs Index and Architecture
- Conversation Orchestration
- Fix Verifier Role
- Friends & Leaderboard UI
- Auth Mode Selection
- Path Node Status Line
- Live Sync Policy
- French Authenticity Pack
- Deploy Engineer Role
- Observability Engineer Role
- Revenue Engineer Role
- Scene Support Controls
- LiveKit React Native SDK
- Safe Area Context Library
- Session Recap Samples
- Forge Build Loop Doc
- Colour Palette
- Mobile Copy Checks
- Secure Session Storage
- User Scope Reset
- Profile Merge
- API Engineer Role
- Performance Engineer Role
- Security Engineer Role
- Auth Engineer Role
- Backend Engineer Role
- Data Engineer Role
- Frontend Engineer Role
- Team and Territories Doc
- Design Architect Role
- Scaling Engineer Role
- Tab Bar Icons
- Release Engineer Role
- Work Judge Role
- Review Deck Store
- Pre-commit Git Hook
- Pre-push Git Hook
- Git Hooks Installer
- Android App Config
- LiveKit Session Tokens
- Drill Screen Views
- Android Acceptance Checks
- Sync Diagnostics
- Store Binding Tests
- Tutor Agent Timing
- Conversation Screen Tests
- Server User Resolution
- CI Dependency Contract
- Export & History Reports
- XP & Levels
- Landing Decision Command
- Privacy and Safety Policy
- Test Brain Doubles
- Motion Source Checks
- Ledger Record Test
- Implementation Evidence Matrix
- Retired Label Checks
- Onboarding and Known Issues Docs
- Keyboard Tap Screen Checks
- State Merge Helpers
- Token Hygiene Source Scan
- Fresh Device Startup
- Mission Completions Store
- TTS Voice Cache Config
- Tutor Brain Contract Doc
- Review Deck Merging
- Room Join Metadata Test
- Expo Plugins and File Saving
- LiveKit Client Library
- Dev Launcher Script
- HTTP Origin and Security Headers
- Live Context and Token Server URL
- Supabase Runbook
- Retry Backoff
- Mock Speech Session
- Supabase Row Checks
- Server Environment Config
- Product Orchestrator Role
- Current State Map
- Risk Register
- Repository Archaeologist Role
- Data Sync Engineer Role
- Learning Science Engineer Role
- Privacy Safety Engineer Role
- QA Release Engineer Role
- Tutor Behaviour Engineer Role
- Voice Platform Engineer Role
- Server Security Contract Test
- Audio Recorder Checks
- Safety Wiring Test
- Expo Deep Linking
- Expo Secure Storage
- Analytics Surface Contract
- Parle Core Package
- React DOM Renderer
- React Native Web
- Native Stack Navigation
- Design System Engineer Agent
- Onboarding UX Engineer Agent
- Practice UX Engineer Agent
- Progress Retention Engineer Agent
- Social Systems Engineer Agent
- Profile Merge Tests
- Cache Interface
- Mock Auth Adapter
- Store Acknowledgement
- Turn Queue
- Source Text Searchability Test
- Practice Mix Offers
- Attempt Audio Sweep
- Delivery Roadmap Phases
- Memory Fact Extraction Prompt
- Turn Handling Timings
- Session Progress Store
- Drill Exercise Bank Merge
- Stored Shape Type Guards
- Expo File System
- Product Principles and Design World
- Phrasebook and Hold Scheduling
- Disk Fault Injection
- React Library
- LiveKit Expo Plugin
- Expo Audio

## God Nodes (most connected - your core abstractions)
1. `Format` - 188 edges
2. `space()` - 84 edges
3. `ParleConversation` - 55 edges
4. `LlmUsage` - 54 edges
5. `paper` - 50 edges
6. `react` - 38 edges
7. `type` - 37 edges
8. `DrillExercise` - 32 edges
9. `MockLlmClient` - 31 edges
10. `Rung` - 30 edges

## Surprising Connections (you probably didn't know these)
- `A real spoken exchange inside one five-minute session` --rationale_for--> `createSession()`  [INFERRED]
  PRODUCT.md → packages/core/src/session/session.ts
- `Words-right and sounds-right are separate questions` --rationale_for--> `grade()`  [INFERRED]
  PRODUCT.md → packages/core/src/session/session.ts
- `Drill mode and the recognition-to-production ramp` --conceptually_related_to--> `bestDrillFor()`  [INFERRED]
  README.md → packages/core/src/phonemes/drills.ts
- `Words-right and sounds-right are separate questions` --rationale_for--> `TurnFeedback`  [INFERRED]
  PRODUCT.md → packages/core/src/session/session.ts
- `A missing score is never an invented penalty` --rationale_for--> `grade()`  [INFERRED]
  README.md → packages/core/src/session/session.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **The four-rung scaffolding system, from principle to pixel** — product_scaffolding_ladder, product_never_stranded_never_scolded, design_support_colours_cool, packages_core_src_ladder_ladder_applyturn, apps_mobile_src_theme_rungcolor, readme_agent_authoritative [INFERRED 0.85]
- **The trustworthy-pronunciation chain** — product_trustworthy_pronunciation, product_french_only_depth, product_say_one_thing, readme_missing_score_no_penalty, packages_core_src_phonemes_inventory_french_phonemes, packages_core_src_phonemes_drills_drills, packages_core_src_phonemes_scoring_buildreport, services_shared_speechace_scoreutterance [INFERRED 0.85]
- **Unit economics and metering enforcement** — product_metered_minutes, product_cascaded_voice_pipeline, readme_metering_at_token_issuance, readme_tts_warm_cache, readme_risk_cost_per_session, packages_core_src_metering_meter_plans, packages_core_src_metering_meter_estimatesessioncost [INFERRED 0.85]

## Communities (225 total, 51 thin omitted)

### Community 0 - "Entitlement Store"
Cohesion: 0.11
Nodes (9): Entitlement, Plan, DevelopmentEntitlementStore, entitlementFrom(), EntitlementStore, FileEntitlementStore, InMemoryEntitlementStore, SupabaseEntitlementRow (+1 more)

### Community 1 - "Review Scheduler"
Cohesion: 0.20
Nodes (17): addFromSummary(), buildCardsFromSummary(), PhraseEvidence, AGAIN_RETRY_MS, applyGrade(), DEFAULT_EASE, DUE_CAP, earned() (+9 more)

### Community 2 - "Session Metering & Plans"
Cohesion: 0.17
Nodes (23): canStartSession(), DEFAULT_COST_MODEL, estimateSessionCost(), Margin, MIN_VIABLE_SESSION_SEC, planMargin(), PLANS, PlanSpec (+15 more)

### Community 3 - "Pronunciation Drills"
Cohesion: 0.12
Nodes (36): check(), checkDrill(), bestDrillFor(), BY_ID, Drill, DrillKind, DRILLS, drillsFor() (+28 more)

### Community 4 - "Sync Engine Core"
Cohesion: 0.05
Nodes (67): startSync(), clearIfRunning(), event(), flushDirty(), headers(), outcome(), pull(), queue() (+59 more)

### Community 5 - "Today Activity Feed"
Cohesion: 0.11
Nodes (27): st, TodayRow(), ActivityEntry, ActivityKind, adoptActivity(), backfillFrom(), chain, empty() (+19 more)

### Community 6 - "HTTP & OpenAI Transport"
Cohesion: 0.10
Nodes (27): FetchLike, realSleep(), RETRY_AFTER_CAP_MS, RETRY_AFTER_FALLBACK_MS, SleepLike, cacheKeyFor(), ContractSchema, DEFAULT_OPENAI_TURN_MODEL (+19 more)

### Community 7 - "LLM Usage Pricing"
Cohesion: 0.07
Nodes (59): carriesFrench(), addLlmUsage(), ZERO_USAGE, defaultModel(), DEFAULT_OPENAI_ANALYST_MODEL, costUsd(), FALLBACK_PRICE_MODEL, MtokPrices (+51 more)

### Community 8 - "Expo App Config"
Cohesion: 0.10
Nodes (19): expo, icon, ios, name, newArchEnabled, orientation, scheme, slug (+11 more)

### Community 9 - "Mobile App Auth Flow"
Cohesion: 0.07
Nodes (36): Read the exact versioned Expo docs before writing code, App(), Gate(), st, AuthFlow(), AuthScreen, SetNewPasswordScreen(), st (+28 more)

### Community 10 - "Tutor Agent Dependencies"
Cohesion: 0.05
Nodes (37): @livekit/agents, @livekit/agents-plugin-anthropic, @livekit/agents-plugin-deepgram, @livekit/agents-plugin-elevenlabs, @livekit/agents-plugin-openai, @livekit/agents-plugin-silero, dependencies, dotenv (+29 more)

### Community 11 - "Safety Content Filters"
Cohesion: 0.05
Nodes (37): DANGEROUS, DEPENDENCY, forms(), GROOMING_APPROACH, GROOMING_SECRECY, has(), HATE_OR_HARASSMENT, HOMOGLYPH_RE (+29 more)

### Community 12 - "Dev Boot Plan"
Cohesion: 0.12
Nodes (18): AgentSecret, APP_PORT, bootPlan(), BootStep, brainOf(), Env, EnvGap, envGaps() (+10 more)

### Community 13 - "Bug Loop Runner"
Cohesion: 0.07
Nodes (18): ALLOWED_TOOLS, argv, BRANCH, branchNow, current, deadEnds, DRY_RUN, final (+10 more)

### Community 14 - "Difficulty Ladder"
Cohesion: 0.14
Nodes (27): No number and no scolding mid-session, applyTurn(), clamp(), directiveFor(), initialState(), INSTRUCTION_BY_RUNG, LadderState, nextSessionRung() (+19 more)

### Community 15 - "Supabase and Google OAuth"
Cohesion: 0.24
Nodes (6): startGoogleSignIn(), createSecureSessionStorage(), createSupabaseAdapter(), AuthResult, AuthUser, expo-web-browser

### Community 16 - "Learning Path Graph"
Cohesion: 0.17
Nodes (16): AUTHORED_PATH, AuthoredNode, authoredPhraseKeys(), AuthoredUnit, buildPath(), discussedInWords(), drillableKeys(), GENERATED_PREFIX (+8 more)

### Community 17 - "TTS Audio Cache"
Cohesion: 0.06
Nodes (21): CachedChunkedStream, CachedTTS, defaultMissTransport(), normaliseLine(), ResolvedCachedTTSOptions, FakeChunkedStream, FakeSynthesizeStream, FakeTTS (+13 more)

### Community 18 - "Illustration Scenes"
Cohesion: 0.14
Nodes (38): Frame(), Moving(), Scene(), SceneProps, Stipple(), SpeakBubbles(), HeroCafe(), NobodyYet() (+30 more)

### Community 19 - "Supabase Live Checks"
Cohesion: 0.09
Nodes (23): anonKeyOf(), CheckOutcome, CheckResult, codeOf(), Environment, Learner, makeRedactor(), MARK (+15 more)

### Community 20 - "Phrase Curation"
Cohesion: 0.06
Nodes (37): NewPhrase, applyCuration(), buildCurationRequest(), CuratedTopic, CurationInput, CurationSchema, INSTRUCTION, keyOf() (+29 more)

### Community 21 - "Brain Package Manifest"
Cohesion: 0.07
Nodes (26): @anthropic-ai/sdk, dependencies, @anthropic-ai/sdk, @parle/core, zod, description, devDependencies, @types/node (+18 more)

### Community 22 - "Token Server Manifest"
Cohesion: 0.08
Nodes (24): jose, livekit-server-sdk, dependencies, dotenv, jose, livekit-server-sdk, @parle/core, devDependencies (+16 more)

### Community 23 - "Brain Playground Manifest"
Cohesion: 0.08
Nodes (24): dependencies, dotenv, @parle/brain, @parle/core, description, devDependencies, @types/node, typescript (+16 more)

### Community 24 - "Device French Voice Speech"
Cohesion: 0.43
Nodes (6): available(), frenchVoice(), loadVoices(), speak(), speakLines(), withTimeout()

### Community 25 - "Namespace Merge Policy"
Cohesion: 0.12
Nodes (15): ACTIVITY_KINDS, ActivityEntryish, isSeen(), mergeReview(), mergeTutorIntro(), MissionCompletionish, NamespacePolicy, SOUND_CHECK_KINDS (+7 more)

### Community 26 - "Parle Conversation Controller"
Cohesion: 0.10
Nodes (14): LearnerTurnInput, blocks(), blocks(), buildSystemBlocks(), ParleConversation, postSessionDeadlineMs(), sttLanguageFor(), withDeadline() (+6 more)

### Community 27 - "Drill Screen Test Fixtures"
Cohesion: 0.05
Nodes (73): asTheScreenSends(), card(), installDisk(), nextUid(), NOW, withDeck(), DRILL_FIXTURES, acceptedFor() (+65 more)

### Community 28 - "Core Package Manifest"
Cohesion: 0.10
Nodes (19): devDependencies, @types/node, typescript, exports, ./ladder, ./lessons, ./metering, ./phonemes (+11 more)

### Community 29 - "Live Failure Classification"
Cohesion: 0.05
Nodes (67): classifyFailure(), COPY, failureCopy, LiveFailure, micApiUnavailable(), EVERY_FAILURE, TokenServerError, ensureAudioSession() (+59 more)

### Community 30 - "Shared TypeScript Config"
Cohesion: 0.10
Nodes (19): DOM, ES2023, compilerOptions, allowImportingTsExtensions, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules (+11 more)

### Community 31 - "Anthropic Brain Client"
Cohesion: 0.10
Nodes (22): AnthropicBrainClient, AnthropicBrainConfig, outputConfig(), parse(), ParseCapableSdk, ParsedResponse, toProviderMessages(), usageOf() (+14 more)

### Community 32 - "Tutor Prompt Building"
Cohesion: 0.09
Nodes (21): Lesson, currentPrompt(), baseInstructions(), buildPrompt(), turnInstructions(), forgetReportedSessions(), noteSessionReported(), ParleTutor (+13 more)

### Community 33 - "Friends Store Adapter"
Cohesion: 0.08
Nodes (38): build(), caches, createLocalAdapter(), defaultStore(), FriendsStore, isStore(), KEY(), listeners (+30 more)

### Community 34 - "Mobile TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, noEmit, noUncheckedIndexedAccess, strict, types, exclude, extends (+8 more)

### Community 35 - "Root Package Manifest"
Cohesion: 0.05
Nodes (38): advisories, auditFailsAbove, note, reviewed, description, engines, node, name (+30 more)

### Community 36 - "First Run Disclosure"
Cohesion: 0.15
Nodes (21): FIRST_RUN_COPY, FirstRunSurface, MEET_AI, MEET_MIC, MEET_MORE, MEET_PILL, MEET_PRIVACY, MEET_TITLE (+13 more)

### Community 37 - "Mobile Dependencies"
Cohesion: 0.12
Nodes (17): dependencies, expo, expo-crypto, expo-font, expo-status-bar, @parle/brain, react-native-svg, @react-navigation/bottom-tabs (+9 more)

### Community 38 - "Mobile Package Manifest"
Cohesion: 0.17
Nodes (11): devDependencies, @types/node, @types/react, typescript, @types/node, typescript, main, name (+3 more)

### Community 39 - "Learner Profile Updates"
Cohesion: 0.18
Nodes (20): normalizeErrorTag(), applyExtractionToProfile(), applyTurnToProfile(), bandIndex(), evictOverflowPhrases(), evictStalePatterns(), EVIDENCE_WINDOW, finishSession() (+12 more)

### Community 40 - "Topics Store"
Cohesion: 0.16
Nodes (26): userKey(), markDirty(), registerSyncAdopter(), adoptTopics(), KEY(), mergeSessionTopics(), persistedTopics(), readTopics() (+18 more)

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

### Community 46 - "Tutor Door Gate Copy"
Cohesion: 0.25
Nodes (7): TUTOR_INTRO_LINK, TUTOR_OFFLINE, TutorDoor, TutorDoorKey, tutorDoors(), tutorGate, TutorOfflineCopy

### Community 47 - "Mobile npm Scripts"
Cohesion: 0.25
Nodes (8): scripts, android, export:web, ios, start, test, typecheck, web

### Community 49 - "Practice Journal Store"
Cohesion: 0.13
Nodes (35): DrillStore, acknowledged(), bankPractice(), clearAt(), clearJournal(), journalDrills(), journalRecap(), KEY() (+27 more)

### Community 50 - "Environment Preflight"
Cohesion: 0.14
Nodes (21): frameDeadlineMs(), turnDeadlineMs(), Brain, BRAIN_KEY, Env, FetchLike, missingRequired(), NEAR_MISS_KEYS (+13 more)

### Community 51 - "Drill Bank Store"
Cohesion: 0.18
Nodes (21): adoptDrillBank(), caches, defaultStore(), getMicSuppressedUntil(), hasGeneratedExercises(), isExercise(), isMicSuppressed(), isStore() (+13 more)

### Community 52 - "Brain Client Contracts"
Cohesion: 0.08
Nodes (39): MemoryExtraction, ScenarioFrame, TutorTurn, Curation, DrillBatch, ClaudeCliBrainClient, ClaudeCliRun, CliEnvelope (+31 more)

### Community 53 - "Practice Record Gate"
Cohesion: 0.09
Nodes (20): Entry, EVIDENCE, EXTERNAL, FILES, flat(), LEDGER, NEVER_TRUE, outstandingBlockers() (+12 more)

### Community 54 - "Voice Lifecycle Checks"
Cohesion: 0.07
Nodes (63): CostModel, Check, checkAgentSecret(), checkConcurrentStart(), checkDepartureClosesRoom(), checkExactlyOnceDebit(), checkHardStop(), checkInsecureUrlRefused() (+55 more)

### Community 58 - "Age Check and Profile Upgrade"
Cohesion: 0.23
Nodes (9): ageConfirmedFromDob(), ageOn(), MIN_AGE, TODAY, storedGoal(), NOW, UpgradedProfile, upgradeStored() (+1 more)

### Community 60 - "Account Deletion & Admin Auth"
Cohesion: 0.10
Nodes (29): adminHeaders(), deleteSupabaseUser(), signedInRecently(), agentDebitAllowed(), exactKeys(), insertProductEvent(), missionId(), nonNegativeCount() (+21 more)

### Community 61 - "Secret Scanning"
Cohesion: 0.11
Nodes (32): ALLOW_MARKER, BINARY_EXTENSIONS, BUNDLE_DIRECTORIES, bundleFiles(), Finding, formatFinding(), git(), isCodeReference() (+24 more)

### Community 62 - "Review Card View"
Cohesion: 0.13
Nodes (17): AttemptKind, CARD_START, CardAnswer, cardView, faces(), frenchSide(), hearable(), INTRODUCTION_TAG (+9 more)

### Community 63 - "Graphify Routing Guard"
Cohesion: 0.29
Nodes (4): GRAPH, ROOT, ROUTING, SOURCE_EXTS

### Community 66 - "Brain Zod Schemas"
Cohesion: 0.05
Nodes (54): AssessmentZ, CefrBandZ, CoachItemZ, CoachKindZ, MemoryExtractionSchema, MemoryFactZ, NewPhraseZ, OptionZ (+46 more)

### Community 67 - "Upstash Live Checks"
Cohesion: 0.15
Nodes (24): RATE_LIMITS, blockedReport(), CheckResult, CheckStatus, expect(), freePort(), Instance, isHashedSegment() (+16 more)

### Community 68 - "Conversation Screen UI"
Cohesion: 0.07
Nodes (40): StationLine(), ConvoScreen(), MissionWin(), practiceBatch(), st, SETTLE_MS, settleIn(), useReduceMotion() (+32 more)

### Community 69 - "Profile Store & Gate"
Cohesion: 0.16
Nodes (20): Ctx, ProfileGate(), ProfileValue, needsOnboarding(), adoptProfile(), completeProfile(), confirmedFrom(), createStoredProfile() (+12 more)

### Community 70 - "Release Gate Script"
Cohesion: 0.08
Nodes (18): AGENT_MODELS, agentFiles, args, asJson, auditOnly, bless, counts, entries (+10 more)

### Community 71 - "Mastery Evidence"
Cohesion: 0.16
Nodes (20): addEvidence(), count(), EVIDENCE_STATES, evidenceOf(), EvidenceState, evidenceStateOf(), isMastered(), MASTERY_USES (+12 more)

### Community 72 - "Known Issues Ledger"
Cohesion: 0.01
Nodes (188): A1 — A spoken answer has to match the script exactly, A2 — An empty transcript is graded as a wrong answer, A3 — A freeze at the top rung still asks the learner to invent French, A4 — A rescue can skip the beat the learner froze on, A5 — Two different opening-rung formulas, A6 — A focus point vanishes when the worst sound has no drill, A7 — A v2 snapshot with no memory crashes the worker, B0 — ParleTutor cannot be tested at all (+180 more)

### Community 73 - "Agent Fleet Config"
Cohesion: 0.20
Nodes (11): AgentFrontmatter, agentProblems(), FRONTMATTER_FIELDS, frontmatterBlock(), parseAgentFrontmatter(), pinnedAgents(), READ_ONLY_AGENTS, routedAgents() (+3 more)

### Community 74 - "Evidence Ledger Contract"
Cohesion: 0.08
Nodes (28): classify(), evidence, EVIDENCE_PATH, evidenceFlat, FLOORS_PATH, ledger, LEDGER_PATH, LedgerEntry (+20 more)

### Community 75 - "Product Event Tracking"
Cohesion: 0.08
Nodes (58): ProductEvent, trackProductEvent(), useLive(), assertBankedExactlyOnce(), CHOOSER_HEADLINE, CHOOSER_SUB, ChooserCard, ChooserInput (+50 more)

### Community 77 - "Rate Limiting & Session Leases"
Cohesion: 0.07
Nodes (17): CONSUME_SCRIPT, Counter, createRateLimiter(), createSessionLeaseStore(), FetchLike, MemoryRateLimiter, MemorySessionLeaseStore, RateLimitDecision (+9 more)

### Community 79 - "Onboarding Answers"
Cohesion: 0.13
Nodes (22): AGE_CONFIRM, AGE_DENY, AGE_QUESTION, AGE_REFUSAL, AGE_SUB, ageGate, answersFrom(), NAME_LABEL (+14 more)

### Community 80 - "Speechace Phoneme Scoring"
Cohesion: 0.18
Nodes (9): A missing score is never an invented penalty, ALIASES, FRENCH_IPA, toInventoryIpa(), parseSpeechace(), ScoreFetch, ScoreRequest, scoreUtterance() (+1 more)

### Community 82 - "Database Contract Tests"
Cohesion: 0.08
Nodes (30): and3(), branchTaken(), claimOutcome(), CreatedObject, createdObjects(), debitFixMigration, effectiveBody(), effectiveClaimTrialBody() (+22 more)

### Community 83 - "Sync Retention Policy"
Cohesion: 0.07
Nodes (16): ACTIVITY_KEEP_DAYS, MAX_COMPLETIONS_PER_MISSION, MAX_HISTORY_SESSIONS, MAX_SOUND_CHECKS, SYNC_EXCLUSIONS, SYNC_POLICIES, adoptedNamespaces(), BASE (+8 more)

### Community 85 - "Auth Screens & UI Primitives"
Cohesion: 0.07
Nodes (69): st, st, ArrowRight(), Card(), ChevronLeft(), EarGlyph(), Field(), GhostButton() (+61 more)

### Community 86 - "Lesson Definitions"
Cohesion: 0.15
Nodes (22): Chrome is plain English, French only where it is content, CAFE_LESSON, BY_ID, getLesson(), LESSONS, AcceptanceMatch, AcceptanceRoute, candidatesFor() (+14 more)

### Community 87 - "Sound Check Store"
Cohesion: 0.29
Nodes (13): adoptSoundChecks(), isEvidence(), isKind(), KEY(), loadSoundChecks(), persisted(), read(), recordSoundCheck() (+5 more)

### Community 88 - "Pedagogy Ladder Doc"
Cohesion: 0.20
Nodes (9): One focus, one drill, The four rungs, The invariants, The pedagogy, The rescue, Two independent axes, What counts as a right answer, What counts as learned (+1 more)

### Community 89 - "Live Session Hook Tests"
Cohesion: 0.13
Nodes (14): profileWith(), profileWith(), makeTheCall(), NOW, phrase(), profileWith(), recap(), createProfile() (+6 more)

### Community 90 - "Live Voice Path Doc"
Cohesion: 0.25
Nodes (7): Audio, and what may be claimed about it, Serialisation, The four modes, The live path, The route, The wire, When it fails

### Community 91 - "Agent Loop Overview"
Cohesion: 0.29
Nodes (7): Giving it a goal, Running it, The agents, The bar, The loop, The other half: building something new, Verifying UI work

### Community 92 - "State and Storage Docs"
Cohesion: 0.17
Nodes (11): Attempt audio, and the one thing on the phone that is not a key, Banking a conversation, and when the journal is allowed to go, Device-level keys, and the one that retired, On the device, Server side, Sessions and progress, State and storage, The brain's learner model (+3 more)

### Community 93 - "Testing Guide"
Cohesion: 0.29
Nodes (6): Never, Running, Testing, The rule that matters most, What is not covered, Writing

### Community 94 - "Bug Hunter Role"
Cohesion: 0.33
Nodes (5): House style, How you work, Product invariants — a change that breaks one of these is a bug, however green, What counts as a finding, What you must never do

### Community 95 - "Playground Architecture"
Cohesion: 0.40
Nodes (5): Architecture, Mock or live, No build step, Two paths, one ladder, Who owns what

### Community 97 - "Conversation Orchestration"
Cohesion: 0.05
Nodes (45): supportViewFor(), ActivitySpend, asSentence(), BRAIN_ACTIVITIES, BrainActivity, brainClient(), cacheHitRate(), chargedInput() (+37 more)

### Community 100 - "Friends & Leaderboard UI"
Cohesion: 0.15
Nodes (18): useProfile(), TabBar(), friends, AddFriendsScreen(), defaultUsername(), Monogram(), PersonPlusGlyph(), SampleChip() (+10 more)

### Community 101 - "Auth Mode Selection"
Cohesion: 0.25
Nodes (7): startAccountSync(), auth, build(), AuthMode, AuthModeEnvironment, selectAuthMode(), installationId()

### Community 102 - "Path Node Status Line"
Cohesion: 0.14
Nodes (16): loadDrillBank(), PathNodeRow(), st, MOMENT_ANSWER_MS, momentAnswer(), statusLine(), offersTalkAgain(), seedTopicFor() (+8 more)

### Community 103 - "Live Sync Policy"
Cohesion: 0.07
Nodes (31): SyncEngine, createSyncPolicy(), dirtySettled(), anonKeyOf(), blockedReport(), CheckOutcome, CheckResult, Device (+23 more)

### Community 104 - "French Authenticity Pack"
Cohesion: 0.10
Nodes (28): FR_PACK, renderAuthenticityPack(), AuthenticityPack, ContrastPair, Filler, RegisterDef, SlangEntry, LearnerSnapshot (+20 more)

### Community 105 - "Deploy Engineer Role"
Cohesion: 0.22
Nodes (8): How you work, Product invariants — a change that breaks one of these is wrong, however green, Ship the smallest real thing, Start by being honest about where this is, The order this has to happen in, What you must never do, When there is nothing to deploy to, say so, Your territory

### Community 106 - "Observability Engineer Role"
Cohesion: 0.22
Nodes (8): How you work, Product invariants — a change that breaks one of these is wrong, however green, The line you do not cross, The seam to cut, when the time comes, What exists, and what does not, What you must never do, When there is no seam yet, say so, Your territory

### Community 107 - "Revenue Engineer Role"
Cohesion: 0.20
Nodes (9): Copy about money is still learner copy, Handoff contract, How you work, Product invariants — a change that breaks one of these is wrong, however green, The rule enforcement lives at, What already exists, What you must never do, Where a purchase lands (+1 more)

### Community 108 - "Scene Support Controls"
Cohesion: 0.31
Nodes (8): hasSayableSupportLine(), sceneControls, controls(), fullLine, hint, none, options, typedTurn()

### Community 111 - "Session Recap Samples"
Cohesion: 0.05
Nodes (68): sampleCoachItem(), sampleSupport(), sampleTurn(), Assessment, CoachItem, SessionRecap, SpeakerLine, SupportMaterial (+60 more)

### Community 112 - "Forge Build Loop Doc"
Cohesion: 0.22
Nodes (9): /forge, Looping it, Not wired yet: the unattended loop, The contract, The gate watches the wiring too, Watch for judge drift, Who actually builds it, Why the judge's findings go in the ledger (+1 more)

### Community 113 - "Colour Palette"
Cohesion: 0.15
Nodes (15): accents, HASHED, ink, Paper, PaperName, ALL, CARRIED, channels() (+7 more)

### Community 115 - "Secure Session Storage"
Cohesion: 0.22
Nodes (10): chunkKey(), KeyValueStorage, metaKey(), parseMeta(), readSecure(), removeAllGenerations(), removeGeneration(), StoredMeta (+2 more)

### Community 116 - "User Scope Reset"
Cohesion: 0.16
Nodes (16): SignedInRoot(), AttemptAudioSweepResult, sweepAttemptAudio(), ATTEMPT_AUDIO_NOT_SWEPT, clearActiveUserData(), ClearHooks, LEGACY_KEYS, migrateLegacyStores() (+8 more)

### Community 117 - "Profile Merge"
Cohesion: 0.23
Nodes (22): ANSWER_FIELD_SET, canonical(), compareEvidence(), compareStrings(), coreSlice(), finish(), finiteOr(), identityOf() (+14 more)

### Community 118 - "API Engineer Role"
Cohesion: 0.25
Nodes (7): How you work, Product invariants — a change that breaks one of these is wrong, however green, The LLM layer, The rule that matters most, The shape of the API, What you must never do, Your territory

### Community 119 - "Performance Engineer Role"
Cohesion: 0.25
Nodes (7): How the TTS cache actually works, How you work, Product invariants — a change that breaks one of these is wrong, however green, Prompt caching, The number, What you must never do, Your territory

### Community 120 - "Security Engineer Role"
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

### Community 125 - "Team and Territories Doc"
Cohesion: 0.29
Nodes (7): Calling them, Territory is the point, The gate defends the fleet, The independent reviewers, The team, Three of them are ahead of the code, Who owns what

### Community 126 - "Design Architect Role"
Cohesion: 0.33
Nodes (5): Orienting yourself, The ledger format is parsed, not read, The question you are actually answering, What you must never do, Your output — the contract

### Community 127 - "Scaling Engineer Role"
Cohesion: 0.33
Nodes (5): Default answer, The checks, What genuinely blocks a second instance today, What you must never do, Your output

### Community 128 - "Tab Bar Icons"
Cohesion: 0.18
Nodes (14): HomeIcon(), MyFrenchIcon(), PracticeIcon(), ProfileIcon(), TabIconProps, TutorIcon(), announceTab(), ICONS (+6 more)

### Community 129 - "Release Engineer Role"
Cohesion: 0.40
Nodes (4): The bar, The checks, What you must never do, Your output

### Community 130 - "Work Judge Role"
Cohesion: 0.40
Nodes (4): The bar for sending work back, The checks, You may not grow the job, Your output

### Community 131 - "Review Deck Store"
Cohesion: 0.22
Nodes (15): adoptDeck(), caches, CardGrade, gradeCard(), gradeCards(), isCard(), KEY(), loadDeckFor() (+7 more)

### Community 138 - "Android App Config"
Cohesion: 0.20
Nodes (10): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, package, permissions, predictiveBackGestureEnabled (+2 more)

### Community 139 - "LiveKit Session Tokens"
Cohesion: 0.20
Nodes (14): developmentEntitlementsEnabled(), GrantResult, grantSession(), ROOM_LIFECYCLE, roomNameFor(), SeedTopic, SessionGrant, SessionMode (+6 more)

### Community 140 - "Drill Screen Views"
Cohesion: 0.06
Nodes (52): authHeaders(), fitDisplay(), MicGlyph(), OptionCard(), SpeakCircle(), AppropriateReplyView(), BestSentenceView(), DrillScreen() (+44 more)

### Community 141 - "Android Acceptance Checks"
Cohesion: 0.06
Nodes (33): Android, Before you start, D0 — the build is on the Supabase adapter, D10 — deletion demands a recent Google reauthentication, D11 — a failed local wipe is reported honestly, D12 — no bearer token in logs, in AsyncStorage, or in the bundle, D13 — two accounts on one device never see each other's learning, D14 — the installation signal survives deletion (+25 more)

### Community 142 - "Sync Diagnostics"
Cohesion: 0.11
Nodes (26): ALARM_CODES, ALARM_STATUSES, counter(), createSyncDiagnostics(), elapsed(), record(), formatSyncDiagnostic(), isSyncAlarm() (+18 more)

### Community 143 - "Store Binding Tests"
Cohesion: 0.09
Nodes (11): landingOf(), localProfile, nextUid(), profileAfterConvo, QUEUED_WRITES, QueuedWrite, recap, remoteProfile (+3 more)

### Community 144 - "Tutor Agent Timing"
Cohesion: 0.20
Nodes (13): TokenMeta, tutorLLM(), parseStoredProfile(), createTurnTiming(), formatTiming(), formatVendorMetrics(), mark(), SEGMENTS (+5 more)

### Community 145 - "Conversation Screen Tests"
Cohesion: 0.17
Nodes (11): DiskFaults, drill(), earlyExitBatch(), journalledSession(), NOW, ordinaryBatch(), phrase(), PRACTICE (+3 more)

### Community 146 - "Server User Resolution"
Cohesion: 0.25
Nodes (5): createUserResolver(), ResolvedUser, SIGN_IN_REQUIRED, UserResolver, VerifierConfig

### Community 147 - "CI Dependency Contract"
Cohesion: 0.14
Nodes (13): accepted, AdvisoryDecision, dependencyClosure(), fixed, lock, LockEntry, Lockfile, manifest (+5 more)

### Community 148 - "Export & History Reports"
Cohesion: 0.26
Nodes (12): buildEntries(), csvField(), ExportEntry, toAnkiTsv(), toCsv(), buildReport(), buildTrends(), mean() (+4 more)

### Community 149 - "XP & Levels"
Cohesion: 0.25
Nodes (17): clamp(), ConversationEvidence, conversationXp(), DAILY_XP_CAP, DatedXp, DrillEvidence, drillXp(), LessonEvidence (+9 more)

### Community 150 - "Landing Decision Command"
Cohesion: 0.25
Nodes (7): 1. Who else is in this tree, 2. Where you are standing, 3. The gate, 4. The shape of the branch, 5. Deciding, 6. Landing, 7. Say what happened

### Community 151 - "Privacy and Safety Policy"
Cohesion: 0.13
Nodes (15): Analytics: consent, opt-out and retention, Antifraud identifiers: purpose, retention and disclosure, Deletion and export, Disclosure at first run, Escalation and what Parle is not, Known limits of a deterministic net, Not true yet, Privacy and safety (+7 more)

### Community 152 - "Test Brain Doubles"
Cohesion: 0.11
Nodes (6): DeadBrain, HeldAnalystBrain, HeldFrameBrain, MeteredBrain, SlowBrain, SlowFrameBrain

### Community 153 - "Motion Source Checks"
Cohesion: 0.33
Nodes (3): FILES, SRC, stripComments()

### Community 154 - "Ledger Record Test"
Cohesion: 0.29
Nodes (5): GROUNDS, HERE, LEDGER, REPO, RULE_TEST

### Community 155 - "Implementation Evidence Matrix"
Cohesion: 0.13
Nodes (14): Applying the schema to whatever project ships, Credential state, measured 2026-08-25, Current focused verification, Current landing snapshot, Failed-room billing: the P0 the phase found, then closed, Feature matrix, Found and fixed during Phase 1, Historical Phase 1 baseline (+6 more)

### Community 156 - "Retired Label Checks"
Cohesion: 0.40
Nodes (5): KEPT, labelsInSource(), RETIRED, sourceFiles(), SRC

### Community 157 - "Onboarding and Known Issues Docs"
Cohesion: 0.18
Nodes (8): Known issues — the goal file, Onboarding — everything before the first French word, The files, The shape now, What changed, and why each one, What is measured here, and what is not, What it looked like before, Who never sees any of this

### Community 159 - "State Merge Helpers"
Cohesion: 0.25
Nodes (18): arrayOf(), compareExercises(), compareText(), envelopeOf(), exerciseIdentity(), firstDiscussed(), joinTopics(), laterOf() (+10 more)

### Community 160 - "Token Hygiene Source Scan"
Cohesion: 0.22
Nodes (8): authSources(), callArguments(), loggingCalls(), PLAINTEXT_WRITERS, REPO_ROOT, Source, sources, withoutComments()

### Community 161 - "Fresh Device Startup"
Cohesion: 0.17
Nodes (11): adoptBeforeReady(), adoptedAnything(), FAILED, FRESH_DEVICE_BUDGET_MS, FreshStart, FreshStartKind, FreshStartOptions, settled() (+3 more)

### Community 162 - "Mission Completions Store"
Cohesion: 0.20
Nodes (15): source, adoptMissionCompletions(), COMPLETIONS_PER_MISSION, isCompletion(), KEY(), MissionCompletion, persistedCompletions(), readCompletions() (+7 more)

### Community 163 - "TTS Voice Cache Config"
Cohesion: 0.19
Nodes (11): CONVO_LINES, CachedTTSOptions, buildTTS(), DEFAULT_CACHE_DIR, LANGUAGE_CODE, SETTINGS_FINGERPRINT, ENV_KEYS, VOICE_SETTINGS (+3 more)

### Community 164 - "Tutor Brain Contract Doc"
Cohesion: 0.33
Nodes (5): Acceptance checks, Cost envelope, Product contract, Provider decision, The free-form tutor brain

### Community 165 - "Review Deck Merging"
Cohesion: 0.30
Nodes (13): canonical(), CARD_KINDS, counted(), countersOf(), deckOf(), gradesApplied(), higherCounts(), isFiniteNumber() (+5 more)

### Community 167 - "Expo Plugins and File Saving"
Cohesion: 0.29
Nodes (5): plugins, expo-font, expo-secure-store, expo-sharing, @livekit/react-native-expo-plugin

### Community 169 - "Dev Launcher Script"
Cohesion: 0.20
Nodes (18): AGENT_ENV_FILE, children, COLOURS, die(), hasClaudeCli(), launch(), main(), probe() (+10 more)

### Community 170 - "HTTP Origin and Security Headers"
Cohesion: 0.39
Nodes (7): applyHttpSecurity(), createOriginPolicy(), DEVELOPMENT_ORIGINS, originAllowed(), OriginPolicy, parseAllowedOrigins(), requestOrigin()

### Community 171 - "Live Context and Token Server URL"
Cohesion: 0.24
Nodes (7): Ctx, LiveProvider(), LiveValue, selectTokenServerUrl(), SRC, TOKEN_SERVER, TokenServerEnvironment

### Community 172 - "Supabase Runbook"
Cohesion: 0.25
Nodes (7): Apply, Backup, Restore, Rollback, Rollback evidence, Supabase runbook, When something goes wrong

### Community 173 - "Retry Backoff"
Cohesion: 0.16
Nodes (7): Backoff, BACKOFF_BASE_MS, BACKOFF_CAP_MS, backoffCeiling(), backoffDelay(), BackoffOptions, createBackoff()

### Community 174 - "Mock Speech Session"
Cohesion: 0.10
Nodes (36): ANGLOPHONE_WEAKNESS, CARRIER, carrierWord(), estimateDurationSec(), jitter(), LearnerProfile, mockObservations(), Phase (+28 more)

### Community 175 - "Supabase Row Checks"
Cohesion: 0.14
Nodes (11): blockedReport(), expect(), main(), newEmail(), newPassword(), PostgrestFilter, PostgrestTable, runSupabaseVerification() (+3 more)

### Community 176 - "Server Environment Config"
Cohesion: 0.53
Nodes (4): exactHttpsOrigin(), productionConfigurationProblems(), secureUrl(), ServerEnvironment

### Community 177 - "Product Orchestrator Role"
Cohesion: 0.40
Nodes (4): Boundaries and escalation, Completion, Decision rights, Handoff contract

### Community 178 - "Current State Map"
Cohesion: 0.40
Nodes (4): Current-state map, Replacement/dependency graph, Runtime path, Sources of truth

### Community 179 - "Risk Register"
Cohesion: 0.33
Nodes (5): Abandoned rooms: a risk this register overstated, Failed-room billing: a control this register claimed, lost, and rebuilt, Phase 4 practice: one risk closed, three accepted, one question left open, Risk register, Trial farming: theoretical no longer

### Community 180 - "Repository Archaeologist Role"
Cohesion: 0.50
Nodes (3): Boundaries and escalation, Handoff contract, Output

### Community 192 - "Analytics Surface Contract"
Cohesion: 0.12
Nodes (12): REPORTED_BY_PAGE, UNION, PAGES, FIRST_RUN_SURFACES, APP, APP_ENTRY, EVERYTHING, FIRST_RUN (+4 more)

### Community 203 - "Profile Merge Tests"
Cohesion: 0.13
Nodes (13): MergedStoredProfile, PROFILE_ANSWER_FIELDS, ProfileMergeDeps, brain(), deps, GOALS, ISO, merge() (+5 more)

### Community 205 - "Mock Auth Adapter"
Cohesion: 0.25
Nodes (9): createMockAdapter(), notify(), setSession(), emptyStore(), MockAccount, MockStore, readStore(), toUser() (+1 more)

### Community 206 - "Store Acknowledgement"
Cohesion: 0.10
Nodes (18): PersistAck, AcknowledgingStore, STORES, adopters, attachDirtyStore(), clearDirty(), dirty, dirtyStamp() (+10 more)

### Community 209 - "Practice Mix Offers"
Cohesion: 0.14
Nodes (23): MIX_OFFER, offersMix(), CAFE, due(), JOB, later(), topic(), topicGroups() (+15 more)

### Community 211 - "Delivery Roadmap Phases"
Cohesion: 0.40
Nodes (4): Delivery roadmap, Phase 4 execution order, and what was built against it, Phase boundary: Phase 3 landed, then Phase 4 branched from it, What Phase 4 did not verify

### Community 213 - "Memory Fact Extraction Prompt"
Cohesion: 0.31
Nodes (9): MemoryFact, ChatMessage, buildExtractionRequest(), ExtractionInput, factLine(), INSTRUCTION, interview, request() (+1 more)

### Community 214 - "Turn Handling Timings"
Cohesion: 0.29
Nodes (6): ENDPOINTING_MIN_DELAY_MS, INTERRUPTION_MIN_DURATION_MS, INTERRUPTION_MIN_WORDS, SessionMode, TurnHandling, turnHandlingFor()

### Community 215 - "Session Progress Store"
Cohesion: 0.23
Nodes (15): asRung(), LessonRoute(), adoptHistory(), isSession(), KEY(), lastSummaryFor(), loadHistory(), persistedHistory() (+7 more)

### Community 217 - "Stored Shape Type Guards"
Cohesion: 0.36
Nodes (8): isActivityEntry(), isCompletion(), isExercise(), isFiniteNumber(), isRecord(), isSession(), isSoundCheck(), isTopic()

### Community 219 - "Product Principles and Design World"
Cohesion: 0.15
Nodes (13): Paper colour token set, Paper & Ink design world, Absolute-beginner audience (CEFR A0-A2), Everything spoken must also be readable, Absent evidence must not be fabricated, Parle (working name), Expo + TypeScript npm-workspaces monorepo, Trustworthy pronunciation needs a reference text (+5 more)

### Community 220 - "Phrasebook and Hold Scheduling"
Cohesion: 0.22
Nodes (12): hasPhrases(), Hold, holdFor(), LESSONS_GROUP, Phrase, PhraseGroup, card(), days() (+4 more)

### Community 221 - "Disk Fault Injection"
Cohesion: 0.50
Nodes (3): DiskFaults, installDisk(), relaunch()

## Knowledge Gaps
- **1405 isolated node(s):** `Board`, `Row`, `AuthMode`, `AuthModeEnvironment`, `CheckOutcome` (+1400 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **51 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AuthAdapter` connect `Auth Adapter Interface` to `Mock Auth Adapter`, `Mobile App Auth Flow`, `Auth Mode Selection`, `Supabase and Google OAuth`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `DrillExercise` connect `Practice Journal Store` to `Conversation Screen UI`, `Drill Screen Views`, `Store Acknowledgement`, `Store Binding Tests`, `Learning Path Graph`, `Conversation Screen Tests`, `Drill Bank Store`, `Phrase Curation`, `Drill Exercise Bank Merge`, `Namespace Merge Policy`, `Drill Screen Test Fixtures`, `Live Failure Classification`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `ParleConversation` connect `Parle Conversation Controller` to `Conversation Orchestration`, `LLM Usage Pricing`, `Product Event Tracking`, `Session Recap Samples`, `Tutor Agent Timing`, `Brain Client Contracts`, `Live Failure Classification`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `Board`, `Row`, `AuthMode` to the rest of the system?**
  _1405 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Entitlement Store` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `Pronunciation Drills` be split into smaller, more focused modules?**
  _Cohesion score 0.12424242424242424 - nodes in this community are weakly interconnected._
- **Should `Sync Engine Core` be split into smaller, more focused modules?**
  _Cohesion score 0.0519311911716975 - nodes in this community are weakly interconnected._