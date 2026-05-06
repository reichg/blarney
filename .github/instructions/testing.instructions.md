---
applyTo: "**/*.test.ts,**/*.test.tsx,**/*.spec.ts,**/*.spec.tsx,vitest.config.*"
---

# Testing instructions

- Use Vitest.
- Prefer focused tests that verify behavior.
- Add regression tests for bug fixes.
- Do not weaken or remove tests to make a suite pass.
- Use existing test utilities and mocks before creating new ones.
- Avoid brittle tests tied to implementation details.
- Keep snapshots small and rare.
