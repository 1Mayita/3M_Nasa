"""Pipeline de armonización MODIS + VIIRS (dueño: P1 - Modelo).

Lee todos los CSV de FIRMS que haya en data/raw/ (descarga por API, por país o del archivo),
los estandariza, filtra, agrega en celdas de 0.1° por día y genera una serie armonizada en
"equivalente VIIRS". Escribe el formato de docs/DATA.md en data/processed/.

Uso:
    python harmonize.py                 # data/raw -> data/processed
    python harmonize.py --raw X --out Y
"""
import argparse
import glob
import json
import os
from datetime import datetime

import numpy as np
import pandas as pd

import config as C

STD_COLS = ["sensor", "platform", "latitude", "longitude", "acq_date", "acq_time",
            "confidence", "frp", "daynight", "type"]


# ---------------------------------------------------------------- lectura
def _platform(row_sat, fname):
    s = str(row_sat).strip().upper()
    if s in ("TERRA", "T"):
        return "Terra"
    if s in ("AQUA", "A"):
        return "Aqua"
    if s in ("N", "NPP", "SNPP", "SUOMI NPP", "SUOMI-NPP"):
        return "SNPP"
    if s in ("N20", "1", "NOAA-20", "NOAA20", "J1", "JPSS1"):
        return "NOAA20"
    if s in ("N21", "2", "NOAA-21", "NOAA21", "J2", "JPSS2"):
        return "NOAA21"
    f = fname.lower()  # pistas por nombre de archivo (descargas por país / API)
    if "noaa21" in f or "jpss2" in f:
        return "NOAA21"
    if "noaa20" in f or "jpss1" in f:
        return "NOAA20"
    if "snpp" in f or "suomi" in f:
        return "SNPP"
    return "unknown"


def standardize(df, fname):
    """Convierte un CSV de FIRMS (MODIS o VIIRS) al esquema común."""
    cols = set(df.columns)
    is_viirs = "bright_ti4" in cols
    out = pd.DataFrame(index=df.index)
    out["latitude"] = df["latitude"].astype(float)
    out["longitude"] = df["longitude"].astype(float)
    out["sensor"] = "VIIRS" if is_viirs else "MODIS"
    out["acq_date"] = pd.to_datetime(df["acq_date"]).dt.strftime("%Y-%m-%d")
    out["acq_time"] = df["acq_time"].astype(int).map(lambda t: f"{t:04d}")
    sat = df["satellite"] if "satellite" in cols else pd.Series([""] * len(df))
    out["platform"] = [_platform(s, fname) for s in sat]
    if is_viirs:
        out["confidence"] = df["confidence"].astype(str).str.strip().str.lower().str[0]
    else:
        out["confidence"] = pd.to_numeric(df["confidence"], errors="coerce")
    out["frp"] = pd.to_numeric(df.get("frp", np.nan), errors="coerce")
    out["daynight"] = df["daynight"] if "daynight" in cols else ""
    out["type"] = pd.to_numeric(df["type"], errors="coerce") if "type" in cols else np.nan
    return out[STD_COLS]


def load_raw(raw_dir):
    frames = []
    for path in sorted(glob.glob(os.path.join(raw_dir, "**", "*.csv"), recursive=True)):
        df = pd.read_csv(path)
        if df.empty or "latitude" not in df.columns:
            continue
        frames.append(standardize(df, os.path.basename(path)))
        print(f"  leído {os.path.relpath(path, raw_dir)}: {len(df):,} filas")
    if not frames:
        raise SystemExit(f"No hay CSV de FIRMS en {raw_dir}. Ver model/README.md")
    return pd.concat(frames, ignore_index=True)


