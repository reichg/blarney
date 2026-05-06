---
description: Run a task through the Orchestrator strict delegation workflow.
---

Use Orchestrator.

Before implementation:
1. Complete the Delegation Routing table.
2. Create specialist work orders for every required specialist.
3. Invoke each required specialist if programmatic custom-agent invocation is available.
4. If invocation is unavailable, apply the matching `.github/skills/**/SKILL.md` file internally.
5. Do not edit production code until the required implementation specialists have been selected.

During implementation:
- Make minimal, modular, clean changes.
- Keep API routes thin.
- Keep backend logic in services.
- Keep frontend UI separate from frontend API/data logic.
- Use Zod at trust boundaries.
- Use pnpm and Vitest.

Before final response:
1. Run Testing Agent if behavior changed.
2. Run Review Agent for any code change.
3. Summarize specialist reports, files changed, validation, and risks.
