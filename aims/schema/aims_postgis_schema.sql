-- =============================================================================
-- AIMS — Assessor Information Management System
-- Production PostgreSQL + PostGIS Schema
-- Version: 1.1.0
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION aims_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 1. TENANCY & IDENTITY
-- =============================================================================
CREATE TABLE tenants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lgu_code        TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  kind            TEXT NOT NULL CHECK (kind IN ('Municipal','Provincial','System')),
  parent_tenant_id UUID REFERENCES tenants(id),
  settings_json   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_by      UUID,
  deleted_at      TIMESTAMPTZ,
  is_deleted      BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE users (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id),
  username           TEXT NOT NULL,
  password_hash      TEXT NOT NULL,
  display_name       TEXT NOT NULL,
  email              TEXT,
  office_name        TEXT NOT NULL DEFAULT '',
  two_factor_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
  is_locked          BOOLEAN NOT NULL DEFAULT FALSE,
  created_by         UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by         UUID,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_by         UUID,
  deleted_at         TIMESTAMPTZ,
  is_deleted         BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (tenant_id, username)
);

CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE permissions (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key  TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE role_permissions (
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 2. REFERENCE BOUNDARIES
-- =============================================================================
CREATE TABLE municipality_boundaries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  geom        geometry(MultiPolygon, 4326) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);
CREATE INDEX idx_muni_geom_gist ON municipality_boundaries USING GIST (geom);

CREATE TABLE barangay_boundaries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  municipality_code TEXT NOT NULL,
  code             TEXT NOT NULL,
  name             TEXT NOT NULL,
  geom             geometry(MultiPolygon, 4326) NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);
CREATE INDEX idx_brgy_geom_gist ON barangay_boundaries USING GIST (geom);

-- =============================================================================
-- 3. REGISTRIES
-- =============================================================================
CREATE TABLE owners (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  kind          TEXT NOT NULL CHECK (kind IN ('Natural','Juridical')),
  display_name  TEXT NOT NULL,
  tin           TEXT NOT NULL DEFAULT '',
  contact_json  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by    UUID,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_by    UUID,
  deleted_at    TIMESTAMPTZ,
  is_deleted    BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_owners_name_trgm ON owners USING GIN (display_name gin_trgm_ops);
CREATE INDEX idx_owners_tenant ON owners (tenant_id) WHERE is_deleted = FALSE;

CREATE TABLE property_units (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id),
  kind               TEXT NOT NULL CHECK (kind IN ('Land','Building','Machinery','PlantsTrees')),
  pin                TEXT NOT NULL DEFAULT '',
  td_no              TEXT NOT NULL DEFAULT '',
  arp_no             TEXT NOT NULL DEFAULT '',
  lot_no             TEXT NOT NULL DEFAULT '',
  title_no           TEXT NOT NULL DEFAULT '',
  survey_no          TEXT NOT NULL DEFAULT '',
  barangay_code      TEXT NOT NULL DEFAULT '',
  classification     TEXT NOT NULL DEFAULT '',
  land_use           TEXT NOT NULL DEFAULT '',
  area_sqm           NUMERIC(18,4),
  assessed_value     NUMERIC(18,2),
  owner_id           UUID REFERENCES owners(id),
  parcel_id          UUID, -- FK added after parcels
  current_revision   INT NOT NULL DEFAULT 1,
  status             TEXT NOT NULL DEFAULT 'Active',
  created_by         UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by         UUID,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_by         UUID,
  deleted_at         TIMESTAMPTZ,
  is_deleted         BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_property_pin ON property_units (tenant_id, pin);
CREATE INDEX idx_property_td ON property_units (tenant_id, td_no);
CREATE INDEX idx_property_title ON property_units (tenant_id, title_no);
CREATE INDEX idx_property_survey ON property_units (tenant_id, survey_no);
CREATE INDEX idx_property_owner ON property_units (owner_id);

CREATE TABLE parcels (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  pin              TEXT NOT NULL,
  lot_no           TEXT NOT NULL DEFAULT '',
  survey_no        TEXT NOT NULL DEFAULT '',
  barangay_code    TEXT NOT NULL DEFAULT '',
  current_geom_rev INT NOT NULL DEFAULT 1,
  centroid         geometry(Point, 4326),
  geom_hash        TEXT NOT NULL DEFAULT '',
  created_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by       UUID,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_by       UUID,
  deleted_at       TIMESTAMPTZ,
  is_deleted       BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (tenant_id, pin)
);
CREATE INDEX idx_parcels_centroid_gist ON parcels USING GIST (centroid);

ALTER TABLE property_units
  ADD CONSTRAINT fk_property_parcel
  FOREIGN KEY (parcel_id) REFERENCES parcels(id);

-- =============================================================================
-- 4. PROPERTY VERSIONING (Git-like) + TIMELINE
-- =============================================================================
CREATE TABLE property_revisions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id),
  property_id        UUID NOT NULL REFERENCES property_units(id),
  revision_number    INT NOT NULL,
  snapshot_json      JSONB NOT NULL,
  editor_user_id     UUID REFERENCES users(id),
  office_name        TEXT NOT NULL DEFAULT '',
  municipality_code  TEXT NOT NULL DEFAULT '',
  approval_status    TEXT NOT NULL DEFAULT 'Draft'
                       CHECK (approval_status IN ('Draft','Pending','Approved','Rejected')),
  digital_signature  JSONB,
  content_hash       TEXT NOT NULL,
  reason             TEXT NOT NULL DEFAULT '',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (property_id, revision_number)
);
CREATE INDEX idx_property_revisions_prop ON property_revisions (property_id, revision_number DESC);

