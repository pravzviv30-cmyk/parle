# Local Rive illustrations

The four shared onboarding scenes (`welcome`, `level`, `plan`, `account`) and their renderer were deleted on 2026-11-01: C2 draws the onboarding art from exported SVG layers, and nothing loaded the `.riv` files. Their editable sources remain under `source/`, but the script that compiled them is gone; `streak` is the one scene that plays.

The dedicated `streak` asset is an original five-layer flame. Its `Celebrate` state machine runs an 800 ms ignition and then enters a four-second `Idle` loop; its separate `Idle` state machine starts without ignition. The loop deforms cubic vertices and handles, with quiet movement of the inner layers and a soft grounding shadow. `StreakFlame` prepares the native player before its owner starts the entrance, retains that player through ignition into idle, and pauses when inactive. Preparation is bounded to five seconds; reduced motion or failure reports a resting fallback so the screen can settle. On web, the same editable geometry drives actual contour deformation. Loading, reduced motion, and failure use the original resting SVG geometry. Streak celebration particles belong to the screen's shared timeline.

## Edit and build

The editable source is `source/<scene>/scene.rml`; each folder also contains its `rive.yaml` manifest. Using the official Rive CLI 1.5.1, to edit the streak flame, change `source/streak/geometry.json` and run:

```sh
RIVE_CLI=/path/to/rive python3 scripts/build-streak-rive.py
```

This verifies and compiles only `streak.riv`, regenerating its `scene.rml`, `resting.svg`, and `apps/mobile/src/streak/flameGeometry.ts`.

The native app uses `@rive-app/react-native` 0.5.4 and `react-native-nitro-modules` 0.36.1; the iOS pod dependency is RiveRuntime 6.28.0. The renderer explicitly sets `DataBindMode.None`: these shape/timeline scenes have no view model and need no automatic binding probe. Adding this runtime requires a new development binary, rather than a JavaScript-only update. Metro recognises `.riv` as an asset extension. Web does not load the native runtime.
