import { getOne, run, query } from './db.js';
import {
  DEFAULT_SMTP,
  DEFAULT_EMAIL_TEMPLATES,
  DEFAULT_GIS,
  BREVO_SMTP_PRESET,
} from './defaults/itConfig.js';

const MASK = '********';
const PLACEHOLDER_PASSWORD_RE = /^[•\*.\u2022\u25CF]+$/;

export function isPlaceholderPassword(pwd) {
  if (pwd === undefined || pwd === null) return true;
  const t = String(pwd).trim();
  if (!t) return true;
  if (t === MASK) return true;
  if (PLACEHOLDER_PASSWORD_RE.test(t)) return true;
  return false;
}

export function resolveSmtpPassword(incoming, stored = '') {
  if (!isPlaceholderPassword(incoming)) {
    return String(incoming).trim();
  }
  return String(stored || '').trim();
}

export function smtpTransportOptions(smtp) {
  const port = Number(smtp.port) || 587;
  const smtpHost = String(smtp.host || '').trim();
  const smtpUsername = String(smtp.user || '').trim();
  const smtpPassword = String(smtp.password || '').trim();

  return {
    host: smtpHost,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: {
      user: smtpUsername,
      pass: smtpPassword,
    },
  };
}

export function logSmtpDebug(smtp) {
  const port = Number(smtp.port) || 587;
  console.log({
    host: String(smtp.host || '').trim(),
    port,
    username: String(smtp.user || '').trim(),
    passwordLength: String(smtp.password || '').trim().length,
    fromEmail: String(smtp.fromEmail || '').trim(),
  });
}

export function validateSmtpConfig(smtp, { requireEnabled = false, requirePassword = true } = {}) {
  const errors = [];
  const method = smtp?.deliveryMethod === 'smtp' ? 'smtp' : 'brevo_api';

  if (requireEnabled && !smtp?.enabled) {
    errors.push('SMTP is not enabled.');
  }
  if (!String(smtp?.fromEmail || '').trim()) errors.push('From email is required');

  if (method === 'brevo_api') {
    if (requirePassword && !String(smtp?.brevoApiKey || '').trim()) {
      errors.push('Brevo API key is required');
    }
    return { ok: errors.length === 0, errors };
  }

  if (!String(smtp?.host || '').trim()) errors.push('SMTP host is required');
  if (!smtp?.port || Number.isNaN(Number(smtp.port))) errors.push('SMTP port is required');
  if (!String(smtp?.user || '').trim()) errors.push('SMTP username is required');
  if (requirePassword && !String(smtp?.password || '').trim()) {
    errors.push('SMTP password is required');
  }
  return { ok: errors.length === 0, errors };
}

export async function migrateSystemSettings() {
  await query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      updated_by TEXT
    );
  `);
  await ensureDefaults();
  await migrateEmailTemplates();
}

async function migrateEmailTemplates() {
  const row = await getOne('SELECT value FROM system_settings WHERE key = ?', ['email_templates']);
  if (!row?.value) return;
  const templates = { ...row.value };
  let changed = false;
  if (templates.password_reset && !templates.forgot_password) {
    templates.forgot_password = DEFAULT_EMAIL_TEMPLATES.forgot_password;
    delete templates.password_reset;
    changed = true;
  }
  if (!templates.forgot_password) {
    templates.forgot_password = DEFAULT_EMAIL_TEMPLATES.forgot_password;
    changed = true;
  }
  if (changed) {
    await run('UPDATE system_settings SET value = ?::jsonb, updated_at = NOW() WHERE key = ?', [
      JSON.stringify(templates),
      'email_templates',
    ]);
  }
}

async function ensureDefaults() {
  const defaults = {
    smtp: DEFAULT_SMTP,
    email_templates: DEFAULT_EMAIL_TEMPLATES,
    gis: DEFAULT_GIS,
  };
  for (const [key, value] of Object.entries(defaults)) {
    const row = await getOne('SELECT key FROM system_settings WHERE key = ?', [key]);
    if (!row) {
      await run('INSERT INTO system_settings (key, value) VALUES (?, ?::jsonb)', [
        key,
        JSON.stringify(value),
      ]);
    }
  }
}

export async function getSetting(key) {
  const row = await getOne('SELECT value FROM system_settings WHERE key = ?', [key]);
  if (!row) return null;
  return row.value;
}

export async function setSetting(key, value, updatedBy) {
  await run(
    `INSERT INTO system_settings (key, value, updated_by, updated_at)
     VALUES (?, ?::jsonb, ?, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
    [key, JSON.stringify(value), updatedBy ?? null]
  );
}

export function maskSmtp(smtp) {
  if (!smtp) return { ...DEFAULT_SMTP, hasPassword: false, hasBrevoApiKey: false };
  const { password: _pw, brevoApiKey: _key, ...rest } = smtp;
  return {
    ...rest,
    password: '',
    brevoApiKey: '',
    hasPassword: Boolean(String(smtp.password || '').trim()),
    hasBrevoApiKey: Boolean(String(smtp.brevoApiKey || '').trim()),
  };
}

