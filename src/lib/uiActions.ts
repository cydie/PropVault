import { toast } from 'sonner';

/** Show a consistent “under development” toast for unfinished features. */
export function comingSoon(feature: string) {
  toast.info(`${feature} is under development`, {
    description: 'This feature will be available in a future release.',
  });
}

/** Native confirmation dialog for critical actions. */
export function confirmAction(message: string, title = 'Confirm action'): Promise<boolean> {
  return Promise.resolve(window.confirm(`${title}\n\n${message}`));
}

/** Export rows as a CSV download. */
export function exportCsv(filename: string, headers: string[], rows: string[][]) {
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('Export downloaded');
}

/** Open a printable window; returns false if pop-up was blocked. */
export function openPrintDocument(title: string, bodyHtml: string): boolean {
  const w = window.open('', '_blank');
  if (!w) {
    toast.error('Pop-up blocked', { description: 'Allow pop-ups to print or export this document.' });
    return false;
  }
  w.document.write(`
    <html><head><title>${title}</title>
    <style>
      body{font-family:system-ui,sans-serif;padding:24px;color:#0f172a;}
      h1{color:#1e3a8a;font-size:20px;margin-bottom:8px;}
      table{width:100%;border-collapse:collapse;margin-top:16px;}
      th,td{border:1px solid #e2e8f0;padding:8px;text-align:left;font-size:12px;}
      th{background:#f1f5f9;}
    </style></head><body>${bodyHtml}</body></html>
  `);
  w.document.close();
  w.focus();
  w.print();
  return true;
}
