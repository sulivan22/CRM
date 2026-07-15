# ADR-001 Database-Backed Sessions

Status: accepted

Use opaque, database-backed sessions in secure HTTP-only cookies.

## Decision

The browser receives only a random 256-bit session token in an HTTP-only cookie. PostgreSQL stores only a SHA-256 hash of that token with expiration and revocation fields.

## Consequences

- Sessions can be revoked immediately on logout.
- Raw session tokens are not persisted.
- The API remains the enforcement point for authentication.
- CSRF must be considered for cookie-authenticated writes. Sprint 1 uses `SameSite=Lax`; stronger CSRF tokens can be added before public production exposure.
