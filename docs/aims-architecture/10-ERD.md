# 10 — ERD (Logical / Physical Intent)

## Conventions

- UUID primary keys
- Soft delete + audit columns on all business tables
- `tenant_id` on all tenant-owned tables
- Spatial columns via PostGIS (`geometry`)
- Versioned entities use `revision_number` + `is_current`

### Audit columns (all tables)

`created_by`, `created_at`, `updated_by`, `updated_at`, `deleted_by`, `deleted_at`, `is_deleted`

---

## 1. ERD — Identity & tenancy

```mermaid
erDiagram
  TENANTS ||--o{ USERS : has
  USERS ||--o{ USER_ROLES : has
  ROLES ||--o{ USER_ROLES : grants
  ROLES ||--o{ ROLE_PERMISSIONS : has
  PERMISSIONS ||--o{ ROLE_PERMISSIONS : listed
  USERS ||--o{ REFRESH_TOKENS : owns

  TENANTS {
    uuid id PK
    string lgu_code
    string name
    string kind
  }
  USERS {
    uuid id PK
    uuid tenant_id FK
    string username
    string password_hash
    bool two_factor_enabled
  }
  ROLES {
    uuid id PK
    string code
  }
  PERMISSIONS {
    uuid id PK
    string key
  }
```

---

## 2. ERD — Transaction spine & registries

```mermaid
erDiagram
  ASSESSOR_TRANSACTIONS ||--o{ TRANSACTION_DOCUMENTS : attaches
  DOCUMENTS ||--o{ TRANSACTION_DOCUMENTS : used
  ASSESSOR_TRANSACTIONS }o--|| OWNERS : owner
  ASSESSOR_TRANSACTIONS }o--o| PROPERTY_UNITS : property
  ASSESSOR_TRANSACTIONS }o--o| PARCELS : parcel
  OWNERS ||--o{ PROPERTY_UNITS : owns
  PROPERTY_UNITS }o--o| PARCELS : located

  ASSESSOR_TRANSACTIONS {
    uuid id PK
    uuid tenant_id
    string transaction_no
    string type
    string status
    int current_revision
  }
  OWNERS {
    uuid id PK
    uuid tenant_id
    string kind
    string display_name
    string tin
  }
  PROPERTY_UNITS {
    uuid id PK
    uuid tenant_id
    string kind
    string td_no
    string arp_no
    string pin
    uuid owner_id
  }
  PARCELS {
    uuid id PK
    uuid tenant_id
    string pin
    string lot_no
    geometry boundary
  }
  DOCUMENTS {
    uuid id PK
    uuid tenant_id
    string storage_key
    string checksum_sha256
    int version
    bool is_current
  }
```

---

## 3. ERD — FAAS, assessment, approvals, TD

```mermaid
erDiagram
  ASSESSOR_TRANSACTIONS ||--o{ FAAS_SHEETS : versions
  FAAS_SHEETS ||--o{ FAAS_LAND_LINES : has
  FAAS_SHEETS ||--o{ FAAS_BUILDING_LINES : has
  FAAS_SHEETS ||--o{ FAAS_PLANT_LINES : has
  FAAS_SHEETS ||--o| ASSESSMENT_RECORDS : produces
  ASSESSOR_TRANSACTIONS ||--o{ APPROVAL_PACKETS : has
  APPROVAL_PACKETS ||--o| SIGNATURE_RECORDS : signed
  ASSESSOR_TRANSACTIONS ||--o{ TAX_DECLARATIONS : issues
  TAX_DECLARATIONS ||--o{ PRINT_HISTORY : printed
  ASSESSOR_TRANSACTIONS ||--o{ SYNC_ENVELOPES : syncs
  ASSESSOR_TRANSACTIONS ||--o{ INSPECTION_ORDERS : inspects

  FAAS_SHEETS {
    uuid id PK
    uuid transaction_id
    int revision_number
    string status
    string content_hash
    bool is_current
  }
  ASSESSMENT_RECORDS {
    uuid id PK
    uuid faas_sheet_id
    int revision_number
    decimal market_value
    decimal assessed_value
  }
  APPROVAL_PACKETS {
    uuid id PK
    uuid transaction_id
    string level
    string decision
    int based_on_revision
  }
  SIGNATURE_RECORDS {
    uuid id PK
    uuid approval_packet_id
    string certificate_info
    string qr_verify_code
    timestamptz signed_at
  }
  TAX_DECLARATIONS {
    uuid id PK
    uuid transaction_id
    string td_no
    int revision_number
    string status
  }
  SYNC_ENVELOPES {
    uuid id PK
    uuid transaction_id
    int revision_number
    string direction
    string content_hash
    string idempotency_key
  }
```

---

## 4. ERD — Audit & notifications

```mermaid
erDiagram
  AUDIT_EVENTS {
    uuid id PK
    uuid tenant_id
    uuid actor_id
    string action
    string entity_type
    uuid entity_id
    jsonb metadata
    timestamptz at
  }
  NOTIFICATIONS {
    uuid id PK
    uuid tenant_id
    uuid user_id
    string channel
    string title
    bool is_read
  }
```

---

## 5. Indexing (critical)

| Table | Indexes |
| --- | --- |
| `assessor_transactions` | `(tenant_id, status)`, `(transaction_no)` unique per tenant |
| `property_units` | `(tenant_id, pin)`, `(td_no)` |
| `parcels` | GiST on `boundary`; `(pin)` |
| `faas_sheets` | `(transaction_id, revision_number)` unique |
| `sync_envelopes` | unique `(idempotency_key)` |
| `audit_events` | `(tenant_id, at)`, `(entity_type, entity_id)` |
| `documents` | `(checksum_sha256)`, `(storage_key, version)` |
