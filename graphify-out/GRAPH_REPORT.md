# Graph Report - phase-3-onboarding  (2026-08-27)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 4148 nodes · 9788 edges · 223 communities (171 shown, 52 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 159 edges (avg confidence: 0.7)
- Token cost: 149,241 input · 3,154 output

## Graph Freshness
- Built from commit: `0bb507ba`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Entitlement Store
- Drill Session Copy Checks
- Session Cost Metering
- Pronunciation Drill Bank
- Sync Engine Types
- Activity Log Store
- Brain Client Config Tests
- Playground Chat CLI
- Expo App Config
- Auth Screens And Profile Context
- Tutor Agent Dependencies
- Safety Content Filters
- Dev Boot Plan
- Bug Loop Runner
- Difficulty Ladder
- supabaseAdapter.ts
- Learning Path Builder
- TTS Response Cache
- Scene Illustrations
- Supabase Live Checks
- Topic Curation
- Brain Package Manifest
- Token Server Manifest
- Brain Playground Manifest
- Tutor Voice Speech
- Activity Sync Policy
- Conversation Turn Orchestration
- Drill Exercise Types
- Core Package Manifest
- Live Failure Classification
- Shared TypeScript Config
- Copy Style Rules
- Parle Tutor Agent
- Friends Store Adapter
- Mobile TypeScript Config
- Root Package Manifest
- Sync Engine Tests
- Mobile App Dependencies
- Mobile Package Manifest
- Profile Extraction Updates
- Tutor Coach Mark Store
- Brain TypeScript Config
- Core TypeScript Config
- Playground TypeScript Config
- Token Server TypeScript Config
- Tutor Agent TypeScript Config
- Live Session Navigation
- Mobile npm Scripts
- Native LiveKit Audio Globals
- Session Journal Storage
- Environment Preflight
- Drill Bank Store Merge
- Brain LLM Client Types
- Drill Screen Views
- Voice Lifecycle Checks
- Metro Runtime Dependency
- Expo Sharing Dependency
- Expo Speech Dependency
- Age Check and Profile Upgrade
- Expo Web Browser Dependency
- Server Auth And Account Deletion
- Secret Scanner
- Scene Replay Controls
- Graphify Guard Hook
- React Native Dependency
- Async Storage Dependency
- Brain Zod Schemas
- Upstash Lease And Rate Limits
- Conversation Screen Motion
- Onboarding Profile Store
- Release Gate Script
- Review Card Merge
- Known Issues Ledger
- Agent Fleet Frontmatter
- Evidence Ledger Contract
- Mission Chooser View
- Auth Adapter Interface
- Rate Limiting And Leases
- LiveKit WebRTC Dependency
- Age Gate Answers
- Speechace Phoneme Scoring
- React Native Screens Dependency
- Database Contract Tests
- Sync Policy Constants
- Supabase JS Client Dependency
- Sign-In UI Components
- Lesson Definitions Matching
- Sound Check Store
- Pedagogy Ladder Doc
- Drill Exercise Validation
- Live Voice Doc
- Agent Loop Overview
- State and Storage Docs
- Testing Guide
- Bug Hunter Agent
- Playground Architecture
- Docs Index and Architecture
- Conversation Brain Spend
- Fix Verifier Agent
- Account Sync Runtime
- App Root Bootstrap
- Path Node Status Line
- Sync Engine Lifecycle
- French Authenticity Pack
- Deploy Engineer Agent
- Observability Engineer Agent
- Revenue Engineer Agent
- App Agent Protocol
- LiveKit React Native Dependency
- Safe Area Context Dependency
- Coach Sample Fixtures
- Forge Build Loop Doc
- Color Palette and Contrast
- Mobile Copy Test
- Secure Session Storage
- User Scope Reset
- Learner Profile Merge
- API Engineer Agent
- Performance Engineer Agent
- Security Engineer Agent
- Auth Engineer Agent
- Backend Engineer Agent
- Data Engineer Agent
- Frontend Engineer Agent
- Team Roster Doc
- Design Architect Agent
- Scaling Engineer Agent
- Tab Bar Icons
- Release Engineer Agent
- Work Judge Agent
- Review Deck Store
- Pre-commit Git Hook
- Git Pre-Push Hook
- Git Hooks Installer
- Android App Icon Config
- LiveKit Session Tokens
- Product Event Tracking
- Android Acceptance Checks
- Sync Diagnostics
- Store Binding Tests
- Turn Timing Instrumentation
- LLM Usage Pricing
- Server User Resolution
- CI Dependency Contract
- Tutor Prompt Building
- XP And Levels
- Landing Decision Command
- Privacy, Safety and Data Retention
- Brain Test Doubles
- Motion Usage Test
- Ledger Entry Test
- Implementation Evidence Matrix
- Retired Labels Test
- Onboarding and Known Issues Docs
- Keyboard Taps Test
- Today Row Phrasebook
- Token Hygiene Test
- Fresh Device Adoption
- Mission Completion Store
- Voice TTS Settings
- Tutor Brain Contract Doc
- Expo Audio Dependency
- Join Metadata Test
- Expo Plugins and File Saving
- LiveKit Client SDK
- Dev Launcher Script
- HTTP Security and CORS
- Sync Envelope Sealing
- Supabase Migration Runbook
- Retry Backoff
- Mock Speech Session Screen
- Supabase Isolation Probe
- Server Environment Config
- Product Orchestrator Agent
- Current State Map
- Risk Register
- Repository Archaeologist Agent
- Data Sync Engineer Agent
- Learning Science Engineer Agent
- Privacy Safety Engineer Agent
- QA Release Engineer Agent
- Tutor Behaviour Engineer Agent
- Voice Platform Engineer Agent
- Server Security Contract Test
- Audio Recorder Double
- Safety Wiring Test
- Expo Linking Dependency
- Expo Secure Store
- Repo Conventions and Thinking Timer
- Parle Core Package
- React DOM Dependency
- React Native Web
- React Navigation Native Stack
- Design System Engineer Agent
- Onboarding UX Engineer Agent
- Practice UX Engineer Agent
- Progress Retention Engineer Agent
- Social Systems Engineer Agent
- Profile Merge Fields
- TTS Cache
- Auth Adapter Modes
- Topics Store
- Turn Queue
- Source Text Search Test
- Topic Mix Queue
- Attempt Audio Cleanup
- Delivery Roadmap Phases
- Brain Contract Methods
- Fake Audio Stream Doubles
- Progress History Store
- Agent Usage Reporting
- Answer Grading and Typo Distance
- Expo File System
- Paper and Ink Design World
- Expo SDK Dependency
- Fake TTS Double
- React Dependency

