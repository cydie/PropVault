import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, useMapEvents, Marker, Popup, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import '@geoman-io/leaflet-geoman-free';
import { Loader2, Layers, FileStack, ClipboardList, BookOpen } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  cadastralApi,
  BASE_TILES,
  TILE_ATTRIBUTION,
  type GisParcelDetail,
  type GisParcelProperties,
  type GisMapLayer,
} from '@/lib/cadastralApi';
import { CadastralSearchBar } from './CadastralSearchBar';
import { ParcelDetailPanel } from './ParcelDetailPanel';
import { DigitizeToolbar, type CadastralTool } from './DigitizeToolbar';
import { SurveyWorkflowPanel } from './SurveyWorkflowPanel';
import { SurveyPlanPanel } from './SurveyPlanPanel';
import { FaasLandSheetForm } from './faas/FaasLandSheetForm';
import { AssessorRollsPanel } from './AssessorRollsPanel';
import { SectionIndexLayers, DEFAULT_INDEX_TOGGLES, type IndexLayerToggles } from './SectionIndexLayers';

function GeomanController({
  tool,
  canEdit,
  onPolygonCreated,
}: {
  tool: CadastralTool;
  canEdit: boolean;
  onPolygonCreated: (geojson: GeoJSON.Polygon) => void;
}) {
  const map = useMap();
  const drawnRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    if (!canEdit) return;
    map.pm.setGlobalOptions({ snappable: true, snapDistance: 15, allowSelfIntersection: false });

    map.on('pm:create', (e) => {
      const layer = e.layer as L.Polygon;
      drawnRef.current = layer;
      const gj = layer.toGeoJSON();
      if (gj.geometry.type === 'Polygon') {
        onPolygonCreated(gj.geometry);
      }
    });

    return () => {
      map.off('pm:create');
    };
  }, [map, canEdit, onPolygonCreated]);

  useEffect(() => {
    map.pm.disableDraw();
    map.pm.disableGlobalEditMode();
    if (tool === 'draw' && canEdit) {
      map.pm.enableDraw('Polygon', { finishOn: 'dblclick', snapMiddle: true });
    } else if (tool === 'edit' && canEdit) {
      map.pm.enableGlobalEditMode();
    } else if (tool === 'measure') {
      map.pm.enableDraw('Line', { continueDrawing: false });
      map.pm.enableDraw('Polygon', { continueDrawing: false });
    }
  }, [map, tool, canEdit]);

  return null;
}

