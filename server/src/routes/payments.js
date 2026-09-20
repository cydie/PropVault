import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, getOne, run, logAudit } from '../db.js';
import { NOTIFY } from '../notify.js';
import { authRequired, requirePermission } from '../middleware/auth.js';

const router = Router();
router.use(authRequired, requirePermission('payments:manage'));

router.get('/', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM tax_payments ORDER BY created_at DESC');
    res.json(
      rows.map((r) => ({
        id: r.id,
        propertyId: r.property_id,
        owner: r.owner,
        td: r.td,
        pin: r.pin || '',
        amount: r.amount,
        taxYear: r.tax_year,
        paymentDate: r.payment_date,
        status: r.status,
        receiptNo: r.receipt_no,
        validatedBy: r.validated_by,
        remarks: r.remarks,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load payment records' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { propertyId, owner, td, pin, amount, taxYear } = req.body;
    if (!owner || !amount || !taxYear) {
      return res.status(400).json({ error: 'Owner, amount, and tax year are required' });
    }
    const id = `TP-24-${uuidv4().slice(0, 4).toUpperCase()}`;
    await run(
      `INSERT INTO tax_payments (id, property_id, owner, td, pin, amount, tax_year, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending')`,
      [id, propertyId || null, owner, td || null, pin || '', amount, taxYear]
    );
    await logAudit(req.user.username, 'CREATE', 'Tax Payments', `Recorded payment ${id} for ${owner}`, req.ip, 'green');
    await NOTIFY.treasury(
      'warning',
      'Approval Required • Tax Payment',
      `${id} — ${owner} · ${amount} (${taxYear}) awaits validation`
    );
    res.status(201).json({ id, status: 'Pending' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create payment record' });
  }
});

router.patch('/:id/status', requirePermission('payments:approve'), async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const valid = ['Pending', 'Validated', 'Approved', 'Rejected'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const existing = await getOne('SELECT * FROM tax_payments WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Payment not found' });

    const receiptNo =
      status === 'Approved'
        ? existing.receipt_no || `OR-${Date.now().toString(36).toUpperCase()}`
        : existing.receipt_no;
    const paymentDate =
      status === 'Approved'
        ? new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : existing.payment_date;

    await run(
      `UPDATE tax_payments SET status = ?, remarks = ?, receipt_no = ?, payment_date = ?,
       validated_by = ?, updated_at = NOW() WHERE id = ?`,
      [status, remarks || null, receiptNo, paymentDate, req.user.username, req.params.id]
    );

    await logAudit(
      req.user.username,
      status === 'Approved' ? 'APPROVE' : 'UPDATE',
      'Tax Payments',
      `${req.params.id} → ${status}${remarks ? ': ' + remarks : ''}`,
      req.ip,
      status === 'Approved' ? 'green' : status === 'Rejected' ? 'red' : 'blue'
    );

    if (status === 'Approved') {
      await NOTIFY.treasury('success', 'Done • Payment Approved', `${req.params.id} receipt ${receiptNo} issued`);
    } else if (status === 'Rejected') {
      await NOTIFY.treasury('error', 'Payment Rejected', `${req.params.id} was rejected`);
    }

    res.json({ success: true, receiptNo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update payment status' });
  }
});

router.delete('/:id', requirePermission('records:delete'), async (req, res) => {
  try {
    const existing = await getOne('SELECT id FROM tax_payments WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Payment not found' });
    await run('DELETE FROM tax_payments WHERE id = ?', [req.params.id]);
    await logAudit(req.user.username, 'DELETE', 'Tax Payments', `Deleted payment ${req.params.id}`, req.ip, 'red');
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete payment' });
  }
});

export default router;
