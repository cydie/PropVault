import bcrypt from 'bcryptjs';
import { initSchema, logAudit, getOne, run, syncOfficialBarangays } from './db.js';

await initSchema();

const countRow = await getOne('SELECT COUNT(*)::int AS c FROM users');
if (countRow.c > 0) {
  console.log('Database already seeded — syncing demo login accounts…');
  const { spawnSync } = await import('child_process');
  const { fileURLToPath } = await import('url');
  const { dirname, join } = await import('path');
  const script = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'sync-demo-users.js');
  spawnSync(process.execPath, [script], { stdio: 'inherit' });
  process.exit(0);
}

const hash = (p) => bcrypt.hashSync(p, 10);

const users = [
  ['U-001', 'System Administrator', 'sysadmin', 'admin@rizal.gov.ph', hash('Admin@2024'), 'Admin'],
  ['U-002', 'Maria Santos', 'm.santos', 'treasury@rizal.gov.ph', hash('Treasury@2024'), 'Treasury'],
  ['U-003', 'Engr. Anna Macaraeg', 'a.macaraeg', 'a.macaraeg@rizal.gov.ph', hash('Staff@2024'), 'Staff Assessor'],
  ['U-004', 'Mr. Carlo Tamayo', 'c.tamayo', 'c.tamayo@rizal.gov.ph', hash('Staff@2024'), 'Staff Assessor'],
  ['U-005', 'IT Support Officer', 'it.support', 'it@rizal.gov.ph', hash('IT@2024'), 'IT'],
];

for (const u of users) {
  await run(
    `INSERT INTO users (id, name, username, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?, 'Active')`,
    u
  );
}

const seedDemoRecords = process.env.SEED_DEMO_RECORDS === 'true';

