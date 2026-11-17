# Voice latency, local measurements (2026-11-17)

Branch `claude/voice-latency`, wave 2 (F983, F984). Measured from a developer Mac on home
broadband, straight at the vendors, off the paid proxy. Nothing here is a room measurement:
the before and after for the room is `[luvani:reply-stages]` and `[luvani:scene-first-frame]`
at the founder's device session.

## 1. ElevenLabs preconnect (F984), free

A keyless, bodiless `HEAD https://api.elevenlabs.io/` with `redirect: 'error'` and a 3 s
timeout, through Node 24.16's global `fetch` (the same pool the paid transport uses). The
origin answers 404 to a HEAD, which is fine: only the connection matters. Five fresh
processes, each timing a cold request, a second one after 2 s idle, and a third after 10 s
idle.

| Process | Cold (ms) | After 2 s (ms) | After 10 s (ms) |
|---|---|---|---|
| 1 | 236 | 211 | 180 |
| 2 | 367 | 153 | 318 |
| 3 | 267 | 189 | 187 |
| 4 | 330 | 140 | 238 |
| 5 | 331 | 180 | 169 |
| **p50** | **330** | **180** | **187** |

A curl breakdown of one request: DNS 4 ms, TCP connect 16 ms, TLS done at 36 ms, total
174 ms. The time is in the server's answer, not the handshake.

Reading:
- From this machine a warm connection saves about 150 ms p50 on the first request.
- Node's fetch drops an idle socket after about 4 s by default, so after 10 s idle the third
  request is close to cold again, minus DNS. The preconnect helps only a first line said soon
  after join.
- The staging gap (opening TTS first byte 1,312 ms against 385 to 505 ms afterwards,
  2026-11-10) is far larger than the handshake measured here, so the preconnect alone may buy
  little. The device session decides whether it stays.

## 2. Brain turn, cold against warm, and coach close against the whole turn (F983, F984)

`scripts/measureLiveTurn.mjs` with `LUVANI_TURN_REPLY_FIRST=1`, the dev OpenAI key from the
main checkout's `services/tutor-agent/.env`. Only the key and model lines were passed, through
process substitution, so no key was printed or written. Model `gpt-6-luna`, reasoning effort
`none`, verbosity `low`, default service tier, prompt cache key `luvani-turn-20fc417e`.
3 cases x 3 reps, 9 calls, 0 failed, estimated spend $0.0035 (founder yes, Q6).

| Call | ttft | coach closes | spoken fields (reply) | whole turn | cached / input |
|---|---|---|---|---|---|
| cafe-english-reach #1 (cold) | 3,902 | 5,967 | 4,881 | 8,243 | 0 / 7,172 |
| cafe-flux-coffee #1 | 1,578 | 3,345 | 2,440 | 5,781 | 6,323 / 7,168 |
| hotel-english-question #1 | 978 | 2,880 | 2,080 | 4,685 | 6,323 / 7,344 |
| cafe-english-reach #2 | 1,876 | 3,812 | 2,807 | 6,780 | 6,821 / 7,172 |
| cafe-flux-coffee #2 | 2,487 | 4,276 | 3,342 | 6,693 | 6,817 / 7,168 |
| hotel-english-question #2 | 1,106 | 2,818 | 2,000 | 4,753 | 6,996 / 7,344 |
| cafe-english-reach #3 | 856 | 2,745 | 1,694 | 4,592 | 6,821 / 7,172 |
| cafe-flux-coffee #3 | 1,028 | 2,514 | 1,750 | 4,677 | 6,817 / 7,168 |
| hotel-english-question #3 | 884 | 2,543 | 1,757 | 4,430 | 6,996 / 7,344 |

All times are milliseconds from the request. p50 over the 9: ttft 1,106, coach closes 2,880,
reply spoken fields 2,080, whole turn 4,753.

**F983, English reach (the two English cases, 6 calls).** The coach closes, which is when a
reply-first English-reach turn now speaks, before the whole turn by 2,276, 2,968, 1,847,
1,805, 1,935 and 1,887 ms: about 1.9 s p50. Before F983 these turns waited for the whole turn.

**F984, cold against warm.** The first call of the run had nothing cached and took 3,902 ms
to its first token; the warmed calls' ttft p50 is about 1,100 ms with 6,300 to 7,000 of
about 7,200 input tokens cached. That is one cold sample, and it also paid the cold
connection to OpenAI, so it bounds the warm-up's gain from above rather than measuring it.
With `LUVANI_BRAIN_WARMUP=1` the warm-up spends this cold call at the scene opening instead
of on the learner's first reply.
