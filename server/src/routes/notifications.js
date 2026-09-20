import { Router } from 'express';
import { query, run } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

function filterForRole(rows, userRole) {
  return rows.filter((n) => {
    if (!n.audience_roles) return true;
    try {
      const roles = JSON.parse(n.audience_roles);
      return Array.isArray(roles) && roles.includes(userRole);
    } catch {
      return true;
    }
  });
}

router.get('/', async (req, res) => {
  try {
    const rows = await query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    const visible = filterForRole(rows, req.user.role);
    res.json(
      visible.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        msg: n.message,
        time: formatRelative(n.created_at),
        read: !!n.is_read,
        createdAt: n.created_at,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load notifications' });
  }
});

router.post('/read-all', async (req, res) => {
  try {
    await run('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark notifications read' });
  }
});

router.patch('/:id/read', async (req, res) => {
  try {
    await run('UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

function formatRelative(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins || 1} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} day ago`;
}

export default router;
