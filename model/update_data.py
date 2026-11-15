"""
Dueño: P1 (Modelo)

Actualización completa de los datos en UN solo comando (pensado para la tarea diaria de GitHub Actions).

    cd model
    pip install -r requirements.txt
    FIRMS_MAP_KEY=xxxx python update_data.py          (Windows: set FIRMS_MAP_KEY=xxxx && python update_data.py)

Pasos:
  1. Archivo histórico por país (Bolivia), años completos hasta el año pasado -> data/raw/country/
     (download_country.py; los archivos que ya están se saltan, así que conviene cachear esa carpeta).
  2. Año en curso por la API de FIRMS -> data/raw/api/
     Para cada sensor (MODIS, VIIRS S-NPP, VIIRS NOAA-20) se consulta data_availability y se baja
     el procesamiento estándar (SP) hasta donde exista y, desde ahí, el casi tiempo real (NRT).
  3. harmonize.py + export_focos_mensuales.py en una carpeta TEMPORAL.
  4. Validación: la fecha final de los datos no retrocede y no se pierden celdas de golpe.
  5. Solo si todo salió bien, se copian los archivos a data/processed/.

Si algo falla (descarga, FIRMS caído, validación), el script termina con código 1 y data/processed/
queda como estaba: nunca se pisan datos buenos con datos malos.

No toca gamc_tags.json (el etiquetado con la Alcaldía va aparte, con gamc_tag.py, porque tarda ~1 s por foco).
"""

import argparse
import io
import json
import os
import shutil
import sys
import tempfile
import urllib.request
from datetime import date, timedelta

import pandas as pd

import config as C
import download_country
import export_focos_mensuales
import fetch_firms
import harmonize

AVAILABILITY_URL = "https://firms.modaps.eosdis.nasa.gov/api/data_availability/csv/{key}/all"

# sensor de la API -> carpeta del archivo por país (download_country.SENSORS)
API_SENSORS = {
    "MODIS": "modis",
    "VIIRS_SNPP": "snpp",
    "VIIRS_NOAA20": "noaa20",
}

# archivos de data/processed que lee el servidor (los mismos que se versionan en git)
PUBLISHED_FILES = ["k_factors.json", "metadata.json", "daily_cells.csv", "monthly_series.csv",
                   "focos_mensuales.json", "detections_cochabamba.csv"]

# si la cantidad de celdas-día cae más que esto respecto de la versión anterior, algo anda mal
MAX_ROW_DROP = 0.05


def read_availability(key):
    """Devuelve {data_id: (min_date, max_date)} según FIRMS."""
    text = urllib.request.urlopen(AVAILABILITY_URL.format(key=key), timeout=60).read().decode()
    if not text.startswith("data_id"):
        raise RuntimeError(f"data_availability respondió: {text[:200]}")
    table = pd.read_csv(io.StringIO(text))
    availability = {}
    for row in table.itertuples(index=False):
        availability[row.data_id] = (date.fromisoformat(row.min_date), date.fromisoformat(row.max_date))
    return availability


def download_country_archive(country, last_year):
    """Baja los años completos. Devuelve {sensor: primer año que NO está como archivo} para saber
    desde cuándo hay que completar con la API (normalmente el año en curso)."""
    out_dir = os.path.join(C.RAW_DIR, "country")
    os.makedirs(out_dir, exist_ok=True)
    first_missing_year = {}
    for sensor, (folder, first_year) in download_country.SENSORS.items():
        first_missing_year[sensor] = last_year + 1
        print(f"Archivo por país {sensor} ({folder}) {first_year}-{last_year}:", flush=True)
        for year in range(first_year, last_year + 1):
            url = download_country.BASE.format(folder=folder, year=year, country=country)
            destination = os.path.join(out_dir, f"{folder}_{year}_{country}.csv")
            is_ok = download_country.download(url, destination)
            if not is_ok:
                # el archivo anual del año recién terminado puede tardar meses en publicarse:
                # se completa con la API desde ese año
                if year >= last_year:
                    first_missing_year[sensor] = min(first_missing_year[sensor], year)
                else:
                    raise RuntimeError(f"Falta el archivo histórico {folder} {year}")
    return first_missing_year


