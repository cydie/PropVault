import { Search, X } from 'lucide-react';
import { useState } from 'react';
import { cadastralApi, type GisParcelProperties } from '@/lib/cadastralApi';

interface Props {
  onSelect: (parcelId: number) => void;
}

export function CadastralSearchBar({ onSelect }: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GisParcelProperties[]>([]);
  const [open, setOpen] = useState(false);

  const search = async () => {
    if (!q.trim()) return;
    const { results: r } = await cadastralApi.search(q.trim());
    setResults(r);
    setOpen(true);
  };

  return (
    <div className="relative w-full max-w-md">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void search()}
            placeholder="Search lot, PIN, TD, section, owner…"
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm focus:border-[#1e3a8a] focus:outline-none focus:ring-2 focus:ring-blue-900/20"
          />
        </div>
        <button
          type="button"
          onClick={() => void search()}
          className="rounded-xl bg-[#1e3a8a] px-4 py-2 text-sm font-bold text-white hover:bg-[#1e40af]"
        >
          Search
        </button>
      </div>
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-[2000] mt-2 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
            <span className="text-xs font-semibold text-gray-500">{results.length} result(s)</span>
            <button type="button" onClick={() => setOpen(false)} className="rounded p-1 hover:bg-gray-100">
              <X className="h-4 w-4" />
            </button>
          </div>
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                onSelect(r.id);
                setOpen(false);
              }}
              className="flex w-full flex-col items-start gap-0.5 border-b border-gray-50 px-3 py-2.5 text-left hover:bg-gray-50"
            >
              <span className="text-sm font-semibold text-gray-900">Lot {r.lotNumber}</span>
              <span className="text-xs text-gray-500">
                {r.ownerName || 'No owner'} · {r.barangay || '—'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
