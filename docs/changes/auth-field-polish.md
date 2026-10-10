# Auth field polish

- Status: verified locally; awaiting device check and integration
- Updated: 2026-10-10
- Checkout: /Users/pravz_07/.codex/worktrees/a821/Luvani, starting 37bed2a7
- Owner: current Codex session
- Defect: F785 in [KNOWN_ISSUES.md](../KNOWN_ISSUES.md)

Welcome back and Create your account share the cancellation-aware email-to-password
handoff. The 900 ms implementation found in the sibling checkout is 300 ms here.
Text remains left-aligned and sits vertically in the middle of the field, as
clarified by the founder. Auth requests, blur, clearing and unmount cancel pending
focus changes. Empty/incomplete domains retain email focus; errors and returning
form values retain the existing validation/storage behaviour. No auth service or
account policy changes.

Allowed paths: the two auth screens, AccountField, the email auto-advance hook and
tests, the existing preAccountDraft test, this plan and the defect ledger.

## Execution log

- Focus tests: 12 passed (`emailAutoAdvance.test.ts` and `signupForm.test.ts`).
- Mobile typecheck: passed.
- Full mobile suite initially found one exact callback-source assertion in
  `preAccountDraft.test.ts`; updated it to require both email persistence and the
  new cancellation-aware queue. That focused draft suite passes. No assertion or
  test floor was removed or lowered.
- Browser: this checkout's normal app on port 8093 advances SignIn Email to Password.
  The existing synthetic signup fixture on port 8094 also advances to Password,
  preserves focus/value with Show/Hide, and shows left-aligned text with equal
  12 px vertical padding and 51 px input height at 393-point width.
- Physical iOS/Android keyboard animation and Dynamic Type: not run.

Full gate: green; 2751 mobile tests, zero failures, and all repository checks passed. No account was submitted or created. Landing: HOLD for review
and integration; no other worktree was edited.

Final verification: repeated the full gate after measuring Show/Hide width for scalable text; it passed. Rechecked the edited-email handoff and Show/Hide focus in the running signup fixture, and saved the corrected left-aligned phone-width preview.
