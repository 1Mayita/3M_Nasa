"""Reemplaza los rectángulos de data/zones/cochabamba_zones.geojson por límites municipales reales
(dueño: P1 - Modelo).

Regla para cada zona: unión de sus municipios  ∩  rectángulo original que dibujó el equipo.
  - La unión de municipios da bordes reales (no se sale del departamento ni de los municipios listados).
  - El recorte con el rectángulo mantiene la intención de la zona: por ejemplo, "ladera sur del Tunari"
    no incluye todo Tiquipaya hasta los Yungas, y el trópico no se mezcla con TIPNIS/Carrasco.
TIPNIS/Carrasco son áreas protegidas, no municipios: se usa rectángulo ∩ departamento.

Restricción del servidor: el calendario acepta un solo anillo [[lon, lat], ...] (aoi.service.js),
así que cada zona sale como Polygon simple, sin huecos. Si el recorte deja piezas sueltas, se queda
la más grande y se informa cuánto se perdió.

Fuente de límites: data/reference/municipios_cochabamba.geojson (Lab TecnoSocial 2024, CC BY 4.0).

Uso (desde model/):
    python build_zones.py
"""
import json
import os

from shapely.geometry import box, mapping, shape
from shapely.ops import unary_union

import config as C

ZONES_FILE = os.path.join(C.DATA, "zones", "cochabamba_zones.geojson")
MUNICIPALITIES_FILE = os.path.join(C.DATA, "reference", "municipios_cochabamba.geojson")

SIMPLIFY_TOLERANCE_DEG = 0.002   # ~200 m: mantiene la forma y deja pocos vértices
COORDINATE_DECIMALS = 4          # ~10 m

# id de zona -> (municipios tal como aparecen en el geojson, rectángulo original [minLon, minLat, maxLon, maxLat])
# None en municipios = todos los municipios; None en rectángulo = sin recorte.
ZONE_RULES = {
    "depto": (None, None),
    "tunari-sur": (["Cochabamba", "Sacaba", "Quillacollo", "Tiquipaya", "Vinto", "Sipesipe", "Colcapirhua"],
                   [-66.42, -17.4, -66.0, -17.22]),
    "cercado-gamc": (["Cochabamba"], [-66.280703, -17.53119, -66.06952, -17.257306]),
    "tropico": (["Villa Tunari", "Shinahota", "Chimoré", "Puerto Villarroel", "Entre Ríos"],
                [-65.95, -17.25, -64.4, -16.55]),
    "tipnis-carrasco": (None, [-66.3, -16.6, -65.2, -15.9]),
    "noroeste": (["Cocapata", "Morochata", "Ayopaya"], [-67.2, -17.45, -66.35, -16.45]),
    "cabeceras": (["Tiraque", "Colomi", "Sacaba"], [-66.0, -17.55, -65.5, -17.2]),
    "sudeste": (["Pocona", "Totora", "Vacas", "Pojo"], [-65.75, -17.95, -64.7, -17.45]),
    "capinota": (["Capinota", "Santiváñez", "Sicaya"], [-66.45, -17.85, -66.05, -17.55]),
}


def load_municipalities():
    with open(MUNICIPALITIES_FILE, "r", encoding="utf-8") as municipalities_file:
        collection = json.load(municipalities_file)
    return {feature["properties"]["nombre"]: shape(feature["geometry"]) for feature in collection["features"]}


def to_single_polygon(geometry):
    """Devuelve (Polygon sin huecos, fracción de área descartada)."""
    total_area = geometry.area
    if geometry.geom_type == "MultiPolygon":
        geometry = max(geometry.geoms, key=lambda part: part.area)
    exterior_only = shape({"type": "Polygon", "coordinates": [list(geometry.exterior.coords)]})
    discarded_fraction = 1 - geometry.area / total_area if total_area > 0 else 0
    return exterior_only, discarded_fraction


def build_zone_geometry(zone_id, municipalities):
    municipality_names, clip_rectangle = ZONE_RULES[zone_id]
    if municipality_names is None:
        names = list(municipalities)
    else:
        missing = [name for name in municipality_names if name not in municipalities]
        if missing:
            raise SystemExit(f"Zona {zone_id}: municipios no encontrados en el geojson: {missing}")
        names = municipality_names
    # buffer(0) corrige anillos inválidos; el buffer chico cierra rendijas entre municipios vecinos
    merged = unary_union([municipalities[name].buffer(0) for name in names]).buffer(0.0005).buffer(-0.0005)
    if clip_rectangle is not None:
        merged = merged.intersection(box(*clip_rectangle))
    merged = merged.simplify(SIMPLIFY_TOLERANCE_DEG, preserve_topology=True)
    polygon, discarded_fraction = to_single_polygon(merged)
    return polygon, names, discarded_fraction


def round_coordinates(polygon):
    ring = [[round(x, COORDINATE_DECIMALS), round(y, COORDINATE_DECIMALS)] for x, y in polygon.exterior.coords]
    return {"type": "Polygon", "coordinates": [ring]}


def main():
    municipalities = load_municipalities()
    with open(ZONES_FILE, "r", encoding="utf-8") as zones_file:
        zones = json.load(zones_file)

    for feature in zones["features"]:
        zone_id = feature["properties"]["id"]
        if zone_id not in ZONE_RULES:
            print(f"  {zone_id}: sin regla, se deja como está")
            continue
        polygon, names, discarded_fraction = build_zone_geometry(zone_id, municipalities)
        geometry = round_coordinates(polygon)
        min_lon, min_lat, max_lon, max_lat = shape(geometry).bounds
        feature["geometry"] = geometry
        feature["properties"]["bbox"] = [round(min_lon, 4), round(min_lat, 4), round(max_lon, 4), round(max_lat, 4)]
        municipality_names, clip_rectangle = ZONE_RULES[zone_id]
        if municipality_names is None and clip_rectangle is not None:
            method = "rectángulo aproximado recortado al departamento (área protegida, no municipios)"
        elif clip_rectangle is None:
            method = "unión de los 48 municipios"
        else:
            method = "unión de municipios reales recortada al área de la zona"
        feature["properties"]["geometria"] = method
        warning = f"  (se descartó {discarded_fraction:.1%} del área en piezas sueltas)" if discarded_fraction > 0.001 else ""
        print(f"  {zone_id:16s} {len(geometry['coordinates'][0]):4d} vértices, bbox {feature['properties']['bbox']}{warning}")

    zones.setdefault("metadata", {})
    zones["metadata"]["advertencia"] = (
        "Cada zona es la unión de los límites municipales reales recortada al área de la zona (model/build_zones.py). "
        "TIPNIS/Carrasco sigue siendo un rectángulo aproximado (recortado al departamento): reemplazar por el límite "
        "oficial de las áreas protegidas si se consigue. La zona cercado-gamc es el municipio de Cercado.")
    zones["metadata"]["fuente_limites"] = "Lab TecnoSocial 2024 (CC BY 4.0, compilación no oficial)"

    with open(ZONES_FILE, "w", encoding="utf-8") as zones_file:
        json.dump(zones, zones_file, ensure_ascii=False, indent=2)
    print(f"Listo: {ZONES_FILE}")


if __name__ == "__main__":
    main()
