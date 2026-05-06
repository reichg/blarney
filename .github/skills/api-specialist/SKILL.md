---
name: api-specialist
description: Use when Orchestrator delegates API route, Zod validation, HTTP status, or response-contract work.
---

# API Specialist Skill

## Use this skill when

- Creating or changing `app/api/**/route.ts`
- Defining request or response contracts
- Adding Zod validation
- Mapping service results to HTTP responses
- Changing frontend-facing API shapes

## Rules

- Keep route handlers thin.
- Validate all untrusted input with Zod.
- Delegate business logic to backend services.
- Return intentional response shapes.
- Use correct HTTP status codes.
- Do not return raw Prisma models when they contain internal or sensitive fields.
- Do not expose stack traces or raw internal errors.

## Specialist report focus

Report input validation, response contract, status codes, service handoffs, and changed API shapes.