## God Nodes (most connected - your core abstractions)
1. `Format` - 177 edges
2. `space()` - 84 edges
3. `ParleConversation` - 55 edges
4. `LlmUsage` - 54 edges
5. `paper` - 50 edges
6. `react` - 38 edges
7. `type` - 37 edges
8. `MockLlmClient` - 31 edges
9. `Rung` - 30 edges
10. `userKey()` - 29 edges

## Surprising Connections (you probably didn't know these)
- `Words-right and sounds-right are separate questions` --rationale_for--> `grade()`  [INFERRED]
  PRODUCT.md → packages/core/src/session/session.ts
- `Drill mode and the recognition-to-production ramp` --conceptually_related_to--> `bestDrillFor()`  [INFERRED]
  README.md → packages/core/src/phonemes/drills.ts
- `Chrome is plain English, French only where it is content` --rationale_for--> `CAFE_LESSON`  [INFERRED]
  DESIGN.md → packages/core/src/lessons/cafe.ts
- `The conversation upgrade` --rationale_for--> `ConvoView`  [INFERRED]
  README.md → packages/core/src/protocol/protocol.ts
- `Words-right and sounds-right are separate questions` --rationale_for--> `TurnFeedback`  [INFERRED]
  PRODUCT.md → packages/core/src/session/session.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **The four-rung scaffolding system, from principle to pixel** — product_scaffolding_ladder, product_never_stranded_never_scolded, design_support_colours_cool, packages_core_src_ladder_ladder_applyturn, apps_mobile_src_theme_rungcolor, readme_agent_authoritative [INFERRED 0.85]
- **The trustworthy-pronunciation chain** — product_trustworthy_pronunciation, product_french_only_depth, product_say_one_thing, readme_missing_score_no_penalty, packages_core_src_phonemes_inventory_french_phonemes, packages_core_src_phonemes_drills_drills, packages_core_src_phonemes_scoring_buildreport, services_shared_speechace_scoreutterance [INFERRED 0.85]
- **Unit economics and metering enforcement** — product_metered_minutes, product_cascaded_voice_pipeline, readme_metering_at_token_issuance, readme_tts_warm_cache, readme_risk_cost_per_session, packages_core_src_metering_meter_plans, packages_core_src_metering_meter_estimatesessioncost [INFERRED 0.85]

## Communities (223 total, 52 thin omitted)

### Community 0 - "Entitlement Store"
Cohesion: 0.11
Nodes (10): Entitlement, Plan, developmentEntitlementsEnabled(), DevelopmentEntitlementStore, entitlementFrom(), EntitlementStore, FileEntitlementStore, InMemoryEntitlementStore (+2 more)

### Community 1 - "Drill Session Copy Checks"
Cohesion: 0.11
Nodes (33): check(), checkDrill(), DRILL_FIXTURES, DrillVerdict, answerCurrent(), AnsweredExercise, applyDrillResults(), buildDrillSession() (+25 more)

### Community 2 - "Session Cost Metering"
Cohesion: 0.15
Nodes (25): canStartSession(), CostModel, DEFAULT_COST_MODEL, estimateSessionCost(), Margin, MIN_VIABLE_SESSION_SEC, planMargin(), PLANS (+17 more)

### Community 3 - "Pronunciation Drill Bank"
Cohesion: 0.09
Nodes (48): bestDrillFor(), BY_ID, Drill, DrillKind, DRILLS, drillsFor(), DrillWord, getDrill() (+40 more)

### Community 4 - "Sync Engine Types"
Cohesion: 0.09
Nodes (29): SyncCode, SyncFetch, SyncHttpResponse, SyncMergeRequest, SyncMergeResult, SyncPhase, SyncPolicy, SyncQuietReason (+21 more)

### Community 5 - "Activity Log Store"
Cohesion: 0.19
Nodes (18): ActivityKind, adoptActivity(), backfillFrom(), chain, earnedXp(), empty(), isEntry(), isStored() (+10 more)

### Community 6 - "Brain Client Config Tests"
Cohesion: 0.05
Nodes (45): AnthropicBrainConfig, ParseCapableSdk, ClaudeCliConfig, BrainRefusalError, AnyRecord, FetchLike, realSleep(), RETRY_AFTER_CAP_MS (+37 more)

### Community 7 - "Playground Chat CLI"
Cohesion: 0.17
Nodes (27): SessionRecap, defaultModel(), main(), pickClient(), Command, COMMAND_HELP, parseCommand(), STRICTNESS_LEVELS (+19 more)

### Community 8 - "Expo App Config"
Cohesion: 0.10
Nodes (19): expo, icon, ios, name, newArchEnabled, orientation, scheme, slug (+11 more)

### Community 9 - "Auth Screens And Profile Context"
Cohesion: 0.07
Nodes (47): Ctx, useProfile(), AuthScreen, SetNewPasswordScreen(), st, SignInScreen(), SignUpScreen(), st (+39 more)

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
Cohesion: 0.12
Nodes (31): Chrome is plain English, French only where it is content, No number and no scolding mid-session, applyTurn(), clamp(), directiveFor(), initialState(), INSTRUCTION_BY_RUNG, LadderState (+23 more)

