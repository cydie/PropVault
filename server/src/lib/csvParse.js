/** Minimal CSV parser — supports quoted fields and CRLF. */

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const src = String(text || '').replace(/^\uFEFF/, '');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(field.trim());
      field = '';
      continue;
    }
    if (ch === '\n' || (ch === '\r' && next === '\n')) {
      row.push(field.trim());
      field = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
      if (ch === '\r') i++;
      continue;
    }
    if (ch === '\r') {
      row.push(field.trim());
      field = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
      continue;
    }
    field += ch;
  }
  row.push(field.trim());
  if (row.some((c) => c !== '')) rows.push(row);

  if (!rows.length) return [];
  const headers = rows[0].map((h) => normalizeHeader(h));
  return rows.slice(1).map((cells) => {
    const obj = {};
    headers.forEach((h, idx) => {
      if (!h) return;
      obj[h] = cells[idx] ?? '';
    });
    return obj;
  });
}

function normalizeHeader(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

export function pick(row, ...keys) {
  for (const key of keys) {
    const n = normalizeHeader(key);
    if (row[n] != null && String(row[n]).trim() !== '') return String(row[n]).trim();
  }
  return '';
}
