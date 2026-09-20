/**
 * PostgreSQL backup with timestamped filename.
 * Requires pg_dump in PATH.
 *
 *   node scripts/backup-db.js
 *   DATABASE_URL=... node scripts/backup-db.js
 *   LOCAL_DATABASE_URL=... node scripts/backup-db.js --local
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isLocal = process.argv.includes('--local');
const conn =
  (isLocal ? process.env.LOCAL_DATABASE_URL : process.env.DATABASE_URL) ||
  (isLocal
    ? 'postgresql://propvault:propvault@localhost:5432/propvault_local'
    : 'postgresql://propvault:propvault@localhost:5432/propvault');

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const label = isLocal ? 'local' : 'main';
const outDir = path.join(__dirname, '..', 'backups');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `propvault_${label}_${stamp}.dump`);

const child = spawn('pg_dump', ['-F', 'c', '-f', outFile, conn], { stdio: 'inherit', shell: true });

child.on('close', (code) => {
  if (code === 0) console.log(`Backup saved: ${outFile}`);
  else console.error('pg_dump failed — ensure PostgreSQL client tools are installed.');
  process.exit(code ?? 1);
});