### Community 15 - "supabaseAdapter.ts"
Cohesion: 0.24
Nodes (6): startGoogleSignIn(), createSecureSessionStorage(), createSupabaseAdapter(), AuthResult, AuthUser, expo-web-browser

### Community 16 - "Learning Path Builder"
Cohesion: 0.19
Nodes (15): AUTHORED_PATH, AuthoredNode, authoredPhraseKeys(), AuthoredUnit, buildPath(), discussedInWords(), drillableKeys(), GENERATED_PREFIX (+7 more)

### Community 17 - "TTS Response Cache"
Cohesion: 0.14
Nodes (9): CachedChunkedStream, CachedTTS, defaultMissTransport(), normaliseLine(), ResolvedCachedTTSOptions, NO_RETRY, decodeWav(), encodeWav() (+1 more)

### Community 18 - "Scene Illustrations"
Cohesion: 0.14
Nodes (38): Frame(), Moving(), Scene(), SceneProps, Stipple(), SpeakBubbles(), HeroCafe(), NobodyYet() (+30 more)

### Community 19 - "Supabase Live Checks"
Cohesion: 0.09
Nodes (23): anonKeyOf(), CheckOutcome, CheckResult, codeOf(), Environment, Learner, makeRedactor(), MARK (+15 more)

### Community 20 - "Topic Curation"
Cohesion: 0.06
Nodes (36): NewPhrase, applyCuration(), buildCurationRequest(), CuratedTopic, CurationInput, CurationSchema, INSTRUCTION, keyOf() (+28 more)

### Community 21 - "Brain Package Manifest"
Cohesion: 0.07
Nodes (26): @anthropic-ai/sdk, dependencies, @anthropic-ai/sdk, @parle/core, zod, description, devDependencies, @types/node (+18 more)

### Community 22 - "Token Server Manifest"
Cohesion: 0.08
Nodes (24): jose, livekit-server-sdk, dependencies, dotenv, jose, livekit-server-sdk, @parle/core, devDependencies (+16 more)

### Community 23 - "Brain Playground Manifest"
Cohesion: 0.08
Nodes (24): dependencies, dotenv, @parle/brain, @parle/core, description, devDependencies, @types/node, typescript (+16 more)

### Community 24 - "Tutor Voice Speech"
Cohesion: 0.43
Nodes (6): available(), frenchVoice(), loadVoices(), speak(), speakLines(), withTimeout()

### Community 25 - "Activity Sync Policy"
Cohesion: 0.12
Nodes (40): stableStringify(), ACTIVITY_KINDS, ActivityEntryish, arrayOf(), compareExercises(), compareText(), envelopeOf(), exerciseIdentity() (+32 more)

### Community 26 - "Conversation Turn Orchestration"
Cohesion: 0.17
Nodes (3): LearnerTurnInput, ParleConversation, sttLanguageFor()

### Community 27 - "Drill Exercise Types"
Cohesion: 0.17
Nodes (18): typed(), withOptions(), AppropriateReplyExercise, BestSentenceExercise, DrillExerciseBase, FillBlankExercise, ListenTypeExercise, RepeatThisExercise (+10 more)

### Community 28 - "Core Package Manifest"
Cohesion: 0.10
Nodes (19): devDependencies, @types/node, typescript, exports, ./ladder, ./lessons, ./metering, ./phonemes (+11 more)

### Community 29 - "Live Failure Classification"
Cohesion: 0.09
Nodes (33): classifyFailure(), COPY, failureCopy, LiveFailure, micApiUnavailable(), EVERY_FAILURE, TokenServerError, ensureAudioSession() (+25 more)

### Community 30 - "Shared TypeScript Config"
Cohesion: 0.10
Nodes (19): DOM, ES2023, compilerOptions, allowImportingTsExtensions, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules (+11 more)

### Community 31 - "Copy Style Rules"
Cohesion: 0.09
Nodes (25): ANGLICISM, BLOCKING_ERROR, BY_KIND, coachFallbackLine(), CopyRule, EM_DASH_RE, ENGLISH_HAND_BACK, ENGLISH_HAND_BACK_VARIANTS (+17 more)

### Community 32 - "Parle Tutor Agent"
Cohesion: 0.17
Nodes (6): currentPrompt(), forgetReportedSessions(), ParleTutor, build(), rescueOnce(), stubSession()

### Community 33 - "Friends Store Adapter"
Cohesion: 0.08
Nodes (37): build(), caches, createLocalAdapter(), defaultStore(), FriendsStore, isStore(), KEY(), listeners (+29 more)

### Community 34 - "Mobile TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, noEmit, noUncheckedIndexedAccess, strict, types, exclude, extends (+8 more)

### Community 35 - "Root Package Manifest"
Cohesion: 0.05
Nodes (38): advisories, auditFailsAbove, note, reviewed, description, engines, node, name (+30 more)

### Community 36 - "Sync Engine Tests"
Cohesion: 0.11
Nodes (18): SyncEngineOptions, Card, deckPolicy, engineFor(), FakeRow, FoldCall, foldingStore(), keyFor() (+10 more)

### Community 37 - "Mobile App Dependencies"
Cohesion: 0.12
Nodes (17): dependencies, expo-crypto, expo-font, expo-status-bar, @livekit/react-native-expo-plugin, @parle/brain, react-native-svg, @react-navigation/bottom-tabs (+9 more)

### Community 38 - "Mobile Package Manifest"
Cohesion: 0.17
Nodes (11): devDependencies, @types/node, @types/react, typescript, @types/node, typescript, main, name (+3 more)

### Community 39 - "Profile Extraction Updates"
Cohesion: 0.21
Nodes (17): normalizeErrorTag(), applyExtractionToProfile(), bandIndex(), EVIDENCE_WINDOW, finishSession(), isRecord(), learnerSnapshotFrom(), MASTERY_USES (+9 more)

### Community 40 - "Tutor Coach Mark Store"
Cohesion: 0.30
Nodes (14): userKey(), adoptCoachMarks(), adoptTutorIntro(), COACH_MARKS_KEY(), hasSeenTutorIntro(), idsOf(), loadSeenCoachMarks(), markCoachMarkSeen() (+6 more)

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

