---
name: architecture-specialist
description: Use when Orchestrator delegates module boundaries, file placement, dependency direction, shared type/schema strategy, or cross-layer design.
---

# Architecture Specialist Skill

## Use this skill when

- New files/modules are needed.
- Shared types or schemas are proposed.
- Client/server boundaries may be affected.
- Cross-layer contracts change.
- A change risks creating circular dependencies or mega-files.

## Rules

- API routes depend on services/schemas, not the reverse.
- Backend services may depend on Prisma and server-only utilities.
- Client code must not import server-only modules.
- UI components should not know Prisma models directly.
- Shared schemas/types must be intentional and safe to expose.
- Avoid premature abstraction.

## Specialist report focus

Report recommended structure, dependency direction, files to create/change, rationale, and risks.

