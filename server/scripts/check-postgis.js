import pg from 'pg';
import { loadServerEnv } from './loadEnv.js';

loadServerEnv();

const adminUrl = process.env.PG_ADMIN_URL || 'postgresql://postgres:0000@localhost:5432/postgres';
const dbs = ['propvault', 'propvault_local'];

const client = new pg.Client({ connectionString: adminUrl });
await client.connect();

const available = await client.query(
  `SELECT name, installed_version, default_version FROM pg_available_extensions WHERE name LIKE 'postgis%' ORDER BY name`
);
console.log('Available PostGIS extensions:', available.rows);

for (const db of dbs) {
  const dbClient = new pg.Client({ connectionString: adminUrl.replace(/\/postgres$/, `/${db}`) });
  await dbClient.connect();
  const installed = await dbClient.query(`SELECT extname, extversion FROM pg_extension WHERE extname LIKE 'postgis%'`);
  console.log(`Installed in ${db}:`, installed.rows);
  await dbClient.end();
}

await client.end();
