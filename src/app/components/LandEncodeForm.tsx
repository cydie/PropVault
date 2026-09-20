import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, type LandRecord } from '@/lib/api';
import {
  cadastralApi,
  type FaasLandRow,
  type FaasPlantRow,
  type FaasSheet,
} from '@/lib/cadastralApi';
import { useData } from '@/context/DataContext';
import { resolveAssessorOptions } from '@/lib/assessorOptions';
import { FaasLandAppraisalTable } from '@/app/components/cadastral/faas/FaasLandAppraisalTable';
import { FaasPlantsTreesTable } from '@/app/components/cadastral/faas/FaasPlantsTreesTable';
import { FaasValueAdjustmentPanel } from '@/app/components/cadastral/faas/FaasValueAdjustmentPanel';
import { FaasApprovalPanel } from '@/app/components/cadastral/faas/FaasApprovalPanel';

/** Defaults from your municipal FAAS paper (Form No. 1-A) */
const DEFAULT_RECOMMENDING = 'EDGAR C. CONALES, REA, Municipal Assessor';
const DEFAULT_APPROVED_BY = 'RAUL P. PABLICO, JR., REA, CE, Acting Provincial Assessor';

type Props = {
  open: boolean;
  record?: LandRecord | null;
  onClose: () => void;
  onSaved: () => void;
};

function emptyHeader(lgu: { provinceName: string; municipalName: string }): Partial<FaasSheet> {
  return {
    tdNo: '',
    pin: '',
    arpNo: '',
    octNo: '',
    surveyNo: '',
    lotNo: '',
    blkNo: '',
    entryDate: new Date().toISOString().slice(0, 10),
    ownerName: '',
    ownerAddress: '',
    ownerPhone: '',
    adminName: '',
    adminAddress: '',
    adminPhone: '',
    street: '',
    barangay: 'Punta Baja (Poblacion)',
    municipality: lgu.municipalName,
    province: lgu.provinceName,
    boundNorth: '',
    boundEast: '',
    boundSouth: '',
    boundWest: '',
    adjRoadFrontagePct: 0,
    adjDistanceRoadKm: 0,
    adjDistanceRoadPct: 0,
    adjDistanceMarketKm: 0,
    adjDistanceMarketPct: 0,
    assessmentLevelPct: 20,
    taxStatus: 'taxable',
    actualUse: "RES'L",
    recommendingApproval: DEFAULT_RECOMMENDING,
    approvedBy: DEFAULT_APPROVED_BY,
    status: 'draft',
  };
}

