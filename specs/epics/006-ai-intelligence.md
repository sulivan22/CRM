# Epic 6 / AI Intelligence

## Objective

Convert AI Outreach OS into an AI-assisted operator with workspace-scoped AI execution logs, insights, and UI panels.

## Scope

- `packages/ai` provider abstraction with `FakeAIProvider` default and `OpenAIProvider` ready for `AI_PROVIDER=openai`.
- Prompt templates and context building for people and inbox conversations.
- `AIExecution` and `AIInsight` persistence via migration `0008_ai_intelligence`.
- BullMQ queue `ai-processing`.
- Workspace-scoped AI endpoints for generate, summarize, extract, and next-action suggestion.
- Inbox and People AI panels.

## Out Of Scope

- Agents.
- RAG.
- Browser automation.
- CRM pipelines.
- Billing.
- Analytics.

## Activation

The default provider is `AI_PROVIDER=fake`. OpenAI is only active when `AI_PROVIDER=openai` and `OPENAI_API_KEY` is configured. Builds, tests, migrations, and Docker startup do not require an OpenAI key.
