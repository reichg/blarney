# Blarney 42

A Next.js, TypeScript, Prisma, Postgres, and AWS S3 site for the Blarney 42 golf event in Cannon Beach.

## Stack

- Package manager: pnpm
- App: Next.js App Router, React, TypeScript, CSS Modules
- Data: Prisma with Postgres 17
- Storage: AWS S3 presigned uploads for photo submissions
- Chair admin: single password session for MVP
- Payments: external Square/Cash handoff for MVP, with Square hosted-checkout creation and limited confirmation hardening

## Getting Started

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy `.env.example` to `.env` and fill in the chair password, S3, golf/BBQ registration pricing, payment confirmation secret, and Square values. The default `DATABASE_URL` matches the local Docker database.

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

- For normal UI work, use `http://localhost:3001` in the browser. Hot reload is most reliable on the local origin.
- Use Cloudflared mainly when Square webhooks or hosted-checkout return URLs need a public HTTPS URL.
- When browsing through a Cloudflared tunnel, start Next with:

  ```bash
  pnpm dev:tunnel
  ```

- On Windows, Cloudflared may resolve `localhost` to `::1`. `pnpm dev:tunnel` binds Next on `::` so the tunnel can reach the dev server over either IPv6 or IPv4 loopback.
- Start the tunnel against the local Next server, then set `CLOUDFLARED_TUNNEL_URL`, `NEXT_PUBLIC_SITE_URL`, and `SQUARE_WEBHOOK_NOTIFICATION_URL` to the same public tunnel origin while testing external callbacks.
- If hydration or hot-reload errors keep repeating after config or environment changes, stop `pnpm dev:tunnel`, delete `.next`, restart the dev server, and hard-refresh the browser tab.
- Avoid switching one browser tab back and forth between `localhost` and the tunnel URL during the same dev-server session; stale React Server Component payloads and HMR websocket reconnects can look like hydration failures.
- If a hydration warning mentions unexpected attributes on `<html>` or `<body>`, retest in a clean browser profile because password managers and other extensions can mutate the server HTML before React hydrates it.

## Core Workflows

- Public visitors use `/register` to register/pay for golf or submit a BBQ-only RSVP with payment handoff, send feedback, open `/remembrance` from the main nav for private remembrance notes with optional photos, view logistics, and submit gallery photos for review. Old `/rsvp` links redirect to `/register`.
- The chair can sign in at `/chair/login` to view RSVPs, feedback, registrations, gallery photo review at `/chair/photos`, private remembrance photos at `/chair/remembrance`, and pairing tools.
- Authenticated chair routes use the shared chair navigation links, while `/chair/login` keeps the public header navigation.
- Shared pagination is URL-driven on the home page published pairings section, public `/photos`, chair list pages `/chair/registrations`, `/chair/rsvps`, `/chair/feedback`, `/chair/remembrance`, and `/chair/photos`, plus the independent unassigned-golfers, draft-groups, and published-groups sections on `/chair/pairings`. The default page size is 50, the maximum page size is 50, and the UI does not expose a page-size picker.
- The chair registrations screen at `/chair/registrations` has chair-only Export CSV and Export golfers CSV downloads. General columns are Name, Email, Phone, Gender, Age, Score, Package, BBQ Only Adults, BBQ Only Kids, and Paid; golfers-only columns are Name, Email, Phone, Gender, Age, Score, Good Golfer (41 and below), and Paid (status). The on-screen table is paged, but both export routes always return the full dataset and are not scoped to the current page.
- Golf registration can include multiple golfers in one checkout plus additional BBQ-only adults and kids. Each golfer needs first name, last name, sex/gender, age, and average Manzanita score; any participant under 15 counts as a kid. The golf price includes BBQ for the golfer.
- Submitting the golf branch validates the details, creates or reuses one active private checkout session per normalized email, and sends the same browser tab through the app-owned payment route to Square hosted checkout with line items for `Golf registration (BBQ included)`, `BBQ-only adults`, and `BBQ-only kids` as applicable.
- Participant, registration, and registration-sourced BBQ RSVP rows are created only after Square reports a successful payment through the Square webhook, hosted-checkout return URL reconciliation, or the `/register/thanks` polling backup. The app creates one golfer registration per paid golfer and one registration-sourced BBQ RSVP for the checkout.
- Submitting the BBQ-only branch on `/register` means the household is attending the BBQ. The form collects party counts and notes, creates or reuses a private RSVP checkout for adult and kid BBQ charges, and creates the `FORM` RSVP row only after Square confirms payment.
- The chair can use `/chair/pairings` to generate deterministic DRAFT pairings, create and edit draft groups, assign/move/remove golfers, publish groups to the public home page, unpublish live groups back to DRAFT for more edits, and republish. Generation distributes one of the oldest available golfers per group as the older-player anchor, places at least one female in each group when the paid roster allows, balances good golfers (Manzanita average score `<= 41`) and other golfers as evenly as possible, uses projected group average scores to keep overall group skill as even as possible, caps groups at four, and keeps the public home page limited to PUBLISHED groups.
- Gallery photo uploads go to a private S3 `pending/` prefix and must be approved before they appear in the public gallery. Remembrance photos upload directly to the private S3 `remembrance/` prefix and stay private to chair routes.

