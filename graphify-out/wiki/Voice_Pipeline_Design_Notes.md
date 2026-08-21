# Voice Pipeline Design Notes

> 4 nodes · cohesion 0.50

## Key Concepts

- **Cascaded STT to LLM to TTS voice pipeline** (4 connections) — `PRODUCT.md`
- **Learner-accented French breaks ordinary STT** (2 connections) — `PRODUCT.md`
- **Risk 1: STT on real learner French** (1 connections) — `README.md`
- **Self-hosted open-source LiveKit, the $0 stack** (1 connections) — `README.md`

## Relationships

- [Session Cost Metering](Session_Cost_Metering.md) (2 shared connections)

## Source Files

- `PRODUCT.md`
- `README.md`

## Audit Trail

- EXTRACTED: 3 (60%)
- INFERRED: 2 (40%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*