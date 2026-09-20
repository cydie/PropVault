import { getToken } from './api';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

function headers(): Record<string, string> {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/cadastral${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface GisParcelProperties {
  id: number;
  parcelId: string;
  lotNumber: string;
  titleNumber: string;
  ownerName: string;
  areaSqM: number | null;
  barangay: string;
  municipality: string;
  province: string;
  status: string;
  taxDeclarationNo: string;
  surveyPlanId?: number | null;
  sectionNo?: string;
  blkNo?: string;
  octNo?: string;
  arpNo?: string;
  pin?: string;
  surveyNo?: string;
  assessorLotNo?: string;
  surveyLotNo?: string;
  landTypeClass?: string;
  classCode?: string;
  kindCode?: string;
  barangayIndex?: string;
  remarks?: string;
  boundNorth?: string;
  boundEast?: string;
  boundSouth?: string;
  boundWest?: string;
  street?: string;
}

export interface GisParcelDetail {
  parcel: GisParcelProperties & { geojson: GeoJSON.Polygon | null };
  vertices: {
    sequence_no: number;
    latitude: number;
    longitude: number;
    bearing: string | null;
    distance_m: number | null;
    label: string;
  }[];
  surveyHistory: Record<string, unknown>[];
  adjacentLots: { id: number; lot_number: string; owner_name: string; parcel_id: string }[];
  annotations: Record<string, unknown>[];
}

export interface GisMapLayer {
  id: number;
  name: string;
  layer_type: string;
  visible: boolean;
  z_index: number;
  style: Record<string, unknown>;
}

export interface SurveyPlan {
  id: number;
  planTitle: string;
  cadastreNo: string;
  surveyNo: string;
  projectNo: string;
  sheetNo: string;
  totalSheets: number;
  scale: string;
  barangay: string;
  municipality: string;
  province: string;
  island: string;
  totalAreaSqM: number | null;
  surveyDateStart: string | null;
  surveyDateEnd: string | null;
  surveyor: string;
  surveyingOffice: string;
  coordinateSystem: string;
  notes: string;
  approvalStatus: string;
  lotCount: number;
  lots?: {
    id: number;
    parcelId: string;
    lotNumber: string;
    pin: string;
    sectionNo: string;
    blkNo: string;
    ownerName: string;
    areaSqM: number | null;
    barangay: string;
  }[];
}

export interface FaasLandRow {
  id?: number;
  sequenceNo?: number;
  classification: string;
  subClass: string;
  actualUse: string;
  area: number;
  unitValue: number;
  baseMarketValue: number;
  landTypeClass?: string;
  classCode?: string;
}

export interface FaasPlantRow {
  id?: number;
  sequenceNo?: number;
  kind: string;
  totalCount: number;
  fruitBearing: number;
  nonFruitBearing: number;
  unitPrice: number;
  baseMarketValue: number;
}

export interface FaasSheet {
  id: number;
  parcelId: number | null;
  tdNo: string;
  pin: string;
  arpNo: string;
  octNo: string;
  surveyNo: string;
  lotNo: string;
  blkNo: string;
  entryDate: string | null;
  ownerName: string;
  ownerAddress: string;
  ownerPhone: string;
  adminName: string;
  adminAddress: string;
  adminPhone: string;
  street: string;
  barangay: string;
  municipality: string;
  province: string;
  boundNorth: string;
  boundEast: string;
  boundSouth: string;
  boundWest: string;
  baseMarketValue: number;
  adjRoadFrontagePct: number;
  adjDistanceRoadKm: number;
  adjDistanceRoadPct: number;
  adjDistanceMarketKm: number;
  adjDistanceMarketPct: number;
  totalAdjustmentsPct: number;
  adjustedMarketValue: number;
  assessmentLevelPct: number;
  assessedValue: number;
  taxStatus: string;
  actualUse: string;
  appraisedBy: string;
  appraisedDate: string | null;
  recommendingApproval: string;
  recommendingDate: string | null;
  approvedBy: string;
  approvedDate: string | null;
  memoranda: string;
  prevAssessedValue: number | null;
  prevOwner: string;
  effectivityDate: string | null;
  recordedBy: string;
  backTaxAssessedValue: number | null;
  backTaxYearFrom: number | null;
  backTaxYearTo: number | null;
  status: string;
}

export interface FaasDetail {
  sheet: FaasSheet | null;
  landRows: FaasLandRow[];
  plantRows: FaasPlantRow[];
  history: Record<string, unknown>[];
}

export const cadastralApi = {
  layers: () => request<{ layers: GisMapLayer[] }>('/layers'),
  updateLayer: (id: number, body: Partial<{ visible: boolean; z_index: number; style: Record<string, unknown> }>) =>
    request<GisMapLayer>(`/layers/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  parcels: () => request<GeoJSON.FeatureCollection<GeoJSON.Polygon, GisParcelProperties>>('/parcels'),
  parcel: (id: number) => request<GisParcelDetail>(`/parcels/${id}`),
  search: (q: string) => request<{ results: GisParcelProperties[] }>(`/parcels/search?q=${encodeURIComponent(q)}`),
  searchIndex: (q: string) =>
    request<{
      results: {
        id: number;
        parcelId: string;
        lotNumber: string;
        pin: string;
        sectionNo: string;
        lat: number | null;
        lng: number | null;
      }[];
    }>(`/search-index?q=${encodeURIComponent(q)}`),

  createParcel: (body: Record<string, unknown>) =>
    request<GisParcelProperties>('/parcels', { method: 'POST', body: JSON.stringify(body) }),

  updateParcel: (id: number, body: Record<string, unknown>) =>
    request<GisParcelProperties>(`/parcels/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  deleteParcel: (id: number) => request<void>(`/parcels/${id}`, { method: 'DELETE' }),

  fromBearings: (body: Record<string, unknown>) =>
    request<GisParcelProperties>('/parcels/from-bearings', { method: 'POST', body: JSON.stringify(body) }),

  mergeParcels: (parcelIds: number[], lotNumber: string, ownerName?: string) =>
    request<GisParcelProperties>('/parcels/merge', {
      method: 'POST',
      body: JSON.stringify({ parcelIds, lotNumber, ownerName }),
    }),

  splitParcel: (id: number, newParcels: { lotNumber: string; ownerName?: string; geometry: GeoJSON.Polygon }[]) =>
    request<{ parcels: GisParcelProperties[] }>(`/parcels/${id}/split`, {
      method: 'POST',
      body: JSON.stringify({ newParcels }),
    }),

  importGeoJson: (data: GeoJSON.FeatureCollection) =>
    request<{ imported: number }>('/import/geojson', { method: 'POST', body: JSON.stringify(data) }),

  importFile: async (endpoint: 'csv' | 'kml' | 'dxf', file: File) => {
    const token = getToken();
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE}/cadastral/import/${endpoint}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) throw new Error(`Import failed: ${res.status}`);
    return res.json() as Promise<{ imported: number }>;
  },

  contours: () => request<GeoJSON.FeatureCollection>('/contours'),
  boundaries: (type?: string) =>
    request<GeoJSON.FeatureCollection>(`/boundaries${type ? `?type=${encodeURIComponent(type)}` : ''}`),
  mapFeatures: (type?: string) =>
    request<GeoJSON.FeatureCollection>(`/map-features${type ? `?type=${encodeURIComponent(type)}` : ''}`),

  inspect: (lat: number, lng: number) =>
    request<{ parcels: GisParcelProperties[] }>(`/inspect?lat=${lat}&lng=${lng}`),

  parcelReport: (id: number) => request<Record<string, unknown>>(`/reports/parcel/${id}`),

  createSurvey: async (form: FormData) => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/cadastral/survey-records`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) throw new Error('Survey upload failed');
    return res.json();
  },

  georefSurvey: (id: number, controlPoints: { imageX: number; imageY: number; lng: number; lat: number }[]) =>
    request<Record<string, unknown>>(`/survey-records/${id}/georef`, {
      method: 'PUT',
      body: JSON.stringify({ controlPoints }),
    }),

  listSurveyPlans: () => request<{ plans: SurveyPlan[] }>('/survey-plans'),
  getSurveyPlan: (id: number) => request<SurveyPlan>(`/survey-plans/${id}`),
  createSurveyPlan: (body: Record<string, unknown>) =>
    request<SurveyPlan>('/survey-plans', { method: 'POST', body: JSON.stringify(body) }),
  updateSurveyPlan: (id: number, body: Record<string, unknown>) =>
    request<SurveyPlan>(`/survey-plans/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  attachParcelToPlan: (planId: number, parcelId: number, extra?: { sectionNo?: string; blkNo?: string }) =>
    request<SurveyPlan>(`/survey-plans/${planId}/attach-parcel`, {
      method: 'POST',
      body: JSON.stringify({ parcelId, ...extra }),
    }),

  faasByParcel: (parcelId: number) => request<FaasDetail>(`/faas/by-parcel/${parcelId}`),
  getFaas: (id: number) => request<FaasDetail>(`/faas/${id}`),
  createFaas: (body: Record<string, unknown>) =>
    request<FaasDetail>('/faas', { method: 'POST', body: JSON.stringify(body) }),
  updateFaas: (id: number, body: Record<string, unknown>) =>
    request<FaasDetail>(`/faas/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  computeFaas: (body: Record<string, unknown>) =>
    request<{
      base_market_value: number;
      total_adjustments_pct: number;
      adjusted_market_value: number;
      assessment_level_pct: number;
      assessed_value: number;
      landRows: FaasLandRow[];
      plantRows: FaasPlantRow[];
    }>('/faas/compute', { method: 'POST', body: JSON.stringify(body) }),

  assessorMeta: () =>
    request<{
      province: { code: string; name: string };
      municipality: { code: string; name: string };
      barangays: { index: number; code: string; name: string; isPoblacion: boolean }[];
      propertyKinds: { code: string; label: string; short: string }[];
      landTypeClasses: string[];
      actualUseClasses: string[];
    }>('/assessor/meta'),

  taxMapControlRoll: (barangay?: string) =>
    request<{
      header: Record<string, string>;
      barangayOrder: string[];
      groups: Record<string, TaxMapRollRow[]>;
      totalRows: number;
    }>(`/assessor/tax-map-control-roll${barangay ? `?barangay=${encodeURIComponent(barangay)}` : ''}`),

  assessmentRoll: (barangay?: string, taxStatus = 'taxable') => {
    const q = new URLSearchParams();
    if (barangay) q.set('barangay', barangay);
    if (taxStatus) q.set('taxStatus', taxStatus);
    const qs = q.toString();
    return request<{
      header: Record<string, string>;
      rows: AssessmentRollRow[];
      totalAssessed: number;
    }>(`/assessor/assessment-roll${qs ? `?${qs}` : ''}`);
  },

  ownershipRecords: (barangay?: string) =>
    request<{ records: OwnershipRecord[] }>(
      `/assessor/ownership-records${barangay ? `?barangay=${encodeURIComponent(barangay)}` : ''}`,
    ),

  syncOwnershipRecord: (parcelId: number) =>
    request<{ record: unknown; pin: string }>('/assessor/ownership-records/sync', {
      method: 'POST',
      body: JSON.stringify({ parcelId }),
    }),

  updateAssessorParcel: (id: number, body: Record<string, unknown>) =>
    request<{ parcel: Record<string, unknown> }>(`/assessor/parcels/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  buildPin: (body: Record<string, unknown>) =>
    request<{ pin: string; barangayIndex: string }>('/assessor/build-pin', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

export interface TaxMapRollRow {
  id: number;
  assessorLotNo: string;
  surveyLotNo: string;
  titleNo: string;
  area: string;
  classCode: string;
  landTypeClass: string;
  ownerName: string;
  arpNo: string;
  tdNo: string;
  pin: string;
  barangay: string;
  barangayIndex: string;
  sectionNo: string;
  kindCode: string;
  kindLabel: string;
  building: boolean;
  machinery: boolean;
  plants: boolean;
  special: boolean;
  othersIdentify: string;
  remarks: string;
  assessedValue: number | null;
}

export interface AssessmentRollRow {
  arpNo: string;
  tdNo: string;
  pin: string;
  pinPrefix: string;
  lotBlockNo: string;
  ownerName: string;
  ownerAddress: string;
  kind: string;
  kindCode: string;
  classification: string;
  landTypeClass: string;
  assessedValue: number;
  previousArp: string;
  previousTd: string;
  effectivity: number;
  remarks: string;
  barangay: string;
  barangayIndex: string;
  sectionNo: string;
  taxStatus: string;
  parcelId: number;
}

export interface OwnershipRecord {
  id: number;
  parcelId: number | null;
  pin: string;
  arpNo: string;
  tdNo: string;
  assessorLotNo: string;
  surveyLotNo: string;
  ownerName: string;
  ownerAddress: string;
  barangay: string;
  barangayIndex: string;
  sectionNo: string;
  kindCode: string;
  kindLabel: string;
  classification: string;
  landTypeClass: string;
  assessedValue: number;
  taxStatus: string;
  effectivityYear: number | null;
  previousArp: string;
  previousTd: string;
  remarks: string;
}

export const BASE_TILES = {
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  street: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  terrain: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
} as const;

export const TILE_ATTRIBUTION = {
  satellite: 'Tiles © Esri',
  street: '© OpenStreetMap',
  terrain: '© OpenTopoMap',
} as const;

export const INDEX_LAYER_STYLES: Record<
  string,
  { color: string; weight: number; dashArray?: string; fillColor?: string; fillOpacity: number }
> = {
  municipality: { color: '#000', weight: 3, dashArray: '12 4 2 4', fillOpacity: 0 },
  barangay: { color: '#000', weight: 2, dashArray: '8 4 2 4', fillOpacity: 0 },
  section: { color: '#000', weight: 1, fillColor: '#f8fafc', fillOpacity: 0.05 },
  shoreline: { color: '#1d4ed8', weight: 2, fillOpacity: 0 },
  river: { color: '#2563eb', weight: 2, fillOpacity: 0 },
  creek: { color: '#3b82f6', weight: 1.5, fillOpacity: 0 },
  road: { color: '#78716c', weight: 2, dashArray: '6 4', fillOpacity: 0 },
};
