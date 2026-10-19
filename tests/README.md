# Test guide

## Unit tests

Run the Vitest suite with:

```sh
npm run test
```

## Area request browser test

The Playwright journey opens `/areas` at desktop and mobile sizes, checks coverage and navigation,
exercises invalid and failed submissions, submits through the installed `/api/contact` route, and
confirms the matching `ContactMessage` row in PostgreSQL.

Use a dedicated disposable PostgreSQL database. Set `DATABASE_URL` to that database before setup;
never use a production database. Synchronize the installed schema and run the browser test with:

```sh
npx prisma generate
npx prisma db push
npm run test:e2e
```

Playwright starts the local Next.js app unless `BASE_URL` points to an already-running app. Each
area journey uses a random `.test` email and message marker. Cleanup deletes only a row matching
both values, so unrelated database records are left alone. Email delivery is best-effort and is
not asserted by the area browser test. The installed email 0.3.0 module lacks the
`recordSubmission` helper required for dashboard recording, so the current contact route uses only
the company-inbox fallback until the platform supplies a compatible email upgrade.

## Manage reschedule browser test

`manage-reschedule.spec.ts` creates a random Better Auth subscriber through the rendered signup
page, verifies the account through the verification link captured by Playwright's local email
proxy sink, then signs in once through the rendered login page. It creates one eligible paid,
active biweekly booking with a future date in PostgreSQL, exercises a rejected cadence mismatch
and a successful reschedule through `/manage`, and checks the displayed date, persisted booking,
and captured confirmation fields. The test deletes only its synthetic booking and auth user; the
database cascades that user's session/account rows. Do not point this journey at a production
database.

Playwright's config runs the email sink on `127.0.0.1:3199` and points the locally started app's
`POLSIA_EMAIL_PROXY_URL` at it. The sink captures verification and confirmation messages in memory;
it does not contact Polsia or require a provider credential. For an already-running local app,
start that app with `POLSIA_EMAIL_PROXY_URL=http://127.0.0.1:3199` and set `BASE_URL` to its local
origin before running Playwright. The app and Playwright process must share the same network
namespace so the app can reach the sink.

The browser journey needs a disposable PostgreSQL database, the installed schema, and valid local
Better Auth settings (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and `DATABASE_URL`). From the repo
root, prepare it and run:

```sh
npx prisma generate
npx prisma db push
npm run test:e2e -- tests/e2e/manage-reschedule.spec.ts
```

Use synthetic accounts only. The signup address is randomized for each run, and cleanup removes
only that account and booking. The verification email and reschedule confirmation are both
captured locally; successful delivery through the deployed Polsia email proxy still depends on
the platform's deploy-time email configuration.

## Booking navigation browser test

`booking-navigation.spec.ts` opens the homepage at desktop and mobile sizes, clicks each service
card CTA, and confirms that the selected service reaches `/book` with its query parameter and
that the booking form loads. It does not submit a booking or payment and only needs the disposable
runtime/database setup used by the other public browser tests:

```sh
npx prisma generate
npx prisma db push
npm run test:e2e -- tests/e2e/booking-navigation.spec.ts
```