CREATE TABLE property_timeline_events (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID NOT NULL REFERENCES tenants(id),
  property_id               UUID NOT NULL REFERENCES property_units(id),
  occurred_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  performed_by_user_id      UUID REFERENCES users(id),
  office_name               TEXT NOT NULL DEFAULT '',
  municipality_code         TEXT NOT NULL DEFAULT '',
  municipality_name         TEXT NOT NULL DEFAULT '',
  action                    TEXT NOT NULL,
  old_value                 JSONB,
  new_value                 JSONB,
  reason                    TEXT NOT NULL DEFAULT '',
  supporting_document_ids   UUID[] NOT NULL DEFAULT '{}',
  digital_signature_status  TEXT NOT NULL DEFAULT 'None'
                              CHECK (digital_signature_status IN ('None','Pending','Signed','Invalid')),
  revision_number           INT,
  correlation_id            UUID,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_timeline_property_time ON property_timeline_events (property_id, occurred_at DESC);
CREATE INDEX idx_timeline_action ON property_timeline_events (tenant_id, action);
CREATE INDEX idx_timeline_reason_trgm ON property_timeline_events USING GIN (reason gin_trgm_ops);

-- =============================================================================
-- 5. PARCEL GEOMETRY VERSIONS
-- =============================================================================
CREATE TABLE parcel_geometry_versions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  parcel_id        UUID NOT NULL REFERENCES parcels(id),
  revision_number  INT NOT NULL,
  geom             geometry(MultiPolygon, 4326) NOT NULL,
  geom_hash        TEXT NOT NULL,
  area_sqm         NUMERIC(18,4),
  perimeter_m      NUMERIC(18,4),
  centroid         geometry(Point, 4326),
  is_current       BOOLEAN NOT NULL DEFAULT FALSE,
  is_valid         BOOLEAN NOT NULL DEFAULT TRUE,
  editor_user_id   UUID REFERENCES users(id),
  office_name      TEXT NOT NULL DEFAULT '',
  approval_status  TEXT NOT NULL DEFAULT 'Approved',
  digital_signature JSONB,
  reason           TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (parcel_id, revision_number)
);
CREATE INDEX idx_parcel_geom_gist ON parcel_geometry_versions USING GIST (geom);
CREATE INDEX idx_parcel_geom_current ON parcel_geometry_versions (parcel_id) WHERE is_current = TRUE;
CREATE INDEX idx_parcel_geom_hash ON parcel_geometry_versions (tenant_id, geom_hash);

