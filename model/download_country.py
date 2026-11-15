"""Descarga los CSV anuales de FIRMS por país (Bolivia) a data/raw/country/ (dueño: P1 - Modelo).

No necesita MAP_KEY. Son los archivos de "procesamiento estándar" (SP) por año y país que publica
FIRMS; incluyen la columna `type` (0 = vegetación presunta, 2 = otra fuente fija, etc.).
El año en curso casi nunca está como archivo anual: para eso usen fetch_firms.py (NRT, con MAP_KEY).

    python download_country.py                       # todo: MODIS 2000-, S-NPP 2012-, NOAA-20 2018-
    python download_country.py --sensors modis --years 2019 2024
    python download_country.py --country Bolivia --until 2025

Los archivos que ya existen con el tamaño correcto se saltan (se puede cortar y volver a correr).
"""
import argparse
import os
import time
import urllib.error
import urllib.request
from datetime import date

import config as C

BASE = "https://firms.modaps.eosdis.nasa.gov/data/country/{folder}/{year}/{folder}_{year}_{country}.csv"
# carpeta de FIRMS -> primer año con datos
SENSORS = {
    "modis": ("modis", 2000),
    "snpp": ("viirs-snpp", 2012),
    "noaa20": ("viirs-jpss1", 2018),
}


def _remote_size(url):
    req = urllib.request.Request(url, method="HEAD")
    with urllib.request.urlopen(req, timeout=60) as r:
        return int(r.headers.get("Content-Length") or -1)


def download(url, dest, retries=5):
    for attempt in range(1, retries + 1):
        try:
            size = _remote_size(url)
            if os.path.exists(dest) and os.path.getsize(dest) == size:
                print(f"  ya está {os.path.basename(dest)}")
                return True
            tmp = dest + ".part"
            with urllib.request.urlopen(url, timeout=120) as r, open(tmp, "wb") as f:
                while chunk := r.read(1 << 20):
                    f.write(chunk)
            os.replace(tmp, dest)
            print(f"  bajado {os.path.basename(dest)} ({os.path.getsize(dest) / 1e6:.1f} MB)", flush=True)
            return True
        except urllib.error.HTTPError as e:
            if e.code == 404:
                print(f"  no existe (404): {os.path.basename(dest)}")
                return False
            err = e
        except Exception as e:  # red inestable: reintentar
            err = e
        print(f"  intento {attempt}/{retries} falló ({err}); reintento...", flush=True)
        time.sleep(5 * attempt)
    print(f"  ERROR: no se pudo bajar {url}")
    return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--country", default="Bolivia")
    ap.add_argument("--sensors", nargs="+", default=list(SENSORS), choices=list(SENSORS))
    ap.add_argument("--years", nargs="+", type=int, help="años puntuales (por defecto, todos)")
    ap.add_argument("--until", type=int, default=date.today().year - 1, help="último año a bajar")
    a = ap.parse_args()

    out_dir = os.path.join(C.RAW_DIR, "country")
    os.makedirs(out_dir, exist_ok=True)
    for s in a.sensors:
        folder, first = SENSORS[s]
        years = a.years or range(first, a.until + 1)
        print(f"{s} ({folder}):", flush=True)
        for y in years:
            if y < first:
                continue
            url = BASE.format(folder=folder, year=y, country=a.country)
            download(url, os.path.join(out_dir, f"{folder}_{y}_{a.country}.csv"))


if __name__ == "__main__":
    main()
