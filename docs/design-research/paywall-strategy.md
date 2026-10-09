# Paywall strategy and Weekly restoration

## Commercial truth

| Product | Current decision | Allowance | Trial | Readiness |
|---|---|---|---|---|
| Starter Weekly | Founder-selected US$5.49 every 7 days | 45 live minutes per verified seven-day window; no rollover | None; paid immediately | Required planned product; native/server/store integration missing |
| Starter Monthly | US$19 is a report proposal | 180 minutes/month proposal | None under this report policy | Price/store approval required; current native fixtures differ |
| Starter Yearly | US$199.99 is a report proposal | 180 refreshed monthly proposal | Seven days for eligible purchasers only; 45-minute cap is a proposal | Price/cap/store approval required |
| Max | Separate higher-allowance tier | Use verified catalogue and entitlement | Do not infer from Starter | No invented Max Weekly |

Source: original report text `tmp/pdfs/paywall-report/report.txt`, founder decision around lines 850–910 and trial proposal around 1071–1136. No UK Weekly price was agreed. New US Figma fixtures do not establish UK prices or replace the current GBP catalogue. All amounts on a real screen must come from the same current storefront. Existing native 42/70-minute trial fixtures are not the report’s proposed 45-minute annual trial.

## Main offer

Headline: **Speak your way.** Show Starter, selected allowance, three compact duration rows, actual recurring charge and primary action in the default phone view. Weekly: **Subscribe weekly**, with **$5.49 today, then every 7 days.** Monthly is paid immediately. Eligible Yearly shows the free-trial duration, trial allowance and full annual renewal charge. Ineligible or unknown eligibility never claims a free trial.

Keep the user’s exact reassurance: **No Commitment, Cancel Anytime**. It supplements price/recurrence; it does not promise a refund or erase the purchased period. Terms, Privacy and Restore remain usable links. Savings only appear when computed from verified comparable prices. Do not display fictitious strike-throughs or best-value claims.

Weekly is for anyone preferring a smaller upfront purchase, not just travellers. Keep it visible. Default selection can follow an explicit previous choice; an annual-default experiment must not conceal alternatives. Explain Max in a separate comparison surface without adding another competing grid to the first view.

## Entry and exit rules

- First useful learning and earned recap precede a paid offer. Closing returns to the exact previous task.
- Refused live start states say whether access, minutes, connectivity or account verification caused the refusal; do not treat every refusal as an upsell.
- Settings opens management for subscribers and a clear plan choice for free users.
- Exhaustion shows the verified refresh date and a saved-practice alternative. Annual billing date and monthly allowance refresh are different fields.
- Do not trap a user in a second offer after closing. Saved French remains accessible.

## State coverage

New Weekly frames cover selected offer, pending verification, verified success, active management, used allowance, cancelled renewal with access remaining and payment failure. Shared existing screens cover offer loading/partial/unavailable; unknown eligibility; cancelled checkout; slow verification; restore found/none/other account/offline; grace/retry/lapsed/revoked/unknown status; scheduled changes; reminders and metering. Weekly copy must be parameterised into these shared states. An account-linked restore does not transfer ownership automatically.

Purchase path: offer → native store sheet → pending verification → verified entitlement → success. Store-sheet completion alone never grants minutes. Pending must suppress duplicate purchase. Retry preserves the chosen duration. Cancellation preserves access until verified expiry. Refund/revocation follows server status.

## Integration required after design approval

`BillingPeriod` currently has month/year only. Extend the shared contract and client types explicitly with week; accept configured P1W products in the native adapter; never treat an unknown period as monthly. The existing adapter filters P1M/P1Y before mapping, so Weekly is currently omitted rather than silently sold as monthly. Add RevenueCat/App Store configuration, backend product mapping and verified seven-day allowance windows. Persist idempotent renewals, reconcile missed notifications, handle restore/account changes, and test DST/calendar boundaries using the store’s authoritative period. Annual 180-minute monthly resets remain independent of annual payment. Launch behind validated catalogue availability; never offer an unconfigured Weekly product.

## Acceptance

Weekly shows exactly 45/7 days and the verified local charge; no trial copy. All durations remain reachable at default text size without scrolling on a 375pt-wide phone. Large text remains fully readable with safe scrolling. Sandbox purchase/renewal/restore/refund/cancellation and server allowance tests must pass before production. No conversion uplift is promised by these designs.
