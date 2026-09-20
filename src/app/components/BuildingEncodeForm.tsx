import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, type BuildingRecord } from '@/lib/api';
import { cadastralApi } from '@/lib/cadastralApi';
import { useData } from '@/context/DataContext';
import { resolveAssessorOptions } from '@/lib/assessorOptions';
import { FaasApprovalPanel } from '@/app/components/cadastral/faas/FaasApprovalPanel';

/** Signature lines from your municipal assessment paper */
const DEFAULT_RECOMMENDING = 'EDGAR C. CONALES, REA, Municipal Assessor';
const DEFAULT_APPROVED_BY = 'RAUL P. PABLICO, JR., REA, CE, Acting Provincial Assessor';

const STRUCTURAL_TYPES = [
  'Reinforced Concrete',
  'Steel Frame',
  'Mixed Materials',
  'Wood',
  'Light Materials',
  'Makeshift / Temporary',
] as const;

const BUILDING_KINDS = [
  'Residential',
  'Commercial',
  'Industrial',
  'Agricultural',
  'Institutional',
  'Special',
] as const;

type Props = {
  open: boolean;
  record?: BuildingRecord | null;
  onClose: () => void;
  onSaved: () => void;
};

type BuildingForm = {
  arp: string;
  pin: string;
  tdNo: string;
  ownerName: string;
  ownerAddress: string;
  ownerPhone: string;
  adminName: string;
  street: string;
  barangay: string;
  municipality: string;
  province: string;
  kind: string;
  classification: string;
  structural: string;
  floors: string;
  floorArea: string;
  yearBuilt: string;
  unitConstructionCost: string;
  depreciationPct: string;
  assessmentLevelPct: string;
  taxStatus: 'taxable' | 'exempt';
  actualUse: string;
  marketValue: string;
  assessedValue: string;
  effectivityYear: string;
  remarks: string;
  appraisedBy: string;
  appraisedDate: string;
  recommendingApproval: string;
  recommendingDate: string;
  approvedBy: string;
  approvedDate: string;
  memoranda: string;
  prevAssessedValue: string;
  prevOwner: string;
  effectivityDate: string;
  recordedBy: string;
  backTaxAssessedValue: string;
  backTaxYearFrom: string;
  backTaxYearTo: string;
  status: string;
};

function emptyForm(lgu: { provinceName: string; municipalName: string }): BuildingForm {
  return {
    arp: '',
    pin: '',
    tdNo: '',
    ownerName: '',
    ownerAddress: '',
    ownerPhone: '',
    adminName: '',
    street: '',
    barangay: 'Punta Baja (Poblacion)',
    municipality: lgu.municipalName,
    province: lgu.provinceName,
    kind: 'Residential',
    classification: "RES'L",
    structural: 'Reinforced Concrete',
    floors: '1',
    floorArea: '',
    yearBuilt: '',
    unitConstructionCost: '',
    depreciationPct: '0',
    assessmentLevelPct: '20',
    taxStatus: 'taxable',
    actualUse: "RES'L",
    marketValue: '',
    assessedValue: '',
    effectivityYear: String(new Date().getFullYear()),
    remarks: '',
    appraisedBy: '',
    appraisedDate: '',
    recommendingApproval: DEFAULT_RECOMMENDING,
    recommendingDate: '',
    approvedBy: DEFAULT_APPROVED_BY,
    approvedDate: '',
    memoranda: '',
    prevAssessedValue: '',
    prevOwner: '',
    effectivityDate: '',
    recordedBy: '',
    backTaxAssessedValue: '',
    backTaxYearFrom: '',
    backTaxYearTo: '',
    status: 'draft',
  };
}

