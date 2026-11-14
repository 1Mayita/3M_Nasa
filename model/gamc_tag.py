"""
Dueño: P1 (Modelo)

Etiqueta cada detección (foco) que cae dentro del municipio de Cercado con la info
de la API de la Alcaldía (GAMC): distrito, comuna, si está en la capa Cota 2750
y la clase de periurbano / cobertura.

Analogía: es como pasar lista. Por cada foco le preguntamos a la Alcaldía
"¿en qué distrito está este punto?" y anotamos la respuesta en un archivo.

Uso (desde la carpeta model/):
    set GAMC_API_KEY=...            (Windows)   |   export GAMC_API_KEY=...   (Linux/Mac)
    python gamc_tag.py --input ../data/processed/detections.csv
    python gamc_tag.py --input ../data/processed/detections.csv --limit 50   (prueba rápida)

Salida:
    ../data/processed/gamc_tags.json        (lo lee el servidor)
    ../data/processed/gamc_cache.json       (respuestas guardadas para no repetir consultas)

Solo usa la librería estándar de Python + pandas.
"""

import argparse
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request

import pandas as pd

GAMC_WMS_URL = os.environ.get("GAMC_WMS_URL", "https://serviciosgamc.cochabamba.bo/api/gs/wms")
GAMC_API_KEY = os.environ.get("GAMC_API_KEY", "")

SERVICE_IDS = {
    "distritos": os.environ.get("GAMC_SERVICE_DISTRITOS", "7eb13092-bf0e-493b-aae6-03c43eedda2c"),
    "cota2750": os.environ.get("GAMC_SERVICE_COTA2750", "297cefa4-0832-42bb-a98e-2cbea989fd9d"),
    "periurbanos": os.environ.get("GAMC_SERVICE_PERIURBANOS", "c52066a1-32fd-4925-81e0-c2dcb8f4238f"),
}

# [longitud mínima, latitud mínima, longitud máxima, latitud máxima]
COVERAGE_BBOX = [-66.280703, -17.53119, -66.06952, -17.257306]

DELAY_BETWEEN_REQUESTS_SECONDS = 0.3
REQUEST_TIMEOUT_SECONDS = 15
MAXIMUM_RETRIES = 3

EARTH_HALF_CIRCUMFERENCE_METERS = 20037508.34
HALF_BOX_METERS = 50
IMAGE_SIZE_PIXELS = 101
CENTER_PIXEL = 50

SNPP_SATELLITE_CODES = {"N", "NPP", "SNPP", "S-NPP", "SUOMI NPP"}
NOAA20_SATELLITE_CODES = {"N20", "1", "J1", "NOAA-20", "NOAA20"}
NOAA21_SATELLITE_CODES = {"N21", "2", "J2", "NOAA-21", "NOAA21"}


def convert_lon_lat_to_web_mercator(longitude, latitude):
    x_value = longitude * EARTH_HALF_CIRCUMFERENCE_METERS / 180
    tangent_term = math.tan((90 + latitude) * math.pi / 360)
    y_in_degrees = math.log(tangent_term) / (math.pi / 180)
    y_value = y_in_degrees * EARTH_HALF_CIRCUMFERENCE_METERS / 180
    return x_value, y_value


def is_inside_coverage(longitude, latitude):
    is_inside_longitude = COVERAGE_BBOX[0] <= longitude <= COVERAGE_BBOX[2]
    is_inside_latitude = COVERAGE_BBOX[1] <= latitude <= COVERAGE_BBOX[3]
    return is_inside_longitude and is_inside_latitude


def build_feature_info_url(service_id, longitude, latitude):
    center_x, center_y = convert_lon_lat_to_web_mercator(longitude, latitude)
    bbox_values = [
        center_x - HALF_BOX_METERS,
        center_y - HALF_BOX_METERS,
        center_x + HALF_BOX_METERS,
        center_y + HALF_BOX_METERS,
    ]
    parameters = {
        "key": GAMC_API_KEY,
        "service_id": service_id,
        "SERVICE": "WMS",
        "VERSION": "1.1.1",
        "REQUEST": "GetFeatureInfo",
        "LAYERS": "",
        "QUERY_LAYERS": "",
        "SRS": "EPSG:3857",
        "BBOX": ",".join(str(value) for value in bbox_values),
        "WIDTH": str(IMAGE_SIZE_PIXELS),
        "HEIGHT": str(IMAGE_SIZE_PIXELS),
        "X": str(CENTER_PIXEL),
        "Y": str(CENTER_PIXEL),
        "INFO_FORMAT": "application/json",
        "FEATURE_COUNT": "1",
    }
    return GAMC_WMS_URL + "?" + urllib.parse.urlencode(parameters)


