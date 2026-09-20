# 15 — Deployment & Infrastructure

## 1. Deployment diagram

```mermaid
flowchart TB
  subgraph clients [Clients]
    Browser[Browser]
    QGIS[QGIS Desktop]
    Offline[Offline Inspection Pack]
  end

  subgraph edge [Edge]
    Ingress[TLS Ingress / Reverse Proxy]
  end

  subgraph app [Application Tier]
    Web[Aims.Web static]
    API1[Aims.Api instance]
    API2[Aims.Api instance]
    Worker[Aims.Workers Outbox Sync]
  end

  subgraph data [Data Tier]
    PG[(PostgreSQL Primary)]
    PGR[(PostgreSQL Replica)]
    Redis[(Redis)]
    S3[(Object Storage)]
    GS[GeoServer]
  end

  subgraph peer [Provincial Peer]
    PAPI[Provincial Aims.Api]
  end

  Browser --> Ingress
  Offline --> Ingress
  Ingress --> Web
  Ingress --> API1
  Ingress --> API2
  API1 --> PG
  API2 --> PG
  API1 --> Redis
  API2 --> Redis
  API1 --> S3
  API2 --> S3
  API1 --> GS
  GS --> PG
  PG --> PGR
  Worker --> PG
  Worker --> Redis
  Worker <-->|mTLS sync| PAPI
  QGIS --> PG
```

---

## 2. Infrastructure diagram (cloud-ready LGU)

```mermaid
flowchart LR
  subgraph vpc [VPC or On-Prem VLAN]
    K8S[Kubernetes or Docker Swarm or Compose]
    PGHA[Postgres HA]
    RedisHA[Redis Sentinel]
    MinIO[MinIO or S3]
    Geo[GeoServer HA]
  end
  Backup[Backup Vault]
  Monitor[Logs Metrics Traces]
  K8S --> PGHA
  K8S --> RedisHA
  K8S --> MinIO
  K8S --> Geo
  PGHA --> Backup
  MinIO --> Backup
  K8S --> Monitor
```

---

## 3. High availability

| Component | HA approach |
| --- | --- |
| API | 2+ replicas, rolling update, health probes |
| Web | CDN / multi-replica nginx |
| PostgreSQL | Primary + replica; automated failover |
| Redis | Sentinel/cluster |
| GeoServer | 2 nodes sharing PostGIS |
| Object storage | Erasure coding / cross-AZ |
| Sync workers | Competing consumers on outbox |

---

## 4. Backup & restore

| Schedule | Scope |
| --- | --- |
| Daily | Incremental DB + object changelog |
| Weekly | Full DB dump + object snapshot |
| Monthly | Archive freeze to cold storage |

**Restore Wizard** (Admin UI): select backup → validate checksum → restore to staging → promote.

---

## 5. Multi-tenant readiness

- `tenant_id` on all aggregates
- Municipal tenant ↔ Provincial tenant pairing in settings
- Future: schema-per-tenant or database-per-large-city without rewriting domain

---

## 6. Offline readiness

- Inspection/encoder offline pack caches assigned work
- Local encrypted queue
- Sync-batch endpoint with conflict protocol
- Read-only SMV tables packaged for field use

---

## 7. Environments

| Env | Purpose |
| --- | --- |
| Dev | Local compose |
| UAT | LGU UAT with anonymized data |
| Staging | Prod-like HA |
| Prod Municipal | Live municipal node |
| Prod Provincial | Live provincial node |

---

## 8. Observability

- Structured logs (Serilog) with CorrelationId
- Metrics: request rate, sync lag, queue depth
- Traces: OpenTelemetry
- Alerts: sync failure, disk, DB failover, certificate expiry
