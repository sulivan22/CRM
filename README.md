# CRM Bootstrap

Technical bootstrap for a multi-tenant SaaS monorepo. Sprint 1 adds first-party authentication, users, workspaces, memberships, role authorization, and minimal frontend auth flows.

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
pnpm db:seed
```

## Development

```bash
pnpm dev
```

- Web: http://localhost:3000
- API health: http://localhost:3001/health
- API readiness: http://localhost:3001/ready
- Swagger in development: http://localhost:3001/docs
- Login: http://localhost:3000/login
- Register: http://localhost:3000/register
- App shell: http://localhost:3000/app

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

The Prisma schema enables pgvector and defines users, workspaces, memberships, sessions, and audit logs.

Development seed credentials:

- Email: `dev@example.com`
- Password: `ChangeMe12345!`

These are development-only credentials.

## Authentication

The API uses Argon2id password hashes and opaque database-backed sessions. The browser receives an HTTP-only cookie named by `AUTH_COOKIE_NAME`; PostgreSQL stores only the SHA-256 hash of the raw session token.

Important environment variables:

- `AUTH_COOKIE_NAME`
- `AUTH_SESSION_TTL_SECONDS`
- `AUTH_COOKIE_DOMAIN`
- `AUTH_COOKIE_SECURE`
- `PASSWORD_MIN_LENGTH`
- `API_CORS_ORIGIN`
- `NEXT_PUBLIC_API_BASE_URL`

For local development, keep `AUTH_COOKIE_DOMAIN` empty and `AUTH_COOKIE_SECURE=false` unless running behind HTTPS. Frontend requests include credentials so cookies work across `localhost:3000` and `localhost:3001`.

CSRF note: Sprint 1 uses `SameSite=Lax` HTTP-only cookies and API-side authorization checks. Add explicit CSRF tokens before public production exposure if cross-site write risks change.

Expired or revoked sessions can be cleaned with:

```bash
pnpm db:sessions:cleanup
```

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
