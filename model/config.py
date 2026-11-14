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

CELL_DEG = 0.1                 # tamaño de celda de agregación
VIIRS_START = "2012-01-20"     # primer día de VIIRS S-NPP en FIRMS

# Años para validar la armonización (entrenar en uno, probar en otro)
TRAIN_YEARS = (2012, 2018)
TEST_FROM_YEAR = 2019

# Filtros de calidad
MODIS_MIN_CONF = 30
VIIRS_CONF_OK = {"n", "h"}     # nominal, high (se descarta low)

# Límites para el factor k (evita valores absurdos en meses con muy pocas detecciones)
K_MIN, K_MAX = 0.5, 20.0