function MapClickInspector({ onInspect }: { onInspect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onInspect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function CadastralGisView() {
  const { user } = useAuth();
  const role = user?.role;
  const canEdit = role === 'Admin' || role === 'Staff Assessor';

  const [parcels, setParcels] = useState<GeoJSON.FeatureCollection | null>(null);
  const [contours, setContours] = useState<GeoJSON.FeatureCollection | null>(null);
  const [layers, setLayers] = useState<GisMapLayer[]>([]);
  const [baseLayer, setBaseLayer] = useState<'satellite' | 'street' | 'terrain'>('satellite');
  const [showParcels, setShowParcels] = useState(true);
  const [showContours, setShowContours] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [tool, setTool] = useState<CadastralTool>('select');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<GisParcelDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [draftGeometry, setDraftGeometry] = useState<GeoJSON.Polygon | null>(null);
  const [showMetaForm, setShowMetaForm] = useState(false);
  const [showSurvey, setShowSurvey] = useState(false);
  const [showPlanPanel, setShowPlanPanel] = useState(false);
  const [showFaas, setShowFaas] = useState(false);
  const [showAssessorRolls, setShowAssessorRolls] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [indexToggles, setIndexToggles] = useState<IndexLayerToggles>(DEFAULT_INDEX_TOGGLES);
  const [inspectPoint, setInspectPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [meta, setMeta] = useState({
    lotNumber: '',
    ownerName: '',
    titleNumber: '',
    barangay: '',
    municipality: 'Jose P. Rizal',
    province: 'Palawan',
    taxDeclarationNo: '',
    pin: '',
    sectionNo: '',
    blkNo: '',
  });
  const [bearingForm, setBearingForm] = useState({
    open: false,
    startLat: 8.9597,
    startLng: 117.6586,
    legs: '90,50\n180,30\n270,40\n0,30',
    lotNumber: '',
  });

  const center = useMemo(() => ({ lat: 8.9597, lng: 117.6586, zoom: 14 }), []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c, l] = await Promise.all([
        cadastralApi.parcels(),
        cadastralApi.contours(),
        cadastralApi.layers(),
      ]);
      setParcels(p);
      setContours(c);
      setLayers(l.layers);
      const sat = l.layers.find((x) => x.layer_type === 'satellite');
      if (sat && !sat.visible) setBaseLayer('street');
    } catch {
      setParcels({ type: 'FeatureCollection', features: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const loadDetail = async (id: number) => {
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const d = await cadastralApi.parcel(id);
      setDetail(d);
    } finally {
      setDetailLoading(false);
    }
  };

  const onPolygonCreated = useCallback((geometry: GeoJSON.Polygon) => {
    setDraftGeometry(geometry);
    setShowMetaForm(true);
    setTool('select');
  }, []);

  const saveParcel = async () => {
    if (!draftGeometry || !meta.lotNumber) return;
    await cadastralApi.createParcel({ ...meta, geometry: draftGeometry });
    setShowMetaForm(false);
    setDraftGeometry(null);
    setMeta({
      lotNumber: '',
      ownerName: '',
      titleNumber: '',
      barangay: '',
      municipality: 'Jose P. Rizal',
      province: 'Palawan',
      taxDeclarationNo: '',
      pin: '',
      sectionNo: '',
      blkNo: '',
    });
    void loadData();
  };

  const deleteSelected = async () => {
    if (!selectedId || !confirm('Delete this parcel?')) return;
    await cadastralApi.deleteParcel(selectedId);
    setSelectedId(null);
    setDetail(null);
    void loadData();
  };

  const printReport = async () => {
    if (!selectedId) return;
    const report = await cadastralApi.parcelReport(selectedId);
    const w = window.open('', '_blank');
    if (!w) return;
    const p = report.parcel as GisParcelProperties;
    w.document.write(`<!DOCTYPE html><html><head><title>Cadastral Report — Lot ${p.lotNumber}</title>
      <style>body{font-family:system-ui;padding:24px}h1{color:#001f3f}
      .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:16px 0}
      .box{border:1px solid #ccc;padding:12px;border-radius:8px}
      .legend{margin-top:24px;font-size:12px;color:#666}
      @media print{.no-print{display:none}}</style></head><body>
      <h1>Cadastral Survey Report</h1>
      <p>Lot ${p.lotNumber} · ${p.ownerName || '—'}</p>
      <div class="meta">
        <div class="box"><strong>Title</strong><br>${p.titleNumber || '—'}</div>
        <div class="box"><strong>Area</strong><br>${p.areaSqM ?? '—'} sq m</div>
        <div class="box"><strong>Barangay</strong><br>${p.barangay || '—'}</div>
        <div class="box"><strong>Tax dec.</strong><br>${p.taxDeclarationNo || '—'}</div>
      </div>
      <div class="legend">↑ N · Scale approximate · Generated ${new Date().toLocaleString()}</div>
      <button class="no-print" onclick="window.print()">Print / Save PDF</button>
      </body></html>`);
    w.document.close();
  };

  const saveBearings = async () => {
    const legs = bearingForm.legs
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [b, d] = line.split(',').map(Number);
        return { bearingDeg: b, distanceM: d };
      });
    await cadastralApi.fromBearings({
      start: { lat: bearingForm.startLat, lng: bearingForm.startLng },
      legs,
      lotNumber: bearingForm.lotNumber,
    });
    setBearingForm((f) => ({ ...f, open: false }));
    void loadData();
  };

  const handleImport = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'geojson' || ext === 'json') {
      const text = await file.text();
      await cadastralApi.importGeoJson(JSON.parse(text));
    } else if (ext === 'csv') {
      await cadastralApi.importFile('csv', file);
    } else if (ext === 'kml') {
      await cadastralApi.importFile('kml', file);
    } else if (ext === 'dxf') {
      await cadastralApi.importFile('dxf', file);
    } else {
      alert('Supported: GeoJSON, CSV, KML, DXF. For Shapefile, export to GeoJSON via QGIS.');
    }
    void loadData();
  };

  const parcelStyle = (feature?: GeoJSON.Feature) => {
    const id = feature?.properties?.id;
    const selected = id === selectedId;
    return {
      color: selected ? '#dc2626' : '#1e3a8a',
      weight: selected ? 3 : 1.5,
      fillColor: selected ? '#dc2626' : '#1e3a8a',
      fillOpacity: selected ? 0.35 : 0.12,
    };
  };

  const onEachParcel = (feature: GeoJSON.Feature, layer: L.Layer) => {
    layer.on('click', () => {
      const id = feature.properties?.id as number;
      if (id) void loadDetail(id);
    });
    if (showLabels) {
      const lot = feature.properties?.lotNumber;
      const section = feature.properties?.sectionNo;
      const label = section ? `${section}-${lot}` : lot ? `Lot ${lot}` : feature.properties?.pin;
      if (label) {
        layer.bindTooltip(String(label), {
          permanent: true,
          direction: 'center',
          className: 'parcel-label',
        });
      }
    }
  };

  useEffect(() => {
    if (tool === 'import') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.geojson,.json,.csv,.kml,.dxf';
      input.onchange = () => {
        const f = input.files?.[0];
        if (f) void handleImport(f);
        setTool('select');
      };
      input.click();
    } else if (tool === 'survey') {
      setShowSurvey(true);
      setTool('select');
    } else if (tool === 'bearings') {
      setBearingForm((b) => ({ ...b, open: true }));
      setTool('select');
    }
  }, [tool]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-brand-navy" />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div className="absolute left-14 right-4 top-3 z-[1400] flex flex-wrap items-start gap-3">
        <CadastralSearchBar onSelect={(id) => void loadDetail(id)} />
        <button
          type="button"
          onClick={() => setShowLayers((v) => !v)}
          className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium shadow-sm"
        >
          <Layers className="h-4 w-4" /> Layers
        </button>
        <button
          type="button"
          onClick={() => setShowPlanPanel(true)}
          className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium shadow-sm"
        >
          <FileStack className="h-4 w-4" /> Plan of Land
        </button>
        {selectedId && (
          <button
            type="button"
            onClick={() => setShowFaas(true)}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium shadow-sm"
          >
            <ClipboardList className="h-4 w-4" /> FAAS 1-A
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowAssessorRolls(true)}
          className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium shadow-sm"
        >
          <BookOpen className="h-4 w-4" /> Assessor Rolls
        </button>
      </div>

      {showLayers && (
        <div className="absolute left-14 top-16 z-[1400] max-h-[70vh] w-64 overflow-y-auto rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
          <p className="mb-2 text-xs font-bold uppercase text-gray-500">Base map</p>
          {(['satellite', 'street', 'terrain'] as const).map((b) => (
            <label key={b} className="flex items-center gap-2 py-1 text-sm capitalize">
              <input type="radio" checked={baseLayer === b} onChange={() => setBaseLayer(b)} />
              {b}
            </label>
          ))}
          <hr className="my-2" />
          <p className="mb-1 text-xs font-bold uppercase text-gray-500">Parcels</p>
          <label className="flex items-center gap-2 py-1 text-sm">
            <input type="checkbox" checked={showParcels} onChange={(e) => setShowParcels(e.target.checked)} />
            Parcel boundaries
          </label>
          <label className="flex items-center gap-2 py-1 text-sm">
            <input type="checkbox" checked={showContours} onChange={(e) => setShowContours(e.target.checked)} />
            Contour lines
          </label>
          <label className="flex items-center gap-2 py-1 text-sm">
            <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
            Lot / section labels
          </label>
          <hr className="my-2" />
          <p className="mb-1 text-xs font-bold uppercase text-gray-500">Section Index</p>
          {(
            [
              ['municipality', 'Municipal boundary'],
              ['barangay', 'Barangay boundary'],
              ['section', 'Section boundary'],
              ['shoreline', 'Shoreline'],
              ['river', 'River / creek'],
              ['road', 'Roads'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 py-1 text-sm">
              <input
                type="checkbox"
                checked={indexToggles[key]}
                onChange={(e) => setIndexToggles((t) => ({ ...t, [key]: e.target.checked }))}
              />
              {label}
            </label>
          ))}
        </div>
      )}

      <DigitizeToolbar
        active={tool}
        onChange={setTool}
        onSave={() => draftGeometry && setShowMetaForm(true)}
        onDelete={() => void deleteSelected()}
        canEdit={canEdit}
      />

      <MapContainer
        center={[center.lat, center.lng]}
        zoom={center.zoom}
        className="h-full w-full"
        zoomControl={false}
      >
        <ZoomControl position="topright" />
        <TileLayer url={BASE_TILES[baseLayer]} attribution={TILE_ATTRIBUTION[baseLayer]} />
        <GeomanController tool={tool} canEdit={canEdit} onPolygonCreated={onPolygonCreated} />
        <MapClickInspector
          onInspect={(lat, lng) => {
            setInspectPoint({ lat, lng });
            void cadastralApi.inspect(lat, lng).then((r) => {
              if (r.parcels[0]?.id) void loadDetail(r.parcels[0].id);
            });
          }}
        />

        {showParcels && parcels && (
          <GeoJSON key={`parcels-${selectedId}-${showLabels}`} data={parcels} style={parcelStyle} onEachFeature={onEachParcel} />
        )}

        <SectionIndexLayers toggles={indexToggles} />

        {showContours && contours && (
          <GeoJSON
            data={contours}
            style={() => ({ color: '#8B4513', weight: 1, opacity: 0.8 })}
            onEachFeature={(f, layer) => {
              const elev = f.properties?.elevationM;
              if (elev != null) layer.bindTooltip(`${elev} m`, { sticky: true });
            }}
          />
        )}

        {inspectPoint && (
          <Marker position={[inspectPoint.lat, inspectPoint.lng]}>
            <Popup>
              {inspectPoint.lat.toFixed(6)}, {inspectPoint.lng.toFixed(6)}
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {(selectedId || detailLoading) && (
        <ParcelDetailPanel
          detail={detail}
          loading={detailLoading}
          canEdit={canEdit}
          onClose={() => {
            setSelectedId(null);
            setDetail(null);
          }}
          onPrintReport={() => void printReport()}
          onOpenFaas={() => setShowFaas(true)}
          onRefresh={() => selectedId && void loadDetail(selectedId)}
        />
      )}

      {showMetaForm && (
        <div className="absolute inset-0 z-[1700] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold">Parcel metadata</h3>
            <div className="mt-3 space-y-2">
              {(
                [
                  'lotNumber',
                  'pin',
                  'ownerName',
                  'titleNumber',
                  'sectionNo',
                  'blkNo',
                  'barangay',
                  'municipality',
                  'province',
                  'taxDeclarationNo',
                ] as const
              ).map((field) => (
                <input
                  key={field}
                  placeholder={field.replace(/([A-Z])/g, ' $1')}
                  value={meta[field]}
                  onChange={(e) => setMeta({ ...meta, [field]: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => void saveParcel()} className="flex-1 rounded-xl bg-[#1e3a8a] py-2.5 text-sm font-bold text-white">
                Save parcel
              </button>
              <button type="button" onClick={() => setShowMetaForm(false)} className="rounded-xl border px-4 py-2.5 text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {bearingForm.open && (
        <div className="absolute inset-0 z-[1700] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold">Plot from bearings & distances</h3>
            <p className="mt-1 text-xs text-gray-500">One leg per line: bearing_deg,distance_m</p>
            <input
              placeholder="Lot number"
              value={bearingForm.lotNumber}
              onChange={(e) => setBearingForm({ ...bearingForm, lotNumber: e.target.value })}
              className="mt-3 w-full rounded-lg border px-3 py-2 text-sm"
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input
                type="number"
                step="any"
                placeholder="Start lat"
                value={bearingForm.startLat}
                onChange={(e) => setBearingForm({ ...bearingForm, startLat: Number(e.target.value) })}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <input
                type="number"
                step="any"
                placeholder="Start lng"
                value={bearingForm.startLng}
                onChange={(e) => setBearingForm({ ...bearingForm, startLng: Number(e.target.value) })}
                className="rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <textarea
              rows={5}
              value={bearingForm.legs}
              onChange={(e) => setBearingForm({ ...bearingForm, legs: e.target.value })}
              className="mt-2 w-full rounded-lg border px-3 py-2 font-mono text-sm"
            />
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => void saveBearings()} className="flex-1 rounded-xl bg-brand-navy py-2.5 text-sm font-bold text-brand-gold">
                Plot & save
              </button>
              <button type="button" onClick={() => setBearingForm((b) => ({ ...b, open: false }))} className="rounded-xl border px-4 py-2.5 text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <SurveyWorkflowPanel open={showSurvey} onClose={() => setShowSurvey(false)} />
      <SurveyPlanPanel
        open={showPlanPanel}
        canEdit={canEdit}
        selectedParcelId={selectedId}
        onClose={() => setShowPlanPanel(false)}
        onSelectLot={(id) => void loadDetail(id)}
      />
      <FaasLandSheetForm
        open={showFaas}
        canEdit={canEdit}
        parcel={detail?.parcel ?? null}
        onClose={() => setShowFaas(false)}
      />
      <AssessorRollsPanel
        open={showAssessorRolls}
        onClose={() => setShowAssessorRolls(false)}
        onSelectParcel={(id) => {
          setShowAssessorRolls(false);
          void loadDetail(id);
        }}
      />
    </div>
  );
}
