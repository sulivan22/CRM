# Epic 7 / Workspace Settings & Providers

## Objective

Move provider configuration from global environment values into one workspace-scoped settings set per workspace.

## Scope

- General workspace settings: company name, logo URL, timezone, locale.
- Workspace AI settings: provider, key, model, temperature, max tokens, enabled state.
- Workspace email settings: provider, key, domain, sender fields, enabled state.
- Settings API and UI with General, AI, and Email tabs.
- Connection test endpoints.
- Provider resolution by workspace for AI and Delivery flows.

## Out Of Scope

- Google/Microsoft connectors.
- Billing.
- Analytics.
- Multi-provider routing.

## Security

API keys are stored for provider activation but are never returned by API responses. Responses expose only `hasApiKey`.

## Defaults

New and existing workspaces default to fake AI and fake email providers.