function money(n: number) {
  return (Math.round(n * 100) / 100).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function BuildingEncodeForm({ open, record, onClose, onSaved }: Props) {
  const { settings } = useData();
  const options = useMemo(() => resolveAssessorOptions(settings), [settings]);
  const [form, setForm] = useState<BuildingForm>(() => emptyForm(options.lgu));
  const [saving, setSaving] = useState(false);
  const [buildingPin, setBuildingPin] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!record) {
      setForm(emptyForm(options.lgu));
      return;
    }
    setForm({
      ...emptyForm(options.lgu),
      arp: record.arp,
      pin: record.pin,
      ownerName: record.owner,
      barangay: record.barangay,
      kind: record.kind,
      structural: record.structural,
      floors: record.floors,
      floorArea: String(record.floorArea).replace(/\s*sqm.*/i, ''),
      marketValue: String(record.mv).replace(/,/g, ''),
      assessedValue: String(record.av || '').replace(/,/g, ''),
      classification: record.kind?.toUpperCase().includes('RES') ? "RES'L" : "RES'L",
      status: record.status === 'Approved' ? 'approved' : 'draft',
    });
  }, [open, record, options.lgu]);

  const computed = useMemo(() => {
    const area = parseFloat(form.floorArea) || 0;
    const ucc = parseFloat(form.unitConstructionCost) || 0;
    const dep = parseFloat(form.depreciationPct) || 0;
    const level = parseFloat(form.assessmentLevelPct) || 20;
    const base = area * ucc;
    const mv = form.marketValue.trim()
      ? parseFloat(form.marketValue.replace(/,/g, '')) || 0
      : Math.round(base * (1 - dep / 100) * 100) / 100;
    const av = form.assessedValue.trim()
      ? parseFloat(form.assessedValue.replace(/,/g, '')) || 0
      : Math.round(mv * (level / 100) * 100) / 100;
    return { base, mv, av };
  }, [form.floorArea, form.unitConstructionCost, form.depreciationPct, form.assessmentLevelPct, form.marketValue, form.assessedValue]);

  if (!open) return null;

  function set<K extends keyof BuildingForm>(key: K, value: BuildingForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function suggestPin() {
    if (!form.barangay.trim()) {
      toast.warning('Select a barangay first');
      return;
    }
    setBuildingPin(true);
    try {
      const { pin } = await cadastralApi.buildPin({
        barangay: form.barangay,
        sectionNo: '000',
        assessorLotNo: '',
        kindCode: '1001',
      });
      set('pin', pin);
      toast.success('PIN suggested (kind 1001 Building)');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not build PIN');
    } finally {
      setBuildingPin(false);
    }
  }

  async function save() {
    if (!form.arp.trim() || !form.pin.trim() || !form.ownerName.trim() || !form.barangay.trim()) {
      toast.error('ARP, PIN, Owner, and Barangay are required');
      return;
    }
    setSaving(true);
    try {
      const status =
        form.status === 'approved'
          ? 'Approved'
          : form.taxStatus === 'exempt'
            ? 'Exempt'
            : 'Pending';
      const body = {
        arp: form.arp,
        pin: form.pin,
        owner: form.ownerName,
        barangay: form.barangay,
        kind: form.kind,
        structural: form.structural,
        floors: form.floors,
        floorArea: `${form.floorArea || '0'} sqm`,
        mv: money(computed.mv),
        av: money(computed.av),
        status,
        details: {
          form: '1-Building',
          kindCode: '1001',
          tdNo: form.tdNo,
          ownerAddress: form.ownerAddress,
          ownerPhone: form.ownerPhone,
          adminName: form.adminName,
          street: form.street,
          municipality: form.municipality,
          province: form.province,
          classification: form.classification,
          actualUse: form.actualUse,
          yearBuilt: form.yearBuilt,
          unitConstructionCost: form.unitConstructionCost,
          depreciationPct: form.depreciationPct,
          assessmentLevelPct: form.assessmentLevelPct,
          taxStatus: form.taxStatus,
          effectivityYear: form.effectivityYear,
          remarks: form.remarks,
          appraisedBy: form.appraisedBy,
          recommendingApproval: form.recommendingApproval,
          approvedBy: form.approvedBy,
          memoranda: form.memoranda,
        },
      };

      if (record?.id) await api.updateBuilding(record.id, body);
      else await api.createBuilding(body);

      toast.success(record ? 'Building Form 1 updated' : 'Building Form 1 encoded');
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save building form');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs';

  return (
    <div className="fixed inset-0 z-[2000] flex items-stretch justify-center bg-black/45 p-2 sm:p-4" role="dialog" aria-modal="true">
      <div className="flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-[#f8f6f1] shadow-2xl ring-1 ring-slate-300">
        <header className="shrink-0 border-b border-slate-300 bg-white px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Form No. 1 · Building / Structure · Kind code 1001
              </p>
              <h2 className="font-serif text-lg font-bold text-slate-900">
                Real Property Field Appraisal &amp; Assessment Sheet
              </h2>
              <p className="text-xs text-slate-600">
                Buildings &amp; Structures · aligned to Assessment Roll (Bldg. / classification)
              </p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100" aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <section className="rounded-lg border border-slate-300 bg-white p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Property identification
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">ARP / ARPN</span>
                <input value={form.arp} onChange={(e) => set('arp', e.target.value)} className={inputCls} />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">T.D. No.</span>
                <input value={form.tdNo} onChange={(e) => set('tdNo', e.target.value)} className={inputCls} placeholder="24-14-0001-…" />
              </label>
              <label className="space-y-1 text-xs sm:col-span-2">
                <span className="text-slate-500">PIN ({options.pinPrefix}-…)</span>
                <div className="flex gap-1.5">
                  <input
                    value={form.pin}
                    onChange={(e) => set('pin', e.target.value)}
                    className={`${inputCls} font-mono`}
                    placeholder={`${options.pinPrefix}-001-000-(000)-1001`}
                  />
                  <button
                    type="button"
                    disabled={buildingPin}
                    onClick={() => void suggestPin()}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-300 bg-slate-50 px-2 text-[11px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    {buildingPin ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    Suggest
                  </button>
                </div>
              </label>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2 rounded-lg border border-slate-300 bg-white p-3 text-xs">
              <p className="font-bold text-slate-700">Property owner</p>
              <input placeholder="Surname, Given M.I." value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)} className={inputCls} />
              <input placeholder="Address of property owner" value={form.ownerAddress} onChange={(e) => set('ownerAddress', e.target.value)} className={inputCls} />
              <input placeholder="Tel / Mobile" value={form.ownerPhone} onChange={(e) => set('ownerPhone', e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-2 rounded-lg border border-slate-300 bg-white p-3 text-xs">
              <p className="font-bold text-slate-700">Location</p>
              <input placeholder="Street" value={form.street} onChange={(e) => set('street', e.target.value)} className={inputCls} />
              <select value={form.barangay} onChange={(e) => set('barangay', e.target.value)} className={inputCls}>
                {options.barangays.map((b) => (
                  <option key={`${b.code}-${b.name}`} value={b.name}>
                    {b.code} — {b.name}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input value={form.municipality} readOnly className={inputCls} title="From Settings → LGU identity" />
                <input value={form.province} readOnly className={inputCls} title="From Settings → LGU identity" />
              </div>
              <input placeholder="Administrator / occupant (optional)" value={form.adminName} onChange={(e) => set('adminName', e.target.value)} className={inputCls} />
            </div>
          </section>

          <section className="rounded-lg border border-slate-300 bg-white p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Building / structure appraisal (Kind: Bldg. · 1001)
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">Kind of building</span>
                <select value={form.kind} onChange={(e) => set('kind', e.target.value)} className={inputCls}>
                  {BUILDING_KINDS.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">Classification (Assessment Roll)</span>
                <select value={form.classification} onChange={(e) => set('classification', e.target.value)} className={inputCls}>
                  {options.actualUseClasses.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">Actual use</span>
                <input value={form.actualUse} onChange={(e) => set('actualUse', e.target.value)} className={inputCls} />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">Structural type</span>
                <select value={form.structural} onChange={(e) => set('structural', e.target.value)} className={inputCls}>
                  {STRUCTURAL_TYPES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">No. of floors / storeys</span>
                <input value={form.floors} onChange={(e) => set('floors', e.target.value)} className={inputCls} />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">Floor area (sqm)</span>
                <input type="number" value={form.floorArea} onChange={(e) => set('floorArea', e.target.value)} className={inputCls} />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">Year built</span>
                <input value={form.yearBuilt} onChange={(e) => set('yearBuilt', e.target.value)} className={inputCls} />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">Unit construction cost</span>
                <input type="number" value={form.unitConstructionCost} onChange={(e) => set('unitConstructionCost', e.target.value)} className={inputCls} />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">Depreciation %</span>
                <input type="number" value={form.depreciationPct} onChange={(e) => set('depreciationPct', e.target.value)} className={inputCls} />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">Assessment level %</span>
                <input type="number" value={form.assessmentLevelPct} onChange={(e) => set('assessmentLevelPct', e.target.value)} className={inputCls} />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">Tax status</span>
                <select value={form.taxStatus} onChange={(e) => set('taxStatus', e.target.value as 'taxable' | 'exempt')} className={inputCls}>
                  <option value="taxable">Taxable</option>
                  <option value="exempt">Exempt</option>
                </select>
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">Effectivity year</span>
                <input value={form.effectivityYear} onChange={(e) => set('effectivityYear', e.target.value)} className={inputCls} />
              </label>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-xs ring-1 ring-slate-200 sm:grid-cols-4">
              <div>
                <p className="text-slate-500">Base (area × UCC)</p>
                <p className="font-mono font-semibold">{money(computed.base)}</p>
              </div>
              <div>
                <p className="text-slate-500">Market value</p>
                <input
                  value={form.marketValue}
                  onChange={(e) => set('marketValue', e.target.value)}
                  placeholder={money(computed.mv)}
                  className={inputCls}
                />
              </div>
              <div>
                <p className="text-slate-500">Assessed value</p>
                <input
                  value={form.assessedValue}
                  onChange={(e) => set('assessedValue', e.target.value)}
                  placeholder={money(computed.av)}
                  className={inputCls}
                />
              </div>
              <div>
                <p className="text-slate-500">Computed AV</p>
                <p className="font-mono text-sm font-bold text-blue-900">{money(computed.av)}</p>
              </div>
            </div>

            <label className="mt-3 block space-y-1 text-xs">
              <span className="text-slate-500">Remarks</span>
              <textarea rows={2} value={form.remarks} onChange={(e) => set('remarks', e.target.value)} className={inputCls} />
            </label>
          </section>

          <div className="rounded-lg border border-slate-300 bg-white p-3">
            <FaasApprovalPanel
              value={{
                appraisedBy: form.appraisedBy,
                appraisedDate: form.appraisedDate,
                recommendingApproval: form.recommendingApproval,
                recommendingDate: form.recommendingDate,
                approvedBy: form.approvedBy,
                approvedDate: form.approvedDate,
                memoranda: form.memoranda,
                prevAssessedValue: form.prevAssessedValue,
                prevOwner: form.prevOwner,
                effectivityDate: form.effectivityDate,
                recordedBy: form.recordedBy,
                backTaxAssessedValue: form.backTaxAssessedValue,
                backTaxYearFrom: form.backTaxYearFrom,
                backTaxYearTo: form.backTaxYearTo,
                status: form.status,
              }}
              onChange={(v) => setForm((f) => ({ ...f, ...v }))}
            />
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-300 bg-white px-4 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1e3a8a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {record ? 'Update Building Form' : 'Save Building Form'}
          </button>
        </footer>
      </div>
    </div>
  );
}
