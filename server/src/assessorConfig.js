/**
 * Runtime assessor master data (LGU, barangay PIN codes, property kinds)
 * loaded from DB with hardcoded fallbacks from assessorIndex.js
 */
import { query, getOne, run } from './db.js';
import { getSetting, setSetting } from './systemSettings.js';
import {
  PROVINCE_CODE,
  PROVINCE_NAME,
  MUNICIPAL_CODE,
  MUNICIPAL_NAME,
  PROPERTY_KINDS,
  BARANGAY_INDEX,
  LAND_TYPE_CLASSES,
  ACTUAL_USE_CLASSES,
  barangayByName as defaultBarangayByName,
  barangayCode as defaultBarangayCode,
  buildPin as defaultBuildPin,
  kindByCode as defaultKindByCode,
} from './assessorIndex.js';

export const DEFAULT_LGU = {
  provinceCode: PROVINCE_CODE,
  provinceName: PROVINCE_NAME,
  municipalCode: MUNICIPAL_CODE,
  municipalName: MUNICIPAL_NAME,
};

export const DEFAULT_PROPERTY_KINDS = PROPERTY_KINDS.map((k) => ({
  code: k.code,
  label: k.label,
  short: k.short || k.label,
  key: k.key || undefined,
}));

/** Display / PIN kind order: start at 1001, Land (0001) last */
const KIND_DISPLAY_ORDER = ['1001', '2001', '3001', '4001', '0001'];

function sortKindsForDisplay(kinds) {
  return [...kinds].sort((a, b) => {
    const ia = KIND_DISPLAY_ORDER.indexOf(a.code);
    const ib = KIND_DISPLAY_ORDER.indexOf(b.code);
    const ra = ia === -1 ? KIND_DISPLAY_ORDER.length : ia;
    const rb = ib === -1 ? KIND_DISPLAY_ORDER.length : ib;
    if (ra !== rb) return ra - rb;
    return String(a.code).localeCompare(String(b.code));
  });
}

