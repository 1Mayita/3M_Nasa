"""Genera data/sample/ con datos SINTÉTICOS en el formato final (dueño: P1 - Modelo).

Sirve para que el Controlador y la Vista trabajen desde el minuto 1 sin esperar los datos reales.
Pasa por el MISMO pipeline (harmonize.build), así que también prueba el código de armonización.
"""
import numpy as np
import pandas as pd

import config as C
from harmonize import apply_filters, build

rng = np.random.default_rng(42)

# focos sintéticos alrededor de zonas con quemas reales en Bolivia (lon, lat, peso)
CENTERS = [(-60.5, -16.5, 0.40),   # Chiquitanía
           (-64.8, -14.2, 0.25),   # Beni
           (-67.4, -11.3, 0.15),   # Pando
           (-62.6, -19.8, 0.20)]   # Chaco
MONTH_W = np.array([0.2, 0.15, 0.15, 0.2, 0.4, 0.8, 2.2, 4.5, 5.0, 2.5, 0.8, 0.3])
YEAR_W = {2004: 1.8, 2005: 1.6, 2007: 1.5, 2010: 2.0, 2019: 2.2, 2020: 1.6, 2024: 2.6}

SNPP_END = "2026-07-31"     # sintético: S-NPP deja de dar datos
N20_START = "2018-04-01"


def main():
    rows = []
    days = pd.date_range("2000-11-01", "2026-10-31", freq="D")
    for day in days:
        lam = 1.5 * MONTH_W[day.month - 1] * YEAR_W.get(day.year, 1.0) / MONTH_W.mean()
        for _ in range(rng.poisson(lam)):
            cx, cy, _w = CENTERS[rng.choice(len(CENTERS), p=[c[2] for c in CENTERS])]
            fx, fy = cx + rng.normal(0, 0.9), cy + rng.normal(0, 0.7)
            size = rng.lognormal(0, 0.8)
            ds = day.strftime("%Y-%m-%d")
            # MODIS (1 km): menos detecciones por fuego
            for _ in range(rng.poisson(0.5 * size)):
                rows.append(("MODIS", rng.choice(["Terra", "Aqua"]), fy + rng.normal(0, .02), fx + rng.normal(0, .02),
                             ds, int(rng.integers(0, 2400)), int(rng.integers(20, 100)), round(rng.gamma(2, 15), 1),
                             rng.choice(["D", "N"], p=[.8, .2]), 0))
            if ds >= C.VIIRS_START and ds <= SNPP_END:   # VIIRS S-NPP (375 m): ~4x más
                for _ in range(rng.poisson(2.1 * size)):
                    rows.append(("VIIRS", "SNPP", fy + rng.normal(0, .01), fx + rng.normal(0, .01), ds,
                                 int(rng.integers(0, 2400)), rng.choice(["l", "n", "h"], p=[.1, .8, .1]),
                                 round(rng.gamma(2, 5), 1), rng.choice(["D", "N"], p=[.8, .2]), 0))
            if ds >= N20_START:                           # VIIRS NOAA-20
                for _ in range(rng.poisson(1.9 * size)):
                    rows.append(("VIIRS", "NOAA20", fy + rng.normal(0, .01), fx + rng.normal(0, .01), ds,
                                 int(rng.integers(0, 2400)), rng.choice(["l", "n", "h"], p=[.1, .8, .1]),
                                 round(rng.gamma(2, 5), 1), rng.choice(["D", "N"], p=[.8, .2]), 0))
    pts = pd.DataFrame(rows, columns=["sensor", "platform", "latitude", "longitude", "acq_date", "acq_time",
                                      "confidence", "frp", "daynight", "type"])
    pts["acq_time"] = pts.acq_time.map(lambda t: f"{t:04d}")
    pts["latitude"] = pts.latitude.round(4)
    pts["longitude"] = pts.longitude.round(4)
    print(f"sintéticos: {len(pts):,} detecciones")
    build(apply_filters(pts, C.BBOX), C.SAMPLE_DIR, is_sample=True)


if __name__ == "__main__":
    main()
