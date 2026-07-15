# Epic 3: Outreach

## Scope

Epic 3 adds draft outreach creation and review. A workspace user can select an audience from stored People data, define an objective and generation settings, generate one draft message per recipient, edit/regenerate/approve/reject messages, and save the outreach as a draft/review artifact.

Out of scope: sending, providers, inbox, replies, tracking, sequences, automations, scraping, analytics and production AI integrations.

## API

All endpoints are workspace-scoped below `/workspaces/:workspaceId/outreach`.

- `POST /audience/resolve`
- `POST /`
- `GET /`
- `GET /:outreachId`
- `PATCH /:outreachId`
- `DELETE /:outreachId`
- `POST /:outreachId/generate`
- `GET /:outreachId/generation`
- `GET /:outreachId/messages`
- `GET /:outreachId/messages/:messageId`
- `PATCH /:outreachId/messages/:messageId`
- `POST /:outreachId/messages/:messageId/regenerate`
- `POST /:outreachId/messages/:messageId/approve`
- `POST /:outreachId/messages/:messageId/reject`
- `POST /:outreachId/approve`

## Data Rules

- Audience is resolved server-side from People data.
- Archived people are excluded.
- Recipients are stored in `OutreachRecipient`.
- Generation jobs are stored in Postgres and processed through BullMQ queue `outreach-generation`.
- Generated messages are plain text only.
- Regeneration creates a new generation version and deactivates the previous active draft.
- No secrets or external provider calls are used.
