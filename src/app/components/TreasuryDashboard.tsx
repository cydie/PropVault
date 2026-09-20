import { Banknote, CheckCircle, Clock, FileText, Receipt, Search } from 'lucide-react';
import type { View } from '@/lib/rbac';
import { useData } from '@/context/DataContext';
import { toast } from 'sonner';

export function TreasuryDashboard({ userName, onNavigate }: { userName: string; onNavigate?: (view: View) => void }) {
  const { stats } = useData();

  const statsCards = [
    {
      label: 'Payment Records',
      value: String(stats?.paymentRecords ?? '—'),
      icon: FileText,
      color: 'bg-blue-600',
    },
    {
      label: 'Pending Validation',
      value: String(stats?.paymentsPending ?? '—'),
      icon: Clock,
      color: 'bg-amber-500',
    },
    {
      label: 'Approved Payments',
      value: String(stats?.paymentsApproved ?? '—'),
      icon: CheckCircle,
      color: 'bg-emerald-600',
    },
    {
      label: 'Receipts Issued',
      value: String(stats?.receiptsIssued ?? '—'),
      icon: Receipt,
      color: 'bg-purple-600',
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: "'Roboto Slab', serif" }}>
          Good morning, {userName}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Treasury Dashboard · Tax Collection & Payment Processing
          {stats?.paymentsApprovedToday != null ? ` · ${stats.paymentsApprovedToday} OR(s) today` : ''}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statsCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <button
              key={stat.label}
              type="button"
              onClick={() => {
                onNavigate?.('payments');
                toast.success('Opened Tax Payments');
              }}
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

      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center">
            <Banknote size={18} className="text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Treasury Operations</h3>
            <p className="text-xs text-muted-foreground">
              Look up assessed value by PIN/TD, validate payments, issue ORs, collection reports
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={() => onNavigate?.('payments')}
            className="inline-flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm"
          >
            <Banknote size={14} /> Open Payments
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('land')}
            className="inline-flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-secondary"
          >
            <Search size={14} /> Property Reference (Land)
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('reports')}
            className="inline-flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-secondary"
          >
            <FileText size={14} /> Collection Reports
          </button>
        </div>
        <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
          <li>Search property by PIN / TD to see assessed value before posting payment</li>
          <li>Validate and approve payments, then issue official receipts</li>
          <li>Land &amp; Buildings are read-only reference for Treasury</li>
          <li>Generate collection and payment history reports</li>
        </ul>
      </div>
    </div>
  );
}
