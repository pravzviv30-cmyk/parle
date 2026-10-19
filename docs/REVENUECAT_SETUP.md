# RevenueCat setup for Luvani

Luvani already has a native RevenueCat adapter and server-owned subscription
verification. Complete the store and dashboard configuration below to activate
real purchases. The identifiers in this document are **proposals, not configured
products**. The paywall reads actual localized prices, periods and trial
eligibility from the store; sample preview offers do not establish a real price
or entitlement.

The approved trial is seven days. Both Starter and Max are offered monthly and
yearly. This setup does not add weekly, lifetime or family products. Keep real
purchase availability closed until the deployment and sandbox checks pass.

## 1 Create the Apple subscriptions

In App Store Connect, complete the Paid Apps Agreement, banking and tax setup
for the Luvani app with bundle ID `com.luvani.app`. Create one auto-renewable
subscription group. Put Max above Starter in the group's service levels, with
the two billing periods of each tier at the same service level.

| Proposed product ID | Displayed tier | Subscription duration | Paid tutor allowance |
|---|---|---|---|
| `luvani_starter_monthly` | Starter | One month | 180 minutes per allowance window |
| `luvani_starter_yearly` | Starter | One year | 180 minutes per allowance window |
| `luvani_regular_monthly` | Max | One month | 300 minutes per allowance window |
| `luvani_regular_yearly` | Max | One year | 300 minutes per allowance window |

`regular` is the existing internal Max identifier. Use the exact selected IDs in
both deployment configurations below. Set the approved price and availability
in each intended storefront, supply subscription localization and review
information, and add a **one-week free introductory offer** to all four
products. Apple permits one introductory offer per subscription group for an
eligible customer; choosing another period or tier does not grant another
trial. Apple controls the final eligibility and terms in the payment sheet.
[Apple introductory offer setup](https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-introductory-offers-for-auto-renewable-subscriptions).

The app supports ordinary recurring prices and free introductory trials. It
withholds products carrying paid or incomplete introductory offers because its
paywall does not describe those additional payment phases. The annual saving is
the comparison with twelve monthly payments of the same tier and currency;
this is not a separate promotional offer or an invented previous annual price.

## 2 Connect Apple to RevenueCat

