# Video research · 9 October 2026

## Evidence and limits

The three requested URLs were opened and scraped in this review. Complete text transcripts were returned for videos 1 and 3 by Firecrawl; browser transcript export reported unavailable for both. Browser playback and sampled captions were accessible. Video 2 has a previously captured, timestamped analysis in `docs/VIDEO_UX_PRODUCTION_REVIEW.md` (section beginning “The Reason Why Some Apps Feel Expensive”); the fresh scrape confirms its identity and chapters. This is a transcript-led review with sampled visuals, not a claim that every frame was watched. Raw scrapes are local, ignored research evidence under `.firecrawl/master-*.md`; do not redistribute whole transcripts.

## 1. Paywall structure

[How Top Apps Scientifically Design Paywalls That Convert — Tim Gabe](https://www.youtube.com/watch?v=qJ4qYhTqAz0), 4:03 shown by the player.

The argument is to test structure before price. Mojo removed a competing credit purchase from its first subscription screen; the speaker reports 14% more new subscription revenue. Built With Science combined annual emphasis with a trial timeline and reportedly increased annual share from 60% to 75–80%. Pregnancy+ reportedly earned more from a trial than an introductory discount. Undertone’s unblurred recap is a proposed redesign, not a demonstrated result. These are reported case studies without raw data, sample sizes or full experimental controls; Luvani cannot claim the same uplift.

Verified player samples: 0:48 discusses ordering and trial explanation; 1:37 discusses Mojo’s removed credit option and the claimed uplift; 3:15 introduces Undertone’s therapy recaps. The seek screenshots did not provide reliable full-screen comparisons for every case, so no pixel-level reconstruction is claimed.

**Luvani decisions:** one Starter duration decision at a time; Weekly stays visible alongside Monthly and Yearly; Max has a separate comparison entry. No add-on credits on the initial offer. Yearly’s free trial needs a clear allowance and renewal charge. Keep earned phrases available after dismissal. No blurred personal progress, fabricated discount, timed exit trap or unverified success claim. Test duration ordering separately from trial copy and prices.

## 2. Perceived quality

[The Reason Why Some Apps Feel Expensive, But Most Don’t — Wyatt Feaster](https://www.youtube.com/watch?v=SAxKK5fbjbc), 7:40.

The prior caption/visual review identifies anticipation at 0:32–1:15; paced transitions at 1:15–2:07; delight at 2:20–3:06; restraint at 3:06–3:38; consistency at 3:38–4:26; useful empty states at 4:26–5:27; rewarding discovery at 5:27–6:02; and actionable errors at 6:02–6:34. The core idea is that perceived quality comes from predictable, considered behaviour as much as visual styling.

**Luvani decisions:** one next practice action; a short celebration only after real learning; shared surfaces and controls; contextual help; errors that preserve drafts and offer a specific retry. Loading reflects real work. Do not introduce fake “building your plan” waits, permanent moving decoration, hidden essential controls or a premature paywall before the first useful moment. Existing October 4 findings are historical evidence, not proof that those defects remain today.

## 3. Mobile structure

[Everything you need to know about Mobile App UI’s in 8 minutes — Kole Jain](https://www.youtube.com/watch?v=Gfsd8NNuD9g), 7:36.

Published chapter anchors: navigation 0:20; scale 1:32; content 2:13; one screen/one job 3:30; gestures 5:11; dynamism 6:02; empty states 6:27. The video demonstrates reducing desktop structure to focused mobile tasks, avoiding nested containers, exposing contextual actions and providing recovery from empty searches. Browser playback at 3:48–3:51 confirmed the focused notes-editor example and its discussion of removing unrelated recent-note/template content. The sponsor’s asset library is not a required dependency.

**Luvani decisions:** keep four main tabs, move focused sessions above them, use one vertical content axis, simplify nested cards, and retain explicit Back/Close controls alongside gestures. Sheets handle short choices; whole screens handle speaking and payment. At large text sizes, readability wins over the no-scroll ideal. Tablet layouts centre the task rather than enlarge a phone UI across the screen.

## Combined experiments and measurement

| Hypothesis | Controlled change | Primary signal | Guardrails |
|---|---|---|---|
| Less offer-reading improves comprehension | Compact duration rows; prices unchanged | Correct price/renewal answers in usability sessions | Weekly discoverability, allowance understanding |
| Personal relevance improves activation | Goal-specific first scene; same task difficulty | First meaningful practice completed | Time to value, skip rate, permission refusal |
| Clear yearly terms improve qualified trials | Trial allowance + renewal disclosure | Verified trial starts per eligible offer view | Refunds, early cancellations, complaints |
| Better recovery saves interrupted sessions | Preserve draft/selection and specific retry | Successful recovery | Duplicate purchases, lost text, incorrect minute grants |

Do comprehension testing before a conversion experiment. Define event denominators by eligibility, storefront, entry point and verified transaction state. Set sample size from actual traffic and baseline variance before launch; the videos cannot supply Luvani’s sample size or expected lift. Consent and existing analytics minimisation still apply.
