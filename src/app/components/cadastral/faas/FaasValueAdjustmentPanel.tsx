type Adj = {
  adjRoadFrontagePct: number;
  adjDistanceRoadKm: number;
  adjDistanceRoadPct: number;
  adjDistanceMarketKm: number;
  adjDistanceMarketPct: number;
  assessmentLevelPct: number;
  taxStatus: string;
  actualUse: string;
  baseMarketValue: number;
  totalAdjustmentsPct: number;
  adjustedMarketValue: number;
  assessedValue: number;
};

type Props = {
  value: Adj;
  onChange: (v: Adj) => void;
  readOnly?: boolean;
};

export function FaasValueAdjustmentPanel({ value, onChange, readOnly }: Props) {
  function set<K extends keyof Adj>(key: K, val: Adj[K]) {
    const next = { ...value, [key]: val };
    const total =
      Number(next.adjRoadFrontagePct) + Number(next.adjDistanceRoadPct) + Number(next.adjDistanceMarketPct);
    next.totalAdjustmentsPct = Math.round(total * 100) / 100;
    next.adjustedMarketValue =
      Math.round(Number(next.baseMarketValue) * (1 + next.totalAdjustmentsPct / 100) * 100) / 100;
    next.assessedValue =
      Math.round(next.adjustedMarketValue * (Number(next.assessmentLevelPct) / 100) * 100) / 100;
    onChange(next);
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
      <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Value Adjusted Factors</h4>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <label className="space-y-1">
          <span className="text-slate-500">Road frontage %</span>
          <input
            type="number"
            disabled={readOnly}
            value={value.adjRoadFrontagePct}
            onChange={(e) => set('adjRoadFrontagePct', Number(e.target.value))}
            className="w-full rounded border border-slate-200 px-2 py-1.5"
          />
        </label>
        <label className="space-y-1">
          <span className="text-slate-500">Dist. to all-weather road (km)</span>
          <input
            type="number"
            disabled={readOnly}
            value={value.adjDistanceRoadKm}
            onChange={(e) => set('adjDistanceRoadKm', Number(e.target.value))}
            className="w-full rounded border border-slate-200 px-2 py-1.5"
          />
        </label>
        <label className="space-y-1">
          <span className="text-slate-500">Road distance adj %</span>
          <input
            type="number"
            disabled={readOnly}
            value={value.adjDistanceRoadPct}
            onChange={(e) => set('adjDistanceRoadPct', Number(e.target.value))}
            className="w-full rounded border border-slate-200 px-2 py-1.5"
          />
        </label>
        <label className="space-y-1">
          <span className="text-slate-500">Dist. to market / poblacion (km)</span>
          <input
            type="number"
            disabled={readOnly}
            value={value.adjDistanceMarketKm}
            onChange={(e) => set('adjDistanceMarketKm', Number(e.target.value))}
            className="w-full rounded border border-slate-200 px-2 py-1.5"
          />
        </label>
        <label className="space-y-1">
          <span className="text-slate-500">Market distance adj %</span>
          <input
            type="number"
            disabled={readOnly}
            value={value.adjDistanceMarketPct}
            onChange={(e) => set('adjDistanceMarketPct', Number(e.target.value))}
            className="w-full rounded border border-slate-200 px-2 py-1.5"
          />
        </label>
        <label className="space-y-1">
          <span className="text-slate-500">Assessment level %</span>
          <input
            type="number"
            disabled={readOnly}
            value={value.assessmentLevelPct}
            onChange={(e) => set('assessmentLevelPct', Number(e.target.value))}
            className="w-full rounded border border-slate-200 px-2 py-1.5"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <label className="space-y-1">
          <span className="text-slate-500">Actual use</span>
          <input
            disabled={readOnly}
            value={value.actualUse}
            onChange={(e) => set('actualUse', e.target.value)}
            className="w-full rounded border border-slate-200 px-2 py-1.5"
          />
        </label>
        <label className="space-y-1">
          <span className="text-slate-500">Tax status</span>
          <select
            disabled={readOnly}
            value={value.taxStatus}
            onChange={(e) => set('taxStatus', e.target.value)}
            className="w-full rounded border border-slate-200 px-2 py-1.5"
          >
            <option value="taxable">Taxable</option>
            <option value="exempt">Exempt</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-lg bg-white p-2 text-xs ring-1 ring-slate-200">
        <div>
          <p className="text-slate-500">Base market value</p>
          <p className="font-mono font-semibold">{value.baseMarketValue.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-slate-500">Total adjustments %</p>
          <p className="font-mono font-semibold">{value.totalAdjustmentsPct}</p>
        </div>
        <div>
          <p className="text-slate-500">Adjusted market value</p>
          <p className="font-mono font-semibold">{value.adjustedMarketValue.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-slate-500">Assessed value</p>
          <p className="font-mono text-sm font-bold text-blue-900">{value.assessedValue.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
