# 04 — Core Modules

## Module catalog

| Module | Code | Responsibility |
| --- | --- | --- |
| Dashboard | `dashboard` | KPIs: pending receive, pending appraisal, pending muni/province approval, releases |
| Receiving | `receiving` | Logbook, checklist, document intake, create Transaction |
| Property Registry | `registry.property` | Real property units (land, building, machinery, plants) |
| Owner Registry | `registry.owner` | Persons/entities, SPA, contact, ownership links |
| Parcel Registry | `registry.parcel` | PIN, lot/survey refs, link to spatial parcel |
| GIS | `gis` | Layers, search, draw, split/merge, measure, GPS, print map |
| Tax Mapping | `taxmapping` | Tax map sheets, PIN assignment, control rolls |
| Inspection | `inspection` | Field orders, findings, photos, geotags |
| Appraisal | `appraisal` | Land/building valuation against SMV / schedules |
| FAAS | `faas` | Field Appraisal and Assessment Sheet drafts & versions |
| Assessment | `assessment` | Assessed values, effectivity, classification |
| Recommendation | `workflow.recommend` | Municipal recommending approval |
| Approval | `workflow.approve` | Municipal & Provincial head approvals |
| Tax Declaration | `taxdeclaration` | Generate/print/release TD + Notice of Assessment |
| Document Management | `documents` | Upload, version, checksum, QR, archive |
| Printing | `printing` | PDF government paper, barcode, watermark, print history |
| QR Verification | `verify` | Public/internal verify endpoint for docs & signatures |
| Digital Signature | `signature` | Sign events, cert info, timestamps |
| Audit Logs | `audit` | Immutable event store |
| Reports | `reports` | Rolls, registers, revision history, GIS stats |
| Notification Center | `notifications` | In-app, email, SMS-ready, push |
| Synchronization | `sync` | Municipal ↔ Provincial revision protocol |
| Province Portal | `province` | Provincial queue, compare revisions, approve |
| User Management | `identity.users` | CRUD users, lockout, password policy |
| Role Management | `identity.roles` | Roles + permission matrix |
| API | `platform.api` | Versioned REST, OpenAPI, rate limits |
| Settings | `tenancy.settings` | LGU identity, SMV refs, fees, feature flags |

---

## Aggregate ownership (high level)

| Aggregate root | Module | Notes |
| --- | --- | --- |
| `AssessorTransaction` | Receiving | Spine of the workflow; status machine |
| `Owner` | Registry | Natural/juridical person |
| `PropertyUnit` | Registry | Land/Building/Machinery/Plants |
| `Parcel` | Registry + GIS | Attribute + geometry (geometry in PostGIS) |
| `InspectionOrder` | Inspection | Links to transaction |
| `FaasSheet` | FAAS | Versioned; never overwrite |
| `AssessmentRecord` | Assessment | Derived from FAAS |
| `ApprovalPacket` | Workflow | Municipal + Provincial signatures |
| `TaxDeclaration` | TaxDeclaration | Final artifact + print history |
| `DocumentObject` | Documents | Blob + checksum + versions |
| `SyncEnvelope` | Sync | Revision payload between tenants |
| `AuditEvent` | Audit | Append-only |

---

## Transaction status machine (summary)

See [06-SYSTEM-FLOW.md](06-SYSTEM-FLOW.md) for full detail.

```text
Received → DocsVerified → TransactionOpen → OwnerValidated → PropertyValidated
→ GisValidated → TaxMapped → Inspected → FaasDraft → Appraised
→ Assessed → MuniRecommended → MuniApproved → MuniSigned
→ SyncedToProvince → ProvinceInReview → ProvinceApproved → ProvinceSigned
→ SyncedBack → TdGenerated → Released → Archived
```

Terminal negatives: `Rejected`, `Cancelled`, `ReturnedForRevision` (loops to editable municipal states while allowed).
