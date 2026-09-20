import React, { useRef, useState } from 'react';
import { Download, FileUp, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, getToken } from '@/lib/api';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

type PropertyType = 'land' | 'building';
type Tab = 'csv' | 'softcopy';

interface SoftCopyBulkUploadProps {
  propertyType: PropertyType;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  /** Optional pre-selected record when uploading from a row */
  propertyId?: string;
  pin?: string;
  tdOrArp?: string;
}

export function SoftCopyBulkUpload({
  propertyType,
  open,
  onClose,
  onDone,
  propertyId,
  pin,
  tdOrArp,
}: SoftCopyBulkUploadProps) {
  const [tab, setTab] = useState<Tab>(propertyId ? 'softcopy' : 'csv');
  const [busy, setBusy] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [softFiles, setSoftFiles] = useState<File[]>([]);
  const [matchPin, setMatchPin] = useState(pin || '');
  const [matchTd, setMatchTd] = useState(tdOrArp || '');
  const [result, setResult] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const softInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const title =
    propertyType === 'land' ? 'Land & Plants/Trees' : 'Buildings & Structures';

  const downloadTemplate = async () => {
    try {
      const path =
        propertyType === 'land'
          ? '/properties/templates/land.csv'
          : '/properties/templates/buildings.csv';
      const res = await fetch(`${API_BASE}${path}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed to download template');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        propertyType === 'land'
          ? 'land-plants-trees-template.csv'
          : 'buildings-structures-template.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Template download failed');
    }
  };

  const importCsv = async () => {
    if (!csvFile) {
      toast.error('Choose a CSV file first');
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const data = await api.importPropertyCsv(propertyType, csvFile);
      const msg = `Imported ${data.created} record(s)${data.skipped ? ` · ${data.skipped} skipped` : ''}`;
      setResult(msg);
      toast.success(msg);
      if (data.errors?.length) {
        toast.message(`${data.errors.length} row(s) need attention`, {
          description: data.errors.slice(0, 3).map((e) => `Row ${e.row}: ${e.error}`).join(' · '),
        });
      }
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'CSV import failed');
    } finally {
      setBusy(false);
    }
  };

  const uploadSoftCopies = async () => {
    if (!softFiles.length) {
      toast.error('Choose PDF or image soft copies first');
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const data = await api.uploadPropertySoftCopies({
        propertyType,
        files: softFiles,
        propertyId,
        pin: matchPin || undefined,
        tdOrArp: matchTd || undefined,
      });
      const msg = `Uploaded ${data.uploaded} soft cop${data.uploaded === 1 ? 'y' : 'ies'} · ${data.matched} matched to records`;
      setResult(msg);
      toast.success(msg);
      if (data.unmatched) {
        toast.message(`${data.unmatched} file(s) saved without a matching PIN/TD`, {
          description: 'Name files with TD or PIN, or enter PIN/TD above before upload.',
        });
      }
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Soft copy upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
          <div>
            <h3 className="font-semibold text-foreground" style={{ fontFamily: "'Roboto Slab', serif" }}>
              Upload Soft Copies / Bulk Import
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{title} · Admin / Assessor</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 pt-3 flex gap-1 border-b border-border">
          {(
            [
              { id: 'csv' as const, label: 'CSV data import' },
              { id: 'softcopy' as const, label: 'Soft copies (PDF/images)' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-xs font-medium rounded-t-md border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4">
          {tab === 'csv' ? (
            <>
              <p className="text-sm text-muted-foreground">
                Download the template, fill your assessment roll data, then upload the CSV to create many records at once.
              </p>
              <button
                type="button"
                onClick={() => void downloadTemplate()}
                className="inline-flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-secondary"
              >
                <Download size={14} /> Download CSV template
              </button>
              <div
                className="border border-dashed border-border rounded-lg p-6 text-center hover:bg-secondary/40 cursor-pointer"
                onClick={() => csvInputRef.current?.click()}
                onKeyDown={(e) => e.key === 'Enter' && csvInputRef.current?.click()}
                role="button"
                tabIndex={0}
              >
                <FileUp className="mx-auto text-muted-foreground mb-2" size={22} />
                <p className="text-sm font-medium text-foreground">
                  {csvFile ? csvFile.name : 'Choose CSV file'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">.csv only · UTF-8</p>
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                />
              </div>
              <button
                type="button"
                disabled={busy || !csvFile}
                onClick={() => void importCsv()}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                Import records
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Upload scanned FAAS / tax declaration soft copies (PDF or images). Files are linked by PIN or TD/ARP —
                name files with the TD/PIN, or enter it below.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-muted-foreground space-y-1">
                  <span>PIN (optional)</span>
                  <input
                    value={matchPin}
                    onChange={(e) => setMatchPin(e.target.value)}
                    placeholder="066-14-001-…"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background"
                  />
                </label>
                <label className="text-xs text-muted-foreground space-y-1">
                  <span>{propertyType === 'land' ? 'TD No.' : 'ARP / TD No.'} (optional)</span>
                  <input
                    value={matchTd}
                    onChange={(e) => setMatchTd(e.target.value)}
                    placeholder="24-14-0001-…"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background"
                  />
                </label>
              </div>
              <div
                className="border border-dashed border-border rounded-lg p-6 text-center hover:bg-secondary/40 cursor-pointer"
                onClick={() => softInputRef.current?.click()}
                onKeyDown={(e) => e.key === 'Enter' && softInputRef.current?.click()}
                role="button"
                tabIndex={0}
              >
                <Upload className="mx-auto text-muted-foreground mb-2" size={22} />
                <p className="text-sm font-medium text-foreground">
                  {softFiles.length
                    ? `${softFiles.length} file(s) selected`
                    : 'Choose soft copies'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG · up to 40 files</p>
                {softFiles.length > 0 && (
                  <ul className="mt-2 text-left text-xs text-muted-foreground max-h-24 overflow-auto space-y-0.5">
                    {softFiles.map((f) => (
                      <li key={f.name + f.size}>{f.name}</li>
                    ))}
                  </ul>
                )}
                <input
                  ref={softInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.tif,.tiff,application/pdf,image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => setSoftFiles(Array.from(e.target.files || []))}
                />
              </div>
              <button
                type="button"
                disabled={busy || !softFiles.length}
                onClick={() => void uploadSoftCopies()}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                Upload soft copies
              </button>
            </>
          )}

          {result && (
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              {result}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
