# Hosting the legal pages

App Store Connect asks for two web addresses that have nothing to do with the app
binary: a **Privacy Policy URL** and a **Support URL**. Apple's reviewer opens both.
The app already draws the same words on a screen, so this is only about getting a
copy of them onto the open web.

This is the founder's runbook, written down rather than left in a transcript. It is
a one-off of maybe fifteen minutes, and both URLs can be changed later without a new
build, so buying a domain afterwards costs nothing.

Nothing here needs a card. Cloudflare Pages on the free tier is enough.

---

## The live pages, as at 2026-09-09

The site exists. Cloudflare Pages project `luvani-legal`, free tier, direct upload, no domain
bought and Access left off.

| Page | URL | Goes in |
|---|---|---|
| Privacy notice | `https://luvani-legal.pages.dev/privacy` | App Store Connect, Privacy Policy URL |
| Support | `https://luvani-legal.pages.dev/support` | App Store Connect, Support URL |
| Root | `https://luvani-legal.pages.dev/` | Nowhere. It is for anyone who trims the path back |

**Cloudflare rewrites away the `.html`.** Uploading `privacy.html` publishes it at `/privacy`, and
the `.html` form answers `308` to the clean one. Submit the clean URLs, not the `.html` ones, so
Apple's checker meets a `200` rather than a redirect.

Verified on upload: both `200`, both byte-identical to what `npm run legal:html` writes, zero script
tags, zero external assets, no login wall.

The bare root `/` answered `404` on that upload, because the generator wrote no `index.html`. It
writes one now (F487): a signpost carrying the company line and a link to each of the two pages,
built from the same modules they are, so it cannot name a page that was not generated. **The live
site has not been re-uploaded yet**, so the root goes on answering `404` until the folder is dropped
on Cloudflare again.

**Uploading is a manual step and the page does not update itself.** Any change to `legal/policy.ts`
or `legal/company.ts` means `npm run legal:html` and another upload, or the hosted notice and the one
in the app stop agreeing. The drift test from F480 catches the two files disagreeing inside the repo;
nothing can catch the repo disagreeing with Cloudflare.

## Part A: generate the files

From the repo root:

```
npm run legal:html
```

That writes three files into `apps/mobile/src/legal/dist/`:

- `index.html` — the root, which Cloudflare serves at `/`. A heading, one line saying what
  Luvani is, and a link to each of the other two. Every word on it comes from the modules
  that render those two, so it holds nothing of its own to go stale.
- `privacy.html` — the whole privacy notice, the same sections the app draws.
- `support.html` — the support page.

They are committed to the repo, and a test regenerates them and fails if what is
committed no longer matches `apps/mobile/src/legal/policy.ts`. So the page you upload
and the screen a learner reads cannot say different things, which is the failure that
gets a resubmission refused.

Both pages are plain HTML: no script, no webfont, no image, nothing loaded from
anywhere else. That is enforced by a test too.

**`support.html` is not ready yet.** Until a support address is set in
`apps/mobile/src/legal/company.ts`, the page says so on its face rather than
inventing a way to be reached. Upload `privacy.html` now if you like, and come back
for the support page once the address exists.

---

## Part B: what is still owed

Two facts live as literals in `apps/mobile/src/legal/company.ts`, both `null` today:

| Fact | Why it matters |
|---|---|
| `supportEmail` | The Contact row in Settings is absent until it is set, and `support.html` names nobody to write to |
| `companyNumber` | The Companies House number for Vision Strategies Ltd. UK consumer rules expect a trader to be identifiable, and the company line is incomplete without it |

Set them, run `npm run legal:html` again, and commit both the module and the two
regenerated pages.

**Re-upload owed (2026-10-19, F854):** the privacy notice now names every company that
receives learner data beside its role (LiveKit, Deepgram, ElevenLabs, Speechace, OpenAI,
TypeSafe, RevenueCat, Supabase, Upstash, Railway). `privacy.html` was regenerated and
committed, but the hosted copy still carries the unnamed wording until the `dist` folder is
re-uploaded through Part C and re-checked through Part D.

---

## Part C: Cloudflare Pages, by direct upload

1. Make a free account at **cloudflare.com** and sign in.
2. In the left sidebar, open **Workers and Pages**.
3. **Create** → the **Pages** tab → **Upload assets**.

   Choose **Upload assets**, not **Connect to Git**. Connecting a repository is
   how a private app repo stops being private, and there is no reason to give a
   hosting product read access to the source to serve two static files.
4. Name the project something plain, `luvani-legal` for instance. The name becomes
   part of the address.
5. Drag the whole `apps/mobile/src/legal/dist` folder onto the drop area, or select
   every file inside it. Then **Deploy site**.
6. You get an address like `https://luvani-legal.pages.dev`. The root answers with the
   signpost, and the two pages are at `/privacy` and `/support` under it.

**Leave Cloudflare Access switched off.** Access puts a login in front of the page.
An App Review reviewer opening a privacy policy and meeting a sign-in screen is a
rejection, and it is a slow one to diagnose because the page works perfectly for
whoever set it up and is already signed in.

To publish a change later: same project, **Create deployment**, drop the folder
again. The address stays the same.

---

## Part D: prove it before submitting either URL

Do both checks on both addresses. They take a minute and they are the difference
between finding a problem now and finding it in a rejection notice.

**It answers, and it does not redirect.**

```
curl -sS -o /dev/null -w "%{http_code} %{redirect_url}\n" https://luvani-legal.pages.dev/
curl -sS -o /dev/null -w "%{http_code} %{redirect_url}\n" https://luvani-legal.pages.dev/privacy
curl -sS -o /dev/null -w "%{http_code} %{redirect_url}\n" https://luvani-legal.pages.dev/support
```

Each should print `200` and then nothing. A `301`, a `302` or an address after the
code means something is standing between the reviewer and the page.

**Check the addresses without the `.html`, which is what you submit.** The file names
answer `308` to these same pages, so checking `privacy.html` prints a redirect and
tells you nothing about whether the page is reachable.

**It needs no login.** Open each address in a private or incognito window, signed
out of Cloudflare. You should read the notice immediately. If you meet a sign-in
screen, Access is on: turn it off in the project's settings and check again.

Worth a third look while you are there: read the page on a phone. It is one column
with no zooming needed, and that is deliberate.

---

## Part E: App Store Connect

In App Store Connect, for the Luvani app:

- **Privacy Policy URL** — paste the `/privacy` address, **without the `.html`**.
- **Support URL** — on the version page, paste the `/support` address, again without the `.html`.

Cloudflare serves these pages at extensionless paths and answers `308` to the `.html` form. Submitting
the file name still reaches the page, through a redirect Apple's checker does not need to follow, so
submit the clean address the live-pages table at the top of this file gives.
- **License Agreement** — leave it on **Apple's standard EULA**. Do not paste a
  custom agreement. The app's Terms of use screen names Apple's licence and links
  to it, which is the arrangement Apple offers for an app that has not written its
  own terms.

Apple moves these fields between **App Information** and **App Privacy** across
console versions, so search for the field name rather than following a fixed path
from a screenshot. Both URLs are editable later without submitting a new build.

---

## What this does not do

It does not make the notice a reviewed legal document. The text is accurate,
assembled from `docs/PRIVACY_AND_SAFETY.md`, and it has not been read by a lawyer.
The app says so on the last section of the notice and keeps saying so until you
confirm a review has happened. Hosting a copy of honest words is not the same as
clearing them.
