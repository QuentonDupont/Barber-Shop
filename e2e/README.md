# TatNat end-to-end suite (Playwright)

Drives the real built app in mock mode (`NEXT_PUBLIC_USE_MOCK=1`, in-memory data, no Supabase).
One spec per area:

| Spec | Covers |
|---|---|
| `customer.spec.ts` | landing, discover and search, shop page and cancellation policy, service, barber (named and "any available"), day and time, confirm, success message, My bookings, a named barber with no availability |
| `auth.spec.ts` | sign-up blocked server-side without the consent box, demo sign-in (customer, owner), role separation, invite-only business sign-up |
| `privacy.spec.ts` | the privacy policy in Thai and English, account "Your data" (download, request deletion, withdraw consent), booking blocked after withdrawing |
| `account-customer.spec.ts` | customer account: name and phone, verified email change (demo confirm), photo (types, size, EXIF stripped, remove), notification switches and marketing consent, privacy panel still there, 360px layout |
| `owner.spec.ts` | Today, Calendar with the barber filter, Staff (add, edit, deactivate, customer list follows), Services, Hours, Settings (cancellation policy reaches the shop page) |
| `language-brand.spec.ts` | TH/EN toggle persists, logo in light and dark, no untranslated English on Thai pages |

Projects: `iphone-webkit`, `iphone-chromium` (both iPhone 14 sized) and `desktop-chromium`.

## Run

```
NEXT_PUBLIC_USE_MOCK=1 npm run build
npx playwright install chromium webkit     # once
npm run test:e2e                           # starts `next start` if nothing is listening
npm run test:e2e:report                    # open the HTML report
```

Set `E2E_BASE_URL` (or `E2E_PORT`) to point at a server you started yourself.

## Output (`e2e-results/`, git-ignored)

- `html-report/` - the HTML report; every major step has a full-page screenshot attached, so it reads as a visual walkthrough.
- `screenshots/<project>/<spec>/<test>/NN-step.png` - the same screenshots as plain files.
- `test-output/` - video and trace for failed tests only.

## Notes for writing tests

- The mock data lives in the memory of the one `next start` process, so the suite runs with one worker and every spec
  leaves the shop as it found it (or uses a fresh sign-up or unique names). Do the same.
- Thai is the app's default language. `fixtures.ts` sets the language cookie to English unless a spec says
  `test.use({ lang: "th" })`.
- Use `open(page, url)` rather than `page.goto`: it waits for the page to hydrate, because a click before hydration is lost.
- Take a screenshot at every major step with `await snap(page, "what is on screen")`.
