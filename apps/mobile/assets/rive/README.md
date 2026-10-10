# Local Rive illustrations

The four shared onboarding scenes use Luvani's flat illustration palette. Each has a 320 × 320 transparent artboard and a default state machine named `Motion`. They contain vector shapes only: no scripts, fonts, remote images, or account-dependent assets.

- `welcome`: conversation bubbles, gentle movement.
- `level`: notebook, pencil, and a confident reply, gentle movement.
- `plan` and `account`: a check badge with one confetti burst.

The badge burst timelines finish after 144 frames at 60 fps (2.4 seconds). Playback retires after completion or a background/reduced-motion interruption. The looping scenes stop when the app leaves the foreground. These four scenes show the same vector still while Reduce Motion is enabled, on web, during loading, and after a rendering failure.

The dedicated `streak` asset is an original five-layer flame. Its `Celebrate` state machine runs an 800 ms ignition and then enters a four-second `Idle` loop; its separate `Idle` state machine starts without ignition. The loop deforms cubic vertices and handles, with quiet movement of the inner layers and a soft grounding shadow. `StreakFlame` prepares the native player before its owner starts the entrance, retains that player through ignition into idle, and pauses when inactive. Preparation is bounded to five seconds; reduced motion or failure reports a resting fallback so the screen can settle. On web, the same editable geometry drives actual contour deformation. Loading, reduced motion, and failure use the original resting SVG geometry. Streak celebration particles belong to the screen's shared timeline.

## Edit and build

The editable source is `source/<scene>/scene.rml`; each folder also contains its `rive.yaml` manifest. Using the official Rive CLI 1.5.1:

```sh
RIVE_CLI=/path/to/rive python3 scripts/build-onboarding-rive.py
```

Run this command from the repository root. It verifies and compiles only `welcome`, `level`, `plan`, and `account`, and regenerates `apps/mobile/src/art/flat/onboardingRiveStills.ts` from the same source. The finite scenes' fallback uses their final frame so confetti is hidden when motion is withheld.

To edit the streak flame, change `source/streak/geometry.json` and run:

```sh
RIVE_CLI=/path/to/rive python3 scripts/build-streak-rive.py
```

This verifies and compiles only `streak.riv`, regenerating its `scene.rml`, `resting.svg`, and `apps/mobile/src/streak/flameGeometry.ts`. It leaves the four shared onboarding scenes untouched.

The native app uses `@rive-app/react-native` 0.5.4 and `react-native-nitro-modules` 0.36.1; the iOS pod dependency is RiveRuntime 6.28.0. Both renderers explicitly set `DataBindMode.None`: these shape/timeline scenes have no view model and need no automatic binding probe. Adding this runtime requires a new development binary, rather than a JavaScript-only update. Metro recognises `.riv` as an asset extension. Web does not load the native runtime.
