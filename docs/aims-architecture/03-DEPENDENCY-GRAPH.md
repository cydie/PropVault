# 03 — Dependency Graph

## 1. Layer dependency graph (allowed)

```mermaid
flowchart LR
  Api[Aims.Api]
  App[Aims.Application]
  Dom[Aims.Domain]
  Inf[Aims.Infrastructure]
  Con[Aims.Contracts]
  Web[Aims.Web]

  Web -->|HTTPS JSON| Api
  Api --> App
  Api --> Inf
  App --> Dom
  App --> Con
  Inf --> App
  Inf --> Dom
  Inf --> Con
```

**Rule:** Domain has zero project references outward. Infrastructure implements Domain interfaces; Application never references Infrastructure types (only abstractions).

---

## 2. Runtime dependency graph

```mermaid
flowchart TB
  Browser[Browser React App]
  CDN[Static Host / CDN]
  API[Aims.Api]
  Redis[(Redis)]
  PG[(PostgreSQL PostGIS)]
  GS[GeoServer]
  S3[(Object Storage)]
  Mail[Email Gateway]
  SMS[SMS Gateway optional]
  ProvPeer[Peer AIMS Province Node]

  Browser --> CDN
  Browser --> API
  Browser --> GS
  API --> Redis
  API --> PG
  API --> GS
  API --> S3
  API --> Mail
  API --> SMS
  API <-->|Sync protocol HTTPS mTLS| ProvPeer
```

---

## 3. Module dependency rules

```mermaid
flowchart TB
  Identity[IdentityAccess]
  Tenancy[Tenancy]
  Audit[Audit]
  Docs[Documents]
  Receiving[Receiving]
  Registry[Registry]
  GIS[GisTaxMapping]
  Inspect[Inspection]
  FAAS[AppraisalFaas]
  Assess[Assessment]
  WF[WorkflowApprovals]
  TD[TaxDeclaration]
  Sync[Sync]
  Notify[Notifications]
  Report[Reporting]

  Tenancy --> Identity
  Receiving --> Registry
  Receiving --> Docs
  Receiving --> Audit
  GIS --> Registry
  Inspect --> Registry
  Inspect --> Docs
  FAAS --> Registry
  FAAS --> Inspect
  Assess --> FAAS
  WF --> Assess
  WF --> Docs
  TD --> WF
  TD --> Docs
  Sync --> WF
  Sync --> TD
  Notify --> Identity
  Report --> Assess
  Report --> TD
  Report --> GIS
```

### Hard rules

1. **No circular module references.** Use domain events / outbox for reverse notifications.
2. **Audit** and **Documents** are leaf infrastructure-facing services consumed by others.
3. **Sync** may read Workflow + TaxDeclaration aggregates but must not own appraisal math.
4. **GIS** must not own owner identity; it references Parcel/Property IDs from Registry.

---

## 4. CQRS internal graph

```mermaid
flowchart LR
  Controller --> Mediator
  Mediator --> ValidationBehavior
  ValidationBehavior --> LoggingBehavior
  LoggingBehavior --> TransactionBehavior
  TransactionBehavior --> Handler
  Handler --> Domain
  Handler --> RepoInterface
  RepoInterface -.-> EfRepo
  Handler -->|Publish| DomainEvents
  DomainEvents --> Outbox
  Outbox --> SyncWorkers
  Outbox --> NotifyWorkers
  Outbox --> AuditWriter
```

---

## 5. Package dependency (NuGet / npm intent)

### Backend (illustrative)

| Package | Used by |
| --- | --- |
| MediatR (or equivalent mediator) | Application |
| FluentValidation | Application |
| EF Core + Npgsql + NetTopologySuite | Infrastructure |
| StackExchange.Redis | Infrastructure |
| AWSSDK.S3 / MinIO SDK | Infrastructure |
| Serilog | Api + Infrastructure |
| Swashbuckle / NSwag | Api |

### Frontend

| Package | Used by |
| --- | --- |
| React + TypeScript | Web |
| TailwindCSS | Web |
| OpenLayers | gis package |
| React Query / TanStack Query | API state |
| Zod | client validation |

---

## 6. Forbidden dependencies

| From | To | Why |
| --- | --- | --- |
| Domain | EF Core | Persistence leak |
| Application | Controllers | UI/API leak |
| Web | Database | Bypass API |
| GisTaxMapping | TaxDeclaration print templates | Wrong ownership |
| Sync | UI components | Layer violation |
