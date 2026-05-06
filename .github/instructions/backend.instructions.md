---
applyTo: "app/api/**/*.ts,app/api/**/*.tsx,lib/server/**/*.ts,server/**/*.ts,prisma/**/*.prisma"
---

# Backend instructions

- Keep API route handlers thin.
- Put business logic in backend service modules.
- Use Zod for request and external input validation.
- Use Prisma only from server-side modules.
- Select only needed fields from the database.
- Do not expose raw Prisma errors or sensitive fields to clients.
- Use transactions for multi-write operations that must succeed or fail together.
- Validate Prisma schema changes with `pnpm prisma validate`.
