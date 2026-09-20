import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { mkdirSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { query, getOne, run, logAudit } from '../db.js';
import { NOTIFY, notifyUser } from '../notify.js';
import { authRequired, requirePermission } from '../middleware/auth.js';
import { ROLES } from '../rbac.js';
import { parsePagination, paginatedResponse } from '../lib/pagination.js';
import { parseCsv, pick } from '../lib/csvParse.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOFT_COPY_ROOT = join(__dirname, '../../uploads/property-soft-copies');
if (!existsSync(SOFT_COPY_ROOT)) mkdirSync(SOFT_COPY_ROOT, { recursive: true });

const upload = multer({
  dest: SOFT_COPY_ROOT,
  limits: { fileSize: 25 * 1024 * 1024, files: 40 },
  fileFilter(_req, file, cb) {
    const ok =
      /csv|plain|pdf|jpeg|jpg|png|webp|tiff|msword|officedocument|spreadsheetml/i.test(file.mimetype) ||
      /\.(csv|pdf|jpe?g|png|webp|tif{1,2}|doc|docx|xls|xlsx)$/i.test(file.originalname);
    cb(ok ? null : new Error('Unsupported file type'), ok);
  },
});

const router = Router();
router.use(authRequired);

function treasuryReadOnly(req, res, next) {
  if (req.user.role === ROLES.TREASURY && req.method !== 'GET') {
    return res.status(403).json({ error: 'Treasury accounts have read-only property access' });
  }
  next();
}

router.use(treasuryReadOnly);

function mapLandRow(r) {
  return {
    id: r.id,
    td: r.td,
    pin: r.pin,
    owner: r.owner,
    barangay: r.barangay,
    classification: r.classification,
    area: r.area,
    mv: r.market_value,
    av: r.assessed_value,
    status: r.status,
    remarks: r.remarks || '',
    syncStatus: r.sync_status,
    serverId: r.server_id,
    localId: r.local_id,
    lastModified: r.last_modified,
  };
}

router.get('/land', requirePermission('properties:view'), async (req, res) => {
  try {
    const usePagination = req.query.page !== undefined || req.query.limit !== undefined || req.query.search;
    if (!usePagination) {
      const rows = await query(
        `SELECT * FROM land_properties WHERE is_deleted = FALSE OR is_deleted IS NULL ORDER BY created_at DESC`
      );
      return res.json(rows.map(mapLandRow));
    }

    const { page, limit, offset, search } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 200 });
    const status = String(req.query.status || '').trim();
    const barangay = String(req.query.barangay || '').trim();

    const conditions = ['(is_deleted = FALSE OR is_deleted IS NULL)'];
    const params = [];

    if (search) {
      conditions.push(
        `(owner ILIKE ? OR pin ILIKE ? OR td ILIKE ? OR barangay ILIKE ?)`
      );
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (barangay) {
      conditions.push('barangay = ?');
      params.push(barangay);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const total = (await getOne(`SELECT COUNT(*)::int AS c FROM land_properties ${where}`, params)).c;
    const rows = await query(
      `SELECT * FROM land_properties ${where} ORDER BY last_modified DESC NULLS LAST, created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    res.json(paginatedResponse(rows.map(mapLandRow), total, page, limit));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load land records' });
  }
});

router.post('/land', requirePermission('records:create'), async (req, res) => {
  try {
    const b = req.body;
    const id = b.id || `P-24-${uuidv4().slice(0, 4).toUpperCase()}`;
    await run(
      `INSERT INTO land_properties (id, td, pin, owner, barangay, classification, area, market_value, assessed_value, status, details_json, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?)`,
      [
        id,
        b.td,
        b.pin,
        b.owner,
        b.barangay,
        b.classification,
        b.area,
        b.mv || b.market_value,
        b.av || b.assessed_value,
        b.status || 'Pending',
        JSON.stringify(b.details || b.details_json || {}),
        req.user.id,
      ]
    );
    await logAudit(req.user.username, 'CREATE', 'Land Records', `Encoded land record ${id}`, req.ip, 'green');
    const status = b.status || 'Pending';
    if (status === 'Pending' || status === 'Under Review') {
      await NOTIFY.approvers(
        'warning',
        'Approval Required • Land Assessment',
        `${id} — ${b.owner} (${b.td}) needs assessment review`
      );
    }
    res.status(201).json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create land record' });
  }
});

router.put('/land/:id', requirePermission('records:edit'), async (req, res) => {
  try {
    const b = req.body;
    const existing = await getOne(
      `SELECT id FROM land_properties WHERE id = ? AND (is_deleted = FALSE OR is_deleted IS NULL)`,
      [req.params.id]
    );
    if (!existing) return res.status(404).json({ error: 'Record not found' });

    await run(
      `UPDATE land_properties SET
         td = ?, pin = ?, owner = ?, barangay = ?, classification = ?, area = ?,
         market_value = ?, assessed_value = ?, status = COALESCE(?, status),
         details_json = COALESCE(?::jsonb, details_json),
         updated_at = NOW()
       WHERE id = ?`,
      [
        b.td,
        b.pin,
        b.owner,
        b.barangay,
        b.classification,
        b.area,
        b.mv || b.market_value,
        b.av || b.assessed_value,
        b.status || null,
        b.details || b.details_json ? JSON.stringify(b.details || b.details_json) : null,
        req.params.id,
      ]
    );
    await logAudit(req.user.username, 'UPDATE', 'Land Records', `Updated land record ${req.params.id}`, req.ip, 'blue');
    res.json({ id: req.params.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update land record' });
  }
});

router.patch('/land/:id/status', async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const allowed = ['Pending', 'Under Review', 'Approved', 'Rejected', 'Exempt'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const record = await getOne(
      `SELECT * FROM land_properties WHERE id = ? AND (is_deleted = FALSE OR is_deleted IS NULL)`,
      [req.params.id]
    );
    if (!record) return res.status(404).json({ error: 'Record not found' });

    const role = req.user.role;
    const isAdmin = role === ROLES.ADMIN;
    // Staff may submit (Under Review) or withdraw to Pending; only Admin final-approves / returns
    if (status === 'Under Review' || (status === 'Pending' && record.status === 'Under Review')) {
      if (!isAdmin && role !== ROLES.STAFF_ASSESSOR) {
        return res.status(403).json({ error: 'Cannot submit assessments' });
      }
    } else if (status === 'Approved' || status === 'Rejected' || status === 'Exempt') {
      if (!isAdmin) {
        return res.status(403).json({ error: 'Only the Municipal Assessor (Admin) can approve or return assessments' });
      }
      if (status === 'Rejected' && !String(remarks || '').trim()) {
        return res.status(400).json({ error: 'Remarks are required when returning an assessment' });
      }
    } else {
      return res.status(403).json({ error: 'Status transition not allowed' });
    }

    await run(
      `UPDATE land_properties SET status = ?, remarks = COALESCE(?, remarks), updated_at = NOW() WHERE id = ?`,
      [status, remarks != null ? String(remarks) : null, req.params.id]
    );

    const action =
      status === 'Approved' ? 'APPROVE' : status === 'Rejected' ? 'RETURN' : status === 'Under Review' ? 'SUBMIT' : 'UPDATE';
    await logAudit(
      req.user.username,
      action,
      'Assessments',
      `Land ${req.params.id} → ${status}${remarks ? ': ' + remarks : ''}`,
      req.ip,
      status === 'Approved' ? 'green' : status === 'Rejected' ? 'red' : 'blue'
    );

    if (record.created_by) {
      await notifyUser(
        record.created_by,
        status === 'Approved' ? 'success' : status === 'Rejected' ? 'error' : 'info',
        status === 'Approved'
          ? 'Done • Assessment Approved'
          : status === 'Rejected'
            ? 'Assessment Returned'
            : status === 'Under Review'
              ? 'Submitted for Approval'
              : 'Assessment Updated',
        `Land record ${req.params.id} is now ${status}${remarks ? ` — ${remarks}` : ''}`
      );
    }

    if (status === 'Under Review') {
      await NOTIFY.approvers(
        'warning',
        'Approval Required • Land Assessment',
        `${req.params.id} — ${record.owner} (${record.td}) submitted for review`
      );
    }

    res.json({ success: true, status, remarks: remarks || record.remarks || '' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

router.get('/lookup', requirePermission('properties:view'), async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.status(400).json({ error: 'Search query required' });
    const like = `%${q}%`;
    const land = await query(
      `SELECT id, td, pin, owner, barangay, classification, area, market_value, assessed_value, status
       FROM land_properties
       WHERE (is_deleted = FALSE OR is_deleted IS NULL)
         AND (td ILIKE ? OR pin ILIKE ? OR owner ILIKE ? OR id ILIKE ?)
       ORDER BY updated_at DESC NULLS LAST LIMIT 20`,
      [like, like, like, like]
    );
    const buildings = await query(
      `SELECT id, arp, pin, owner, barangay, kind, market_value, assessed_value, status
       FROM building_properties
       WHERE arp ILIKE ? OR pin ILIKE ? OR owner ILIKE ? OR id ILIKE ?
       ORDER BY created_at DESC LIMIT 20`,
      [like, like, like, like]
    );
    res.json({
      results: [
        ...land.map((r) => ({
          type: 'land',
          id: r.id,
          td: r.td,
          pin: r.pin,
          owner: r.owner,
          barangay: r.barangay,
          classification: r.classification,
          mv: r.market_value,
          av: r.assessed_value,
          status: r.status,
        })),
        ...buildings.map((r) => ({
          type: 'building',
          id: r.id,
          td: r.arp,
          pin: r.pin,
          owner: r.owner,
          barangay: r.barangay,
          classification: r.kind,
          mv: r.market_value,
          av: r.assessed_value,
          status: r.status,
        })),
      ],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lookup failed' });
  }
});

router.get('/buildings', requirePermission('properties:view'), async (req, res) => {
  try {
    const rows = await query('SELECT * FROM building_properties ORDER BY created_at DESC');
    res.json(
      rows.map((r) => ({
        id: r.id,
        arp: r.arp,
        pin: r.pin,
        owner: r.owner,
        barangay: r.barangay,
        kind: r.kind,
        structural: r.structural,
        floors: r.floors,
        floorArea: r.floor_area,
        mv: r.market_value,
        av: r.assessed_value,
        status: r.status,
        remarks: r.remarks || '',
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load building records' });
  }
});

router.post('/buildings', requirePermission('records:create'), async (req, res) => {
  try {
    const b = req.body;
    const id = b.id || `B-24-${uuidv4().slice(0, 4).toUpperCase()}`;
    await run(
      `INSERT INTO building_properties (id, arp, pin, owner, barangay, kind, structural, floors, floor_area, market_value, assessed_value, status, details_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)`,
      [
        id,
        b.arp,
        b.pin,
        b.owner,
        b.barangay,
        b.kind,
        b.structural,
        b.floors,
        b.floorArea || b.floor_area,
        b.mv || b.market_value,
        b.av || b.assessed_value || '0',
        b.status || 'Pending',
        JSON.stringify(b.details || b.details_json || {}),
      ]
    );
    await logAudit(req.user.username, 'CREATE', 'Property Records', `Encoded building ${id}`, req.ip, 'green');
    res.status(201).json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create building record' });
  }
});

router.put('/buildings/:id', requirePermission('records:edit'), async (req, res) => {
  try {
    const b = req.body;
    const existing = await getOne('SELECT id FROM building_properties WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Record not found' });

    await run(
      `UPDATE building_properties SET
         arp = ?, pin = ?, owner = ?, barangay = ?, kind = ?, structural = ?, floors = ?,
         floor_area = ?, market_value = ?, assessed_value = ?, status = COALESCE(?, status),
         details_json = COALESCE(?::jsonb, details_json)
       WHERE id = ?`,
      [
        b.arp,
        b.pin,
        b.owner,
        b.barangay,
        b.kind,
        b.structural,
        b.floors,
        b.floorArea || b.floor_area,
        b.mv || b.market_value,
        b.av || b.assessed_value,
        b.status || null,
        b.details || b.details_json ? JSON.stringify(b.details || b.details_json) : null,
        req.params.id,
      ]
    );
    await logAudit(req.user.username, 'UPDATE', 'Property Records', `Updated building ${req.params.id}`, req.ip, 'blue');
    res.json({ id: req.params.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update building record' });
  }
});

router.patch('/buildings/:id/status', async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const allowed = ['Pending', 'Under Review', 'Approved', 'Rejected', 'Exempt'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const record = await getOne('SELECT * FROM building_properties WHERE id = ?', [req.params.id]);
    if (!record) return res.status(404).json({ error: 'Record not found' });

    const isAdmin = req.user.role === ROLES.ADMIN;
    if (status === 'Under Review' || status === 'Pending') {
      if (!isAdmin && req.user.role !== ROLES.STAFF_ASSESSOR) {
        return res.status(403).json({ error: 'Cannot submit assessments' });
      }
    } else if (!isAdmin) {
      return res.status(403).json({ error: 'Only Admin can approve or return building assessments' });
    }

    await run(
      `UPDATE building_properties SET status = ?, remarks = COALESCE(?, remarks) WHERE id = ?`,
      [status, remarks != null ? String(remarks) : null, req.params.id]
    );
    await logAudit(req.user.username, 'UPDATE', 'Assessments', `Building ${req.params.id} → ${status}`, req.ip, 'green');
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

router.get('/verify', requirePermission('properties:view'), async (req, res) => {
  try {
    const q = (req.query.q || '').toString().toLowerCase();
    if (!q) return res.status(400).json({ error: 'Search query required' });
    const land = await query(
      `SELECT id, td, pin, owner, barangay, classification, status FROM land_properties
       WHERE LOWER(td) LIKE ? OR LOWER(pin) LIKE ? OR LOWER(owner) LIKE ? OR LOWER(id) LIKE ?`,
      [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`]
    );
    const ref = `VR-${Date.now().toString(36).toUpperCase()}`;
    res.json({ reference: ref, results: land });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

const LAND_CSV_TEMPLATE =
  'td,pin,owner,barangay,classification,area,market_value,assessed_value,status\n' +
  '24-14-0001-00001,066-14-001-015-(0001),SAMPLE OWNER,Punta Baja (Poblacion),Residential,500 sqm,100000.00,20000.00,Pending\n';

const BUILDING_CSV_TEMPLATE =
  'arp,pin,owner,barangay,kind,structural,floors,floor_area,market_value,assessed_value,status\n' +
  'ARP-24-0001,066-14-001-015-(0001)-1001,SAMPLE OWNER,Punta Baja (Poblacion),Residential,Reinforced Concrete,1,80 sqm,18500.00,3700.00,Pending\n';

router.get('/templates/land.csv', requirePermission('documents:upload'), (_req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="land-plants-trees-template.csv"');
  res.send(LAND_CSV_TEMPLATE);
});

router.get('/templates/buildings.csv', requirePermission('documents:upload'), (_req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="buildings-structures-template.csv"');
  res.send(BUILDING_CSV_TEMPLATE);
});

router.post(
  '/land/import',
  requirePermission('documents:upload'),
  upload.single('file'),
  async (req, res) => {
    try {
      const text = req.file
        ? await readFile(req.file.path, 'utf8')
        : String(req.body.csv || req.body.text || '');
      if (!text.trim()) return res.status(400).json({ error: 'CSV file or text required' });

      const rows = parseCsv(text);
      if (!rows.length) return res.status(400).json({ error: 'No data rows found in CSV' });

      const created = [];
      const errors = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const td = pick(row, 'td', 'td_no', 'td_number', 'tax_declaration');
        const pin = pick(row, 'pin', 'property_index_number');
        const owner = pick(row, 'owner', 'owner_name', 'property_owner');
        const barangay = pick(row, 'barangay', 'brgy', 'brgy_district');
        const classification = pick(row, 'classification', 'class', 'actual_use', 'type_ng_lupa') || 'Agricultural';
        const area = pick(row, 'area', 'land_area') || '0';
        const mv = pick(row, 'market_value', 'mv', 'base_market_value') || '0';
        const av = pick(row, 'assessed_value', 'av') || '0';
        const status = pick(row, 'status') || 'Pending';

        if (!td || !pin || !owner || !barangay) {
          errors.push({ row: i + 2, error: 'Missing required td, pin, owner, or barangay' });
          continue;
        }

        const existing = await getOne(
          `SELECT id FROM land_properties WHERE (td = ? OR pin = ?) AND (is_deleted = FALSE OR is_deleted IS NULL) LIMIT 1`,
          [td, pin]
        );
        if (existing) {
          errors.push({ row: i + 2, error: `Duplicate TD/PIN already exists (${existing.id})`, id: existing.id });
          continue;
        }

        const id = `P-24-${uuidv4().slice(0, 4).toUpperCase()}`;
        await run(
          `INSERT INTO land_properties (id, td, pin, owner, barangay, classification, area, market_value, assessed_value, status, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, td, pin, owner, barangay, classification, area, mv, av, status, req.user.id]
        );
        created.push({ id, td, pin, owner });
      }

      await logAudit(
        req.user.username,
        'IMPORT',
        'Land Records',
        `Bulk imported ${created.length} land records (${errors.length} skipped)`,
        req.ip,
        'green'
      );

      if (created.length) {
        await NOTIFY.approvers(
          'info',
          'Bulk Land Import',
          `${created.length} land/plants-trees record(s) uploaded by ${req.user.username}`
        );
      }

      res.status(201).json({ created: created.length, skipped: errors.length, records: created, errors });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message || 'Land import failed' });
    }
  }
);

router.post(
  '/buildings/import',
  requirePermission('documents:upload'),
  upload.single('file'),
  async (req, res) => {
    try {
      const text = req.file
        ? await readFile(req.file.path, 'utf8')
        : String(req.body.csv || req.body.text || '');
      if (!text.trim()) return res.status(400).json({ error: 'CSV file or text required' });

      const rows = parseCsv(text);
      if (!rows.length) return res.status(400).json({ error: 'No data rows found in CSV' });

      const created = [];
      const errors = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const arp = pick(row, 'arp', 'arp_no', 'arpn', 'td', 'td_no');
        const pin = pick(row, 'pin', 'property_index_number');
        const owner = pick(row, 'owner', 'owner_name', 'property_owner');
        const barangay = pick(row, 'barangay', 'brgy');
        const kind = pick(row, 'kind', 'kind_of_building') || 'Residential';
        const structural = pick(row, 'structural', 'structural_type') || '—';
        const floors = pick(row, 'floors', 'no_of_floors') || '1';
        const floorArea = pick(row, 'floor_area', 'floorarea', 'area') || '0';
        const mv = pick(row, 'market_value', 'mv') || '0';
        const av = pick(row, 'assessed_value', 'av') || '0';
        const status = pick(row, 'status') || 'Pending';

        if (!arp || !pin || !owner || !barangay) {
          errors.push({ row: i + 2, error: 'Missing required arp, pin, owner, or barangay' });
          continue;
        }

        const existing = await getOne(
          `SELECT id FROM building_properties WHERE arp = ? OR pin = ? LIMIT 1`,
          [arp, pin]
        );
        if (existing) {
          errors.push({ row: i + 2, error: `Duplicate ARP/PIN already exists (${existing.id})`, id: existing.id });
          continue;
        }

        const id = `B-24-${uuidv4().slice(0, 4).toUpperCase()}`;
        await run(
          `INSERT INTO building_properties (id, arp, pin, owner, barangay, kind, structural, floors, floor_area, market_value, assessed_value, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, arp, pin, owner, barangay, kind, structural, floors, floorArea, mv, av, status]
        );
        created.push({ id, arp, pin, owner });
      }

      await logAudit(
        req.user.username,
        'IMPORT',
        'Property Records',
        `Bulk imported ${created.length} building records (${errors.length} skipped)`,
        req.ip,
        'green'
      );

      res.status(201).json({ created: created.length, skipped: errors.length, records: created, errors });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message || 'Building import failed' });
    }
  }
);

