# Graph Report - graphify-skill-integration-207da2  (2026-08-19)

## Corpus Check
- 174 files · ~116,756 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1391 nodes · 3585 edges · 69 communities (47 shown, 22 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 62 edges (avg confidence: 0.84)
- Token cost: 107,570 input · 0 output

## Community Hubs (Navigation)
- LLM Drill Authoring
- Drill Grading & Fixtures
- Metering & Unit Economics
- French Phoneme Inventory & Drills
- Shared UI Components
- Conversation Turn State
- Live Session Data Protocol
- Playground CLI & Profile Store
- Expo App Configuration
- App Shell & Home Navigation
- Tutor Agent Dependencies
- Learner Model & Memory
- Review Deck & Scheduling
- Authenticity & Copy Rules
- Conversation Engine Tests
- Account Adapters & OAuth
- Brain Contract Schemas
- TTS Cache Layer
- AI Quality Eval Suites
- Scaffolding Ladder State Machine
- Auth Screens & Gate
- Brain Package Manifest
- Token Server Manifest
- Playground Manifest
- Core Session Loop
- Illustrations & Onboarding
- Agent Conversation Orchestrator
- Drill Screen Views
- Core Package Manifest
- Cafe Lesson & Prompt
- Base TypeScript Config
- Drill Store & Mic State
- Tutor Agent Session Driver
- Mock Speech Pipeline
- Mobile TypeScript Config
- Workspace Root Manifest
- SpeechAce Scoring & Product Thesis
- Mobile Runtime Dependencies
- Mobile Dev Dependencies
- Memory Extraction Prompt
- Device Voice Fallback
- Brain TypeScript Config
- Core TypeScript Config
- Playground TypeScript Config
- Token Server TypeScript Config
- Tutor Agent TypeScript Config
- App Entry & Tab Shell
- Mobile npm Scripts
- Native Audio Globals
- Paper & Ink Design World
- Expo SDK Dependency
- Expo Crypto Dependency
- Expo File System Dependency
- Expo Font Dependency
- Expo Linking Dependency
- Expo Metro Runtime
- Expo Sharing Dependency
- Expo Speech Dependency
- Expo Status Bar
- Expo Web Browser
- LiveKit Client Dependency
- LiveKit Expo Plugin
- Parle Core Workspace Link
- React Dependency
- React Native Dependency
- Async Storage Dependency
- Safe Area Context
- React Native SVG
- React Native Web

## God Nodes (most connected - your core abstractions)
1. `space()` - 41 edges
2. `ParleConversation` - 27 edges
3. `LlmUsage` - 23 edges
4. `integrateTurn()` - 21 edges
5. `Rung` - 21 edges
6. `paper` - 20 edges
7. `ScenarioFrame` - 20 edges
8. `createConversation()` - 20 edges
9. `buildReport()` - 19 edges
10. `TutorTurn` - 18 edges

## Surprising Connections (you probably didn't know these)
- `Chrome is plain English, French only where it is content` --rationale_for--> `CAFE_LESSON`  [INFERRED]
  DESIGN.md → packages/core/src/lessons/cafe.ts
- `A real spoken exchange inside one five-minute session` --rationale_for--> `CAFE_LESSON`  [INFERRED]
  PRODUCT.md → packages/core/src/lessons/cafe.ts
- `Drill mode and the recognition-to-production ramp` --conceptually_related_to--> `bestDrillFor()`  [INFERRED]
  README.md → packages/core/src/phonemes/drills.ts
- `460pt centred web column` --rationale_for--> `App()`  [INFERRED]
  DESIGN.md → apps/mobile/App.tsx
- `Paper colour token set` --rationale_for--> `paper`  [EXTRACTED]
  DESIGN.md → apps/mobile/src/theme.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **The four-rung scaffolding system, from principle to pixel** — product_scaffolding_ladder, product_never_stranded_never_scolded, design_support_colours_cool, packages_core_src_ladder_ladder_applyturn, apps_mobile_src_theme_rungcolor, readme_agent_authoritative [INFERRED 0.85]
- **The trustworthy-pronunciation chain** — product_trustworthy_pronunciation, product_french_only_depth, product_say_one_thing, readme_missing_score_no_penalty, packages_core_src_phonemes_inventory_french_phonemes, packages_core_src_phonemes_drills_drills, packages_core_src_phonemes_scoring_buildreport, services_shared_speechace_scoreutterance [INFERRED 0.85]
- **Unit economics and metering enforcement** — product_metered_minutes, product_cascaded_voice_pipeline, readme_metering_at_token_issuance, readme_tts_warm_cache, readme_risk_cost_per_session, packages_core_src_metering_meter_plans, packages_core_src_metering_meter_estimatesessioncost [INFERRED 0.85]

## Communities (69 total, 22 thin omitted)

### Community 0 - "LLM Drill Authoring"
Cohesion: 0.05
Nodes (62): MemoryExtraction, ScenarioFrame, TutorTurn, AppropriateReplyZ, BASE, BestSentenceZ, buildDrillGenerationRequest(), DrillBatch (+54 more)

### Community 1 - "Drill Grading & Fixtures"
Cohesion: 0.07
Nodes (67): check(), checkDrill(), DRILL_FIXTURES, acceptedFor(), damerauLevenshtein(), DrillVerdict, gradeAnswer(), gradeFreeText() (+59 more)

### Community 2 - "Metering & Unit Economics"
Cohesion: 0.06
Nodes (53): canStartSession(), CostModel, DEFAULT_COST_MODEL, Entitlement, estimateSessionCost(), Margin, MIN_VIABLE_SESSION_SEC, Plan (+45 more)

### Community 3 - "French Phoneme Inventory & Drills"
Cohesion: 0.09
Nodes (46): bestDrillFor(), BY_ID, Drill, DrillKind, DRILLS, drillsFor(), DrillWord, getDrill() (+38 more)

### Community 4 - "Shared UI Components"
Cohesion: 0.11
Nodes (42): st, ArrowRight(), Card(), EarGlyph(), GhostButton(), HelpGlyph(), Label(), LineBullet() (+34 more)

### Community 5 - "Conversation Turn State"
Cohesion: 0.09
Nodes (38): Assessment, CoachItem, NewPhrase, SpeakerLine, SupportMaterial, SupportView, BASE_RUNG_BY_CEFR, beatOf() (+30 more)

### Community 6 - "Live Session Data Protocol"
Cohesion: 0.10
Nodes (34): authHeaders(), scoreAttempt(), ensureAudioSession(), ensureLiveKitGlobals(), releaseAudioSession(), LiveStatus, useLiveSession(), Rung (+26 more)

### Community 7 - "Playground CLI & Profile Store"
Cohesion: 0.13
Nodes (33): SessionRecap, createProfile(), main(), pickClient(), Command, COMMAND_HELP, parseCommand(), STRICTNESS_LEVELS (+25 more)

### Community 8 - "Expo App Configuration"
Cohesion: 0.05
Nodes (35): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, package, permissions, predictiveBackGestureEnabled (+27 more)

### Community 9 - "App Shell & Home Navigation"
Cohesion: 0.11
Nodes (32): asRung(), HomeRoot(), Screen, SignedInRoot(), st, useLiveAvailable(), hasGeneratedExercises(), AccountSheet() (+24 more)

### Community 10 - "Tutor Agent Dependencies"
Cohesion: 0.05
Nodes (37): @livekit/agents, @livekit/agents-plugin-anthropic, @livekit/agents-plugin-deepgram, @livekit/agents-plugin-elevenlabs, @livekit/agents-plugin-openai, @livekit/agents-plugin-silero, dependencies, dotenv (+29 more)

### Community 11 - "Learner Model & Memory"
Cohesion: 0.11
Nodes (29): ContrastPair, Filler, RegisterDef, SlangEntry, LearnerSnapshot, normalizeErrorTag(), applyExtractionToProfile(), applyTurnToProfile() (+21 more)

### Community 12 - "Review Deck & Scheduling"
Cohesion: 0.16
Nodes (28): addFromSummary(), addPhrases(), dueCount(), gradeCard(), KEY(), loadDeck(), saveDeck(), serialized() (+20 more)

### Community 13 - "Authenticity & Copy Rules"
Cohesion: 0.12
Nodes (23): FR_PACK, renderAuthenticityPack(), AuthenticityPack, CoachKind, coachFallbackLine(), CopyRule, copyViolations(), EM_DASH_RE (+15 more)

### Community 14 - "Conversation Engine Tests"
Cohesion: 0.11
Nodes (28): sampleCoachItem(), createConversation(), integrateTurn(), supportViewFor(), fresh(), baseState(), turnRequest(), learnerSnapshotFrom() (+20 more)

### Community 15 - "Account Adapters & OAuth"
Cohesion: 0.09
Nodes (14): auth, build(), createMockAdapter(), notify(), setSession(), emptyStore(), MockAccount, MockStore (+6 more)

### Community 16 - "Brain Contract Schemas"
Cohesion: 0.11
Nodes (23): sampleSupport(), sampleTurn(), AssessmentZ, CefrBandZ, CoachItemZ, CoachKindZ, MemoryExtractionSchema, MemoryFactZ (+15 more)

### Community 17 - "TTS Cache Layer"
Cohesion: 0.09
Nodes (12): CachedChunkedStream, CachedTTS, CachedTTSOptions, normaliseLine(), FakeChunkedStream, FakeTTS, NO_RETRY, synth() (+4 more)

### Community 18 - "AI Quality Eval Suites"
Cohesion: 0.14
Nodes (26): applyNonSpokenInput(), ZERO_USAGE, buildScenarioRequest(), buildSystemBlocks(), main(), pickClient(), PROFILES, checkFrame() (+18 more)

### Community 19 - "Scaffolding Ladder State Machine"
Cohesion: 0.14
Nodes (27): Chrome is plain English, French only where it is content, No number and no scolding mid-session, applyTurn(), clamp(), directiveFor(), initialState(), INSTRUCTION_BY_RUNG, LadderState (+19 more)

### Community 20 - "Auth Screens & Gate"
Cohesion: 0.14
Nodes (22): Gate(), AuthFlow(), AuthScreen, SetNewPasswordScreen(), st, SignInScreen(), st, SignUpScreen() (+14 more)

### Community 21 - "Brain Package Manifest"
Cohesion: 0.08
Nodes (24): @anthropic-ai/sdk, dependencies, @anthropic-ai/sdk, @parle/core, zod, description, devDependencies, @types/node (+16 more)

### Community 22 - "Token Server Manifest"
Cohesion: 0.08
Nodes (24): jose, livekit-server-sdk, dependencies, dotenv, jose, livekit-server-sdk, @parle/core, devDependencies (+16 more)

### Community 23 - "Playground Manifest"
Cohesion: 0.08
Nodes (24): dependencies, dotenv, @parle/brain, @parle/core, description, devDependencies, @types/node, typescript (+16 more)

### Community 24 - "Core Session Loop"
Cohesion: 0.18
Nodes (20): LiveSession, SessionViewProps, PhonemeObservation, feedbackMessage(), grade(), INTELLIGIBLE, LearnerInput, MAX_ATTEMPTS_PER_TURN (+12 more)

### Community 25 - "Illustrations & Onboarding"
Cohesion: 0.13
Nodes (19): HeroCafe(), LearnStack(), OnboardCake(), OnboardClock(), OnboardSuitcase(), OnboardWave(), RecapPostcard(), SpeakBubbles() (+11 more)

### Community 27 - "Drill Screen Views"
Cohesion: 0.20
Nodes (17): fitDisplay(), OptionCard(), ConvoScreen(), AppropriateReplyView(), BestSentenceView(), ds, FillBlankView(), kindTag() (+9 more)

### Community 28 - "Core Package Manifest"
Cohesion: 0.10
Nodes (19): devDependencies, @types/node, typescript, exports, ./ladder, ./lessons, ./metering, ./phonemes (+11 more)

### Community 29 - "Cafe Lesson & Prompt"
Cohesion: 0.23
Nodes (13): CAFE_LESSON, BY_ID, getLesson(), LESSONS, CefrLevel, isAcceptable(), Lesson, LessonTurn (+5 more)

### Community 30 - "Base TypeScript Config"
Cohesion: 0.10
Nodes (19): DOM, ES2023, compilerOptions, allowImportingTsExtensions, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules (+11 more)

### Community 31 - "Drill Store & Mic State"
Cohesion: 0.24
Nodes (16): defaultStore(), DrillStore, getMicSuppressedUntil(), isMicSuppressed(), isStore(), KEY(), loadDrillBank(), loadStore() (+8 more)

### Community 33 - "Mock Speech Pipeline"
Cohesion: 0.21
Nodes (13): ANGLOPHONE_WEAKNESS, CARRIER, carrierWord(), estimateDurationSec(), jitter(), LearnerProfile, mockObservations(), Phase (+5 more)

### Community 34 - "Mobile TypeScript Config"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, noEmit, noUncheckedIndexedAccess, strict, exclude, extends, include (+6 more)

### Community 35 - "Workspace Root Manifest"
Cohesion: 0.13
Nodes (14): description, engines, node, name, private, scripts, test, typecheck (+6 more)

### Community 36 - "SpeechAce Scoring & Product Thesis"
Cohesion: 0.16
Nodes (12): Absolute-beginner audience (CEFR A0-A2), Parle (working name), Expo + TypeScript npm-workspaces monorepo, Trustworthy pronunciation needs a reference text, The alignment thesis, A missing score is never an invented penalty, packages/core is deliberately platform-free, Repo path contains a space (+4 more)

### Community 37 - "Mobile Runtime Dependencies"
Cohesion: 0.15
Nodes (13): dependencies, expo-audio, @livekit/react-native, @livekit/react-native-webrtc, @parle/brain, react-dom, @supabase/supabase-js, @parle/brain (+5 more)

### Community 38 - "Mobile Dev Dependencies"
Cohesion: 0.20
Nodes (9): devDependencies, @types/react, typescript, typescript, main, name, private, version (+1 more)

### Community 39 - "Memory Extraction Prompt"
Cohesion: 0.33
Nodes (8): MemoryFact, buildExtractionRequest(), ExtractionInput, factLine(), INSTRUCTION, interview, request(), tennis

### Community 40 - "Device Voice Fallback"
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

### Community 46 - "App Entry & Tab Shell"
Cohesion: 0.29
Nodes (6): Read the exact versioned Expo docs before writing code, App(), ProgressDots(), TabBar(), Gate, onboarding, Home with Speak and Learn tabs, 460pt centred web column

### Community 47 - "Mobile npm Scripts"
Cohesion: 0.33
Nodes (6): scripts, android, ios, start, typecheck, web

### Community 49 - "Paper & Ink Design World"
Cohesion: 0.40
Nodes (5): Paper colour token set, Paper & Ink design world, Everything spoken must also be readable, Absent evidence must not be fabricated, Drill mode and the recognition-to-production ramp

## Knowledge Gaps
- **351 isolated node(s):** `Screen`, `st`, `name`, `slug`, `version` (+346 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `DrillExercise` connect `Drill Grading & Fixtures` to `LLM Drill Authoring`, `Live Session Data Protocol`, `Core Session Loop`, `Drill Screen Views`, `Drill Store & Mic State`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **What connects `Screen`, `st`, `name` to the rest of the system?**
  _351 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `LLM Drill Authoring` be split into smaller, more focused modules?**
  _Cohesion score 0.051058046981168705 - nodes in this community are weakly interconnected._
- **Should `Drill Grading & Fixtures` be split into smaller, more focused modules?**
  _Cohesion score 0.06540447504302926 - nodes in this community are weakly interconnected._
- **Should `Metering & Unit Economics` be split into smaller, more focused modules?**
  _Cohesion score 0.05859969558599695 - nodes in this community are weakly interconnected._
- **Should `French Phoneme Inventory & Drills` be split into smaller, more focused modules?**
  _Cohesion score 0.09415584415584416 - nodes in this community are weakly interconnected._
- **Should `Shared UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.11043771043771043 - nodes in this community are weakly interconnected._