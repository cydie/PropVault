import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Loader2, Printer, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  cadastralApi,
  type AssessmentRollRow,
  type OwnershipRecord,
  type TaxMapRollRow,
} from '@/lib/cadastralApi';
import { useData } from '@/context/DataContext';
import { resolveAssessorOptions, type AssessorMetaPayload } from '@/lib/assessorOptions';
import { formatMoney } from '@/lib/assessorIndex';
import { openPrintDocument } from '@/lib/uiActions';

type Tab = 'taxmap' | 'assessment' | 'ownership';

type Props = {
  open: boolean;
  onClose: () => void;
  onSelectParcel?: (id: number) => void;
};

export function AssessorRollsPanel({ open, onClose, onSelectParcel }: Props) {
  const { settings } = useData();
  const [meta, setMeta] = useState<AssessorMetaPayload | null>(null);
  const options = useMemo(() => resolveAssessorOptions(settings, meta), [settings, meta]);

  const [tab, setTab] = useState<Tab>('taxmap');
  const [barangay, setBarangay] = useState('all');
  const [loading, setLoading] = useState(false);
  const [taxGroups, setTaxGroups] = useState<Record<string, TaxMapRollRow[]>>({});
  const [taxHeader, setTaxHeader] = useState<Record<string, string>>({});
  const [barangayOrder, setBarangayOrder] = useState<string[]>([]);
  const [assessRows, setAssessRows] = useState<AssessmentRollRow[]>([]);
  const [assessTotal, setAssessTotal] = useState(0);
  const [assessHeader, setAssessHeader] = useState<Record<string, string>>({});
  const [ownership, setOwnership] = useState<OwnershipRecord[]>([]);

  useEffect(() => {
    if (!open) return;
    void cadastralApi
      .assessorMeta()
      .then((m) => setMeta(m))
      .catch(() => setMeta(null));
  }, [open]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const brgyParam = barangay === 'all' ? undefined : barangay;
      if (tab === 'taxmap') {
        const res = await cadastralApi.taxMapControlRoll(brgyParam ?? 'all');
        setTaxGroups(res.groups);
        setTaxHeader(res.header);
        setBarangayOrder(res.barangayOrder || []);
      } else if (tab === 'assessment') {
        const res = await cadastralApi.assessmentRoll(brgyParam ?? 'all', 'taxable');
        setAssessRows(res.rows);
        setAssessTotal(res.totalAssessed);
        setAssessHeader(res.header);
      } else {
        const res = await cadastralApi.ownershipRecords(brgyParam);
        setOwnership(res.records);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load assessor roll');
    } finally {
      setLoading(false);
    }
  }, [tab, barangay]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const flatTaxRows = useMemo(() => {
    const order =
      barangayOrder.length > 0 ? barangayOrder : options.barangays.map((b) => b.name);
    const keys = Object.keys(taxGroups).sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    return keys.flatMap((k) => taxGroups[k].map((r) => ({ ...r, _group: k })));
  }, [taxGroups, barangayOrder, options.barangays]);

  const lguLine = `${options.lgu.provinceName} (${options.lgu.provinceCode}) · ${options.lgu.municipalName} (${options.lgu.municipalCode})`;

  function printCurrent() {
    if (tab === 'taxmap') {
      const body = flatTaxRows
        .map(
          (r) =>
            `<tr>
              <td>${esc(r.assessorLotNo)}</td><td>${esc(r.surveyLotNo)}</td>
              <td>${esc(r.titleNo)}</td><td>${esc(r.area)}</td><td>${esc(r.classCode || r.landTypeClass)}</td>
              <td>${esc(r.ownerName)}</td><td>${esc(r.arpNo)}</td><td>${esc(r.tdNo)}</td>
              <td>${r.building ? '✓' : ''}</td><td>${r.machinery ? '✓' : ''}</td>
              <td>${esc(r.othersIdentify)}</td><td>${esc(r.remarks)}</td>
            </tr>`,
        )
        .join('');
      openPrintDocument(
        'Tax Map Control Roll',
        `<h1>TAX MAP CONTROL ROLL</h1>
         <p>Prov./City: ${esc(taxHeader.province || options.lgu.provinceName)} (Index ${esc(taxHeader.provinceCode || options.lgu.provinceCode)}) · Mun./District: ${esc(taxHeader.municipality || options.lgu.municipalName)} (Index ${esc(taxHeader.municipalityCode || options.lgu.municipalCode)})</p>
         <p>Barangay: ${esc(taxHeader.barangay || 'ALL')} · Index: ${esc(taxHeader.barangayIndex || '—')} · Prepared: ${esc(taxHeader.datePrepared || '')}</p>
         <table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:11px">
           <thead><tr>
             <th>Assessor Lot No.</th><th>Survey Lot No.</th><th>Title No.</th><th>Area</th>
             <th>Class</th><th>Owner</th><th>ARP</th><th>TD</th>
             <th>1001</th><th>2001</th><th>Others</th><th>Remarks</th>
           </tr></thead>
           <tbody>${body}</tbody>
         </table>`,
      );
    } else if (tab === 'assessment') {
      const body = assessRows
        .map(
          (r) =>
            `<tr>
              <td>${esc(r.arpNo)}</td><td>${esc(r.tdNo)}</td><td>${esc(r.pin)}</td>
              <td>${esc(r.ownerName)}</td><td>${esc(r.kind)}</td><td>${esc(r.classification)}</td>
              <td style="text-align:right">${formatMoney(r.assessedValue)}</td>
              <td>${esc(r.barangay)}</td>
            </tr>`,
        )
        .join('');
      openPrintDocument(
        'Assessment Roll',
        `<h1>${esc(assessHeader.title || 'ASSESSMENT ROLL — Taxable Properties')}</h1>
         <p>${esc(assessHeader.province || options.lgu.provinceName)} (${esc(assessHeader.provinceCode || options.lgu.provinceCode)}) · ${esc(assessHeader.municipality || options.lgu.municipalName)} (${esc(assessHeader.municipalityCode || options.lgu.municipalCode)})</p>
         <p>Barangay: ${esc(assessHeader.barangay || 'ALL')} · Prepared: ${esc(assessHeader.datePrepared || '')}</p>
         <p>Total assessed: ${formatMoney(assessTotal)}</p>
         <table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:11px">
           <thead><tr>
             <th>ARP</th><th>TD</th><th>PIN</th><th>Owner</th><th>Kind</th><th>Class</th><th>AV</th><th>Brgy</th>
           </tr></thead>
           <tbody>${body}</tbody>
         </table>`,
      );
    } else {
      const body = ownership
        .map(
          (r) =>
            `<tr>
              <td>${esc(r.pin)}</td><td>${esc(r.assessorLotNo)}</td><td>${esc(r.ownerName)}</td>
              <td>${esc(r.barangay)} (${esc(r.barangayIndex)})</td><td>${esc(r.kindLabel)}</td>
              <td>${esc(r.landTypeClass)}</td><td>${esc(r.classification)}</td>
              <td style="text-align:right">${formatMoney(r.assessedValue)}</td>
            </tr>`,
        )
        .join('');
      openPrintDocument(
        'Ownership Record Form',
        `<h1>Ownership Record Form</h1>
         <p>Index ${esc(options.pinPrefix)} · Sorted by barangay index</p>
         <p>Kinds: ${options.propertyKinds.map((k) => `${k.code}-${k.short || k.label}`).join(' · ')}</p>
         <table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:11px">
           <thead><tr>
             <th>PIN</th><th>Assessor Lot No.</th><th>Owner</th><th>Barangay (Index)</th>
             <th>Kind</th><th>Type ng lupa</th><th>Classification</th><th>Assessed Value</th>
           </tr></thead>
           <tbody>${body}</tbody>
         </table>`,
      );
    }
    toast.success('Print view opened');
  }

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-[1850] flex justify-end bg-black/40">
      <aside className="flex h-full w-full max-w-5xl flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-slate-700" />
              <h2 className="text-base font-bold text-slate-900">Assessor Tax Map &amp; Rolls</h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {lguLine} · Sorted by barangay index (1 = Poblacion)
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
          {(
            [
              ['taxmap', 'Tax Map Control Roll'],
              ['assessment', 'Assessment Roll'],
              ['ownership', 'Ownership Record'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                tab === id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
          <select
            value={barangay}
            onChange={(e) => setBarangay(e.target.value)}
            className="ml-auto rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
          >
            <option value="all">All barangays</option>
            {options.barangays.map((b) => (
              <option key={`${b.code}-${b.name}`} value={b.name}>
                {b.code} — {b.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-semibold"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <button
            type="button"
            onClick={printCurrent}
            className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1.5 text-xs font-semibold text-slate-900 ring-1 ring-amber-200"
          >
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
        </div>

        <div className="flex-1 overflow-auto p-3">
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : tab === 'taxmap' ? (
            <TaxMapTable rows={flatTaxRows} onSelect={onSelectParcel} />
          ) : tab === 'assessment' ? (
            <AssessmentTable rows={assessRows} total={assessTotal} onSelect={onSelectParcel} />
          ) : (
            <OwnershipTable rows={ownership} onSelect={onSelectParcel} />
          )}
        </div>
      </aside>
    </div>
  );
}

function esc(v: unknown) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function TaxMapTable({
  rows,
  onSelect,
}: {
  rows: (TaxMapRollRow & { _group?: string })[];
  onSelect?: (id: number) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[1100px] text-[11px]">
        <thead className="bg-slate-100 text-left text-slate-600">
          <tr>
            <th className="px-2 py-2">Brgy</th>
            <th className="px-2 py-2">Assessor Lot No.</th>
            <th className="px-2 py-2">Survey Lot No.</th>
            <th className="px-2 py-2">Title No.</th>
            <th className="px-2 py-2">Area</th>
            <th className="px-2 py-2">Class / Type ng lupa</th>
            <th className="px-2 py-2">Owner</th>
            <th className="px-2 py-2">ARP</th>
            <th className="px-2 py-2">TD No.</th>
            <th className="px-2 py-2">PIN</th>
            <th className="px-2 py-2">1001 Bldg</th>
            <th className="px-2 py-2">2001 Mach</th>
            <th className="px-2 py-2">Others (3001/4001)</th>
            <th className="px-2 py-2">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
              onClick={() => onSelect?.(r.id)}
            >
              <td className="px-2 py-1.5">{r._group}</td>
              <td className="px-2 py-1.5 font-mono">{r.assessorLotNo}</td>
              <td className="px-2 py-1.5">{r.surveyLotNo}</td>
              <td className="px-2 py-1.5">{r.titleNo}</td>
              <td className="px-2 py-1.5">{r.area}</td>
              <td className="px-2 py-1.5">{r.classCode || r.landTypeClass}</td>
              <td className="px-2 py-1.5">{r.ownerName}</td>
              <td className="px-2 py-1.5">{r.arpNo}</td>
              <td className="px-2 py-1.5">{r.tdNo}</td>
              <td className="px-2 py-1.5 font-mono text-[10px]">{r.pin}</td>
              <td className="px-2 py-1.5 text-center">{r.building ? '✓' : ''}</td>
              <td className="px-2 py-1.5 text-center">{r.machinery ? '✓' : ''}</td>
              <td className="px-2 py-1.5">{r.othersIdentify}</td>
              <td className="px-2 py-1.5">{r.remarks}</td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={14} className="px-3 py-8 text-center text-slate-400">
                No parcels in this roll filter.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AssessmentTable({
  rows,
  total,
  onSelect,
}: {
  rows: AssessmentRollRow[];
  total: number;
  onSelect?: (id: number) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">Total assessed value: {formatMoney(total)}</p>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[900px] text-[11px]">
          <thead className="bg-slate-100 text-left text-slate-600">
            <tr>
              <th className="px-2 py-2">ARP</th>
              <th className="px-2 py-2">TD</th>
              <th className="px-2 py-2">PIN</th>
              <th className="px-2 py-2">Owner</th>
              <th className="px-2 py-2">Kind</th>
              <th className="px-2 py-2">Class</th>
              <th className="px-2 py-2 text-right">AV</th>
              <th className="px-2 py-2">Barangay</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={`${r.pin}-${i}`}
                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                onClick={() => r.parcelId && onSelect?.(r.parcelId)}
              >
                <td className="px-2 py-1.5">{r.arpNo}</td>
                <td className="px-2 py-1.5">{r.tdNo}</td>
                <td className="px-2 py-1.5 font-mono text-[10px]">{r.pin}</td>
                <td className="px-2 py-1.5">{r.ownerName}</td>
                <td className="px-2 py-1.5">{r.kind}</td>
                <td className="px-2 py-1.5">{r.classification}</td>
                <td className="px-2 py-1.5 text-right">{formatMoney(r.assessedValue)}</td>
                <td className="px-2 py-1.5">{r.barangay}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-400">
                  No assessment roll rows.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OwnershipTable({
  rows,
  onSelect,
}: {
  rows: OwnershipRecord[];
  onSelect?: (id: number) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[900px] text-[11px]">
        <thead className="bg-slate-100 text-left text-slate-600">
          <tr>
            <th className="px-2 py-2">PIN</th>
            <th className="px-2 py-2">Assessor Lot</th>
            <th className="px-2 py-2">Owner</th>
            <th className="px-2 py-2">Barangay</th>
            <th className="px-2 py-2">Kind</th>
            <th className="px-2 py-2">Type ng lupa</th>
            <th className="px-2 py-2">Class</th>
            <th className="px-2 py-2 text-right">AV</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
              onClick={() => r.parcelId && onSelect?.(r.parcelId)}
            >
              <td className="px-2 py-1.5 font-mono text-[10px]">{r.pin}</td>
              <td className="px-2 py-1.5">{r.assessorLotNo}</td>
              <td className="px-2 py-1.5">{r.ownerName}</td>
              <td className="px-2 py-1.5">
                {r.barangay} ({r.barangayIndex})
              </td>
              <td className="px-2 py-1.5">{r.kindLabel}</td>
              <td className="px-2 py-1.5">{r.landTypeClass}</td>
              <td className="px-2 py-1.5">{r.classification}</td>
              <td className="px-2 py-1.5 text-right">{formatMoney(r.assessedValue)}</td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={8} className="px-3 py-8 text-center text-slate-400">
                No ownership records.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
