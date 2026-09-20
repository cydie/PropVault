import { Printer, FileText, BarChart2, BookOpen } from 'lucide-react';
import { useState } from 'react';
import { useData } from '@/context/DataContext';
import { openPrintDocument } from '@/lib/uiActions';
import { toast } from 'sonner';
import { AssessorRollsPanel } from './cadastral/AssessorRollsPanel';
import { resolveAssessorOptions } from '@/lib/assessorOptions';

const reportTypes = [
  { title: 'Daily Assessment Report', desc: 'All assessments encoded today' },
  { title: 'Monthly Assessment Summary', desc: 'Fiscal year monthly totals' },
  { title: 'Barangay Property Report', desc: 'Properties grouped by barangay' },
  { title: 'Taxable vs Exempt Properties', desc: 'Classification breakdown' },
  { title: 'Certification Requests Log', desc: 'Pending and completed requests' },
  { title: 'Superseded Assessments', desc: 'Historical assessment records' },
];

export function ReportsView() {
  const { stats, landProps, certifications, settings } = useData();
  const options = resolveAssessorOptions(settings);
  const [assessorOpen, setAssessorOpen] = useState(false);

  const handlePrint = (title: string) => {
    const mv = stats?.monthlyMovement;
    const body =
      title === 'Monthly Assessment Summary' && mv
        ? `<h1>Municipality of Rizal, Palawan — ${title}</h1>
      <p>Generated: ${new Date().toLocaleString()}</p>
      <h2>${mv.month} ${mv.year}</h2>
      <table>
        <tr><th>Existing at end of preceding month</th><td>${mv.existingEndPreceding}</td></tr>
        <tr><th>New during present month</th><td>${mv.newDuringPresent}</td></tr>
        <tr><th>Cancellations / returned</th><td>${mv.cancelledDuringPresent}</td></tr>
        <tr><th>Assessment at end of present month</th><td>${mv.endPresent}</td></tr>
        <tr><th>Total assessed value</th><td>${Number(mv.totalAssessedValue || 0).toLocaleString()}</td></tr>
      </table>`
        : title === 'Barangay Property Report'
          ? `<h1>Municipality of Rizal, Palawan — ${title}</h1>
      <p>Generated: ${new Date().toLocaleString()}</p>
      <table><tr><th>Barangay</th><th>Count</th></tr>
      ${(stats?.brgyData || [])
        .map((b) => `<tr><td>${b.name}</td><td>${b.count}</td></tr>`)
        .join('')}
      </table>`
          : `<h1>Municipality of Rizal, Palawan — ${title}</h1>
      <p>Generated: ${new Date().toLocaleString()}</p>
      <p>Total properties: ${stats?.totalProperties ?? landProps.length}</p>
      <p>Land: ${stats?.landRecords ?? '—'} · Buildings: ${stats?.buildingRecords ?? '—'}</p>
      <p>Pending assessments: ${stats?.pendingAssessments ?? '—'}</p>
      <p>Certification requests: ${certifications.length}</p>`;
    const ok = openPrintDocument(title, body);
    if (ok) toast.success('Report opened for printing');
  };

  return (
    <div className="relative p-4 md:p-6 space-y-6 max-w-4xl mx-auto w-full min-h-[70vh]">
      <div>
        <h2 className="font-semibold text-foreground text-lg" style={{ fontFamily: "'Roboto Slab', serif" }}>
          Reports Module
        </h2>
        <p className="text-sm text-muted-foreground">Generate printable PDF-ready reports</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <BookOpen size={18} className="text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Assessor Tax Map &amp; Rolls</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tax Map Control Roll, Assessment Roll, Ownership Record — Index {options.pinPrefix}, filter
              per barangay
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAssessorOpen(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
        >
          Open Assessor Rolls
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {reportTypes.map((r) => (
          <div key={r.title} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileText size={18} className="text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">{r.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handlePrint(r.title)}
              className="mt-auto flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-secondary transition-colors"
            >
              <Printer size={14} /> Generate & Print
            </button>
          </div>
        ))}
      </div>
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 size={18} className="text-primary" />
          <h3 className="font-semibold text-sm">Quick Stats</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <div className="p-3 rounded-lg bg-secondary/50">
            <p className="text-xl font-bold">{stats?.landRecords ?? '—'}</p>
            <p className="text-xs text-muted-foreground">Land</p>
          </div>
          <div className="p-3 rounded-lg bg-secondary/50">
            <p className="text-xl font-bold">{stats?.buildingRecords ?? '—'}</p>
            <p className="text-xs text-muted-foreground">Buildings</p>
          </div>
          <div className="p-3 rounded-lg bg-secondary/50">
            <p className="text-xl font-bold">{stats?.pendingAssessments ?? '—'}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
          <div className="p-3 rounded-lg bg-secondary/50">
            <p className="text-xl font-bold">{stats?.certificationPending ?? '—'}</p>
            <p className="text-xs text-muted-foreground">Certs Pending</p>
          </div>
        </div>
      </div>

      <AssessorRollsPanel open={assessorOpen} onClose={() => setAssessorOpen(false)} />
    </div>
  );
}
