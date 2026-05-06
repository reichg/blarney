---
name: backend-services-specialist
description: Use when Orchestrator delegates backend service logic, Prisma, transaction, or domain-rule work.
---

# Backend Services Specialist Skill

## Use this skill when

- Implementing business logic
- Creating service modules
- Writing Prisma queries
- Handling transactions
- Enforcing domain invariants

## Rules

- Keep services framework-light and testable.
- Do not pass entire HTTP requests into services.
- Use server-only Prisma access.
- Select only needed fields.
- Use transactions for multi-write invariants.
- Avoid leaking Prisma-specific errors upward unless intentionally mapped.

## Specialist report focus

Report business rules, service boundaries, Prisma choices, transaction boundaries, and risks.

