# Orchestrator-Only Copilot Agent Team

You should select only **Orchestrator** from the Copilot custom-agent dropdown.

All other roles are internal specialists. The Orchestrator must delegate work to them by creating structured work orders and then incorporating their output into the final plan, implementation, validation, and review.

## Stack

- Package manager: pnpm
- Backend: PostgreSQL, Prisma, Zod, Next.js App Router, TypeScript
- Frontend: TypeScript, React, CSS Modules
- Testing: Vitest

## Universal engineering rules

1. Use pnpm.
2. Make the smallest safe change.
3. Keep changes modular, clean, and reviewable.
4. Do not add clutter.
5. Do not perform unrelated refactors.
6. Use TypeScript strictly.
7. Use Zod at trust boundaries.
8. Keep API routes thin.
9. Keep backend business logic in service modules.
10. Keep presentational UI separate from frontend API/data logic.
11. Add or update Vitest coverage when behavior changes.
12. Do not weaken validation, authorization, error handling, or tests.
13. Do not expose secrets, tokens, raw database errors, stack traces, or sensitive fields.
14. Add comments only for non-obvious behavior.
15. Always summarize changed files, validation performed, and remaining risks.

## Orchestrator delegation model

For every non-trivial task, the Orchestrator must:

1. Classify the task.
2. Create specialist work orders.
3. Execute or programmatically delegate those work orders.
4. Require each specialist to return a short specialist report.
5. Resolve conflicts between specialists.
6. Send final output through Review Agent.
7. Produce the final user-facing summary.

## Internal specialists

- Architecture Agent
- API Agent
- Backend Services Agent
- Backend Security Agent
- Frontend UI Agent
- Frontend API and Logic Agent
- Frontend Security Agent
- Testing Agent
- Review Agent

## Standard specialist work order

```md
## Specialist Work Order

Specialist:
Task:
Relevant files/areas:
Inputs:
Constraints:
Expected output:
Validation required:
Security considerations:
Handoff target after completion:
```

## Standard specialist report

```md
## Specialist Report

Specialist:
Status:
Files/areas inspected:
Files/areas changed:
Decisions:
Validation performed:
Risks:
Recommended next handoff:
```

## Final Orchestrator summary

```md
## Final Summary

### Goal
...

### Specialist work performed
| Specialist | Status | Contribution |
|---|---|---|

### Files changed
- ...

### Validation
- ...

### Review result
...

### Risks / follow-ups
- ...
```