### Community 46 - "Live Session Navigation"
Cohesion: 0.10
Nodes (24): Ctx, LiveValue, useLive(), LiveSessionScreen(), resumableMission(), asRung(), ConvoRoute(), LazyConvoScreen (+16 more)

### Community 47 - "Mobile npm Scripts"
Cohesion: 0.25
Nodes (8): scripts, android, export:web, ios, start, test, typecheck, web

### Community 49 - "Session Journal Storage"
Cohesion: 0.14
Nodes (26): clearAt(), clearJournal(), journalDrills(), journalRecap(), KEY(), readJournal(), recoverJournal(), serialized() (+18 more)

### Community 50 - "Environment Preflight"
Cohesion: 0.14
Nodes (22): tutorLLM(), frameDeadlineMs(), turnDeadlineMs(), Brain, BRAIN_KEY, Env, FetchLike, missingRequired() (+14 more)

### Community 51 - "Drill Bank Store Merge"
Cohesion: 0.12
Nodes (24): MAX_DRILL_EXERCISES, mergeExerciseBank(), adoptDrillBank(), caches, defaultStore(), DrillStore, getMicSuppressedUntil(), hasGeneratedExercises() (+16 more)

### Community 52 - "Brain LLM Client Types"
Cohesion: 0.09
Nodes (38): MemoryExtraction, ScenarioFrame, TutorTurn, Curation, DrillBatch, DrillBatchSchema, AnthropicBrainClient, outputConfig() (+30 more)

### Community 53 - "Drill Screen Views"
Cohesion: 0.13
Nodes (27): fitDisplay(), OptionCard(), loadDrillBank(), AppropriateReplyView(), BestSentenceView(), DrillScreen(), ds, FillBlankView() (+19 more)

### Community 54 - "Voice Lifecycle Checks"
Cohesion: 0.08
Nodes (61): Check, checkAgentSecret(), checkConcurrentStart(), checkDepartureClosesRoom(), checkExactlyOnceDebit(), checkHardStop(), checkInsecureUrlRefused(), checkJoinTokenExpiry() (+53 more)

### Community 58 - "Age Check and Profile Upgrade"
Cohesion: 0.23
Nodes (9): ageConfirmedFromDob(), ageOn(), MIN_AGE, TODAY, storedGoal(), NOW, UpgradedProfile, upgradeStored() (+1 more)

### Community 60 - "Server Auth And Account Deletion"
Cohesion: 0.10
Nodes (29): adminHeaders(), deleteSupabaseUser(), signedInRecently(), agentDebitAllowed(), exactKeys(), insertProductEvent(), missionId(), nonNegativeCount() (+21 more)

### Community 61 - "Secret Scanner"
Cohesion: 0.11
Nodes (32): ALLOW_MARKER, BINARY_EXTENSIONS, BUNDLE_DIRECTORIES, bundleFiles(), Finding, formatFinding(), git(), isCodeReference() (+24 more)

### Community 62 - "Scene Replay Controls"
Cohesion: 0.27
Nodes (9): hasSayableSupportLine(), ReplayLine, sceneControls, controls(), fullLine, hint, none, options (+1 more)

### Community 63 - "Graphify Guard Hook"
Cohesion: 0.29
Nodes (4): GRAPH, ROOT, ROUTING, SOURCE_EXTS

### Community 66 - "Brain Zod Schemas"
Cohesion: 0.08
Nodes (33): AssessmentZ, CefrBandZ, CoachItemZ, CoachKindZ, MemoryExtractionSchema, MemoryFactZ, NewPhraseZ, OptionZ (+25 more)

### Community 67 - "Upstash Lease And Rate Limits"
Cohesion: 0.12
Nodes (25): RATE_LIMITS, UpstashSessionLeaseStore, blockedReport(), CheckResult, CheckStatus, expect(), freePort(), Instance (+17 more)

### Community 68 - "Conversation Screen Motion"
Cohesion: 0.07
Nodes (44): ConvoScreen(), MissionWin(), st, SETTLE_MS, settleIn(), useReduceMotion(), decorative, orb (+36 more)

### Community 69 - "Onboarding Profile Store"
Cohesion: 0.20
Nodes (16): ProfileGate(), adoptProfile(), completeProfile(), confirmedFrom(), createStoredProfile(), KEY(), loadProfile(), OnboardingAnswers (+8 more)

### Community 70 - "Release Gate Script"
Cohesion: 0.08
Nodes (18): AGENT_MODELS, agentFiles, args, asJson, auditOnly, bless, counts, entries (+10 more)

### Community 71 - "Review Card Merge"
Cohesion: 0.15
Nodes (24): mergeReview(), canonical(), CARD_KINDS, deckOf(), gradesApplied(), isFiniteNumber(), isReviewCard(), mergeDecks() (+16 more)

### Community 72 - "Known Issues Ledger"
Cohesion: 0.01
Nodes (177): A1 — A spoken answer has to match the script exactly, A2 — An empty transcript is graded as a wrong answer, A3 — A freeze at the top rung still asks the learner to invent French, A4 — A rescue can skip the beat the learner froze on, A5 — Two different opening-rung formulas, A6 — A focus point vanishes when the worst sound has no drill, A7 — A v2 snapshot with no memory crashes the worker, B0 — ParleTutor cannot be tested at all (+169 more)

### Community 73 - "Agent Fleet Frontmatter"
Cohesion: 0.20
Nodes (11): AgentFrontmatter, agentProblems(), FRONTMATTER_FIELDS, frontmatterBlock(), parseAgentFrontmatter(), pinnedAgents(), READ_ONLY_AGENTS, routedAgents() (+3 more)

### Community 74 - "Evidence Ledger Contract"
Cohesion: 0.08
Nodes (28): classify(), evidence, EVIDENCE_PATH, evidenceFlat, FLOORS_PATH, ledger, LEDGER_PATH, LedgerEntry (+20 more)

