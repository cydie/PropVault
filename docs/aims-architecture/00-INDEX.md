# AIMS — Assessor Information Management System

## Enterprise Architecture Documentation Pack

| Field | Value |
| --- | --- |
| Product | **AIMS** (Assessor Information Management System) |
| Domain | Philippine LGU Real Property Appraisal & Assessment |
| Architecture | Clean Architecture · Modular Monolith · Cloud Native · Microservice-ready |
| Stack | React + TypeScript + Tailwind · ASP.NET Core · EF Core · PostgreSQL/PostGIS · GeoServer · Redis · Object Storage |
| Status | **Architecture only** — no application code until review sign-off |
| Version | 1.0.0-DRAFT |
| Classification | Original design based on standard LGU assessor processes (RA 7160 / BLGF RPA practices). Not a reproduction of any proprietary commercial product. |

---

## Document Map

| # | Document | Purpose |
| --- | --- | --- |
| 01 | [Solution Architecture](01-SOLUTION-ARCHITECTURE.md) | Mission, principles, Clean Architecture layers, modular monolith boundaries |
| 02 | [Folder & Project Structure](02-FOLDER-AND-PROJECT-STRUCTURE.md) | Solution tree, project names, module packages |
| 03 | [Dependency Graph](03-DEPENDENCY-GRAPH.md) | Layer and module dependency rules |
| 04 | [Core Modules](04-CORE-MODULES.md) | Module catalog, responsibilities, bounded contexts |
| 05 | [Roles & Permission Matrix](05-ROLES-AND-PERMISSIONS.md) | RBAC roles and permission matrix |
| 06 | [System Flow](06-SYSTEM-FLOW.md) | End-to-end assessor transaction flow |
| 07 | [Sync & Versioning](07-SYNC-AND-VERSIONING.md) | Municipal ↔ Provincial sync, revisions, immutability |
| 08 | [UML Class Model](08-UML-CLASS-MODEL.md) | Domain UML (entities & aggregates) |
| 09 | [Sequence Diagrams](09-SEQUENCE-DIAGRAMS.md) | Key use-case sequences |
| 10 | [ERD](10-ERD.md) | Logical/physical data model |
| 11 | [API Documentation](11-API-DOCUMENTATION.md) | REST API surface (OpenAPI-oriented) |
| 12 | [UI Flow](12-UI-FLOW.md) | Presentation flows by role |
| 13 | [GIS Architecture](13-GIS-ARCHITECTURE.md) | OpenLayers · GeoServer · PostGIS · QGIS |
| 14 | [Security Architecture](14-SECURITY-ARCHITECTURE.md) | AuthN/Z, audit, encryption, 2FA-ready |
| 15 | [Deployment & Infrastructure](15-DEPLOYMENT-AND-INFRASTRUCTURE.md) | Cloud, HA, backup, offline, multi-tenant |
| 16 | [Architecture Review Checklist](16-ARCHITECTURE-REVIEW-CHECKLIST.md) | Sign-off gate before coding |

---

## Non-Goals (this pack)

- No source code generation
- No imitation of proprietary commercial assessor products
- No production deployment until architecture review is approved

## Review Gate

Coding may begin only after [16-ARCHITECTURE-REVIEW-CHECKLIST.md](16-ARCHITECTURE-REVIEW-CHECKLIST.md) is marked **Approved**.
