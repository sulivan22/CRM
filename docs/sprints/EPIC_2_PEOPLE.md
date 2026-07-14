# Epic 2 People Implementation Notes

## Implemented

- Prisma models and migration for organizations, people, communication channels, tags and import jobs.
- Workspace-scoped NestJS modules: `OrganizationsModule`, `PeopleModule`, `TagsModule`, `ImportsModule`.
- BullMQ producer in API and worker consumer for `people-imports`.
- CSV parsing, mapping inference, normalization and row-level error persistence.
- Next.js `/app/people` screen with search, filters, creation, detail editing, channel/tag management and CSV import status.
- Development seed data for one organization, two people, tags and channels.

## Operational Notes

- CSV imports support inferred mappings for common headers and optional explicit JSON `mapping` in multipart requests.
- Existing contacts are matched by normalized channel in workspace. With `overwriteExisting=true`, scalar person fields are updated.
- Import jobs store rows temporarily in `mapping.rows`; the worker replaces mapping with metadata after completion.

## Deferred

- Pagination beyond the current 100-row list cap.
- Advanced column mapping UI.
- Bulk archive and bulk tag operations.
- External enrichment and campaign workflows.
