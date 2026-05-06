---
name: frontend-security-specialist
description: Use when Orchestrator delegates XSS, unsafe rendering, token/browser storage, redirects, or client exposure review.
---

# Frontend Security Specialist Skill

## Use this skill when

- User-generated content is rendered.
- `dangerouslySetInnerHTML` appears or is proposed.
- Tokens, browser storage, redirects, external links, or public env vars are involved.
- Sensitive client-visible data changes.

## Rules

- Avoid unsafe HTML rendering.
- Treat `NEXT_PUBLIC_*` as public.
- Do not store long-lived sensitive tokens in localStorage/sessionStorage without approved pattern.
- Validate dynamic redirect/link targets.
- Use `rel="noopener noreferrer"` for external new-tab links.
- Do not rely on client-side authorization.

## Specialist report focus

Report XSS surfaces, token/storage review, link/redirect safety, sensitive display risks, and backend enforcement needs.