### Community 75 - "Mission Chooser View"
Cohesion: 0.09
Nodes (46): trackProductEvent(), CHOOSER_HEADLINE, CHOOSER_SUB, ChooserCard, ChooserInput, chooserView, FINISHED_LINE, hasSpokenBefore() (+38 more)

### Community 77 - "Rate Limiting And Leases"
Cohesion: 0.08
Nodes (16): CONSUME_SCRIPT, Counter, createRateLimiter(), createSessionLeaseStore(), FetchLike, MemoryRateLimiter, MemorySessionLeaseStore, RateLimitDecision (+8 more)

### Community 79 - "Age Gate Answers"
Cohesion: 0.05
Nodes (56): REPORTED_BY_PAGE, UNION, AGE_CONFIRM, AGE_DENY, AGE_QUESTION, AGE_REFUSAL, AGE_SUB, ageGate (+48 more)

### Community 80 - "Speechace Phoneme Scoring"
Cohesion: 0.18
Nodes (9): A missing score is never an invented penalty, ALIASES, FRENCH_IPA, toInventoryIpa(), parseSpeechace(), ScoreFetch, ScoreRequest, scoreUtterance() (+1 more)

### Community 82 - "Database Contract Tests"
Cohesion: 0.08
Nodes (30): and3(), branchTaken(), claimOutcome(), CreatedObject, createdObjects(), debitFixMigration, effectiveBody(), effectiveClaimTrialBody() (+22 more)

### Community 83 - "Sync Policy Constants"
Cohesion: 0.07
Nodes (16): ACTIVITY_KEEP_DAYS, MAX_COMPLETIONS_PER_MISSION, MAX_HISTORY_SESSIONS, MAX_SOUND_CHECKS, SYNC_EXCLUSIONS, SYNC_POLICIES, adoptedNamespaces(), BASE (+8 more)

### Community 85 - "Sign-In UI Components"
Cohesion: 0.07
Nodes (59): st, ArrowRight(), Card(), EarGlyph(), GhostButton(), GoogleMark(), HelpGlyph(), Label() (+51 more)

### Community 86 - "Lesson Definitions Matching"
Cohesion: 0.22
Nodes (16): BY_ID, getLesson(), AcceptanceMatch, AcceptanceRoute, candidatesFor(), CefrLevel, contentHits(), contentWords() (+8 more)

### Community 87 - "Sound Check Store"
Cohesion: 0.29
Nodes (13): adoptSoundChecks(), isEvidence(), isKind(), KEY(), loadSoundChecks(), persisted(), read(), recordSoundCheck() (+5 more)

### Community 88 - "Pedagogy Ladder Doc"
Cohesion: 0.22
Nodes (8): One focus, one drill, The four rungs, The invariants, The pedagogy, The rescue, Two independent axes, What counts as a right answer, Where the next session opens

### Community 89 - "Drill Exercise Validation"
Cohesion: 0.29
Nodes (13): applyTurnToProfile(), phraseKey(), checkAccepted(), checkDistinct(), englishGlosses(), expectedDifficulty(), inRange(), LabelledString (+5 more)

### Community 90 - "Live Voice Doc"
Cohesion: 0.25
Nodes (7): Audio, and what may be claimed about it, Serialisation, The four modes, The live path, The route, The wire, When it fails

### Community 91 - "Agent Loop Overview"
Cohesion: 0.29
Nodes (7): Giving it a goal, Running it, The agents, The bar, The loop, The other half: building something new, Verifying UI work

### Community 92 - "State and Storage Docs"
Cohesion: 0.17
Nodes (11): Attempt audio, and the one thing on the phone that is not a key, Device-level keys, and the one that retired, On the device, Server side, Sessions and progress, State and storage, The brain's learner model, The post-recap durability gap (+3 more)

### Community 93 - "Testing Guide"
Cohesion: 0.29
Nodes (6): Never, Running, Testing, The rule that matters most, What is not covered, Writing

### Community 94 - "Bug Hunter Agent"
Cohesion: 0.33
Nodes (5): House style, How you work, Product invariants — a change that breaks one of these is a bug, however green, What counts as a finding, What you must never do

### Community 95 - "Playground Architecture"
Cohesion: 0.40
Nodes (5): Architecture, Mock or live, No build step, Two paths, one ladder, Who owns what

### Community 97 - "Conversation Brain Spend"
Cohesion: 0.05
Nodes (48): ActivitySpend, asSentence(), BRAIN_ACTIVITIES, BrainActivity, brainClient(), cacheHitRate(), chargedInput(), chooseFrame() (+40 more)

### Community 100 - "Account Sync Runtime"
Cohesion: 0.24
Nodes (17): startSync(), clearIfRunning(), event(), flushDirty(), headers(), outcome(), pull(), queue() (+9 more)

### Community 101 - "App Root Bootstrap"
Cohesion: 0.12
Nodes (18): App(), Gate(), SignedInRoot(), st, startAccountSync(), LiveProvider(), AuthFlow(), installationId() (+10 more)

### Community 102 - "Path Node Status Line"
Cohesion: 0.12
Nodes (19): MIX_OFFER, offersMix(), topicGroups(), PathNodeRow(), st, MOMENT_ANSWER_MS, momentAnswer(), statusLine() (+11 more)

### Community 103 - "Sync Engine Lifecycle"
Cohesion: 0.07
Nodes (33): SyncEngine, sameData(), createSyncPolicy(), dirtySettled(), resetSyncRegistry(), anonKeyOf(), blockedReport(), CheckOutcome (+25 more)

### Community 104 - "French Authenticity Pack"
Cohesion: 0.08
Nodes (35): FR_PACK, renderAuthenticityPack(), AuthenticityPack, ContrastPair, Filler, RegisterDef, SlangEntry, LearnerSnapshot (+27 more)

