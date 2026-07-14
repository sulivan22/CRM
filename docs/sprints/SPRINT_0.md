# Sprint 0

## Objective

Create a clean, executable, testable technical bootstrap for the SaaS monorepo.

## Scope

- pnpm workspace and Turborepo setup.
- Strict TypeScript shared configuration.
- Minimal Next.js web application.
- Minimal NestJS API with health and readiness endpoints.
- Minimal NestJS worker with a BullMQ bootstrap queue.
- PostgreSQL with Prisma and pgvector.
- Redis for queues.
- Docker Compose for local development.
- CI for lint, typecheck, tests, and build.

## Deliverables

- `apps/web`, `apps/api`, and `apps/worker`.
- Shared packages for config, database, linting, types, UI, and TypeScript.
- Docker Compose stack for PostgreSQL, Redis, API, worker, and web.
- Initial Prisma migration and seed.
- Minimal operational documentation.

## Acceptance Criteria

- Dependencies install with pnpm.
- Lint, typecheck, tests, and build pass.
- Prisma client generation and initial migration work.
- PostgreSQL starts with pgvector.
- Redis starts.
- API responds on `/health` and `/ready`.
- Web app renders a minimal operational page.
- Worker processes a bootstrap queue job.
- Docker Compose starts the local stack.

## Out of Scope

- Authentication.
- Workspaces or tenant domain logic.
- Companies, contacts, campaigns, CRM workflows, email providers, AI agents, billing, and business analytics.
