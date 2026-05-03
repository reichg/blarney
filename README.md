# Blarney 42

A Next.js, TypeScript, Prisma, Postgres, and AWS S3 site for the Blarney 42 golf event in Cannon Beach.

## Stack

- Package manager: pnpm
- App: Next.js App Router, React, TypeScript, CSS Modules
- Data: Prisma with Postgres 17
- Storage: AWS S3 presigned uploads for photo submissions
- Chair admin: single password session for MVP
- Payments: external Square/Cash payment link for MVP

## Getting Started

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy `.env.example` to `.env` and fill in the chair password, S3, and payment URL values. The default `DATABASE_URL` matches the local Docker database.

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

## Core Workflows

- Public visitors can register, RSVP for the day-before event, send feedback, view logistics, and submit photos for review.
- The chair can sign in at `/chair/login` to view RSVPs, feedback, registrations, pending photos, and pairing tools.
- Pairing generation groups applicants by gender, good-golfer threshold, score, and age, then creates groups of up to four.
- Photo uploads go to a private S3 `pending/` prefix and must be approved before they appear in the public gallery.

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