const land = [
  ['P-24-0001', 'TD-2024-001234', '093-12-001-001', 'Santos, Maria Clara P.', 'Tagpicos', 'Residential', '450 sqm', '₱1,250,000', '₱375,000', 'Approved'],
  ['P-24-0002', 'TD-2024-001235', '093-12-001-002', 'Reyes, Juan dela Cruz', 'San Juan', 'Agricultural', '3,200 sqm', '₱640,000', '₱192,000', 'Pending'],
  ['P-24-0003', 'TD-2024-001236', '093-12-002-001', 'Dela Torre, Rosario M.', 'Narra', 'Commercial', '280 sqm', '₱2,100,000', '₱840,000', 'Approved'],
  ['P-24-0004', 'TD-2024-001237', '093-13-001-001', 'Garcia, Roberto S.', 'Rosario', 'Residential', '350 sqm', '₱875,000', '₱262,500', 'Under Review'],
  ['P-24-0005', 'TD-2024-001238', '093-14-001-001', 'Lim, Jennifer C.', 'Salvacion', 'Agricultural', '5,400 sqm', '₱1,080,000', '₱324,000', 'Approved'],
  ['P-24-0006', 'TD-2024-001239', '093-15-001-001', 'Mendoza, Antonio B.', 'Santa Cruz', 'Residential', '520 sqm', '₱1,560,000', '₱468,000', 'Rejected'],
  ['P-24-0007', 'TD-2024-001240', '093-16-001-001', 'Cruz, Teresita F.', 'Tabon', 'Special', '890 sqm', '₱0', '₱0', 'Exempt'],
  ['P-24-0008', 'TD-2024-001241', '093-17-001-001', 'Ramos, Francisco D.', 'Bagong Bayan', 'Commercial', '195 sqm', '₱1,462,500', '₱585,000', 'Approved'],
];
if (seedDemoRecords) {
  for (const r of land) {
    await run(
      `INSERT INTO land_properties (id, td, pin, owner, barangay, classification, area, market_value, assessed_value, status) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      r
    );
  }
}

const buildings = [
  ['B-24-0001', 'ARP-24-B001', '093-12-001-001-B', 'Santos, Maria Clara P.', 'Tagpicos', 'Residential House', 'Type I - Wood', '1', '120 sqm', '₱480,000', '₱144,000', 'Approved'],
  ['B-24-0002', 'ARP-24-B002', '093-12-002-001-B', 'Dela Torre, Rosario M.', 'Narra', 'Commercial Building', 'Type III - Concrete', '2', '340 sqm', '₱2,550,000', '₱1,020,000', 'Approved'],
  ['B-24-0003', 'ARP-24-B003', '093-13-001-001-B', 'Garcia, Roberto S.', 'Rosario', 'Residential House', 'Type II - Mixed', '1', '95 sqm', '₱285,000', '₱85,500', 'Pending'],
  ['B-24-0004', 'ARP-24-B004', '093-17-001-001-B', 'Ramos, Francisco D.', 'Bagong Bayan', 'Commercial Building', 'Type III - Concrete', '3', '780 sqm', '₱6,240,000', '₱2,496,000', 'Under Review'],
  ['B-24-0005', 'ARP-24-B005', '093-16-001-001-B', 'Cruz, Teresita F.', 'Tabon', 'Church/Religious', 'Type II - Mixed', '1', '220 sqm', '₱0', '₱0', 'Exempt'],
];
if (seedDemoRecords) {
  for (const r of buildings) {
    await run(
      `INSERT INTO building_properties (id, arp, pin, owner, barangay, kind, structural, floors, floor_area, market_value, assessed_value, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      r
    );
  }
}

const certs = [
  ['CR-24-0048', 'Tax Declaration Copy', 'Santos, Maria Clara P.', 'P-24-0001', 'U-005', 'Nov 18, 2024', 'Nov 25, 2024', 'Pending'],
  ['CR-24-0047', 'Assessment Certificate', 'Garcia, Roberto S.', 'P-24-0004', null, 'Nov 17, 2024', 'Nov 24, 2024', 'Under Review'],
  ['CR-24-0046', 'Certificate of Property Holdings', 'Lim, Jennifer C.', 'P-24-0005', 'U-007', 'Nov 15, 2024', 'Nov 22, 2024', 'Approved'],
  ['CR-24-0045', 'Verification Certificate', 'Mendoza, Antonio B.', 'P-24-0006', null, 'Nov 14, 2024', 'Nov 21, 2024', 'Rejected'],
  ['CR-24-0044', 'No Property Holdings Cert.', 'Cruz, Teresita F.', null, null, 'Nov 13, 2024', 'Nov 20, 2024', 'Released'],
  ['CR-24-0043', 'Tax Declaration Copy', 'Ramos, Francisco D.', 'P-24-0008', null, 'Nov 12, 2024', 'Nov 19, 2024', 'Released'],
  ['CR-24-0042', 'Assessment Certificate', 'Reyes, Juan dela Cruz', 'P-24-0002', 'U-006', 'Nov 10, 2024', 'Nov 17, 2024', 'Released'],
];
if (seedDemoRecords) {
  for (const r of certs) {
    await run(
      `INSERT INTO certification_requests (id, type, requestor, property_id, user_id, date, due, status) VALUES (?,?,?,?,?,?,?,?)`,
      r
    );
  }
}

const payments = [
  ['TP-24-0001', 'P-24-0001', 'Santos, Maria Clara P.', 'TD-2024-001234', '₱3,750', '2024', 'Nov 10, 2024', 'Approved', 'OR-2024-001', 'm.santos'],
  ['TP-24-0002', 'P-24-0002', 'Reyes, Juan dela Cruz', 'TD-2024-001235', '₱1,920', '2024', null, 'Pending', null, null],
  ['TP-24-0003', 'P-24-0005', 'Lim, Jennifer C.', 'TD-2024-001238', '₱3,240', '2024', 'Nov 5, 2024', 'Approved', 'OR-2024-002', 'm.santos'],
  ['TP-24-0004', 'P-24-0008', 'Ramos, Francisco D.', 'TD-2024-001241', '₱5,850', '2024', null, 'Validated', null, 'm.santos'],
];
if (seedDemoRecords) {
  for (const r of payments) {
    await run(
      `INSERT INTO tax_payments (id, property_id, owner, td, amount, tax_year, payment_date, status, receipt_no, validated_by) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      r
    );
  }
}

await syncOfficialBarangays();
for (const c of ['Agricultural', 'Residential', 'Commercial', 'Industrial', 'Special', 'Exempt']) {
  await run('INSERT INTO classifications (name) VALUES (?) ON CONFLICT (name) DO NOTHING', [c]);
}
for (const [n, r] of [
  ['Residential', 0.3],
  ['Agricultural', 0.3],
  ['Commercial', 0.4],
  ['Industrial', 0.5],
]) {
  await run('INSERT INTO assessment_levels (name, rate) VALUES (?, ?)', [n, r]);
}

const notifs = [
  ['U-001', 'success', 'Assessment Approved', 'TD-2024-001236 has been approved'],
  ['U-003', 'warning', 'Pending Certification', 'CR-24-0048 requires your review'],
  ['U-005', 'info', 'Backup Reminder', 'Scheduled database backup is due tonight'],
  ['U-002', 'warning', 'Payment Pending Validation', 'TP-24-0002 awaits treasury review'],
];
if (seedDemoRecords) {
  for (const n of notifs) {
    await run('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)', n);
  }
}

await logAudit('sysadmin', 'LOGIN', 'Authentication', 'Initial database seed completed', '127.0.0.1', 'green');
console.log('PropVault PostgreSQL database seeded successfully.');
process.exit(0);
