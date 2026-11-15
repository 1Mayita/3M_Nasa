// =====================================================================
// Dueño: P3 (Vista)
// Punto único de exportación. Carga con import() solo al pulsar el botón:
// el informe, el Excel y jsPDF no entran en el paquete inicial.
// =====================================================================

export async function exportReport(format, kind, input) {
  const model = await import('./report.js');
  const report = kind === 'ficha' ? model.buildFichaReport(input) : model.buildCalendarReport(input);
  if (format === 'pdf') {
    const pdf = await import('./exportPdf.js');
    await pdf.downloadPdf(report);
  } else {
    const sheet = await import('./exportData.js');
    sheet.downloadXlsx(report);
  }
}
