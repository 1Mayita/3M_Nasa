// Generación de CSV (dueño: P2 - Controlador)
export function toCsv(header, rows) {
  const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v);
  return [header.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n') + '\n';
}
