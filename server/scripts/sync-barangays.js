import { initSchema, pool, query, run } from '../src/db.js';
import { RIZAL_PALAWAN_BARANGAYS } from '../src/rizalBarangays.js';

await initSchema();

const existing = await query('SELECT id, name FROM barangays ORDER BY name');
const officialSet = new Set(RIZAL_PALAWAN_BARANGAYS);

let added = 0;
for (const name of RIZAL_PALAWAN_BARANGAYS) {
  const found = existing.find((b) => b.name === name);
  if (!found) {
    await run('INSERT INTO barangays (name) VALUES (?)', [name]);
    added++;
    console.log(`Added: ${name}`);
  }
}

let removed = 0;
for (const b of existing) {
  if (!officialSet.has(b.name)) {
    await run('DELETE FROM barangays WHERE id = ?', [b.id]);
    removed++;
    console.log(`Removed legacy entry: ${b.name}`);
  }
}

const final = await query('SELECT COUNT(*)::int AS c FROM barangays');
console.log(`\nDone. ${final[0].c} barangay(ies) in database (${added} added, ${removed} legacy removed).`);

await pool.end();
process.exit(0);