# ---------------------------------------------------------------- filtros
def apply_filters(pts, bbox):
    n0 = len(pts)
    minx, miny, maxx, maxy = bbox
    pts = pts[pts.longitude.between(minx, maxx) & pts.latitude.between(miny, maxy)]
    is_m = pts.sensor == "MODIS"
    conf_num = pd.to_numeric(pts.confidence.where(is_m), errors="coerce")
    ok_m = is_m & (conf_num >= C.MODIS_MIN_CONF)
    ok_v = (~is_m) & pts.confidence.isin(C.VIIRS_CONF_OK)
    pts = pts[ok_m | ok_v]
    pts = pts[pts["type"].isna() | (pts["type"] == 0)]  # solo fuego de vegetación presunto
    pts = pts.drop_duplicates(["platform", "latitude", "longitude", "acq_date", "acq_time"])
    print(f"  filtros: {n0:,} -> {len(pts):,} detecciones")
    return pts.reset_index(drop=True)


# ---------------------------------------------------------------- armonización
def _cell(v):
    return np.round((np.floor(v / C.CELL_DEG) + 0.5) * C.CELL_DEG, 3)


def _ratio_by_month(num, den, months):
    """k[m] = suma(num)/suma(den) por mes del año, con respaldo global y límites."""
    df = pd.DataFrame({"num": num, "den": den, "m": months})
    g = df.groupby("m")[["num", "den"]].sum()
    total = df.num.sum() / df.den.sum() if df.den.sum() > 0 else 1.0
    k = {}
    for m in range(1, 13):
        if m in g.index and g.loc[m, "den"] >= 20:   # mínimo de detecciones para confiar
            k[m] = g.loc[m, "num"] / g.loc[m, "den"]
        else:
            k[m] = total
        k[m] = float(np.clip(k[m], C.K_MIN, C.K_MAX))
    return k


