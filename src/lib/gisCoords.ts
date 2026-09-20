import type { LandRecord } from '@/lib/api';

/** Rizal, Palawan municipal center — demo anchor for Leaflet */
export const RIZAL_CENTER: [number, number] = [8.9597, 117.6586];

const BARANGAY_COORDS: Record<string, [number, number]> = {
  Bunog: [8.972, 117.648],
  'Campong Ulay': [8.965, 117.642],
  Candawaga: [8.958, 117.655],
  Canipaan: [8.951, 117.662],
  Culasian: [8.944, 117.668],
  Iraan: [8.968, 117.672],
  Latud: [8.976, 117.658],
  Panalingaan: [8.962, 117.678],
  'Punta Baja (Poblacion)': [8.9597, 117.6586],
  Ransang: [8.948, 117.652],
  Taburi: [8.955, 117.645],
};

function hashOffset(seed: string): [number, number] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const lat = ((h % 100) - 50) * 0.00008;
  const lng = (((h >> 8) % 100) - 50) * 0.00008;
  return [lat, lng];
}

/** Assign stable demo coordinates per property (no GIS data in DB yet). */
export function getPropertyCoords(property: LandRecord): [number, number] {
  const base = BARANGAY_COORDS[property.barangay] ?? RIZAL_CENTER;
  const [dLat, dLng] = hashOffset(property.id + property.pin);
  return [base[0] + dLat, base[1] + dLng];
}

export function classificationColor(classification: string): string {
  switch (classification) {
    case 'Residential':
      return '#3b82f6';
    case 'Agricultural':
      return '#22c55e';
    case 'Commercial':
      return '#f59e0b';
    case 'Industrial':
      return '#8b5cf6';
    case 'Special':
    case 'Exempt':
      return '#94a3b8';
    default:
      return '#64748b';
  }
}

export function statusColor(status: string): string {
  switch (status) {
    case 'Approved':
      return '#22c55e';
    case 'Pending':
      return '#f59e0b';
    case 'Under Review':
      return '#3b82f6';
    case 'Rejected':
      return '#ef4444';
    case 'Exempt':
      return '#94a3b8';
    default:
      return '#64748b';
  }
}
