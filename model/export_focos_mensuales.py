"""
Dueño: P1 (Modelo)

Exporta los focos de Cochabamba agrupados por celda y por mes, ya armonizados
("equivalente VIIRS S-NPP"), para la Vista 3D.

Analogía: es como poner una cuadrícula encima del mapa y contar cuántos focos
cayeron en cada cuadrito cada mes. Cada cuadrito será una columna en 3D.

Reglas del CLAUDE.md que se respetan aquí:
  - Nunca se suman MODIS + VIIRS del mismo período (cada período usa un solo sensor).
  - Antes de 2012-01-20: MODIS x k_modis(mes). Período S-NPP: VIIRS S-NPP.
    Después del fin de S-NPP: NOAA-20 x k_noaa20(mes).
  - Filtros de confianza y type == 0.

Uso (desde model/):
    python export_focos_mensuales.py            # recomendado: desde daily_cells.csv (= calendario)
    python export_focos_mensuales.py --input ../data/processed/detections_cochabamba.csv   # alternativa

Entrada: CSV con columnas latitude, longitude, acq_date y (source) o (instrument, satellite).
Salida:  ../data/processed/focos_mensuales.json
"""

import argparse
import json
import os
import time

import pandas as pd

COCHABAMBA_BBOX = [-67.6, -18.6, -64.2, -15.6]  # lon_min, lat_min, lon_max, lat_max
SNPP_START_DATE = "2012-01-20"

SNPP_SATELLITE_CODES = {"N", "NPP", "SNPP", "S-NPP", "SUOMI NPP"}
NOAA20_SATELLITE_CODES = {"N20", "1", "J1", "NOAA-20", "NOAA20"}


def detect_source(row):
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
    return "OTRO"


def passes_scientific_filters(row, source):
    if "type" in row and pd.notna(row["type"]):
        if int(row["type"]) != 0:
            return False
    if "confidence" not in row or pd.isna(row["confidence"]):
        return True
    if source == "MODIS":
        try:
            return float(row["confidence"]) >= 30
        except ValueError:
            return False
    return str(row["confidence"]).strip().lower() in {"n", "h", "nominal", "high"}


def get_harmonized_weight(source, date_text, factors):
    month_key = str(int(date_text[5:7]))
    snpp_end_date = factors.get("snpp_end")
    is_before_snpp = date_text < SNPP_START_DATE
    is_after_snpp = snpp_end_date is not None and date_text > snpp_end_date
    if is_before_snpp:
        if source != "MODIS":
            return 0.0
        return float(factors.get("k_modis", {}).get(month_key, 1.0))
    if is_after_snpp:
        if source != "VIIRS_NOAA20":
            return 0.0
        return float(factors.get("k_noaa20", {}).get(month_key, 1.0))
    if source != "VIIRS_SNPP":
        return 0.0
    return 1.0


