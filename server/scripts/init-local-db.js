/** Initialize schema on local PostgreSQL (Electron offline). */
process.env.DATABASE_URL =
  process.env.LOCAL_DATABASE_URL ||
  'postgresql://propvault:propvault@localhost:5432/propvault_local';

const { initSchema } = await import('../src/db.js');

await initSchema();
console.log('Local PostgreSQL schema initialized:', process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@'));
process.exit(0);
