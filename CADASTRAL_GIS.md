# Cadastral GIS Module — ResQ Track

Professional cadastral mapping for digitizing survey plans, managing land parcels, and generating printable cadastral reports. Built on **PostgreSQL + PostGIS**, **Express**, and **React + Leaflet**.

## Access

- App navigation: **Cadastral** (desktop sidebar) or **GIS** (mobile bottom nav)
- URL shortcut: `?view=cadastral`

## Database (PostGIS)

Docker image: `postgis/postgis:16-3.4-alpine` (see `docker-compose.yml`).

Schema file: `server/src/db/schema-cadastral.sql`

| Table | Purpose |
|-------|---------|
| `gis_parcels` | Land parcels with `GEOMETRY(Polygon, 4326)` |
| `gis_parcel_vertices` | Corner points, bearings, distances |
| `gis_owners` | Owner registry (linked via `owner_id`) |
| `gis_survey_records` | Scanned plans, georeferencing, workflow state |
| `gis_contour_lines` | Elevation/contour linework |
| `gis_annotations` | Map notes, monuments, labels |
| `gis_map_layers` | Per-tenant layer visibility & style |
| `gis_audit_log` | GIS operator audit trail |

### Parcel fields

`parcel_id`, `lot_number`, `title_number`, `owner_name`, `area_sq_m`, `barangay`, `municipality`, `province`, `status`, `geometry`, `tax_declaration_no`, timestamps.

## API (`/api/cadastral`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/parcels` | GET | GeoJSON FeatureCollection |
| `/parcels/:id` | GET | Detail + vertices + adjacent lots + survey history |
| `/parcels` | POST | Create parcel (Staff+) |
| `/parcels/:id` | PUT | Update geometry/metadata |
| `/parcels/:id` | DELETE | Remove parcel |
| `/parcels/search?q=` | GET | Search lot, owner, title, barangay |
| `/parcels/from-bearings` | POST | Plot from bearing-distance traverse |
| `/parcels/merge` | POST | Merge parcels (PostGIS `ST_Union`) |
| `/parcels/:id/split` | POST | Split into new parcels |
| `/import/geojson` | POST | Import GeoJSON |
| `/import/csv` | POST | CSV with lat/lng columns (multipart) |
| `/import/kml` | POST | KML import |
| `/import/dxf` | POST | Basic DXF polyline parser |
| `/contours` | GET | Contour GeoJSON |
| `/contours/import` | POST | Import contour LineStrings |
| `/survey-records` | POST | Upload scanned plan (multipart) |
| `/survey-records/:id/georef` | PUT | Affine georeference (GCPs) |
| `/reports/parcel/:id` | GET | Printable report data |
| `/inspect?lat=&lng=` | GET | Parcel at coordinate |
| `/layers` | GET/PUT | Layer toggles |
| `/audit` | GET | Audit log (Admin) |

Auth: existing JWT + tenant scoping. Mutations require `STAFF`, `MUNICIPALITY_ADMIN`, or `OWNER_SUPER_ADMIN`.

## Frontend

```
src/app/components/cadastral/
  CadastralGisView.tsx      # Main map + tools
  ParcelDetailPanel.tsx     # Lot info, coordinates, adjacent lots
  DigitizeToolbar.tsx       # Trace, edit, measure, import
  SurveyWorkflowPanel.tsx   # 5-step survey plan workflow
  CadastralSearchBar.tsx    # Search by lot/owner/title

src/app/lib/cadastralApi.ts # API client
```

### Map features

- **Base layers:** Satellite (Esri), Street (OSM), Terrain (OpenTopoMap)
- **Overlays:** Parcel boundaries, lot labels, contour lines
- **Tools:** Trace polygon, edit vertices, measure, bearing-distance plot
- **Survey workflow:** Upload → georeference (affine GCPs) → digitize → metadata → save

### Digitizing

Uses `@geoman-io/leaflet-geoman-free` with snap-to-vertex, auto-close polygon on double-click.

### Reports

Click a parcel → **Generate printable report** → opens HTML with north arrow legend stub → Print / Save as PDF.

## Setup

```powershell
# Full stack — Postgres stays inside Docker (no local DB password)
docker compose up --build
```

Open http://localhost:8081 and use **Cadastral GIS** from the sidebar.

Open **Cadastral GIS** from the sidebar.

## Import formats

| Format | Method |
|--------|--------|
| GeoJSON | Import tool or `POST /import/geojson` |
| CSV | `lot_number,lat,lng` columns |
| KML | Import tool |
| DXF | Basic parser; for complex CAD use QGIS → GeoJSON |
| Shapefile | Export to GeoJSON via QGIS (recommended) |

## QGIS / GDAL workflow

1. Prepare data in QGIS (reproject to EPSG:4326)
2. Export layers as GeoJSON
3. Import via **Import** tool in Cadastral GIS
4. For scanned plans: georeference in-app or in QGIS, then trace boundaries

## Roles & security

- **Viewer:** Read-only map and search
- **Staff / Admin:** Digitize, import, edit parcels
- **Audit log:** All create/import/update actions logged in `gis_audit_log`
- Tenant isolation: all queries scoped by `client_id`

## Feature toggle

`feature_toggles.cadastral_gis` (default `true`) per municipality.

## Offline / PWA

Cadastral data is online-first (PostGIS). For field use without connectivity, open the module once while online to cache map tiles; parcel edits require API connectivity.

## Known limitations / roadmap

- Shapefile direct upload: use QGIS → GeoJSON export
- Full 3D terrain: contour lines supported; 3D view planned
- Georeferenced image overlay on map: transform stored; image overlay rendering in progress
- UTM ↔ WGS84: store as WGS84; use QGIS/GDAL for bulk reprojection
