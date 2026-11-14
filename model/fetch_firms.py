"""Descarga focos de NASA FIRMS por API de área a data/raw/ (dueño: P1 - Modelo).

Necesita una MAP_KEY gratuita: https://firms.modaps.eosdis.nasa.gov/api/map_key/
    export FIRMS_MAP_KEY=xxxx            (Windows: set FIRMS_MAP_KEY=xxxx)
    python fetch_firms.py --source VIIRS_NOAA20_NRT --start 2026-10-01 --end 2026-11-14

Fuentes útiles:
  Histórico (procesamiento estándar): MODIS_SP, VIIRS_SNPP_SP, VIIRS_NOAA20_SP
  Reciente (casi tiempo real):        MODIS_NRT, VIIRS_NOAA20_NRT, VIIRS_NOAA21_NRT
Nota: Suomi NPP ya no entrega datos nuevos; para lo reciente usen NOAA-20/NOAA-21.

Para 20+ años de historia suele ser más rápido bajar los CSV anuales por país (Bolivia) desde el
sitio de FIRMS y dejarlos en data/raw/: harmonize.py lee cualquier CSV de FIRMS que haya ahí.
La API tiene un límite de transacciones por cada 10 minutos: por eso el script espera entre pedidos.
"""
import argparse
import io
import os
import sys
import time
import urllib.request
from datetime import date, timedelta

import pandas as pd

import config as C

URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv/{key}/{src}/{area}/{days}/{date}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True)
    ap.add_argument("--start", required=True)
    ap.add_argument("--end", required=True)
    ap.add_argument("--chunk", type=int, default=5, help="días por pedido (máximo que acepte la API)")
    ap.add_argument("--sleep", type=float, default=1.0)
    a = ap.parse_args()
    key = os.environ.get("FIRMS_MAP_KEY")
    if not key:
        sys.exit("Falta FIRMS_MAP_KEY")

    area = ",".join(str(v) for v in C.BBOX)  # west,south,east,north
    d, end = date.fromisoformat(a.start), date.fromisoformat(a.end)
    frames = []
    while d <= end:
        n = min(a.chunk, (end - d).days + 1)
        url = URL.format(key=key, src=a.source, area=area, days=n, date=d.isoformat())
        txt = urllib.request.urlopen(url, timeout=120).read().decode()
        if txt.lower().startswith("invalid") or "error" in txt[:100].lower():
            sys.exit(f"FIRMS respondió: {txt[:200]}")
        df = pd.read_csv(io.StringIO(txt)) if txt.strip() else pd.DataFrame()
        frames.append(df)
        print(f"{a.source} {d} +{n}d: {len(df)} filas")
        d += timedelta(days=n)
        time.sleep(a.sleep)

    out_dir = os.path.join(C.RAW_DIR, "api")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, f"{a.source.lower()}_{a.start}_{a.end}.csv")
    pd.concat(frames, ignore_index=True).to_csv(out, index=False)
    print("guardado", out)


if __name__ == "__main__":
    main()
