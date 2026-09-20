type Approval = {
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

type Props = {
  value: Approval;
  onChange: (v: Approval) => void;
  readOnly?: boolean;
};

export function FaasApprovalPanel({ value, onChange, readOnly }: Props) {
  function set<K extends keyof Approval>(key: K, val: Approval[K]) {
    onChange({ ...value, [key]: val });
  }

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Approval &amp; History</h4>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Field label="Appraised / Assessed by" value={value.appraisedBy} onChange={(v) => set('appraisedBy', v)} readOnly={readOnly} />
        <Field label="Date" type="date" value={value.appraisedDate} onChange={(v) => set('appraisedDate', v)} readOnly={readOnly} />
        <Field label="Recommending approval" value={value.recommendingApproval} onChange={(v) => set('recommendingApproval', v)} readOnly={readOnly} />
        <Field label="Date" type="date" value={value.recommendingDate} onChange={(v) => set('recommendingDate', v)} readOnly={readOnly} />
        <Field label="Approved by" value={value.approvedBy} onChange={(v) => set('approvedBy', v)} readOnly={readOnly} />
        <Field label="Date" type="date" value={value.approvedDate} onChange={(v) => set('approvedDate', v)} readOnly={readOnly} />
      </div>
      <label className="block space-y-1 text-xs">
        <span className="text-slate-500">Memoranda</span>
        <textarea
          disabled={readOnly}
          rows={3}
          value={value.memoranda}
          onChange={(e) => set('memoranda', e.target.value)}
          className="w-full rounded border border-slate-200 px-2 py-1.5"
        />
      </label>

      <div className="rounded-lg border border-slate-200 p-2">
        <p className="mb-2 text-[10px] font-bold uppercase text-slate-500">Record of superseded assessment</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Field label="Previous assessed value" value={value.prevAssessedValue} onChange={(v) => set('prevAssessedValue', v)} readOnly={readOnly} />
          <Field label="Previous owner" value={value.prevOwner} onChange={(v) => set('prevOwner', v)} readOnly={readOnly} />
          <Field label="Effectivity" type="date" value={value.effectivityDate} onChange={(v) => set('effectivityDate', v)} readOnly={readOnly} />
          <Field label="Recording person" value={value.recordedBy} onChange={(v) => set('recordedBy', v)} readOnly={readOnly} />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-2">
        <p className="mb-2 text-[10px] font-bold uppercase text-slate-500">Back taxes</p>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <Field label="Assessed value" value={value.backTaxAssessedValue} onChange={(v) => set('backTaxAssessedValue', v)} readOnly={readOnly} />
          <Field label="Year from" value={value.backTaxYearFrom} onChange={(v) => set('backTaxYearFrom', v)} readOnly={readOnly} />
          <Field label="Year to" value={value.backTaxYearTo} onChange={(v) => set('backTaxYearTo', v)} readOnly={readOnly} />
        </div>
      </div>

      <label className="block space-y-1 text-xs">
        <span className="text-slate-500">Sheet status</span>
        <select
          disabled={readOnly}
          value={value.status}
          onChange={(e) => set('status', e.target.value)}
          className="w-full rounded border border-slate-200 px-2 py-1.5"
        >
          <option value="draft">Draft</option>
          <option value="appraised">Appraised</option>
          <option value="recommended">Recommended</option>
          <option value="approved">Approved</option>
          <option value="superseded">Superseded</option>
        </select>
      </label>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  readOnly,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
  type?: string;
}) {
  return (
    <label className="space-y-1">
      <span className="text-slate-500">{label}</span>
      <input
        type={type}
        disabled={readOnly}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-slate-200 px-2 py-1.5"
      />
    </label>
  );
}
