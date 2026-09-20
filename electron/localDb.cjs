/**
 * Local PostgreSQL access for Electron main process only.
 * Credentials never exposed to the React renderer.
 */
const path = require('path');

function loadPg() {
  try {
    return require('pg');
  } catch {
    return require(path.join(__dirname, '..', 'server', 'node_modules', 'pg'));
  }
}

const { Pool } = loadPg();
const fs = require('fs');
const { app } = require('electron');

let pool = null;

function getLocalConnectionString() {
  if (process.env.LOCAL_DATABASE_URL) return process.env.LOCAL_DATABASE_URL;

  try {
    const configPath = path.join(app.getPath('userData'), 'local-db.json');
    if (fs.existsSync(configPath)) {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (cfg.connectionString) return cfg.connectionString;
    }
  } catch {
    /* ignore */
  }

  return 'postgresql://propvault:propvault@localhost:5432/propvault_local';
}

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: getLocalConnectionString(),
      max: 10,
      connectionTimeoutMillis: 8000,
    });
  }
  return pool;
}

function toPg(sql, params = []) {
  let i = 0;
  const text = sql.replace(/\?/g, () => `$${++i}`);
  return { text, values: params };
}

async function localQuery(sql, params = []) {
  const { text, values } = toPg(sql, params);
  const result = await getPool().query(text, values);
  return result.rows;
}

async function localGetOne(sql, params = []) {
  const rows = await localQuery(sql, params);
  return rows[0] ?? null;
}

async function testLocalConnection() {
  const row = await localGetOne('SELECT NOW() as now, current_database() as db');
  return row;
}

async function getLocalLandRecords({ page = 1, limit = 50, search = '' } = {}) {
  const offset = (page - 1) * limit;
  const conditions = ['(is_deleted = FALSE OR is_deleted IS NULL)'];
  const params = [];
  if (search?.trim()) {
    conditions.push('(owner ILIKE ? OR pin ILIKE ? OR td ILIKE ?)');
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }
  const where = `WHERE ${conditions.join(' AND ')}`;
  const total = (await localGetOne(`SELECT COUNT(*)::int AS c FROM land_properties ${where}`, params))?.c ?? 0;
  const rows = await localQuery(
    `SELECT * FROM land_properties ${where} ORDER BY last_modified DESC NULLS LAST, created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return {
    items: rows.map((r) => ({
      id: r.id,
      td: r.td,
      pin: r.pin,
      owner: r.owner,
      barangay: r.barangay,
      classification: r.classification,
      area: r.area,
      mv: r.market_value,
      av: r.assessed_value,
      status: r.status,
      syncStatus: r.sync_status,
      localId: r.local_id,
      serverId: r.server_id,
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

async function getLocalSyncSummary() {
  try {
    const pending = (await localGetOne(
      `SELECT COUNT(*)::int AS c FROM sync_queue WHERE sync_status IN ('pending','failed')`
    ))?.c ?? 0;
    const conflicts = (await localGetOne(
      `SELECT COUNT(*)::int AS c FROM sync_queue WHERE sync_status = 'conflict'`
    ))?.c ?? 0;
    return { queuePending: pending, queueConflicts: conflicts };
  } catch {
    return { queuePending: 0, queueConflicts: 0 };
  }
}

async function closeLocalPool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  getLocalConnectionString,
  testLocalConnection,
  getLocalLandRecords,
  getLocalSyncSummary,
  localQuery,
  closeLocalPool,
};
