# Graph Report - Parle  (2026-08-22)

## Corpus Check
- 379 files · ~414,966 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2875 nodes · 7194 edges · 170 communities (136 shown, 34 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 86 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `aebf8573`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Entitlement
- drill/index.ts
- metering/index.ts
- phonemes/index.ts
- space
- LeaderboardTab.tsx
- openaiResponses.ts
- sessionLoop.ts
- Expo App Config
- userKey
- Tutor Agent Dependencies
- TutorTab.tsx
- dev.mjs
- Autonomous Bug Loop
- conversation.ts
- Mock Auth Adapter
- path.ts
- ttsCache.test.ts
- illustrations/index.ts
- ladder.ts
- generate.ts
- brain/package.json
- Token Server Manifest
- Playground Package Manifest
- session/session.ts
- SessionSummary
- ParleConversation
- anthropic.ts
- Core Package Manifest
- useLiveSession.ts
- Shared TypeScript Config
- copy.ts
- tutor.ts
- localAdapter.ts
- compilerOptions
- scripts
- profile.ts
- dependencies
- mobile/package.json
- App.tsx
- SessionScreen.tsx
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
- recap.ts
- Metro Runtime Dependency
- Expo Sharing Dependency
- Expo Speech Dependency
- openaiCompat.ts
- Expo Web Browser Dependency
- server.ts
- TutorIntro.tsx
- choosingView.ts
- Graph Guard Script
- React Native Dependency
- AsyncStorage Dependency
- contract/types.ts
- React Native SVG
- ConvoScreen
- drill/types.ts
- Gate Enforcement Script
- scheduler.ts
- Format
- Agent Fleet Validation
- Supabase Auth Adapter
- Rung
- Auth Adapter Interface
- brain/src/index.ts
- LiveKit WebRTC Dependency
- extractPrompt.ts
- shared/speechace.ts
- React Native Screens
- Bottom Tabs Navigation
- React Navigation Native
- Supabase Client Dependency
- src/theme.ts
- lessons/types.ts
- Android App Config
- Pedagogy Rules Doc
- normalise
- Live Voice Doc
- Forge Loop Guide
- State and Storage Docs
- Testing Guide
- Bug Hunter Role
- Architecture Overview Doc
- README.md
- convo.ts
- Fix Verifier Role
- engine/grading.ts
- OnboardingFlow.tsx
- core/src/index.ts
- Expo Plugins And Sharing
- sceneControls.test.ts
- Deploy Engineer Agent
- Observability Engineer Agent
- Revenue Engineer Agent
- protocol.ts
- LiveKit React Native
- Safe Area Context
- iOS App Config
- Forge Workflow Docs
- palette.test.ts
- Copy Style Tests
- Expo Font Dependency
- runEval.ts
- Expo File System
- API Engineer Agent
- Performance Engineer Agent
- Security Engineer Agent
- Auth Engineer Role
- Backend Engineer Role
- Data Engineer Role
- Frontend Engineer Role
- Team Roster Doc
- Design Architect Role
- Scaling Engineer Role
- paper
- release-engineer.md
- work-judge.md
- review/store.ts
- Pre-commit Hook
- Pre-push Hook
- Git Hook Installer
- warmCache.ts
- tokens.ts
- LiveContext.tsx
- LiveSessionScreen.tsx
- drill/grading.ts
- LlmUsage
- agent.ts
- encodeMessage
- auth.ts
- mix.test.ts
- TurnQueue
- activity.ts
- land.md
- Expo Status Bar
- ServerMessage
- motion.test.ts
- enterRecord.test.ts
- HomeTab.tsx
- labels.test.ts
- core/src/copy.test.ts
- keyboardTaps.test.ts
- typingPing.ts
- Cascaded STT to LLM to TTS voice pipeline
- topics/store.ts
- Paper & Ink design world
- surfaceContract.test.ts
- The free-form tutor brain
- expo-audio
- joinMeta.test.ts
- expo
- livekit-client
- react

## God Nodes (most connected - your core abstractions)
1. `Format` - 114 edges
2. `space()` - 82 edges
3. `LlmUsage` - 50 edges
4. `paper` - 49 edges
5. `ParleConversation` - 48 edges
6. `react` - 37 edges
7. `type` - 36 edges
8. `MockLlmClient` - 31 edges
9. `Rung` - 30 edges
10. `ScenarioFrame` - 28 edges

## Surprising Connections (you probably didn't know these)
- `Chrome is plain English, French only where it is content` --rationale_for--> `CAFE_LESSON`  [INFERRED]
  DESIGN.md → packages/core/src/lessons/cafe.ts
- `Drill mode and the recognition-to-production ramp` --conceptually_related_to--> `bestDrillFor()`  [INFERRED]
  README.md → packages/core/src/phonemes/drills.ts
- `A real spoken exchange inside one five-minute session` --rationale_for--> `createSession()`  [INFERRED]
  PRODUCT.md → packages/core/src/session/session.ts
- `460pt centred web column` --rationale_for--> `App()`  [INFERRED]
  DESIGN.md → apps/mobile/App.tsx
- `fitDisplay length-stepped French line` --rationale_for--> `fitDisplay()`  [EXTRACTED]
  DESIGN.md → apps/mobile/src/components.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **The four-rung scaffolding system, from principle to pixel** — product_scaffolding_ladder, product_never_stranded_never_scolded, design_support_colours_cool, packages_core_src_ladder_ladder_applyturn, apps_mobile_src_theme_rungcolor, readme_agent_authoritative [INFERRED 0.85]
- **The trustworthy-pronunciation chain** — product_trustworthy_pronunciation, product_french_only_depth, product_say_one_thing, readme_missing_score_no_penalty, packages_core_src_phonemes_inventory_french_phonemes, packages_core_src_phonemes_drills_drills, packages_core_src_phonemes_scoring_buildreport, services_shared_speechace_scoreutterance [INFERRED 0.85]
- **Unit economics and metering enforcement** — product_metered_minutes, product_cascaded_voice_pipeline, readme_metering_at_token_issuance, readme_tts_warm_cache, readme_risk_cost_per_session, packages_core_src_metering_meter_plans, packages_core_src_metering_meter_estimatesessioncost [INFERRED 0.85]

## Communities (170 total, 34 thin omitted)

### Community 0 - "Entitlement"
Cohesion: 0.19
Nodes (6): Entitlement, Plan, DevelopmentEntitlementStore, EntitlementStore, FileEntitlementStore, InMemoryEntitlementStore

### Community 1 - "drill/index.ts"
Cohesion: 0.14
Nodes (28): DrillVerdict, gradeAnswer(), answerCurrent(), AnsweredExercise, applyDrillResults(), buildDrillSession(), DRILL_STAGES, DrillFeedback (+20 more)

### Community 2 - "metering/index.ts"
Cohesion: 0.20
Nodes (19): canStartSession(), CostModel, DEFAULT_COST_MODEL, estimateSessionCost(), Margin, MIN_VIABLE_SESSION_SEC, planMargin(), PlanSpec (+11 more)

### Community 3 - "phonemes/index.ts"
Cohesion: 0.13
Nodes (35): bestDrillFor(), BY_ID, Drill, DrillKind, DRILLS, drillsFor(), DrillWord, getDrill() (+27 more)

### Community 4 - "space"
Cohesion: 0.11
Nodes (28): fitDisplay(), HelpGlyph(), LineBullet(), MicGlyph(), OptionCard(), SpeakCircle(), StationLine(), AppropriateReplyView() (+20 more)

### Community 5 - "LeaderboardTab.tsx"
Cohesion: 0.14
Nodes (22): useProfile(), build(), friends, AddFriendsScreen(), Hit, RowStatus, sheet, st (+14 more)

### Community 6 - "openaiResponses.ts"
Cohesion: 0.11
Nodes (24): FetchLike, realSleep(), RETRY_AFTER_CAP_MS, RETRY_AFTER_FALLBACK_MS, SleepLike, ContractSchema, DEFAULT_OPENAI_TURN_MODEL, FetchResponse (+16 more)

### Community 7 - "sessionLoop.ts"
Cohesion: 0.15
Nodes (30): applyNonSpokenInput(), supportViewForAssistance(), main(), pickClient(), Command, COMMAND_HELP, parseCommand(), STRICTNESS_LEVELS (+22 more)

### Community 8 - "Expo App Config"
Cohesion: 0.13
Nodes (14): expo, icon, name, newArchEnabled, orientation, scheme, slug, splash (+6 more)

### Community 9 - "userKey"
Cohesion: 0.13
Nodes (24): SignedInRoot(), KEY(), lastSummaryFor(), loadHistory(), recordSession(), clearActiveUserData(), LEGACY_KEYS, migrateLegacyStores() (+16 more)

### Community 10 - "Tutor Agent Dependencies"
Cohesion: 0.05
Nodes (37): @livekit/agents, @livekit/agents-plugin-anthropic, @livekit/agents-plugin-deepgram, @livekit/agents-plugin-elevenlabs, @livekit/agents-plugin-openai, @livekit/agents-plugin-silero, dependencies, dotenv (+29 more)

### Community 11 - "TutorTab.tsx"
Cohesion: 0.11
Nodes (24): hasSpokenBefore(), missionCompletionsFrom(), MissionsScreen(), st, isCompletion(), KEY(), loadMissionCompletions(), MissionCompletion (+16 more)

### Community 12 - "dev.mjs"
Cohesion: 0.09
Nodes (36): AGENT_ENV_FILE, children, COLOURS, die(), hasClaudeCli(), launch(), main(), probe() (+28 more)

### Community 13 - "Autonomous Bug Loop"
Cohesion: 0.07
Nodes (18): ALLOWED_TOOLS, argv, BRANCH, branchNow, current, deadEnds, DRY_RUN, final (+10 more)

### Community 14 - "conversation.ts"
Cohesion: 0.08
Nodes (40): CoachItem, SpeakerLine, SupportView, AssistanceDepth, BASE_RUNG_BY_CEFR, beatOf(), ConversationState, createConversation() (+32 more)

### Community 15 - "Mock Auth Adapter"
Cohesion: 0.21
Nodes (11): auth, build(), createMockAdapter(), notify(), setSession(), emptyStore(), MockAccount, MockStore (+3 more)

### Community 16 - "path.ts"
Cohesion: 0.24
Nodes (13): AUTHORED_PATH, AuthoredNode, authoredPhraseKeys(), AuthoredUnit, buildPath(), discussedInWords(), drillableKeys(), GENERATED_PREFIX (+5 more)

### Community 17 - "ttsCache.test.ts"
Cohesion: 0.06
Nodes (21): CachedChunkedStream, CachedTTS, defaultMissTransport(), normaliseLine(), ResolvedCachedTTSOptions, FakeChunkedStream, FakeSynthesizeStream, FakeTTS (+13 more)

### Community 18 - "illustrations/index.ts"
Cohesion: 0.14
Nodes (39): Frame(), Moving(), Scene(), SceneProps, Stipple(), SpeakBubbles(), HeroCafe(), NobodyYet() (+31 more)

### Community 19 - "ladder.ts"
Cohesion: 0.13
Nodes (29): Chrome is plain English, French only where it is content, No number and no scolding mid-session, applyTurn(), clamp(), directiveFor(), initialState(), INSTRUCTION_BY_RUNG, LadderState (+21 more)

### Community 20 - "generate.ts"
Cohesion: 0.06
Nodes (37): NewPhrase, applyCuration(), buildCurationRequest(), CuratedTopic, CurationInput, CurationSchema, INSTRUCTION, keyOf() (+29 more)

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
Cohesion: 0.15
Nodes (24): SessionViewProps, LadderDirective, PhonemeObservation, createSession(), FEEDBACK, FEEDBACK_FAMILIES, feedbackMessage(), grade() (+16 more)

### Community 25 - "SessionSummary"
Cohesion: 0.23
Nodes (15): SummaryScreen(), buildEntries(), csvField(), ExportEntry, toAnkiTsv(), toCsv(), buildReport(), buildTrends() (+7 more)

### Community 26 - "ParleConversation"
Cohesion: 0.16
Nodes (6): LearnerTurnInput, blocks(), blocks(), buildSystemBlocks(), ParleConversation, withDeadline()

### Community 27 - "anthropic.ts"
Cohesion: 0.12
Nodes (19): AnthropicBrainClient, AnthropicBrainConfig, outputConfig(), parse(), ParseCapableSdk, ParsedResponse, toProviderMessages(), usageOf() (+11 more)

### Community 28 - "Core Package Manifest"
Cohesion: 0.10
Nodes (19): devDependencies, @types/node, typescript, exports, ./ladder, ./lessons, ./metering, ./phonemes (+11 more)

### Community 29 - "useLiveSession.ts"
Cohesion: 0.13
Nodes (23): authHeaders(), scoreAttempt(), classifyFailure(), COPY, failureCopy, LiveFailure, micApiUnavailable(), EVERY_FAILURE (+15 more)

### Community 30 - "Shared TypeScript Config"
Cohesion: 0.10
Nodes (19): DOM, ES2023, compilerOptions, allowImportingTsExtensions, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules (+11 more)

### Community 31 - "copy.ts"
Cohesion: 0.09
Nodes (29): ANGLICISM, BLOCKING_ERROR, BY_KIND, coachFallbackLine(), CopyRule, copyViolations(), EM_DASH_RE, ENGLISH_HAND_BACK (+21 more)

### Community 32 - "tutor.ts"
Cohesion: 0.13
Nodes (11): currentPrompt(), baseInstructions(), buildPrompt(), turnInstructions(), ParleTutor, Publisher, build(), stubSession() (+3 more)

### Community 33 - "localAdapter.ts"
Cohesion: 0.09
Nodes (33): defaultStore(), FriendsStore, isStore(), KEY(), listeners, loadStore(), mutate(), notify() (+25 more)

### Community 34 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, noEmit, noUncheckedIndexedAccess, strict, types, exclude, extends (+8 more)

### Community 35 - "scripts"
Cohesion: 0.08
Nodes (23): description, engines, node, name, private, scripts, build:web, dev (+15 more)

### Community 36 - "profile.ts"
Cohesion: 0.12
Nodes (27): normalizeErrorTag(), applyExtractionToProfile(), applyTurnToProfile(), bandIndex(), createProfile(), evictOverflowPhrases(), evictStalePatterns(), EVIDENCE_WINDOW (+19 more)

### Community 37 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, expo-crypto, expo-linking, @livekit/react-native-expo-plugin, @parle/brain, @parle/core, react-dom, react-native-web (+9 more)

### Community 38 - "mobile/package.json"
Cohesion: 0.17
Nodes (11): devDependencies, @types/node, @types/react, typescript, @types/node, typescript, main, name (+3 more)

### Community 39 - "App.tsx"
Cohesion: 0.13
Nodes (27): Gate(), st, AuthFlow(), AuthScreen, SetNewPasswordScreen(), st, SignInScreen(), st (+19 more)

### Community 40 - "SessionScreen.tsx"
Cohesion: 0.16
Nodes (17): ANGLOPHONE_WEAKNESS, CARRIER, carrierWord(), estimateDurationSec(), jitter(), LearnerProfile, mockObservations(), Phase (+9 more)

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
Cohesion: 0.10
Nodes (18): LiveSessionScreen(), asRung(), ConvoRoute(), DrillRoute(), LazyConvoScreen, LazyLiveSessionScreen, LessonRoute(), st (+10 more)

### Community 47 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, android, export:web, ios, start, test, typecheck, web

### Community 49 - "journal.ts"
Cohesion: 0.20
Nodes (17): clearJournal(), journalRecap(), KEY(), recoverJournal(), serialized(), NOW, phrase(), recap() (+9 more)

### Community 50 - "preflight.ts"
Cohesion: 0.10
Nodes (27): tutorLLM(), frameDeadlineMs(), postSessionDeadlineMs(), turnDeadlineMs(), Brain, BRAIN_KEY, Env, FetchLike (+19 more)

### Community 51 - "drill/store.ts"
Cohesion: 0.16
Nodes (19): MAX_DRILL_EXERCISES, mergeExerciseBank(), defaultStore(), DrillStore, getMicSuppressedUntil(), hasGeneratedExercises(), isMicSuppressed(), isStore() (+11 more)

### Community 52 - "client.ts"
Cohesion: 0.07
Nodes (30): sampleCoachItem(), sampleSupport(), sampleTurn(), MemoryExtraction, ScenarioFrame, SupportMaterial, TutorTurn, Curation (+22 more)

### Community 53 - "ConvoScreen.tsx"
Cohesion: 0.13
Nodes (23): MissionWin(), st, SETTLE_MS, settleIn(), useReduceMotion(), bubbleStyle(), Scene(), SplashScreen() (+15 more)

### Community 54 - "recap.ts"
Cohesion: 0.14
Nodes (17): SessionRecap, LearnerSnapshot, KIND_PRIORITY, assembleRecap(), dedupeFixes(), FOCUS_BY_TAG, focusFrom(), HEADLINE_FAMILIES (+9 more)

### Community 58 - "openaiCompat.ts"
Cohesion: 0.24
Nodes (7): retryAfterMs(), ChatCompletion, ContractSchema, jsonSchemaText(), OpenAiCompatBrainClient, OpenAiCompatConfig, unwrap()

### Community 60 - "server.ts"
Cohesion: 0.18
Nodes (12): agentDebitAllowed(), config, developmentMinutes, json(), livekitUrl, PORT, readAudio(), readJson() (+4 more)

### Community 61 - "TutorIntro.tsx"
Cohesion: 0.13
Nodes (12): Read the exact versioned Expo docs before writing code, App(), ProgressDots(), TabBar(), OrbWalkthrough(), PAGES, st, TutorIntro() (+4 more)

### Community 62 - "choosingView.ts"
Cohesion: 0.22
Nodes (13): MAX_TURNS, pushTurn(), TurnLine, ANYTHING_GOES, ChoosingOrb, ChoosingState, choosingView, LiveMode (+5 more)

### Community 63 - "Graph Guard Script"
Cohesion: 0.29
Nodes (4): GRAPH, ROOT, ROUTING, SOURCE_EXTS

### Community 66 - "contract/types.ts"
Cohesion: 0.11
Nodes (24): AssessmentZ, CefrBandZ, CoachItemZ, CoachKindZ, MemoryExtractionSchema, MemoryFactZ, NewPhraseZ, OptionZ (+16 more)

### Community 68 - "ConvoScreen"
Cohesion: 0.10
Nodes (34): ConvoScreen(), COACH_MARK_TEXT, CoachMarkId, coachMarksAfter(), coachMarksAt(), CoachMarkState, CoachSignals, dismissCoachMark() (+26 more)

### Community 69 - "drill/types.ts"
Cohesion: 0.17
Nodes (18): typed(), withOptions(), AppropriateReplyExercise, BestSentenceExercise, DrillExerciseBase, FillBlankExercise, ListenTypeExercise, RepeatThisExercise (+10 more)

### Community 70 - "Gate Enforcement Script"
Cohesion: 0.10
Nodes (15): AGENT_MODELS, agentFiles, args, asJson, bless, counts, entries, failures (+7 more)

### Community 71 - "scheduler.ts"
Cohesion: 0.28
Nodes (12): AGAIN_RETRY_MS, applyGrade(), DEFAULT_EASE, DUE_CAP, goodIntervalDays(), GRADUATION_INTERVALS_DAYS, MIN_EASE, ReviewCard (+4 more)

### Community 72 - "Format"
Cohesion: 0.02
Nodes (114): A1 — A spoken answer has to match the script exactly, A2 — An empty transcript is graded as a wrong answer, A3 — A freeze at the top rung still asks the learner to invent French, A4 — A rescue can skip the beat the learner froze on, A5 — Two different opening-rung formulas, A6 — A focus point vanishes when the worst sound has no drill, A7 — A v2 snapshot with no memory crashes the worker, B0 — ParleTutor cannot be tested at all (+106 more)

### Community 73 - "Agent Fleet Validation"
Cohesion: 0.20
Nodes (11): AgentFrontmatter, agentProblems(), FRONTMATTER_FIELDS, frontmatterBlock(), parseAgentFrontmatter(), pinnedAgents(), READ_ONLY_AGENTS, routedAgents() (+3 more)

### Community 74 - "Supabase Auth Adapter"
Cohesion: 0.26
Nodes (4): startGoogleSignIn(), AuthResult, AuthUser, AuthContextValue

### Community 75 - "Rung"
Cohesion: 0.09
Nodes (38): CHOOSER_HEADLINE, CHOOSER_SUB, ChooserCard, ChooserInput, chooserView, FINISHED_LINE, headMissionId(), MissionRoute (+30 more)

### Community 77 - "brain/src/index.ts"
Cohesion: 0.25
Nodes (10): FR_PACK, renderAuthenticityPack(), AuthenticityPack, ContrastPair, Filler, RegisterDef, SlangEntry, historyViewOfTurn() (+2 more)

### Community 79 - "extractPrompt.ts"
Cohesion: 0.31
Nodes (9): MemoryFact, ChatMessage, buildExtractionRequest(), ExtractionInput, factLine(), INSTRUCTION, interview, request() (+1 more)

### Community 80 - "shared/speechace.ts"
Cohesion: 0.20
Nodes (8): ALIASES, FRENCH_IPA, toInventoryIpa(), parseSpeechace(), ScoreFetch, ScoreRequest, scoreUtterance(), RESPONSE

### Community 85 - "src/theme.ts"
Cohesion: 0.09
Nodes (38): st, WelcomeScreen(), ArrowRight(), EarGlyph(), Label(), s, Stat(), FocusDrillPlayer() (+30 more)

### Community 86 - "lessons/types.ts"
Cohesion: 0.15
Nodes (23): CAFE_LESSON, BY_ID, getLesson(), LESSONS, AcceptanceMatch, AcceptanceRoute, candidatesFor(), CefrLevel (+15 more)

### Community 87 - "Android App Config"
Cohesion: 0.20
Nodes (10): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, package, permissions, predictiveBackGestureEnabled (+2 more)

### Community 88 - "Pedagogy Rules Doc"
Cohesion: 0.25
Nodes (8): One focus, one drill, The four rungs, The invariants, The pedagogy, The rescue, Two independent axes, What counts as a right answer, Where the next session opens

### Community 89 - "normalise"
Cohesion: 0.27
Nodes (13): DrillDifficulty, checkAccepted(), checkDistinct(), englishGlosses(), expectedDifficulty(), inRange(), LabelledString, learnerVisibleStrings() (+5 more)

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

### Community 97 - "convo.ts"
Cohesion: 0.05
Nodes (34): supportViewFor(), asSentence(), brainClient(), chooseFrame(), ConversationPhase, ConvoView, missionOpening(), MOMENT_GRACE_MS (+26 more)

### Community 100 - "engine/grading.ts"
Cohesion: 0.15
Nodes (17): Assessment, CoachKind, ANSWERS_RATHER_THAN_INTERRUPTS, assessmentToQuality(), INLINE_CAP, INLINE_COACH_COOLDOWN_TURNS, splitCoach(), SURFACE (+9 more)

### Community 101 - "OnboardingFlow.tsx"
Cohesion: 0.07
Nodes (47): Ctx, ProfileGate(), ProfileValue, AGE_CONFIRM, AGE_DENY, AGE_QUESTION, AGE_REFUSAL, AGE_SUB (+39 more)

### Community 102 - "core/src/index.ts"
Cohesion: 0.20
Nodes (9): PathNodeRow(), MOMENT_ANSWER_MS, momentAnswer(), statusLine(), offersTalkAgain(), seedTopicFor(), TALK_AGAIN, talkAgainLabel() (+1 more)

### Community 103 - "Expo Plugins And Sharing"
Cohesion: 0.25
Nodes (6): plugins, expo-audio, expo-font, expo-sharing, expo-web-browser, @livekit/react-native-expo-plugin

### Community 104 - "sceneControls.test.ts"
Cohesion: 0.29
Nodes (9): hasSayableSupportLine(), sceneControls, controls(), fullLine, hint, none, options, typedTurn() (+1 more)

### Community 105 - "Deploy Engineer Agent"
Cohesion: 0.22
Nodes (8): How you work, Product invariants — a change that breaks one of these is wrong, however green, Ship the smallest real thing, Start by being honest about where this is, The order this has to happen in, What you must never do, When there is nothing to deploy to, say so, Your territory

### Community 106 - "Observability Engineer Agent"
Cohesion: 0.22
Nodes (8): How you work, Product invariants — a change that breaks one of these is wrong, however green, The line you do not cross, The seam to cut, when the time comes, What exists, and what does not, What you must never do, When there is no seam yet, say so, Your territory

### Community 107 - "Revenue Engineer Agent"
Cohesion: 0.22
Nodes (8): Copy about money is still learner copy, How you work, Product invariants — a change that breaks one of these is wrong, however green, The rule enforcement lives at, What already exists, What you must never do, Where a purchase lands, Your territory

### Community 108 - "protocol.ts"
Cohesion: 0.15
Nodes (20): asTheAgentReadsIt(), asTheAppReadsIt(), CLIENT_TAGS, ClientMessage, ConvoCoachItem, ConvoSpeakerLine, ConvoView, decodeAs() (+12 more)

### Community 111 - "iOS App Config"
Cohesion: 0.40
Nodes (5): ios, NSMicrophoneUsageDescription, bundleIdentifier, infoPlist, supportsTablet

### Community 112 - "Forge Workflow Docs"
Cohesion: 0.22
Nodes (9): /forge, Looping it, Not wired yet: the unattended loop, The contract, The gate watches the wiring too, Watch for judge drift, Who actually builds it, Why the judge's findings go in the ledger (+1 more)

### Community 113 - "palette.test.ts"
Cohesion: 0.15
Nodes (15): accents, HASHED, ink, Paper, PaperName, ALL, CARRIED, channels() (+7 more)

### Community 116 - "runEval.ts"
Cohesion: 0.12
Nodes (28): carriesFrench(), ZERO_USAGE, defaultModel(), DEFAULT_OPENAI_ANALYST_MODEL, buildScenarioRequest(), main(), pickClient(), PROFILES (+20 more)

### Community 118 - "API Engineer Agent"
Cohesion: 0.25
Nodes (7): How you work, Product invariants — a change that breaks one of these is wrong, however green, The LLM layer, The rule that matters most, The shape of the API, What you must never do, Your territory

### Community 119 - "Performance Engineer Agent"
Cohesion: 0.25
Nodes (7): How the TTS cache actually works, How you work, Product invariants — a change that breaks one of these is wrong, however green, Prompt caching, The number, What you must never do, Your territory

### Community 120 - "Security Engineer Agent"
Cohesion: 0.25
Nodes (7): How you work, Product invariants — a change that breaks one of these is wrong, however green, The habits already in the code, which you should extend, What is actually true today, unvarnished, What you must never do, When dispatched by /ship, Your territory

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

### Community 125 - "Team Roster Doc"
Cohesion: 0.29
Nodes (7): Calling them, Territory is the point, The gate defends the fleet, The team, The two that answer rather than build, Three of them are ahead of the code, Who owns what

### Community 126 - "Design Architect Role"
Cohesion: 0.33
Nodes (5): Orienting yourself, The ledger format is parsed, not read, The question you are actually answering, What you must never do, Your output — the contract

### Community 127 - "Scaling Engineer Role"
Cohesion: 0.33
Nodes (5): Default answer, The checks, What genuinely blocks a second instance today, What you must never do, Your output

### Community 128 - "paper"
Cohesion: 0.21
Nodes (12): HomeIcon(), LeaderboardIcon(), PracticeIcon(), ProfileIcon(), TabIconProps, TutorIcon(), announceTab(), ICONS (+4 more)

### Community 129 - "release-engineer.md"
Cohesion: 0.40
Nodes (4): The bar, The checks, What you must never do, Your output

### Community 130 - "work-judge.md"
Cohesion: 0.40
Nodes (4): The bar for sending work back, The checks, You may not grow the job, Your output

### Community 131 - "review/store.ts"
Cohesion: 0.18
Nodes (22): offersMix(), addFromSummary(), addPhrases(), caches, dueCount(), gradeCard(), gradeCards(), KEY() (+14 more)

### Community 138 - "warmCache.ts"
Cohesion: 0.47
Nodes (5): CONVO_LINES, buildTTS(), main(), scriptedLines(), splitter

### Community 139 - "tokens.ts"
Cohesion: 0.19
Nodes (14): PLANS, developmentEntitlementsEnabled(), GrantResult, grantSession(), roomNameFor(), SeedTopic, SessionGrant, SessionMode (+6 more)

### Community 140 - "LiveContext.tsx"
Cohesion: 0.28
Nodes (5): Ctx, LiveProvider(), LiveValue, SRC, TOKEN_SERVER

### Community 141 - "LiveSessionScreen.tsx"
Cohesion: 0.31
Nodes (6): GhostButton(), LiveErrorView(), show(), st, st, SessionView()

### Community 142 - "drill/grading.ts"
Cohesion: 0.40
Nodes (8): acceptedFor(), gradeFreeText(), GradeResult, realWordSet(), damerauLevenshtein(), sameWord(), TYPO_MAX_DISTANCE, TYPO_MIN_LENGTH

### Community 143 - "LlmUsage"
Cohesion: 0.16
Nodes (13): ClaudeCliBrainClient, ClaudeCliConfig, ClaudeCliRun, CliEnvelope, ContractSchema, extractJson(), jsonSchemaText(), spawnClaude() (+5 more)

### Community 144 - "agent.ts"
Cohesion: 0.13
Nodes (18): TokenMeta, sttLanguageFor(), createTurnTiming(), formatTiming(), formatVendorMetrics(), mark(), SEGMENTS, TimingStage (+10 more)

### Community 145 - "encodeMessage"
Cohesion: 0.25
Nodes (7): encodeMessage(), The agent is authoritative over session state, inbox, room, send(), smokeStartedAt, tokenReadyAt

### Community 146 - "auth.ts"
Cohesion: 0.25
Nodes (5): createUserResolver(), ResolvedUser, SIGN_IN_REQUIRED, UserResolver, VerifierConfig

### Community 147 - "mix.test.ts"
Cohesion: 0.16
Nodes (16): LESSONS_GROUP, card(), days(), NOW, topic(), MIX_OFFER, sittingTitle(), CAFE (+8 more)

### Community 149 - "activity.ts"
Cohesion: 0.13
Nodes (19): st, TodayRow(), ActivityEntry, ActivityKind, backfillFrom(), chain, empty(), mutate() (+11 more)

### Community 150 - "land.md"
Cohesion: 0.25
Nodes (7): 1. Who else is in this tree, 2. Where you are standing, 3. The gate, 4. The shape of the branch, 5. Deciding, 6. Landing, 7. Say what happened

### Community 153 - "motion.test.ts"
Cohesion: 0.33
Nodes (3): FILES, SRC, stripComments()

### Community 154 - "enterRecord.test.ts"
Cohesion: 0.29
Nodes (5): GROUNDS, HERE, LEDGER, REPO, RULE_TEST

### Community 155 - "HomeTab.tsx"
Cohesion: 0.15
Nodes (17): useLive(), Card(), PhrasebookCard(), st, papers, buildPhrasebook(), hasPhrases(), Hold (+9 more)

### Community 156 - "labels.test.ts"
Cohesion: 0.40
Nodes (5): KEPT, labelsInSource(), RETIRED, sourceFiles(), SRC

### Community 157 - "core/src/copy.test.ts"
Cohesion: 0.25
Nodes (5): check(), checkDrill(), DRILL_FIXTURES, NOW, OPTS

### Community 160 - "Cascaded STT to LLM to TTS voice pipeline"
Cohesion: 0.50
Nodes (4): Learner-accented French breaks ordinary STT, Cascaded STT to LLM to TTS voice pipeline, Risk 1: STT on real learner French, Self-hosted open-source LiveKit, the $0 stack

### Community 161 - "topics/store.ts"
Cohesion: 0.25
Nodes (13): KEY(), loadTopics(), mergeSessionTopics(), serialized(), StoredTopics, writeChain, MAX_DISCUSSED_DATES, MAX_STORED_TOPICS (+5 more)

### Community 162 - "Paper & Ink design world"
Cohesion: 0.17
Nodes (12): Paper colour token set, Paper & Ink design world, Absolute-beginner audience (CEFR A0-A2), Everything spoken must also be readable, Absent evidence must not be fabricated, Parle (working name), Expo + TypeScript npm-workspaces monorepo, Trustworthy pronunciation needs a reference text (+4 more)

### Community 163 - "surfaceContract.test.ts"
Cohesion: 0.40
Nodes (3): APP, SOURCES, stripComments()

### Community 164 - "The free-form tutor brain"
Cohesion: 0.33
Nodes (5): Acceptance checks, Cost envelope, Product contract, Provider decision, The free-form tutor brain

## Knowledge Gaps
- **907 isolated node(s):** `st`, `name`, `slug`, `version`, `orientation` (+902 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **34 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `App.tsx` to `paper`, `compilerOptions`, `review/store.ts`, `space`, `OnboardingFlow.tsx`, `LeaderboardTab.tsx`, `SessionScreen.tsx`, `TutorTab.tsx`, `LiveContext.tsx`, `LiveSessionScreen.tsx`, `RootNavigator.tsx`, `illustrations/index.ts`, `TutorIntro.tsx`, `src/theme.ts`, `ConvoScreen.tsx`, `HomeTab.tsx`, `useLiveSession.ts`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `types` connect `compilerOptions` to `App.tsx`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `st`, `name`, `slug` to the rest of the system?**
  _907 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `drill/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14260249554367202 - nodes in this community are weakly interconnected._
- **Should `phonemes/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13067552602436322 - nodes in this community are weakly interconnected._
- **Should `space` be split into smaller, more focused modules?**
  _Cohesion score 0.10887096774193548 - nodes in this community are weakly interconnected._
- **Should `LeaderboardTab.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13675213675213677 - nodes in this community are weakly interconnected._