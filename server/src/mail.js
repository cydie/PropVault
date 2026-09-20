import nodemailer from 'nodemailer';
import {
  getSmtpConfig,
  renderTemplateString,
  buildEmailHtml,
  validateSmtpConfig,
  smtpTransportOptions,
  logSmtpDebug,
} from './systemSettings.js';
import { sendViaBrevoApi, verifyBrevoApiKey } from './brevoMail.js';

function useBrevoApi(smtp) {
  return smtp.deliveryMethod !== 'smtp';
}

export function mapSmtpError(err) {
  const msg = String(err?.message || err || '');
  const code = err?.code || err?.responseCode;

  if (!msg && !code) return 'SMTP test failed.';

  if (
    msg.includes('535') ||
    msg.includes('5.7.8') ||
    /authentication failed/i.test(msg) ||
    /invalid login/i.test(msg)
  ) {
    return 'SMTP authentication failed. Check Brevo SMTP login and SMTP key — or switch to Brevo API delivery.';
  }

  if (/password is missing/i.test(msg) || msg.includes('SMTP password is required')) {
    return 'SMTP password is missing.';
  }

  if (/api key is missing|invalid api key/i.test(msg)) {
    return msg;
  }

  if (
    /550/.test(msg) ||
    /sender.*not.*verified/i.test(msg) ||
    /not authorized to send/i.test(msg) ||
    /verified sender/i.test(msg)
  ) {
    return 'Sender email is not verified in Brevo.';
  }

  if (
    code === 'ECONNECTION' ||
    code === 'ETIMEDOUT' ||
    code === 'ESOCKET' ||
    code === 'EDNS' ||
    /connection failed/i.test(msg) ||
    /connect ECONNREFUSED/i.test(msg) ||
    /getaddrinfo/i.test(msg)
  ) {
    return 'SMTP connection failed.';
  }

  return msg || 'SMTP test failed.';
}

export async function createTransport(smtpOverride = null) {
  const smtp = smtpOverride ?? (await getSmtpConfig(true));
  if (useBrevoApi(smtp)) {
    throw new Error('Use Brevo API delivery — SMTP transport not used.');
  }
  const validation = validateSmtpConfig(smtp, { requireEnabled: true, requirePassword: true });
  if (!validation.ok) {
    throw new Error(validation.errors[0]);
  }

  const options = smtpTransportOptions(smtp);
  logSmtpDebug(smtp);
  return nodemailer.createTransport(options);
}

export async function verifyTransport(transport) {
  try {
    await transport.verify();
  } catch (err) {
    throw new Error(mapSmtpError(err));
  }
}

export async function verifyMailDelivery() {
  const smtp = await getSmtpConfig(true);
  const validation = validateSmtpConfig(smtp, { requireEnabled: true, requirePassword: true });
  if (!validation.ok) {
    throw new Error(validation.errors[0]);
  }
  if (useBrevoApi(smtp)) {
    await verifyBrevoApiKey();
    return;
  }
  const transport = await createTransport(smtp);
  await verifyTransport(transport);
}

export async function sendMail({ to, subject, html, text }) {
  const smtp = await getSmtpConfig(true);
  const validation = validateSmtpConfig(smtp, { requireEnabled: true, requirePassword: true });
  if (!validation.ok) {
    throw new Error(validation.errors[0]);
  }

  if (useBrevoApi(smtp)) {
    return sendViaBrevoApi({ to, subject, html, text });
  }

  const transport = await createTransport(smtp);
  await verifyTransport(transport);

  const fromEmail = smtp.fromEmail.trim();
  const from = fromEmail
    ? `"${smtp.fromName?.trim() || 'VeriTrack'}" <${fromEmail}>`
    : smtp.fromName?.trim() || 'VeriTrack';

  try {
    return await transport.sendMail({
      from,
      to,
      subject,
      html,
      text: text || html?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    });
  } catch (err) {
    throw new Error(mapSmtpError(err));
  }
}

export async function sendTemplateEmail(templateKey, to, vars, templates) {
  const tpl = templates[templateKey];
  if (!tpl) throw new Error(`Unknown email template: ${templateKey}`);
  const subject = renderTemplateString(tpl.subject, vars);
  const html = buildEmailHtml(tpl, vars);
  return sendMail({ to, subject, html });
}

export async function sendSmtpTest(to, username) {
  const smtp = await getSmtpConfig(true);
  const validation = validateSmtpConfig(smtp, { requireEnabled: true, requirePassword: true });
  if (!validation.ok) {
    throw new Error(validation.errors[0]);
  }

  const html = `<p>Hello,</p><p>This is a test email from <strong>VeriTrack</strong> sent by <em>${username}</em>.</p><p>Email delivery is working correctly.</p>`;
  const text = `VeriTrack email test — sent by ${username}`;

  if (useBrevoApi(smtp)) {
    await verifyBrevoApiKey();
    return sendViaBrevoApi({
      to: to.trim(),
      subject: 'VeriTrack Email Test',
      html,
      text,
    });
  }

  const transport = await createTransport(smtp);
  await verifyTransport(transport);

  try {
    const fromEmail = smtp.fromEmail.trim();
    const from = `"${smtp.fromName?.trim() || 'VeriTrack'}" <${fromEmail}>`;
    return await transport.sendMail({
      from,
      to: to.trim(),
      subject: 'VeriTrack SMTP Test',
      html,
      text,
    });
  } catch (err) {
    throw new Error(mapSmtpError(err));
  }
}