export function LandEncodeForm({ open, record, onClose, onSaved }: Props) {
  const { settings } = useData();
  const options = useMemo(() => resolveAssessorOptions(settings), [settings]);
  const [saving, setSaving] = useState(false);
  const [buildingPin, setBuildingPin] = useState(false);
  const [sheetId, setSheetId] = useState<number | null>(null);
  const [header, setHeader] = useState<Partial<FaasSheet>>(() => emptyHeader(options.lgu));
  const [landRows, setLandRows] = useState<FaasLandRow[]>([
    {
      classification: "RES'L",
      subClass: '',
      actualUse: "RES'L",
      landTypeClass: 'Flat',
      classCode: 'Flat',
      area: 0,
      unitValue: 0,
      baseMarketValue: 0,
    },
  ]);
  const [plantRows, setPlantRows] = useState<FaasPlantRow[]>([]);

  useEffect(() => {
    if (!open) return;
    if (!record) {
      setSheetId(null);
      setHeader(emptyHeader(options.lgu));
      setLandRows([
        {
          classification: "RES'L",
          subClass: '',
          actualUse: "RES'L",
          landTypeClass: 'Flat',
          classCode: 'Flat',
          area: 0,
          unitValue: 0,
          baseMarketValue: 0,
        },
      ]);
      setPlantRows([]);
      return;
    }

    setHeader({
      ...emptyHeader(options.lgu),
      tdNo: record.td,
      pin: record.pin,
      ownerName: record.owner,
      barangay: record.barangay,
      actualUse: record.classification,
      baseMarketValue: Number(String(record.mv).replace(/,/g, '')) || 0,
      assessedValue: Number(String(record.av).replace(/,/g, '')) || 0,
      status: record.status === 'Approved' ? 'approved' : 'draft',
    });
    setLandRows([
      {
        classification: record.classification || "RES'L",
        subClass: '',
        actualUse: record.classification || "RES'L",
        landTypeClass: 'Flat',
        classCode: 'Flat',
        area: parseFloat(String(record.area).replace(/[^\d.]/g, '')) || 0,
        unitValue: 0,
        baseMarketValue: Number(String(record.mv).replace(/,/g, '')) || 0,
      },
    ]);
    setPlantRows([]);
    setSheetId(null);
  }, [open, record, options.lgu]);

  const suggestPin = async () => {
    if (!header.barangay?.trim()) {
      toast.warning('Select a barangay first');
      return;
    }
    setBuildingPin(true);
    try {
      const { pin } = await cadastralApi.buildPin({
        barangay: header.barangay,
        sectionNo: '000',
        assessorLotNo: header.lotNo || '',
        kindCode: '',
      });
      setField('pin', pin);
      toast.success('PIN suggested from LGU / barangay codes');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not build PIN');
    } finally {
      setBuildingPin(false);
    }
  };

  const landMv = useMemo(() => landRows.reduce((s, r) => s + (r.baseMarketValue || 0), 0), [landRows]);
  const plantsMv = useMemo(() => plantRows.reduce((s, r) => s + (r.baseMarketValue || 0), 0), [plantRows]);
  const baseMarketValue = Math.round((landMv + plantsMv) * 100) / 100;

  useEffect(() => {
    const totalAdj =
      Number(header.adjRoadFrontagePct || 0) +
      Number(header.adjDistanceRoadPct || 0) +
      Number(header.adjDistanceMarketPct || 0);
    const adjusted = Math.round(baseMarketValue * (1 + totalAdj / 100) * 100) / 100;
    const assessed =
      Math.round(adjusted * ((Number(header.assessmentLevelPct) || 20) / 100) * 100) / 100;
    setHeader((h) => ({
      ...h,
      baseMarketValue,
      totalAdjustmentsPct: Math.round(totalAdj * 100) / 100,
      adjustedMarketValue: adjusted,
      assessedValue: assessed,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    baseMarketValue,
    header.adjRoadFrontagePct,
    header.adjDistanceRoadPct,
    header.adjDistanceMarketPct,
    header.assessmentLevelPct,
  ]);

  if (!open) return null;

  function setField<K extends keyof FaasSheet>(key: K, value: FaasSheet[K]) {
    setHeader((h) => ({ ...h, [key]: value }));
  }

  const adj = {
    adjRoadFrontagePct: Number(header.adjRoadFrontagePct) || 0,
    adjDistanceRoadKm: Number(header.adjDistanceRoadKm) || 0,
    adjDistanceRoadPct: Number(header.adjDistanceRoadPct) || 0,
    adjDistanceMarketKm: Number(header.adjDistanceMarketKm) || 0,
    adjDistanceMarketPct: Number(header.adjDistanceMarketPct) || 0,
    assessmentLevelPct: Number(header.assessmentLevelPct) || 20,
    taxStatus: header.taxStatus || 'taxable',
    actualUse: header.actualUse || '',
    baseMarketValue,
    totalAdjustmentsPct: Number(header.totalAdjustmentsPct) || 0,
    adjustedMarketValue: Number(header.adjustedMarketValue) || 0,
    assessedValue: Number(header.assessedValue) || 0,
  };

  async function save() {
    if (!header.tdNo?.trim() || !header.pin?.trim() || !header.ownerName?.trim() || !header.barangay?.trim()) {
      toast.error('TD No., PIN, Owner, and Barangay are required (as on Form 1-A)');
      return;
    }
    setSaving(true);
    try {
      const primaryClass = landRows[0]?.classification || header.actualUse || "RES'L";
      const areaLabel =
        landRows.length === 1
          ? `${landRows[0].area} sqm`
          : `${landRows.reduce((s, r) => s + (r.area || 0), 0)} sqm`;
      const mv = String(header.adjustedMarketValue ?? header.baseMarketValue ?? 0);
      const av = String(header.assessedValue ?? 0);
      const status =
        header.status === 'approved'
          ? 'Approved'
          : header.taxStatus === 'exempt'
            ? 'Exempt'
            : 'Pending';

      const landBody = {
        td: header.tdNo,
        pin: header.pin,
        owner: header.ownerName,
        barangay: header.barangay,
        classification: primaryClass,
        area: areaLabel,
        mv,
        av,
        status,
        details: {
          form: '1-A',
          arpNo: header.arpNo,
          octNo: header.octNo,
          surveyNo: header.surveyNo,
          lotNo: header.lotNo,
          blkNo: header.blkNo,
          ownerAddress: header.ownerAddress,
          ownerPhone: header.ownerPhone,
          adminName: header.adminName,
          street: header.street,
          municipality: header.municipality,
          province: header.province,
          bounds: {
            north: header.boundNorth,
            east: header.boundEast,
            south: header.boundSouth,
            west: header.boundWest,
          },
          landTypeClass: landRows[0]?.landTypeClass,
          landRows,
          plantRows,
        },
      };

      const landRes = record?.id
        ? await api.updateLand(record.id, landBody)
        : await api.createLand(landBody);

      const faasBody = {
        ...header,
        landPropertyId: landRes.id,
        landRows,
        plantRows,
        prevAssessedValue: header.prevAssessedValue ? Number(header.prevAssessedValue) : null,
        backTaxAssessedValue: header.backTaxAssessedValue ? Number(header.backTaxAssessedValue) : null,
        backTaxYearFrom: header.backTaxYearFrom ? Number(header.backTaxYearFrom) : null,
        backTaxYearTo: header.backTaxYearTo ? Number(header.backTaxYearTo) : null,
      };

      try {
        const saved = sheetId
          ? await cadastralApi.updateFaas(sheetId, faasBody)
          : await cadastralApi.createFaas(faasBody);
        if (saved.sheet) setSheetId(saved.sheet.id);
      } catch {
        /* FAAS optional if cadastral DB not ready — land record still saved */
      }

      toast.success(record ? 'Land Form 1-A updated' : 'Land Form 1-A encoded');
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save Form 1-A');
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
                Form No. 1-A · Reference: your municipal paper
              </p>
              <h2 className="font-serif text-lg font-bold text-slate-900">
                Real Property Field Appraisal &amp; Assessment Sheet
              </h2>
              <p className="text-xs text-slate-600">
                Land / Plants &amp; Trees · {options.lgu.municipalName}, {options.lgu.provinceName}
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
              {(
                [
                  ['tdNo', 'TD No.'],
                  ['arpNo', 'ARP No.'],
                  ['octNo', 'OCT No.'],
                  ['surveyNo', 'Survey No.'],
                  ['lotNo', 'Lot No.'],
                  ['blkNo', 'Blk No.'],
                  ['entryDate', 'Date'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="space-y-1 text-xs">
                  <span className="text-slate-500">{label}</span>
                  <input
                    type={key === 'entryDate' ? 'date' : 'text'}
                    value={(header[key] as string) || ''}
                    onChange={(e) => setField(key, e.target.value as never)}
                    className={inputCls}
                  />
                </label>
              ))}
              <label className="col-span-2 space-y-1 text-xs sm:col-span-2">
                <span className="text-slate-500">PIN</span>
                <div className="flex gap-1.5">
                  <input
                    value={header.pin || ''}
                    onChange={(e) => setField('pin', e.target.value)}
                    className={`${inputCls} font-mono`}
                    placeholder={`${options.pinPrefix}-001-000-0000`}
                  />
                  <button
                    type="button"
                    disabled={buildingPin}
                    onClick={() => void suggestPin()}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-300 bg-slate-50 px-2 text-[11px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                    title="Build PIN from barangay + lot using Settings codes"
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
              <p className="font-bold text-slate-700">Owner</p>
              <input placeholder="Name" value={header.ownerName || ''} onChange={(e) => setField('ownerName', e.target.value)} className={inputCls} />
              <input placeholder="Address" value={header.ownerAddress || ''} onChange={(e) => setField('ownerAddress', e.target.value)} className={inputCls} />
              <input placeholder="Tel. No. / Mobile No." value={header.ownerPhone || ''} onChange={(e) => setField('ownerPhone', e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-2 rounded-lg border border-slate-300 bg-white p-3 text-xs">
              <p className="font-bold text-slate-700">Administrator / Occupant</p>
              <input placeholder="Name" value={header.adminName || ''} onChange={(e) => setField('adminName', e.target.value)} className={inputCls} />
              <input placeholder="Address" value={header.adminAddress || ''} onChange={(e) => setField('adminAddress', e.target.value)} className={inputCls} />
              <input placeholder="Tel. No. / Mobile No." value={header.adminPhone || ''} onChange={(e) => setField('adminPhone', e.target.value)} className={inputCls} />
            </div>
          </section>

          <section className="rounded-lg border border-slate-300 bg-white p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Property location</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">Street</span>
                <input value={header.street || ''} onChange={(e) => setField('street', e.target.value)} className={inputCls} />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">Brgy. / District</span>
                <select
                  value={header.barangay || ''}
                  onChange={(e) => setField('barangay', e.target.value)}
                  className={inputCls}
                >
                  {options.barangays.map((b) => (
                    <option key={`${b.code}-${b.name}`} value={b.name}>
                      {b.code} — {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">Municipality</span>
                <input
                  value={header.municipality || ''}
                  onChange={(e) => setField('municipality', e.target.value)}
                  className={inputCls}
                  readOnly
                  title="From Settings → LGU identity"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">Province</span>
                <input
                  value={header.province || ''}
                  onChange={(e) => setField('province', e.target.value)}
                  className={inputCls}
                  readOnly
                  title="From Settings → LGU identity"
                />
              </label>
            </div>
          </section>

          <section className="rounded-lg border border-slate-300 bg-white p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Property boundaries
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  ['boundNorth', 'North'],
                  ['boundEast', 'East'],
                  ['boundSouth', 'South'],
                  ['boundWest', 'West'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="space-y-1 text-xs">
                  <span className="text-slate-500">{label}</span>
                  <input value={(header[key] as string) || ''} onChange={(e) => setField(key, e.target.value as never)} className={inputCls} />
                </label>
              ))}
            </div>
            <p className="mt-2 text-[10px] italic text-slate-500">
              Plants/Trees situated in the lot of the Republic of the Philippines.
            </p>
          </section>

          <div className="rounded-lg border border-slate-300 bg-white p-3">
            <FaasLandAppraisalTable rows={landRows} onChange={setLandRows} />
          </div>
          <div className="rounded-lg border border-slate-300 bg-white p-3">
            <FaasPlantsTreesTable rows={plantRows} onChange={setPlantRows} />
          </div>

          <FaasValueAdjustmentPanel
            value={adj}
            onChange={(v) => setHeader((h) => ({ ...h, ...v }))}
          />

          <div className="rounded-lg border border-slate-300 bg-white p-3">
            <FaasApprovalPanel
              value={{
                appraisedBy: header.appraisedBy || '',
                appraisedDate: (header.appraisedDate as string) || '',
                recommendingApproval: header.recommendingApproval || DEFAULT_RECOMMENDING,
                recommendingDate: (header.recommendingDate as string) || '',
                approvedBy: header.approvedBy || DEFAULT_APPROVED_BY,
                approvedDate: (header.approvedDate as string) || '',
                memoranda: header.memoranda || '',
                prevAssessedValue: header.prevAssessedValue != null ? String(header.prevAssessedValue) : '',
                prevOwner: header.prevOwner || '',
                effectivityDate: (header.effectivityDate as string) || '',
                recordedBy: header.recordedBy || '',
                backTaxAssessedValue:
                  header.backTaxAssessedValue != null ? String(header.backTaxAssessedValue) : '',
                backTaxYearFrom: header.backTaxYearFrom != null ? String(header.backTaxYearFrom) : '',
                backTaxYearTo: header.backTaxYearTo != null ? String(header.backTaxYearTo) : '',
                status: header.status || 'draft',
              }}
              onChange={(v) =>
                setHeader((h) => ({
                  ...h,
                  ...v,
                  prevAssessedValue: v.prevAssessedValue ? Number(v.prevAssessedValue) : null,
                  backTaxAssessedValue: v.backTaxAssessedValue ? Number(v.backTaxAssessedValue) : null,
                  backTaxYearFrom: v.backTaxYearFrom ? Number(v.backTaxYearFrom) : null,
                  backTaxYearTo: v.backTaxYearTo ? Number(v.backTaxYearTo) : null,
                }))
              }
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
            {record ? 'Update Form 1-A' : 'Save Form 1-A'}
          </button>
        </footer>
      </div>
    </div>
  );
}
