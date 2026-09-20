/**
 * Resolve Assessor office reference data from Settings / assessor meta,
 * with hardcoded assessorIndex as fallback.
 */
import type { SettingsData, SettingsLgu, SettingsPropertyKind } from '@/lib/api';
import {
  ACTUAL_USE_CLASSES,
  BARANGAY_INDEX,
  LAND_TYPE_CLASSES,
  MUNICIPAL_CODE,
  MUNICIPAL_NAME,
  PROPERTY_KINDS,
  PROVINCE_CODE,
  PROVINCE_NAME,
} from '@/lib/assessorIndex';

export type AssessorMetaPayload = {
  province: { code: string; name: string };
  municipality: { code: string; name: string };
  barangays: { index: number; code: string; name: string; isPoblacion?: boolean }[];
  propertyKinds: { code: string; label: string; short?: string }[];
  landTypeClasses?: string[];
  actualUseClasses?: string[];
};

export type AssessorBarangayOption = {
  code: string;
  name: string;
  index?: number;
};

const KIND_ORDER = ['1001', '2001', '3001', '4001', '0001'];

function sortKinds(kinds: SettingsPropertyKind[]) {
  return [...kinds].sort((a, b) => {
    const ia = KIND_ORDER.indexOf(a.code);
    const ib = KIND_ORDER.indexOf(b.code);
    const ra = ia === -1 ? KIND_ORDER.length : ia;
    const rb = ib === -1 ? KIND_ORDER.length : ib;
    if (ra !== rb) return ra - rb;
    return a.code.localeCompare(b.code);
  });
}

export function resolveAssessorOptions(
  settings?: SettingsData | null,
  meta?: AssessorMetaPayload | null,
) {
  const lgu: SettingsLgu = {
    provinceCode: settings?.lgu?.provinceCode || meta?.province?.code || PROVINCE_CODE,
    provinceName: settings?.lgu?.provinceName || meta?.province?.name || PROVINCE_NAME,
    municipalCode: settings?.lgu?.municipalCode || meta?.municipality?.code || MUNICIPAL_CODE,
    municipalName: settings?.lgu?.municipalName || meta?.municipality?.name || MUNICIPAL_NAME,
  };

  let barangays: AssessorBarangayOption[] = [];
  if (settings?.barangays?.length) {
    barangays = [...settings.barangays]
      .map((b, i) => ({
        code: String(b.code || '').padStart(3, '0').slice(-3) || String(i + 1).padStart(3, '0'),
        name: b.name,
        index: i + 1,
      }))
      .sort(
        (a, b) =>
          a.code.localeCompare(b.code) || a.name.localeCompare(b.name),
      );
  } else if (meta?.barangays?.length) {
    barangays = meta.barangays.map((b) => ({
      code: b.code,
      name: b.name,
      index: b.index,
    }));
  } else {
    barangays = BARANGAY_INDEX.map((b) => ({
      code: b.code,
      name: b.name,
      index: b.index,
    }));
  }

  let propertyKinds: SettingsPropertyKind[] = [];
  if (settings?.propertyKinds?.length) {
    propertyKinds = sortKinds(settings.propertyKinds);
  } else if (meta?.propertyKinds?.length) {
    propertyKinds = sortKinds(
      meta.propertyKinds.map((k) => ({
        code: k.code,
        label: k.label,
        short: k.short,
      })),
    );
  } else {
    propertyKinds = sortKinds(
      PROPERTY_KINDS.map((k) => ({ code: k.code, label: k.label, short: k.short })),
    );
  }

  const landTypeClasses =
    meta?.landTypeClasses?.length ? meta.landTypeClasses : [...LAND_TYPE_CLASSES];
  const actualUseClasses =
    meta?.actualUseClasses?.length ? meta.actualUseClasses : [...ACTUAL_USE_CLASSES];

  return {
    lgu,
    barangays,
    propertyKinds,
    landTypeClasses,
    actualUseClasses,
    pinPrefix: `${lgu.provinceCode}-${lgu.municipalCode}`,
  };
}
