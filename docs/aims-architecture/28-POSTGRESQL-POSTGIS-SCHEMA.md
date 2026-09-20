# 28 — PostgreSQL / PostGIS Schema Reference

Canonical DDL: [`../../aims/schema/aims_postgis_schema.sql`](../../aims/schema/aims_postgis_schema.sql)

## Extensions

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology; -- optional
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS unaccent; -- optional
```

## Schema packages in DDL file

1. Tenancy & identity  
2. Registries (owners, properties, parcels)  
3. Property revisions & timeline  
4. Geometry versions & boundaries  
5. Spatial conflicts & resolutions  
6. Parcel comparison sessions  
7. Offline sync queues  
8. Documents, workflow, FAAS, TD (core)  
9. Analytics materialized views (optional refresh jobs)  
10. Indexes (B-tree + GiST + trigram)

## Soft delete & audit

All business tables include:

`created_by`, `created_at`, `updated_by`, `updated_at`, `deleted_by`, `deleted_at`, `is_deleted`

## Multi-tenant

`tenant_id UUID NOT NULL` on all tenant-owned tables; composite unique keys include `tenant_id`.
