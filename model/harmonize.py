"""Pipeline de armonización MODIS + VIIRS (dueño: P1 - Modelo).

Lee todos los CSV de FIRMS que haya en data/raw/ (descarga por país, por API o del archivo),
los estandariza, filtra, agrega en celdas de 0.1° por día y genera una serie armonizada en
"equivalente VIIRS S-NPP". Escribe el formato de docs/DATA.md en data/processed/.

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

_PLATFORM_MAP = {
    "TERRA": "Terra", "T": "Terra",
    "AQUA": "Aqua", "A": "Aqua",
    "N": "SNPP", "NPP": "SNPP", "SNPP": "SNPP", "SUOMI NPP": "SNPP", "SUOMI-NPP": "SNPP",
    "N20": "NOAA20", "1": "NOAA20", "NOAA-20": "NOAA20", "NOAA20": "NOAA20", "J1": "NOAA20", "JPSS1": "NOAA20",
    "N21": "NOAA21", "2": "NOAA21", "NOAA-21": "NOAA21", "NOAA21": "NOAA21", "J2": "NOAA21", "JPSS2": "NOAA21",
}


# ---------------------------------------------------------------- lectura
def _platform_from_name(fname):
    """Pista por nombre de archivo cuando falta la columna `satellite`."""
    f = fname.lower()
    if "noaa21" in f or "jpss2" in f:
        return "NOAA21"
    if "noaa20" in f or "jpss1" in f:
        return "NOAA20"
    if "snpp" in f or "suomi" in f:
        return "SNPP"
    return "unknown"


def standardize(df, fname):
    """Convierte un CSV de FIRMS (MODIS o VIIRS, archivo o NRT) al esquema común."""
    cols = set(df.columns)
    is_viirs = "bright_ti4" in cols
    out = pd.DataFrame(index=df.index)
    out["sensor"] = "VIIRS" if is_viirs else "MODIS"
    if "satellite" in cols:
        sat = df["satellite"].astype(str).str.strip().str.upper()
        out["platform"] = sat.map(_PLATFORM_MAP).fillna(_platform_from_name(fname))
    else:
        out["platform"] = _platform_from_name(fname)
    out["latitude"] = pd.to_numeric(df["latitude"], errors="coerce")
    out["longitude"] = pd.to_numeric(df["longitude"], errors="coerce")
    out["acq_date"] = pd.to_datetime(df["acq_date"]).dt.strftime("%Y-%m-%d")
    out["acq_time"] = pd.to_numeric(df["acq_time"], errors="coerce").fillna(0).astype(int).astype(str).str.zfill(4)
    if is_viirs:  # archivo: n/h/l ; NRT: nominal/high/low
        out["confidence"] = df["confidence"].astype(str).str.strip().str.lower().str[0]
    else:
        out["confidence"] = pd.to_numeric(df["confidence"], errors="coerce").astype("Int64").astype(str)
    out["frp"] = pd.to_numeric(df["frp"], errors="coerce") if "frp" in cols else np.nan
    out["daynight"] = df["daynight"].astype(str) if "daynight" in cols else ""
    out["type"] = pd.to_numeric(df["type"], errors="coerce") if "type" in cols else np.nan
    return out[STD_COLS].dropna(subset=["latitude", "longitude"])


def load_raw(raw_dir):
    frames = []
    for path in sorted(glob.glob(os.path.join(raw_dir, "**", "*.csv"), recursive=True)):
        df = pd.read_csv(path, dtype={"satellite": str, "confidence": str, "acq_time": str})
        if df.empty or "latitude" not in df.columns:
            continue
        frames.append(standardize(df, os.path.basename(path)))
        print(f"  leído {os.path.relpath(path, raw_dir)}: {len(df):,} filas", flush=True)
    if not frames:
        raise SystemExit(f"No hay CSV de FIRMS en {raw_dir}. Ver model/README.md")
    return pd.concat(frames, ignore_index=True)


# ---------------------------------------------------------------- filtros
def _static_key(lat, lon):
    return (np.round(lat, 2).astype(str) + "," + np.round(lon, 2).astype(str))


def apply_filters(pts, bbox):
    n0 = len(pts)
    minx, miny, maxx, maxy = bbox
    pts = pts[pts.longitude.between(minx, maxx) & pts.latitude.between(miny, maxy)]
    is_m = pts.sensor == "MODIS"
    conf_num = pd.to_numeric(pts.confidence.where(is_m), errors="coerce")
    ok_m = is_m & (conf_num >= C.MODIS_MIN_CONF)
    ok_v = (~is_m) & pts.confidence.isin(C.VIIRS_CONF_OK)
    pts = pts[ok_m | ok_v]
    n1 = len(pts)

    # `type`: 0 vegetación presunta, 1 volcán, 2 otra fuente fija, 3 costa afuera.
    # Los NRT no traen `type`: se quitan si caen donde el archivo marcó una fuente no vegetal (~1 km).
    non_veg = pts["type"].notna() & (pts["type"] != 0)
    static = set(_static_key(pts.latitude[non_veg], pts.longitude[non_veg]))
    no_type = pts["type"].isna()
    in_static = pd.Series(False, index=pts.index)
    if static and no_type.any():
        in_static[no_type] = _static_key(pts.latitude[no_type], pts.longitude[no_type]).isin(static)
    pts = pts[~non_veg & ~in_static]
    n2 = len(pts)

    # duplicados (p. ej. archivo SP + NRT del mismo día): misma plataforma, hora y píxel (~100 m)
    key = pd.DataFrame({"p": pts.platform, "d": pts.acq_date, "t": pts.acq_time,
                        "y": pts.latitude.round(3), "x": pts.longitude.round(3)})
    pts = pts[~key.duplicated()]
    print(f"  filtros: {n0:,} -> {n1:,} (área+confianza) -> {n2:,} (type/fuentes fijas: "
          f"{int(non_veg.sum()):,} con type!=0, {int(in_static.sum()):,} NRT en fuentes fijas) "
          f"-> {len(pts):,} (sin duplicados)", flush=True)
    return pts.reset_index(drop=True)


# ---------------------------------------------------------------- recorte de salida
def _output_area_mask():
    """Devuelve f(lon, lat) -> máscara booleana del área de salida (Cochabamba).
    Usa el polígono departamental si hay shapely; si no, el rectángulo COCHABAMBA_BBOX."""
    try:
        from shapely import contains_xy
        from shapely.geometry import shape
        with open(C.OUTPUT_AREA_FILE, "r", encoding="utf-8") as f:
            zones = json.load(f)
        feature = next(z for z in zones["features"] if z["properties"]["id"] == C.OUTPUT_AREA_ZONE_ID)
        area = shape(feature["geometry"]).buffer(C.OUTPUT_AREA_MARGIN_DEG)
        print(f"  recorte de salida: polígono '{C.OUTPUT_AREA_ZONE_ID}' + {C.OUTPUT_AREA_MARGIN_DEG}°", flush=True)
        return lambda lon, lat: contains_xy(area, np.asarray(lon, float), np.asarray(lat, float))
    except (ImportError, OSError, StopIteration) as error:
        minx, miny, maxx, maxy = C.COCHABAMBA_BBOX
        print(f"  recorte de salida: rectángulo COCHABAMBA_BBOX ({error})", flush=True)
        return lambda lon, lat: (np.asarray(lon) >= minx) & (np.asarray(lon) <= maxx) & \
                                (np.asarray(lat) >= miny) & (np.asarray(lat) <= maxy)


# ---------------------------------------------------------------- armonización
def _cell(v):
    return np.round((np.floor(v / C.CELL_DEG) + 0.5) * C.CELL_DEG, 3)


def _ratio_by_month(num, den, months, min_den=20):
    """k[m] = suma(num)/suma(den) por mes del año, con respaldo global y límites."""
    df = pd.DataFrame({"num": np.asarray(num, float), "den": np.asarray(den, float), "m": np.asarray(months)})
    g = df.groupby("m")[["num", "den"]].sum()
    total = df.num.sum() / df.den.sum() if df.den.sum() > 0 else 1.0
    k = {}
    for m in range(1, 13):
        if m in g.index and g.loc[m, "den"] >= min_den:   # mínimo de detecciones para confiar
            k[m] = g.loc[m, "num"] / g.loc[m, "den"]
        else:
            k[m] = total
        k[m] = float(np.clip(k[m], C.K_MIN, C.K_MAX))
    return k


def _validate(obs, raw, months, years, train, test_from):
    """Calibra k en `train`, aplica a `test_from`+ y compara con lo observado (totales mensuales)."""
    tr = years.between(*train)
    te = years >= test_from
    if not tr.any() or not te.any():
        return None
    k_tr = _ratio_by_month(obs[tr], raw[tr], months[tr])
    pred = raw[te] * months[te].map(k_tr)
    o = obs[te]
    return {
        "train": f"{train[0]}-{train[1]}",
        "test": f"{test_from}-{int(years[te].max())}",
        "unit": "detecciones VIIRS S-NPP por mes en toda el área",
        "n_months": int(te.sum()),
        "mae_harmonized": round(float((pred - o).abs().mean()), 1),
        "mae_naive": round(float((raw[te] - o).abs().mean()), 1),
        "bias_harmonized_pct": round(float(100 * (pred.sum() - o.sum()) / o.sum()), 1) if o.sum() else None,
        "corr": round(float(np.corrcoef(pred, o)[0, 1]), 3) if te.sum() > 2 else None,
    }


def build(pts, out_dir, is_sample=False):
    os.makedirs(os.path.join(out_dir, "points"), exist_ok=True)
    pts = pts.copy()
    pts["clat"] = _cell(pts.latitude)
    pts["clon"] = _cell(pts.longitude)

    # ---- conteos diarios por celda y plataforma
    is_m = pts.sensor == "MODIS"
    pts["grp"] = np.select(
        [is_m & (pts.platform == "Terra"), is_m, pts.platform == "SNPP", pts.platform == "NOAA20"],
        ["terra", "aqua", "snpp", "n20"], "other_viirs")   # MODIS sin plataforma conocida cuenta como Aqua
    cnt = (pts.groupby(["acq_date", "clat", "clon", "grp"]).size()
              .unstack("grp", fill_value=0).reset_index())
    for c in ["terra", "aqua", "snpp", "n20"]:
        if c not in cnt:
            cnt[c] = 0
    cnt["modis"] = cnt.terra + cnt.aqua
    dt = pd.to_datetime(cnt.acq_date)
    cnt["month"] = dt.dt.month
    cnt["year"] = dt.dt.year

    def _last(col):
        d = cnt.loc[cnt[col] > 0, "acq_date"]
        return d.max() if len(d) else None

    def _first(col):
        d = cnt.loc[cnt[col] > 0, "acq_date"]
        return d.min() if len(d) else None

    snpp_end, modis_end, n20_start = _last("snpp"), _last("modis"), _first("n20")
    aqua_start = _first("aqua")

    # ---- totales diarios del área: para detectar días sin datos de un sensor
    day = cnt.groupby("acq_date")[["terra", "aqua", "modis", "snpp", "n20"]].sum()
    dday = pd.to_datetime(day.index)
    day["month"], day["year"] = dday.month, dday.year
    in_snpp_era = (day.index >= C.VIIRS_START) & (day.index <= (snpp_end or ""))
    # día con S-NPP caído: S-NPP no ve nada en todo el país y otro sensor sí ve varios focos
    snpp_gap = in_snpp_era & (day.snpp == 0) & ((day.n20 >= C.GAP_MIN) | (day.modis >= C.GAP_MIN))
    n20_gap = (day.index > (snpp_end or "9999")) & (day.n20 == 0) & (day.modis >= C.GAP_MIN)
    gap_days_snpp = set(day.index[snpp_gap])
    gap_days_n20 = set(day.index[n20_gap])

    # ---- totales mensuales del área (la calibración se hace a nivel regional, no por celda)
    ok = day[~snpp_gap]
    mon = ok.groupby(["year", "month"])[["terra", "aqua", "modis", "snpp", "n20"]].sum().reset_index()
    mdate = pd.to_datetime(dict(year=mon.year, month=mon.month, day=1))

    # 0) Terra sola -> Terra+Aqua (antes de que Aqua empiece, 2002-07): a(mes) con 2003 hasta VIIRS
    both = mon[(mdate >= "2003-01-01") & (mdate < C.VIIRS_START[:7] + "-01")]
    a_aqua = _ratio_by_month(both.modis, both.terra, both.month) if len(both) else {m: 1.0 for m in range(1, 13)}

    # 1) MODIS -> VIIRS S-NPP: meses completos de solapamiento, hasta el fin de cualquiera de los dos
    vs = pd.Timestamp(C.VIIRS_START)
    ov_end = min(pd.Timestamp(snpp_end or "1900-01-01"), pd.Timestamp(modis_end or "1900-01-01"))
    ov = mon[(mdate >= vs.replace(day=1) + pd.offsets.MonthBegin(1)) & (mdate < ov_end.replace(day=1))
             & (mon.snpp > 0)].reset_index(drop=True)
    k = _ratio_by_month(ov.snpp, ov.modis, ov.month)
    validation = _validate(ov.snpp, ov.modis, ov.month, ov.year, C.TRAIN_YEARS, C.TEST_FROM_YEAR)

    # 2) NOAA-20 -> S-NPP (para seguir la serie cuando S-NPP deja de dar datos)
    ov2 = mon[(mon.snpp > 0) & (mon.n20 > 0) & (mdate < pd.Timestamp(snpp_end or "1900-01-01").replace(day=1))]
    ov2 = ov2.reset_index(drop=True)
    if len(ov2):
        k20 = _ratio_by_month(ov2.snpp, ov2.n20, ov2.month)
        yrs = sorted(ov2.year.unique())
        mid = yrs[len(yrs) // 2] if len(yrs) > 1 else None
        validation_n20 = (_validate(ov2.snpp, ov2.n20, ov2.month, ov2.year, (yrs[0], mid - 1), mid)
                          if mid else None)
    else:
        k20, validation_n20 = {m: 1.0 for m in range(1, 13)}, None

    # ---- serie armonizada en "equivalente VIIRS S-NPP"
    d = cnt.acq_date
    km = cnt.month.map(k)
    modis_eq = np.where(d < (aqua_start or ""), cnt.terra * cnt.month.map(a_aqua), cnt.modis) * km
    n20_eq = cnt.n20 * cnt.month.map(k20)
    pre = d < C.VIIRS_START
    post = d > (snpp_end or "9999")
    gap_s = d.isin(gap_days_snpp)
    gap_n = d.isin(gap_days_n20)
    # en un día con S-NPP caído se usa NOAA-20 si ese día tiene datos, si no MODIS
    n20_day = d.map(day.n20) >= C.GAP_MIN
    use_n20 = (post & ~gap_n) | (gap_s & n20_day)
    use_modis = pre | gap_n | (gap_s & ~n20_day)
    cnt["harm_n"] = np.where(use_modis, modis_eq, np.where(use_n20, n20_eq, cnt.snpp))
    cnt["source"] = np.where(use_modis, "modis_scaled", np.where(use_n20, "viirs_noaa20_scaled", "viirs"))
    cnt["viirs_n"] = np.where(use_n20 | post, cnt.n20, cnt.snpp)

    out = cnt[cnt.harm_n > 0].rename(columns={"acq_date": "date", "clat": "lat", "clon": "lon",
                                              "modis": "modis_n"})
    out["harm_n"] = out.harm_n.round(3)
    out = out[["date", "lat", "lon", "modis_n", "viirs_n", "harm_n", "source"]].sort_values(["date", "lat", "lon"])
    in_output_area = _output_area_mask()
    out = out[in_output_area(out.lon, out.lat)]
    out.to_csv(os.path.join(out_dir, "daily_cells.csv"), index=False)

    # ---- serie mensual del área: cruda vs armonizada (gráfico "antes/después" del pitch)
    cnt["ym"] = cnt.acq_date.str[:7]
    ms = cnt.groupby("ym").agg(modis_raw=("modis", "sum"), snpp_raw=("snpp", "sum"),
                               noaa20_raw=("n20", "sum"), harmonized=("harm_n", "sum")).reset_index()
    ms = ms.rename(columns={"ym": "month"})
    ms["harmonized"] = ms.harmonized.round(1)
    ms.to_csv(os.path.join(out_dir, "monthly_series.csv"), index=False)

    # ---- focos individuales por año (para la descarga CSV)
    pcols = ["sensor", "platform", "latitude", "longitude", "acq_date", "acq_time", "confidence", "frp", "daynight"]
    for old in glob.glob(os.path.join(out_dir, "points", "*.csv")):
        os.remove(old)
    pts = pts[in_output_area(pts.longitude, pts.latitude)].copy()
    pts["year"] = pts.acq_date.str[:4]
    for y, g in pts.groupby("year"):
        g.sort_values(["acq_date", "acq_time"])[pcols].to_csv(
            os.path.join(out_dir, "points", f"{y}.csv"), index=False)

    meta = {
        "version": datetime.now().strftime("%Y-%m-%dT%H:%M"),
        "is_sample": is_sample,
        "cell_size_deg": C.CELL_DEG,
        "bbox": C.BBOX,
        "calibration_area": "Bolivia (bbox)",
        "output_area": "Departamento de Cochabamba (zona 'depto' + margen)",
        "viirs_start": C.VIIRS_START,
        "snpp_end": snpp_end,
        "modis_end": modis_end,
        "aqua_start": aqua_start,
        "noaa20_start": n20_start,
        "date_min": out.date.min(),
        "date_max": out.date.max(),
        "unit": "detecciones equivalentes a VIIRS S-NPP (375 m)",
        "method": ("Antes de 2012-01-20: MODIS x k(mes), con k = suma VIIRS S-NPP / suma MODIS por mes del año "
                   "en el período de solapamiento (antes de que existiera Aqua, Terra x a(mes) para equivaler a "
                   "Terra+Aqua). 2012-01-20 en adelante: VIIRS S-NPP. Después del fin de S-NPP, y en los días "
                   "en que S-NPP no tiene datos: NOAA-20 x k20(mes) calibrado contra S-NPP (o MODIS x k si "
                   "tampoco hay NOAA-20). Nunca se suman MODIS y VIIRS."),
        "coefficients_by_month": {str(m): round(v, 3) for m, v in k.items()},
        "noaa20_coefficients_by_month": {str(m): round(v, 3) for m, v in k20.items()},
        "terra_to_terra_aqua_by_month": {str(m): round(v, 3) for m, v in a_aqua.items()},
        "validation": validation,
        "validation_noaa20": validation_n20,
        "gap_days": {"snpp_filled": len(gap_days_snpp), "noaa20_filled": len(gap_days_n20),
                     "min_detections": C.GAP_MIN},
        "n_detections": {"modis": int(cnt.modis.sum()), "snpp": int(cnt.snpp.sum()), "noaa20": int(cnt.n20.sum())},
        "filters": {"modis_min_confidence": C.MODIS_MIN_CONF, "viirs_confidence": sorted(C.VIIRS_CONF_OK),
                    "type": "0 (vegetación) cuando existe la columna; los NRT sin type se quitan si caen "
                            "en un píxel (~1 km) que el archivo marcó como volcán o fuente fija"},
    }
    with open(os.path.join(out_dir, "metadata.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    # ---- k_factors.json (contrato docs/DATA_GAMC.md): lo usan export_focos_mensuales.py y el servidor
    k_factors = {
        "sintetico": is_sample,
        "descripcion": "Factores k(mes) calibrados en el período de solapamiento (ver metadata.json)",
        "k_modis": meta["coefficients_by_month"],
        "k_noaa20": meta["noaa20_coefficients_by_month"],
        "snpp_end": snpp_end,
        "generado": meta["version"],
    }
    with open(os.path.join(out_dir, "k_factors.json"), "w", encoding="utf-8") as f:
        json.dump(k_factors, f, ensure_ascii=False, indent=2)

    # ---- detecciones filtradas de Cochabamba, con `source` para gamc_tag.py y export_focos_mensuales.py
    cbba = pts.copy()   # ya recortado al departamento de Cochabamba
    cbba["source"] = np.select(
        [cbba.sensor == "MODIS", cbba.platform == "SNPP", cbba.platform == "NOAA20", cbba.platform == "NOAA21"],
        ["MODIS", "VIIRS_SNPP", "VIIRS_NOAA20", "VIIRS_NOAA21"], "VIIRS_DESCONOCIDO")
    cbba.sort_values(["acq_date", "acq_time"])[["source"] + pcols].to_csv(
        os.path.join(out_dir, "detections_cochabamba.csv"), index=False)

    print(f"  escrito {out_dir}: {len(out):,} filas celda-día, {len(cbba):,} focos en Cochabamba", flush=True)
    print(f"  k(mes) = {meta['coefficients_by_month']}")
    print(f"  k20(mes) = {meta['noaa20_coefficients_by_month']}")
    print(f"  a(mes) Terra->Terra+Aqua = {meta['terra_to_terra_aqua_by_month']}")
    print(f"  días rellenados: {meta['gap_days']}")
    print(f"  validación MODIS->VIIRS: {validation}")
    print(f"  validación NOAA-20->S-NPP: {validation_n20}")
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
