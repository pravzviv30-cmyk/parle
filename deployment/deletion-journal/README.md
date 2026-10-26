# Luvani deletion journal (Cloudflare Worker + D1)

An append-only store for encrypted account-erasure records. It lives outside the Supabase
database, so restoring an old database backup cannot also roll back the record that a learner
asked to be deleted. The `maintenance` role writes here before it erases anything. An isolated
restore replays the journal before it reopens anything.

The Worker stores only opaque names and ciphertext. Encryption, the HMAC record names and the
key all live on the client side (`services/token-server/src/deletionJournal.ts`). Cloudflare never sees a user id.

| File | What it is |
|---|---|
| `worker.ts` | The `fetch` entry point plus the pure `handle(request, env, store)` that implements the client contract |
| `d1.ts` | The D1 `JournalStore` (prepared statements only) |
| `memoryStore.ts` | The in-memory `JournalStore` used by tests |
| `schema.sql` | Tables, plus triggers that refuse every UPDATE and DELETE |
| `worker.test.ts` | Drives the real client against `handle()`: `node --test --experimental-strip-types deployment/deletion-journal/worker.test.ts` |

## Contract (it mirrors the client exactly)

All requests need `Authorization: Bearer <JOURNAL_TOKEN>`, or they get 401. The Worker never redirects.

- `PUT /records/<64 hex>` needs `if-none-match: *` and `content-type: application/json`. The body is at most 2048 bytes
  and must be `{version:1, nonce, ciphertext, tag}`, with a 12-byte nonce and a 16-byte tag in canonical base64url.
  Returns 201 when the record is stored and 412 when the name already exists (an existing record is never overwritten).
  Bad input gets 400, an oversized body gets 413.
- `GET /records/<name>` returns 200 with the exact stored bytes, or 404.
- `POST /snapshots` takes `{version:1, project}`, where `project` must equal `PROJECT_SHA256` (403 otherwise).
  It returns 201 with `{version:1, snapshotId, project, totalRecords, keysSha256, expiresAt}`. A snapshot freezes the
  rowid high-water mark. `keysSha256` is SHA-256 of the raw 32-byte names, in ascending order, at or below that mark.
  The snapshot expires after 24 hours. Sealing again while no record has been added returns the same unexpired
  snapshot (identical body) and does not re-read the table.
- `GET /snapshots/<id>/records[?after=<hex>]` returns up to 100 ascending names greater than `after`. `nextCursor` is
  the last name on the page when more remain, otherwise null. An unknown snapshot gets 404, an expired one gets 410.

## Deploy (founder, one time)

Wrangler is pinned to the version `sites/luvani-launch` uses. Run these from this folder:

```sh
cd deployment/deletion-journal
npx wrangler@4.92.0 login
npx wrangler@4.92.0 d1 create luvani-deletion-journal
# Copy the printed database_id into wrangler.toml in place of REPLACE_WITH_D1_ID.
npx wrangler@4.92.0 d1 execute luvani-deletion-journal --remote --file schema.sql
```

Compute `PROJECT_SHA256` and put it in `wrangler.toml` in place of `REPLACE_WITH_PROJECT_SHA256`. The client hashes
the project URL after stripping trailing slashes, and the one-liner below does the same:

```sh
node -e 'const u="https://wtexbzuyfersdtiekrvp.supabase.co";console.log(require("crypto").createHash("sha256").update(u.replace(/\/+$/,"")).digest("hex"))'
# b930cd71e3fcbc8308696e72fd1101befe46eb4577c7d1a763189f3b1bdace4e
```

Generate the token, store it as a Worker secret, and deploy:

```sh
openssl rand -base64 48            # copy the output; it is the token
npx wrangler@4.92.0 secret put JOURNAL_TOKEN   # paste the token at the prompt
npx wrangler@4.92.0 deploy         # prints https://luvani-deletion-journal.<subdomain>.workers.dev
```

Generate the encryption key. This command gives exactly 43 characters of unpadded base64url (32 bytes), which is
what `deployment/validateEnvironment.mjs` accepts:

```sh
openssl rand 32 | openssl base64 -A | tr '+/' '-_' | tr -d '='
```

Set these four Railway variables on the `maintenance` service, and on an isolated restore only. Never set them on api, practice, tutor or the web app:

| Variable | Value |
|---|---|
| `LUVANI_DELETION_JOURNAL_URL` | the `https://...workers.dev` URL from `deploy`, with no path, query or trailing slash |
| `LUVANI_DELETION_JOURNAL_TOKEN` | the `openssl rand -base64 48` token (same value as the Worker secret) |
| `LUVANI_DELETION_JOURNAL_KEY` | the 43-character key |
| `LUVANI_DELETION_JOURNAL_PROJECT_URL` | `https://wtexbzuyfersdtiekrvp.supabase.co` |

**Losing `LUVANI_DELETION_JOURNAL_KEY` makes every record unreadable, and the deletions cannot be replayed.** Keep it
in the password manager and somewhere apart from Railway. Do not rotate it while the journal has records. A new key
needs a new journal.

To rotate the token, run `secret put JOURNAL_TOKEN` and then update the Railway variable. Writes fail closed between those two steps.

## Restore story

D1 Time Travel keeps point-in-time history (7 days on the Workers Free plan, 30 on Paid; check the current docs):
`npx wrangler@4.92.0 d1 time-travel info luvani-deletion-journal` and `... d1 time-travel restore luvani-deletion-journal --timestamp <ISO>`.
The triggers mean there is nothing legitimate to undo. Time Travel is there for a lost or corrupted database, and a restore
must never go back past the oldest backup the journal protects. Record the snapshot `totalRecords`/`keysSha256` from
each replay as high-water evidence for `deployment/recoveryDrill.mjs`.

## Cost and scale

Free plan limits (check the current Cloudflare pricing page): 100,000 Worker requests a day, about 10 ms of CPU per
request, 5 GB D1 storage, 5M rows read and 100k rows written a day. One erasure costs about 2 requests and 1 row
written. A replay costs one seal, plus a page request for every 100 records and a GET for each record.

The seal is the only heavy request. It reads the sealed names already sorted by SQL, decodes them into one buffer with a
lookup table and hashes once. In Node that takes about 1 ms for 5,000 names (see the timing line in the
test output), and repeated seals at an unchanged high water are free. Beta scale is tiny: deletions number in the
dozens, so expect zero cost. If the journal ever reaches hundreds of thousands of records, Workers Paid ($5 a month)
raises the CPU limit and the D1 read allowance.
