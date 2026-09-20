import type { FaasPlantRow } from '@/lib/cadastralApi';

type Props = {
  rows: FaasPlantRow[];
  onChange: (rows: FaasPlantRow[]) => void;
  readOnly?: boolean;
};

function recalc(row: FaasPlantRow): FaasPlantRow {
  const total = row.totalCount || row.fruitBearing + row.nonFruitBearing;
  return {
    ...row,
    totalCount: total,
    baseMarketValue: Math.round(total * row.unitPrice * 100) / 100,
  };
}

export function FaasPlantsTreesTable({ rows, onChange, readOnly }: Props) {
  function update(i: number, patch: Partial<FaasPlantRow>) {
    onChange(rows.map((r, idx) => (idx === i ? recalc({ ...r, ...patch }) : r)));
  }

  function addRow() {
    onChange([
      ...rows,
      { kind: '', totalCount: 0, fruitBearing: 0, nonFruitBearing: 0, unitPrice: 0, baseMarketValue: 0 },
    ]);
  }

  const total = rows.reduce((s, r) => s + (r.baseMarketValue || 0), 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Plants &amp; Trees Appraisal</h4>
        {!readOnly && (
          <button type="button" onClick={addRow} className="text-xs font-semibold text-blue-700 hover:underline">
            + Add row
          </button>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[640px] text-xs">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-2 py-1.5">Kind</th>
              <th className="px-2 py-1.5">Fruit bearing</th>
              <th className="px-2 py-1.5">Non-fruit</th>
              <th className="px-2 py-1.5">Total</th>
              <th className="px-2 py-1.5">Unit price</th>
              <th className="px-2 py-1.5">Base MV</th>
              {!readOnly && <th className="px-2 py-1.5" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="px-1 py-1">
                  <input
                    disabled={readOnly}
                    value={r.kind}
                    onChange={(e) => update(i, { kind: e.target.value })}
                    className="w-full rounded border border-slate-200 px-1.5 py-1"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    disabled={readOnly}
                    value={r.fruitBearing}
                    onChange={(e) => update(i, { fruitBearing: Number(e.target.value) })}
                    className="w-full rounded border border-slate-200 px-1.5 py-1"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    disabled={readOnly}
                    value={r.nonFruitBearing}
                    onChange={(e) => update(i, { nonFruitBearing: Number(e.target.value) })}
                    className="w-full rounded border border-slate-200 px-1.5 py-1"
                  />
                </td>
                <td className="px-2 py-1 font-mono">{r.totalCount}</td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    disabled={readOnly}
                    value={r.unitPrice}
                    onChange={(e) => update(i, { unitPrice: Number(e.target.value) })}
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
                <td colSpan={7} className="px-3 py-4 text-center text-slate-400">
                  No plants/trees rows
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold">
            <tr>
              <td colSpan={5} className="px-2 py-1.5 text-right">
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
