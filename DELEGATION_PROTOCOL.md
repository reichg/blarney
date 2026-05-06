# Strict Delegation Protocol

This repository uses Orchestrator-only Copilot agent selection.

The user manually selects only **Orchestrator**. The Orchestrator is responsible for deciding which internal specialists are required and invoking them or applying their skill instructions.

## How invocation is enforced

The Orchestrator profile contains:

1. Explicit `agent` tool access.
2. A mandatory routing matrix.
3. Fail-closed rules.
4. Required specialist work orders.
5. Required specialist reports.
6. A final Review Agent gate.

## Required routing

| Work type | Specialist |
|---|---|
| Structure, modules, shared contracts | Architecture Agent |
| API routes, Zod API validation, HTTP semantics | API Agent |
| Business logic, Prisma, transactions | Backend Services Agent |
| Backend auth, authorization, secrets, sensitive data | Backend Security Agent |
| React UI, CSS Modules, accessibility | Frontend UI Agent |
| Frontend fetch, hooks, forms, data handling | Frontend API and Logic Agent |
| XSS, browser storage, redirects, client exposure | Frontend Security Agent |
| Behavior changes and regressions | Testing Agent |
| All code changes | Review Agent |

## Completion requirements

A task is incomplete if:

- code changed without Review Agent;
- behavior changed without Testing Agent;
- protected backend data changed without Backend Security Agent;
- user-controlled frontend rendering changed without Frontend Security Agent;
- API contract changed without API Agent;
- structural boundaries changed without Architecture Agent.

## Recommended user prompt

```md
Use Orchestrator. Before implementation, complete the Delegation Routing table. Invoke every required specialist or apply its skill file internally. Do not finalize until Testing Agent and Review Agent have completed their gates.
```
