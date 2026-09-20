# 16 — Architecture Review Checklist

Coding must not start until this checklist is reviewed and approved.

## Completeness

- [ ] Solution architecture & Clean Architecture layers accepted
- [ ] Folder / project structure accepted
- [ ] Dependency graph & module boundaries accepted
- [ ] Core modules & status machine accepted
- [ ] Roles & permission matrix accepted
- [ ] System flow (Receiving → Archive) accepted
- [ ] Sync & versioning rules accepted (never overwrite)
- [ ] UML / domain model accepted
- [ ] Sequence diagrams accepted
- [ ] ERD accepted (UUID, soft delete, audit columns, PostGIS)
- [ ] API surface accepted
- [ ] UI flow accepted
- [ ] GIS architecture accepted (OpenLayers / GeoServer / PostGIS / QGIS)
- [ ] Security architecture accepted
- [ ] Deployment / HA / backup / multi-tenant / offline accepted

## Design decisions to confirm before build

| # | Decision | Default in this pack | Stakeholder choice |
| --- | --- | --- | --- |
| 1 | Province always required for TD issuance? | Yes for transfer; configurable per transaction type | ________ |
| 2 | Public QR verify exposes which fields? | TD no, status, signed-at, LGU name only | ________ |
| 3 | Offline scope | Inspection + encoder only | ________ |
| 4 | Multi-tenant mode at launch | Single DB + tenant_id | ________ |
| 5 | Digital signature tech | Certificate-backed electronic approval + hash (PKI optional phase 2) | ________ |
| 6 | GeoServer write path | Reads via GeoServer; writes via API only | ________ |

## Sign-off

| Role | Name | Date | Decision |
| --- | --- | --- | --- |
| Product Owner / LGU Sponsor | | | Approved / Changes required |
| Enterprise Architect | | | Approved / Changes required |
| Security Reviewer | | | Approved / Changes required |
| GIS Architect | | | Approved / Changes required |

**Gate:** When marked **Approved**, implementation may begin module-by-module starting with IdentityAccess → Receiving → Registry → Documents → Workflow → FAAS → Sync → GIS.
