/**
 * Creates the propvault role and database on local PostgreSQL.
 * Run as a PostgreSQL superuser (default postgres account).
 *
 *   set PGPASSWORD=your_postgres_password
 *   node scripts/setup-db.js
 */
import pg from 'pg';
import { loadServerEnv } from './loadEnv.js';

loadServerEnv();

const adminUrl =
  process.env.PG_ADMIN_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';

const DB_NAME = 'propvault';
const DB_USER = 'propvault';
const DB_PASS = process.env.PROPVAULT_DB_PASSWORD || 'propvault';

async function main() {
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();

  const userExists = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [DB_USER]);
  if (userExists.rowCount === 0) {
    await client.query(`CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}'`);
    console.log(`Created user: ${DB_USER}`);
  } else {
    console.log(`User already exists: ${DB_USER}`);
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

  console.log('\nConnection string for server/.env:');
  console.log(`DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}`);
}

main().catch((err) => {
  console.error('Setup failed:', err.message);
  console.error('\nMake sure PostgreSQL is installed and running, then set PG_ADMIN_URL if needed:');
  console.error('  PG_ADMIN_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/postgres');
  process.exit(1);
});
