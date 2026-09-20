import { useState } from 'react';
import { Globe, Layers, MapPin, Save } from 'lucide-react';
import { api, type GisConfig } from '@/lib/api';
import { toast } from 'sonner';

const inputCls =
  'w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10';

type Props = {
  initial: GisConfig;
  onSaved: (gis: GisConfig) => void;
};

export function ItGisPanel({ initial, onSaved }: Props) {
  const [gis, setGis] = useState<GisConfig>(initial);
  const [saving, setSaving] = useState(false);

  const update = (patch: Partial<GisConfig>) => setGis((p) => ({ ...p, ...patch }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await api.updateGisConfig(gis);
      onSaved(saved);
      setGis(saved);
      toast.success('GIS map settings saved — assessors will see updated tiles on next load');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save GIS settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center">
            <Globe size={18} className="text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">GIS Map Configuration</h3>
            <p className="text-xs text-muted-foreground">
              Tile providers, map center, and zoom — used by Staff Assessor GIS Mapping
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-5">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-1">
              <MapPin size={12} /> Default Latitude
            </label>
            <input
              type="number"
              step="0.0001"
              className={inputCls}
              value={gis.defaultCenter.lat}
              onChange={(e) =>
                update({ defaultCenter: { ...gis.defaultCenter, lat: Number(e.target.value) } })
              }
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Default Longitude</label>
            <input
              type="number"
              step="0.0001"
              className={inputCls}
              value={gis.defaultCenter.lng}
              onChange={(e) =>
                update({ defaultCenter: { ...gis.defaultCenter, lng: Number(e.target.value) } })
              }
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Default Zoom</label>
            <input
              type="number"
              className={inputCls}
              value={gis.defaultZoom}
              onChange={(e) => update({ defaultZoom: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Zoom Range</label>
            <div className="flex gap-2">
              <input
                type="number"
                className={inputCls}
                placeholder="Min"
                value={gis.minZoom}
                onChange={(e) => update({ minZoom: Number(e.target.value) })}
              />
              <input
                type="number"
                className={inputCls}
                placeholder="Max"
                value={gis.maxZoom}
                onChange={(e) => update({ maxZoom: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Map API Key (optional)</label>
          <input
            className={inputCls}
            placeholder="Mapbox, Google Maps, or custom tile API key"
            value={gis.apiKey}
            onChange={(e) => update({ apiKey: e.target.value })}
          />
          <p className="text-[11px] text-muted-foreground mt-1">{gis.tileProviderNote}</p>
        </div>
      </div>

      {(['street', 'satellite'] as const).map((layerKey) => {
        const layer = gis[layerKey];
        return (
          <div key={layerKey} className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <Layers size={15} className="text-blue-600" />
                {layerKey === 'street' ? 'Street / Base Map' : 'Satellite Imagery'}
              </h4>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={layer.enabled}
                  onChange={(e) =>
                    update({ [layerKey]: { ...layer, enabled: e.target.checked } } as Partial<GisConfig>)
                  }
                  className="rounded border-border"
                />
                Enabled
              </label>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Layer Label</label>
                <input
                  className={inputCls}
                  value={layer.label}
                  onChange={(e) =>
                    update({ [layerKey]: { ...layer, label: e.target.value } } as Partial<GisConfig>)
                  }
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Tile URL Template</label>
                <input
                  className={inputCls}
                  value={layer.url}
                  onChange={(e) =>
                    update({ [layerKey]: { ...layer, url: e.target.value } } as Partial<GisConfig>)
                  }
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Use {'{z}'}, {'{x}'}, {'{y}'} placeholders. Esri satellite uses {'{z}/{y}/{x}'} order.
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Attribution</label>
                <input
                  className={inputCls}
                  value={layer.attribution}
                  onChange={(e) =>
                    update({ [layerKey]: { ...layer, attribution: e.target.value } } as Partial<GisConfig>)
                  }
                />
              </div>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        <Save size={14} />
        {saving ? 'Saving…' : 'Save GIS Settings'}
      </button>
    </div>
  );
}
