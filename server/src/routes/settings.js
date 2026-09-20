import { Router } from 'express';
import { query, run, logAudit, getOne } from '../db.js';
import { NOTIFY } from '../notify.js';
import { authRequired, requirePermission } from '../middleware/auth.js';
import { hasPermission } from '../rbac.js';
import {
  getSmtpConfig,
  saveSmtpConfig,
  getEmailTemplates,
  saveEmailTemplate,
  getGisConfig,
  saveGisConfig,
  buildEmailHtml,
  isPlaceholderPassword,
} from '../systemSettings.js';
import { sendSmtpTest } from '../mail.js';
import {
  getLguConfig,
  saveLguConfig,
  getPropertyKindsConfig,
  savePropertyKindsConfig,
  normalizeCode,
} from '../assessorConfig.js';

const router = Router();
router.use(authRequired);

router.get('/', async (req, res) => {
  try {
    if (req.user.role === 'Treasury') {
      return res.status(403).json({ error: 'Access to system settings is not permitted' });
    }
    const [barangays, classifications, assessmentLevels, lgu, propertyKinds] = await Promise.all([
      query(
        `SELECT id, name, code FROM barangays
         ORDER BY NULLIF(code, '') NULLS LAST, name`,
      ),
      query('SELECT * FROM classifications ORDER BY name'),
      query('SELECT * FROM assessment_levels ORDER BY name'),
      getLguConfig(),
      getPropertyKindsConfig(),
    ]);
    res.json({ barangays, classifications, assessmentLevels, lgu, propertyKinds });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

router.put('/lgu', requirePermission('settings:configure'), async (req, res) => {
  try {
    const lgu = await saveLguConfig(req.body || {}, req.user.username);
    await logAudit(
      req.user.username,
      'UPDATE',
      'Settings',
      `LGU identity → ${lgu.provinceName} (${lgu.provinceCode}) / ${lgu.municipalName} (${lgu.municipalCode})`,
      req.ip,
    );
    res.json({ lgu });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to save LGU settings' });
  }
});

router.put('/property-kinds', requirePermission('settings:configure'), async (req, res) => {
  try {
    const kinds = Array.isArray(req.body) ? req.body : req.body?.propertyKinds;
    const propertyKinds = await savePropertyKindsConfig(kinds, req.user.username);
    await logAudit(req.user.username, 'UPDATE', 'Settings', 'Property kind codes updated', req.ip);
    res.json({ propertyKinds });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to save property kinds' });
  }
});

router.post('/barangays', requirePermission('settings:configure'), async (req, res) => {
  try {
    const { name, code } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    const brgyCode = normalizeCode(code, 3);
    if (!brgyCode) return res.status(400).json({ error: 'Barangay PIN code required (e.g. 001)' });
    const row = await getOne(
      `INSERT INTO barangays (name, code) VALUES (?, ?) RETURNING id, name, code`,
      [name.trim(), brgyCode],
    );
    await logAudit(
      req.user.username,
      'CREATE',
      'Settings',
      `Added barangay ${name.trim()} (${brgyCode})`,
      req.ip,
    );
    res.status(201).json(row);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Barangay name or code already exists' });
    console.error(err);
    res.status(500).json({ error: 'Failed to add barangay' });
  }
});

router.patch('/barangays/:id', requirePermission('settings:configure'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, code } = req.body;
    if (!id) return res.status(400).json({ error: 'Valid id required' });

    const existing = await getOne('SELECT * FROM barangays WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Barangay not found' });

    const nextName = name != null ? String(name).trim() : existing.name;
    let nextCode = existing.code;
    if (code != null) {
      nextCode = normalizeCode(code, 3);
      if (!nextCode) {
        return res.status(400).json({ error: 'Barangay PIN code must be digits (e.g. 001)' });
      }
    }
    if (!nextName) return res.status(400).json({ error: 'Valid name required' });
    if (!nextCode) return res.status(400).json({ error: 'Barangay PIN code required (e.g. 001)' });

    await run('UPDATE barangays SET name = ?, code = ? WHERE id = ?', [nextName, nextCode, id]);
    await logAudit(
      req.user.username,
      'UPDATE',
      'Settings',
      `Barangay "${existing.name}" (${existing.code || '—'}) → "${nextName}" (${nextCode})`,
      req.ip,
    );
    res.json({ id, name: nextName, code: nextCode });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Barangay name or code already exists' });
    console.error(err);
    res.status(500).json({ error: 'Failed to update barangay' });
  }
});

