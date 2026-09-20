import { useCallback, useEffect, useState } from 'react';
import { Mail, Palette, Save } from 'lucide-react';
import { api, type EmailTemplate } from '@/lib/api';
import { toast } from 'sonner';

const inputCls =
  'w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10';

const TEMPLATE_ORDER = ['email_verification', 'forgot_password', 'login_alert'] as const;

type Props = {
  templates: Record<string, EmailTemplate>;
  onSaved: (key: string, tpl: EmailTemplate) => void;
};

export function ItEmailTemplatePanel({ templates, onSaved }: Props) {
  const [activeKey, setActiveKey] = useState<string>(TEMPLATE_ORDER[0]);
  const [draft, setDraft] = useState<EmailTemplate>(templates[TEMPLATE_ORDER[0]]);
  const [previewHtml, setPreviewHtml] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    const tpl = templates[activeKey];
    if (tpl) setDraft(tpl);
  }, [activeKey, templates]);

  const loadPreview = useCallback(async () => {
    setLoadingPreview(true);
    try {
      const { html } = await api.previewEmailTemplate(activeKey, draft);
      setPreviewHtml(html);
    } catch {
      setPreviewHtml('<p style="padding:16px;color:#64748b">Preview unavailable</p>');
    } finally {
      setLoadingPreview(false);
    }
  }, [activeKey, draft]);

  useEffect(() => {
    const t = setTimeout(loadPreview, 400);
    return () => clearTimeout(t);
  }, [loadPreview]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await api.updateEmailTemplate(activeKey, draft);
      onSaved(activeKey, saved);
      toast.success(`"${saved.label}" template saved`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save template');
    } finally {
      setSaving(false);
    }
  };

  const update = (patch: Partial<EmailTemplate>) => setDraft((p) => ({ ...p, ...patch }));

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="space-y-4">
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Mail size={18} className="text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Email Templates</h3>
              <p className="text-xs text-muted-foreground">Customize verification and system email content & design</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {TEMPLATE_ORDER.map((key) => {
              const tpl = templates[key];
              if (!tpl) return null;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveKey(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeKey === key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tpl.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Email Subject</label>
              <input className={inputCls} value={draft.subject} onChange={(e) => update({ subject: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Header Title</label>
              <input className={inputCls} value={draft.heading} onChange={(e) => update({ heading: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Greeting</label>
              <input className={inputCls} value={draft.greeting} onChange={(e) => update({ greeting: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Body Message</label>
              <textarea
                className={`${inputCls} min-h-[88px] resize-y`}
                value={draft.body}
                onChange={(e) => update({ body: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Button Label</label>
                <input className={inputCls} value={draft.buttonText} onChange={(e) => update({ buttonText: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-1">
                  <Palette size={12} /> Accent Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={draft.accentColor}
                    onChange={(e) => update({ accentColor: e.target.value, buttonColor: e.target.value })}
                    className="h-9 w-12 rounded border border-border cursor-pointer"
                  />
                  <input className={inputCls} value={draft.accentColor} onChange={(e) => update({ accentColor: e.target.value })} />
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Footer Text</label>
              <input className={inputCls} value={draft.footer} onChange={(e) => update({ footer: e.target.value })} />
            </div>
          </div>

          {draft.variables && draft.variables.length > 0 && (
            <p className="text-[11px] text-muted-foreground mt-3">
              Variables: {draft.variables.join(', ')}
            </p>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save Template'}
          </button>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-5 flex flex-col min-h-[480px]">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-sm text-foreground">Live Preview</h4>
          {loadingPreview && <span className="text-[11px] text-muted-foreground">Updating…</span>}
        </div>
        <div className="flex-1 rounded-lg border border-border overflow-hidden bg-slate-100">
          <iframe
            title="Email preview"
            srcDoc={previewHtml}
            className="w-full h-full min-h-[420px] bg-white"
            sandbox=""
          />
        </div>
      </div>
    </div>
  );
}
