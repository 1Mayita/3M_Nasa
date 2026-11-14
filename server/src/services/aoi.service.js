// Validación del área de interés y de las fechas (dueño: P2 - Controlador)

export class BadRequest extends Error {
  constructor(msg) { super(msg); this.status = 400; }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normaliza el body {bbox | polygon, start, end}.
 * @returns {{bbox:number[], polygon:number[][]|null, start:string, end:string, contains:(lon,lat)=>boolean}}
 */
export function parseQuery(body = {}) {
  const { start, end } = body;
  if (!DATE_RE.test(start || '') || !DATE_RE.test(end || '')) throw new BadRequest('start y end deben ser YYYY-MM-DD');
  if (start > end) throw new BadRequest('start debe ser anterior a end');

  let bbox, polygon = null;
  if (Array.isArray(body.polygon)) {
    polygon = body.polygon.map((p) => [Number(p[0]), Number(p[1])]);
    if (polygon.length < 3 || polygon.some((p) => p.some(Number.isNaN))) throw new BadRequest('polygon inválido: lista de [lon, lat]');
    const xs = polygon.map((p) => p[0]), ys = polygon.map((p) => p[1]);
    bbox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  } else if (Array.isArray(body.bbox) && body.bbox.length === 4) {
    bbox = body.bbox.map(Number);
    if (bbox.some(Number.isNaN) || bbox[0] >= bbox[2] || bbox[1] >= bbox[3]) throw new BadRequest('bbox inválido: [minLon, minLat, maxLon, maxLat]');
  } else {
    throw new BadRequest('Falta el área: bbox o polygon');
  }
  if (bbox[1] < -90 || bbox[3] > 90 || bbox[0] < -180 || bbox[2] > 180) throw new BadRequest('coordenadas fuera de rango');

  const contains = polygon ? (lon, lat) => pointInPolygon(lon, lat, polygon) : () => true;
  return { bbox, polygon, start, end, contains };
}

/** Ray casting: ¿el punto (x,y) cae dentro del polígono [[lon,lat],...]? */
export function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
