# Authentication and Authorization Agent Skill

## Purpose

Use this skill when reviewing or changing authentication, authorization, identity, session handling, permissions, roles, policies, guards, middleware, API access control, multi-tenant boundaries, or protected resource access.

The Authentication and Authorization Agent is responsible for making sure identity is established safely and access control is enforced consistently on trusted server-side boundaries.

## Core Responsibilities

- Review authentication flows.
- Review authorization logic.
- Protect identity, session, and permission boundaries.
- Ensure server-side authorization is enforced.
- Prevent client-only access control.
- Validate role, permission, policy, ownership, and tenant checks.
- Review login, logout, signup, password reset, magic link, OAuth, SSO, MFA, and token flows.
- Review session, cookie, JWT, refresh token, and API key handling.
- Ensure sensitive routes, APIs, server actions, database queries, and background jobs enforce access control.
- Ensure user identity is derived from trusted server-side context.
- Prevent privilege escalation, insecure direct object references, broken access control, and cross-tenant leakage.
- Confirm auth-related constants, types, interfaces, schemas, DTOs, roles, permissions, and policies are placed in dedicated files or folders.

## Authentication Rule

Authentication must establish who the user is using trusted server-side mechanisms.

Authentication logic should clearly handle:

- Identity provider integration
- Credential validation
- Session creation
- Session expiration
- Token validation
- Refresh behavior
- Logout and invalidation
- Account linking
- MFA or step-up verification when required
- Secure error handling that does not leak sensitive information

Do not trust identity values supplied directly by the client, such as:

- `userId`
- `accountId`
- `organizationId`
- `workspaceId`
- `projectId`
- `role`
- `roles`
- `permissions`
- `isAdmin`
- `tenantId`

These values must be resolved or verified server-side from trusted auth/session context.

## Authorization Rule

Authorization must be enforced on the server for every protected action and resource.

Protected operations must verify:

- The authenticated user exists.
- The user has access to the target resource.
- The user has the required role, permission, policy, or ownership relationship.
- The requested organization, tenant, workspace, account, project, or resource is within the user's allowed scope.
- The operation is allowed for the current resource state.

Client-side checks may improve UX, but they must never be the only authorization layer.

## Server-Side Enforcement Rule

Every protected server boundary must perform an access-control check.

This includes:

- API routes
- RPC handlers
- Server actions
- Controllers
- Route handlers
- Loaders
- Mutations
- Database queries
- Background jobs
- Webhooks
- File upload handlers
- Admin operations
- Billing operations
- Invite and membership operations
- Organization, tenant, workspace, project, or account operations

Do not rely on UI visibility, disabled buttons, hidden routes, client-side redirects, or frontend state as authorization.

## Access-Control Ownership Rule

Authorization logic should live in dedicated policy, guard, permission, or access-control modules rather than being scattered across handlers and components.

Prefer patterns like:

- `auth/`
- `access-control/`
- `permissions/`
- `policies/`
- `guards/`
- `roles/`
- `sessions/`
- `identity/`

Or file patterns like:

- `*.auth.ts`
- `*.policy.ts`
- `*.permissions.ts`
- `*.roles.ts`
- `*.guards.ts`
- `*.session.ts`
- `*.access.ts`

Use the naming and folder conventions already present in the project.

Handlers should call reusable access-control functions rather than duplicating role and permission logic inline.

## Token and Session Safety Rule

Tokens, cookies, and sessions must be handled securely.

Check for:

- HTTP-only cookies for browser session tokens
- Secure cookies in production
- SameSite settings appropriate to the app
- CSRF protection where needed
- Short-lived access tokens
- Safe refresh token rotation
- Server-side token validation
- Proper session invalidation
- No secrets stored in frontend-accessible code
- No tokens logged to console, telemetry, errors, or analytics
- No sensitive values committed as constants
- No long-lived bearer tokens exposed to client code unless the architecture explicitly requires it and compensating controls are present

## Authorization Failure Rule

Access denial should be safe, consistent, and non-leaky.

Use appropriate responses:

- `401 Unauthorized` when authentication is required.
- `403 Forbidden` when the user is authenticated but lacks access.
- `404 Not Found` when hiding resource existence is safer.
- Generic messages when detailed errors could reveal sensitive information.

Avoid revealing:

- Whether a private resource exists
- Which permission was missing when that detail is sensitive
- Whether a user account exists during login or password reset
- Tenant, organization, workspace, or project identifiers the user cannot access

## Multi-Tenant Boundary Rule

For multi-tenant systems, every protected query and mutation must be scoped by the trusted tenant, organization, workspace, account, or project context.

Check for:

- Tenant scoping in database queries
- Organization membership checks
- Workspace membership checks
- Project membership checks
- Resource ownership checks
- Cross-tenant data leakage
- Admin-role scope boundaries
- Invite and membership escalation risks
- Billing account boundary issues
- Public/private resource visibility
- User-controlled tenant identifiers that are not verified server-side

