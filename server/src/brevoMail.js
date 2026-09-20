import { BrevoClient } from '@getbrevo/brevo';
import { getSmtpConfig } from './systemSettings.js';

function brevoErrorBody(err) {
  return String(err?.body?.message || err?.rawResponse?.body?.message || '').trim();
}

export function mapBrevoError(err) {
  const msg = String(err?.message || err || '');
  const status = err?.statusCode || err?.status;
  const bodyMsg = brevoErrorBody(err);
  const combined = `${bodyMsg} ${msg}`.toLowerCase();

  if (/unrecognised ip|unrecognized ip|authorised_ips|authorized_ips/i.test(combined)) {
    const ipMatch = bodyMsg.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
    const ipHint = ipMatch ? ` (${ipMatch[0]})` : '';
    return `Brevo blocked this server IP${ipHint}. In Brevo go to Security → Authorized IPs and add your server IP, or disable IP restriction for API access.`;
  }

  if (/key not found/i.test(combined)) {
    return 'Brevo does not recognize this API key ("Key not found"). In Brevo go to SMTP & API → API keys, create a new key (starts with xkeysib-), copy the entire key, paste it here, and Save.';
  }

  if (status === 401 || /unauthorized|invalid api key/i.test(combined)) {
    return 'Brevo API key was rejected. Create a fresh key under SMTP & API → API keys (xkeysib-). SMTP keys (xsmtpsib-) only work in SMTP relay mode.';
  }
  if (status === 403 || /sender.*not.*valid|not authorized|verified/i.test(msg)) {
    return 'Sender email is not verified in Brevo.';
  }
  if (status === 429) {
    return 'Brevo rate limit reached. Try again in a few minutes.';
  }
  return msg || 'Brevo API send failed.';
}

export async function sendViaBrevoApi({ to, subject, html, text }) {
  const smtp = await getSmtpConfig(true);
  const apiKey = String(smtp.brevoApiKey || '').trim();
  if (!apiKey) {
    throw new Error('Brevo API key is missing.');
  }
  if (apiKey.startsWith('xsmtpsib-')) {
    throw new Error(
      'This is an SMTP key (xsmtpsib-), not an API key. Switch to SMTP relay mode and paste it as the SMTP password.'
    );
  }

  const client = new BrevoClient({ apiKey });
  const fromEmail = smtp.fromEmail.trim();
  const fromName = smtp.fromName?.trim() || 'VeriTrack';

  try {
    const result = await client.transactionalEmails.sendTransacEmail({
      subject,
      htmlContent: html,
      textContent: text || undefined,
      sender: { email: fromEmail, name: fromName },
      to: [{ email: to.trim() }],
    });
    return result;
  } catch (err) {
    throw new Error(mapBrevoError(err));
  }
}

export async function verifyBrevoApiKey() {
  const smtp = await getSmtpConfig(true);
  const apiKey = String(smtp.brevoApiKey || '').trim();
  if (!apiKey) throw new Error('Brevo API key is missing.');
  const client = new BrevoClient({ apiKey });
  try {
    await client.account.getAccount();
    return true;
  } catch (err) {
    throw new Error(mapBrevoError(err));
  }
}
