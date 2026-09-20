/** Client-side mirror of assessor indexing (Jose P. Rizal, Palawan) */

export const PROVINCE_CODE = '066';
export const PROVINCE_NAME = 'Palawan';
export const MUNICIPAL_CODE = '14';
export const MUNICIPAL_NAME = 'Jose P. Rizal';

export const PROPERTY_KINDS = [
  { code: '1001', label: 'Building', short: 'Bldg.' },
  { code: '2001', label: 'Machinery', short: 'Machinery' },
  { code: '3001', label: 'Special', short: 'Special' },
  { code: '4001', label: 'Plants and Trees', short: 'Plants/Trees' },
  { code: '0001', label: 'Land', short: 'Land' },
] as const;

export const LAND_TYPE_CLASSES = [
  'Flat',
  'Slope',
  'Rolling',
  'Hilly',
  'Mountainous',
  'Coastal',
  'Swampy',
  'Other',
] as const;

export const ACTUAL_USE_CLASSES = ["RES'L", 'AGRI', 'COMML', 'INDL', 'SPECIAL', 'EXEMPT'] as const;

const POBLACION = 'Punta Baja (Poblacion)';
const ALPHA = [
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
  ...ALPHA.map((name, i) => ({
    index: i + 2,
    code: String(i + 2).padStart(3, '0'),
    name,
    isPoblacion: false,
  })),
];

export function barangayCode(name?: string | null) {
  if (!name) return '000';
  const n = name.trim().toLowerCase();
  const hit = BARANGAY_INDEX.find(
    (b) =>
      b.name.toLowerCase() === n ||
      b.name.toLowerCase().includes(n) ||
      n.includes(b.name.toLowerCase().replace(/\s*\(poblacion\)\s*/i, '').trim()),
  );
  return hit?.code ?? '000';
}

export function formatMoney(n: number) {
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
