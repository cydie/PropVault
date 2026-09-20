/**
 * Enable PostGIS on main + local databases (requires postgres superuser).
 * Reads PG_ADMIN_URL from server/.env
 *
 *   npm run db:enable-postgis
 */
import pg from 'pg';
import { loadServerEnv } from './loadEnv.js';

loadServerEnv();

const adminBase =
  process.env.PG_ADMIN_URL || 'postgresql://postgres:0000@localhost:5432/postgres';

const databases = ['propvault', 'propvault_local'];

for (const db of databases) {
  const url = adminBase.replace(/\/[^/]+$/, `/${db}`);
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  console.log(`\n=== ${db} ===`);

  await client.query('CREATE EXTENSION IF NOT EXISTS postgis');
  console.log('  postgis extension enabled');

  await client.query(`
    CREATE TABLE IF NOT EXISTS property_geometries (
      property_id TEXT PRIMARY KEY,
      property_type TEXT NOT NULL DEFAULT 'land',
      geom GEOMETRY(Point, 4326),
      server_id TEXT,
      local_id TEXT,
      sync_status TEXT DEFAULT 'synced',
      sync_version INTEGER DEFAULT 1,
      last_modified TIMESTAMPTZ DEFAULT NOW(),
      is_deleted BOOLEAN DEFAULT FALSE,
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_property_geometries_geom
    ON property_geometries USING GIST (geom);
  `);
  console.log('  property_geometries table ready');

  const ver = await client.query('SELECT PostGIS_Version() AS v');
  console.log('  PostGIS version:', ver.rows[0]?.v);

  await client.end();
}

console.log('\nPostGIS enabled on all databases.');
process.exit(0);
