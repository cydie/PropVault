import pg from 'pg';
import { RIZAL_PALAWAN_BARANGAYS } from './rizalBarangays.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0 && !process.env[trimmed.slice(0, eq)]) {
      process.env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
    }
  }
}

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://propvault:propvault@localhost:5432/propvault';

export const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

/** Convert SQLite-style ? placeholders to PostgreSQL $1, $2, … */
function toPg(sql, params = []) {
  let i = 0;
  const text = sql.replace(/\?/g, () => `$${++i}`);
  return { text, values: params };
}

export async function query(sql, params = []) {
  const { text, values } = toPg(sql, params);
  const result = await pool.query(text, values);
  return result.rows;
}

export async function getOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}

export async function run(sql, params = []) {
  await query(sql, params);
}

export async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('Admin','Treasury','Staff Assessor','IT')),
      status TEXT NOT NULL DEFAULT 'Active',
      failed_attempts INTEGER DEFAULT 0,
      locked_until TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_property_access (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      property_id TEXT NOT NULL,
      PRIMARY KEY (user_id, property_id)
    );

    CREATE TABLE IF NOT EXISTS land_properties (
      id TEXT PRIMARY KEY,
      td TEXT NOT NULL,
      pin TEXT NOT NULL,
      owner TEXT NOT NULL,
      barangay TEXT NOT NULL,
      classification TEXT NOT NULL,
      area TEXT NOT NULL,
      market_value TEXT NOT NULL,
      assessed_value TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending',
      details_json JSONB,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS building_properties (
      id TEXT PRIMARY KEY,
      arp TEXT NOT NULL,
      pin TEXT NOT NULL,
      owner TEXT NOT NULL,
      barangay TEXT NOT NULL,
      kind TEXT NOT NULL,
      structural TEXT NOT NULL,
      floors TEXT NOT NULL,
      floor_area TEXT NOT NULL,
      market_value TEXT NOT NULL,
      assessed_value TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending',
      details_json JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS machinery_properties (
      id TEXT PRIMARY KEY,
      arp TEXT NOT NULL,
      pin TEXT NOT NULL,
      owner TEXT NOT NULL,
      barangay TEXT NOT NULL,
      kind TEXT NOT NULL,
      brand TEXT NOT NULL,
      capacity TEXT NOT NULL,
      acquired TEXT NOT NULL,
      condition TEXT NOT NULL,
      market_value TEXT NOT NULL,
      assessed_value TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending',
      details_json JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS certification_requests (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      requestor TEXT NOT NULL,
      property_id TEXT,
      user_id TEXT REFERENCES users(id),
      date TEXT NOT NULL,
      due TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending',
      remarks TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      audience_roles TEXT,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      detail TEXT NOT NULL,
      ip TEXT,
      color TEXT DEFAULT 'blue'
    );

    CREATE TABLE IF NOT EXISTS login_history (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ip TEXT,
      success BOOLEAN NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS barangays (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS classifications (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assessment_levels (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      rate DOUBLE PRECISION NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_reset_requests (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL,
      status TEXT DEFAULT 'Pending',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS forgot_password_codes (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_land_barangay ON land_properties(barangay);
    CREATE INDEX IF NOT EXISTS idx_land_status ON land_properties(status);
    CREATE INDEX IF NOT EXISTS idx_land_pin ON land_properties(pin);
    CREATE INDEX IF NOT EXISTS idx_cert_status ON certification_requests(status);
    CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(time DESC);

    CREATE TABLE IF NOT EXISTS tax_payments (
      id TEXT PRIMARY KEY,
      property_id TEXT,
      owner TEXT NOT NULL,
      td TEXT,
      pin TEXT NOT NULL DEFAULT '',
      amount TEXT NOT NULL,
      tax_year TEXT NOT NULL,
      payment_date TEXT,
      status TEXT NOT NULL DEFAULT 'Pending',
      receipt_no TEXT,
      validated_by TEXT,
      remarks TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE land_properties ADD COLUMN IF NOT EXISTS remarks TEXT;
    ALTER TABLE building_properties ADD COLUMN IF NOT EXISTS remarks TEXT;
    ALTER TABLE tax_payments ADD COLUMN IF NOT EXISTS pin TEXT NOT NULL DEFAULT '';

    CREATE INDEX IF NOT EXISTS idx_payments_status ON tax_payments(status);
    CREATE INDEX IF NOT EXISTS idx_payments_owner ON tax_payments(owner);

    CREATE TABLE IF NOT EXISTS property_soft_copies (
      id SERIAL PRIMARY KEY,
      property_type TEXT NOT NULL CHECK (property_type IN ('land', 'building')),
      property_id TEXT,
      pin TEXT NOT NULL DEFAULT '',
      td_or_arp TEXT NOT NULL DEFAULT '',
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT '',
      size_bytes INTEGER NOT NULL DEFAULT 0,
      file_path TEXT NOT NULL,
      uploaded_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_soft_copies_property ON property_soft_copies(property_type, property_id);
    CREATE INDEX IF NOT EXISTS idx_soft_copies_pin ON property_soft_copies(pin);
  `);

  await migrateRoles();
  await syncOfficialBarangays();
  await migrateNotifications();
  const { migrateSystemSettings } = await import('./systemSettings.js');
  await migrateSystemSettings();
  const { migrateAssessorCodes } = await import('./assessorConfig.js');
  await migrateAssessorCodes();
  const { migrateHybridArchitecture } = await import('./migrations/hybridArchitecture.js');
  await migrateHybridArchitecture();
  await migrateCadastralSchema();
}

async function migrateCadastralSchema() {
  try {
    const sqlPath = path.join(__dirname, 'db', 'schema-cadastral.sql');
    if (!fs.existsSync(sqlPath)) return;
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await pool.query(sql);
    console.log('[db] cadastral GIS schema ready');
  } catch (err) {
    console.warn('[db] cadastral schema skipped (PostGIS may not be installed):', err.message);
  }
}

async function migrateNotifications() {
  await pool.query(`
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS audience_roles TEXT;
  `);
}

/** Ensure all official Rizal, Palawan barangays exist in reference data */
export async function syncOfficialBarangays() {
  for (const name of RIZAL_PALAWAN_BARANGAYS) {
    await pool.query('INSERT INTO barangays (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
  }
}

async function migrateRoles() {
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'users_role_check'
          AND conrelid = 'users'::regclass
      ) THEN
        ALTER TABLE users DROP CONSTRAINT users_role_check;
      END IF;
    EXCEPTION WHEN undefined_table THEN
      NULL;
    END $$;
  `);

  await pool.query(`
    UPDATE users SET role = 'Staff Assessor' WHERE role IN ('Staff', 'Provincial Assessor');
  `);

  await pool.query(`
    UPDATE users SET role = 'IT' WHERE role = 'Property Owner';
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'users_role_check'
          AND conrelid = 'users'::regclass
      ) THEN
        ALTER TABLE users ADD CONSTRAINT users_role_check
          CHECK (role IN ('Admin','Treasury','Staff Assessor','IT'));
      END IF;
    EXCEPTION WHEN undefined_table THEN
      NULL;
    END $$;
  `);
}

export async function logAudit(actor, action, module, detail, ip = '127.0.0.1', color = 'blue') {
  const id = `AL-${Date.now()}`;
  await run(
    `INSERT INTO audit_logs (id, actor, action, module, detail, ip, color) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, actor, action, module, detail, ip, color]
  );
}

export async function testConnection() {
  const row = await getOne('SELECT NOW() as now, current_database() as db');
  return row;
}
