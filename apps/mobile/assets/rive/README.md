# Onboarding illustrations

These six original, local Rive scenes use Luvani's flat illustration palette. Each has a 320 × 320 transparent artboard and a default state machine named `Motion`. They contain vector shapes only: no scripts, fonts, remote images, or account-dependent assets.

- `welcome`: conversation bubbles, gentle movement.
- `level`: notebook, pencil, and a confident reply, gentle movement.
- `streak`: a breathing flame.
- `plan` and `account`: a check badge with one confetti burst.
- `confetti`: a standalone burst for the streak screen.

The burst timelines finish after 144 frames at 60 fps (2.4 seconds). Playback retires after completion or a background/reduced-motion interruption. The looping scenes stop when the app leaves the foreground. All scenes show the same vector still while Reduce Motion is enabled, on web, during loading, and after a rendering failure.

## Edit and build

The editable source is `source/<scene>/scene.rml`; each folder also contains its `rive.yaml` manifest. Using the official Rive CLI 1.5.1:

```sh
RIVE_CLI=/path/to/rive python3 scripts/build-onboarding-rive.py
```

Run this command from the repository root. It verifies each source, compiles the `.riv` files, and regenerates `apps/mobile/src/art/flat/onboardingRiveStills.ts` from the same source. The finite scenes' fallback uses their final frame so confetti is hidden when motion is withheld.

The native app uses `@rive-app/react-native` 0.5.4 and `react-native-nitro-modules` 0.36.1; the iOS pod dependency is RiveRuntime 6.28.0. The renderer explicitly sets `DataBindMode.None`: these shape/timeline scenes have no view model and need no automatic binding probe. Adding this runtime requires a new development binary, rather than a JavaScript-only update. Metro recognises `.riv` as an asset extension. Web uses the vector fallback and does not load the native runtime.