function normalizeCode(code, width = 3) {
  const digits = String(code ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.padStart(width, '0').slice(-width);
}

function normalizeKindCode(code) {
  const digits = String(code ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.padStart(4, '0').slice(-4);
}

function matchBarangay(name, list) {
  if (!name) return null;
  const n = String(name).trim().toLowerCase();
  return (
    list.find(
      (b) =>
        b.name.toLowerCase() === n ||
        b.name.toLowerCase().includes(n) ||
        n.includes(b.name.toLowerCase().replace(/\s*\(poblacion\)\s*/i, '').trim()),
    ) || null
  );
}

/** Ensure barangays.code column + seed LGU / kinds / barangay codes */
export async function migrateAssessorCodes() {
  await query(`ALTER TABLE barangays ADD COLUMN IF NOT EXISTS code TEXT`);
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS barangays_code_unique
    ON barangays (code)
    WHERE code IS NOT NULL AND code <> ''
  `);

  for (const b of BARANGAY_INDEX) {
    await run(
      `UPDATE barangays SET code = ?
       WHERE name = ? AND (code IS NULL OR code = '')`,
      [b.code, b.name],
    );
    await run(
      `INSERT INTO barangays (name, code) VALUES (?, ?)
       ON CONFLICT (name) DO NOTHING`,
      [b.name, b.code],
    );
  }

  // Fill any remaining unnamed-code rows by matching BARANGAY_INDEX loosely
  const rows = await query(`SELECT id, name, code FROM barangays WHERE code IS NULL OR code = ''`);
  for (const row of rows) {
    const hit = matchBarangay(row.name, BARANGAY_INDEX);
    if (hit?.code) {
      await run('UPDATE barangays SET code = ? WHERE id = ?', [hit.code, row.id]);
    }
  }

  const lguRow = await getOne('SELECT key FROM system_settings WHERE key = ?', ['lgu']);
  if (!lguRow) {
    await setSetting('lgu', DEFAULT_LGU, 'system');
  }

  const kindsRow = await getOne('SELECT key, value FROM system_settings WHERE key = ?', ['property_kinds']);
  if (!kindsRow) {
    await setSetting('property_kinds', sortKindsForDisplay(DEFAULT_PROPERTY_KINDS), 'system');
  } else if (Array.isArray(kindsRow.value) && kindsRow.value.length) {
    const ordered = sortKindsForDisplay(kindsRow.value);
    const same =
      ordered.length === kindsRow.value.length &&
      ordered.every((k, i) => k.code === kindsRow.value[i]?.code);
    if (!same) {
      await setSetting('property_kinds', ordered, 'system');
    }
  }
}

export async function getLguConfig() {
  const raw = (await getSetting('lgu')) || {};
  return {
    provinceCode: String(raw.provinceCode || DEFAULT_LGU.provinceCode).trim() || DEFAULT_LGU.provinceCode,
    provinceName: String(raw.provinceName || DEFAULT_LGU.provinceName).trim() || DEFAULT_LGU.provinceName,
    municipalCode: String(raw.municipalCode || DEFAULT_LGU.municipalCode).trim() || DEFAULT_LGU.municipalCode,
    municipalName: String(raw.municipalName || DEFAULT_LGU.municipalName).trim() || DEFAULT_LGU.municipalName,
  };
}

export async function saveLguConfig(body, updatedBy) {
  const provinceCode = normalizeCode(body.provinceCode, 3);
  const municipalCode = normalizeCode(body.municipalCode, 2);
  const provinceName = String(body.provinceName ?? '').trim();
  const municipalName = String(body.municipalName ?? '').trim();
  if (!provinceCode || provinceCode.length !== 3) {
    throw Object.assign(new Error('Province code must be 3 digits (e.g. 066)'), { status: 400 });
  }
  if (!municipalCode || municipalCode.length !== 2) {
    throw Object.assign(new Error('Municipal code must be 2 digits (e.g. 14)'), { status: 400 });
  }
  if (!provinceName || !municipalName) {
    throw Object.assign(new Error('Province and municipality names are required'), { status: 400 });
  }
  const next = { provinceCode, provinceName, municipalCode, municipalName };
  await setSetting('lgu', next, updatedBy);
  return next;
}

export async function getPropertyKindsConfig() {
  const raw = await getSetting('property_kinds');
  let kinds;
  if (Array.isArray(raw) && raw.length) {
    kinds = raw.map((k) => ({
      code: normalizeKindCode(k.code) || String(k.code || ''),
      label: String(k.label || '').trim() || String(k.code || ''),
      short: String(k.short || k.label || '').trim(),
      key: k.key || undefined,
    }));
  } else {
    kinds = DEFAULT_PROPERTY_KINDS.map((k) => ({ ...k }));
  }
  return sortKindsForDisplay(kinds);
}

export async function savePropertyKindsConfig(kinds, updatedBy) {
  if (!Array.isArray(kinds) || !kinds.length) {
    throw Object.assign(new Error('At least one property kind is required'), { status: 400 });
  }
  const next = kinds.map((k) => {
    const code = normalizeKindCode(k.code);
    const label = String(k.label || '').trim();
    if (!code || !label) {
      throw Object.assign(new Error('Each kind needs a 4-digit code and label'), { status: 400 });
    }
    return {
      code,
      label,
      short: String(k.short || label).trim(),
      key: k.key || undefined,
    };
  });
  const codes = next.map((k) => k.code);
  if (new Set(codes).size !== codes.length) {
    throw Object.assign(new Error('Duplicate kind codes'), { status: 409 });
  }
  await setSetting('property_kinds', next, updatedBy);
  return sortKindsForDisplay(next);
}

export async function listBarangaysWithCodes() {
  const rows = await query(
    `SELECT id, name, code FROM barangays
     ORDER BY
       CASE WHEN code IS NULL OR code = '' THEN 1 ELSE 0 END,
       NULLIF(code, '') NULLS LAST,
       name`,
  );
  if (!rows.length) {
    return BARANGAY_INDEX.map((b, i) => ({
      id: -(i + 1),
      name: b.name,
      code: b.code,
      index: b.index,
      isPoblacion: !!b.isPoblacion,
    }));
  }
  return rows.map((r, i) => {
    const fallback = matchBarangay(r.name, BARANGAY_INDEX);
    const code = r.code || fallback?.code || '';
    return {
      id: r.id,
      name: r.name,
      code,
      index: fallback?.index ?? i + 1,
      isPoblacion: !!fallback?.isPoblacion,
    };
  });
}

/** Full runtime helpers used by assessor API + PIN builders */
export async function getAssessorRuntime() {
  const [lgu, propertyKinds, barangays] = await Promise.all([
    getLguConfig(),
    getPropertyKindsConfig(),
    listBarangaysWithCodes(),
  ]);

  const index = barangays
    .filter((b) => b.code)
    .map((b) => ({
      index: b.index,
      code: b.code,
      name: b.name,
      isPoblacion: b.isPoblacion,
    }));

  const barangayByName = (name) => matchBarangay(name, index) || defaultBarangayByName(name);
  const barangayCode = (name) => barangayByName(name)?.code ?? defaultBarangayCode(name);
  const kindByCode = (code) =>
    propertyKinds.find((k) => k.code === normalizeKindCode(code) || k.code === String(code)) ||
    defaultKindByCode(code);
  const buildPin = (opts = {}) =>
    defaultBuildPin(opts, {
      provinceCode: lgu.provinceCode,
      municipalCode: lgu.municipalCode,
      barangayCode,
    });

  return {
    lgu,
    province: { code: lgu.provinceCode, name: lgu.provinceName },
    municipality: { code: lgu.municipalCode, name: lgu.municipalName },
    barangays: index.length ? index.sort((a, b) => a.index - b.index || a.code.localeCompare(b.code)) : BARANGAY_INDEX,
    barangaysFull: barangays,
    propertyKinds,
    landTypeClasses: LAND_TYPE_CLASSES,
    actualUseClasses: ACTUAL_USE_CLASSES,
    barangayByName,
    barangayCode,
    kindByCode,
    buildPin,
  };
}

export { normalizeCode, normalizeKindCode };
