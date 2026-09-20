import { initSchema, run, getOne, pool } from '../src/db.js';

/**
 * Removes all property / assessment / transaction records while preserving
 * user accounts, reference data (barangays, classifications, assessment levels),
 * and security history (audit logs, login history).
 */
await initSchema();

const RECORD_TABLES = [
  'tax_payments',
  'certification_requests',
  'user_property_access',
  'notifications',
  'land_properties',
  'building_properties',
  'machinery_properties',
];

for (const table of RECORD_TABLES) {
  try {
    const before = await getOne(`SELECT COUNT(*)::int AS c FROM ${table}`);
    await run(`DELETE FROM ${table}`);
    console.log(`Cleared ${table} (${before?.c ?? 0} rows removed).`);
  } catch (err) {
    console.warn(`Skipped ${table}: ${err.message}`);
  }
}

const users = await getOne('SELECT COUNT(*)::int AS c FROM users');
console.log(`\nDone. User accounts preserved: ${users?.c ?? 0}.`);

await pool.end();
process.exit(0);
