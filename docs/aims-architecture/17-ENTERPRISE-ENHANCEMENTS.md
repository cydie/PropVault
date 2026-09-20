# 17 — Enterprise Enhancements Overview

## Version

| Field | Value |
| --- | --- |
| Architecture version | **1.1.0-ENHANCEMENTS** |
| Adds | Property Timeline · Spatial Conflict Detection · Interactive Parcel Comparison · Offline GIS Inspection · GIS Analytics Dashboard · Property Versioning · Smart Search · Spatial Performance |

## Document map (enhancements)

| # | Document | Purpose |
| --- | --- | --- |
| 17 | This overview | Enhancement index & module deltas |
| 18 | [Property Timeline](18-PROPERTY-TIMELINE.md) | Chronological property activity stream |
| 19 | [Spatial Database Design](19-SPATIAL-DATABASE-DESIGN.md) | PostGIS design, indexes, 500k+ scale |
| 20 | [Spatial Validation Rules](20-SPATIAL-VALIDATION-RULES.md) | Conflict types, severity, reports |
| 21 | [GIS Workflow Diagrams](21-GIS-WORKFLOW-DIAGRAMS.md) | GIS validation → approval gates |
| 22 | [Parcel Comparison UI](22-PARCEL-COMPARISON-UI.md) | Side-by-side geometry compare |
| 23 | [Offline Sync & Conflicts](23-OFFLINE-SYNC-AND-CONFLICTS.md) | Offline inspection + resolution |
| 24 | [Property Versioning](24-PROPERTY-VERSIONING.md) | Git-like property revisions |
| 25 | [Smart Search](25-SMART-SEARCH.md) | Multi-criteria + spatial search |
| 26 | [GIS Analytics Dashboard](26-GIS-ANALYTICS-DASHBOARD.md) | Executive widgets, heatmaps, exports |
| 27 | [Enhancement REST API](27-ENHANCEMENT-REST-API.md) | Complete API additions |
| 28 | [PostgreSQL/PostGIS Schema](28-POSTGRESQL-POSTGIS-SCHEMA.md) | Production schema reference |

Physical schema file: [`schema/aims_postgis_schema.sql`](../../aims/schema/aims_postgis_schema.sql)

## Module deltas

| New / extended module | Depends on |
| --- | --- |
| `PropertyTimeline` | Registry, Audit, Documents, Workflow, GIS |
| `SpatialValidation` | GisTaxMapping, Registry |
| `ParcelComparison` | GisTaxMapping, Workflow |
| `OfflineInspection` | Inspection, GIS, Documents, Sync |
| `GisAnalytics` | Reporting, GIS, Assessment |
| `PropertyVersioning` | Registry (cross-cutting) |
| `SmartSearch` | Registry, GIS, Documents |

## Coding policy (updated)

Enhancement architecture is part of the approved design pack. Implementation proceeds in phases:

1. Schema + Domain (Property Versioning, Timeline)
2. Spatial Validation + Comparison
3. Offline Inspection pack
4. Smart Search
5. GIS Analytics Dashboard
