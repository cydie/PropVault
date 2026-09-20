import type { FaasLandRow } from '@/lib/cadastralApi';
import { LAND_TYPE_CLASSES, ACTUAL_USE_CLASSES } from '@/lib/assessorIndex';

type Props = {
  rows: FaasLandRow[];
  onChange: (rows: FaasLandRow[]) => void;
  readOnly?: boolean;
};

function recalc(row: FaasLandRow): FaasLandRow {
  return { ...row, baseMarketValue: Math.round(row.area * row.unitValue * 100) / 100 };
}

export function FaasLandAppraisalTable({ rows, onChange, readOnly }: Props) {
  function update(i: number, patch: Partial<FaasLandRow>) {
    const next = rows.map((r, idx) => (idx === i ? recalc({ ...r, ...patch }) : r));
    onChange(next);
  }

  function addRow() {
    onChange([
      ...rows,
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
  }

  const total = rows.reduce((s, r) => s + (r.baseMarketValue || 0), 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Land Appraisal</h4>
        {!readOnly && (
          <button type="button" onClick={addRow} className="text-xs font-semibold text-blue-700 hover:underline">
            + Add row
          </button>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[760px] text-xs">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-2 py-1.5">Classification</th>
              <th className="px-2 py-1.5">Type ng lupa</th>
              <th className="px-2 py-1.5">Sub-class</th>
              <th className="px-2 py-1.5">Actual use</th>
              <th className="px-2 py-1.5">Area</th>
              <th className="px-2 py-1.5">Unit value</th>
              <th className="px-2 py-1.5">Base MV</th>
              {!readOnly && <th className="px-2 py-1.5" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="px-1 py-1">
                  <select
                    disabled={readOnly}
                    value={r.classification}
                    onChange={(e) => update(i, { classification: e.target.value, actualUse: e.target.value })}
                    className="w-full rounded border border-slate-200 px-1.5 py-1"
                  >
                    <option value="">—</option>
                    {ACTUAL_USE_CLASSES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-1 py-1">
                  <select
                    disabled={readOnly}
                    value={r.landTypeClass || ''}
                    onChange={(e) => update(i, { landTypeClass: e.target.value, classCode: e.target.value })}
                    className="w-full rounded border border-slate-200 px-1.5 py-1"
                  >
                    <option value="">—</option>
                    {LAND_TYPE_CLASSES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-1 py-1">
                  <input
                    disabled={readOnly}
                    value={r.subClass}
                    onChange={(e) => update(i, { subClass: e.target.value })}
                    className="w-full rounded border border-slate-200 px-1.5 py-1"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    disabled={readOnly}
                    value={r.actualUse}
                    onChange={(e) => update(i, { actualUse: e.target.value })}
                    className="w-full rounded border border-slate-200 px-1.5 py-1"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    disabled={readOnly}
                    value={r.area}
                    onChange={(e) => update(i, { area: Number(e.target.value) })}
                    className="w-full rounded border border-slate-200 px-1.5 py-1"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    disabled={readOnly}
                    value={r.unitValue}
                    onChange={(e) => update(i, { unitValue: Number(e.target.value) })}
                    className="w-full rounded border border-slate-200 px-1.5 py-1"
                  />
                </td>
                <td className="px-2 py-1 font-mono tabular-nums">{r.baseMarketValue.toLocaleString()}</td>
                {!readOnly && (
                  <td className="px-1 py-1">
                    <button
                      type="button"
                      onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
                      className="text-red-600 hover:underline"
                    >
                      ×
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-slate-400">
                  No land appraisal rows — add Flat / Slope / etc.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold">
            <tr>
              <td colSpan={6} className="px-2 py-1.5 text-right">
                Total
              </td>
              <td className="px-2 py-1.5 font-mono">{total.toLocaleString()}</td>
              {!readOnly && <td />}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
