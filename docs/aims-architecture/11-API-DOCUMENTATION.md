# 11 — API Documentation

Base URL: `/api/v1`  
Auth: `Authorization: Bearer <access_token>`  
Idempotency: header `Idempotency-Key` on creates/sync  
Tenant: resolved from token claims (`tenant_id`)

OpenAPI will be generated from ASP.NET Core (`/swagger`). Below is the **architecture contract**.

---

## 1. Auth

| Method | Path | Description |
| --- | --- | --- |
| POST | `/auth/login` | Username/password → access + refresh |
| POST | `/auth/refresh` | Rotate refresh token |
| POST | `/auth/logout` | Revoke refresh |
| POST | `/auth/password/change` | Password policy enforced |
| POST | `/auth/2fa/setup` | 2FA-ready enrollment |
| POST | `/auth/2fa/verify` | 2FA challenge |

---

## 2. Receiving & transactions

| Method | Path | Description |
| --- | --- | --- |
| POST | `/receiving/packets` | Create receiving packet + docs |
| GET | `/receiving/packets/{id}` | Get packet |
| POST | `/transactions` | Create assessor transaction |
| GET | `/transactions` | Filter by status/type/date |
| GET | `/transactions/{id}` | Detail + current revision |
| GET | `/transactions/{id}/history` | Full revision timeline |
| POST | `/transactions/{id}/verify-documents` | Mark docs verified |
| POST | `/transactions/{id}/validate-owner` | Owner validation step |
| POST | `/transactions/{id}/validate-property` | Property validation step |
| POST | `/transactions/{id}/cancel` | Cancel with reason |

---

## 3. Registries

| Method | Path | Description |
| --- | --- | --- |
| CRUD | `/owners` | Owner registry |
| CRUD | `/properties` | Property units |
| CRUD | `/parcels` | Parcel attributes |
| GET | `/properties/lookup` | By PIN / TD / owner |

---

## 4. GIS & tax mapping

| Method | Path | Description |
| --- | --- | --- |
| GET | `/gis/parcels/search` | Search parcel/owner |
| GET | `/gis/parcels/{id}/geometry` | GeoJSON |
| POST | `/gis/parcels/draw` | Create polygon (versioned) |
| POST | `/gis/parcels/{id}/split` | Split |
| POST | `/gis/parcels/{id}/merge` | Merge |
| POST | `/gis/measure` | Area/length |
| GET | `/gis/layers` | Layer catalog |
| POST | `/taxmapping/assign-pin` | PIN assignment |
| GET | `/taxmapping/sheets/{code}` | Tax map sheet metadata |
| GET | `/gis/wms` | Proxy/catalog for GeoServer |

---

## 5. Inspection, FAAS, assessment

| Method | Path | Description |
| --- | --- | --- |
| CRUD | `/inspections` | Field inspection orders |
| POST | `/inspections/sync-batch` | Offline sync |
| POST | `/faas` | Create FAAS draft (rev 1) |
| PUT | `/faas/{id}` | Save → **new revision** |
| GET | `/faas/{id}/revisions` | List revisions |
| POST | `/faas/compute` | Compute MV/AV |
| POST | `/assessment` | Create/update assessment revision |
| GET | `/assessment/{transactionId}` | Current assessment |

---

## 6. Workflow, signature, sync

| Method | Path | Description |
| --- | --- | --- |
| POST | `/workflow/{id}/recommend` | Municipal recommendation |
| POST | `/workflow/{id}/muni-approve` | Municipal head approval |
| POST | `/workflow/{id}/muni-return` | Return for revision |
| POST | `/signatures/muni` | Municipal digital signature |
| POST | `/sync/push` | Push envelope to province |
| GET | `/sync/inbox` | Provincial inbox |
| GET | `/sync/diff` | Compare revisions |
| POST | `/workflow/{id}/prov-approve` | Provincial approval |
| POST | `/signatures/prov` | Provincial signature |
| POST | `/sync/pull-approval` | Sync back to municipality |

---

## 7. Tax declaration, documents, print, verify

| Method | Path | Description |
| --- | --- | --- |
| POST | `/tax-declarations/generate` | Generate final TD |
| POST | `/tax-declarations/{id}/release` | Release to claimant |
| POST | `/tax-declarations/{id}/print` | PDF + print history |
| POST | `/documents` | Upload (PDF/JPG/PNG/DOCX/DWG/ZIP) |
| GET | `/documents/{id}` | Metadata + versions |
| GET | `/verify/{code}` | QR verification (limited public) |

---

## 8. Admin, reports, audit, notifications

| Method | Path | Description |
| --- | --- | --- |
| CRUD | `/users` | User management |
| CRUD | `/roles` | Role management |
| GET/PUT | `/settings` | Tenant settings |
| GET | `/reports/assessment-roll` | Assessment roll |
| GET | `/reports/faas-register` | FAAS register |
| GET | `/reports/td-register` | TD register |
| GET | `/reports/pending-approvals` | Queues |
| GET | `/reports/revision-history` | Revisions |
| GET | `/audit` | Audit query |
| GET | `/notifications` | In-app notifications |
| POST | `/notifications/read` | Mark read |
| GET | `/dashboard/summary` | KPIs |

---

## 9. Standard error shape

```json
{
  "type": "https://aims.local/errors/conflict",
  "title": "Revision conflict",
  "status": 409,
  "detail": "Latest revision is 4; client sent base 3",
  "correlationId": "uuid",
  "errors": {}
}
```

---

## 10. Rate limiting (defaults)

| Area | Limit |
| --- | --- |
| Auth login | 10 / min / IP |
| Public verify | 60 / min / IP |
| Authenticated API | 600 / min / user |
| Sync push | 120 / min / tenant |
