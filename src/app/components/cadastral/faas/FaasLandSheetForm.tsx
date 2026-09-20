import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  cadastralApi,
  type FaasLandRow,
  type FaasPlantRow,
  type FaasSheet,
  type GisParcelProperties,
} from '@/lib/cadastralApi';
import { FaasLandAppraisalTable } from './FaasLandAppraisalTable';
import { FaasPlantsTreesTable } from './FaasPlantsTreesTable';
import { FaasValueAdjustmentPanel } from './FaasValueAdjustmentPanel';
import { FaasApprovalPanel } from './FaasApprovalPanel';

type Props = {
  open: boolean;
  parcel: GisParcelProperties | null;
  canEdit: boolean;
  onClose: () => void;
};

function emptySheet(parcel: GisParcelProperties | null): Partial<FaasSheet> {
  return {
    parcelId: parcel?.id ?? null,
    tdNo: parcel?.taxDeclarationNo ?? '',
    pin: parcel?.pin ?? '',
    arpNo: parcel?.arpNo ?? '',
    octNo: parcel?.octNo ?? '',
    surveyNo: parcel?.surveyNo ?? '',
    lotNo: parcel?.lotNumber ?? '',
    blkNo: parcel?.blkNo ?? '',
    ownerName: parcel?.ownerName ?? '',
    barangay: parcel?.barangay ?? '',
    municipality: parcel?.municipality || 'Jose P. Rizal',
    province: parcel?.province || 'Palawan',
    boundNorth: parcel?.boundNorth ?? '',
    boundEast: parcel?.boundEast ?? '',
    boundSouth: parcel?.boundSouth ?? '',
    boundWest: parcel?.boundWest ?? '',
    street: parcel?.street ?? '',
    adjRoadFrontagePct: 0,
    adjDistanceRoadKm: 0,
    adjDistanceRoadPct: 0,
    adjDistanceMarketKm: 0,
    adjDistanceMarketPct: 0,
    assessmentLevelPct: 20,
    taxStatus: 'taxable',
    actualUse: '',
    status: 'draft',
  };
}

