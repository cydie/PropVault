# 02 — Folder & Project Structure

## 1. Repository layout (monorepo)

```text
aims/
├── docs/
│   └── aims-architecture/          # this pack
├── src/
│   ├── backend/
│   │   ├── Aims.sln
│   │   ├── Aims.Api/                 # Presentation - HTTP host
│   │   ├── Aims.Application/         # CQRS, Mediator handlers, validators, DTOs
│   │   ├── Aims.Domain/              # Entities, aggregates, events, repo interfaces, specs
│   │   ├── Aims.Infrastructure/      # EF Core, Redis, storage, GeoServer clients, email
│   │   ├── Aims.Contracts/           # Shared API contracts / integration events (optional)
│   │   └── Modules/                  # Optional physical module folders (feature folders)
│   │       ├── IdentityAccess/
│   │       ├── Receiving/
│   │       ├── Registry/
│   │       ├── GisTaxMapping/
│   │       ├── Inspection/
│   │       ├── AppraisalFaas/
│   │       ├── Assessment/
│   │       ├── WorkflowApprovals/
│   │       ├── TaxDeclaration/
│   │       ├── Documents/
│   │       ├── Sync/
│   │       ├── Notifications/
│   │       ├── Reporting/
│   │       ├── Audit/
│   │       └── Tenancy/
│   └── frontend/
│       ├── apps/
│       │   └── aims-web/             # React + TS + Tailwind + OpenLayers
│       └── packages/
│           ├── ui/                   # shared UI primitives
│           ├── api-client/           # OpenAPI-generated client
│           └── gis/                  # OpenLayers map kit
├── tests/
│   ├── Aims.Domain.Tests/
│   ├── Aims.Application.Tests/
│   ├── Aims.Infrastructure.Tests/
│   ├── Aims.Api.IntegrationTests/
│   └── Aims.Web.E2E/                 # optional Playwright
├── deploy/
│   ├── docker/
│   ├── k8s/                          # or compose for LGU on-prem
│   └── scripts/
└── tools/
    ├── openapi/
    └── migrations/
```

---

## 2. .NET solution projects

| Project | Type | Responsibility |
| --- | --- | --- |
| `Aims.Domain` | Class library | Aggregates, value objects, domain events, repository interfaces, specifications |
| `Aims.Application` | Class library | Commands/Queries, handlers, behaviors (validation, logging, transaction), DTOs, mapping |
| `Aims.Infrastructure` | Class library | EF Core `AimsDbContext`, repositories, PostGIS, Redis, S3, GeoServer, outbox, file checksum |
| `Aims.Api` | Web API | Controllers/Minimal APIs, auth middleware, Swagger, health, rate limiting |
| `Aims.Contracts` | Class library | Versioned integration contracts for future microservices |

### Suggested namespaces

```text
Aims.Domain.{Module}.Entities
Aims.Domain.{Module}.Events
Aims.Domain.{Module}.Repositories
Aims.Application.{Module}.Commands
Aims.Application.{Module}.Queries
Aims.Infrastructure.Persistence
Aims.Infrastructure.Gis
Aims.Infrastructure.Storage
Aims.Api.Endpoints.{Module}
```

---

## 3. Frontend structure

```text
aims-web/
├── src/
│   ├── app/                 # routing, providers, layout
│   ├── features/
│   │   ├── dashboard/
│   │   ├── receiving/
│   │   ├── registry/
│   │   ├── gis/
│   │   ├── inspection/
│   │   ├── faas/
│   │   ├── assessment/
│   │   ├── approvals/
│   │   ├── tax-declaration/
│   │   ├── documents/
│   │   ├── sync/
│   │   ├── reports/
│   │   ├── notifications/
│   │   ├── audit/
│   │   └── admin/
│   ├── shared/              # hooks, utils, components
│   └── styles/
├── public/
└── package.json
```

---

## 4. Feature folder anatomy (backend module)

```text
Modules/Receiving/
├── Domain/
│   ├── TransactionAggregate.cs
│   ├── ReceivingChecklist.cs
│   └── Events/
├── Application/
│   ├── Commands/
│   ├── Queries/
│   └── Validators/
├── Infrastructure/
│   └── Configurations/      # EF entity configs (or central Persistence)
└── Api/
    └── ReceivingEndpoints.cs
```

Composition root (`Aims.Api/Program.cs`) registers each module’s DI extension: `AddReceivingModule()`, etc.

---

## 5. Database & migration layout

```text
Aims.Infrastructure/
└── Persistence/
    ├── AimsDbContext.cs
    ├── Configurations/
    ├── Migrations/
    └── Seeds/
```

Spatial objects (views, GeoServer layer SQL) live under `deploy/gis/` and are versioned separately from EF migrations when needed.

---

## 6. Environment folders

```text
deploy/
├── docker/
│   ├── Dockerfile.api
│   ├── Dockerfile.web
│   └── docker-compose.yml      # api, web, postgres+postgis, redis, geoserver, minio
├── k8s/
└── env/
    ├── municipal.env.example
    └── provincial.env.example
```