def build(pts, out_dir, is_sample=False):
    os.makedirs(os.path.join(out_dir, "points"), exist_ok=True)
    pts = pts.copy()
    pts["clat"] = _cell(pts.latitude)
    pts["clon"] = _cell(pts.longitude)

    # conteos diarios por celda y plataforma
    is_m = pts.sensor == "MODIS"
    pts["grp"] = np.where(is_m, "modis", np.where(pts.platform == "SNPP", "snpp",
                          np.where(pts.platform == "NOAA20", "n20", "other_viirs")))
    cnt = (pts.groupby(["acq_date", "clat", "clon", "grp"]).size()
              .unstack("grp", fill_value=0).reset_index())
    for c in ["modis", "snpp", "n20"]:
        if c not in cnt:
            cnt[c] = 0
    cnt["month"] = pd.to_datetime(cnt.acq_date).dt.month
    cnt["year"] = pd.to_datetime(cnt.acq_date).dt.year

    snpp_dates = cnt.loc[cnt.snpp > 0, "acq_date"]
    snpp_end = snpp_dates.max() if len(snpp_dates) else None
    modis_dates = cnt.loc[cnt.modis > 0, "acq_date"]
    modis_end = modis_dates.max() if len(modis_dates) else None

    # Totales mensuales del área (la calibración se hace a nivel regional, no por celda)
    mon = cnt.groupby(["year", "month"])[["modis", "snpp", "n20"]].sum().reset_index()

    # 1) MODIS -> VIIRS(S-NPP): solapamiento desde VIIRS_START hasta el fin de ambos
    vs = pd.Timestamp(C.VIIRS_START)
    ov_end = min(pd.Timestamp(snpp_end or "1900-01-01"), pd.Timestamp(modis_end or "1900-01-01"))
    mdate = pd.to_datetime(dict(year=mon.year, month=mon.month, day=1))
    ov = mon[(mdate >= vs.replace(day=1) + pd.offsets.MonthBegin(1)) & (mdate < ov_end.replace(day=1))]
    k = _ratio_by_month(ov.snpp, ov.modis, ov.month)

    # validación: entrenar 2012-2018, probar 2019+
    tr = ov[ov.year.between(*C.TRAIN_YEARS)]
    te = ov[ov.year >= C.TEST_FROM_YEAR]
    validation = None
    if len(tr) and len(te):
        k_tr = _ratio_by_month(tr.snpp, tr.modis, tr.month)
        pred = te.modis * te.month.map(k_tr)
        validation = {
            "train": f"{C.TRAIN_YEARS[0]}-{C.TRAIN_YEARS[1]}",
            "test": f"{C.TEST_FROM_YEAR}-{int(te.year.max())}",
            "unit": "detecciones VIIRS por mes en toda el área",
            "mae_harmonized": round(float((pred - te.snpp).abs().mean()), 1),
            "mae_naive": round(float((te.modis - te.snpp).abs().mean()), 1),
            "corr": round(float(np.corrcoef(pred, te.snpp)[0, 1]), 3) if len(te) > 2 else None,
        }

    # 2) NOAA-20 -> S-NPP (para seguir la serie cuando S-NPP deja de dar datos)
    ov2 = mon[(mon.snpp > 0) & (mon.n20 > 0)]
    k20 = _ratio_by_month(ov2.snpp, ov2.n20, ov2.month) if len(ov2) else {m: 1.0 for m in range(1, 13)}

    # serie armonizada en "equivalente VIIRS S-NPP"
    d = cnt.acq_date
    pre = d < C.VIIRS_START
    post = (snpp_end is not None) & (d > (snpp_end or "9999"))
    cnt["viirs_n"] = np.where(post, cnt.n20, cnt.snpp)
    cnt["harm_n"] = np.where(pre, cnt.modis * cnt.month.map(k),
                     np.where(post, cnt.n20 * cnt.month.map(k20), cnt.snpp))
    cnt["source"] = np.where(pre, "modis_scaled", np.where(post, "viirs_noaa20_scaled", "viirs"))

    out = cnt[cnt.harm_n > 0].rename(columns={"acq_date": "date", "clat": "lat", "clon": "lon",
                                              "modis": "modis_n"})
    out["harm_n"] = out.harm_n.round(3)
    out = out[["date", "lat", "lon", "modis_n", "viirs_n", "harm_n", "source"]].sort_values(["date", "lat", "lon"])
    out.to_csv(os.path.join(out_dir, "daily_cells.csv"), index=False)

    # focos individuales por año (para la descarga CSV)
    pcols = ["sensor", "platform", "latitude", "longitude", "acq_date", "acq_time", "confidence", "frp", "daynight"]
    for old in glob.glob(os.path.join(out_dir, "points", "*.csv")):
        os.remove(old)
    pts["year"] = pts.acq_date.str[:4]
    for y, g in pts.groupby("year"):
        g.sort_values(["acq_date", "acq_time"])[pcols].to_csv(
            os.path.join(out_dir, "points", f"{y}.csv"), index=False)

    meta = {
        "version": datetime.now().strftime("%Y-%m-%dT%H:%M"),
        "is_sample": is_sample,
        "cell_size_deg": C.CELL_DEG,
        "bbox": C.BBOX,
        "viirs_start": C.VIIRS_START,
        "snpp_end": snpp_end,
        "modis_end": modis_end,
        "date_min": out.date.min(),
        "date_max": out.date.max(),
        "unit": "detecciones equivalentes a VIIRS S-NPP (375 m)",
        "method": ("Antes de 2012-01-20: MODIS x k(mes), con k = suma VIIRS S-NPP / suma MODIS por mes del año "
                   "en el período de solapamiento. 2012-01-20 en adelante: VIIRS S-NPP. Después del fin de "
                   "S-NPP: NOAA-20 x k20(mes) calibrado contra S-NPP. Nunca se suman MODIS y VIIRS."),
        "coefficients_by_month": {str(m): round(v, 3) for m, v in k.items()},
        "noaa20_coefficients_by_month": {str(m): round(v, 3) for m, v in k20.items()},
        "validation": validation,
        "filters": {"modis_min_confidence": C.MODIS_MIN_CONF, "viirs_confidence": sorted(C.VIIRS_CONF_OK),
                    "type": "0 (vegetación) cuando existe la columna"},
    }
    with open(os.path.join(out_dir, "metadata.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print(f"  escrito {out_dir}: {len(out):,} filas celda-día, k(mes) = {meta['coefficients_by_month']}")
    if validation:
        print(f"  validación: {validation}")
    return meta


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", default=C.RAW_DIR)
    ap.add_argument("--out", default=C.PROCESSED_DIR)
    a = ap.parse_args()
    pts = apply_filters(load_raw(a.raw), C.BBOX)
    build(pts, a.out)


if __name__ == "__main__":
    main()
