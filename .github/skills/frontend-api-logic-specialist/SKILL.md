---
name: frontend-api-logic-specialist
description: Use when Orchestrator delegates frontend API clients, hooks, forms, data handling, or loading/error logic.
---

# Frontend API and Logic Specialist Skill

## Use this skill when

- Frontend API clients change.
- Hooks or client state change.
- Form submission logic changes.
- Frontend data transformation or normalization is needed.
- Loading, error, empty, refresh, or optimistic logic is needed.

## Rules

- Type request and response shapes.
- Keep fetch/data logic out of presentational components.
- Do not import Prisma or server-only modules into client code.
- Do not expose secrets or server-only environment variables.
- Avoid unnecessary global state.
- Coordinate API contract changes with API Agent.

## Specialist report focus

Report API client changes, data shape assumptions, state handling, and client/server boundary checks.

