# Approved M2/M3 illustration family

These local 320 × 200 SVGs are the exact geometry used by the approved Remotion
study in `artifacts/m2-m3-motion-2026-10-18/motion-studio` and the refined Figma
masters in file `sjAwoGinWQKvhGrWbgMO18`:

| Motif | Figma master |
| --- | --- |
| cloud | 418:21471 |
| talk | 418:21506 |
| phrases | 418:21545 |
| practice | 418:21573 |
| journal | 418:21599 |
| market | 418:21625 |
| plans | 418:21668 |
| travel | 418:21722 |
| listen | 418:21764 |
| recovery | 418:21796 |

`figma-source/` retains the nonempty official SVG layer exports downloaded from
the masters' high-fidelity design context. Those exports use cropped individual
layer bounds; the full composition SVGs preserve the original shared viewBox.

The runtime component is `src/illustrations/MainIllustration.tsx`. Its exact
path geometry is in `MainIllustrationArt.ts`, with colours owned by `palette.ts`.
Eyes and offered hands have been separated into transform layers for the
explicitly approved native animation. No path is redrawn or substituted. Geometry
tests compare every primitive, colour and effective SVG transform against these
source SVGs in both themes.

`IllustrationLayer` drives a bounded gesture through the existing motion door.
It ends at the static source geometry, stays still under Reduce Motion, and
settles on navigation blur, backgrounding, account reset or deactivation. These
decorative layers neither simulate tutor status nor record learning progress.
