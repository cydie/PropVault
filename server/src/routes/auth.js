import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { query, getOne, run, logAudit } from '../db.js';
import { signToken, authRequired } from '../middleware/auth.js';
import { getEmailTemplates } from '../systemSettings.js';
import { sendTemplateEmail } from '../mail.js';

const router = Router();
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const CODE_EXPIRY_MINUTES = 10;
const FORGOT_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function generateForgotCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += FORGOT_CODE_CHARS[crypto.randomInt(0, FORGOT_CODE_CHARS.length)];
  }
  return code;
}

function authUserPayload(user) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
  };
}

function issueSession(user, res, extra = {}) {
  const token = signToken({
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    email: user.email,
  });
  res.json({ token, user: authUserPayload(user), ...extra });
}

router.post('/login', async (req, res) => {
  try {
    const { username, password, captcha, captchaExpected, remember } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    if (captchaExpected && String(captcha || '').toUpperCase() !== String(captchaExpected).toUpperCase()) {
      return res.status(400).json({ error: 'Invalid CAPTCHA code' });
    }

    const user = await getOne('SELECT * FROM users WHERE username = ?', [username]);
    const ip = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (user.status !== 'Active') {
      return res.status(403).json({ error: 'Account is inactive. Contact the administrator.' });
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(423).json({ error: 'Account locked due to failed login attempts. Try again later.' });
    }

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      const attempts = (user.failed_attempts || 0) + 1;
      let locked_until = null;
      if (attempts >= MAX_ATTEMPTS) {
        locked_until = new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString();
      }
      await run('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?', [attempts, locked_until, user.id]);
      await run('INSERT INTO login_history (user_id, ip, success) VALUES (?, ?, FALSE)', [user.id, ip]);
      await logAudit(username, 'LOGIN_FAIL', 'Authentication', `Failed login attempt (${attempts}/${MAX_ATTEMPTS})`, ip, 'red');
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    await run('UPDATE users SET failed_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE id = ?', [user.id]);
    await run('INSERT INTO login_history (user_id, ip, success) VALUES (?, ?, TRUE)', [user.id, ip]);
    await logAudit(username, 'LOGIN', 'Authentication', `Successful login — ${user.role}`, ip, 'green');

    issueSession(user, res, { remember: !!remember });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    const user = await getOne('SELECT * FROM users WHERE LOWER(TRIM(email)) = ?', [email]);
    if (!user) {
      return res.status(404).json({ error: 'No account found with this email address.' });
    }

    if (user.status !== 'Active') {
      return res.status(403).json({ error: 'Account is inactive. Contact the administrator.' });
    }

    const code = generateForgotCode();
    const codeHash = bcrypt.hashSync(code, 10);
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000).toISOString();

    await run(
      'UPDATE forgot_password_codes SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL',
      [user.id]
    );
    await run(
      'INSERT INTO forgot_password_codes (user_id, email, code_hash, expires_at) VALUES (?, ?, ?, ?)',
      [user.id, user.email, codeHash, expiresAt]
    );

    const templates = await getEmailTemplates();
    await sendTemplateEmail(
      'forgot_password',
      user.email,
      {
        name: user.name,
        email: user.email,
        code,
        expiryMinutes: String(CODE_EXPIRY_MINUTES),
      },
      templates
    );

    await logAudit(
      user.username,
      'REQUEST',
      'Authentication',
      'Forgot password code sent',
      req.ip,
      'amber'
    );

    res.json({ message: 'A verification code was sent to your email address.' });
  } catch (err) {
    console.error(err);
    const msg = String(err?.message || '');
    if (/email delivery|smtp|brevo|api key|missing/i.test(msg)) {
      return res.status(503).json({ error: msg || 'Could not send verification email. Check email settings.' });
    }
    res.status(500).json({ error: 'Could not send verification code' });
  }
});

router.post('/verify-forgot-code', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const code = String(req.body.code || '').trim().toUpperCase();

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required' });
    }
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      return res.status(400).json({ error: 'Enter the 6-character code from your email' });
    }

    const user = await getOne('SELECT * FROM users WHERE LOWER(TRIM(email)) = ?', [email]);
    if (!user) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    if (user.status !== 'Active') {
      return res.status(403).json({ error: 'Account is inactive. Contact the administrator.' });
    }

    const row = await getOne(
      `SELECT * FROM forgot_password_codes
       WHERE user_id = ? AND used_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [user.id]
    );

    if (!row || !bcrypt.compareSync(code, row.code_hash)) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }

    await run('UPDATE forgot_password_codes SET used_at = NOW() WHERE id = ?', [row.id]);
    await run('UPDATE users SET failed_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE id = ?', [
      user.id,
    ]);

    const ip = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    await run('INSERT INTO login_history (user_id, ip, success) VALUES (?, ?, TRUE)', [user.id, ip]);
    await logAudit(
      user.username,
      'LOGIN',
      'Authentication',
      `Signed in via forgot password code — ${user.role}`,
      ip,
      'green'
    );

    issueSession(user, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

router.get('/me', authRequired, async (req, res) => {
  try {
    const user = await getOne('SELECT id, name, username, email, role, status FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

router.get('/login-history', authRequired, async (req, res) => {
  try {
    const rows = await query(
      `SELECT lh.id, lh.ip, lh.success, lh.created_at
       FROM login_history lh
       WHERE lh.user_id = ?
       ORDER BY lh.created_at DESC
       LIMIT 30`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load login history' });
  }
});

router.put('/profile', authRequired, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!name) return res.status(400).json({ error: 'Name is required' });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Valid email address is required' });
    }

    const taken = await getOne('SELECT id FROM users WHERE LOWER(TRIM(email)) = ? AND id != ?', [
      email,
      req.user.id,
    ]);
    if (taken) return res.status(409).json({ error: 'Email is already used by another account' });

    await run('UPDATE users SET name = ?, email = ?, updated_at = NOW() WHERE id = ?', [
      name,
      email,
      req.user.id,
    ]);
    await logAudit(req.user.username, 'UPDATE', 'Authentication', 'Profile updated', req.ip, 'blue');

    const user = await getOne('SELECT id, name, username, email, role, status FROM users WHERE id = ?', [
      req.user.id,
    ]);
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Profile update failed' });
  }
});

router.post('/change-password', authRequired, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }
    const user = await getOne('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    const hash = bcrypt.hashSync(newPassword, 10);
    await run('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [hash, req.user.id]);
    await logAudit(req.user.username, 'UPDATE', 'Authentication', 'Password changed', req.ip, 'amber');
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Password change failed' });
  }
});

export default router;
