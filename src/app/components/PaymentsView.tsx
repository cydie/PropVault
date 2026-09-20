import { useEffect, useState } from 'react';
import { Banknote, CheckCircle, Plus, Printer, Search, XCircle } from 'lucide-react';
import { api, type PaymentRecord } from '@/lib/api';
import { hasPermission, type UserRole } from '@/lib/rbac';
import { toast } from 'sonner';
import { confirmAction, openPrintDocument } from '@/lib/uiActions';

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    Approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    Validated: 'bg-blue-50 text-blue-700 border border-blue-200',
    Pending: 'bg-amber-50 text-amber-700 border border-amber-200',
    Rejected: 'bg-red-50 text-red-700 border border-red-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

type LookupHit = {
  type: 'land' | 'building';
  id: string;
  td: string;
  pin: string;
  owner: string;
  barangay: string;
  classification: string;
  mv: string;
  av: string;
  status: string;
};

export function PaymentsView({ userRole }: { userRole: UserRole }) {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [lookupQ, setLookupQ] = useState('');
  const [lookupHits, setLookupHits] = useState<LookupHit[]>([]);
  const [selected, setSelected] = useState<LookupHit | null>(null);
  const [amount, setAmount] = useState('');
  const [taxYear, setTaxYear] = useState(String(new Date().getFullYear()));
  const [saving, setSaving] = useState(false);

  const canApprove = hasPermission(userRole, 'payments:approve');
  const canManage = hasPermission(userRole, 'payments:manage');

  const reload = () =>
    api
      .getPayments()
      .then(setPayments)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load payments'));

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  const filtered = payments.filter(
    (p) =>
      search === '' ||
      p.owner.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase()) ||
      (p.td || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.pin || '').toLowerCase().includes(search.toLowerCase())
  );

  async function runLookup() {
    if (!lookupQ.trim()) return;
    try {
      const res = await api.lookupProperty(lookupQ.trim());
      setLookupHits(res.results);
      if (!res.results.length) toast.message('No property found for that PIN / TD / owner');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lookup failed');
    }
  }

  function pickProperty(hit: LookupHit) {
    setSelected(hit);
    setAmount(String(hit.av || '').replace(/,/g, '') || '');
    setLookupHits([]);
  }

  async function createPayment() {
    if (!selected) {
      toast.error('Look up and select a property first');
      return;
    }
    if (!amount.trim() || !taxYear.trim()) {
      toast.error('Amount and tax year are required');
      return;
    }
    setSaving(true);
    try {
      await api.createPayment({
        propertyId: selected.id,
        owner: selected.owner,
        td: selected.td,
        pin: selected.pin,
        amount: amount.trim(),
        taxYear: taxYear.trim(),
      });
      toast.success('Payment recorded — pending validation');
      setShowCreate(false);
      setSelected(null);
      setLookupQ('');
      setAmount('');
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create payment');
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    const labels: Record<string, string> = {
      Validated: 'validate this payment',
      Approved: 'approve this payment and issue a receipt',
      Rejected: 'reject this payment',
    };
    if (!(await confirmAction(`Are you sure you want to ${labels[status] || status.toLowerCase()}?`, 'Confirm'))) return;

    setProcessingId(id);
    try {
      const res = await api.updatePaymentStatus(id, status);
      setPayments((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, status, receiptNo: res.receiptNo || p.receiptNo, validatedBy: userRole }
            : p
        )
      );
      toast.success(`Payment ${status.toLowerCase()}`);
      if (status === 'Approved' && res.receiptNo) {
        const pay = payments.find((p) => p.id === id);
        openPrintDocument(
          `OR ${res.receiptNo}`,
          `<h1>Official Receipt</h1>
          <p><strong>OR No.:</strong> ${res.receiptNo}</p>
          <p><strong>Payment ID:</strong> ${id}</p>
          <p><strong>Owner:</strong> ${pay?.owner || '—'}</p>
          <p><strong>TD / PIN:</strong> ${pay?.td || '—'} / ${pay?.pin || '—'}</p>
          <p><strong>Amount:</strong> ${pay?.amount || '—'}</p>
          <p><strong>Tax Year:</strong> ${pay?.taxYear || '—'}</p>
          <p>Issued ${new Date().toLocaleString()}</p>`
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-foreground" style={{ fontFamily: "'Roboto Slab', serif" }}>
            Tax Payment Records
          </h2>
          <p className="text-sm text-muted-foreground">
            Look up assessed value by PIN/TD, then validate and approve payments
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm"
            >
              <Plus size={14} /> Record Payment
            </button>
          )}
          <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center">
            <Banknote size={18} className="text-white" />
          </div>
        </div>
      </div>

      {showCreate && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-sm">New payment from assessed property</h3>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2 flex-1 min-w-[200px]">
              <Search size={14} className="text-muted-foreground" />
              <input
                value={lookupQ}
                onChange={(e) => setLookupQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void runLookup()}
                placeholder="PIN, TD No., or owner…"
                className="bg-transparent text-sm outline-none w-full"
              />
            </div>
            <button type="button" onClick={() => void runLookup()} className="px-3 py-2 border border-border rounded-lg text-sm hover:bg-secondary">
              Look up
            </button>
          </div>
          {lookupHits.length > 0 && (
            <ul className="border border-border rounded-lg divide-y max-h-40 overflow-auto text-sm">
              {lookupHits.map((h) => (
                <li key={`${h.type}-${h.id}`}>
                  <button
                    type="button"
                    onClick={() => pickProperty(h)}
                    className="w-full text-left px-3 py-2 hover:bg-secondary/50"
                  >
                    <span className="font-mono text-xs text-primary">{h.pin || h.td}</span>
                    <span className="mx-2">·</span>
                    {h.owner}
                    <span className="text-muted-foreground"> · AV {h.av}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {selected && (
            <div className="rounded-lg bg-secondary/40 p-3 text-sm grid sm:grid-cols-2 gap-2">
              <p>
                <span className="text-muted-foreground">Owner:</span> {selected.owner}
              </p>
              <p>
                <span className="text-muted-foreground">PIN:</span> {selected.pin}
              </p>
              <p>
                <span className="text-muted-foreground">TD/ARP:</span> {selected.td}
              </p>
              <p>
                <span className="text-muted-foreground">Assessed value:</span> {selected.av}
              </p>
              <label className="text-xs text-muted-foreground space-y-1">
                Amount
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-2 py-1.5 border border-border rounded-md text-sm bg-background"
                />
              </label>
              <label className="text-xs text-muted-foreground space-y-1">
                Tax year
                <input
                  value={taxYear}
                  onChange={(e) => setTaxYear(e.target.value)}
                  className="w-full px-2 py-1.5 border border-border rounded-md text-sm bg-background"
                />
              </label>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowCreate(false)} className="px-3 py-2 border rounded-lg text-sm">
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !selected}
              onClick={() => void createPayment()}
              className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save payment'}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 w-full max-w-xs">
        <Search size={14} className="text-muted-foreground shrink-0" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search payments..."
          className="bg-transparent text-sm outline-none w-full"
        />
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              {['ID', 'Owner', 'TD / PIN', 'Amount', 'Tax Year', 'Status', 'Receipt', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  Loading payment records…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No payment records found.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/30">
                  <td className="px-4 py-3 font-mono text-xs text-primary">{p.id}</td>
                  <td className="px-4 py-3 text-xs">{p.owner}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {p.td || '—'}
                    {p.pin ? <div>{p.pin}</div> : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{p.amount}</td>
                  <td className="px-4 py-3 text-xs">{p.taxYear}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{p.receiptNo || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {canApprove && p.status === 'Pending' && (
                        <button
                          type="button"
                          disabled={processingId === p.id}
                          onClick={() => void updateStatus(p.id, 'Validated')}
                          className="px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs"
                        >
                          Validate
                        </button>
                      )}
                      {canApprove && (p.status === 'Pending' || p.status === 'Validated') && (
                        <button
                          type="button"
                          disabled={processingId === p.id}
                          onClick={() => void updateStatus(p.id, 'Approved')}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 text-emerald-700 text-xs"
                        >
                          <CheckCircle size={11} /> Approve
                        </button>
                      )}
                      {canApprove && p.status !== 'Approved' && p.status !== 'Rejected' && (
                        <button
                          type="button"
                          disabled={processingId === p.id}
                          onClick={() => void updateStatus(p.id, 'Rejected')}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-50 text-red-700 text-xs"
                        >
                          <XCircle size={11} /> Reject
                        </button>
                      )}
                      {p.receiptNo && (
                        <button
                          type="button"
                          onClick={() =>
                            openPrintDocument(
                              `OR ${p.receiptNo}`,
                              `<h1>Official Receipt ${p.receiptNo}</h1><p>${p.owner} · ${p.amount} · ${p.taxYear}</p>`
                            )
                          }
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border text-xs"
                        >
                          <Printer size={11} /> OR
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
