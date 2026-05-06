---
name: backend-security-specialist
description: Use when Orchestrator delegates backend auth, authorization, validation, secret handling, or sensitive-data review.
---

# Backend Security Specialist Skill

## Use this skill when

- Protected backend data is read or mutated.
- Auth or authorization is involved.
- Sensitive fields may be exposed.
- Raw SQL, webhooks, redirects, uploads, callbacks, or external input are involved.
- Error handling changes.

## Rules

- Never trust client-provided user IDs, roles, ownership flags, or prices.
- Authorize on the server before protected reads/writes.
- Validate untrusted input with Zod or existing validation pattern.
- Exclude sensitive fields by default.
- Do not expose raw Prisma/SQL errors or stack traces.
- Avoid raw SQL; if required, parameterize.

## Specialist report focus

Report authn/authz checks, validation checks, data exposure review, secret handling, and error safety.

