"""Sube metadatos y regiones a Firebase Firestore (dueño: P1 - Modelo).

Solo datos pequeños: el plan gratuito tiene cuotas diarias bajas de escritura.
Necesita la clave de una cuenta de servicio (Firebase Console > Configuración del proyecto >
Cuentas de servicio > Generar nueva clave privada) guardada como serviceAccount.json en la raíz
(ignorado por git), o la variable GOOGLE_APPLICATION_CREDENTIALS.

    pip install firebase-admin
    python upload_firestore.py [--data processed|sample]
"""
import argparse
import json
import os

import firebase_admin
from firebase_admin import credentials, firestore

import config as C


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="processed", choices=["processed", "sample"])
    a = ap.parse_args()
    key = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS") or os.path.join(C.ROOT, "serviceAccount.json")
    firebase_admin.initialize_app(credentials.Certificate(key))
    db = firestore.client()

    meta_path = os.path.join(C.DATA, a.data, "metadata.json")
    with open(meta_path, encoding="utf-8") as f:
        db.collection("meta").document("harmonization").set(json.load(f))
    with open(C.REGIONS_FILE, encoding="utf-8") as f:
        regions = json.load(f)
    for r in regions:
        db.collection("regions").document(r["id"]).set({"name": r["name"], "bbox": r["bbox"]})
    print(f"Firestore: meta/harmonization + {len(regions)} regiones")


if __name__ == "__main__":
    main()
