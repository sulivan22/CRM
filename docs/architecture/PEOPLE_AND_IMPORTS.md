# People and Imports Architecture

## Resource Boundary

People data is tenant-isolated by `workspaceId`. API controllers are mounted below `/workspaces/:workspaceId` and use the Sprint 1 `AuthGuard` plus `WorkspaceMembershipGuard`. Mutations also require a workspace role of owner, admin or member.

## Data Model

- `Organization`: workspace-scoped account/entity with normalized name uniqueness.
- `Person`: workspace-scoped contact with optional organization and profile metadata.
- `CommunicationChannel`: normalized contact handle. A unique index on workspace/type/value prevents duplicate reachable identities.
- `Tag`: workspace-scoped label with normalized name uniqueness.
- `PersonTag`: join table for many-to-many tag assignments.
- `ImportJob` and `ImportRowError`: asynchronous import tracking and row failure details.

## Import Flow

1. API receives `POST /workspaces/:workspaceId/imports/people` as multipart CSV.
2. The CSV is parsed and a mapping is inferred or accepted from request body.
3. API creates an `ImportJob` with queued status and enqueues `people.import` on BullMQ queue `people-imports`.
4. Worker loads the job, marks it processing and processes rows independently.
5. Each row creates or updates organization/person/channels/tags, or records `ImportRowError`.
6. Worker marks the job completed or failed and stores a summary.

Redis is required for BullMQ. Postgres remains the source of truth for job status, row errors and imported people.

## Normalization

Normalization lives in `@crm/database/src/people-import.ts` so API and worker share behavior:

- Emails are lowercased and require `@`.
- Social profiles strip protocol, `www`, leading `@` and trailing slash.
- Phone values keep digits and `+`.
- Country codes are uppercase ISO-like two-letter values.
- Language codes are lowercase two-letter or two-letter regional values.

## Failure Handling

Import processing is row-tolerant. A bad row records code, message and raw row JSON, then processing continues. If every row fails, the job status becomes `FAILED`; otherwise it becomes `COMPLETED` with failed row counts.
