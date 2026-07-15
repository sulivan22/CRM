# Outreach Generation Architecture

## Boundary

Outreach is tenant-isolated by `workspaceId` and follows the existing auth stack: `AuthGuard`, `WorkspaceMembershipGuard` and role checks for mutations. No endpoint sends messages.

## AI Abstraction

`packages/ai` owns AI provider contracts:

- `AIProvider`
- `AIService`
- `FakeAIProvider`

`AI_PROVIDER=fake` is the only supported provider in this epic. The fake provider is deterministic and does not use network access or secrets.

## Generation Flow

1. API creates an `Outreach`, normalized `OutreachInstruction` and resolved `OutreachRecipient` rows.
2. User requests generation.
3. API creates `OutreachGenerationJob`, marks outreach `GENERATING` and enqueues BullMQ job `outreach.generate` on queue `outreach-generation`.
4. Worker loads recipients in batches.
5. Worker builds context from workspace, instruction, person, organization, channels and tags.
6. Worker calls `AIService`.
7. Worker persists `GeneratedMessage`, updates recipient status and counters.
8. Final outreach status becomes `READY_FOR_REVIEW` or `FAILED` if partial errors occurred.

## Versioning

`GeneratedMessage.generationVersion` is unique per recipient. Regeneration creates a new version and sets previous active drafts inactive. This preserves auditability without exposing multiple active drafts in the review UI.

## Limits

No semantic search, no LLM filter parsing, no HTML email editor, no provider integration, no sending and no tracking are included.
