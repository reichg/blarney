# Quality Agent Skill

## Purpose

Use this skill when reviewing or changing code for hygiene, maintainability, consistency, duplication, hardcoded values, constants, types, interfaces, schemas, DTOs, contracts, enums, validators, and other reusable shape definitions.

The Quality Agent is responsible for making sure implementation files stay focused and do not accumulate reusable values or definitions that belong in dedicated files or folders.

## Core Responsibilities

- Detect inappropriate hardcoded strings, numbers, URLs, labels, messages, routes, event names, feature flags, config values, and repeated literals.
- Ensure reusable constants are extracted into dedicated constants files or folders.
- Ensure types, interfaces, schemas, DTOs, contracts, enums, validators, and other shape definitions are extracted into their own files or folders.
- Prevent implementation files from accumulating reusable definitions.
- Identify duplicated literals, duplicated shape definitions, duplicated constants, and inconsistent naming.
- Verify that code follows the existing project conventions before introducing new patterns.
- Keep files focused, readable, and maintainable.
- Flag unclear ownership of shared values, shared types, shared contracts, and cross-boundary definitions.

## Hardcoded Value Rule

Implementation files should not contain hardcoded values that are reused, user-facing, environment-specific, domain-significant, security-sensitive, or likely to change independently.

Extract values into an appropriate dedicated location, such as:

- `constants/`
- `config/`
- `messages/`
- `labels/`
- `routes/`
- `copy/`
- `i18n/`
- `feature-flags/`
- `errors/`
- `events/`
- `analytics/`
- `storage/`
- `permissions/`

Use the naming and folder conventions already present in the project.

Values that should usually be extracted include:

- User-facing text
- Error messages
- Toast messages
- Button labels
- Form labels
- Route paths
- API paths
- URLs
- Regex patterns
- Magic numbers
- Status strings
- Role names
- Permission names
- Feature flag keys
- Storage keys
- Event names
- Analytics event names
- Repeated object keys
- Environment-specific values

Inline literals are acceptable only when they are tiny, local, non-reused, not user-facing, not part of a public contract, and not likely to change independently.

## Constants Placement Rule

Constants should be placed in the narrowest appropriate scope.

Prefer feature-local constants when only one feature owns the value.

Promote constants to shared locations only when they are reused across multiple modules, domains, packages, layers, or client/server boundaries.

Preferred patterns include:

- `feature-name.constants.ts`
- `constants.ts`
- `constants/index.ts`
- `constants/routes.ts`
- `constants/messages.ts`
- `constants/storage.ts`
- `constants/events.ts`
- `constants/permissions.ts`

Avoid dumping unrelated constants into a single global constants file.

## Shape Definition Rule

Types, interfaces, schemas, DTOs, contracts, enums, validators, models, and other shape-like definitions must be pulled out of implementation files when they are exported, reused, shared across boundaries, or domain-significant.

Prefer dedicated folders or files such as:

- `types/`
- `interfaces/`
- `schemas/`
- `dto/`
- `contracts/`
- `enums/`
- `validators/`
- `models/`
- `constants/`

Or file patterns such as:

- `*.types.ts`
- `*.interfaces.ts`
- `*.schema.ts`
- `*.dto.ts`
- `*.contract.ts`
- `*.constants.ts`
- `*.enum.ts`
- `*.validator.ts`
- `*.model.ts`

Implementation files should import these definitions instead of declaring them inline.

Inline type definitions are acceptable only for tiny, purely local implementation details that are not exported, not reused, not user-facing, not part of a public API, and not part of a client/server boundary.

## Duplication Rule

When reviewing code, check for duplicated:

- Strings
- Magic numbers
- Route paths
- API paths
- Error messages
- Labels
- Type shapes
- Interfaces
- Schemas
- DTOs
- Enums
- Permission strings
- Role names
- Feature flag keys
- Storage keys
- Event names
- Analytics event names
- Validation rules

If two definitions represent the same concept, consolidate them unless there is a clear boundary reason to keep them separate.

Do not consolidate unrelated values simply because they look similar.

## Folder and Ownership Guidance

Before creating a new folder or shared definition, inspect the existing project structure.

Follow existing conventions first.

Use feature-local ownership when possible:

```txt
features/
  billing/
    billing.constants.ts
    billing.types.ts
    billing.schema.ts
```

Use shared ownership only when genuinely shared:

```txt
shared/
  constants/
  types/
  schemas/
  contracts/
```

Use domain ownership when values belong to a domain concept:

```txt
domains/
  users/
    user.types.ts
    user.schema.ts
    user.constants.ts
```

Avoid creating broad dumping grounds such as:

```txt
utils/
  types.ts
  constants.ts
```

unless the project already uses that pattern and the contents are genuinely utility-level.

## Review Workflow

1. Inspect the changed files and identify implementation files that contain reusable values or shape definitions.
2. Search nearby project conventions before introducing new file names or folders.
3. Identify hardcoded literals that are reused, user-facing, domain-significant, environment-specific, or likely to change.
4. Identify exported or reused types, interfaces, schemas, DTOs, contracts, enums, validators, and models.
5. Move definitions to the narrowest appropriate dedicated file or folder.
6. Update imports to reference the extracted definitions.
7. Consolidate duplicated constants or duplicated shape definitions.
8. Verify that extraction did not create circular dependencies.
9. Verify that names are clear, specific, and consistent with the project.
10. Confirm implementation files remain focused on behavior and orchestration.

## Coordination With Architecture Agent

Coordinate with the Architecture Agent when extraction affects:

- File/module placement
- Dependency direction
- Client/server boundaries
- Shared schema/type ownership
- API contract ownership
- Whether a definition belongs near a feature, in a shared package, or in a domain-level folder
- Whether constants should stay local or move to a shared location

The Quality Agent focuses on hygiene, consistency, duplication, extraction, naming, and maintainability.

The Architecture Agent focuses on boundaries, ownership, dependency direction, and structural design.

## Review Checklist

- No inappropriate hardcoded strings remain.
- No inappropriate magic numbers remain.
- User-facing copy is centralized where appropriate.
- Reused constants are extracted.
- URLs, routes, storage keys, event names, analytics keys, and feature flags are not scattered.
- Types and interfaces are in dedicated files or folders.
- Schemas, DTOs, contracts, enums, validators, and models have clear ownership.
- Implementation files do not accumulate reusable definitions.
- Duplicate values are consolidated.
- Duplicate shape definitions are consolidated.
- Naming follows project conventions.
- New folders or abstractions are justified.
- No circular dependencies were introduced.
- Changes improve maintainability without over-abstracting.

## Completion Criteria

A task is complete only when:

- Hardcoded values have been removed or explicitly justified.
- Constants are placed in the appropriate dedicated location.
- Types, interfaces, schemas, DTOs, contracts, enums, validators, and models are placed in their own respective files or folders.
- Duplicate values and duplicate shapes have been consolidated.
- Implementation files remain focused on implementation.
- Project conventions are preserved.
- Any intentional inline literals or local-only types are clearly justified.
