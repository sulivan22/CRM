# ADR-002 Workspace Membership Authorization

Status: accepted

Authorize workspace access through server-side membership checks.

## Decision

Every workspace-scoped endpoint checks that the authenticated user has an active membership in the requested active workspace. Role checks are implemented with reusable NestJS guards.

## Consequences

- Client-supplied workspace IDs are treated as untrusted input.
- OWNER, ADMIN, MEMBER, and VIEWER policies are centralized.
- Last active OWNER protection prevents leaving a workspace without an owner.
