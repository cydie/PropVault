/**
 * Creates propvault_local database for Electron offline desktop mode.
 *   npm run db:setup-local
 */
import pg from 'pg';
import { loadServerEnv } from './loadEnv.js';

loadServerEnv();

const adminUrl =
  process.env.PG_ADMIN_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';

const DB_NAME = 'propvault_local';
const DB_USER = 'propvault';
const DB_PASS = process.env.PROPVAULT_DB_PASSWORD || 'propvault';

async function main() {
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();

  const userExists = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [DB_USER]);
  if (userExists.rowCount === 0) {
    await client.query(`CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}'`);
    console.log(`Created user: ${DB_USER}`);
  }

  const dbExists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [DB_NAME]);
  if (dbExists.rowCount === 0) {
    await client.query(`CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}`);
    console.log(`Created database: ${DB_NAME}`);
  } else {
    console.log(`Database already exists: ${DB_NAME}`);
  }

  await client.query(`GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER}`);
  await client.end();

  console.log('\nLocal Electron connection string:');
  console.log(`LOCAL_DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}`);
}

main().catch((err) => {
  console.error('Local DB setup failed:', err.message);
  process.exit(1);
});
