# Blarney 42 Project Instructions

- Use `pnpm` for package management and scripts.
- Keep the app on Next.js App Router, React, TypeScript, and CSS Modules.
- Use Prisma with Postgres for persistent data. Prisma Client is configured for Prisma 7 with `@prisma/adapter-pg`.
- Keep all database writes validated with Zod before calling Prisma.
- Store chair-only pages under `/chair/*` and protect them with the single-password, signed HTTP-only cookie flow.
- Do not expose pending photos, rejected photos, unpublished pairings, chair notes, or secrets in public routes.
- Route public photo submissions through presigned S3 uploads to the `pending/` prefix. Only approved submissions should appear publicly.
- Keep payment handling as an external Square/Cash handoff unless the scope explicitly changes.
- Pairing generation should remain deterministic: split by gender, classify good golfers as Manzanita average score `<= 41`, sort by score and age, and cap groups at four.
- Keep MVP scope focused. Do not add full user accounts, Square webhooks, automated reconciliation, email notifications, or CMS features unless requested.
- Before handing off code changes, run the relevant checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm prisma validate`, and `pnpm build` when route behavior changed.