## Payment Setup

- Set `REGISTRATION_GOLF_PRICE_CENTS` to the fixed golfer price in cents. This price includes BBQ for the golfer.
- Set `REGISTRATION_BBQ_ADULT_PRICE_CENTS` to the per-head BBQ-only adult price in cents.
- Set `REGISTRATION_BBQ_KID_PRICE_CENTS` to the per-head BBQ-only kid price in cents. Any participant under 15 counts as a kid.
- Legacy `REGISTRATION_PRE_EVENT_ADULT_PRICE_CENTS` and `REGISTRATION_PRE_EVENT_CHILD_PRICE_CENTS` are fallback compatibility names only; use the BBQ names in new environments.
- Set `SQUARE_PAYMENT_CONFIRMATION_SECRET` to a random secret used only for Square return tokens. Production requires this value.
- Configure `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, `SQUARE_CURRENCY`, and `SQUARE_ENVIRONMENT` so the app can create a private Square checkout session for each registration attempt. `SQUARE_ENVIRONMENT` must be `sandbox` or `production`; do not mix sandbox tokens, locations, dashboards, or webhook keys with production values.
- Set `NEXT_PUBLIC_SITE_URL` to the public HTTPS site URL. This controls the Square return URL, so local tunnel testing should use the tunnel origin here.
- Configure `SQUARE_WEBHOOK_SIGNATURE_KEY` and `SQUARE_WEBHOOK_NOTIFICATION_URL` so Square can confirm payments server-to-server at `/api/square/webhook`. The notification URL must exactly match the URL configured in Square, including protocol and host.
- In Square, subscribe the webhook endpoint to `payment.created`, `payment.updated`, and `order.updated` events. Completed payment events, or paid order updates with no remaining amount due, finalize golf registration checkouts or paid BBQ-only RSVP checkouts.
- For local webhook testing, expose the local app with a tunnel and set Square, `NEXT_PUBLIC_SITE_URL`, and `SQUARE_WEBHOOK_NOTIFICATION_URL` to the tunneled URLs for the same app instance and database that created the checkout.
- Treat working payment configuration as required for completed golf registrations and BBQ-only submissions. Golf form submission alone should not persist participant, registration, or registration-sourced RSVP rows; those are created only after successful payment confirmation. BBQ-only submissions should not persist the final `FORM` RSVP until payment succeeds.
- Active checkouts are reused by normalized email, not by exact form payload. If a payer goes back from Square, changes guest counts, or submits again before payment confirmation, the app resumes the existing checkout instead of creating a second active charge path. To change details after checkout starts, the chair should review the pending checkout before the payer starts over.
- Before reopening any existing Square link, the app reconciles the link with Square. If Square already reports the order paid, the app finalizes the registration instead of sending the payer back to payment. If Square reports paid but local finalization is blocked, the checkout is marked for chair review and the user is told not to pay again.
- Once an email has a registration, RSVP, active golf checkout, or active RSVP checkout on file, new registration and BBQ-only RSVP submissions with that normalized email should show a duplicate or pending-checkout error instead of creating or overwriting records.
- The Square hosted page should show the expected environment, location, currency, line items, and total before payment. After payment, Square should send payers back through the configured app return URL; the redirect reconciler, webhook, or thanks-page poller can then confirm the checkout.
- The Square webhook is optional hardening; the return URL and checkout status poller also reconcile against Square so the user is not blocked if a webhook is delayed. If a payer reports success but the app remains pending or chair review is needed, verify the Square payment by payment link, order ID, email, or receipt URL before changing registration data manually.
- Keep the MVP payment flow limited to the Square checkout handoff plus successful-payment confirmation. Do not add full user accounts, Square webhooks beyond existing confirmation hardening, automated reconciliation, email notifications, or CMS editing unless the scope changes.

## Feedback and In Remembrance

- Public `/feedback` stays for general event feedback. Public `/remembrance` invites private remembrance notes for late Blarney members or lost family members.
- Remembrance submissions store as private feedback with category `In Remembrance` so the app can keep them separate from general feedback. Name and email are optional for note-only submissions and required only when photos are included.
- Optional remembrance photos presign into a private S3 `remembrance/` prefix, stay linked to the remembrance feedback row, and are immediately available on the chair-only remembrance surface and download routes. They never enter the gallery review queue or the public `/photos` gallery.
- The dedicated chair remembrance page at `/chair/remembrance` is paged and supports individual downloads plus bulk ZIP downloads. Select all and Download selected apply only to the current page. Download all still returns the full remembrance dataset as `blarney-remembrance.zip`, and the archive contents are nested under a top-level `blarney-remembrance/` folder.

## Photo Upload and Chair Review

- Public `/photos` shows approved gallery photos only, approved gallery images can be opened full size from that page, and the list uses the shared URL-driven pager. Pending submissions stay private to chair routes, rejected submissions are deleted during chair review, and remembrance uploads never appear in the public gallery.
- Photo submissions collect submitter name, submitter email, caption, and one or more image files. Accepted image types are JPEG, PNG, WebP, and GIF; each uploaded file must be 25 MB or smaller.
- The public form uses one Browse menu for selecting one photo, multiple photos, or a folder of photos. One caption applies to every selected image, and the client creates one presigned S3 upload plus one `PhotoSubmission` row per accepted file.
- Chair review at `/chair/photos` remains gallery-only. Gallery uploads start in the private S3 `pending/` prefix, can be approved or rejected by the chair, and only approved gallery submissions with an `approved/` key appear on `/photos`. Rejecting a pending gallery photo deletes its pending S3 object and removes the `PhotoSubmission` row, so rejected uploads do not remain in chair review. The pending and approved lists paginate independently, so moving one list preserves the other list's current page. Returning an approved gallery photo to pending moves the object back to its original `pending/` key and immediately removes it from the public view.
- Remembrance uploads skip the review queue entirely. They presign straight into the private `remembrance/` prefix, store as private remembrance submissions in an immediately available state, and stay limited to chair remembrance surfaces and download routes.
- Multi-photo and folder uploads remain per-file submissions: chair review, approval, rejection, and public visibility happen independently for each photo.

## Chair Pairings Workflow

The chair pairings interface at `/chair/pairings` supports deterministic mixed-group draft generation, manual draft editing, publishing, unpublishing back to draft, and republishing:

- **Draft generation**: The Generate Pairings action creates DRAFT groups by distributing one of the oldest available golfers per group as the older-player anchor, placing at least one female in each group when the roster allows, balancing good golfers (Manzanita average score `<= 41`) and other golfers as evenly as possible, using projected group average scores to keep overall group skill as even as possible, and capping every group at four. Generation replaces existing DRAFT groups, leaves current PUBLISHED and ARCHIVED groups alone until the chair publishes again, and reproduces the same draft output when the paid-golfer roster has not changed.
- **Unassigned golfer roster**: The pairings page displays paid golfers who are still unassigned to a DRAFT group. Assigning a golfer removes them from that roster and keeps them visible on their draft group card; removing a golfer from a draft group or deleting the draft group returns them to the unassigned roster.
- **Draft group editing**: The chair can create custom draft groups, assign golfers, move golfers between draft groups, remove golfers from draft groups, review each group's member names, ages, and scores on the preview card, edit group name, display order, and optional tee time, and delete draft groups. Deleting a draft group returns its golfers to the unassigned roster.
- **Publish, unpublish, republish**: The chair can publish the current DRAFT groups to make them visible on the public home page, unpublish the live set back to DRAFT for more edits, and republish after changes. Publishing remains idempotent when no DRAFT groups are waiting, and unpublishing is blocked while separate draft groups already exist.
- **Visibility rules**: Public visitors on the home page see only PUBLISHED pairings. DRAFT and ARCHIVED groups stay private to chair routes.

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
- `pnpm prisma:seed:sample` - seed rerunnable local sample data

## Sample Seed Data

- Run `pnpm prisma:seed:sample` to load a rerunnable local sample dataset for chair workflows and responsive QA.
- The script seeds 120 registrations, registration-backed RSVPs for the paid and waived sample golfers, 30 standalone RSVPs, 30 feedback entries, 30 gallery photos, and 30 remembrance entries.
- Sample generators mirror the current public form contracts: golf registrations use the live package value, standalone BBQ RSVPs keep the required attendee and text fields populated, feedback uses the current category list, and sample uploads include the contact/caption metadata the forms require.
- Before reseeding, it clears only prior sample rows tied to the `@example.com` sample email domain. It does not remove arbitrary anonymous or user-entered data.
- If `AWS_S3_BUCKET` is configured, the script also uploads placeholder S3 objects for seeded gallery and remembrance photo rows. Without S3, the metadata still seeds, but preview and download flows that depend on those objects will not fully work.
- For a quick count check after reseeding, you can optionally run `pnpm exec tsx prisma/verifySampleData.ts`.

## RSVP Source and Duplicate Handling

The app stores normalized email addresses on RSVP rows, and each RSVP email must be unique. The BBQ-only branch of the public `/register` form treats that normalized email as the RSVP identity, and submitting that branch means the household is attending the BBQ; there is no separate attending toggle or choice. `/rsvp` redirects to `/register` for old links:

- **BBQ-only path** (`/register`, signup type = BBQ-only RSVP): BBQ-only submissions create or reuse one paid RSVP checkout when no registration, RSVP, active golf checkout, or active RSVP checkout already uses the normalized email. After payment confirmation, the app creates one RSVP row with `source = 'FORM'`, stores adult and kid attendee counts, family names, dietary notes, notes, and the derived total attendee count.
- **Registration confirmation**: When a golf checkout completes payment, confirmation creates one participant and registration row per paid golfer plus one RSVP row with `source = 'REGISTRATION'` for the checkout's included BBQ attendance. If any RSVP already exists for that normalized email, confirmation reports the duplicate and does not create another RSVP.

This keeps RSVP data idempotent by email: repeated same-email BBQ RSVP submissions must not overwrite existing RSVP rows, and repeated payment confirmations must not create duplicate RSVP rows. The chair RSVP table displays the source as "RSVP form" or "Registration" and shows adult/kid party counts when they are known.

## Verification Checklist

Before deploying:

- Run local checks:

  ```bash
  pnpm install
  pnpm lint
  pnpm typecheck
  pnpm prisma validate
  pnpm prisma migrate dev
  pnpm prisma db seed
  pnpm test
  pnpm build
  ```

- Verify Register matrix: test golf registration with one golfer, golf registration with multiple golfers, golf registration with additional BBQ-only adults/kids, and BBQ-only RSVP on `/register`.
- Verify golf registration flow: complete the golf branch with all golfer fields filled in, confirm the browser leaves for the Square hosted checkout page, and verify the Square page shows `Golf registration (BBQ included)`, any applicable BBQ-only line items, total, currency, and environment.
- Verify golf-without-extra-BBQ flow: complete the golf branch with no additional BBQ-only guests, confirm only `Golf registration (BBQ included)` is charged, and verify one registration-sourced RSVP row is created after payment confirmation.
- Verify checkout reuse rules: submit identical details twice before payment and confirm the same pending checkout is reused; submit the same email with changed guest counts before payment and confirm the existing checkout is resumed instead of creating a second active charge path; complete payment, then submit the same email again and confirm the app shows the duplicate email error instead of creating another checkout.
- Verify paid-link reopening: complete payment, revisit `/register/payment?checkout=...`, and confirm the app resolves to the confirmed thanks state instead of sending the payer back to Square.
- Verify manual-review handling: simulate a paid Square checkout that cannot finalize locally because of an existing registration or RSVP and confirm the thanks page tells the payer not to pay again and to contact the chair with the receipt.
- Verify payment confirmation: complete hosted checkout, confirm Square returns through the configured app thanks flow, and verify multiple-golfer submissions create one participant/registration per golfer plus one REGISTRATION RSVP only after confirmation.
- Verify webhook and poller backup: test a webhook-delayed or return-delayed scenario and confirm `/register/thanks` keeps polling `/api/register/checkout/[checkoutId]` until Square confirmation or a clear pending message appears.
- Verify BBQ-only payment: submit `/register` with signup type = BBQ-only RSVP, confirm the form does not ask for a separate attending choice, confirm Square shows only `BBQ-only adults` and `BBQ-only kids` line items with no golf line item, then complete payment and verify FORM RSVP creation with adult, kid, family name, dietary note, note, and derived total attendee counts.
- Verify BBQ-only pending behavior: start a BBQ-only checkout and confirm no finalized RSVP row appears before payment; repeat with the same normalized email and different RSVP details, then verify the existing checkout is resumed or a visible pending-checkout error appears without overwriting data.
- Verify pending-checkout duplicate handling: start a golf checkout for an email, return to `/register`, submit BBQ-only RSVP with the same email, and verify the pending-checkout error appears without creating an RSVP row. Start a BBQ-only checkout for another email, then try golf registration with that email and verify the duplicate/pending-checkout gate blocks it.
- Verify completed-registration duplicate handling: complete a registration for an email, then submit the BBQ-only `/register` path with that same email and verify a visible duplicate email error appears with no RSVP data overwritten.
- Verify registration/RSVP cross-duplicates: submit BBQ-only RSVP with a given email, then register with that email and verify a duplicate email error appears with no checkout or registration created. Also complete a golf registration with BBQ attendance for a fresh email and verify one REGISTRATION RSVP row is created.
- Verify feedback submission: submit public feedback and confirm the chair feedback screen shows it only after chair login.
- Verify remembrance note submission: open `/remembrance` from the main nav, submit a note without contact info, and confirm it stays private and does not appear on `/chair/feedback`.
- Verify remembrance photo handling: submit `/remembrance` with contact info and a supported image, confirm the upload lands in the private S3 `remembrance/` prefix, is immediately available through the chair remembrance surface or download routes, and does not appear in public `/photos`.
- Verify chair remembrance downloads: log in, open `/chair/remembrance`, confirm individual download works, confirm Select all and Download selected work for a subset, and confirm Download all returns `blarney-remembrance.zip` with files inside a top-level `blarney-remembrance/` folder.
- Verify photo upload: submit a supported image as pending, log in as chair, approve one photo, verify the approved photo appears in the public gallery, can be opened full size from `/photos`, and pending/rejected photos do not.
- Verify photo moderation moves: after approval, confirm the S3 object lives under `approved/` and no second live copy remains under `pending/`; return that approved photo to pending and confirm it disappears from the public gallery and is privately reviewable again.
- Verify pending deletion: delete a pending photo from chair review and confirm the S3 object is removed and the row no longer appears after refresh.
- Verify multi-photo or folder upload after implementation: select multiple images or a folder of images, confirm one pending chair-review row and one `pending/` S3 object per accepted image, confirm unsupported or oversized files fail clearly, and confirm approved-only gallery behavior still holds.
- Verify chair login/logout and review screens: confirm `/chair/login` accepts correct password, `/chair/*` routes require auth, logout clears session, and registration, RSVP, feedback, gallery photo review, remembrance, and pairing chair screens load with expected private data.
- Verify chair dashboard layout: after chair login, confirm the dashboard presents registrations, RSVPs, feedback, photos, remembrance, and pairings in a clear visual hierarchy with obvious next actions, no overlapping cards or controls, and no clipped content at common desktop and mobile widths.
- Verify chair navigation after implementation: on `/chair` and representative `/chair/*` review pages at desktop, tablet, and mobile widths, confirm the chair navigation keeps all destinations and logout reachable, preserves clear current-page context, and does not obscure or strand the main content.
- Verify public versus chair navigation after implementation: on `/chair` and representative `/chair/*` review pages, confirm the shared navigation highlights the current location, and confirm `/chair/login` keeps the public header navigation instead of exposing chair-only destinations.
- Verify chair review-page layout flow: on `/chair/registrations`, `/chair/rsvps`, `/chair/feedback`, `/chair/photos`, `/chair/remembrance`, and `/chair/pairings`, confirm the page title, counts, actions, filters, pagination, and primary review content read in a logical top-to-bottom order and keep the main moderation tasks visible without hunting.
- Verify responsive admin tables and lists: on chair review pages, confirm long names, emails, notes, captions, download labels, and export actions remain readable on mobile and tablet, horizontal overflow is intentional when needed, and no controls disappear, overlap, or become unreachable.
- Verify list pagination: on the home page published pairings section, public `/photos`, and chair list pages (`/chair/registrations`, `/chair/rsvps`, `/chair/feedback`, `/chair/remembrance`), use next/previous navigation and refresh to confirm the current page stays URL-driven. Confirm each screen stays fixed at 50 items per page and the UI does not expose a page-size picker.
- Verify chair photo dual-list pagination: on `/chair/photos`, paginate pending and reviewed independently and confirm moving one list preserves the other list's current page and query state.
- Verify chair registration CSV exports: log in as chair, open `/chair/registrations`, click Export CSV and confirm Name, Email, Phone, Gender, Age, Score, Package, BBQ Only Adults, BBQ Only Kids, and Paid; click Export golfers CSV and confirm Name, Email, Phone, Gender, Age, Score, Good Golfer (41 and below), and Paid (status). Neither export should include private notes, checkout IDs, payment references, or other sensitive fields, and both exports should ignore the current table page and still include the full registration dataset.
- Verify pairing generation: seed test participants, open `/chair/pairings`, click Generate Pairings, and verify each DRAFT group gets one of the oldest available golfers as an older-player anchor, includes at least one female when the roster allows, balances Manzanita good golfers (`<= 41`) against other golfers as evenly as possible, uses projected group average scores to keep overall group skill as even as possible, and never exceeds four players. With the same paid-golfer roster and no manual edits between runs, generate pairings again and confirm the regenerated DRAFT groups match the prior result.
- Verify unassigned golfer roster and assignment: on `/chair/pairings`, confirm the golfer grid shows only paid golfers who are still unassigned to a DRAFT group. Use Assign for an unassigned golfer and verify they leave the grid and appear on the selected draft group card; use Remove on a group member and verify they return to the unassigned grid.
- Verify draft group editing: create a custom draft group, assign golfers, move golfers between draft groups, edit group name/display order/optional tee time, confirm each draft card preview lists member names with ages and scores, remove golfers from draft groups, and delete a populated draft group. Confirm deleting the group returns its golfers to the unassigned grid.
- Verify pairing publishing: on `/chair/pairings` with DRAFT groups present, click Publish Pairings and verify all DRAFT groups become PUBLISHED and appear on the public home page. Revisit `/chair/pairings` with no DRAFT groups remaining, click Publish Pairings again, and confirm no duplicate public pairings are created.
- Verify pairing unpublish and republish: after publishing pairings, unpublish the live set back to DRAFT, confirm the public home page no longer shows those groups, edit a draft group, and republish to confirm the updated published groups reappear on the home page.
- Verify public pairing visibility: publish pairings, open the public home page as a non-authenticated visitor, and confirm only PUBLISHED groups appear in the pairings section. Verify DRAFT and ARCHIVED groups stay private to chair routes.
- Verify pairings review ergonomics: on `/chair/pairings`, confirm generate, edit, review, and publish actions stay visually grouped with the current pairing output, and confirm group cards or tables remain easy to scan without ambiguous player ordering at mobile and desktop widths.
- Verify responsive layouts: test the consolidated registration/RSVP form, feedback form, photo gallery, logistics, and all chair pages on mobile and desktop.
- Verify S3 CORS and presigned upload behavior: upload a photo through `/photos`, confirm it lands in `pending/` prefix.