### Community 105 - "Deploy Engineer Agent"
Cohesion: 0.22
Nodes (8): How you work, Product invariants — a change that breaks one of these is wrong, however green, Ship the smallest real thing, Start by being honest about where this is, The order this has to happen in, What you must never do, When there is nothing to deploy to, say so, Your territory

### Community 106 - "Observability Engineer Agent"
Cohesion: 0.22
Nodes (8): How you work, Product invariants — a change that breaks one of these is wrong, however green, The line you do not cross, The seam to cut, when the time comes, What exists, and what does not, What you must never do, When there is no seam yet, say so, Your territory

### Community 107 - "Revenue Engineer Agent"
Cohesion: 0.20
Nodes (9): Copy about money is still learner copy, Handoff contract, How you work, Product invariants — a change that breaks one of these is wrong, however green, The rule enforcement lives at, What already exists, What you must never do, Where a purchase lands (+1 more)

### Community 108 - "App Agent Protocol"
Cohesion: 0.10
Nodes (29): LiveSession, asTheAgentReadsIt(), asTheAppReadsIt(), CLIENT_TAGS, ClientMessage, ConvoCoachItem, ConvoPhrase, ConvoSpeakerLine (+21 more)

### Community 111 - "Coach Sample Fixtures"
Cohesion: 0.05
Nodes (81): sampleCoachItem(), sampleSupport(), sampleTurn(), Assessment, CoachItem, CoachKind, SpeakerLine, SupportMaterial (+73 more)

### Community 112 - "Forge Build Loop Doc"
Cohesion: 0.22
Nodes (9): /forge, Looping it, Not wired yet: the unattended loop, The contract, The gate watches the wiring too, Watch for judge drift, Who actually builds it, Why the judge's findings go in the ledger (+1 more)

### Community 113 - "Color Palette and Contrast"
Cohesion: 0.21
Nodes (10): ALL, CARRIED, channels(), contrast(), Lab, linear(), luminance(), ORB (+2 more)

### Community 115 - "Secure Session Storage"
Cohesion: 0.22
Nodes (10): chunkKey(), KeyValueStorage, metaKey(), parseMeta(), readSecure(), removeAllGenerations(), removeGeneration(), StoredMeta (+2 more)

### Community 116 - "User Scope Reset"
Cohesion: 0.18
Nodes (12): AttemptAudioSweepResult, sweepAttemptAudio(), ATTEMPT_AUDIO_NOT_SWEPT, ClearHooks, LEGACY_KEYS, onUserScopeReset(), resetHooks, RETIRED_DEVICE_KEYS (+4 more)

### Community 117 - "Learner Profile Merge"
Cohesion: 0.22
Nodes (23): ANSWER_FIELD_SET, canonical(), compareEvidence(), compareStrings(), coreSlice(), finish(), finiteOr(), identityOf() (+15 more)

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

### Community 125 - "Team Roster Doc"
Cohesion: 0.29
Nodes (7): Calling them, Territory is the point, The gate defends the fleet, The independent reviewers, The team, Three of them are ahead of the code, Who owns what

### Community 126 - "Design Architect Agent"
Cohesion: 0.33
Nodes (5): Orienting yourself, The ledger format is parsed, not read, The question you are actually answering, What you must never do, Your output — the contract

### Community 127 - "Scaling Engineer Agent"
Cohesion: 0.33
Nodes (5): Default answer, The checks, What genuinely blocks a second instance today, What you must never do, Your output

### Community 128 - "Tab Bar Icons"
Cohesion: 0.18
Nodes (14): HomeIcon(), MyFrenchIcon(), PracticeIcon(), ProfileIcon(), TabIconProps, TutorIcon(), announceTab(), ICONS (+6 more)

### Community 129 - "Release Engineer Agent"
Cohesion: 0.40
Nodes (4): The bar, The checks, What you must never do, Your output

### Community 130 - "Work Judge Agent"
Cohesion: 0.40
Nodes (4): The bar for sending work back, The checks, You may not grow the job, Your output

### Community 131 - "Review Deck Store"
Cohesion: 0.22
Nodes (18): addFromSummary(), addPhrases(), adoptDeck(), caches, gradeCard(), gradeCards(), isCard(), KEY() (+10 more)

### Community 138 - "Android App Icon Config"
Cohesion: 0.20
Nodes (10): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, package, permissions, predictiveBackGestureEnabled (+2 more)

### Community 139 - "LiveKit Session Tokens"
Cohesion: 0.22
Nodes (13): GrantResult, grantSession(), ROOM_LIFECYCLE, roomNameFor(), SeedTopic, SessionGrant, SessionMode, config (+5 more)

### Community 140 - "Product Event Tracking"
Cohesion: 0.10
Nodes (27): ProductEvent, authHeaders(), selectTokenServerUrl(), SRC, TOKEN_SERVER, TokenServerEnvironment, nextSoundCheckReference(), SELF_GUIDED (+19 more)

### Community 141 - "Android Acceptance Checks"
Cohesion: 0.06
Nodes (33): Android, Before you start, D0 — the build is on the Supabase adapter, D10 — deletion demands a recent Google reauthentication, D11 — a failed local wipe is reported honestly, D12 — no bearer token in logs, in AsyncStorage, or in the bundle, D13 — two accounts on one device never see each other's learning, D14 — the installation signal survives deletion (+25 more)

### Community 142 - "Sync Diagnostics"
Cohesion: 0.11
Nodes (26): ALARM_CODES, ALARM_STATUSES, counter(), createSyncDiagnostics(), elapsed(), record(), formatSyncDiagnostic(), isSyncAlarm() (+18 more)

### Community 143 - "Store Binding Tests"
Cohesion: 0.09
Nodes (13): setActiveUser(), landingOf(), localProfile, nextUid(), phraseKeysOnDisk(), profileAfterConvo, QUEUED_WRITES, QueuedWrite (+5 more)

