# Sprint 1

## Objective

Add first-party authentication, database-backed sessions, users, workspaces, memberships, role authorization, active workspace selection, and minimal frontend auth routes.

## Scope

- User registration and login with Argon2id password hashes.
- Opaque session tokens stored in HTTP-only cookies.
- SHA-256 session token hashes stored in PostgreSQL.
- Workspace creation, listing, updates, member listing, member role/status updates.
- Workspace membership and role guards in NestJS.
- Minimal Next.js routes for login, registration, app shell, and workspaces.
- Audit logs for core auth and workspace actions.

## Development Seed

- Email: `dev@example.com`
- Password: `ChangeMe12345!`
- Workspace: `Development Workspace`

These credentials are development-only and must not be used in production.

## Acceptance Notes

All workspace access is checked server-side against active memberships. The client may request a workspace switch, but the API validates membership before persisting it on the session.

## Out of Scope

OAuth, magic links, password reset email, email verification workflow, invitations, contacts, campaigns, CRM domain modules, email providers, AI providers, billing, analytics, SSO, and production deployment.