export function FaasLandSheetForm({ open, parcel, canEdit, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sheetId, setSheetId] = useState<number | null>(null);
  const [header, setHeader] = useState<Partial<FaasSheet>>(emptySheet(parcel));
  const [landRows, setLandRows] = useState<FaasLandRow[]>([]);
  const [plantRows, setPlantRows] = useState<FaasPlantRow[]>([]);

  useEffect(() => {
    if (!open || !parcel) return;
    let cancelled = false;
    setLoading(true);
    cadastralApi
      .faasByParcel(parcel.id)
      .then((detail) => {
        if (cancelled) return;
        if (detail.sheet) {
          setSheetId(detail.sheet.id);
          setHeader(detail.sheet);
          setLandRows(detail.landRows);
          setPlantRows(detail.plantRows);
        } else {
          setSheetId(null);
          setHeader(emptySheet(parcel));
          setLandRows([]);
          setPlantRows([]);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSheetId(null);
          setHeader(emptySheet(parcel));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, parcel]);

  const landMv = useMemo(() => landRows.reduce((s, r) => s + (r.baseMarketValue || 0), 0), [landRows]);
  const plantsMv = useMemo(() => plantRows.reduce((s, r) => s + (r.baseMarketValue || 0), 0), [plantRows]);
  const baseMarketValue = Math.round((landMv + plantsMv) * 100) / 100;

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

  // Keep derived totals in sync when appraisal rows change
  useEffect(() => {
    const totalAdj =
      Number(header.adjRoadFrontagePct || 0) +
      Number(header.adjDistanceRoadPct || 0) +
      Number(header.adjDistanceMarketPct || 0);
    const adjusted = Math.round(baseMarketValue * (1 + totalAdj / 100) * 100) / 100;
    const assessed = Math.round(adjusted * ((Number(header.assessmentLevelPct) || 20) / 100) * 100) / 100;
    setHeader((h) => ({
      ...h,
      baseMarketValue,
      totalAdjustmentsPct: Math.round(totalAdj * 100) / 100,
      adjustedMarketValue: adjusted,
      assessedValue: assessed,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only recompute when appraisal totals change
  }, [baseMarketValue, header.adjRoadFrontagePct, header.adjDistanceRoadPct, header.adjDistanceMarketPct, header.assessmentLevelPct]);

  if (!open) return null;

  async function save() {
    if (!canEdit) return;
    setSaving(true);
    try {
      const body = {
        ...header,
        parcelId: parcel?.id,
        landRows,
        plantRows,
        prevAssessedValue: header.prevAssessedValue ? Number(header.prevAssessedValue) : null,
        backTaxAssessedValue: header.backTaxAssessedValue ? Number(header.backTaxAssessedValue) : null,
        backTaxYearFrom: header.backTaxYearFrom ? Number(header.backTaxYearFrom) : null,
        backTaxYearTo: header.backTaxYearTo ? Number(header.backTaxYearTo) : null,
      };
      const saved = sheetId
        ? await cadastralApi.updateFaas(sheetId, body)
        : await cadastralApi.createFaas(body);
      if (saved.sheet) {
        setSheetId(saved.sheet.id);
        setHeader(saved.sheet);
        setLandRows(saved.landRows);
        setPlantRows(saved.plantRows);
      }
      toast.success('FAAS Form 1-A saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save FAAS');
    } finally {
      setSaving(false);
    }
  }

  function setField<K extends keyof FaasSheet>(key: K, value: FaasSheet[K]) {
    setHeader((h) => ({ ...h, [key]: value }));
  }

  return (
    <div className="absolute inset-0 z-[1800] flex justify-end bg-black/40">
      <aside className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Form No. 1-A</p>
            <h2 className="text-base font-bold text-slate-900">Real Property Field Appraisal &amp; Assessment Sheet</h2>
            <p className="text-xs text-slate-500">Land / Plants &amp; Trees</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <section className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              {(
                [
                  ['tdNo', 'TD No.'],
                  ['pin', 'PIN'],
                  ['arpNo', 'ARP No.'],
                  ['octNo', 'OCT No.'],
                  ['surveyNo', 'Survey No.'],
                  ['lotNo', 'Lot No.'],
                  ['blkNo', 'Blk No.'],
                  ['entryDate', 'Date of entry'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="space-y-1">
                  <span className="text-slate-500">{label}</span>
                  <input
                    type={key === 'entryDate' ? 'date' : 'text'}
                    disabled={!canEdit}
                    value={(header[key] as string) || ''}
                    onChange={(e) => setField(key, e.target.value as never)}
                    className="w-full rounded border border-slate-200 px-2 py-1.5"
                  />
                </label>
              ))}
            </section>

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2 rounded-lg border border-slate-200 p-3 text-xs">
                <p className="font-bold text-slate-700">Owner</p>
                <input disabled={!canEdit} placeholder="Name" value={header.ownerName || ''} onChange={(e) => setField('ownerName', e.target.value)} className="w-full rounded border px-2 py-1.5" />
                <input disabled={!canEdit} placeholder="Address" value={header.ownerAddress || ''} onChange={(e) => setField('ownerAddress', e.target.value)} className="w-full rounded border px-2 py-1.5" />
                <input disabled={!canEdit} placeholder="Tel / Mobile" value={header.ownerPhone || ''} onChange={(e) => setField('ownerPhone', e.target.value)} className="w-full rounded border px-2 py-1.5" />
              </div>
              <div className="space-y-2 rounded-lg border border-slate-200 p-3 text-xs">
                <p className="font-bold text-slate-700">Administrator / Occupant</p>
                <input disabled={!canEdit} placeholder="Name" value={header.adminName || ''} onChange={(e) => setField('adminName', e.target.value)} className="w-full rounded border px-2 py-1.5" />
                <input disabled={!canEdit} placeholder="Address" value={header.adminAddress || ''} onChange={(e) => setField('adminAddress', e.target.value)} className="w-full rounded border px-2 py-1.5" />
                <input disabled={!canEdit} placeholder="Tel / Mobile" value={header.adminPhone || ''} onChange={(e) => setField('adminPhone', e.target.value)} className="w-full rounded border px-2 py-1.5" />
              </div>
            </section>

            <section className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <input disabled={!canEdit} placeholder="Street" value={header.street || ''} onChange={(e) => setField('street', e.target.value)} className="rounded border px-2 py-1.5" />
              <input disabled={!canEdit} placeholder="Barangay" value={header.barangay || ''} onChange={(e) => setField('barangay', e.target.value)} className="rounded border px-2 py-1.5" />
              <input disabled={!canEdit} placeholder="Municipality" value={header.municipality || ''} onChange={(e) => setField('municipality', e.target.value)} className="rounded border px-2 py-1.5" />
              <input disabled={!canEdit} placeholder="Province" value={header.province || ''} onChange={(e) => setField('province', e.target.value)} className="rounded border px-2 py-1.5" />
            </section>

            <section className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <input disabled={!canEdit} placeholder="North" value={header.boundNorth || ''} onChange={(e) => setField('boundNorth', e.target.value)} className="rounded border px-2 py-1.5" />
              <input disabled={!canEdit} placeholder="East" value={header.boundEast || ''} onChange={(e) => setField('boundEast', e.target.value)} className="rounded border px-2 py-1.5" />
              <input disabled={!canEdit} placeholder="South" value={header.boundSouth || ''} onChange={(e) => setField('boundSouth', e.target.value)} className="rounded border px-2 py-1.5" />
              <input disabled={!canEdit} placeholder="West" value={header.boundWest || ''} onChange={(e) => setField('boundWest', e.target.value)} className="rounded border px-2 py-1.5" />
            </section>

            <FaasLandAppraisalTable rows={landRows} onChange={setLandRows} readOnly={!canEdit} />
            <FaasPlantsTreesTable rows={plantRows} onChange={setPlantRows} readOnly={!canEdit} />

            <FaasValueAdjustmentPanel
              value={adj}
              readOnly={!canEdit}
              onChange={(v) =>
                setHeader((h) => ({
                  ...h,
                  ...v,
                }))
              }
            />

            <FaasApprovalPanel
              readOnly={!canEdit}
              value={{
                appraisedBy: header.appraisedBy || '',
                appraisedDate: (header.appraisedDate as string) || '',
                recommendingApproval: header.recommendingApproval || '',
                recommendingDate: (header.recommendingDate as string) || '',
                approvedBy: header.approvedBy || '',
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
        )}

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">
            Close
          </button>
          {canEdit && (
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1e3a8a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save FAAS
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
