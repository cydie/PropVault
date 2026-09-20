/**
 * Ensures standard demo accounts exist with correct passwords.
 * Safe to run anytime — upserts by username (does not delete other users).
 */
import bcrypt from 'bcryptjs';
import { initSchema, getOne, run } from '../src/db.js';

const DEMO_USERS = [
  { id: 'U-001', name: 'System Administrator', username: 'sysadmin', email: 'admin@rizal.gov.ph', password: 'Admin@2024', role: 'Admin' },
  { id: 'U-002', name: 'Maria Santos', username: 'm.santos', email: 'treasury@rizal.gov.ph', password: 'Treasury@2024', role: 'Treasury' },
  { id: 'U-003', name: 'Engr. Anna Macaraeg', username: 'a.macaraeg', email: 'a.macaraeg@rizal.gov.ph', password: 'Staff@2024', role: 'Staff Assessor' },
  { id: 'U-004', name: 'Mr. Carlo Tamayo', username: 'c.tamayo', email: 'c.tamayo@rizal.gov.ph', password: 'Staff@2024', role: 'Staff Assessor' },
  { id: 'U-005', name: 'IT Support Officer', username: 'it.support', email: 'it@rizal.gov.ph', password: 'IT@2024', role: 'IT' },
];

await initSchema();

for (const u of DEMO_USERS) {
  const hash = bcrypt.hashSync(u.password, 10);
  const existing = await getOne('SELECT id FROM users WHERE username = ?', [u.username]);
  if (existing) {
    await run(
      `UPDATE users SET name = ?, email = ?, password_hash = ?, role = ?, status = 'Active',
       failed_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE username = ?`,
      [u.name, u.email, hash, u.role, u.username]
    );
    console.log(`Updated demo user: ${u.username} (${u.role})`);
  } else {
    let id = u.id;
    const idTaken = await getOne('SELECT id FROM users WHERE id = ?', [id]);
    if (idTaken) id = `DEMO-${u.username}`;
    await run(
      `INSERT INTO users (id, name, username, email, password_hash, role, status)
       VALUES (?, ?, ?, ?, ?, ?, 'Active')`,
      [id, u.name, u.username, u.email, hash, u.role]
    );
    console.log(`Created demo user: ${u.username} (${u.role}) as ${id}`);
  }
}

console.log('Demo accounts ready.');
process.exit(0);
