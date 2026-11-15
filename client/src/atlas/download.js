// Dueño: P3 (Vista). Descarga un Blob como archivo.
export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(function release() { URL.revokeObjectURL(url); }, 4000);
}
