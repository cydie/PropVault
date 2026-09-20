import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crosshair,
  Layers,
  List,
  MapPin,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useData } from '@/context/DataContext';
import { api, type GisConfig, type LandRecord } from '@/lib/api';
import {
  RIZAL_CENTER,
  classificationColor,
  getPropertyCoords,
  statusColor,
} from '@/lib/gisCoords';
import 'leaflet/dist/leaflet.css';

const CLASS_FILTERS = ['All', 'Residential', 'Agricultural', 'Commercial'] as const;
const PANEL_STORAGE_KEY = 'propvault_gis_parcel_panel_open';
const PANEL_WIDTH_PX = 420;
const PANEL_TRANSITION_MS = 300;

const FALLBACK_GIS: GisConfig = {
  defaultCenter: { lat: RIZAL_CENTER[0], lng: RIZAL_CENTER[1] },
  defaultZoom: 14,
  minZoom: 10,
  maxZoom: 19,
  street: {
    label: 'Map',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    enabled: true,
  },
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com">Esri</a>, Maxar, Earthstar Geographics',
    enabled: true,
  },
  apiKey: '',
  tileProviderNote: '',
};

type BaseLayerKey = 'street' | 'satellite';

function enabledLayers(gis: GisConfig): Record<BaseLayerKey, GisConfig['street']> {
  return {
    street: gis.street,
    satellite: gis.satellite,
  };
}

function tileUrl(layer: GisConfig['street'], apiKey: string) {
  if (!apiKey?.trim()) return layer.url;
  const sep = layer.url.includes('?') ? '&' : '?';
  return `${layer.url}${sep}apikey=${encodeURIComponent(apiKey.trim())}`;
}

function readPanelOpen(): boolean {
  try {
    const saved = localStorage.getItem(PANEL_STORAGE_KEY);
    if (saved === null) return true;
    return saved === 'true';
  } catch {
    return true;
  }
}

