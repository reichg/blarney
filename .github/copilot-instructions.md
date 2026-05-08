# Repository instructions for GitHub Copilot

This repository uses an **Orchestrator-only** agent workflow.

The user should manually select only the **Orchestrator** custom agent. All other roles are internal specialists represented by hidden/programmatic agent profiles and project skills.

## Stack

- Package manager: pnpm
- Backend: PostgreSQL, Prisma, Zod, Next.js App Router, TypeScript
- Frontend: TypeScript, React, CSS Modules
- Testing: Vitest

## Mandatory workflow

For any non-trivial request:

1. Orchestrator creates a plan.
2. Orchestrator creates specialist work orders.
3. Orchestrator delegates to hidden/programmatic specialists when supported.
4. If programmatic custom-agent invocation is unavailable, Orchestrator must apply the corresponding `.github/skills/**/SKILL.md` instructions as internal specialist roles.
5. Specialists return structured reports.
6. Testing Agent validates behavior changes.
7. Review Agent performs final gate.
8. Orchestrator summarizes final result.

## Engineering standards

- Use pnpm.
- Make minimal, focused changes.
- Preserve existing project patterns.
- Keep API routes thin.
- Keep backend business logic in service modules.
- Keep UI presentation separate from data fetching and transformation logic.
- Use Zod at API, form, env/config, and external-data boundaries.
- Use Prisma only from server-side modules.
- Use CSS Modules for styling.
- Add or update Vitest tests when behavior changes.
- Avoid broad refactors and unrelated formatting.
- Do not add dependencies unless clearly necessary.
- Never expose secrets, tokens, sensitive fields, raw database errors, or stack traces to clients.
- Use comments only where they clarify non-obvious behavior.

## Preferred validation

Use existing package scripts first:

```bash
pnpm typecheck
pnpm lint
pnpm test
```

For Vitest directly:

```bash
pnpm vitest run
```

For Prisma changes:

```bash
pnpm prisma validate
pnpm prisma generate
```

Do not run destructive database commands or production-affecting commands unless explicitly requested.


## Strict Orchestrator delegation protocol

The Orchestrator must not start implementation on non-trivial tasks until it completes the Delegation Routing table.

Required routing rules:

- Architecture impact requires Architecture Agent.
- Authentication, authorization, validation, secrets, sensitive data, or safe-error impact requires Auth and Auth Agent.
- API impact requires API Agent.
- Backend service or Prisma impact requires Backend Services Agent and Quality Agent.
- Backend auth, authorization, validation, secrets, sensitive data, or safe-error impact requires Backend Security Agent and Auth and Auth Agent.
- React markup, component, accessibility, or CSS Module impact requires Frontend UI Agent.
- Frontend API client, hook, form, or data transformation impact requires Frontend API and Logic Agent.
- XSS, token, browser storage, redirect, unsafe rendering, external link, or public env-var impact requires Frontend Security Agent.
- Any behavior change requires Testing Agent.
- Any code change requires Review Agent.

If a required specialist cannot be invoked programmatically, the Orchestrator must apply that specialist's skill file internally and produce a labeled Specialist Report.