Create the RevenueCat project and iOS app with the matching bundle ID. Configure
the required Apple In-App Purchase key in RevenueCat, including the downloaded
private key, Key ID and Issuer ID requested by its dashboard. Keep the private
key in that dashboard, not in the mobile app or Git. Add the app-specific shared
secret if using StoreKit 1; the current native SDK uses StoreKit 2. An App Store
Connect API key is optional for importing products and prices automatically.
[RevenueCat Apple credentials](https://www.revenuecat.com/docs/store-configuration/app-store/service-credentials-index).

Import the four Apple products and create one proposed entitlement, `luvani`.
Attach all four products to it. The existing server uses the verified product
ID to distinguish Starter from Max and to grant its allowance; the shared
entitlement does not imply that both tiers have the same allowance.
[RevenueCat entitlements](https://www.revenuecat.com/docs/getting-started/entitlements).

## 3 Create the current offering

Create an offering with proposed identifier `main` and make it the default
offering. Add these **four custom packages**, each containing its corresponding
iOS product:

| Proposed custom package key | Proposed Apple product ID |
|---|---|
| `starter_monthly` | `luvani_starter_monthly` |
| `starter_yearly` | `luvani_starter_yearly` |
| `max_monthly` | `luvani_regular_monthly` |
| `max_yearly` | `luvani_regular_yearly` |

Use custom keys so both tiers can share a billing period within one offering.
The app asks for `getOfferings().current` and finds packages by configured
product ID; it does not hardcode the offering or package keys. If targeting or
experiments are added later, every applicable current offering still needs the
products the app is intended to sell.
[RevenueCat offering setup](https://www.revenuecat.com/docs/offerings/overview).

## 4 Set the mobile build configuration

These names already exist in [the mobile environment example](../apps/mobile/.env.example).
Supply them through the appropriate build environment, then produce a native
development or release build. Public build values are embedded at build time.

| Mobile variable | Value to supply |
|---|---|
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | RevenueCat iOS public SDK key |
| `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID` | Selected entitlement identifier |
| `EXPO_PUBLIC_REVENUECAT_STARTER_PRODUCT_ID` | Selected Starter monthly product ID |
| `EXPO_PUBLIC_REVENUECAT_REGULAR_PRODUCT_ID` | Selected Max monthly product ID |
| `EXPO_PUBLIC_REVENUECAT_STARTER_YEARLY_PRODUCT_ID` | Selected Starter yearly product ID |
| `EXPO_PUBLIC_REVENUECAT_REGULAR_YEARLY_PRODUCT_ID` | Selected Max yearly product ID |

The existing `EXPO_PUBLIC_TOKEN_SERVER_URL`, `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_ANON_KEY` must point at the matching deployed environment.
Use the iOS platform SDK key for Apple sandbox and production; the RevenueCat
Test Store key is not proof of an Apple transaction. Android needs its separate
public SDK key and Google Play configuration when that platform is enabled.
Never put a RevenueCat secret key in an `EXPO_PUBLIC_` variable.
[RevenueCat key handling](https://www.revenuecat.com/docs/projects/authentication).

## 5 Set the server configuration and webhook

The corresponding names exist in [the server environment example](../services/token-server/.env.example).
Set these in the token server's secret and configuration environment:

| Server variable | Value to supply |
|---|---|
| `REVENUECAT_SECRET_API_KEY` | Server-only RevenueCat v1 API secret with the subscriber read and deletion access used by this implementation |
| `LUVANI_REVENUECAT_WEBHOOK_SECRET` | Exact Authorization header configured for the RevenueCat webhook |
| `REVENUECAT_ENTITLEMENT_ID` | Same entitlement ID as the mobile build |
| `REVENUECAT_STARTER_PRODUCT_ID` | Same Starter monthly ID as the mobile build |
| `REVENUECAT_REGULAR_PRODUCT_ID` | Same Max monthly ID as the mobile build |
| `REVENUECAT_STARTER_YEARLY_PRODUCT_ID` | Same Starter yearly ID as the mobile build |
| `REVENUECAT_REGULAR_YEARLY_PRODUCT_ID` | Same Max yearly ID as the mobile build |

The maintenance worker needs the API secret, entitlement ID and all four product
IDs too. It does not require the webhook secret. Keep the deployment's existing
secure database, room-control and privacy-erasure configuration in place.

Add a RevenueCat webhook pointing to the actual HTTPS token server origin plus
`/billing/webhook`. Configure its Authorization field to exactly match
`LUVANI_REVENUECAT_WEBHOOK_SECRET`, including any chosen prefix. Enable delivery
for the appropriate sandbox and production environments. The endpoint
authenticates and deduplicates events, then reads current subscriber state from
RevenueCat; the webhook body itself does not grant time. The app's authenticated
Luvani user ID must remain the RevenueCat app user ID. Do not manually replace
it with an email or an anonymous RevenueCat identifier.

## 6 Verify the database and renewal worker

Follow the existing [release gate](RELEASE_GATE.md) and apply the repository's
ordered migration inventory to the intended environment. Billing depends on the
atomic projection, store-trial and annual-window support, including
`20261002154637_atomic_billing_projection.sql`,
`20261005231742_store_trial_yearly_allowance.sql` and
`20261007121856_preserve_store_trial_budget_and_year_extension.sql`, together
with their prerequisites. These filenames are not a standalone migration set.

The service-only `billing_projection_version` RPC must return `2`. The client's
authenticated `POST /billing/readiness` request must return `ready: true`, wire
`projectionVersion: 1`, and the exact matching entitlement and product IDs.
These two version values describe different contracts. Partial or mismatched
configuration must continue to refuse purchase availability.

Run the existing maintenance deployment role
(`services/token-server/src/maintenanceWorker.ts`). Its billing renewal sweep
re-reads verified subscriptions and grants each next allowance window during a
paid year. Apple does not issue a renewal transaction for each month within an
annual subscription. Verify a yearly refill, delayed webhook recovery and
worker readiness in the deployed environment.

## 7 Check trial allowances and purchase behavior

The existing server policy remains unchanged:

| Situation | Tutor minutes |
|---|---|
| One-time free allowance without a store subscription | 30 once, never renewed |
| Eligible seven-day Starter store trial | 42 over the trial |
| Eligible seven-day Max store trial | 70 over the trial |
| Verified paid Starter period | 180 per allowance window |
| Verified paid Max period | 300 per allowance window |

Annual plans refill the tier's allowance every 30-day window within the paid
year. Minutes do not roll over. Trial length comes from Apple's offer;
allowance size comes from core and the verified server projection. The trial
must not be described as unlimited or as a whole paid month's minutes.

Create sandbox test accounts and verify on the native build: eligible monthly
and yearly trials; an account ineligible for another introductory offer;
localized annual billed amount and monthly equivalent; correct annual savings;
purchase cancellation; accepted purchase followed by server confirmation;
Restore on another signed-in device; trial conversion; lapse; annual refill;
delayed webhook; account change during an operation; and network failure with
an intact retry path. Expo Go, web fixtures and preview screenshots do not prove
store purchases. Promise a trial-end reminder only after permission and actual
scheduling exist; the current reminder policy does not schedule one.

## Pricing decision before products are published

No new price is established by this checklist. The existing USD model uses
Starter $19 monthly or $149 yearly and Max $29 monthly or $229 yearly. The
actual consumer price must be approved and configured in App Store Connect,
then returned by the store in the learner's currency.

At full use, the current cost model estimates $10.404 per Starter allowance
window and $17.34 per Max window. With a 15% store fee, the current annual
prices leave about 1.4% Starter margin and -6.9% Max margin at full use. The
existing founder decision explicitly accepts that Max annual exposure. A 20%
full-use margin would require approximately $15.30/$25.50 monthly or
$183.60/$306 yearly at these allowances and costs, before tax, hosting, refunds,
support and acquisition. These are modelled floors, not a proposed price list.

Lower annual prices require an explicit allowance, verified delivery-cost or
margin tradeoff. Do not compare GBP storefront prices directly with USD vendor
costs. Keep price modelling, its margin proofs and the store configuration
aligned when an actual pricing decision is approved. See
[the existing paywall programme](come-alive/README.md#g-paywall-and-billing-money-pinned-revenue-engineer-decides-backend-first)
and [the core cost model](../packages/core/src/metering/meter.ts).

### Competitive launch recommendation, not configured store prices

The user requested competitive pricing while retaining Starter and Max. A
bounded US launch proposal is **Starter $17.99/month or $149.99/year**, and
**Max $27.99/month or $229.99/year**. These lower the existing monthly modelling
points without materially deepening the already accepted annual exposure. The
genuine annual comparisons would round down to 30% and 31%, respectively. The
app never compiles these proposal amounts or percentages into production copy.

Under the current full-use model and a 15% store fee, those monthly points leave
approximately 32% and 27% gross margin before the other costs listed above.
The annual Max proposal still has a negative full-use margin; this recommendation
retains the earlier founder-accepted tradeoff rather than claiming every
subscription is profitable. Deeper annual discounts should wait for measured
usage and verified delivery-cost reductions. Confirm actual Apple price points,
taxes, proceeds and the final price/margin decision before publishing products.
GBP storefront amounts need their own proceeds calculation, not a substituted
currency symbol or an assumed exchange rate. Core modelling inputs are unchanged
until a final store pricing decision is landed with its margin proofs.

Official UK catalogue benchmarks checked on 18 October 2026:

| Product listing | Monthly SKU | Annual SKU |
|---|---|---|
| Speak Premium | £12.99 | £59.99 |
| Speak Premium Plus | £29.99 | £124.99 |
| Praktika | £9.99 | £99.99; a separate £49.99 annual SKU is also listed |

These are public catalogue entries, not proof of one current checkout offer,
equal speaking allowances or equivalent service cost. The UK list is kept
separate from the USD model and US proposal. Sources:
[Speak UK](https://apps.apple.com/gb/app/speak-language-learning/id1286609883),
[Praktika UK](https://apps.apple.com/gb/app/praktika-ai-language-tutor/id1624701477).

### Free content model

Headspace's current English help page describes full-library access during the
trial, then a subscription, and points non-subscribers to free external
resources. It does not establish a permanent universal free Basics tier inside
the current app. Luvani's lasting samples are our own product decision, inspired
by clear library previews and subscription boundaries.
[Headspace free-access explanation](https://help.headspace.com/hc/en-us/articles/115008192928-What-s-included-for-free).

Luvani keeps public collection previews, thirty permanent conversation samples
across every theme and pitch, existing local practice, and the learner's own
saved learning. Either active paid tier and its confirmed store trial open the
rest of the curated conversation starters. All tutor conversations still consume
the server's allowance. Personal review never disappears after a subscription
ends, and a sample is never described as unlimited tutor access.
