"""Configuración compartida del pipeline (dueño: P1 - Modelo)."""
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA = os.path.join(ROOT, "data")
RAW_DIR = os.path.join(DATA, "raw")
PROCESSED_DIR = os.path.join(DATA, "processed")
SAMPLE_DIR = os.path.join(DATA, "sample")
REGIONS_FILE = os.path.join(DATA, "regions.json")

# Bolivia: [minLon, minLat, maxLon, maxLat]
BBOX = [-69.7, -22.95, -57.4, -9.6]
# Departamento de Cochabamba (docs/DATA_GAMC.md): recorte para gamc_tag.py y export_focos_mensuales.py
COCHABAMBA_BBOX = [-67.6, -18.6, -64.2, -15.6]

# Recorte de los archivos de salida: la calibración usa toda Bolivia (más datos = k más robusto),
# pero la app solo muestra Cochabamba. Se guarda lo que cae dentro del límite departamental
# (zona "depto" de cochabamba_zones.geojson) más un margen para no cortar celdas del borde.
OUTPUT_AREA_FILE = os.path.join(DATA, "zones", "cochabamba_zones.geojson")
OUTPUT_AREA_ZONE_ID = "depto"
OUTPUT_AREA_MARGIN_DEG = 0.05

CELL_DEG = 0.02                # tamaño de celda de agregación (~2 km, igual que el mapa 3D; zonas angostas como el Tunari)
VIIRS_START = "2012-01-20"     # primer día de VIIRS S-NPP en FIRMS

# Años para validar la armonización (entrenar en uno, probar en otro)
TRAIN_YEARS = (2012, 2018)
TEST_FROM_YEAR = 2019

# Filtros de calidad
MODIS_MIN_CONF = 30
VIIRS_CONF_OK = {"n", "h"}     # nominal, high (se descarta low)

# Límites para el factor k (evita valores absurdos en meses con muy pocas detecciones)
K_MIN, K_MAX = 0.5, 20.0

# Día "sin datos" de un sensor: no ve nada en toda el área mientras otro sensor ve al menos GAP_MIN focos
GAP_MIN = 5
