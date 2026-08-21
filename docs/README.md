# docs

Read the one file that answers your question. That is the whole point of this
folder: a session should be able to load a single page and start work, instead of
re-deriving the architecture from source every time.

| If you need to know | Read |
|---|---|
| What the six workspaces are and which one owns a decision | [ARCHITECTURE.md](ARCHITECTURE.md) |
| How a live session actually works, end to end | [LIVE_VOICE.md](LIVE_VOICE.md) |
| How the free tutor behaves, which model to use, and what it costs | [TUTOR_BRAIN.md](TUTOR_BRAIN.md) |
| The ladder, the rescue, and what counts as a right answer | [PEDAGOGY.md](PEDAGOGY.md) |
| Where the learner's data lives and what shape it is in | [STATE_AND_STORAGE.md](STATE_AND_STORAGE.md) |
| How to run and write tests, and the trap that eats whole suites | [TESTING.md](TESTING.md) |
| The gate, the bug loop, and how to give it a goal it can check | [LOOP.md](LOOP.md) |
| Building something new: Fable designs, Opus builds, Fable judges | [FORGE.md](FORGE.md) |
| Who owns which part of the codebase, and which agent to call | [TEAM.md](TEAM.md) |
| What is known to be broken right now | [KNOWN_ISSUES.md](KNOWN_ISSUES.md) |

These deliberately do not repeat what already exists:

- **[../README.md](../README.md)** — how to run it, which keys buy what, the wiring inventory.
- **[../PRODUCT.md](../PRODUCT.md)** — who this is for and why it exists. The source of truth
  for any question that starts "should we".
- **[../DESIGN.md](../DESIGN.md)** — colour, type, motion, copy tone. Recorded from the
  built artifact, not from intentions.
- **[../CLAUDE.md](../CLAUDE.md)** — the operating rules for working in this repo.

If you are about to write a fourth document explaining the ladder, stop: it is in
PEDAGOGY.md, and the code is in `packages/core/src/ladder/ladder.ts`. One
explanation per idea is the rule that keeps this folder worth reading.