-- =============================================================================
-- 6. SPATIAL CONFLICTS
-- =============================================================================
CREATE TABLE spatial_conflicts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  conflict_no     TEXT NOT NULL,
  severity        TEXT NOT NULL CHECK (severity IN ('Critical','High','Medium','Low')),
  status          TEXT NOT NULL DEFAULT 'Open'
                    CHECK (status IN ('Open','Resolved','Waived','Dismissed')),
  parcel_id       UUID REFERENCES parcels(id),
  property_id     UUID REFERENCES property_units(id),
  transaction_id  UUID,
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  detector        TEXT NOT NULL DEFAULT 'System',
  report_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, conflict_no)
);

CREATE TABLE spatial_conflict_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conflict_id   UUID NOT NULL REFERENCES spatial_conflicts(id) ON DELETE CASCADE,
  rule_code     TEXT NOT NULL,
  severity      TEXT NOT NULL,
  message       TEXT NOT NULL,
  other_parcel_id UUID REFERENCES parcels(id),
  geometry_snippet geometry(Geometry, 4326),
  details_json  JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX idx_conflict_items_conflict ON spatial_conflict_items (conflict_id);
CREATE INDEX idx_conflict_items_rule ON spatial_conflict_items (rule_code);

CREATE TABLE spatial_conflict_resolutions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conflict_id     UUID NOT NULL REFERENCES spatial_conflicts(id) ON DELETE CASCADE,
  action          TEXT NOT NULL CHECK (action IN ('FixGeometry','AcceptException','DismissFalsePositive')),
  reason          TEXT NOT NULL,
  resolved_by     UUID REFERENCES users(id),
  resolved_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  evidence_doc_ids UUID[] NOT NULL DEFAULT '{}',
  metadata_json   JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- =============================================================================
-- 7. PARCEL COMPARISON
-- =============================================================================
CREATE TABLE parcel_comparison_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  parcel_id         UUID NOT NULL REFERENCES parcels(id),
  old_revision      INT NOT NULL,
  new_geom          geometry(MultiPolygon, 4326) NOT NULL,
  metrics_json      JSONB NOT NULL DEFAULT '{}'::jsonb,
  change_summary    TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'Pending'
                      CHECK (status IN ('Pending','Approved','Rejected')),
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_by        UUID REFERENCES users(id),
  decided_at        TIMESTAMPTZ,
  reason            TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_compare_parcel ON parcel_comparison_sessions (parcel_id, created_at DESC);

-- =============================================================================
-- 8. TRANSACTIONS, DOCUMENTS, INSPECTION, FAAS, TD (core spine)
-- =============================================================================
CREATE TABLE documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  file_name        TEXT NOT NULL,
  content_type     TEXT NOT NULL,
  storage_key      TEXT NOT NULL,
  checksum_sha256  TEXT NOT NULL,
  version          INT NOT NULL DEFAULT 1,
  is_current       BOOLEAN NOT NULL DEFAULT TRUE,
  qr_payload       TEXT,
  digital_signature JSONB,
  created_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_by       UUID,
  deleted_at       TIMESTAMPTZ,
  is_deleted       BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE assessor_transactions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id),
  transaction_no     TEXT NOT NULL,
  type               TEXT NOT NULL,
  status             TEXT NOT NULL,
  current_revision   INT NOT NULL DEFAULT 1,
  owner_id           UUID REFERENCES owners(id),
  property_id        UUID REFERENCES property_units(id),
  parcel_id          UUID REFERENCES parcels(id),
  received_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by         UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by         UUID,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_by         UUID,
  deleted_at         TIMESTAMPTZ,
  is_deleted         BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (tenant_id, transaction_no)
);

