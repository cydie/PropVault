import { Router } from 'express';
import { getOne, query } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { canAccessView } from '../rbac.js';

const router = Router();
router.use(authRequired);

router.get('/stats', async (req, res) => {
  try {
    if (!canAccessView(req.user.role, 'dashboard')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const land = (await getOne(
      `SELECT COUNT(*)::int AS c FROM land_properties WHERE is_deleted = FALSE OR is_deleted IS NULL`
    )).c;
    const buildings = (await getOne('SELECT COUNT(*)::int AS c FROM building_properties')).c;
    const pending = (
      await getOne(
        `SELECT COUNT(*)::int AS c FROM land_properties
         WHERE status IN ('Pending','Under Review') AND (is_deleted = FALSE OR is_deleted IS NULL)`
      )
    ).c;
    const underReview = (
      await getOne(
        `SELECT COUNT(*)::int AS c FROM land_properties
         WHERE status = 'Under Review' AND (is_deleted = FALSE OR is_deleted IS NULL)`
      )
    ).c;
    const approved = (
      await getOne(
        `SELECT COUNT(*)::int AS c FROM land_properties
         WHERE status = 'Approved' AND (is_deleted = FALSE OR is_deleted IS NULL)`
      )
    ).c;
    const rejected = (
      await getOne(
        `SELECT COUNT(*)::int AS c FROM land_properties
         WHERE status = 'Rejected' AND (is_deleted = FALSE OR is_deleted IS NULL)`
      )
    ).c;
    const encodedDraft = (
      await getOne(
        `SELECT COUNT(*)::int AS c FROM land_properties
         WHERE status = 'Pending' AND (is_deleted = FALSE OR is_deleted IS NULL)`
      )
    ).c;
    const encodedToday = (
      await getOne(
        `SELECT COUNT(*)::int AS c FROM land_properties
         WHERE created_at::date = CURRENT_DATE AND (is_deleted = FALSE OR is_deleted IS NULL)`
      )
    ).c;
    const certs = (await getOne('SELECT COUNT(*)::int AS c FROM certification_requests')).c;
    const certPending = (
      await getOne(
        `SELECT COUNT(*)::int AS c FROM certification_requests WHERE status IN ('Pending','Under Review')`
      )
    ).c;
    const users = (await getOne(`SELECT COUNT(*)::int AS c FROM users WHERE status = 'Active'`)).c;
    const payments = (await getOne('SELECT COUNT(*)::int AS c FROM tax_payments')).c;
    const paymentsPending = (
      await getOne(`SELECT COUNT(*)::int AS c FROM tax_payments WHERE status IN ('Pending','Validated')`)
    ).c;
    const paymentsApproved = (
      await getOne(`SELECT COUNT(*)::int AS c FROM tax_payments WHERE status = 'Approved'`)
    ).c;
    const receiptsIssued = (
      await getOne(`SELECT COUNT(*)::int AS c FROM tax_payments WHERE receipt_no IS NOT NULL AND receipt_no <> ''`)
    ).c;
    const paymentsApprovedToday = (
      await getOne(
        `SELECT COUNT(*)::int AS c FROM tax_payments
         WHERE status = 'Approved' AND updated_at::date = CURRENT_DATE`
      )
    ).c;

    const byBarangay = await query(
      `SELECT barangay AS name, COUNT(*)::int AS count FROM land_properties
       WHERE is_deleted = FALSE OR is_deleted IS NULL
       GROUP BY barangay ORDER BY count DESC LIMIT 8`
    );

    const byClass = await query(
      `SELECT classification AS name, COUNT(*)::int AS count FROM land_properties
       WHERE is_deleted = FALSE OR is_deleted IS NULL
       GROUP BY classification`
    );
    const colors = ['#22c55e', '#3b82f6', '#94a3b8', '#f59e0b', '#8b5cf6', '#ef4444'];
    const classData = byClass.map((c, i) => ({ name: c.name, value: c.count, color: colors[i % colors.length] }));

    const fiscalYear = new Date().getFullYear();
    const landByMonth = await query(
      `SELECT EXTRACT(MONTH FROM created_at)::int AS m, COUNT(*)::int AS c
       FROM land_properties WHERE EXTRACT(YEAR FROM created_at) = ? GROUP BY m`,
      [fiscalYear]
    );
    const certByMonth = await query(
      `SELECT EXTRACT(MONTH FROM created_at)::int AS m, COUNT(*)::int AS c
       FROM certification_requests WHERE EXTRACT(YEAR FROM created_at) = ? GROUP BY m`,
      [fiscalYear]
    );
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyData = MONTHS.map((month, idx) => {
      const m = idx + 1;
      return {
        month,
        assessments: landByMonth.find((r) => r.m === m)?.c ?? 0,
        certifications: certByMonth.find((r) => r.m === m)?.c ?? 0,
      };
    });

    // Monthly assessment movement (preceding vs present month) — Monthly Assessment Report style
    const now = new Date();
    const thisMonth = now.getMonth() + 1;
    const thisYear = now.getFullYear();
    const prevMonth = thisMonth === 1 ? 12 : thisMonth - 1;
    const prevYear = thisMonth === 1 ? thisYear - 1 : thisYear;

    const existingEndPreceding = (
      await getOne(
        `SELECT COUNT(*)::int AS c FROM land_properties
         WHERE (is_deleted = FALSE OR is_deleted IS NULL)
           AND created_at < make_date(?, ?, 1)`,
        [thisYear, thisMonth]
      )
    ).c;
    const newThisMonth = (
      await getOne(
        `SELECT COUNT(*)::int AS c FROM land_properties
         WHERE (is_deleted = FALSE OR is_deleted IS NULL)
           AND EXTRACT(YEAR FROM created_at) = ? AND EXTRACT(MONTH FROM created_at) = ?`,
        [thisYear, thisMonth]
      )
    ).c;
    const cancelledThisMonth = (
      await getOne(
        `SELECT COUNT(*)::int AS c FROM land_properties
         WHERE status = 'Rejected'
           AND EXTRACT(YEAR FROM COALESCE(updated_at, created_at)) = ?
           AND EXTRACT(MONTH FROM COALESCE(updated_at, created_at)) = ?`,
        [thisYear, thisMonth]
      )
    ).c;
    const endPresent = existingEndPreceding + newThisMonth;
    const assessedValueEnd = (
      await getOne(
        `SELECT COALESCE(SUM(
           NULLIF(regexp_replace(assessed_value, '[^0-9.]', '', 'g'), '')::numeric
         ), 0)::float AS v
         FROM land_properties WHERE is_deleted = FALSE OR is_deleted IS NULL`
      )
    ).v;

    const monthlyMovement = {
      month: MONTHS[thisMonth - 1],
      year: thisYear,
      precedingMonth: MONTHS[prevMonth - 1],
      precedingYear: prevYear,
      existingEndPreceding,
      newDuringPresent: newThisMonth,
      cancelledDuringPresent: cancelledThisMonth,
      endPresent,
      totalAssessedValue: assessedValueEnd,
    };

    const approvalQueue = await query(
      `SELECT id, td, pin, owner, barangay, status, assessed_value, created_at
       FROM land_properties
       WHERE status IN ('Pending','Under Review')
         AND (is_deleted = FALSE OR is_deleted IS NULL)
       ORDER BY created_at ASC LIMIT 12`
    );

    const payload = {
      totalProperties: land + buildings,
      landRecords: land,
      buildingRecords: buildings,
      pendingAssessments: pending,
      underReviewAssessments: underReview,
      encodedDraft: encodedDraft,
      encodedToday,
      approvedAssessments: approved,
      rejectedAssessments: rejected,
      certificationRequests: certs,
      certificationPending: certPending,
      activeUsers: users,
      archivedRecords: 0,
      brgyData: byBarangay,
      classData,
      monthlyData,
      monthlyMovement,
      approvalQueue: approvalQueue.map((r) => ({
        id: r.id,
        td: r.td,
        pin: r.pin,
        owner: r.owner,
        barangay: r.barangay,
        status: r.status,
        av: r.assessed_value,
      })),
      fiscalYear,
      paymentRecords: payments,
      paymentsPending,
      paymentsApproved,
      receiptsIssued,
      paymentsApprovedToday,
    };

    if (req.user.role === 'Treasury') {
      return res.json({
        paymentRecords: payments,
        paymentsPending,
        paymentsApproved,
        receiptsIssued,
        paymentsApprovedToday,
        totalProperties: land + buildings,
        landRecords: land,
        buildingRecords: buildings,
        fiscalYear,
      });
    }

    if (req.user.role === 'Staff Assessor') {
      return res.json({
        totalProperties: land + buildings,
        landRecords: land,
        buildingRecords: buildings,
        encodedDraft,
        encodedToday,
        pendingAssessments: pending,
        underReviewAssessments: underReview,
        approvedAssessments: approved,
        rejectedAssessments: rejected,
        brgyData: byBarangay,
        classData,
        fiscalYear,
      });
    }

    if (req.user.role === 'IT') {
      const auditEvents = (await getOne('SELECT COUNT(*)::int AS c FROM audit_logs')).c;
      const auditToday = (
        await getOne(`SELECT COUNT(*)::int AS c FROM audit_logs WHERE time::date = CURRENT_DATE`)
      ).c;
      return res.json({
        auditEvents,
        auditEventsToday: auditToday,
        activeUsers: users,
        paymentRecords: payments,
        certificationRequests: certs,
      });
    }

    res.json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load dashboard stats' });
  }
});

export default router;
