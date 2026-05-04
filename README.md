# Blarney 42

A Next.js, TypeScript, Prisma, Postgres, and AWS S3 site for the Blarney 42 golf event in Cannon Beach.

## Stack

- Package manager: pnpm
- App: Next.js App Router, React, TypeScript, CSS Modules
- Data: Prisma with Postgres 17
- Storage: AWS S3 presigned uploads for photo submissions
- Chair admin: single password session for MVP
- Payments: external Square/Cash handoff for MVP, with Square payment-link creation and limited confirmation hardening

## Getting Started

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy `.env.example` to `.env` and fill in the chair password, S3, registration pricing, payment confirmation secret, and Square values. The default `DATABASE_URL` matches the local Docker database.

3. Start Postgres 17:

   ```bash
   pnpm db:up
   ```

4. Generate Prisma Client and create the database schema:

   ```bash
   pnpm prisma:generate
   pnpm prisma:migrate
   pnpm prisma:seed
   ```

5. Start the development server:

   ```bash
   pnpm dev
   ```

## Local Development With Cloudflared

- For normal UI work, use `http://localhost:3000` in the browser. Hot reload is most reliable on the local origin.
- Use Cloudflared mainly when Square webhooks or hosted-checkout return URLs need a public HTTPS URL.
- When browsing through a Cloudflared tunnel, start Next with:

  ```bash
  pnpm dev:tunnel
  ```

- Start the tunnel against the local Next server, then set `CLOUDFLARED_TUNNEL_URL`, `NEXT_PUBLIC_SITE_URL`, and `SQUARE_WEBHOOK_NOTIFICATION_URL` to the same public tunnel origin while testing external callbacks.
- If hydration or hot-reload errors keep repeating after config or environment changes, stop `pnpm dev:tunnel`, delete `.next`, restart the dev server, and hard-refresh the browser tab.
- Avoid switching one browser tab back and forth between `localhost` and the tunnel URL during the same dev-server session; stale React Server Component payloads and HMR websocket reconnects can look like hydration failures.
- If a hydration warning mentions unexpected attributes on `<html>` or `<body>`, retest in a clean browser profile because password managers and other extensions can mutate the server HTML before React hydrates it.

## Core Workflows

- Public visitors can register, RSVP for the day-before event, send feedback, view logistics, and submit photos for review.
- The chair can sign in at `/chair/login` to view RSVPs, feedback, registrations, pending photos, and pairing tools.
- Submitting the registration form validates the details, creates or reuses one active private checkout session per normalized email, and sends the same browser tab through the app-owned payment route to Square hosted checkout with separate line items for golf, adult guests, and child guests.
- Participant, registration, and RSVP rows are created only after Square reports a successful payment through the Square webhook, hosted-checkout return URL reconciliation, or the `/register/thanks` polling backup. The day-before RSVP checkbox is applied at that point, not at initial form submission.
- Pairing generation groups applicants by gender, good-golfer threshold, score, and age, then creates groups of up to four.
- Photo uploads go to a private S3 `pending/` prefix and must be approved before they appear in the public gallery.

## Payment Setup

