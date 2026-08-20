# /forge

`/bug-sweep` is for work that is already understood: the ledger says what is wrong, and the
job is to fix it. `/forge` is for the other half — when you know what you want and not yet
what to build.

```
/forge let a learner replay the last scene without losing their rung
```

Fable designs it, this session builds it, Fable judges the result, and the pass ends when the
gate is green **and** the judge says `SHIP`.

## Why two models

The two halves of a change want different things. Deciding the shape rewards taking a long
look at the problem and rejecting four versions before writing anything down. Building the
shape rewards holding a lot of files in your head at once and not drifting.

So they are split. `design-architect` and `work-judge` are pinned to Fable and have no `Edit`
or `Write` at all. The executor is whatever model you are running, which is the one already
holding the context.

This is a subagent split rather than a setting because it has to be. Claude Code's only
mode-dependent model setting is `opusplan`, which means Opus while planning and Sonnet
otherwise — there is no equivalent for Fable. A pinned subagent works regardless of what your
session is running on, which also means it keeps working when you switch models.

## The contract

Step 2 writes `.forge/<slug>/contract.md`, and everything after that is measured against it:

```markdown
## The request              the user's words, verbatim
## What this actually solves
## The shape chosen         and the smaller shapes rejected, with reasons
## The seam being extended
## Files to touch
## Tradeoffs and risks
## Ledger entries           written before the work
## Out of scope
```

Two of those sections do most of the work.

**Ledger entries** are written before anything is built, which is the same rule LOOP.md sets
for the bug loop: an item you cannot phrase as "this test will prove it" is an item you do not
understand well enough to hand to a loop. They go into `docs/KNOWN_ISSUES.md` under an `F`
prefix, so forge work stays legible next to the `A`/`B`/`C`/`D` bug history.

**Out of scope** is the section that lets a pass finish. See below.

## Why the judge's findings go in the ledger

"Revise until it is great" has no stop condition. Ask anything whether work could be better
and the answer is always yes, so a judge left to its own taste will send work back forever.

Two things fix that.

First, **every revision becomes a real ledger entry** before it is worked on. That turns a
verdict into something the gate enforces, gives the loop memory across rounds — a finding you
only mention in your reply is a finding that dies with this iteration — and makes the stop
condition mechanical rather than a feeling.

Second, **the judge may not grow the job.** `REVISE` is only legal for a concrete failure
scenario with named inputs, a contract item that was not built, or a named rule broken. Taste
alone is `SHIP` with a note. Anything genuinely worth doing that sits outside the contract is
filed as a **P2**, and P2 does not block the gate — so it survives without trapping the pass.

Then a hard cap: **three rounds**. If the third does not reach `SHIP`, the pass stops and
reports what is blocking. A loop with no stop condition is a runaway, not an agent.

## The gate watches the wiring too

The whole design lives in one line of frontmatter per agent, and that line fails quietly:
delete `model: fable` and the agent inherits the session model, the thinking silently moves,
and every run still looks exactly the same from outside.

So `scripts/gate.mjs` has a fourth check, `agents`. It fails if `design-architect` or
`work-judge` has lost its Fable pin, if `bug-hunter` or `fix-verifier` has lost its Opus pin,
or if either command file has gone missing. It is the cheapest check in the gate and it
defends the only part of this that nothing else would notice.

## Looping it

```
/loop /forge          # self-paced
/loop 30m /forge      # every half hour
```

Same discipline as `npm run loop`, with you in the room.

## Watch for judge drift

If `work-judge` starts returning `SHIP` on everything, this is theatre with extra steps. The
round log at the bottom of `.forge/<slug>/contract.md` is what makes that visible: a run of
passes that never once hit `REVISE` is the signal to tighten its checks, not proof that the
work got good.

## Not wired yet: the unattended loop

`npm run loop` cannot run `/forge` today, and the reason is worth knowing — `Task` is absent
from `ALLOWED_TOOLS` in `scripts/loop.mjs`, so the unattended loop structurally cannot
dispatch *any* subagent. That includes bug-hunter and fix-verifier, which is why `npm run
loop` and `/bug-sweep` are not the same machine despite looking like it.

To wire it, when we come back to this:

- Add `Task` to `ALLOWED_TOOLS` in `scripts/loop.mjs`.
- Add `--plan-model` and `--judge-model` alongside the existing `--model`, which is unset by
  default and only forwarded when passed.
- Teach `composePrompt` to start from a `.forge/` contract when one exists, instead of always
  starting from the first open ledger item.

Deferred on purpose. The interactive pass should earn its keep before it runs unattended on
its own branch.

## Who actually builds it

Step 5 of `/forge` does not hand the work to a generic executor. It reads the contract's
*Files to touch* and routes to whichever of the twelve engineers owns those paths, each of
which knows the things about its territory that a generalist gets wrong.

The roster, the territories, and the two agents that answer rather than build are in
[TEAM.md](TEAM.md). One explanation per idea: this file stays about the loop.