router.delete('/barangays/:id', requirePermission('settings:configure'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Valid id required' });

    const existing = await getOne('SELECT * FROM barangays WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Barangay not found' });

    await run('DELETE FROM barangays WHERE id = ?', [id]);
    await logAudit(req.user.username, 'DELETE', 'Settings', `Removed barangay ${existing.name}`, req.ip, 'red');
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete barangay' });
  }
});

router.post('/classifications', requirePermission('settings:configure'), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    const row = await getOne(
      `INSERT INTO classifications (name) VALUES (?) RETURNING id, name`,
      [name.trim()]
    );
    await logAudit(req.user.username, 'CREATE', 'Settings', `Added classification ${name.trim()}`, req.ip);
    res.status(201).json(row);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Classification already exists' });
    console.error(err);
    res.status(500).json({ error: 'Failed to add classification' });
  }
});

router.patch('/assessment-levels/:id', requirePermission('settings:configure'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, rate } = req.body;
    const existing = await getOne('SELECT * FROM assessment_levels WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Assessment level not found' });

    const nextName = name != null ? String(name).trim() : existing.name;
    const nextRate =
      rate != null
        ? Number(rate) > 1
          ? Number(rate) / 100
          : Number(rate)
        : existing.rate;
    if (!nextName || Number.isNaN(nextRate)) {
      return res.status(400).json({ error: 'Valid name and rate required' });
    }

    await run('UPDATE assessment_levels SET name = ?, rate = ? WHERE id = ?', [nextName, nextRate, id]);
    await logAudit(
      req.user.username,
      'UPDATE',
      'Settings',
      `Assessment level ${nextName} → ${(nextRate * 100).toFixed(0)}%`,
      req.ip
    );
    res.json({ id, name: nextName, rate: nextRate });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update assessment level' });
  }
});

router.post('/assessment-levels', requirePermission('settings:configure'), async (req, res) => {
  try {
    const { name, rate } = req.body;
    if (!name?.trim() || rate == null) return res.status(400).json({ error: 'Name and rate required' });
    const nextRate = Number(rate) > 1 ? Number(rate) / 100 : Number(rate);
    const row = await getOne(
      `INSERT INTO assessment_levels (name, rate) VALUES (?, ?) RETURNING id, name, rate`,
      [name.trim(), nextRate]
    );
    await logAudit(req.user.username, 'CREATE', 'Settings', `Added assessment level ${name.trim()}`, req.ip);
    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add assessment level' });
  }
});

router.get('/it-config', requirePermission('settings:configure'), async (req, res) => {
  try {
    const [smtp, emailTemplates, gis] = await Promise.all([
      getSmtpConfig(false),
      getEmailTemplates(),
      getGisConfig(),
    ]);
    res.json({ smtp, emailTemplates, gis });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load IT configuration' });
  }
});

router.put('/smtp', requirePermission('settings:configure'), async (req, res) => {
  try {
    const smtp = await saveSmtpConfig(req.body, req.user.username);
    const newApiKey = req.body.brevoApiKey;
    const pastedNewKey =
      newApiKey !== undefined &&
      !isPlaceholderPassword(newApiKey) &&
      String(newApiKey).trim();
    if (smtp.enabled && smtp.deliveryMethod !== 'smtp' && pastedNewKey) {
      const { verifyBrevoApiKey } = await import('../brevoMail.js');
      await verifyBrevoApiKey();
    }
    await logAudit(req.user.username, 'UPDATE', 'SMTP', 'SMTP settings updated', req.ip, 'purple');
    res.json({ smtp });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to save SMTP settings' });
  }
});

