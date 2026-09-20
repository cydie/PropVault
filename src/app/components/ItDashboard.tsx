import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Database,
  FileText,
  Globe,
  LayoutDashboard,
  Mail,
  Server,
  Settings,
  Shield,
} from 'lucide-react';
import type { View } from '@/lib/rbac';
import { DashboardQuickAction } from './DashboardQuickAction';
import { ItSmtpPanel } from './it/ItSmtpPanel';
import { ItEmailTemplatePanel } from './it/ItEmailTemplatePanel';
import { ItGisPanel } from './it/ItGisPanel';
import { SyncControl } from './SyncControl';
import { useData } from '@/context/DataContext';
import { api, type EmailTemplate, type GisConfig, type ItConfig, type SmtpConfig } from '@/lib/api';
import { toast } from 'sonner';

type Tab = 'overview' | 'smtp' | 'email' | 'gis';

const TABS: { id: Tab; label: string; icon: typeof Server }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'smtp', label: 'SMTP', icon: Server },
  { id: 'email', label: 'Email Templates', icon: Mail },
  { id: 'gis', label: 'GIS Map', icon: Globe },
];

export function ItDashboard({ userName, onNavigate }: { userName: string; onNavigate?: (view: View) => void }) {
  const { stats, refresh } = useData();
  const [tab, setTab] = useState<Tab>('overview');
  const [config, setConfig] = useState<ItConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  const loadConfig = useCallback(async () => {
    setLoadingConfig(true);
    try {
      const data = await api.getItConfig();
      setConfig(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load IT configuration');
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const statCards = [
    {
      label: 'Audit Events Today',
      value: stats?.auditEventsToday ?? stats?.auditEvents ?? '—',
      icon: Activity,
      color: 'bg-blue-600',
      action: () => onNavigate?.('audit'),
    },
    {
      label: 'Active Users',
      value: stats?.activeUsers ?? '—',
      icon: Shield,
      color: 'bg-emerald-600',
      action: () => toast.info('User accounts', { description: 'Managed by System Admin only' }),
    },
    {
      label: 'Total Audit Logs',
      value: stats?.auditEvents ?? '—',
      icon: FileText,
      color: 'bg-amber-500',
      action: () => onNavigate?.('audit'),
    },
    {
      label: 'System Config',
      value: config?.smtp.enabled ? 'SMTP On' : 'SMTP Off',
      icon: Database,
      color: 'bg-purple-600',
      action: () => setTab('smtp'),
    },
  ];

  const onSmtpSaved = (smtp: SmtpConfig) => setConfig((c) => (c ? { ...c, smtp } : c));
  const onTemplateSaved = (key: string, tpl: EmailTemplate) =>
    setConfig((c) => (c ? { ...c, emailTemplates: { ...c.emailTemplates, [key]: tpl } } : c));
  const onGisSaved = (gis: GisConfig) => setConfig((c) => (c ? { ...c, gis } : c));

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: "'Roboto Slab', serif" }}>
            Good morning, {userName}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            IT Operations Console · SMTP, email design & GIS infrastructure
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 bg-secondary/60 p-1 rounded-xl border border-border">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                tab === id
                  ? 'bg-card text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <button
                  key={stat.label}
                  type="button"
                  onClick={stat.action}
                  className="bg-card rounded-xl border border-border p-4 text-left hover:shadow-md transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <div className={`w-9 h-9 rounded-lg ${stat.color} flex items-center justify-center mb-3`}>
                    <Icon size={16} className="text-white" />
                  </div>
                  <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Roboto Slab', serif" }}>
                    {stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                </button>
              );
            })}
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => setTab('smtp')}
              className="bg-card rounded-xl border border-border p-5 text-left hover:border-primary/30 hover:shadow-md transition-all"
            >
              <Server size={20} className="text-blue-600 mb-3" />
              <h3 className="font-semibold text-foreground text-sm">SMTP & Mail Delivery</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Configure outbound mail server, credentials, and send test messages.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setTab('email')}
              className="bg-card rounded-xl border border-border p-5 text-left hover:border-primary/30 hover:shadow-md transition-all"
            >
              <Mail size={20} className="text-indigo-600 mb-3" />
              <h3 className="font-semibold text-foreground text-sm">Email Verification Design</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Edit verification email copy, colors, and preview the rendered template live.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setTab('gis')}
              className="bg-card rounded-xl border border-border p-5 text-left hover:border-primary/30 hover:shadow-md transition-all"
            >
              <Globe size={20} className="text-emerald-600 mb-3" />
              <h3 className="font-semibold text-foreground text-sm">GIS Map APIs</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Manage tile URLs, map center, zoom levels, and optional API keys for assessors.
              </p>
            </button>
          </div>

          <SyncControl onSyncComplete={refresh} />

          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-semibold text-sm text-foreground mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <DashboardQuickAction label="Audit Trail" icon={Shield} navigateTo="audit" onNavigate={onNavigate} />
              <DashboardQuickAction label="System Settings" icon={Settings} navigateTo="settings" onNavigate={onNavigate} />
              <DashboardQuickAction label="Reports" icon={FileText} navigateTo="reports" onNavigate={onNavigate} />
              <DashboardQuickAction
                label="SMTP Config"
                icon={Server}
                onClick={() => setTab('smtp')}
              />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mt-5 pt-5 border-t border-border">
              IT signs in through the same VeriTrack login page as other roles. After authentication, you land on
              this dedicated operations console — separate from assessor and treasury dashboards — to manage email
              delivery, template design, and GIS map infrastructure without access to property or payment records.
            </p>
          </div>
        </>
      )}

      {tab !== 'overview' && loadingConfig && (
        <div className="bg-card rounded-xl border border-border p-12 text-center text-sm text-muted-foreground">
          Loading configuration…
        </div>
      )}

      {tab === 'smtp' && config && !loadingConfig && (
        <ItSmtpPanel initial={config.smtp} onSaved={onSmtpSaved} />
      )}

      {tab === 'email' && config && !loadingConfig && (
        <ItEmailTemplatePanel templates={config.emailTemplates} onSaved={onTemplateSaved} />
      )}

      {tab === 'gis' && config && !loadingConfig && (
        <ItGisPanel initial={config.gis} onSaved={onGisSaved} />
      )}
    </div>
  );
}
