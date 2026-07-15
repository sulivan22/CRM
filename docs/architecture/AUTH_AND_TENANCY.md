# Auth And Tenancy

## Session Flow

```mermaid
sequenceDiagram
  participant Browser
  participant API
  participant Postgres
  Browser->>API: POST /auth/login
  API->>Postgres: Read user and verify Argon2id hash
  API->>Postgres: Store SHA-256 session token hash
  API-->>Browser: HTTP-only session cookie
  Browser->>API: GET /auth/me with cookie
  API->>Postgres: Validate non-expired, non-revoked session
  API-->>Browser: Sanitized user and memberships
```

## Workspace Authorization Flow

```mermaid
flowchart TD
  Request["API request with workspaceId"] --> Auth["AuthGuard validates session"]
  Auth --> Member["WorkspaceMembershipGuard checks active membership"]
  Member --> Role["WorkspaceRolesGuard checks OWNER/ADMIN/MEMBER/VIEWER policy"]
  Role --> Handler["Controller handler"]
  Member -->|No membership| Deny["403"]
  Role -->|Insufficient role| Deny
```

## Data Relationships

```mermaid
erDiagram
  User ||--o{ Session : has
  User ||--o{ WorkspaceMembership : joins
  Workspace ||--o{ WorkspaceMembership : contains
  User ||--o{ Workspace : creates
  User ||--o{ AuditLog : acts
  Workspace ||--o{ AuditLog : scopes
```

Sessions persist the active workspace selection. All workspace endpoints verify active membership server-side and never trust a client-supplied workspace ID alone.
