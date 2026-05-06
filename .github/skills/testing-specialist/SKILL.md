---
name: testing-specialist
description: Use when Orchestrator delegates Vitest coverage, regression tests, mocks, or validation strategy.
---

# Testing Specialist Skill

## Use this skill when

- Behavior changes.
- A bug fix needs regression coverage.
- API, service, hook, or component logic changes.
- Validation strategy is needed.

## Rules

- Use Vitest.
- Prefer focused behavior tests.
- Use existing test utilities and mocks.
- Avoid brittle implementation-detail tests.
- Do not weaken or delete tests to pass the suite.
- Keep snapshots rare and small.

## Specialist report focus

Report test files changed, scenarios covered, validation command, remaining test risks.