def ask_gamc(service_id, longitude, latitude):
    """Devuelve las propiedades del elemento en el punto, o None si no hay nada."""
    url = build_feature_info_url(service_id, longitude, latitude)
    for attempt_number in range(1, MAXIMUM_RETRIES + 1):
        try:
            time.sleep(DELAY_BETWEEN_REQUESTS_SECONDS)
            with urllib.request.urlopen(url, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                feature_collection = json.loads(response.read().decode("utf-8"))
            features = feature_collection.get("features", [])
            if len(features) == 0:
                return None
            return features[0].get("properties")
        except Exception as error:  # la API a veces corta si se le pide mucho seguido
            wait_seconds = 2 * attempt_number
            print(f"  intento {attempt_number} falló ({error}); espero {wait_seconds}s", file=sys.stderr)
            time.sleep(wait_seconds)
    raise RuntimeError("La API GAMC no respondió después de varios intentos")


def detect_source(row):
    """Devuelve MODIS, VIIRS_SNPP, VIIRS_NOAA20 o VIIRS_NOAA21 según las columnas de FIRMS."""
    if "source" in row and isinstance(row["source"], str) and row["source"] != "":
        return row["source"]
    instrument = str(row.get("instrument", "")).strip().upper()
    satellite = str(row.get("satellite", "")).strip().upper()
    if instrument == "MODIS" or satellite in {"TERRA", "AQUA", "T", "A"}:
        return "MODIS"
    if satellite in SNPP_SATELLITE_CODES:
        return "VIIRS_SNPP"
    if satellite in NOAA20_SATELLITE_CODES:
        return "VIIRS_NOAA20"
    if satellite in NOAA21_SATELLITE_CODES:
        return "VIIRS_NOAA21"
    return "DESCONOCIDO"


def passes_scientific_filters(row, source):
    """Regla 4 del CLAUDE.md. Si los datos ya vienen filtrados, no cambia nada."""
    if "type" in row and pd.notna(row["type"]):
        if int(row["type"]) != 0:
            return False
    if "confidence" not in row or pd.isna(row["confidence"]):
        return True
    confidence_value = row["confidence"]
    if source == "MODIS":
        try:
            return float(confidence_value) >= 30
        except ValueError:
            return False
    confidence_text = str(confidence_value).strip().lower()
    return confidence_text in {"n", "h", "nominal", "high"}


def load_cache(cache_path):
    if os.path.exists(cache_path):
        with open(cache_path, "r", encoding="utf-8") as cache_file:
            return json.load(cache_file)
    return {}


def save_cache(cache_path, cache):
    with open(cache_path, "w", encoding="utf-8") as cache_file:
        json.dump(cache, cache_file, ensure_ascii=False)


def tag_point(longitude, latitude, cache):
    cache_key = f"{longitude:.4f},{latitude:.4f}"
    if cache_key in cache:
        return cache[cache_key]
    district_properties = ask_gamc(SERVICE_IDS["distritos"], longitude, latitude)
    cota_properties = ask_gamc(SERVICE_IDS["cota2750"], longitude, latitude)
    periurban_properties = ask_gamc(SERVICE_IDS["periurbanos"], longitude, latitude)
    tag = {
        "distrito": district_properties.get("Distrito") if district_properties else None,
        "comuna": district_properties.get("Comuna") if district_properties else None,
        "insideCota2750Layer": cota_properties is not None,
        "periurbano": periurban_properties.get("Periurbano") if periurban_properties else None,
        "coberturaGamc": periurban_properties.get("Detalle") if periurban_properties else None,
    }
    cache[cache_key] = tag
    return tag


def main():
    parser = argparse.ArgumentParser(description="Etiqueta focos de Cercado con la API de la Alcaldía")
    parser.add_argument("--input", required=True, help="CSV de detecciones (formato FIRMS o el procesado del equipo)")
    parser.add_argument("--output", default="../data/processed/gamc_tags.json")
    parser.add_argument("--cache", default="../data/processed/gamc_cache.json")
    parser.add_argument("--limit", type=int, default=0, help="Procesar solo N detecciones (para probar)")
    parser.add_argument("--lat-column", default="latitude")
    parser.add_argument("--lon-column", default="longitude")
    parser.add_argument("--date-column", default="acq_date")
    arguments = parser.parse_args()

    if GAMC_API_KEY == "":
        print("Falta la variable de entorno GAMC_API_KEY", file=sys.stderr)
        sys.exit(1)

    detections = pd.read_csv(arguments.input)
    print(f"Detecciones leídas: {len(detections)}")

    inside_mask = detections.apply(
        lambda row: is_inside_coverage(float(row[arguments.lon_column]), float(row[arguments.lat_column])),
        axis=1,
    )
    detections_inside = detections[inside_mask].reset_index(drop=True)
    print(f"Detecciones dentro de la cobertura de la Alcaldía (Cercado): {len(detections_inside)}")
    if arguments.limit > 0:
        detections_inside = detections_inside.head(arguments.limit)

    os.makedirs(os.path.dirname(arguments.output), exist_ok=True)
    cache = load_cache(arguments.cache)
    tagged_detections = []

    for row_index, row in detections_inside.iterrows():
        row_dictionary = row.to_dict()
        source = detect_source(row_dictionary)
        if not passes_scientific_filters(row_dictionary, source):
            continue
        longitude = float(row_dictionary[arguments.lon_column])
        latitude = float(row_dictionary[arguments.lat_column])
        tag = tag_point(longitude, latitude, cache)
        tagged_detection = {
            "id": f"D{row_index:06d}",
            "source": source,
            "date": str(row_dictionary[arguments.date_column])[:10],
            "latitude": latitude,
            "longitude": longitude,
        }
        tagged_detection.update(tag)
        tagged_detections.append(tagged_detection)

        if len(tagged_detections) % 25 == 0:
            save_cache(arguments.cache, cache)
            print(f"  etiquetadas {len(tagged_detections)} / {len(detections_inside)}")

    save_cache(arguments.cache, cache)
    output_document = {
        "metadata": {
            "sintetico": False,
            "descripcion": "Detecciones dentro de Cercado etiquetadas con la API WMS de la Alcaldía de Cochabamba",
            "entrada": os.path.basename(arguments.input),
            "generado": time.strftime("%Y-%m-%d %H:%M"),
        },
        "detections": tagged_detections,
    }
    with open(arguments.output, "w", encoding="utf-8") as output_file:
        json.dump(output_document, output_file, ensure_ascii=False)
    print(f"Listo: {len(tagged_detections)} detecciones en {arguments.output}")


if __name__ == "__main__":
    main()
