import { useState } from 'react';
import { Loader2, MapPin, Ruler, User, FileText, History, X, ClipboardList, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { cadastralApi, type GisParcelDetail } from '@/lib/cadastralApi';
import { useData } from '@/context/DataContext';
import { resolveAssessorOptions } from '@/lib/assessorOptions';

interface Props {
  detail: GisParcelDetail | null;
  loading: boolean;
  canEdit?: boolean;
  onClose: () => void;
  onPrintReport: () => void;
  onOpenFaas?: () => void;
  onRefresh?: () => void;
}

export function ParcelDetailPanel({
  detail,
  loading,
  canEdit,
  onClose,
  onPrintReport,
  onOpenFaas,
  onRefresh,
}: Props) {
  const { settings } = useData();
  const options = resolveAssessorOptions(settings);
  const [syncing, setSyncing] = useState(false);

  if (!detail && !loading) return null;

  async function syncOwnership() {
    if (!detail?.parcel.id) return;
    setSyncing(true);
    try {
      const res = await cadastralApi.syncOwnershipRecord(detail.parcel.id);
      toast.success(`Ownership synced · PIN ${res.pin}`);
      onRefresh?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  const kind = options.propertyKinds.find((k) => k.code === detail?.parcel.kindCode);

  return (
    <aside className="absolute bottom-0 right-0 top-0 z-[1500] flex w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-2xl sm:w-96">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h2 className="text-base font-bold text-gray-900">Parcel Information</h2>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100">
          <X className="h-5 w-5" />
        </button>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : detail ? (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="rounded-xl bg-slate-900/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assessor Lot No.</p>
            <p className="text-2xl font-bold text-slate-900">
              {detail.parcel.assessorLotNo || detail.parcel.lotNumber}
            </p>
            <p className="mt-1 break-all font-mono text-xs text-slate-600">PIN: {detail.parcel.pin || '—'}</p>
            <p className="mt-1 text-sm text-gray-600">
              TD: {detail.parcel.taxDeclarationNo || '—'} · ARP: {detail.parcel.arpNo || '—'}
            </p>
            {(detail.parcel.sectionNo || detail.parcel.barangayIndex) && (
              <p className="mt-1 text-xs text-slate-500">
                Brgy index {detail.parcel.barangayIndex || '—'} · Section {detail.parcel.sectionNo || '—'}
              </p>
            )}
          </div>

          <Section icon={User} title="Owner / Kind">
            <Row label="Name" value={detail.parcel.ownerName || '—'} />
            <Row label="Kind" value={kind ? `${kind.code}-${kind.label}` : detail.parcel.kindCode || '0001-Land'} />
            <Row label="Type ng lupa" value={detail.parcel.landTypeClass || detail.parcel.classCode || '—'} />
            <Row label="OCT No." value={detail.parcel.octNo || '—'} />
            <Row label="Survey Lot No." value={detail.parcel.surveyLotNo || detail.parcel.surveyNo || '—'} />
          </Section>

          <Section icon={MapPin} title="Location & bounds">
            <Row label="Street" value={detail.parcel.street || '—'} />
            <Row label="Barangay" value={detail.parcel.barangay || '—'} />
            <Row label="Municipality" value={detail.parcel.municipality || '—'} />
            <Row label="Province" value={detail.parcel.province || '—'} />
            <Row label="North" value={detail.parcel.boundNorth || '—'} />
            <Row label="East" value={detail.parcel.boundEast || '—'} />
            <Row label="South" value={detail.parcel.boundSouth || '—'} />
            <Row label="West" value={detail.parcel.boundWest || '—'} />
          </Section>

          <Section icon={Ruler} title="Measurements">
            <Row
              label="Area"
              value={
                detail.parcel.areaSqM != null
                  ? `${detail.parcel.areaSqM.toLocaleString(undefined, { maximumFractionDigits: 2 })} sq m`
                  : '—'
              }
            />
            <Row label="Vertices" value={String(detail.vertices.length)} />
            <Row label="Status" value={detail.parcel.status} />
          </Section>

          {detail.vertices.length > 0 && (
            <Section icon={MapPin} title="Corners (bearing / distance)">
              <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-100">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-left text-gray-500">
                    <tr>
                      <th className="px-2 py-1">Pt</th>
                      <th className="px-2 py-1">Bearing</th>
                      <th className="px-2 py-1">Dist (m)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.vertices.map((v) => (
                      <tr key={v.sequence_no} className="border-t border-gray-50">
                        <td className="px-2 py-1 font-medium">{v.label || v.sequence_no}</td>
                        <td className="px-2 py-1 font-mono">{v.bearing || '—'}</td>
                        <td className="px-2 py-1 font-mono">
                          {v.distance_m != null ? v.distance_m.toFixed(2) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {detail.adjacentLots.length > 0 && (
            <Section icon={MapPin} title="Adjacent lots">
              <ul className="space-y-1 text-sm text-gray-700">
                {detail.adjacentLots.map((a) => (
                  <li key={a.id} className="rounded-lg bg-gray-50 px-2 py-1.5">
                    Lot {a.lot_number} — {a.owner_name || 'Unknown'}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {detail.surveyHistory.length > 0 && (
            <Section icon={History} title="Survey history">
              <ul className="space-y-2 text-sm">
                {detail.surveyHistory.map((s, i) => (
                  <li key={i} className="rounded-lg border border-gray-100 p-2">
                    <p className="font-medium">{String(s.survey_no || 'Survey')}</p>
                    <p className="text-xs text-gray-500">
                      {String(s.surveyor || '')} · {s.survey_date ? String(s.survey_date) : '—'}
                    </p>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <div className="mt-4 space-y-2">
            {onOpenFaas && (
              <button
                type="button"
                onClick={onOpenFaas}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1e3a8a] px-4 py-3 text-sm font-bold text-white hover:bg-[#1e40af]"
              >
                <ClipboardList className="h-4 w-4" /> Open FAAS Form 1-A
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                disabled={syncing}
                onClick={() => void syncOwnership()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
              >
                {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                Sync Ownership Record + PIN
              </button>
            )}
            <button
              type="button"
              onClick={onPrintReport}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-amber-50 px-4 py-3 text-sm font-bold text-slate-900 hover:bg-amber-100"
            >
              <FileText className="h-4 w-4" /> Generate printable report
            </button>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof User;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}