function createPinIcon(color: string, selected: boolean) {
  const size = selected ? 40 : 30;
  return L.divIcon({
    className: 'propvault-marker',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" style="filter:drop-shadow(0 3px 4px rgba(15,23,42,.35))">
      <path fill="${color}" stroke="${selected ? '#ffffff' : '#ffffff'}" stroke-width="${selected ? 2 : 1.5}"
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
      <circle fill="#ffffff" cx="12" cy="9" r="${selected ? 3 : 2.5}"/>
    </svg>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

function MapFocus({ position, zoom }: { position: [number, number] | null; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, zoom, { duration: 0.8 });
  }, [position, zoom, map]);
  return null;
}

/** Recompute Leaflet tile layout after panel width changes */
function MapInvalidateSize({ panelOpen }: { panelOpen: boolean }) {
  const map = useMap();
  const invalidate = useCallback(() => {
    map.invalidateSize({ animate: false });
  }, [map]);

  useEffect(() => {
    invalidate();
    const t1 = window.setTimeout(invalidate, PANEL_TRANSITION_MS + 20);
    const t2 = window.setTimeout(invalidate, PANEL_TRANSITION_MS + 120);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [panelOpen, invalidate]);

  useEffect(() => {
    window.addEventListener('resize', invalidate);
    return () => window.removeEventListener('resize', invalidate);
  }, [invalidate]);

  return null;
}

function MapControls({
  baseLayer,
  onToggleLayer,
  mapCenter,
  defaultZoom,
  layerLabels,
}: {
  baseLayer: BaseLayerKey;
  onToggleLayer: () => void;
  mapCenter: [number, number];
  defaultZoom: number;
  layerLabels: Record<BaseLayerKey, string>;
}) {
  const map = useMap();
  const satelliteActive = baseLayer === 'satellite';
  return (
    <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
      {/* Zoom */}
      <div className="flex flex-col rounded-xl overflow-hidden shadow-lg ring-1 ring-black/5 bg-white/95 backdrop-blur">
        <button
          type="button"
          onClick={() => map.zoomIn()}
          className="w-9 h-9 hover:bg-slate-100 text-slate-600 flex items-center justify-center border-b border-slate-200/80 transition-colors"
          aria-label="Zoom in"
        >
          <Plus size={16} />
        </button>
        <button
          type="button"
          onClick={() => map.zoomOut()}
          className="w-9 h-9 hover:bg-slate-100 text-slate-600 flex items-center justify-center transition-colors"
          aria-label="Zoom out"
        >
          <Minus size={16} />
        </button>
      </div>

      {/* Recenter / locate */}
      <button
        type="button"
        onClick={() => map.flyTo(mapCenter, defaultZoom, { duration: 0.6 })}
        className="w-9 h-9 rounded-xl shadow-lg ring-1 ring-black/5 bg-white/95 backdrop-blur hover:bg-slate-100 text-slate-600 flex items-center justify-center transition-colors"
        aria-label="Recenter map"
        title="Recenter map"
      >
        <Crosshair size={16} />
      </button>

      {/* Base layer toggle */}
      <button
        type="button"
        onClick={onToggleLayer}
        className={`w-9 h-9 rounded-xl shadow-lg ring-1 ring-black/5 backdrop-blur flex items-center justify-center transition-colors ${
          satelliteActive
            ? 'bg-primary text-primary-foreground'
            : 'bg-white/95 text-slate-600 hover:bg-slate-100'
        }`}
        aria-label="Toggle base map"
        title={satelliteActive ? `Switch to ${layerLabels.street}` : `Switch to ${layerLabels.satellite}`}
      >
        <Layers size={16} />
      </button>
    </div>
  );
}

function ClassificationBadge({ label }: { label: string }) {
  const color = classificationColor(label);
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
      style={{ backgroundColor: `${color}1a`, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = statusColor(status);
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border"
      style={{ backgroundColor: `${color}12`, color, borderColor: `${color}33` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {status}
    </span>
  );
}

function StatChip({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  accent: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-2.5 py-2">
      <div className="flex items-center gap-1 mb-1">
        <Icon size={12} style={{ color: accent }} className="shrink-0" />
        <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-500 truncate">
          {label}
        </span>
      </div>
      <p
        className="text-lg font-bold text-slate-900 leading-none tabular-nums"
        style={{ fontFamily: "'Roboto Slab', serif" }}
      >
        {value}
      </p>
    </div>
  );
}

function ParcelPanelContent({
  onClose,
  showCloseIcon,
  verifying,
  query,
  setQuery,
  runVerify,
  classFilter,
  setClassFilter,
  stats,
  filtered,
  selected,
  setSelected,
}: {
  onClose: () => void;
  showCloseIcon: boolean;
  verifying?: boolean;
  query: string;
  setQuery: (v: string) => void;
  runVerify: () => void;
  classFilter: (typeof CLASS_FILTERS)[number];
  setClassFilter: (v: (typeof CLASS_FILTERS)[number]) => void;
  stats: { total: number; approved: number; pending: number };
  filtered: LandRecord[];
  selected: LandRecord | null;
  setSelected: (p: LandRecord) => void;
}) {
  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <MapPin size={15} className="text-primary" />
            </span>
            <div>
              <p className="text-sm font-bold text-slate-900 leading-tight">Find Parcels</p>
              <p className="text-[11px] text-slate-500 leading-tight">Search & inspect records</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Collapse parcel panel"
            title="Collapse panel"
          >
            {showCloseIcon ? <X size={17} /> : <ChevronLeft size={17} />}
          </button>
        </div>

        <div className="flex gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0 bg-slate-100 border border-transparent rounded-lg px-3 py-2 focus-within:bg-white focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
            <Search size={15} className="text-slate-400 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runVerify()}
              placeholder="PIN, TD, or owner…"
              className="bg-transparent text-sm text-slate-800 outline-none w-full placeholder:text-slate-400"
            />
          </div>
          <button
            type="button"
            onClick={runVerify}
            disabled={verifying || !query.trim()}
            className="shrink-0 px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {verifying ? 'Verifying…' : 'Verify'}
          </button>
        </div>

        <div className="flex p-1 mt-3 bg-slate-100 rounded-lg gap-1">
          {CLASS_FILTERS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setClassFilter(c)}
              className={`flex-1 min-w-0 px-2 py-1.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all ${
                classFilter === c
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 py-3 grid grid-cols-4 gap-2 bg-white border-b border-slate-200 shrink-0">
        <StatChip label="Total Parcels" value={stats.total} icon={Layers} accent="#1e3a8a" />
        <StatChip label="On Map" value={stats.total} icon={MapPin} accent="#64748b" />
        <StatChip label="Approved" value={stats.approved} icon={CheckCircle2} accent="#22c55e" />
        <StatChip label="Pending" value={stats.pending} icon={Clock} accent="#f59e0b" />
      </div>

      {/* List */}
      <div className="px-4 pt-3 pb-1.5 flex items-center justify-between shrink-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Parcel list</p>
        <span className="text-[10px] font-medium text-slate-400 tabular-nums">
          {filtered.length} result{filtered.length === 1 ? '' : 's'}
        </span>
      </div>
      <ul className="flex-1 overflow-y-auto px-4 pb-4 space-y-3 min-h-0">
        {filtered.map((p) => {
          const isSelected = selected?.id === p.id;
          const pinColor = classificationColor(p.classification);
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setSelected(p)}
                className={`w-full flex items-start gap-3.5 p-3.5 rounded-xl text-left transition-all border ${
                  isSelected
                    ? 'bg-orange-50 border-orange-400 shadow-md ring-1 ring-orange-300/40'
                    : 'bg-white border-slate-200 hover:border-orange-200 hover:bg-orange-50/30 hover:shadow-sm'
                }`}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${pinColor}18` }}
                >
                  <MapPin size={22} style={{ color: pinColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate leading-snug">
                    {p.owner}
                  </p>
                  <p className="text-[11px] font-mono text-slate-500 truncate mt-0.5">{p.pin}</p>
                  <div className="flex flex-wrap items-center gap-1 mt-2">
                    <ClassificationBadge label={p.classification} />
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1 truncate">
                    <MapPin size={10} className="shrink-0" />
                    {p.barangay}
                  </p>
                </div>
                <ChevronRight
                  size={16}
                  className={`shrink-0 mt-1 transition-colors ${
                    isSelected ? 'text-orange-500' : 'text-slate-300'
                  }`}
                />
              </button>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="px-3 py-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
            <Search size={22} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-medium text-slate-600">No parcels found</p>
            <p className="text-xs text-slate-400 mt-1">Try a different search or filter.</p>
          </li>
        )}
      </ul>
    </div>
  );
}

function FloatingOpenButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute left-4 top-1/2 -translate-y-1/2 z-[1000] flex items-center gap-2.5 pl-2.5 pr-4 py-3 bg-white rounded-2xl shadow-xl ring-1 ring-black/5 hover:shadow-2xl hover:-translate-y-1/2 hover:scale-[1.02] transition-all duration-300 group"
      aria-label="Open parcel panel"
      title="Show parcels"
    >
      <span className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center group-hover:scale-105 transition-transform">
        <List size={17} className="text-primary-foreground" />
      </span>
      <span className="text-sm font-semibold text-slate-800 hidden sm:inline">Parcels</span>
    </button>
  );
}

export function GisView() {
  const navigate = useNavigate();
  const { landProps } = useData();
  const [query, setQuery] = useState('');
  const [classFilter, setClassFilter] = useState<(typeof CLASS_FILTERS)[number]>('All');
  const [selected, setSelected] = useState<LandRecord | null>(null);
  const [verifyRef, setVerifyRef] = useState('');
  const [panelOpen, setPanelOpenState] = useState(readPanelOpen);
  const [isMobile, setIsMobile] = useState(false);
  const [baseLayer, setBaseLayer] = useState<BaseLayerKey>('street');
  const [verifying, setVerifying] = useState(false);
  const [gisConfig, setGisConfig] = useState<GisConfig>(FALLBACK_GIS);

  useEffect(() => {
    api.getGisConfig().then(setGisConfig).catch(() => setGisConfig(FALLBACK_GIS));
  }, []);

  const mapCenter = useMemo<[number, number]>(
    () => [gisConfig.defaultCenter.lat, gisConfig.defaultCenter.lng],
    [gisConfig.defaultCenter.lat, gisConfig.defaultCenter.lng]
  );
  const mapLayers = useMemo(() => enabledLayers(gisConfig), [gisConfig]);
  const activeLayer = mapLayers[baseLayer]?.enabled ? mapLayers[baseLayer] : mapLayers.street;

  const setPanelOpen = useCallback((open: boolean) => {
    setPanelOpenState(open);
    try {
      localStorage.setItem(PANEL_STORAGE_KEY, String(open));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const filtered = useMemo(() => {
    return landProps.filter((p) => {
      const matchQuery =
        !query ||
        p.owner.toLowerCase().includes(query.toLowerCase()) ||
        p.pin.toLowerCase().includes(query.toLowerCase()) ||
        p.td.toLowerCase().includes(query.toLowerCase()) ||
        p.barangay.toLowerCase().includes(query.toLowerCase());
      const matchClass = classFilter === 'All' || p.classification === classFilter;
      return matchQuery && matchClass;
    });
  }, [landProps, query, classFilter]);

  const stats = useMemo(() => {
    const approved = filtered.filter((p) => p.status === 'Approved').length;
    const pending = filtered.filter((p) => p.status === 'Pending' || p.status === 'Under Review').length;
    return { total: filtered.length, approved, pending };
  }, [filtered]);

  const selectedPosition = selected ? getPropertyCoords(selected) : null;

  const runVerify = async () => {
    if (!query.trim()) {
      toast.warning('Enter a PIN, TD, or owner name to verify');
      return;
    }
    setVerifying(true);
    try {
      const res = await api.verifyProperty(query.trim());
      setVerifyRef(res.reference);
      toast.success('Verification complete', {
        description: `${res.results?.length ?? 0} matching record(s)`,
      });
    } catch (e) {
      setVerifyRef('');
      toast.error(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const panelProps = {
    query,
    setQuery,
    runVerify,
    verifying,
    classFilter,
    setClassFilter,
    stats,
    filtered,
    selected,
    setSelected,
  };

  const showDesktopPanel = panelOpen && !isMobile;
  const showMobileDrawer = panelOpen && isMobile;

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] min-h-[560px] w-full overflow-hidden bg-slate-100">
      {/* Header */}
      <div className="px-4 md:px-6 py-3.5 border-b border-slate-200 bg-white shrink-0 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Layers size={20} className="text-primary" />
          </span>
          <div className="min-w-0">
            <h2
              className="text-lg font-bold text-slate-900 leading-tight truncate"
              style={{ fontFamily: "'Roboto Slab', serif" }}
            >
              Live Parcel Map
            </h2>
            <p className="text-xs text-slate-500 truncate">Rizal, Palawan · OpenStreetMap</p>
          </div>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold shrink-0">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          Live
        </span>
      </div>

      {verifyRef && (
        <div className="mx-4 md:mx-6 mt-3 flex items-center gap-2 text-xs font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 shrink-0">
          <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
          Verification reference: {verifyRef}
        </div>
      )}

      <div className="flex flex-1 min-h-0 relative">
        {/* Desktop — collapsible inline panel */}
        <div
          className={`hidden md:block shrink-0 h-full overflow-hidden transition-[width] duration-300 ease-in-out ${
            showDesktopPanel ? 'border-r border-slate-200' : 'border-r-0'
          }`}
          style={{ width: showDesktopPanel ? PANEL_WIDTH_PX : 0 }}
          aria-hidden={!showDesktopPanel}
        >
          <div className="h-full" style={{ width: PANEL_WIDTH_PX }}>
            <ParcelPanelContent {...panelProps} onClose={() => setPanelOpen(false)} showCloseIcon={false} />
          </div>
        </div>

        {/* Mobile — drawer overlay (GIS workspace only, not main nav) */}
        {showMobileDrawer && (
          <div className="md:hidden absolute inset-0 z-30 flex">
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300"
              aria-label="Close parcel panel"
              onClick={() => setPanelOpen(false)}
            />
            <aside
              className="relative h-full flex flex-col bg-white shadow-2xl transition-transform duration-300 ease-out"
              style={{ width: 'min(420px, 92vw)' }}
            >
              <ParcelPanelContent {...panelProps} onClose={() => setPanelOpen(false)} showCloseIcon />
            </aside>
          </div>
        )}

        {/* Map — expands when panel collapsed */}
        <div className="flex-1 relative min-w-0 min-h-0 transition-all duration-300 ease-in-out">
          <MapContainer
            center={mapCenter}
            zoom={gisConfig.defaultZoom}
            minZoom={gisConfig.minZoom}
            maxZoom={gisConfig.maxZoom}
            className="h-full w-full"
            zoomControl={false}
            scrollWheelZoom
          >
            <TileLayer
              key={baseLayer}
              attribution={activeLayer.attribution}
              url={tileUrl(activeLayer, gisConfig.apiKey)}
            />
            <MapInvalidateSize panelOpen={panelOpen} />
            <MapFocus position={selectedPosition} zoom={selected ? 17 : gisConfig.defaultZoom} />
            <MapControls
              baseLayer={baseLayer}
              mapCenter={mapCenter}
              defaultZoom={gisConfig.defaultZoom}
              layerLabels={{
                street: mapLayers.street.label,
                satellite: mapLayers.satellite.label,
              }}
              onToggleLayer={() => {
                setBaseLayer((p) => {
                  const next: BaseLayerKey = p === 'street' ? 'satellite' : 'street';
                  if (!mapLayers[next]?.enabled) return p;
                  toast.info(mapLayers[next].label, { description: 'Base map layer updated' });
                  return next;
                });
              }}
            />
            {filtered.map((p) => {
              const pos = getPropertyCoords(p);
              const isSelected = selected?.id === p.id;
              return (
                <Marker
                  key={p.id}
                  position={pos}
                  icon={createPinIcon(classificationColor(p.classification), isSelected)}
                  eventHandlers={{ click: () => setSelected(p) }}
                  zIndexOffset={isSelected ? 1000 : 0}
                />
              );
            })}
          </MapContainer>

          {!panelOpen && <FloatingOpenButton onClick={() => setPanelOpen(true)} />}

          {/* Demo banner */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
            <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur ring-1 ring-black/5 text-amber-800 text-[11px] font-medium px-3 py-1.5 rounded-full shadow-md">
              <ShieldCheck size={13} className="shrink-0 text-amber-500" />
              <span>Demo · simulated parcel locations</span>
            </div>
          </div>

          {/* Selected parcel card */}
          {selected && (
            <div className="absolute top-16 right-4 z-[1000] w-72 bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 overflow-hidden animate-in fade-in slide-in-from-right-2 duration-200">
              <div
                className="px-4 pt-4 pb-3 text-white relative"
                style={{ backgroundColor: classificationColor(selected.classification) }}
              >
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                  aria-label="Close details"
                >
                  <X size={13} />
                </button>
                <p className="font-bold text-base leading-tight pr-7">{selected.owner}</p>
                <p className="font-mono text-xs text-white/85 mt-0.5">{selected.pin}</p>
                <div className="mt-2">
                  <StatusBadgeOnDark status={selected.status} />
                </div>
              </div>
              <div className="p-4 space-y-2.5 text-xs">
                <DetailRow label="TD No." value={selected.td} mono />
                <DetailRow label="Status" value={selected.status} />
                <DetailRow label="Classification" value={selected.classification} />
                <DetailRow label="Location" value={selected.barangay} />
                <DetailRow label="Area" value={selected.area} />
                <DetailRow label="Assessed Value" value={selected.av} strong />
                <button
                  type="button"
                  onClick={() => {
                    navigate('/land');
                    toast.info(`Land record: ${selected.td}`, { description: selected.owner });
                  }}
                  className="mt-1 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 active:scale-[0.99] transition-all"
                >
                  View Full Details
                  <ArrowUpRight size={14} />
                </button>
                <p className="text-[10px] text-slate-400 pt-1 text-center">
                  Demo parcel · OpenStreetMap · Leaflet
                </p>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="absolute bottom-4 left-4 z-[1000] bg-white/95 backdrop-blur rounded-2xl shadow-lg ring-1 ring-black/5 px-4 py-3 text-[11px]">
            <p className="font-bold text-slate-700 text-[10px] uppercase tracking-wider mb-2">
              Classification
            </p>
            {[
              { label: 'Residential', color: '#3b82f6' },
              { label: 'Agricultural', color: '#22c55e' },
              { label: 'Commercial', color: '#f59e0b' },
              { label: 'Special / Exempt', color: '#94a3b8' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-slate-600 py-0.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadgeOnDark({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-semibold">
      <span className="w-1.5 h-1.5 rounded-full bg-white" />
      {status}
    </span>
  );
}

function DetailRow({
  label,
  value,
  mono,
  strong,
}: {
  label: string;
  value: string;
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2 items-center">
      <span className="text-slate-500">{label}</span>
      <span
        className={`text-right ${mono ? 'font-mono' : ''} ${
          strong ? 'font-bold text-slate-900' : 'font-medium text-slate-800'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