### Community 144 - "Turn Timing Instrumentation"
Cohesion: 0.14
Nodes (17): TokenMeta, createTurnTiming(), formatTiming(), formatVendorMetrics(), mark(), SEGMENTS, TimingStage, TurnTiming (+9 more)

### Community 145 - "LLM Usage Pricing"
Cohesion: 0.13
Nodes (24): carriesFrench(), addLlmUsage(), billedNothing(), mergedModel(), ZERO_USAGE, DEFAULT_OPENAI_ANALYST_MODEL, costUsd(), FALLBACK_PRICE_MODEL (+16 more)

### Community 146 - "Server User Resolution"
Cohesion: 0.25
Nodes (5): createUserResolver(), ResolvedUser, SIGN_IN_REQUIRED, UserResolver, VerifierConfig

### Community 147 - "CI Dependency Contract"
Cohesion: 0.14
Nodes (13): accepted, AdvisoryDecision, dependencyClosure(), fixed, lock, LockEntry, Lockfile, manifest (+5 more)

### Community 148 - "Tutor Prompt Building"
Cohesion: 0.13
Nodes (15): Rung, Lesson, baseInstructions(), buildPrompt(), turnInstructions(), noteSessionReported(), Publisher, reportedSessions (+7 more)

### Community 149 - "XP And Levels"
Cohesion: 0.24
Nodes (18): clamp(), ConversationEvidence, conversationXp(), DAILY_XP_CAP, DatedXp, DrillEvidence, drillXp(), LessonEvidence (+10 more)

### Community 150 - "Landing Decision Command"
Cohesion: 0.25
Nodes (7): 1. Who else is in this tree, 2. Where you are standing, 3. The gate, 4. The shape of the branch, 5. Deciding, 6. Landing, 7. Say what happened

### Community 151 - "Privacy, Safety and Data Retention"
Cohesion: 0.13
Nodes (15): Analytics: consent, opt-out and retention, Antifraud identifiers: purpose, retention and disclosure, Deletion and export, Disclosure at first run, Escalation and what Parle is not, Known limits of a deterministic net, Not true yet, Privacy and safety (+7 more)

### Community 152 - "Brain Test Doubles"
Cohesion: 0.11
Nodes (6): DeadBrain, HeldAnalystBrain, HeldFrameBrain, MeteredBrain, SlowBrain, SlowFrameBrain

### Community 153 - "Motion Usage Test"
Cohesion: 0.33
Nodes (3): FILES, SRC, stripComments()

### Community 154 - "Ledger Entry Test"
Cohesion: 0.29
Nodes (5): GROUNDS, HERE, LEDGER, REPO, RULE_TEST

### Community 155 - "Implementation Evidence Matrix"
Cohesion: 0.13
Nodes (14): Applying the schema to whatever project ships, Credential state, measured 2026-08-25, Current focused verification, Current landing snapshot, Failed-room billing: the P0 the phase found, then closed, Feature matrix, Found and fixed during Phase 1, Historical Phase 1 baseline (+6 more)

### Community 156 - "Retired Labels Test"
Cohesion: 0.40
Nodes (5): KEPT, labelsInSource(), RETIRED, sourceFiles(), SRC

### Community 157 - "Onboarding and Known Issues Docs"
Cohesion: 0.18
Nodes (8): Known issues — the goal file, Onboarding — everything before the first French word, The files, The shape now, What changed, and why each one, What is measured here, and what is not, What it looked like before, Who never sees any of this

### Community 159 - "Today Row Phrasebook"
Cohesion: 0.09
Nodes (26): PhrasebookCard(), st, TodayRow(), buildPhrasebook(), hasPhrases(), Hold, holdFor(), LESSONS_GROUP (+18 more)

### Community 160 - "Token Hygiene Test"
Cohesion: 0.22
Nodes (8): authSources(), callArguments(), loggingCalls(), PLAINTEXT_WRITERS, REPO_ROOT, Source, sources, withoutComments()

### Community 161 - "Fresh Device Adoption"
Cohesion: 0.17
Nodes (11): adoptBeforeReady(), adoptedAnything(), FAILED, FRESH_DEVICE_BUDGET_MS, FreshStart, FreshStartKind, FreshStartOptions, settled() (+3 more)

### Community 162 - "Mission Completion Store"
Cohesion: 0.18
Nodes (16): source, adoptMissionCompletions(), COMPLETIONS_PER_MISSION, isCompletion(), KEY(), MissionCompletion, persistedCompletions(), readCompletions() (+8 more)

### Community 163 - "Voice TTS Settings"
Cohesion: 0.17
Nodes (12): LESSONS, CONVO_LINES, CachedTTSOptions, buildTTS(), DEFAULT_CACHE_DIR, LANGUAGE_CODE, SETTINGS_FINGERPRINT, ENV_KEYS (+4 more)

### Community 164 - "Tutor Brain Contract Doc"
Cohesion: 0.33
Nodes (5): Acceptance checks, Cost envelope, Product contract, Provider decision, The free-form tutor brain

### Community 167 - "Expo Plugins and File Saving"
Cohesion: 0.29
Nodes (5): plugins, expo-font, expo-secure-store, expo-sharing, @livekit/react-native-expo-plugin

### Community 169 - "Dev Launcher Script"
Cohesion: 0.20
Nodes (18): AGENT_ENV_FILE, children, COLOURS, die(), hasClaudeCli(), launch(), main(), probe() (+10 more)

### Community 170 - "HTTP Security and CORS"
Cohesion: 0.39
Nodes (7): applyHttpSecurity(), createOriginPolicy(), DEVELOPMENT_ORIGINS, originAllowed(), OriginPolicy, parseAllowedOrigins(), requestOrigin()

### Community 171 - "Sync Envelope Sealing"
Cohesion: 0.23
Nodes (14): payloadOf(), ENVELOPE_VERSION, envelopeBytes(), EnvelopeReading, EnvelopeRejection, innerVersion(), isRecord(), MAX_ENVELOPE_BYTES (+6 more)

