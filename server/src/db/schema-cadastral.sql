-- Cadastral GIS module (PostGIS) — PropVault
-- FAAS Form 1-A, Plan of Land, Section Index / Property ID Map

CREATE EXTENSION IF NOT EXISTS postgis;

-- ── Owners ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gis_owners (
  id                  SERIAL PRIMARY KEY,
  name                TEXT NOT NULL,
  address             TEXT NOT NULL DEFAULT '',
  contact_phone       TEXT NOT NULL DEFAULT '',
  tax_declaration_no  TEXT NOT NULL DEFAULT '',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gis_owners_name ON gis_owners (name);

-- ── Survey plans (Plan of Land) ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gis_survey_plans (
  id                  SERIAL PRIMARY KEY,
  plan_title          TEXT NOT NULL DEFAULT '',
  cadastre_no         TEXT NOT NULL DEFAULT '',
  survey_no           TEXT NOT NULL DEFAULT '',
  project_no          TEXT NOT NULL DEFAULT '',
  sheet_no            TEXT NOT NULL DEFAULT '',
  total_sheets        INTEGER NOT NULL DEFAULT 1,
  scale               TEXT NOT NULL DEFAULT '1:4000',
  barangay            TEXT NOT NULL DEFAULT '',
  municipality        TEXT NOT NULL DEFAULT 'Jose P. Rizal',
  province            TEXT NOT NULL DEFAULT 'Palawan',
  island              TEXT NOT NULL DEFAULT 'Palawan',
  total_area_sq_m     DOUBLE PRECISION,
  survey_date_start   DATE,
  survey_date_end     DATE,
  surveyor            TEXT NOT NULL DEFAULT '',
  surveying_office    TEXT NOT NULL DEFAULT '',
  coordinate_system   TEXT NOT NULL DEFAULT 'PRS92 / EPSG:3123',
  notes               TEXT NOT NULL DEFAULT '',
  plan_file_path      TEXT NOT NULL DEFAULT '',
  plan_mime_type      TEXT NOT NULL DEFAULT '',
  georef_transform    JSONB NOT NULL DEFAULT '{}'::jsonb,
  control_points      JSONB NOT NULL DEFAULT '[]'::jsonb,
  approval_status     TEXT NOT NULL DEFAULT 'draft'
                        CHECK (approval_status IN ('draft', 'submitted', 'verified', 'approved', 'rejected')),
  submitted_at        TIMESTAMPTZ,
  verified_by         TEXT NOT NULL DEFAULT '',
  verified_at         TIMESTAMPTZ,
  approved_by         TEXT NOT NULL DEFAULT '',
  approved_at         TIMESTAMPTZ,
  created_by          TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gis_survey_plans_barangay ON gis_survey_plans (barangay);
CREATE INDEX IF NOT EXISTS idx_gis_survey_plans_cadastre ON gis_survey_plans (cadastre_no);

CREATE TABLE IF NOT EXISTS gis_survey_sheets (
  id                  SERIAL PRIMARY KEY,
  survey_plan_id      INTEGER NOT NULL REFERENCES gis_survey_plans(id) ON DELETE CASCADE,
  sheet_no            TEXT NOT NULL DEFAULT '1',
  title               TEXT NOT NULL DEFAULT '',
  file_path           TEXT NOT NULL DEFAULT '',
  mime_type           TEXT NOT NULL DEFAULT '',
  georef_transform    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gis_survey_sheets_plan ON gis_survey_sheets (survey_plan_id);

-- ── Parcels / lots ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gis_parcels (
  id                  SERIAL PRIMARY KEY,
  parcel_id           TEXT NOT NULL UNIQUE,
  lot_number          TEXT NOT NULL,
  title_number        TEXT NOT NULL DEFAULT '',
  owner_id            INTEGER REFERENCES gis_owners(id) ON DELETE SET NULL,
  owner_name          TEXT NOT NULL DEFAULT '',
  area_sq_m           DOUBLE PRECISION,
  barangay            TEXT NOT NULL DEFAULT '',
  municipality        TEXT NOT NULL DEFAULT '',
  province            TEXT NOT NULL DEFAULT '',
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'pending', 'disputed', 'archived')),
  tax_declaration_no  TEXT NOT NULL DEFAULT '',
  geometry            GEOMETRY(Polygon, 4326),
  properties          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE gis_parcels ADD COLUMN IF NOT EXISTS survey_plan_id INTEGER REFERENCES gis_survey_plans(id) ON DELETE SET NULL;
ALTER TABLE gis_parcels ADD COLUMN IF NOT EXISTS section_no TEXT NOT NULL DEFAULT '';
ALTER TABLE gis_parcels ADD COLUMN IF NOT EXISTS blk_no TEXT NOT NULL DEFAULT '';
ALTER TABLE gis_parcels ADD COLUMN IF NOT EXISTS oct_no TEXT NOT NULL DEFAULT '';
ALTER TABLE gis_parcels ADD COLUMN IF NOT EXISTS arp_no TEXT NOT NULL DEFAULT '';
ALTER TABLE gis_parcels ADD COLUMN IF NOT EXISTS pin TEXT NOT NULL DEFAULT '';
ALTER TABLE gis_parcels ADD COLUMN IF NOT EXISTS survey_no TEXT NOT NULL DEFAULT '';
ALTER TABLE gis_parcels ADD COLUMN IF NOT EXISTS bound_north TEXT NOT NULL DEFAULT '';
ALTER TABLE gis_parcels ADD COLUMN IF NOT EXISTS bound_east TEXT NOT NULL DEFAULT '';
ALTER TABLE gis_parcels ADD COLUMN IF NOT EXISTS bound_south TEXT NOT NULL DEFAULT '';
ALTER TABLE gis_parcels ADD COLUMN IF NOT EXISTS bound_west TEXT NOT NULL DEFAULT '';
ALTER TABLE gis_parcels ADD COLUMN IF NOT EXISTS street TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_gis_parcels_lot ON gis_parcels (lot_number);
CREATE INDEX IF NOT EXISTS idx_gis_parcels_title ON gis_parcels (title_number);
CREATE INDEX IF NOT EXISTS idx_gis_parcels_barangay ON gis_parcels (barangay);
CREATE INDEX IF NOT EXISTS idx_gis_parcels_pin ON gis_parcels (pin);
CREATE INDEX IF NOT EXISTS idx_gis_parcels_section ON gis_parcels (section_no);
CREATE INDEX IF NOT EXISTS idx_gis_parcels_plan ON gis_parcels (survey_plan_id);
CREATE INDEX IF NOT EXISTS idx_gis_parcels_geom ON gis_parcels USING GIST (geometry);

CREATE TABLE IF NOT EXISTS gis_parcel_vertices (
  id            SERIAL PRIMARY KEY,
  parcel_id     INTEGER NOT NULL REFERENCES gis_parcels(id) ON DELETE CASCADE,
  sequence_no   INTEGER NOT NULL,
  northing      DOUBLE PRECISION,
  easting       DOUBLE PRECISION,
  latitude      DOUBLE PRECISION NOT NULL,
  longitude     DOUBLE PRECISION NOT NULL,
  bearing       TEXT,
  distance_m    DOUBLE PRECISION,
  label         TEXT NOT NULL DEFAULT '',
  UNIQUE (parcel_id, sequence_no)
);

ALTER TABLE gis_parcel_vertices ADD COLUMN IF NOT EXISTS monument TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_gis_parcel_vertices_parcel ON gis_parcel_vertices (parcel_id);

-- Legacy per-parcel survey upload (kept for digitize workflow)
CREATE TABLE IF NOT EXISTS gis_survey_records (
  id                  SERIAL PRIMARY KEY,
  parcel_id           INTEGER REFERENCES gis_parcels(id) ON DELETE SET NULL,
  survey_no           TEXT NOT NULL DEFAULT '',
  surveyor            TEXT NOT NULL DEFAULT '',
  survey_date         DATE,
  plan_file_path      TEXT NOT NULL DEFAULT '',
  plan_mime_type      TEXT NOT NULL DEFAULT '',
  georef_transform    JSONB NOT NULL DEFAULT '{}'::jsonb,
  control_points      JSONB NOT NULL DEFAULT '[]'::jsonb,
  coordinate_system   TEXT NOT NULL DEFAULT 'EPSG:4326',
  notes               TEXT NOT NULL DEFAULT '',
  workflow_step       TEXT NOT NULL DEFAULT 'upload'
                        CHECK (workflow_step IN ('upload', 'georeference', 'digitize', 'metadata', 'complete')),
  created_by          TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE gis_survey_records ADD COLUMN IF NOT EXISTS survey_plan_id INTEGER REFERENCES gis_survey_plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_gis_survey_records_parcel ON gis_survey_records (parcel_id);

CREATE TABLE IF NOT EXISTS gis_contour_lines (
  id            SERIAL PRIMARY KEY,
  elevation_m   DOUBLE PRECISION NOT NULL,
  interval_m    DOUBLE PRECISION NOT NULL DEFAULT 5,
  geometry      GEOMETRY(LineString, 4326) NOT NULL,
  source        TEXT NOT NULL DEFAULT 'import',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gis_contour_geom ON gis_contour_lines USING GIST (geometry);

CREATE TABLE IF NOT EXISTS gis_annotations (
  id                SERIAL PRIMARY KEY,
  parcel_id         INTEGER REFERENCES gis_parcels(id) ON DELETE CASCADE,
  label             TEXT NOT NULL DEFAULT '',
  annotation_type   TEXT NOT NULL DEFAULT 'note'
                      CHECK (annotation_type IN ('note', 'corner', 'monument', 'label', 'boundary')),
  geometry          GEOMETRY(Point, 4326) NOT NULL,
  properties        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Section Index / Assessor Property ID Map layers ──────────────────────────

CREATE TABLE IF NOT EXISTS gis_admin_boundaries (
  id              SERIAL PRIMARY KEY,
  boundary_type   TEXT NOT NULL
                    CHECK (boundary_type IN ('municipality', 'barangay', 'section')),
  name            TEXT NOT NULL,
  code            TEXT NOT NULL DEFAULT '',
  parent_name     TEXT NOT NULL DEFAULT '',
  barangay        TEXT NOT NULL DEFAULT '',
  municipality    TEXT NOT NULL DEFAULT 'Jose P. Rizal',
  province        TEXT NOT NULL DEFAULT 'Palawan',
  geometry        GEOMETRY(MultiPolygon, 4326) NOT NULL,
  properties      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gis_admin_boundaries_type ON gis_admin_boundaries (boundary_type);
CREATE INDEX IF NOT EXISTS idx_gis_admin_boundaries_geom ON gis_admin_boundaries USING GIST (geometry);

CREATE TABLE IF NOT EXISTS gis_map_features (
  id              SERIAL PRIMARY KEY,
  feature_type    TEXT NOT NULL
                    CHECK (feature_type IN ('shoreline', 'river', 'road', 'creek', 'other')),
  name            TEXT NOT NULL DEFAULT '',
  barangay        TEXT NOT NULL DEFAULT '',
  geometry        GEOMETRY(Geometry, 4326) NOT NULL,
  properties      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gis_map_features_type ON gis_map_features (feature_type);
CREATE INDEX IF NOT EXISTS idx_gis_map_features_geom ON gis_map_features USING GIST (geometry);

-- ── Map layer legend ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gis_map_layers (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  layer_type    TEXT NOT NULL,
  visible       BOOLEAN NOT NULL DEFAULT true,
  z_index       INTEGER NOT NULL DEFAULT 0,
  style         JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_url    TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Drop old restrictive check if present, then allow section-index types
DO $$
BEGIN
  ALTER TABLE gis_map_layers DROP CONSTRAINT IF EXISTS gis_map_layers_layer_type_check;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

CREATE TABLE IF NOT EXISTS gis_audit_log (
  id            BIGSERIAL PRIMARY KEY,
  user_id       TEXT REFERENCES users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  entity_type   TEXT NOT NULL DEFAULT '',
  entity_id     INTEGER,
  detail        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gis_audit_time ON gis_audit_log (created_at DESC);

-- ── FAAS Form 1-A ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS faas_land_sheets (
  id                      SERIAL PRIMARY KEY,
  parcel_id               INTEGER REFERENCES gis_parcels(id) ON DELETE SET NULL,
  land_property_id        TEXT,
  td_no                   TEXT NOT NULL DEFAULT '',
  pin                     TEXT NOT NULL DEFAULT '',
  arp_no                  TEXT NOT NULL DEFAULT '',
  oct_no                  TEXT NOT NULL DEFAULT '',
  survey_no               TEXT NOT NULL DEFAULT '',
  lot_no                  TEXT NOT NULL DEFAULT '',
  blk_no                  TEXT NOT NULL DEFAULT '',
  entry_date              DATE,
  owner_name              TEXT NOT NULL DEFAULT '',
  owner_address           TEXT NOT NULL DEFAULT '',
  owner_phone             TEXT NOT NULL DEFAULT '',
  admin_name              TEXT NOT NULL DEFAULT '',
  admin_address           TEXT NOT NULL DEFAULT '',
  admin_phone             TEXT NOT NULL DEFAULT '',
  street                  TEXT NOT NULL DEFAULT '',
  barangay                TEXT NOT NULL DEFAULT '',
  municipality            TEXT NOT NULL DEFAULT 'Jose P. Rizal',
  province                TEXT NOT NULL DEFAULT 'Palawan',
  bound_north             TEXT NOT NULL DEFAULT '',
  bound_east              TEXT NOT NULL DEFAULT '',
  bound_south             TEXT NOT NULL DEFAULT '',
  bound_west              TEXT NOT NULL DEFAULT '',
  -- Value adjustments
  base_market_value       DOUBLE PRECISION NOT NULL DEFAULT 0,
  adj_road_frontage_pct   DOUBLE PRECISION NOT NULL DEFAULT 0,
  adj_distance_road_km    DOUBLE PRECISION NOT NULL DEFAULT 0,
  adj_distance_road_pct   DOUBLE PRECISION NOT NULL DEFAULT 0,
  adj_distance_market_km  DOUBLE PRECISION NOT NULL DEFAULT 0,
  adj_distance_market_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_adjustments_pct   DOUBLE PRECISION NOT NULL DEFAULT 0,
  adjusted_market_value   DOUBLE PRECISION NOT NULL DEFAULT 0,
  assessment_level_pct    DOUBLE PRECISION NOT NULL DEFAULT 20,
  assessed_value          DOUBLE PRECISION NOT NULL DEFAULT 0,
  tax_status              TEXT NOT NULL DEFAULT 'taxable'
                            CHECK (tax_status IN ('taxable', 'exempt')),
  actual_use              TEXT NOT NULL DEFAULT '',
  -- Approval
  appraised_by            TEXT NOT NULL DEFAULT '',
  appraised_date          DATE,
  recommending_approval   TEXT NOT NULL DEFAULT '',
  recommending_date       DATE,
  approved_by             TEXT NOT NULL DEFAULT '',
  approved_date           DATE,
  memoranda               TEXT NOT NULL DEFAULT '',
  -- Superseded / back taxes
  prev_assessed_value     DOUBLE PRECISION,
  prev_owner              TEXT NOT NULL DEFAULT '',
  effectivity_date        DATE,
  recorded_by             TEXT NOT NULL DEFAULT '',
  back_tax_assessed_value DOUBLE PRECISION,
  back_tax_year_from      INTEGER,
  back_tax_year_to        INTEGER,
  status                  TEXT NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'appraised', 'recommended', 'approved', 'superseded')),
  created_by              TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_faas_land_pin ON faas_land_sheets (pin);
CREATE INDEX IF NOT EXISTS idx_faas_land_td ON faas_land_sheets (td_no);
CREATE INDEX IF NOT EXISTS idx_faas_land_parcel ON faas_land_sheets (parcel_id);

CREATE TABLE IF NOT EXISTS faas_land_appraisal_rows (
  id                SERIAL PRIMARY KEY,
  sheet_id          INTEGER NOT NULL REFERENCES faas_land_sheets(id) ON DELETE CASCADE,
  sequence_no       INTEGER NOT NULL DEFAULT 1,
  classification    TEXT NOT NULL DEFAULT '',
  sub_class         TEXT NOT NULL DEFAULT '',
  actual_use        TEXT NOT NULL DEFAULT '',
  area              DOUBLE PRECISION NOT NULL DEFAULT 0,
  unit_value        DOUBLE PRECISION NOT NULL DEFAULT 0,
  base_market_value DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_faas_land_rows_sheet ON faas_land_appraisal_rows (sheet_id);

CREATE TABLE IF NOT EXISTS faas_plants_trees_rows (
  id                SERIAL PRIMARY KEY,
  sheet_id          INTEGER NOT NULL REFERENCES faas_land_sheets(id) ON DELETE CASCADE,
  sequence_no       INTEGER NOT NULL DEFAULT 1,
  kind              TEXT NOT NULL DEFAULT '',
  total_count       INTEGER NOT NULL DEFAULT 0,
  fruit_bearing     INTEGER NOT NULL DEFAULT 0,
  non_fruit_bearing INTEGER NOT NULL DEFAULT 0,
  unit_price        DOUBLE PRECISION NOT NULL DEFAULT 0,
  base_market_value DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_faas_plants_rows_sheet ON faas_plants_trees_rows (sheet_id);

CREATE TABLE IF NOT EXISTS faas_assessment_history (
  id                      SERIAL PRIMARY KEY,
  sheet_id                INTEGER NOT NULL REFERENCES faas_land_sheets(id) ON DELETE CASCADE,
  previous_assessed_value DOUBLE PRECISION,
  previous_owner          TEXT NOT NULL DEFAULT '',
  effectivity_date        DATE,
  recorded_by             TEXT NOT NULL DEFAULT '',
  notes                   TEXT NOT NULL DEFAULT '',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_faas_history_sheet ON faas_assessment_history (sheet_id);

-- ── Default legend (Section Index symbology) ─────────────────────────────────

INSERT INTO gis_map_layers (name, layer_type, visible, z_index, style)
VALUES
  ('Satellite', 'satellite', true, 0, '{"opacity":1}'),
  ('Street Map', 'street', false, 1, '{"opacity":0.9}'),
  ('Terrain', 'terrain', false, 2, '{"opacity":0.85}'),
  ('Parcel Boundaries', 'parcels', true, 10, '{"color":"#1e3a8a","weight":1.5,"fillOpacity":0.12}'),
  ('Contour Lines', 'contours', false, 8, '{"color":"#8B4513","weight":1}'),
  ('Section Boundary', 'section', true, 12, '{"color":"#000000","weight":1,"dashArray":null}'),
  ('Barangay Boundary', 'barangay', true, 14, '{"color":"#000000","weight":2,"dashArray":"8 4 2 4"}'),
  ('Municipal Boundary', 'municipality', true, 16, '{"color":"#000000","weight":3,"dashArray":"12 4 2 4"}'),
  ('Shoreline', 'shoreline', true, 6, '{"color":"#1d4ed8","weight":2,"dashArray":null}'),
  ('River / Creek', 'river', true, 7, '{"color":"#2563eb","weight":2}'),
  ('Roads', 'road', true, 9, '{"color":"#78716c","weight":2,"dashArray":"6 4"}')
ON CONFLICT (name) DO NOTHING;

-- -- Assessor Tax Map / Ownership indexing ------------------------------------

ALTER TABLE gis_parcels ADD COLUMN IF NOT EXISTS assessor_lot_no TEXT NOT NULL DEFAULT '';
ALTER TABLE gis_parcels ADD COLUMN IF NOT EXISTS survey_lot_no TEXT NOT NULL DEFAULT '';
ALTER TABLE gis_parcels ADD COLUMN IF NOT EXISTS land_type_class TEXT NOT NULL DEFAULT '';
ALTER TABLE gis_parcels ADD COLUMN IF NOT EXISTS class_code TEXT NOT NULL DEFAULT '';
ALTER TABLE gis_parcels ADD COLUMN IF NOT EXISTS kind_code TEXT NOT NULL DEFAULT '0001';
ALTER TABLE gis_parcels ADD COLUMN IF NOT EXISTS barangay_index TEXT NOT NULL DEFAULT '';
ALTER TABLE gis_parcels ADD COLUMN IF NOT EXISTS title_area TEXT NOT NULL DEFAULT '';
ALTER TABLE gis_parcels ADD COLUMN IF NOT EXISTS has_building BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE gis_parcels ADD COLUMN IF NOT EXISTS has_machinery BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE gis_parcels ADD COLUMN IF NOT EXISTS has_plants BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE gis_parcels ADD COLUMN IF NOT EXISTS has_special BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE gis_parcels ADD COLUMN IF NOT EXISTS remarks TEXT NOT NULL DEFAULT '';

ALTER TABLE faas_land_sheets ADD COLUMN IF NOT EXISTS assessor_lot_no TEXT NOT NULL DEFAULT '';
ALTER TABLE faas_land_sheets ADD COLUMN IF NOT EXISTS kind_code TEXT NOT NULL DEFAULT '0001';
ALTER TABLE faas_land_sheets ADD COLUMN IF NOT EXISTS land_type_class TEXT NOT NULL DEFAULT '';
ALTER TABLE faas_land_sheets ADD COLUMN IF NOT EXISTS effectivity_year INTEGER;
ALTER TABLE faas_land_sheets ADD COLUMN IF NOT EXISTS previous_arp TEXT NOT NULL DEFAULT '';
ALTER TABLE faas_land_sheets ADD COLUMN IF NOT EXISTS previous_td TEXT NOT NULL DEFAULT '';

ALTER TABLE faas_land_appraisal_rows ADD COLUMN IF NOT EXISTS land_type_class TEXT NOT NULL DEFAULT '';
ALTER TABLE faas_land_appraisal_rows ADD COLUMN IF NOT EXISTS class_code TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS assessor_ownership_records (
  id                  SERIAL PRIMARY KEY,
  parcel_id           INTEGER REFERENCES gis_parcels(id) ON DELETE SET NULL,
  faas_sheet_id       INTEGER REFERENCES faas_land_sheets(id) ON DELETE SET NULL,
  pin                 TEXT NOT NULL DEFAULT '',
  arp_no              TEXT NOT NULL DEFAULT '',
  td_no               TEXT NOT NULL DEFAULT '',
  assessor_lot_no     TEXT NOT NULL DEFAULT '',
  survey_lot_no       TEXT NOT NULL DEFAULT '',
  owner_name          TEXT NOT NULL DEFAULT '',
  owner_address       TEXT NOT NULL DEFAULT '',
  barangay            TEXT NOT NULL DEFAULT '',
  barangay_index      TEXT NOT NULL DEFAULT '',
  section_no          TEXT NOT NULL DEFAULT '',
  kind_code           TEXT NOT NULL DEFAULT '0001',
  classification      TEXT NOT NULL DEFAULT '',
  land_type_class     TEXT NOT NULL DEFAULT '',
  assessed_value      DOUBLE PRECISION NOT NULL DEFAULT 0,
  tax_status          TEXT NOT NULL DEFAULT 'taxable',
  effectivity_year    INTEGER,
  previous_arp        TEXT NOT NULL DEFAULT '',
  previous_td         TEXT NOT NULL DEFAULT 'NEW',
  remarks             TEXT NOT NULL DEFAULT '',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assessor_own_barangay ON assessor_ownership_records (barangay);
CREATE INDEX IF NOT EXISTS idx_assessor_own_pin ON assessor_ownership_records (pin);
CREATE INDEX IF NOT EXISTS idx_assessor_own_kind ON assessor_ownership_records (kind_code);
CREATE INDEX IF NOT EXISTS idx_gis_parcels_assessor_lot ON gis_parcels (assessor_lot_no);
CREATE INDEX IF NOT EXISTS idx_gis_parcels_kind ON gis_parcels (kind_code);
