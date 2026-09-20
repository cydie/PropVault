# 27 — Enhancement REST API (Complete Additions)

Base: `/api/v1` · Auth Bearer · Tenant-scoped

## Property Timeline

| Method | Path | Description |
| --- | --- | --- |
| GET | `/properties/{id}/timeline` | Chronological events (filterable) |
| GET | `/properties/{id}/timeline/export` | CSV/Excel/JSON |
| POST | `/properties/{id}/timeline/print` | PDF job |

Query: `from`, `to`, `actions`, `performedBy`, `q`, `page`, `pageSize`

## Property Versioning

| Method | Path | Description |
| --- | --- | --- |
| GET | `/properties/{id}/revisions` | List revisions |
| GET | `/properties/{id}/revisions/{rev}` | Snapshot |
| POST | `/properties/{id}/revisions` | Create revision (edit) |
| POST | `/properties/{id}/rollback` | Rollback → new revision |
| GET | `/parcels/{id}/geometry/revisions` | Geometry history |
| POST | `/parcels/{id}/geometry/propose` | Propose new geometry |
| POST | `/parcels/{id}/geometry/apply` | Apply after approval |

## Spatial Conflicts

| Method | Path | Description |
| --- | --- | --- |
| POST | `/spatial/validate` | Run rules for parcel/transaction |
| GET | `/spatial/conflicts` | List conflicts |
| GET | `/spatial/conflicts/{id}` | Detail + report |
| GET | `/spatial/conflicts/{id}/report` | PDF/Excel |
| POST | `/spatial/conflicts/{id}/resolve` | GIS officer resolution |
| GET | `/spatial/conflicts/{id}/history` | Permanent history |

## Parcel Comparison

| Method | Path | Description |
| --- | --- | --- |
| POST | `/parcels/compare` | Create comparison session (oldRev vs newGeom) |
| GET | `/parcels/compare/{sessionId}` | Metrics + GeoJSON layers |
| POST | `/parcels/compare/{sessionId}/approve` | Approve apply |
| POST | `/parcels/compare/{sessionId}/reject` | Reject |

## Offline Inspection

| Method | Path | Description |
| --- | --- | --- |
| GET | `/offline/assignments` | My assigned inspections |
| GET | `/offline/packs/{assignmentId}` | Download pack |
| POST | `/offline/sync-batch` | Upload mutations |
| POST | `/offline/resolve-conflict` | Manual conflict resolution |
| GET | `/offline/sync-status` | Pending / last sync |

## Smart Search

| Method | Path | Description |
| --- | --- | --- |
| GET | `/search/smart` | Multi-field search |
| POST | `/search/spatial` | Polygon / point / map click |
| GET | `/search/qr/{code}` | QR resolve |
| GET | `/search/barcode/{code}` | Barcode resolve |

## GIS Analytics

| Method | Path | Description |
| --- | --- | --- |
| GET | `/analytics/gis/summary` | Widget KPIs |
| GET | `/analytics/gis/distributions` | Classification / land use / ownership |
| GET | `/analytics/gis/top-barangays` | By count / assessed value |
| GET | `/analytics/gis/trends` | Monthly series |
| GET | `/analytics/gis/heatmaps/{type}` | Density, classification, AV, inspection |
| GET | `/analytics/gis/maps/{theme}` | Vacant, ag, commercial, residential, public |
| POST | `/analytics/gis/export` | PDF, Excel, GeoJSON, Shapefile job |

## OpenAPI

All endpoints documented in Swagger (`/swagger`) with examples and error contracts from [11-API-DOCUMENTATION.md](11-API-DOCUMENTATION.md).
