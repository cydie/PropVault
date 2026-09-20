import { Router } from 'express';
import { query } from '../db.js';
import { authRequired, requirePermission } from '../middleware/auth.js';

const router = Router();
router.use(authRequired, requirePermission('audit:access'));

router.get('/', async (req, res) => {
  try {
    const module = req.query.module;
    let rows = await query('SELECT * FROM audit_logs ORDER BY time DESC LIMIT 100');
    if (module && module !== 'All') {
      rows = rows.filter((r) => r.module === module);
    }
    res.json(
      rows.map((r) => ({
        id: r.id,
        time: r.time,
        user: r.actor,
        action: r.action,
        module: r.module,
        detail: r.detail,
        ip: r.ip,
        color: r.color,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load audit logs' });
  }
});

export default router;