router.post('/smtp/test', requirePermission('settings:configure'), async (req, res) => {
  try {
    const { to } = req.body;
    if (!to?.trim()) return res.status(400).json({ error: 'Recipient email required' });

    // Always use the latest persisted SMTP config (real saved password from DB)
    await sendSmtpTest(to.trim(), req.user.username);
    await logAudit(req.user.username, 'TEST', 'SMTP', `Test email sent to ${to.trim()}`, req.ip, 'emerald');
    res.json({ message: `Test email sent to ${to.trim()}` });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'SMTP test failed' });
  }
});

router.get('/email-templates', requirePermission('settings:configure'), async (req, res) => {
  try {
    res.json(await getEmailTemplates());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load email templates' });
  }
});

router.put('/email-templates/:key', requirePermission('settings:configure'), async (req, res) => {
  try {
    const template = await saveEmailTemplate(req.params.key, req.body, req.user.username);
    await logAudit(
      req.user.username,
      'UPDATE',
      'Email',
      `Email template "${req.params.key}" updated`,
      req.ip,
      'blue'
    );
    res.json(template);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to save template' });
  }
});

router.post('/email-templates/:key/preview', requirePermission('settings:configure'), async (req, res) => {
  try {
    const templates = await getEmailTemplates();
    const tpl = templates[req.params.key];
    if (!tpl) return res.status(404).json({ error: 'Template not found' });
    const vars = {
      name: 'Juan Dela Cruz',
      email: 'juan@example.com',
      verifyLink: 'https://veritrack.rizal.gov.ph/verify?token=demo',
      resetLink: 'https://veritrack.rizal.gov.ph/reset?token=demo',
      code: 'A3K9P2',
      expiryMinutes: '10',
      expiryHours: '24',
      time: new Date().toLocaleString(),
      ip: '192.168.1.10',
      device: 'Chrome on Windows',
      ...req.body?.vars,
    };
    const html = buildEmailHtml({ ...tpl, ...req.body }, vars);
    res.json({ html, subject: tpl.subject });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Preview failed' });
  }
});

router.get('/gis', async (req, res) => {
  try {
    const canRead =
      hasPermission(req.user.role, 'settings:configure') ||
      hasPermission(req.user.role, 'gis:access');
    if (!canRead) return res.status(403).json({ error: 'Access denied' });
    res.json(await getGisConfig());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load GIS settings' });
  }
});

router.put('/gis', requirePermission('settings:configure'), async (req, res) => {
  try {
    const gis = await saveGisConfig(req.body, req.user.username);
    await logAudit(req.user.username, 'UPDATE', 'GIS', 'GIS map settings updated', req.ip, 'emerald');
    await NOTIFY.admins('info', 'GIS Settings Updated', 'Map tile URLs or defaults were changed by IT');
    res.json(gis);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save GIS settings' });
  }
});

router.post('/backup', requirePermission('backup:restore'), async (req, res) => {
  try {
    const { spawn } = await import('child_process');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const script = path.join(__dirname, '..', '..', 'scripts', 'backup-db.js');

    await logAudit(req.user.username, 'BACKUP', 'System', 'PostgreSQL backup initiated', req.ip, 'purple');

    const result = await new Promise((resolve) => {
      const child = spawn(process.execPath, [script], {
        cwd: path.join(__dirname, '..', '..'),
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        shell: true,
      });
      child.on('close', (code) => resolve(code === 0));
    });

    await NOTIFY.it('success', 'Done • Database Backup', 'Main PostgreSQL backup completed');
    res.json({
      message: result
        ? 'Main PostgreSQL backup saved to server/backups/ with date-time filename.'
        : 'Backup logged — install pg_dump for automatic dumps.',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Backup failed' });
  }
});

export default router;
