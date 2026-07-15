# Epic 2: People

## Scope

Epic 2 adds the workspace-scoped People module for AI Outreach OS:

- Organizations with archived status.
- People with optional organization, profile metadata and archived/do-not-contact status.
- Communication channels for email, social profiles, websites and phone.
- Tags and person-tag assignments.
- CSV import jobs processed asynchronously through BullMQ.
- Search and filters for people by workspace, organization, tag, country, language, channel type and status.

Out of scope: campaigns, inbox, AI generation, message sending, billing, analytics, sequences and enrichment providers.

## API Surface

All resources are scoped under `/workspaces/:workspaceId` and require an active workspace membership.

- `GET /organizations`
- `POST /organizations`
- `GET /organizations/:organizationId`
- `PATCH /organizations/:organizationId`
- `DELETE /organizations/:organizationId`
- `GET /people`
- `POST /people`
- `GET /people/:personId`
- `PATCH /people/:personId`
- `DELETE /people/:personId`
- `POST /people/:personId/channels`
- `DELETE /people/:personId/channels/:channelId`
- `POST /people/:personId/tags`
- `DELETE /people/:personId/tags/:tagId`
- `GET /tags`
- `POST /tags`
- `POST /imports/people`
- `GET /imports/:importJobId`
- `GET /imports/:importJobId/errors`

## Data Rules

- Organization names and tags are normalized per workspace for uniqueness.
- Communication channels are normalized and unique per workspace/type/value.
- Deletes are archival for organizations, people and channels.
- Import row failures are recorded without stopping the whole job.
- CSV file contents are stored temporarily inside import job mapping and removed by the worker after processing.

## Validation

The target validation set is:

- `pnpm db:generate`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- Docker compose smoke with API, web, worker, Postgres and Redis.