### Community 172 - "Supabase Migration Runbook"
Cohesion: 0.25
Nodes (7): Apply, Backup, Restore, Rollback, Rollback evidence, Supabase runbook, When something goes wrong

### Community 173 - "Retry Backoff"
Cohesion: 0.16
Nodes (7): Backoff, BACKOFF_BASE_MS, BACKOFF_CAP_MS, backoffCeiling(), backoffDelay(), BackoffOptions, createBackoff()

### Community 174 - "Mock Speech Session Screen"
Cohesion: 0.09
Nodes (38): ANGLOPHONE_WEAKNESS, CARRIER, carrierWord(), estimateDurationSec(), jitter(), LearnerProfile, mockObservations(), Phase (+30 more)

### Community 175 - "Supabase Isolation Probe"
Cohesion: 0.14
Nodes (11): blockedReport(), expect(), main(), newEmail(), newPassword(), PostgrestFilter, PostgrestTable, runSupabaseVerification() (+3 more)

### Community 176 - "Server Environment Config"
Cohesion: 0.53
Nodes (4): exactHttpsOrigin(), productionConfigurationProblems(), secureUrl(), ServerEnvironment

### Community 177 - "Product Orchestrator Agent"
Cohesion: 0.40
Nodes (4): Boundaries and escalation, Completion, Decision rights, Handoff contract

### Community 178 - "Current State Map"
Cohesion: 0.40
Nodes (4): Current-state map, Replacement/dependency graph, Runtime path, Sources of truth

### Community 179 - "Risk Register"
Cohesion: 0.40
Nodes (4): Abandoned rooms: a risk this register overstated, Failed-room billing: a control this register claimed, lost, and rebuilt, Risk register, Trial farming: theoretical no longer

### Community 180 - "Repository Archaeologist Agent"
Cohesion: 0.50
Nodes (3): Boundaries and escalation, Handoff contract, Output

### Community 192 - "Repo Conventions and Thinking Timer"
Cohesion: 0.24
Nodes (8): Read the exact versioned Expo docs before writing code, thinkingAfter(), ServerMessage, Parle (working name), Expo + TypeScript npm-workspaces monorepo, The agent is authoritative over session state, packages/core is deliberately platform-free, Repo path contains a space

### Community 203 - "Profile Merge Fields"
Cohesion: 0.07
Nodes (31): ProfileValue, StoredProfile, MergedStoredProfile, PROFILE_ANSWER_FIELDS, ProfileMergeDeps, Side, brain(), deps (+23 more)

### Community 205 - "Auth Adapter Modes"
Cohesion: 0.16
Nodes (14): auth, build(), AuthMode, AuthModeEnvironment, selectAuthMode(), createMockAdapter(), notify(), setSession() (+6 more)

### Community 206 - "Topics Store"
Cohesion: 0.27
Nodes (12): markDirty(), adoptTopics(), KEY(), mergeSessionTopics(), persistedTopics(), readTopics(), registerAdopter(), saveTopics() (+4 more)

### Community 209 - "Topic Mix Queue"
Cohesion: 0.17
Nodes (16): topic(), CAFE, due(), JOB, later(), topic(), mixQueue(), newCard() (+8 more)

### Community 211 - "Delivery Roadmap Phases"
Cohesion: 0.50
Nodes (3): Delivery roadmap, Phase 4 execution order, Phase boundary: land Phase 3 before starting Phase 4

### Community 214 - "Fake Audio Stream Doubles"
Cohesion: 0.25
Nodes (3): FakeChunkedStream, FakeSynthesizeStream, rampFrames()

### Community 215 - "Progress History Store"
Cohesion: 0.29
Nodes (12): adoptHistory(), isSession(), KEY(), loadHistory(), persistedHistory(), readHistory(), recordSession(), registerAdopter() (+4 more)

### Community 216 - "Agent Usage Reporting"
Cohesion: 0.40
Nodes (4): reportUsage(), report, UsageReport, UsageReportOptions

### Community 217 - "Answer Grading and Typo Distance"
Cohesion: 0.36
Nodes (9): acceptedFor(), gradeAnswer(), gradeFreeText(), GradeResult, realWordSet(), damerauLevenshtein(), sameWord(), TYPO_MAX_DISTANCE (+1 more)

### Community 219 - "Paper and Ink Design World"
Cohesion: 0.40
Nodes (5): Paper colour token set, Paper & Ink design world, Everything spoken must also be readable, Absent evidence must not be fabricated, Drill mode and the recognition-to-production ramp

## Knowledge Gaps
- **1367 isolated node(s):** `CheckOutcome`, `Device`, `Environment`, `Learner`, `RunOptions` (+1362 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **52 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `safetyDecision` connect `Safety Content Filters` to `Parle Tutor Agent`, `Conversation Brain Spend`, `Conversation Turn Orchestration`, `Tutor Prompt Building`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `DrillExercise` connect `Drill Session Copy Checks` to `Drill Exercise Validation`, `Answer Grading and Typo Distance`, `App Agent Protocol`, `Store Binding Tests`, `Learning Path Builder`, `Session Journal Storage`, `Drill Bank Store Merge`, `Topic Curation`, `Drill Screen Views`, `Activity Sync Policy`, `Drill Exercise Types`, `Live Failure Classification`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **What connects `CheckOutcome`, `Device`, `Environment` to the rest of the system?**
  _1367 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Entitlement Store` be split into smaller, more focused modules?**
  _Cohesion score 0.10668563300142248 - nodes in this community are weakly interconnected._
- **Should `Drill Session Copy Checks` be split into smaller, more focused modules?**
  _Cohesion score 0.11406423034330011 - nodes in this community are weakly interconnected._
- **Should `Pronunciation Drill Bank` be split into smaller, more focused modules?**
  _Cohesion score 0.08743169398907104 - nodes in this community are weakly interconnected._
- **Should `Sync Engine Types` be split into smaller, more focused modules?**
  _Cohesion score 0.08534850640113797 - nodes in this community are weakly interconnected._