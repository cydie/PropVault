import { pool, query } from '../db.js';

/** Tables that participate in offline ↔ server sync */
export const SYNCABLE_TABLES = [
  'land_properties',
  'building_properties',
  'certification_requests',
  'tax_payments',
];

const SYNC_COLUMNS = [
  ['server_id', 'TEXT'],
  ['local_id', 'TEXT'],
  ['sync_status', "TEXT DEFAULT 'synced'"],
  ['sync_version', 'INTEGER DEFAULT 1'],
  ['last_modified', 'TIMESTAMPTZ DEFAULT NOW()'],
  ['is_deleted', 'BOOLEAN DEFAULT FALSE'],
  ['deleted_at', 'TIMESTAMPTZ'],
];

export async function migrateHybridArchitecture() {
  // PostGIS for parcel geometry (optional — skip if extension unavailable)
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS postgis');
    await pool.query(`
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
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_property_geometries_geom
      ON property_geometries USING GIST (geom);
    `);
    console.log('PostGIS ready for property_geometries');
  } catch (err) {
    console.warn('PostGIS extension not available — GIS geometry table skipped:', err.message);
  }

  for (const table of SYNCABLE_TABLES) {
    for (const [col, def] of SYNC_COLUMNS) {
      await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${def}`);
    }
    // Ensure updated_at exists on tables missing it
    await pool.query(
      `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_${table}_sync_status ON ${table}(sync_status)`
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_${table}_last_modified ON ${table}(last_modified DESC)`
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_${table}_is_deleted ON ${table}(is_deleted) WHERE is_deleted = FALSE`
    );
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id SERIAL PRIMARY KEY,
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      local_id TEXT,
      server_id TEXT,
      operation TEXT NOT NULL DEFAULT 'upsert',
      sync_status TEXT NOT NULL DEFAULT 'pending',
      sync_version INTEGER DEFAULT 1,
      payload JSONB,
      error_message TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      last_attempt_at TIMESTAMPTZ
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(sync_status);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sync_runs (
      id SERIAL PRIMARY KEY,
      direction TEXT NOT NULL,
      started_at TIMESTAMPTZ DEFAULT NOW(),
      finished_at TIMESTAMPTZ,
      records_pushed INTEGER DEFAULT 0,
      records_pulled INTEGER DEFAULT 0,
      conflicts INTEGER DEFAULT 0,
      status TEXT DEFAULT 'running',
      error_message TEXT
    );
  `);

  // Search / filter indexes for large datasets
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_land_owner ON land_properties(owner)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_land_td ON land_properties(td)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_building_owner ON building_properties(owner)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_building_pin ON building_properties(pin)`);
}

export async function getSyncSummary() {
  const pending = await query(
    `SELECT COUNT(*)::int AS c FROM sync_queue WHERE sync_status IN ('pending','failed')`
  );
  const byTable = await query(
    `SELECT table_name, sync_status, COUNT(*)::int AS count
     FROM sync_queue GROUP BY table_name, sync_status ORDER BY table_name`
  );
  const conflicts = await query(
    `SELECT COUNT(*)::int AS c FROM sync_queue WHERE sync_status = 'conflict'`
  );
  const recordPending = await query(
    `SELECT COUNT(*)::int AS c FROM land_properties WHERE sync_status = 'pending' AND is_deleted = FALSE`
  );
  return {
    queuePending: pending[0]?.c ?? 0,
    queueConflicts: conflicts[0]?.c ?? 0,
    landPending: recordPending[0]?.c ?? 0,
    byTable,
  };
}
