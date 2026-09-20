import { useState } from 'react';
import { Key, Mail, Send, Server, Zap } from 'lucide-react';
import { api, type SmtpConfig } from '@/lib/api';
import { toast } from 'sonner';

const inputCls =
  'w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10';

const BREVO_PRESET = {
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
} as const;

type Props = {
  initial: SmtpConfig;
  onSaved: (smtp: SmtpConfig) => void;
};

function buildSavePayload(
  smtp: SmtpConfig,
  passwordDraft: string,
  apiKeyDraft: string
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    enabled: smtp.enabled,
    deliveryMethod: smtp.deliveryMethod || 'brevo_api',
    host: smtp.host.trim(),
    port: smtp.port,
    user: smtp.user.trim(),
    fromName: smtp.fromName.trim(),
    fromEmail: smtp.fromEmail.trim(),
  };
  if (passwordDraft.trim()) payload.password = passwordDraft.trim();
  if (apiKeyDraft.trim()) payload.brevoApiKey = apiKeyDraft.trim();
  return payload;
}

export function ItSmtpPanel({ initial, onSaved }: Props) {
  const [smtp, setSmtp] = useState<SmtpConfig>(() => ({
    ...initial,
    deliveryMethod: initial.deliveryMethod || 'brevo_api',
    password: '',
    brevoApiKey: '',
  }));
  const [hasSavedPassword, setHasSavedPassword] = useState(Boolean(initial.hasPassword));
  const [hasSavedApiKey, setHasSavedApiKey] = useState(Boolean(initial.hasBrevoApiKey));
  const [passwordDraft, setPasswordDraft] = useState('');
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [testTo, setTestTo] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const useApi = smtp.deliveryMethod !== 'smtp';

  const update = (patch: Partial<SmtpConfig>) => {
    setSmtp((p) => {
      const next = { ...p, ...patch };
      if (patch.port !== undefined) next.secure = patch.port === 465;
      return next;
    });
  };

  const hasRequiredSecret = () => {
    if (useApi) return Boolean(apiKeyDraft.trim() || hasSavedApiKey);
    return Boolean(passwordDraft.trim() || hasSavedPassword);
  };

  const applyBrevoSmtpKey = () => {
    update({ deliveryMethod: 'smtp', ...BREVO_PRESET });
    toast.info('Switched to SMTP relay mode', {
      description: 'Paste your xsmtpsib- key as SMTP password. Username: your Brevo SMTP login.',
    });
  };

  const handleSave = async () => {
    if (smtp.enabled && !hasRequiredSecret()) {
      toast.error(useApi ? 'Brevo API key is missing.' : 'SMTP password is missing.');
      return;
    }
    setSaving(true);
    try {
      const savedNewSecret = Boolean(
        (useApi && apiKeyDraft.trim()) || (!useApi && passwordDraft.trim())
      );
      const { smtp: saved } = await api.updateSmtp(buildSavePayload(smtp, passwordDraft, apiKeyDraft));
      onSaved(saved);
      setSmtp({ ...saved, password: '', brevoApiKey: '' });
      if (apiKeyDraft.trim()) {
        setHasSavedApiKey(true);
        setApiKeyDraft('');
      }
      if (passwordDraft.trim()) {
        setHasSavedPassword(true);
        setPasswordDraft('');
      }
      toast.success('Email settings saved', {
        description: savedNewSecret
          ? 'Credentials stored securely. Fields clear on purpose — leave blank to keep them.'
          : undefined,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testTo.trim()) {
      toast.warning('Enter a recipient email for the test');
      return;
    }
    if (smtp.enabled && !hasRequiredSecret()) {
      toast.error(useApi ? 'Brevo API key is missing.' : 'SMTP password is missing.');
      return;
    }
    setTesting(true);
    try {
      await api.updateSmtp(buildSavePayload(smtp, passwordDraft, apiKeyDraft));
      if (apiKeyDraft.trim()) {
        setHasSavedApiKey(true);
        setApiKeyDraft('');
      }
      if (passwordDraft.trim()) {
        setHasSavedPassword(true);
        setPasswordDraft('');
      }
      const res = await api.testSmtp(testTo.trim());
      toast.success(res.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Email test failed');
    } finally {
      setTesting(false);
    }
  };

  const tlsHint =
    smtp.port === 465
      ? 'Port 465 — SSL/TLS (secure: true)'
      : smtp.port === 587
        ? 'Port 587 — STARTTLS (secure: false, requireTLS: true)'
        : 'Use port 587 (Brevo) or 465 for SSL';

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
            <Server size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground">Email Delivery (Brevo)</h3>
            <p className="text-xs text-muted-foreground">
              Use Brevo API (recommended) or classic SMTP relay
            </p>
          </div>
          <button
            type="button"
            onClick={applyBrevoSmtpKey}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary text-xs font-medium hover:bg-secondary/80 shrink-0"
          >
            <Zap size={13} className="text-amber-500" />
            Use SMTP Key
          </button>
        </div>

        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={smtp.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
            className="rounded border-border"
          />
          <span className="text-sm font-medium text-foreground">Enable email delivery</span>
        </label>

        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={() => update({ deliveryMethod: 'brevo_api' })}
            className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
              useApi ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-secondary'
            }`}
          >
            <Key size={13} className="inline mr-1" />
            Brevo API (recommended)
          </button>
          <button
            type="button"
            onClick={() => update({ deliveryMethod: 'smtp' })}
            className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
              !useApi ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-secondary'
            }`}
          >
            <Server size={13} className="inline mr-1" />
            SMTP relay
          </button>
        </div>

        {useApi ? (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Brevo API Key</label>
              <input
                type="password"
                className={inputCls}
                autoComplete="new-password"
                placeholder={
                  hasSavedApiKey
                    ? 'Key saved — leave blank to keep, or paste new xkeysib- key'
                    : 'Paste API key from Brevo → SMTP & API → API keys'
                }
                value={apiKeyDraft}
                onChange={(e) => setApiKeyDraft(e.target.value)}
              />
              {hasSavedApiKey && !apiKeyDraft && (
                <p className="text-[11px] text-emerald-600 mt-1 font-medium">
                  ✓ API key saved (hidden for security)
                </p>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">
                Must start with <code className="text-[10px]">xkeysib-</code> (API keys tab).{' '}
                <strong className="text-amber-700">Not</strong> the <code className="text-[10px]">xsmtpsib-</code> SMTP key — use SMTP relay mode for that.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">SMTP Host</label>
              <input className={inputCls} value={smtp.host} onChange={(e) => update({ host: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Port</label>
              <input
                type="number"
                className={inputCls}
                value={smtp.port}
                onChange={(e) => update({ port: Number(e.target.value) })}
              />
              <p className="text-[11px] text-muted-foreground mt-1">{tlsHint}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">SMTP Username</label>
              <input className={inputCls} value={smtp.user} onChange={(e) => update({ user: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">SMTP Password / Key</label>
              <input
                type="password"
                className={inputCls}
                value={passwordDraft}
                onChange={(e) => setPasswordDraft(e.target.value)}
                placeholder={hasSavedPassword ? 'Saved — leave blank to keep' : 'Paste xsmtpsib-... key from Brevo'}
              />
              {hasSavedPassword && !passwordDraft && (
                <p className="text-[11px] text-emerald-600 mt-1 font-medium">✓ SMTP key saved</p>
              )}
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">From Name</label>
            <input className={inputCls} value={smtp.fromName} onChange={(e) => update({ fromName: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">From Email</label>
            <input
              type="email"
              className={inputCls}
              value={smtp.fromEmail}
              onChange={(e) => update({ fromEmail: e.target.value })}
            />
            <p className="text-[11px] text-muted-foreground mt-1">Must be verified in Brevo Senders</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-border">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            <Mail size={14} />
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <h4 className="font-semibold text-sm text-foreground mb-1 flex items-center gap-2">
          <Send size={15} className="text-emerald-600" />
          Send Test Email
        </h4>
        <p className="text-xs text-muted-foreground mb-3">
          Saves settings first, then sends via {useApi ? 'Brevo API' : 'SMTP'} using stored credentials.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            className={`${inputCls} sm:flex-1`}
            placeholder="recipient@example.com"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
          />
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="px-4 py-2 rounded-lg border border-border bg-secondary text-sm font-medium hover:bg-secondary/80 disabled:opacity-50 shrink-0"
          >
            {testing ? 'Sending…' : 'Send Test'}
          </button>
        </div>
      </div>
    </div>
  );
}
