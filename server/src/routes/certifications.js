import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, getOne, run, logAudit } from '../db.js';
import { NOTIFY, notifyUser } from '../notify.js';
import { authRequired, requirePermission } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

router.get('/', requirePermission('properties:view'), async (req, res) => {
  try {
    const rows = await query('SELECT * FROM certification_requests ORDER BY created_at DESC');
    res.json(
      rows.map((r) => ({
        id: r.id,
        type: r.type,
        requestor: r.requestor,
        pid: r.property_id || '—',
        date: r.date,
        due: r.due,
        status: r.status,
        remarks: r.remarks,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load certifications' });
  }
});

router.post('/', requirePermission('certifications:request'), async (req, res) => {
  try {
    const { type, property_id } = req.body;
    const types = [
      'Tax Declaration Copy',
      'Certificate of Property Holdings',
      'No Property Holdings Certificate',
      'Assessment Certificate',
      'Verification Certificate',
    ];
    if (!types.includes(type)) return res.status(400).json({ error: 'Invalid certificate type' });

    const id = `CR-24-${uuidv4().slice(0, 4).toUpperCase()}`;
    const now = new Date();
    const due = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const dueStr = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const userRow = await getOne('SELECT name FROM users WHERE id = ?', [req.user.id]);
    await run(
      `INSERT INTO certification_requests (id, type, requestor, property_id, user_id, date, due, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending')`,
      [id, type, userRow.name, property_id || null, req.user.id, dateStr, dueStr]
    );

    await logAudit(req.user.username, 'REQUEST', 'Certifications', `Submitted ${type} (${id})`, req.ip, 'amber');

    await NOTIFY.approvers(
      'warning',
      'Approval Required • Certification',
      `${id} — ${type} from ${userRow.name} needs review`
    );

    res.status(201).json({ id, status: 'Pending' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create certification request' });
  }
});

router.patch('/:id/status', requirePermission('certifications:approve'), async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const cert = await getOne('SELECT * FROM certification_requests WHERE id = ?', [req.params.id]);
    if (!cert) return res.status(404).json({ error: 'Request not found' });

    await run('UPDATE certification_requests SET status = ?, remarks = ? WHERE id = ?', [status, remarks || null, req.params.id]);
    await logAudit(
      req.user.username,
      status === 'Approved' ? 'APPROVE' : 'REJECT',
      'Certifications',
      `${req.params.id} → ${status}`,
      req.ip,
      status === 'Rejected' ? 'red' : 'green'
    );

    if (cert.user_id) {
      await notifyUser(
        cert.user_id,
        status === 'Approved' ? 'success' : 'error',
        status === 'Approved' ? 'Done • Certification Approved' : 'Certification Rejected',
        `Your request ${req.params.id} is now ${status}`
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update certification' });
  }
});

export default router;