export async function getSmtpConfig(includeSecret = false) {
  const raw = (await getSetting('smtp')) ?? DEFAULT_SMTP;
  const smtp = { ...DEFAULT_SMTP, ...raw };
  if (isPlaceholderPassword(smtp.password)) {
    smtp.password = '';
  }
  if (isPlaceholderPassword(smtp.brevoApiKey)) {
    smtp.brevoApiKey = '';
  }
  if (includeSecret) return smtp;
  return maskSmtp(smtp);
}

export async function saveSmtpConfig(body, username) {
  const current = (await getSetting('smtp')) ?? DEFAULT_SMTP;
  const port = Number(body.port) || 587;

  const next = {
    ...current,
    enabled: Boolean(body.enabled),
    deliveryMethod: body.deliveryMethod === 'smtp' ? 'smtp' : 'brevo_api',
    host: String(body.host ?? '').trim(),
    port,
    secure: port === 465,
    user: String(body.user ?? '').trim(),
    fromName: String(body.fromName ?? '').trim(),
    fromEmail: String(body.fromEmail ?? '').trim(),
    password: resolveSmtpPassword(body.password, current.password),
    brevoApiKey: resolveSmtpPassword(body.brevoApiKey, current.brevoApiKey),
  };

  if (next.enabled) {
    const validation = validateSmtpConfig(next, { requireEnabled: false, requirePassword: true });
    if (!validation.ok) {
      const err = new Error(validation.errors[0]);
      err.status = 400;
      throw err;
    }
  }

  await setSetting('smtp', next, username);
  return maskSmtp(next);
}

export async function getEmailTemplates() {
  const templates = (await getSetting('email_templates')) ?? DEFAULT_EMAIL_TEMPLATES;
  return { ...DEFAULT_EMAIL_TEMPLATES, ...templates };
}

export async function saveEmailTemplate(key, body, username) {
  const templates = await getEmailTemplates();
  if (!templates[key] && !DEFAULT_EMAIL_TEMPLATES[key]) {
    throw new Error('Unknown template key');
  }
  const base = templates[key] ?? DEFAULT_EMAIL_TEMPLATES[key];
  templates[key] = {
    ...base,
    ...body,
    key,
  };
  await setSetting('email_templates', templates, username);
  return templates[key];
}

export async function getGisConfig() {
  const gis = (await getSetting('gis')) ?? DEFAULT_GIS;
  return { ...DEFAULT_GIS, ...gis };
}

export async function saveGisConfig(body, username) {
  const current = await getGisConfig();
  const next = {
    ...current,
    defaultCenter: {
      lat: Number(body.defaultCenter?.lat ?? current.defaultCenter.lat),
      lng: Number(body.defaultCenter?.lng ?? current.defaultCenter.lng),
    },
    defaultZoom: Number(body.defaultZoom ?? current.defaultZoom),
    minZoom: Number(body.minZoom ?? current.minZoom),
    maxZoom: Number(body.maxZoom ?? current.maxZoom),
    apiKey: String(body.apiKey ?? current.apiKey ?? ''),
    tileProviderNote: String(body.tileProviderNote ?? current.tileProviderNote ?? ''),
    street: { ...current.street, ...body.street },
    satellite: { ...current.satellite, ...body.satellite },
  };
  await setSetting('gis', next, username);
  return next;
}

export function renderTemplateString(template, vars = {}) {
  if (!template) return '';
  return String(template).replace(/\{\{(\w+)\}\}/g, (_, key) =>
    vars[key] !== undefined ? String(vars[key]) : `{{${key}}}`
  );
}

export function buildEmailHtml(tpl, vars = {}) {
  const heading = renderTemplateString(tpl.heading, vars);
  const greeting = renderTemplateString(tpl.greeting, vars);
  const body = renderTemplateString(tpl.body, vars);
  const buttonText = renderTemplateString(tpl.buttonText, vars);
  const footer = renderTemplateString(tpl.footer, vars);
  const accent = tpl.accentColor || '#1e3a8a';
  const btnColor = tpl.buttonColor || accent;
  const link = vars.verifyLink || vars.resetLink || '#';
  const codeBlock = vars.code
    ? `<div style="margin:0 0 24px;text-align:center;padding:16px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;">
         <p style="margin:0 0 8px;color:#64748b;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">Verification code</p>
         <p style="margin:0;color:#0f172a;font-size:28px;font-weight:700;letter-spacing:0.35em;font-family:Consolas,Monaco,monospace;">${String(vars.code)}</p>
       </div>`
    : '';
  const buttonBlock =
    buttonText && (vars.verifyLink || vars.resetLink)
      ? `<a href="${link}" style="display:inline-block;background:${btnColor};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">${buttonText}</a>`
      : '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,.08);">
        <tr><td style="background:${accent};padding:24px 28px;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${heading}</h1>
        </td></tr>
        <tr><td style="padding:28px;">
          <p style="margin:0 0 12px;color:#0f172a;font-size:15px;font-weight:600;">${greeting}</p>
          <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.6;">${body}</p>
          ${codeBlock}
          ${buttonBlock}
        </td></tr>
        <tr><td style="padding:16px 28px 24px;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:11px;text-align:center;line-height:1.5;">${footer}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export { MASK, DEFAULT_SMTP, DEFAULT_EMAIL_TEMPLATES, DEFAULT_GIS, BREVO_SMTP_PRESET };
