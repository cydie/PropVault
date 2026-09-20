# 19 — Spatial Database Design

## Goals

- Support **> 500,000 parcels** per tenant
- Map interactive load **< 3 seconds** (viewport tiles / vector tiles / generalized geometries)
- Automatic spatial validation before approval
- Full geometry version history

## Core spatial tables

| Table | Purpose |
| --- | --- |
| `parcels` | Current pointer (`is_current`) to active geometry version |
| `parcel_geometry_versions` | Immutable geometry revisions (Git-like) |
| `barangay_boundaries` | Reference polygons |
| `municipality_boundaries` | Reference polygons |
| `spatial_conflicts` | Detected conflict headers |
| `spatial_conflict_items` | Parcel pairs / rule hits |
| `spatial_conflict_resolutions` | GIS officer resolutions (history kept) |
| `parcel_comparison_sessions` | Old vs new compare jobs |
| `gis_tiles_cache_meta` | Optional MVT cache keys |

## Indexing strategy (R-Tree via GiST)

PostGIS GiST indexes implement R-Tree-like spatial indexing:

```sql
CREATE INDEX idx_parcel_geom_gist
  ON parcel_geometry_versions USING GIST (geom);

CREATE INDEX idx_parcel_geom_gist_valid
  ON parcel_geometry_versions USING GIST (geom)
  WHERE is_current AND ST_IsValid(geom);

CREATE INDEX idx_barangay_geom_gist
  ON barangay_boundaries USING GIST (geom);
```

### Performance patterns

| Pattern | Technique |
| --- | --- |
| Viewport queries | `&&` bbox filter then `ST_Intersects` |
| Web map | Mapbox Vector Tiles (MVT) via `ST_AsMVT` or GeoServer WMTS |
| Generalization | `ST_SimplifyPreserveTopology` for zoom < N |
| Centroid search | stored `centroid geography` + GiST |
| Duplicate detection | hash of WKB (`geom_hash`) + `ST_Equals` |
| Partitioning | optional hash/list partition by municipality for 500k+ |

## Coordinate reference

- Storage: **EPSG:4326** (or LGU-preferred projected CRS stored in settings; default document **EPSG:32651** UTM 51N for metric area if configured)
- Area/perimeter computations in projected CRS via `geography` or transform
- API always returns GeoJSON in 4326 unless requested otherwise

## Spatial performance SLA

| Metric | Target |
| --- | --- |
| Parcel identify (click) | < 200 ms p95 |
| Viewport MVT tile | < 300 ms p95 |
| Full map initial paint | < 3 s on municipal extent |
| Conflict scan (single parcel) | < 2 s |
| Nightly full conflict scan | async job, progress reported |
