# CRM Bootstrap

Technical bootstrap for a multi-tenant SaaS monorepo. This sprint only provides the executable foundation: web, API, worker, shared packages, PostgreSQL, Redis, Prisma, Docker, linting, tests, and CI.

## Requirements

- Node.js 20.11+
- pnpm 9+
- Docker and Docker Compose

## Setup

```bash
pnpm install
cp .env.example .env
pnpm db:generate
pnpm db:migrate
```

## Development

```bash
pnpm dev
```

- Web: http://localhost:3000
- API health: http://localhost:3001/health
- API readiness: http://localhost:3001/ready
- Swagger in development: http://localhost:3001/docs

## Docker

```bash
cp .env.example .env
docker compose up --build
```

The compose stack starts PostgreSQL with pgvector, Redis, API, worker, and web.

## Database

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

The initial Prisma schema enables pgvector and creates a minimal `SystemHealth` model for integration checks only.

## Quality

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format
```

## Structure

- `apps/web`: Next.js App Router frontend.
- `apps/api`: NestJS HTTP API.
- `apps/worker`: NestJS standalone worker with BullMQ.
- `packages/config`: shared environment validation.
- `packages/database`: Prisma schema, client, migrations, seed.
- `packages/types`: shared bootstrap types.
- `packages/ui`: shared frontend component base.
- `packages/eslint-config`: shared ESLint flat configs.
- `packages/tsconfig`: shared TypeScript configs.

Use Conventional Commits for commit messages.