async function resolveProperty(propertyType, { propertyId, pin, tdOrArp }) {
  if (propertyType === 'land') {
    if (propertyId) {
      const row = await getOne(
        `SELECT id, pin, td FROM land_properties WHERE id = ? AND (is_deleted = FALSE OR is_deleted IS NULL)`,
        [propertyId]
      );
      if (row) return { id: row.id, pin: row.pin, tdOrArp: row.td };
    }
    if (pin || tdOrArp) {
      const row = await getOne(
        `SELECT id, pin, td FROM land_properties
         WHERE (is_deleted = FALSE OR is_deleted IS NULL)
           AND (LOWER(pin) = LOWER(?) OR LOWER(td) = LOWER(?))
         LIMIT 1`,
        [pin || tdOrArp, tdOrArp || pin]
      );
      if (row) return { id: row.id, pin: row.pin, tdOrArp: row.td };
    }
  } else {
    if (propertyId) {
      const row = await getOne(`SELECT id, pin, arp FROM building_properties WHERE id = ?`, [propertyId]);
      if (row) return { id: row.id, pin: row.pin, tdOrArp: row.arp };
    }
    if (pin || tdOrArp) {
      const row = await getOne(
        `SELECT id, pin, arp FROM building_properties
         WHERE LOWER(pin) = LOWER(?) OR LOWER(arp) = LOWER(?)
         LIMIT 1`,
        [pin || tdOrArp, tdOrArp || pin]
      );
      if (row) return { id: row.id, pin: row.pin, tdOrArp: row.arp };
    }
  }
  return null;
}

