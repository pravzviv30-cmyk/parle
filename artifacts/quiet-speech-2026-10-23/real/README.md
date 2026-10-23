# Founder recordings for the quiet speech check

Drop 16-bit PCM WAV files here (any sample rate, mono or stereo). The file name must contain
`whisper` or `soft`, and the slug of one of these sentences:

- `on-echange-nos-numeros` for "On échange nos numéros ?"
- `je-voudrais-un-cafe-s-il-vous-plait` for "Je voudrais un café, s'il vous plaît."
- `excusez-moi-ou-est-la-gare` for "Excusez-moi, où est la gare ?"

Example: `whisper-on-echange-nos-numeros.wav`. Record on a phone at a normal distance. Then rerun
`scripts/measureQuietSpeech.mjs` (without `--generate`); the files become their own group.
These are local evidence files: keep them out of git unless the founder agrees otherwise.
