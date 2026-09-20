import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query, getOne, run, logAudit } from '../db.js';
import { NOTIFY } from '../notify.js';
import { authRequired, requirePermission } from '../middleware/auth.js';
import { MANAGEABLE_ROLES, ROLES, requireValidRole } from '../rbac.js';

const router = Router();
router.use(authRequired, requirePermission('users:manage'));

async function formatUser(row) {
  const lastLogin = await getOne(
    'SELECT created_at FROM login_history WHERE user_id = ? AND success = TRUE ORDER BY created_at DESC LIMIT 1',
    [row.id]
  );
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    email: row.email,
    role: row.role,
    status: row.status,
    lastLogin: lastLogin?.created_at || 'Never',
  };
}

function validateAssignableRole(role) {
  return role === ROLES.ADMIN || MANAGEABLE_ROLES.includes(role);
}

router.get('/', async (req, res) => {
  try {
    const users = await query('SELECT id, name, username, email, role, status FROM users ORDER BY name');
    res.json(await Promise.all(users.map(formatUser)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, username, email, role, status, password } = req.body;
    if (!name || !username || !email || !role || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!requireValidRole(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    if (!validateAssignableRole(role)) {
      return res.status(403).json({ error: 'You may only create Treasury, Staff Assessor, or IT accounts' });
    }
    const exists = await getOne('SELECT id FROM users WHERE username = ?', [username]);
    if (exists) return res.status(409).json({ error: 'Username already exists' });

    const id = `U-${uuidv4().slice(0, 8).toUpperCase()}`;
    const hash = bcrypt.hashSync(password, 10);
    await run(
      `INSERT INTO users (id, name, username, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, name, username, email, hash, role, status || 'Active']
    );

    await logAudit(req.user.username, 'CREATE', 'User Management', `Created account ${username} (${role})`, req.ip, 'green');
    await NOTIFY.admins(
      'info',
      'New User Account',
      `${username} (${role}) was created by ${req.user.username}`
    );
    const created = await getOne('SELECT * FROM users WHERE id = ?', [id]);
    res.status(201).json(await formatUser(created));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, email, role, status, password } = req.body;
    const existing = await getOne('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'User not found' });

    const nextRole = role ?? existing.role;
    if (!requireValidRole(nextRole)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    if (nextRole !== existing.role && !validateAssignableRole(nextRole)) {
      return res.status(403).json({ error: 'You may only assign Treasury, Staff Assessor, or IT roles' });
    }

    await run(
      `UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email),
       role = COALESCE(?, role), status = COALESCE(?, status), updated_at = NOW() WHERE id = ?`,
      [name ?? existing.name, email ?? existing.email, role ?? existing.role, status ?? existing.status, req.params.id]
    );

    if (password) {
      await run('UPDATE users SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(password, 10), req.params.id]);
      await logAudit(req.user.username, 'UPDATE', 'User Management', `Reset password for ${existing.username}`, req.ip, 'amber');
    }

    await logAudit(req.user.username, 'UPDATE', 'User Management', `Updated account ${existing.username}`, req.ip, 'blue');
    const updated = await getOne('SELECT * FROM users WHERE id = ?', [req.params.id]);
    res.json(await formatUser(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
    const existing = await getOne('SELECT username, role FROM users WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'User not found' });
    if (existing.role === ROLES.ADMIN) {
      return res.status(403).json({ error: 'Admin accounts cannot be deleted through this interface' });
    }
    await run('DELETE FROM users WHERE id = ?', [req.params.id]);
    await logAudit(req.user.username, 'DELETE', 'User Management', `Deleted account ${existing.username}`, req.ip, 'red');
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