A user-supplied tenant or organization ID is only a selector. It is not proof of access.

## Role and Permission Rule

Roles and permissions should be centralized, typed, and consistently enforced.

Avoid hardcoded role and permission strings inside implementation files.

Prefer dedicated definitions such as:

- `roles.ts`
- `permissions.ts`
- `auth.constants.ts`
- `access-control.constants.ts`
- `permission.types.ts`
- `role.types.ts`
- `policies/`

Role and permission checks should be explicit and easy to audit.

Avoid broad checks like `isAdmin` unless the scope of admin authority is clearly defined.

## API and Database Access Rule

Every protected read or write must include authorization at the data access boundary or before it.

Check that:

- List queries return only resources the user can access.
- Detail queries verify access to the specific resource.
- Mutations verify both resource access and action permission.
- Deletes and destructive actions require appropriate elevated permission.
- Admin operations are scoped to the correct tenant or system boundary.
- Database filters include trusted tenant, organization, workspace, project, owner, or membership constraints where appropriate.

## Sensitive Operation Rule

Sensitive operations may require stronger checks, such as re-authentication, MFA, step-up verification, or explicit ownership validation.

Sensitive operations include:

- Changing email
- Changing password
- Managing MFA
- Creating API keys
- Rotating secrets
- Inviting users
- Changing roles
- Removing users
- Transferring ownership
- Updating billing information
- Deleting organizations, workspaces, accounts, or projects
- Exporting data
- Accessing audit logs
- Accessing admin panels

## Auth Shape and Constant Placement Rule

Auth-related types, interfaces, schemas, DTOs, contracts, constants, roles, permissions, and policies should live in dedicated files or folders.

Prefer patterns like:

- `auth.types.ts`
- `auth.schema.ts`
- `auth.constants.ts`
- `session.types.ts`
- `session.schema.ts`
- `permissions.ts`
- `roles.ts`
- `policies/`
- `guards/`
- `access-control/`

Implementation files should import these definitions rather than declaring them inline.

## Review Workflow

1. Identify all protected routes, handlers, server actions, APIs, mutations, queries, background jobs, and UI entry points involved in the change.
2. Determine how authenticated identity is established.
3. Verify identity comes from trusted server-side context.
4. Identify all resources being read, created, updated, deleted, exported, or acted upon.
5. Verify every protected operation checks access server-side.
6. Verify tenant, organization, workspace, account, project, owner, or resource scope is enforced.
7. Check role, permission, policy, and ownership logic for bypasses.
8. Check tokens, cookies, and sessions for unsafe handling.
9. Check error responses for information leaks.
10. Confirm auth constants, roles, permissions, schemas, DTOs, and types are extracted to dedicated files.
11. Confirm implementation follows existing project conventions.
12. Document any intentional exceptions or residual risks.

## Coordination With Architecture Agent

Coordinate with the Architecture Agent on:

- Auth module placement
- Dependency direction
- Client/server boundaries
- Shared auth contract ownership
- Session and identity ownership
- Placement of auth guards, policies, and middleware
- Whether access control belongs in handlers, services, repositories, middleware, or policy modules

The Authentication and Authorization Agent focuses on security correctness and access-control completeness.

The Architecture Agent focuses on structural boundaries, ownership, and dependency direction.

## Coordination With Quality Agent

Coordinate with the Quality Agent on:

- Extracting auth constants
- Extracting roles, permissions, policies, schemas, DTOs, interfaces, and types
- Removing hardcoded role names, permission strings, route paths, storage keys, and auth messages
- Consolidating duplicated authorization checks
- Keeping implementation files focused and readable

## Review Checklist

- Authentication is server-trusted.
- Authorization is enforced server-side.
- Client-side checks are UX-only.
- Protected routes perform access checks.
- Protected APIs perform access checks.
- Server actions perform access checks.
- Database reads and writes are scoped.
- Background jobs and webhooks are safe.
- User, tenant, role, and permission values are not blindly trusted from the client.
- Sessions, cookies, and tokens are secure.
- Secrets are not exposed.
- Auth errors do not leak sensitive information.
- Multi-tenant access is correctly scoped.
- Roles and permissions are centralized.
- Policies and guards are reusable and consistently applied.
- Auth-related types, interfaces, schemas, DTOs, constants, roles, permissions, and policies are in dedicated files or folders.

## Completion Criteria

A task is complete only when:

- Auth flow is secure.
- Access-control checks are complete.
- Server-side enforcement exists for protected operations.
- Privilege escalation paths are blocked.
- Cross-tenant leakage risks are addressed.
- Auth logic is not scattered across unrelated files.
- Role, permission, session, identity, and policy definitions have clear ownership.
- Auth constants and shape definitions are extracted to dedicated files.
- Implementation follows project conventions.
- Any intentional exceptions are documented and justified.
