import { useEffect, useState } from 'react';
import { FileStack, Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { cadastralApi, type SurveyPlan } from '@/lib/cadastralApi';

type Props = {
  open: boolean;
  canEdit: boolean;
  selectedParcelId?: number | null;
  onClose: () => void;
  onSelectLot?: (parcelId: number) => void;
};

const emptyForm = {
  planTitle: '',
  cadastreNo: '',
  surveyNo: '',
  projectNo: '',
  sheetNo: '1',
  totalSheets: 1,
  scale: '1:4000',
  barangay: '',
  municipality: 'Jose P. Rizal',
  province: 'Palawan',
  surveyor: '',
  surveyingOffice: '',
  notes: '',
};

export function SurveyPlanPanel({ open, canEdit, selectedParcelId, onClose, onSelectLot }: Props) {
  const [plans, setPlans] = useState<SurveyPlan[]>([]);
  const [active, setActive] = useState<SurveyPlan | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    cadastralApi
      .listSurveyPlans()
      .then((r) => setPlans(r.plans))
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  async function openPlan(id: number) {
    try {
      const plan = await cadastralApi.getSurveyPlan(id);
      setActive(plan);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load plan');
    }
  }

  async function createPlan() {
    if (!canEdit) return;
    setCreating(true);
    try {
      const plan = await cadastralApi.createSurveyPlan(form);
      setPlans((p) => [plan, ...p]);
      setActive(plan);
      setForm(emptyForm);
      toast.success('Survey plan created');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  }

  async function savePlan() {
    if (!canEdit || !active) return;
    try {
      const updated = await cadastralApi.updateSurveyPlan(active.id, {
        planTitle: active.planTitle,
        cadastreNo: active.cadastreNo,
        surveyNo: active.surveyNo,
        projectNo: active.projectNo,
        sheetNo: active.sheetNo,
        totalSheets: active.totalSheets,
        scale: active.scale,
        barangay: active.barangay,
        municipality: active.municipality,
        province: active.province,
        surveyor: active.surveyor,
        surveyingOffice: active.surveyingOffice,
        notes: active.notes,
        approvalStatus: active.approvalStatus,
      });
      setActive(updated);
      setPlans((list) => list.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
      toast.success('Plan of Land saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    }
  }

  async function attachSelected() {
    if (!canEdit || !active || !selectedParcelId) {
      toast.error('Select a parcel on the map first');
      return;
    }
    try {
      const updated = await cadastralApi.attachParcelToPlan(active.id, selectedParcelId);
      setActive(updated);
      toast.success('Parcel attached to survey plan');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Attach failed');
    }
  }

  return (
    <div className="absolute inset-0 z-[1750] flex justify-end bg-black/40">
      <aside className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <FileStack className="h-5 w-5 text-slate-700" />
            <div>
              <h2 className="text-base font-bold">Plan of Land</h2>
              <p className="text-xs text-slate-500">Survey plans, sheets &amp; lot linkage</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
            </div>
          ) : active ? (
            <div className="space-y-3 text-xs">
              <button type="button" onClick={() => setActive(null)} className="text-blue-700 hover:underline">
                ← Back to plans
              </button>
              {(
                [
                  ['planTitle', 'Plan title'],
                  ['cadastreNo', 'Cadastre no.'],
                  ['surveyNo', 'Survey no.'],
                  ['projectNo', 'Project no.'],
                  ['sheetNo', 'Sheet no.'],
                  ['scale', 'Scale'],
                  ['barangay', 'Barangay'],
                  ['municipality', 'Municipality'],
                  ['province', 'Province'],
                  ['surveyor', 'Surveyor'],
                  ['surveyingOffice', 'Surveying office'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block space-y-1">
                  <span className="text-slate-500">{label}</span>
                  <input
                    disabled={!canEdit}
                    value={String(active[key] ?? '')}
                    onChange={(e) => setActive({ ...active, [key]: e.target.value })}
                    className="w-full rounded border border-slate-200 px-2 py-1.5"
                  />
                </label>
              ))}
              <label className="block space-y-1">
                <span className="text-slate-500">Notes / monument description</span>
                <textarea
                  disabled={!canEdit}
                  rows={3}
                  value={active.notes}
                  onChange={(e) => setActive({ ...active, notes: e.target.value })}
                  className="w-full rounded border border-slate-200 px-2 py-1.5"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-slate-500">Approval status</span>
                <select
                  disabled={!canEdit}
                  value={active.approvalStatus}
                  onChange={(e) => setActive({ ...active, approvalStatus: e.target.value })}
                  className="w-full rounded border border-slate-200 px-2 py-1.5"
                >
                  <option value="draft">Draft</option>
                  <option value="submitted">Submitted</option>
                  <option value="verified">Verified</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>

              <div className="rounded-lg border border-slate-200 p-2">
                <p className="mb-2 font-semibold text-slate-700">Lots on this plan ({active.lots?.length ?? active.lotCount})</p>
                <ul className="max-h-40 space-y-1 overflow-y-auto">
                  {(active.lots || []).map((lot) => (
                    <li key={lot.id}>
                      <button
                        type="button"
                        onClick={() => onSelectLot?.(lot.id)}
                        className="w-full rounded bg-slate-50 px-2 py-1.5 text-left hover:bg-blue-50"
                      >
                        Lot {lot.lotNumber}
                        {lot.pin ? ` · PIN ${lot.pin}` : ''} — {lot.ownerName || '—'}
                      </button>
                    </li>
                  ))}
                  {!active.lots?.length && <li className="text-slate-400">No lots attached yet</li>}
                </ul>
              </div>

              <div className="flex flex-wrap gap-2">
                {canEdit && (
                  <>
                    <button type="button" onClick={() => void savePlan()} className="rounded-lg bg-[#1e3a8a] px-3 py-2 font-semibold text-white">
                      Save plan
                    </button>
                    <button type="button" onClick={() => void attachSelected()} className="rounded-lg border px-3 py-2 font-semibold">
                      Attach selected parcel
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {canEdit && (
                <div className="space-y-2 rounded-xl border border-dashed border-slate-300 p-3 text-xs">
                  <p className="font-semibold text-slate-700">New Plan of Land</p>
                  <input
                    placeholder="Plan title"
                    value={form.planTitle}
                    onChange={(e) => setForm({ ...form, planTitle: e.target.value })}
                    className="w-full rounded border px-2 py-1.5"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="Cadastre no." value={form.cadastreNo} onChange={(e) => setForm({ ...form, cadastreNo: e.target.value })} className="rounded border px-2 py-1.5" />
                    <input placeholder="Survey no." value={form.surveyNo} onChange={(e) => setForm({ ...form, surveyNo: e.target.value })} className="rounded border px-2 py-1.5" />
                    <input placeholder="Barangay" value={form.barangay} onChange={(e) => setForm({ ...form, barangay: e.target.value })} className="rounded border px-2 py-1.5" />
                    <input placeholder="Scale" value={form.scale} onChange={(e) => setForm({ ...form, scale: e.target.value })} className="rounded border px-2 py-1.5" />
                  </div>
                  <button
                    type="button"
                    disabled={creating}
                    onClick={() => void createPlan()}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#1e3a8a] px-3 py-2 font-semibold text-white"
                  >
                    {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Create plan
                  </button>
                </div>
              )}

              <ul className="space-y-2">
                {plans.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => void openPlan(p.id)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-left hover:border-blue-300 hover:bg-blue-50/40"
                    >
                      <p className="text-sm font-semibold text-slate-900">{p.planTitle || p.surveyNo || `Plan #${p.id}`}</p>
                      <p className="text-xs text-slate-500">
                        {p.cadastreNo || '—'} · {p.barangay || '—'} · {p.lotCount} lots · {p.approvalStatus}
                      </p>
                    </button>
                  </li>
                ))}
                {!plans.length && <li className="py-8 text-center text-sm text-slate-400">No survey plans yet</li>}
              </ul>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
