/** Assessor indexing — Municipality of Jose P. Rizal, Palawan */

export const PROVINCE_CODE = '066';
export const PROVINCE_NAME = 'Palawan';
export const MUNICIPAL_CODE = '14';
export const MUNICIPAL_NAME = 'Jose P. Rizal';

/** Kind codes (Ownership / Assessment Roll) */
export const PROPERTY_KINDS = [
  { code: '1001', label: 'Building', short: 'Bldg.', key: 'building' },
  { code: '2001', label: 'Machinery', short: 'Machinery', key: 'machinery' },
  { code: '3001', label: 'Special', short: 'Special', key: 'special' },
  { code: '4001', label: 'Plants and Trees', short: 'Plants/Trees', key: 'plants' },
  { code: '0001', label: 'Land', short: 'Land', key: 'land' },
];

/** Type ng lupa — land physical classification */
export const LAND_TYPE_CLASSES = [
  'Flat',
  'Slope',
  'Rolling',
  'Hilly',
  'Mountainous',
  'Coastal',
  'Swampy',
  'Other',
];

/** Actual use / classification (assessment) */
export const ACTUAL_USE_CLASSES = [
  "RES'L",
  'AGRI',
  'COMML',
  'INDL',
  'SPECIAL',
  'EXEMPT',
];

/**
 * Barangay index: 1 = Poblacion (Punta Baja), others alphabetical A–Z.
 * Codes are zero-padded to 3 digits for PIN segments.
 */
const POBLACION = 'Punta Baja (Poblacion)';

const ALPHA_BARANGAYS = [
  'Bunog',
  'Campong Ulay',
  'Candawaga',
  'Canipaan',
  'Culasian',
  'Iraan',
  'Latud',
  'Panalingaan',
  'Ransang',
  'Taburi',
].sort((a, b) => a.localeCompare(b));

export const BARANGAY_INDEX = [
  { index: 1, code: '001', name: POBLACION, isPoblacion: true },
  ...ALPHA_BARANGAYS.map((name, i) => ({
    index: i + 2,
    code: String(i + 2).padStart(3, '0'),
    name,
    isPoblacion: false,
  })),
];

export function barangayByName(name) {
  if (!name) return null;
  const n = String(name).trim().toLowerCase();
  return (
    BARANGAY_INDEX.find(
      (b) =>
        b.name.toLowerCase() === n ||
        b.name.toLowerCase().includes(n) ||
        n.includes(b.name.toLowerCase().replace(/\s*\(poblacion\)\s*/i, '').trim()),
    ) || null
  );
}

export function barangayCode(name) {
  return barangayByName(name)?.code ?? '000';
}

/**
 * Build assessor PIN:
 *   066-14-{brgy}-{section}-{assessorLot}[-(kind)]
 * Example: 066-14-001-015-1084 or 066-14-001-015-(002)-1001
 * Optional ctx overrides province/municipal codes and barangayCode lookup (from DB settings).
 */
export function buildPin(
  {
    barangay,
    sectionNo = '',
    assessorLotNo = '',
    kindCode = '',
    includeProvinceMunicipal = true,
  } = {},
  ctx = {},
) {
  const codeFn = typeof ctx.barangayCode === 'function' ? ctx.barangayCode : barangayCode;
  const provinceCode = ctx.provinceCode || PROVINCE_CODE;
  const municipalCode = ctx.municipalCode || MUNICIPAL_CODE;
  const brgy = codeFn(barangay);
  const section = String(sectionNo || '000').replace(/\D/g, '').padStart(3, '0').slice(-3) || '000';
  const lot = String(assessorLotNo || '').trim() || '0000';
  const core = kindCode
    ? `${brgy}-${section}-(${String(lot).padStart(3, '0')})-${kindCode}`
    : `${brgy}-${section}-${lot}`;
  return includeProvinceMunicipal ? `${provinceCode}-${municipalCode}-${core}` : core;
}

export function kindByCode(code) {
  return PROPERTY_KINDS.find((k) => k.code === String(code)) || null;
}

export function listBarangaysSortedByIndex() {
  return [...BARANGAY_INDEX].sort((a, b) => a.index - b.index);
}
