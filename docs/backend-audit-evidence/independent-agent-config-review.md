# Independent review of backend architecture agent configuration

Review target: current worktree, 3 October 2026. Read-only inspection; no source/config edits. Actual roles are Claude Code repository definitions, not native Codex auto registrations. No pinned Fable runtime dispatch was executed by this reviewer; inspection/tests establish configuration, not provider availability.

## Verdict

READY for configuration review, subject to writing the referenced audit artifact. All four definitions have filename-matching names, the prescribed frontmatter order, model `fable`, only `Read, Grep, Glob, Bash`, and explicit read-only Bash instructions. `scripts/gate.mjs:318-321` pins all four, and `services/shared/agentFleet.ts:36-39` lists them as read-only. `/forge` routes all four at `.claude/commands/forge.md:27-30`; `/ship` calls deployment and touched specialists at `.claude/commands/ship.md:24-30`; the new `/backend-review` consistently prohibits source/external mutations, retains evidence gaps, honors unavailable model dispatch, and does not deploy or schedule work.

Focused verification: `node --test --experimental-strip-types services/tutor-agent/src/agentFleet.test.ts`; 7 tests, 3 suites, 7 pass, zero failures/skips, ~99 ms. This checks actual definitions, pins, read-only Edit/Write exclusion, existence and /forge references. Full gate was not rerun by this reviewer. Model value equality also checked manually against gate map; runtime model availability is not proved.

## Scope/ownership review

`backend-architect` owns cross-service invariants and coordinates reviews, not implementation. Database security explicitly includes direct Data API calls, service-role owner checks, grants/definer/search-path, actual migration state, concurrent PostgreSQL proof and erasure beyond the main database. Voice reliability explicitly includes job process isolation, replay/abandon/reconnect admission, full payload validation, actual settlement and provider cost, shutdown durability, measured latency and personalized cache erasure. Deployment explicitly requires exact candidate/environment/schema evidence, branch enforcement, compatibility/drain/canary, managed-first capacity, recoverability and observable SLOs. Each returns conditions and acceptance checks to the existing named engineers rather than silently taking their files.

No newly added instruction allows deployment, merge, secret rotation, hosted migrations, learner-row inspection, branch-rule changes, restore or scheduled automation as a side effect. Readiness does not imply execution authorization. Pinned-model failure must be reported; silent substitute verdicts are prohibited.

## Scenario routing

| Scenario | Appropriate architectural review | Implementation owners |
|---|---|---|
| Grant/meter migration spanning API, persisted entitlement and voice admission | backend-architect + database-security-architect + voice-reliability-architect; deployment-architect for schema rollout/public release compatibility | revenue-engineer, data-sync/data-engineer, auth/security/API/backend/voice-platform as touched paths require |
| TTS provider/runtime/cache change | voice-reliability-architect; backend-architect only for cross-service contracts; database-security-architect when personal-data retention/erasure or persisted schema changes; deployment-architect for hosting/rollout/capacity | voice-platform-engineer + performance-engineer + backend/API or privacy-safety as touched paths require |
| Pure UI spacing/theme/screen edit, no data/session/auth contract changes | existing design-architect/territory builder/work-judge sequence; none of four backend architects needed | frontend-engineer or design-system/practice-ux engineer per precise territory |

## Nonblocking qualifications

1. `.claude/agents/backend-architect.md:12-13` references `docs/BACKEND_PRODUCTION_AUDIT.md`, absent at inspection. Complete the report artifact before announcing the package complete.
2. `CLAUDE.md:142` still says "Sixteen agents"; `.claude/agents/` contains 33 definitions. This predates the additions but becomes visibly stale. Do not claim the root agent inventory is fully reconciled.
3. Existing `/ship` top prose says "Nothing is edited" and `docs/TEAM.md:119-122` says "edits nothing," but `.claude/commands/ship.md:32` instructs writing ledger findings. This is an existing ambiguity, not introduced authorization for production work. `/backend-review` specifically forbids ledger edits and is coherent.
4. No Edit/Write does not provide a hard read-only execution sandbox when Bash remains available. The new descriptions constrain Bash appropriately, but technical claims that guards literally cannot modify files are stronger than the enforcement. Use a genuinely read-only sandbox if hard separation is required.
5. `scripts/gate.mjs:376` asserts only existing forge/bug-sweep/ship command presence, not backend-review. The new architects are all routed and covered, but deleting the new command would not itself fail that gate presence check. A small future guard extension would protect this dispatch entrypoint; no blocking defect in the present files.

Log: /private/tmp/luvani-audit-agentfleet.log.