function guessKeyFromFilename(name) {
  const base = String(name || '').replace(/\.[^.]+$/, '');
  const tdMatch = base.match(/\d{2}-\d{2}-\d{4}-\d{4,}/);
  if (tdMatch) return { tdOrArp: tdMatch[0], pin: '' };
  const pinMatch = base.match(/066-\d{2}-\d{3}-\d{3}.+/i) || base.match(/\d{3}-\d{2,3}-\([^)]+\)-\d+/);
  if (pinMatch) return { pin: pinMatch[0], tdOrArp: '' };
  return { pin: '', tdOrArp: base };
}

router.post(
  '/soft-copies',
  requirePermission('documents:upload'),
  upload.array('files', 40),
  async (req, res) => {
    try {
      const propertyType = String(req.body.propertyType || req.body.property_type || '').toLowerCase();
      if (propertyType !== 'land' && propertyType !== 'building') {
        return res.status(400).json({ error: 'propertyType must be land or building' });
      }

      const files = req.files || [];
      if (!files.length) return res.status(400).json({ error: 'At least one soft-copy file is required' });

      const bodyPin = String(req.body.pin || '').trim();
      const bodyTd = String(req.body.td || req.body.arp || req.body.tdOrArp || '').trim();
      const bodyPropertyId = String(req.body.propertyId || req.body.property_id || '').trim();

      const saved = [];
      const unmatched = [];

      for (const file of files) {
        const guessed = guessKeyFromFilename(file.originalname);
        const pin = bodyPin || guessed.pin;
        const tdOrArp = bodyTd || guessed.tdOrArp;
        const matched = await resolveProperty(propertyType, {
          propertyId: bodyPropertyId,
          pin,
          tdOrArp,
        });

        const storedName = `${Date.now()}-${uuidv4().slice(0, 8)}${extname(file.originalname) || ''}`;
        const destRel = `property-soft-copies/${storedName}`;
        const destAbs = join(SOFT_COPY_ROOT, storedName);
        const { rename } = await import('node:fs/promises');
        await rename(file.path, destAbs);

        const row = await getOne(
          `INSERT INTO property_soft_copies
             (property_type, property_id, pin, td_or_arp, original_name, stored_name, mime_type, size_bytes, file_path, uploaded_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           RETURNING id, property_type, property_id, pin, td_or_arp, original_name, mime_type, size_bytes, file_path, created_at`,
          [
            propertyType,
            matched?.id || null,
            matched?.pin || pin || '',
            matched?.tdOrArp || tdOrArp || '',
            file.originalname,
            storedName,
            file.mimetype || '',
            file.size || 0,
            destRel,
            req.user.id,
          ]
        );

        const entry = {
          id: row.id,
          propertyType: row.property_type,
          propertyId: row.property_id,
          pin: row.pin,
          tdOrArp: row.td_or_arp,
          originalName: row.original_name,
          mimeType: row.mime_type,
          sizeBytes: row.size_bytes,
          url: `/uploads/${row.file_path}`,
          matched: Boolean(matched),
          createdAt: row.created_at,
        };
        if (matched) saved.push(entry);
        else unmatched.push(entry);
      }

      await logAudit(
        req.user.username,
        'UPLOAD',
        propertyType === 'land' ? 'Land Records' : 'Property Records',
        `Uploaded ${files.length} soft cop${files.length === 1 ? 'y' : 'ies'} (${saved.length} matched)`,
        req.ip,
        'green'
      );

      res.status(201).json({
        uploaded: files.length,
        matched: saved.length,
        unmatched: unmatched.length,
        files: [...saved, ...unmatched],
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message || 'Soft copy upload failed' });
    }
  }
);

router.get('/soft-copies', requirePermission('properties:view'), async (req, res) => {
  try {
    const propertyType = String(req.query.propertyType || '').toLowerCase();
    const propertyId = String(req.query.propertyId || '').trim();
    const pin = String(req.query.pin || '').trim();

    const conditions = [];
    const params = [];
    if (propertyType === 'land' || propertyType === 'building') {
      conditions.push('property_type = ?');
      params.push(propertyType);
    }
    if (propertyId) {
      conditions.push('property_id = ?');
      params.push(propertyId);
    }
    if (pin) {
      conditions.push('pin = ?');
      params.push(pin);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await query(
      `SELECT * FROM property_soft_copies ${where} ORDER BY created_at DESC LIMIT 200`,
      params
    );
    res.json(
      rows.map((r) => ({
        id: r.id,
        propertyType: r.property_type,
        propertyId: r.property_id,
        pin: r.pin,
        tdOrArp: r.td_or_arp,
        originalName: r.original_name,
        mimeType: r.mime_type,
        sizeBytes: r.size_bytes,
        url: `/uploads/${r.file_path}`,
        createdAt: r.created_at,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list soft copies' });
  }
});

export default router;