CREATE TABLE transaction_documents (
  transaction_id UUID NOT NULL REFERENCES assessor_transactions(id) ON DELETE CASCADE,
  document_id    UUID NOT NULL REFERENCES documents(id),
  PRIMARY KEY (transaction_id, document_id)
);

CREATE TABLE inspection_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  transaction_id  UUID REFERENCES assessor_transactions(id),
  property_id     UUID REFERENCES property_units(id),
  assigned_to     UUID REFERENCES users(id),
  status          TEXT NOT NULL DEFAULT 'Assigned',
  scheduled_at    TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE offline_sync_batches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  device_id       TEXT NOT NULL,
  user_id         UUID NOT NULL REFERENCES users(id),
  payload_json    JSONB NOT NULL,
  status          TEXT NOT NULL DEFAULT 'Received'
                    CHECK (status IN ('Received','Applied','Conflict','Rejected')),
  conflict_json   JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ
);

CREATE TABLE offline_conflict_resolutions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id        UUID NOT NULL REFERENCES offline_sync_batches(id) ON DELETE CASCADE,
  property_id     UUID NOT NULL REFERENCES property_units(id),
  resolution      TEXT NOT NULL CHECK (resolution IN ('KeepServer','KeepLocal','ManualMerge')),
  merged_json     JSONB,
  resolved_by     UUID REFERENCES users(id),
  resolved_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE faas_sheets (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  transaction_id   UUID REFERENCES assessor_transactions(id),
  property_id      UUID REFERENCES property_units(id),
  revision_number  INT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'Draft',
  content_hash     TEXT NOT NULL,
  sheet_json       JSONB NOT NULL,
  is_current       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (property_id, revision_number)
);

CREATE TABLE assessment_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  faas_sheet_id    UUID REFERENCES faas_sheets(id),
  property_id      UUID REFERENCES property_units(id),
  revision_number  INT NOT NULL,
  market_value     NUMERIC(18,2) NOT NULL DEFAULT 0,
  assessed_value   NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE approval_packets (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id),
  transaction_id     UUID NOT NULL REFERENCES assessor_transactions(id),
  level              TEXT NOT NULL CHECK (level IN ('Municipal','Provincial')),
  decision           TEXT NOT NULL CHECK (decision IN ('Approved','Rejected','Returned')),
  based_on_revision  INT NOT NULL,
  decided_by         UUID REFERENCES users(id),
  decided_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  remarks            TEXT NOT NULL DEFAULT ''
);

CREATE TABLE signature_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_packet_id UUID NOT NULL REFERENCES approval_packets(id),
  signer_user_id    UUID NOT NULL REFERENCES users(id),
  certificate_info  TEXT NOT NULL DEFAULT '',
  content_hash      TEXT NOT NULL,
  qr_verify_code    TEXT NOT NULL UNIQUE,
  signed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  signature_json    JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE tax_declarations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  transaction_id   UUID REFERENCES assessor_transactions(id),
  property_id      UUID REFERENCES property_units(id),
  td_no            TEXT NOT NULL,
  revision_number  INT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'Generated',
  document_id      UUID REFERENCES documents(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE print_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  entity_type   TEXT NOT NULL,
  entity_id     UUID NOT NULL,
  printed_by    UUID REFERENCES users(id),
  printed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  barcode       TEXT,
  qr_code       TEXT,
  revision_number INT
);

CREATE TABLE sync_envelopes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  peer_tenant_id   UUID NOT NULL REFERENCES tenants(id),
  transaction_id   UUID REFERENCES assessor_transactions(id),
  revision_number  INT NOT NULL,
  direction        TEXT NOT NULL CHECK (direction IN ('ToProvince','ToMunicipality')),
  content_hash     TEXT NOT NULL,
  payload_json     JSONB NOT NULL,
  idempotency_key  TEXT NOT NULL UNIQUE,
  status           TEXT NOT NULL DEFAULT 'Queued',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id),
  actor_id     UUID,
  action       TEXT NOT NULL,
  entity_type  TEXT,
  entity_id    UUID,
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  correlation_id UUID,
  at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_tenant_at ON audit_events (tenant_id, at DESC);