- Set `REGISTRATION_GOLF_PRICE_CENTS` to the fixed golfer price in cents.
- Set `REGISTRATION_PRE_EVENT_ADULT_PRICE_CENTS` to the per-head adult pre-event guest price in cents.
- Set `REGISTRATION_PRE_EVENT_CHILD_PRICE_CENTS` to the per-head child pre-event guest price in cents.
- Set `SQUARE_PAYMENT_CONFIRMATION_SECRET` to a random secret used only for Square return tokens. Production requires this value.
- Configure `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, `SQUARE_CURRENCY`, and `SQUARE_ENVIRONMENT` so the app can create a private Square checkout session for each registration attempt. `SQUARE_ENVIRONMENT` must be `sandbox` or `production`; do not mix sandbox tokens, locations, dashboards, or webhook keys with production values.
- Set `NEXT_PUBLIC_SITE_URL` to the public HTTPS site URL. This controls the Square return URL, so local tunnel testing should use the tunnel origin here.
- Configure `SQUARE_WEBHOOK_SIGNATURE_KEY` and `SQUARE_WEBHOOK_NOTIFICATION_URL` so Square can confirm payments server-to-server at `/api/square/webhook`. The notification URL must exactly match the URL configured in Square, including protocol and host.
- In Square, subscribe the webhook endpoint to `payment.created`, `payment.updated`, and `order.updated` events. Completed payment events, or paid order updates with no remaining amount due, finalize the checkout and create the registration records.
- For local webhook testing, expose the local app with a tunnel and set Square, `NEXT_PUBLIC_SITE_URL`, and `SQUARE_WEBHOOK_NOTIFICATION_URL` to the tunneled URLs for the same app instance and database that created the checkout.
- Treat working payment configuration as required for completed registrations. Form submission alone should not persist participant, registration, or RSVP rows; those are created only after successful payment confirmation.
- Active checkouts are reused by normalized email, not by exact form payload. If a payer goes back from Square, changes guest counts, or submits again before payment confirmation, the app resumes the existing checkout instead of creating a second active charge path. To change details after checkout starts, the chair should review the pending checkout before the payer starts over.
- Before reopening any existing Square link, the app reconciles the link with Square. If Square already reports the order paid, the app finalizes the registration instead of sending the payer back to payment. If Square reports paid but local finalization is blocked, the checkout is marked for chair review and the user is told not to pay again.
- Once an email has a registration or RSVP on file, new registration and RSVP submissions with that normalized email should show the duplicate email error instead of creating or overwriting records.
- The Square hosted page should show the expected environment, location, currency, line items, and total before payment. After payment, Square should send the payer back to `/register/thanks` through the configured return URL; the redirect reconciler, webhook, or thanks-page poller can then confirm the checkout and show the registration summary.
- The Square webhook is optional hardening; the return URL and checkout status poller also reconcile against Square so the user is not blocked if a webhook is delayed. If a payer reports success but the app remains pending or chair review is needed, verify the Square payment by payment link, order ID, email, or receipt URL before changing registration data manually.
- Keep the MVP payment flow limited to the Square checkout handoff plus successful-payment confirmation. Do not add full user accounts, Square reconciliation dashboards, automated payment management, email notifications, or CMS editing unless the scope changes.

## Photo Upload and Chair Review

- Public `/photos` shows approved photos only. Pending and rejected submissions must stay private to chair routes.
- Photo submissions collect submitter name, submitter email, caption, and one or more image files. Accepted image types are JPEG, PNG, WebP, and GIF; each uploaded file must be 25 MB or smaller.
- The public form uses one Browse menu for selecting one photo, multiple photos, or a folder of photos. One caption applies to every selected image, and the client creates one presigned S3 upload plus one `PhotoSubmission` row per accepted file.
- Chair review happens at `/chair/photos`. Pending photos show a private preview, require review notes, and can be approved or rejected. Approval copies the object from the private S3 `pending/` prefix to `approved/`, stores the approved key, and makes the photo visible in the public gallery. Rejection records the status and notes without publishing the image.
- Multi-photo and folder uploads remain per-file submissions: chair review, approval, rejection, and public visibility happen independently for each photo.

## Scripts

- `pnpm dev` - run the local app
- `pnpm build` - generate Prisma Client and build Next.js
- `pnpm db:up` - start the local Postgres 17 container
- `pnpm db:down` - stop and remove the local Postgres container
- `pnpm db:logs` - follow local Postgres container logs
- `pnpm lint` - run ESLint
- `pnpm typecheck` - run TypeScript without emitting files
- `pnpm test` - run focused unit tests
- `pnpm prisma:generate` - generate Prisma Client
- `pnpm prisma:migrate` - create/apply a development migration
- `pnpm prisma:seed` - seed placeholder event settings

## RSVP Source and Duplicate Handling

The app stores normalized email addresses on RSVP rows, and each RSVP email must be unique. The public `/rsvp` form treats that normalized email as the RSVP identity:

- **RSVP form** (`/rsvp`): Standalone submissions create RSVP rows with `source = 'FORM'` only when no registration and no RSVP already uses the normalized email. The form stores adult and child attendee counts, derives the total attendee count from them, and requires that the counts match the attendance choice. If any registration or RSVP already exists for that email, `/rsvp` shows a duplicate email error and leaves existing RSVP data unchanged.
- **Registration confirmation**: When a golfer completes registration payment, confirmation creates the registration only when no other registration and no RSVP already uses the normalized email. If the day-before RSVP checkbox was selected, confirmation creates one RSVP row with `source = 'REGISTRATION'`; if any RSVP already exists for that email, confirmation reports the duplicate and does not create another RSVP.

This keeps RSVP data idempotent by email: repeated same-email RSVP submissions must not overwrite existing RSVP rows, and repeated registration confirmations must not create duplicate RSVP rows. The chair RSVP table displays the source as "RSVP form" or "Registration" and shows adult/child party counts when they are known.

## Verification Checklist

Before deploying:

- Run local checks: `pnpm lint`, `pnpm typecheck`, `pnpm prisma validate`, `pnpm build`, and `pnpm test`.
- Verify registration flow: complete registration form with day-before RSVP checkbox, confirm the browser leaves for the Square hosted checkout page, and verify the Square page shows the expected line items, total, currency, and environment.
- Verify checkout reuse rules: submit identical details twice before payment and confirm the same pending checkout is reused; submit the same email with changed guest counts before payment and confirm the existing checkout is resumed instead of creating a second active charge path; complete payment, then submit the same email again and confirm the app shows the duplicate email error instead of creating another checkout.
- Verify paid-link reopening: complete payment, revisit `/register/payment?checkout=...`, and confirm the app resolves to the confirmed thanks state instead of sending the payer back to Square.
- Verify manual-review handling: simulate a paid Square checkout that cannot finalize locally because of an existing registration or RSVP and confirm the thanks page tells the payer not to pay again and to contact the chair with the receipt.
- Verify payment confirmation: complete hosted checkout, confirm Square returns to `/register/thanks`, and verify participant, registration, and REGISTRATION RSVP rows are created only after confirmation.
- Verify webhook and poller backup: test a webhook-delayed or return-delayed scenario and confirm `/register/thanks` keeps polling `/api/register/checkout/[checkoutId]` until Square confirmation or a clear pending message appears.
- Verify standalone RSVP: submit standalone RSVP form and verify FORM RSVP creation with adult, child, and derived total attendee counts; repeat with the same normalized email and different RSVP details, then verify a visible duplicate email error appears, the original row is not overwritten, and no duplicate row is created.
- Verify completed-registration duplicate handling: complete a registration for an email, then submit `/rsvp` with that same email and verify a visible duplicate email error appears with no RSVP data overwritten.
- Verify registration/RSVP cross-duplicates: submit standalone RSVP with a given email, then register with that email and verify a duplicate email error appears with no checkout or registration created. Also complete a day-before RSVP registration for a fresh email and verify one REGISTRATION row is created.
- Verify photo upload: submit a supported image as pending, log in as chair, approve one photo, verify the approved photo appears in the public gallery and pending/rejected photos do not.
- Verify multi-photo or folder upload after implementation: select multiple images or a folder of images, confirm one pending chair-review row and one `pending/` S3 object per accepted image, confirm unsupported or oversized files fail clearly, and confirm approved-only gallery behavior still holds.
- Verify chair login/logout: confirm `/chair/login` accepts correct password, `/chair/*` routes require auth, and logout clears session.
- Verify responsive layouts: test registration form, RSVP form, feedback form, photo gallery, logistics, and all chair pages on mobile and desktop.
- Verify S3 CORS and presigned upload behavior: upload a photo through `/photos`, confirm it lands in `pending/` prefix.
- Verify pairing generation: seed test participants, generate pairings, verify groups split by gender and capped at four, publish pairings to confirm public visibility.