def snap_to_cell_center(value, cell_size):
    cell_index = int((value // cell_size))
    return round(cell_index * cell_size + cell_size / 2, 5)


def export_from_daily_cells(daily_cells_path, output_path):
    """Suma harm_n de daily_cells.csv por celda y mes.

    Es la forma recomendada: usa exactamente la misma serie armonizada que el calendario
    (incluye Terra->Terra+Aqua antes de 2002 y el relleno de días sin S-NPP), así que el
    calendario y el mapa 3D coinciden. Requiere que harmonize.py use celdas de 0.02°.
    """
    daily_cells = pd.read_csv(daily_cells_path)
    print(f"Celdas-día leídas: {len(daily_cells)}")
    with open(os.path.join(os.path.dirname(daily_cells_path), "metadata.json"), "r", encoding="utf-8") as metadata_file:
        cell_size = float(json.load(metadata_file)["cell_size_deg"])
    daily_cells["month"] = daily_cells["date"].str[:7]
    monthly = daily_cells.groupby(["lon", "lat", "month"], as_index=False)["harm_n"].sum()
    monthly = monthly.sort_values(["month", "lon", "lat"])
    records = [[round(float(row.lon), 5), round(float(row.lat), 5), row.month, round(float(row.harm_n), 2)]
               for row in monthly.itertuples(index=False)]
    output_document = {
        "metadata": {
            "sintetico": False,
            "armonizado": True,
            "unidad": "detecciones (equivalente VIIRS S-NPP)",
            "cellSizeDeg": cell_size,
            "formato": "records = [longitud_centro, latitud_centro, 'YYYY-MM', cantidad]",
            "origen": "suma mensual de daily_cells.csv (misma serie que el calendario)",
            "generado": time.strftime("%Y-%m-%d %H:%M"),
        },
        "records": records,
    }
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as output_file:
        json.dump(output_document, output_file)
    print(f"Listo: {len(records)} celdas-mes en {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Exporta focos mensuales por celda para la Vista 3D")
    parser.add_argument("--input", default=None,
                        help="(alternativa) CSV de detecciones; si no se da, se usa --daily-cells")
    parser.add_argument("--daily-cells", default="../data/processed/daily_cells.csv",
                        help="daily_cells.csv de harmonize.py (recomendado: coincide con el calendario)")
    parser.add_argument("--k-factors", default="../data/processed/k_factors.json")
    parser.add_argument("--output", default="../data/processed/focos_mensuales.json")
    parser.add_argument("--cell", type=float, default=0.02, help="Tamaño de celda en grados (0.02 ≈ 2,2 km)")
    arguments = parser.parse_args()

    if arguments.input is None:
        export_from_daily_cells(arguments.daily_cells, arguments.output)
        return

    if os.path.exists(arguments.k_factors):
        with open(arguments.k_factors, "r", encoding="utf-8") as factors_file:
            factors = json.load(factors_file)
        is_harmonized = True
    else:
        print("AVISO: no hay k_factors.json; se usa k = 1 (la serie NO queda armonizada)")
        factors = {}
        is_harmonized = False

    detections = pd.read_csv(arguments.input)
    print(f"Detecciones leídas: {len(detections)}")

    counts_by_cell_and_month = {}
    for _, row in detections.iterrows():
        row_dictionary = row.to_dict()
        longitude = float(row_dictionary["longitude"])
        latitude = float(row_dictionary["latitude"])
        is_inside = (COCHABAMBA_BBOX[0] <= longitude <= COCHABAMBA_BBOX[2]) and (COCHABAMBA_BBOX[1] <= latitude <= COCHABAMBA_BBOX[3])
        if not is_inside:
            continue
        source = detect_source(row_dictionary)
        if not passes_scientific_filters(row_dictionary, source):
            continue
        date_text = str(row_dictionary["acq_date"])[:10]
        weight = get_harmonized_weight(source, date_text, factors)
        if weight == 0:
            continue
        cell_longitude = snap_to_cell_center(longitude, arguments.cell)
        cell_latitude = snap_to_cell_center(latitude, arguments.cell)
        month_text = date_text[:7]
        key = (cell_longitude, cell_latitude, month_text)
        counts_by_cell_and_month[key] = counts_by_cell_and_month.get(key, 0.0) + weight

    records = []
    for (cell_longitude, cell_latitude, month_text), count in counts_by_cell_and_month.items():
        records.append([cell_longitude, cell_latitude, month_text, round(count, 2)])
    records.sort(key=lambda record: record[2])

    output_document = {
        "metadata": {
            "sintetico": False,
            "armonizado": is_harmonized,
            "unidad": "detecciones (equivalente VIIRS S-NPP)",
            "cellSizeDeg": arguments.cell,
            "formato": "records = [longitud_centro, latitud_centro, 'YYYY-MM', cantidad]",
            "generado": time.strftime("%Y-%m-%d %H:%M"),
        },
        "records": records,
    }
    os.makedirs(os.path.dirname(arguments.output), exist_ok=True)
    with open(arguments.output, "w", encoding="utf-8") as output_file:
        json.dump(output_document, output_file)
    print(f"Listo: {len(records)} celdas-mes en {arguments.output}")


if __name__ == "__main__":
    main()
