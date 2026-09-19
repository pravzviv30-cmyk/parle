# Offline daily French audio

Release pack: 1,000 word pronunciations, 1,000 word-example recordings, and
1,000 phrase recordings. Repeated text shares one file: 2,957 unique AAC/M4A
clips, approximately 47 MB on disk. The static manifest bundles every clip in
native builds. Slow replay changes the local player's playback rate to 0.75.
Web builds serve these assets from the app host; a first web visit still needs
the host, and this change does not add a service worker for offline web caching.

Generated locally with hexgrad/Kokoro-82M v1, Kokoro Python 0.9.4, French
`ff_siwis`, speed 1, mono 24 kHz AAC at 48 kbit/s. No paid TTS API, account,
or API key is used to build or play this pack. The model weights are build-time
tools and are not included in the app. Source model revision used:
`f3ff3571791e39611d31c381e3a41a3af07b4987`.

Upstream model: https://huggingface.co/hexgrad/Kokoro-82M
Upstream code/licence: https://github.com/hexgrad/kokoro (Apache License 2.0).
Full licence copies are in `src/legal/dailyLicences.ts` and the app's
Acknowledgements screen. This directory contains synthetic output, not the model.

Rebuild from repository root:

```sh
LUVANI_AUDIO_PYTHON=/path/to/venv/bin/python node --experimental-strip-types scripts/build-daily-audio.mjs
```

The Python environment needs `kokoro==0.9.4`, `espeakng-loader==0.2.4`,
NumPy, PyTorch and ffmpeg on PATH. Public model weights download once at
build time. Filenames hash the text, voice and generation version. A text
change creates a new recording; the manifest updates only after all jobs finish.
Automated checks verify complete coverage, non-silent generated waveforms,
content-matched filenames and container headers. They do not replace a fluent
French editorial/listening pass or native-device playback testing.