def download_recent(key, availability, first_missing_year, today):
    """Baja por la API el período que no cubre el archivo por país. Devuelve {nombre_archivo: DataFrame}."""
    files = {}
    for api_name, sensor in API_SENSORS.items():
        start = date(first_missing_year[sensor], 1, 1)
        sp_range = availability.get(f"{api_name}_SP")
        nrt_range = availability.get(f"{api_name}_NRT")

        sp_end = None
        if sp_range is not None and sp_range[1] >= start:
            sp_end = min(sp_range[1], today)
            frame = fetch_firms.fetch_range(key, f"{api_name}_SP", start, sp_end)
            files[f"{api_name.lower()}_sp_{start}_{sp_end}.csv"] = frame

        nrt_start = start if sp_end is None else sp_end + timedelta(days=1)
        if nrt_range is not None and nrt_range[1] >= nrt_start:
            if nrt_range[0] > nrt_start:
                print(f"AVISO: {api_name} sin datos entre {nrt_start} y {nrt_range[0]} (FIRMS aún no los publica)")
                nrt_start = nrt_range[0]
            nrt_end = min(nrt_range[1], today)
            frame = fetch_firms.fetch_range(key, f"{api_name}_NRT", nrt_start, nrt_end)
            files[f"{api_name.lower()}_nrt_{nrt_start}_{nrt_end}.csv"] = frame
    return files


def replace_api_folder(files):
    """Reemplaza data/raw/api por los archivos nuevos (solo se llama si TODAS las descargas salieron bien)."""
    api_dir = os.path.join(C.RAW_DIR, "api")
    if os.path.isdir(api_dir):
        shutil.rmtree(api_dir)
    os.makedirs(api_dir)
    for file_name, frame in files.items():
        frame.to_csv(os.path.join(api_dir, file_name), index=False)
        print(f"  guardado raw/api/{file_name}: {len(frame)} filas")


def validate(new_dir, old_dir):
    """Compara la versión nueva con la publicada. Lanza RuntimeError si parece rota."""
    with open(os.path.join(new_dir, "metadata.json"), "r", encoding="utf-8") as new_file:
        new_meta = json.load(new_file)
    new_rows = len(pd.read_csv(os.path.join(new_dir, "daily_cells.csv")))
    if new_rows == 0:
        raise RuntimeError("daily_cells.csv salió vacío")

    old_meta_path = os.path.join(old_dir, "metadata.json")
    old_cells_path = os.path.join(old_dir, "daily_cells.csv")
    if not (os.path.exists(old_meta_path) and os.path.exists(old_cells_path)):
        return new_meta
    with open(old_meta_path, "r", encoding="utf-8") as old_file:
        old_meta = json.load(old_file)
    old_rows = len(pd.read_csv(old_cells_path))

    if new_meta["date_max"] < old_meta["date_max"]:
        raise RuntimeError(f"Los datos retroceden: {new_meta['date_max']} < {old_meta['date_max']}")
    if new_rows < old_rows * (1 - MAX_ROW_DROP):
        raise RuntimeError(f"Se perdieron demasiadas celdas-día: {new_rows} contra {old_rows} antes")
    print(f"Validación OK: datos hasta {new_meta['date_max']} (antes {old_meta['date_max']}), "
          f"{new_rows} celdas-día (antes {old_rows})")
    return new_meta


def publish(new_dir, processed_dir):
    for file_name in PUBLISHED_FILES:
        source = os.path.join(new_dir, file_name)
        if os.path.exists(source):
            shutil.copy2(source, os.path.join(processed_dir, file_name))
    points_dir = os.path.join(processed_dir, "points")
    if os.path.isdir(points_dir):
        shutil.rmtree(points_dir)
    shutil.copytree(os.path.join(new_dir, "points"), points_dir)


def main():
    parser = argparse.ArgumentParser(description="Baja, armoniza, valida y publica los datos en data/processed/")
    parser.add_argument("--country", default="Bolivia")
    parser.add_argument("--processed", default=C.PROCESSED_DIR)
    arguments = parser.parse_args()

    key = os.environ.get("FIRMS_MAP_KEY")
    if not key:
        sys.exit("Falta la variable de entorno FIRMS_MAP_KEY")
    today = date.today()

    try:
        print("== 1/5 Archivo histórico por país", flush=True)
        first_missing_year = download_country_archive(arguments.country, today.year - 1)

        print("== 2/5 Año en curso por la API de FIRMS", flush=True)
        availability = read_availability(key)
        recent_files = download_recent(key, availability, first_missing_year, today)
        replace_api_folder(recent_files)

        with tempfile.TemporaryDirectory() as new_dir:
            print("== 3/5 Armonización", flush=True)
            points = harmonize.apply_filters(harmonize.load_raw(C.RAW_DIR), C.BBOX)
            harmonize.build(points, new_dir)

            print("== 4/5 Focos mensuales para el mapa 3D", flush=True)
            export_focos_mensuales.export_from_daily_cells(os.path.join(new_dir, "daily_cells.csv"),
                                                           os.path.join(new_dir, "focos_mensuales.json"))

            print("== 5/5 Validación y publicación", flush=True)
            new_meta = validate(new_dir, arguments.processed)
            publish(new_dir, arguments.processed)
    except Exception as error:
        sys.exit(f"ERROR: {error}\nNo se tocó data/processed/: siguen los datos anteriores.")

    print(f"LISTO: datos hasta {new_meta['date_max']} publicados en {arguments.processed}")


if __name__ == "__main__":
    main()
