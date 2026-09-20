import { useState } from 'react';
import { Upload, MapPin, X } from 'lucide-react';
import { cadastralApi } from '@/lib/cadastralApi';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Step = 'upload' | 'georef' | 'digitize' | 'metadata' | 'complete';

const STEPS: { id: Step; label: string }[] = [
  { id: 'upload', label: '1. Upload plan' },
  { id: 'georef', label: '2. Georeference' },
  { id: 'digitize', label: '3. Digitize' },
  { id: 'metadata', label: '4. Metadata' },
  { id: 'complete', label: '5. Save' },
];

export function SurveyWorkflowPanel({ open, onClose }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [surveyId, setSurveyId] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [controlPoints, setControlPoints] = useState<
    { imageX: number; imageY: number; lng: number; lat: number }[]
  >([]);
  const [meta, setMeta] = useState({ surveyNo: '', surveyor: '', lotNumber: '', ownerName: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  if (!open) return null;

  const uploadPlan = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const form = new FormData();
      form.append('plan', file);
      form.append('surveyNo', meta.surveyNo);
      form.append('surveyor', meta.surveyor);
      const rec = (await cadastralApi.createSurvey(form)) as { id: number };
      setSurveyId(rec.id);
      setStep('georef');
      setMessage('Plan uploaded. Add at least 3 ground control points.');
    } catch {
      setMessage('Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const saveGeoref = async () => {
    if (!surveyId || controlPoints.length < 3) {
      setMessage('Need at least 3 control points');
      return;
    }
    setLoading(true);
    try {
      await cadastralApi.georefSurvey(surveyId, controlPoints);
      setStep('digitize');
      setMessage('Georeferencing saved. Trace parcel boundaries on the map.');
    } catch {
      setMessage('Georeference failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[1600] flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-lg font-bold text-gray-900">Survey Plan Workflow</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-gray-50 px-3 py-2">
          {STEPS.map((s) => (
            <span
              key={s.id}
              className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
                step === s.id ? 'bg-brand-navy text-brand-gold' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {s.label}
            </span>
          ))}
        </div>

        <div className="space-y-4 p-5">
          {message && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{message}</p>
          )}

          {step === 'upload' && (
            <>
              <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-gray-200 p-8 hover:border-brand-navy/40">
                <Upload className="h-10 w-10 text-gray-400" />
                <span className="text-sm text-gray-600">
                  {file ? file.name : 'Upload scanned survey plan (PDF, PNG, JPG)'}
                </span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <input
                placeholder="Survey plan number"
                value={meta.surveyNo}
                onChange={(e) => setMeta({ ...meta, surveyNo: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
              <input
                placeholder="Surveyor name"
                value={meta.surveyor}
                onChange={(e) => setMeta({ ...meta, surveyor: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={!file || loading}
                onClick={() => void uploadPlan()}
                className="w-full rounded-xl bg-brand-navy py-3 text-sm font-bold text-brand-gold disabled:opacity-50"
              >
                {loading ? 'Uploading…' : 'Upload & continue'}
              </button>
            </>
          )}

          {step === 'georef' && (
            <>
              <p className="text-sm text-gray-600">
                Enter ground control points mapping image coordinates to WGS84 lat/lng (affine transform).
              </p>
              {[0, 1, 2].map((i) => (
                <div key={i} className="grid grid-cols-4 gap-2">
                  <input
                    placeholder="Img X"
                    type="number"
                    className="rounded border px-2 py-1.5 text-sm"
                    onChange={(e) => {
                      const cp = [...controlPoints];
                      cp[i] = { ...cp[i], imageX: Number(e.target.value), imageY: cp[i]?.imageY ?? 0, lng: cp[i]?.lng ?? 0, lat: cp[i]?.lat ?? 0 };
                      setControlPoints(cp);
                    }}
                  />
                  <input
                    placeholder="Img Y"
                    type="number"
                    className="rounded border px-2 py-1.5 text-sm"
                    onChange={(e) => {
                      const cp = [...controlPoints];
                      cp[i] = { ...cp[i], imageY: Number(e.target.value), imageX: cp[i]?.imageX ?? 0, lng: cp[i]?.lng ?? 0, lat: cp[i]?.lat ?? 0 };
                      setControlPoints(cp);
                    }}
                  />
                  <input
                    placeholder="Lng"
                    type="number"
                    step="any"
                    className="rounded border px-2 py-1.5 text-sm"
                    onChange={(e) => {
                      const cp = [...controlPoints];
                      cp[i] = { ...cp[i], lng: Number(e.target.value), imageX: cp[i]?.imageX ?? 0, imageY: cp[i]?.imageY ?? 0, lat: cp[i]?.lat ?? 0 };
                      setControlPoints(cp);
                    }}
                  />
                  <input
                    placeholder="Lat"
                    type="number"
                    step="any"
                    className="rounded border px-2 py-1.5 text-sm"
                    onChange={(e) => {
                      const cp = [...controlPoints];
                      cp[i] = { ...cp[i], lat: Number(e.target.value), imageX: cp[i]?.imageX ?? 0, imageY: cp[i]?.imageY ?? 0, lng: cp[i]?.lng ?? 0 };
                      setControlPoints(cp);
                    }}
                  />
                </div>
              ))}
              <button
                type="button"
                disabled={loading}
                onClick={() => void saveGeoref()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-navy py-3 text-sm font-bold text-brand-gold"
              >
                <MapPin className="h-4 w-4" /> Apply georeference
              </button>
            </>
          )}

          {(step === 'digitize' || step === 'metadata') && (
            <p className="text-sm text-gray-600">
              Use the <strong>Trace parcel</strong> tool on the map to digitize boundaries over the georeferenced plan, then click <strong>Save</strong> and enter lot metadata.
            </p>
          )}

          {step === 'complete' && (
            <p className="text-center text-sm font-medium text-emerald-700">
              Survey record saved to GIS database.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