CREATE INDEX idx_audit_entity ON audit_events (entity_type, entity_id);

CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id),
  user_id    UUID NOT NULL REFERENCES users(id),
  channel    TEXT NOT NULL DEFAULT 'InApp',
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 9. SPATIAL VALIDATION FUNCTION (core overlap / validity sample)
-- =============================================================================
CREATE OR REPLACE FUNCTION aims_validate_parcel_geometry(
  p_tenant_id UUID,
  p_parcel_id UUID,
  p_geom geometry
) RETURNS TABLE(rule_code TEXT, severity TEXT, message TEXT, other_parcel_id UUID)
LANGUAGE plpgsql AS $$
BEGIN
  IF p_geom IS NULL OR ST_IsEmpty(p_geom) THEN
    RETURN QUERY SELECT 'INVALID_POLYGON'::TEXT, 'Critical'::TEXT, 'Geometry is empty'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF NOT ST_IsValid(p_geom) THEN
    RETURN QUERY SELECT 'INVALID_POLYGON'::TEXT, 'Critical'::TEXT, ST_IsValidReason(p_geom)::TEXT, NULL::UUID;
  END IF;

  IF ST_NPoints(ST_Boundary(p_geom)) > 0 AND EXISTS (
    SELECT 1 WHERE ST_IsValidDetail(p_geom) IS NOT NULL AND (ST_IsValidDetail(p_geom)).reason ILIKE '%Self-intersection%'
  ) THEN
    RETURN QUERY SELECT 'SELF_INTERSECTING'::TEXT, 'Critical'::TEXT, 'Self-intersecting polygon'::TEXT, NULL::UUID;
  END IF;

  RETURN QUERY
  SELECT 'OVERLAPPING_PARCELS'::TEXT,
         'Critical'::TEXT,
         'Overlaps another parcel'::TEXT,
         v.parcel_id
  FROM parcel_geometry_versions v
  WHERE v.tenant_id = p_tenant_id
    AND v.is_current = TRUE
    AND v.parcel_id <> p_parcel_id
    AND v.geom && p_geom
    AND ST_Overlaps(v.geom, p_geom);

  RETURN QUERY
  SELECT 'DUPLICATE_GEOMETRY'::TEXT,
         'Critical'::TEXT,
         'Duplicate geometry detected'::TEXT,
         v.parcel_id
  FROM parcel_geometry_versions v
  WHERE v.tenant_id = p_tenant_id
    AND v.is_current = TRUE
    AND v.parcel_id <> p_parcel_id
    AND ST_Equals(v.geom, p_geom);

  RETURN QUERY
  SELECT 'OUTSIDE_MUNICIPALITY'::TEXT,
         'Critical'::TEXT,
         'Geometry outside municipality boundary'::TEXT,
         NULL::UUID
  WHERE EXISTS (SELECT 1 FROM municipality_boundaries m WHERE m.tenant_id = p_tenant_id)
    AND NOT EXISTS (
      SELECT 1 FROM municipality_boundaries m
      WHERE m.tenant_id = p_tenant_id
        AND ST_CoveredBy(ST_PointOnSurface(p_geom), m.geom)
    );
END;
$$;

-- =============================================================================
-- 10. ANALYTICS HELPERS (materialized view example)
-- =============================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_property_counts_by_barangay AS
SELECT
  tenant_id,
  barangay_code,
  COUNT(*)::BIGINT AS property_count,
  COALESCE(SUM(assessed_value),0) AS total_assessed_value
FROM property_units
WHERE is_deleted = FALSE
GROUP BY tenant_id, barangay_code;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_prop_brgy
  ON mv_property_counts_by_barangay (tenant_id, barangay_code);

-- End of AIMS schema
