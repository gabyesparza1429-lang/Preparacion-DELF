import os
import json
import re
import firebase_admin
from firebase_admin import credentials, firestore

# 1. Localización de credenciales de Firebase
key_path = "serviceAccountKey.json" if os.path.exists("serviceAccountKey.json") else "../serviceAccountKey.json"
if not firebase_admin._apps:
    if os.path.exists(key_path):
        cred = credentials.Certificate(key_path)
        firebase_admin.initialize_app(cred)
    else:
        firebase_admin.initialize_app()

db = firestore.client()

# 2. Leer archivos en la carpeta raíz
directorio_raiz = "../"
archivos = [f for f in os.listdir(directorio_raiz) if f.startswith("respaldo_") and f.endswith(".json")]

print(f"📦 Se encontraron {len(archivos)} archivos de respaldo local. Subiendo a Firestore...\n")

# 3. Borrar documentos con nomenclatura incorrecta en B1 (como Unitel)
docs_b1 = db.collection("BibliotecaEjercicios").document("B1").collection("Unidades").stream()
for d in docs_b1:
    if not re.match(r'^Unite_\d+$', d.id):
        d.ref.delete()
        print(f"🗑️ Eliminado documento mal nombrado: B1 ➔ {d.id}")

# 4. Procesar y fusionar cada respaldo local
for archivo in archivos:
    match = re.search(r'respaldo_([A-Z0-9]+)_Unite[_\-]?(\d+)', archivo, re.IGNORECASE)
    if not match:
        continue
    
    nivel = match.group(1).upper()
    num_unidad = match.group(2)
    id_unidad = f"Unite_{num_unidad}"

    ruta_completa = os.path.join(directorio_raiz, archivo)
    try:
        with open(ruta_completa, "r", encoding="utf-8") as f:
            datos = json.load(f)

        doc_ref = db.collection("BibliotecaEjercicios").document(nivel).collection("Unidades").document(id_unidad)
        doc_ref.set(datos, merge=True)
        print(f"✅ Sincronizado: Nivel {nivel} ➔ {id_unidad} desde {archivo}")
    except Exception as e:
        print(f"❌ Error al leer {archivo}: {e}")

# 5. Imprimir inventario final actualizado
print("\n" + "="*50)
print(" 🔍 INVENTARIO FINAL EN FIRESTORE")
print("="*50)

for lvl in ["A1", "A2", "B1", "B2", "C1"]:
    unidades_ref = db.collection("BibliotecaEjercicios").document(lvl).collection("Unidades").stream()
    docs = list(unidades_ref)
    if docs:
        print(f"\n📌 NIVEL {lvl}:")
        for doc in docs:
            data = doc.to_dict()
            co = len(data.get("CO", []))
            ce = len(data.get("CE", []))
            pe = len(data.get("PE", []))
            po = len(data.get("PO", []))
            print(f"  └─ Documento: {doc.id} -> CO: {co} | CE: {ce} | PE: {pe} | PO: {po}")
    else:
        print(f"\n⚪ NIVEL {lvl}: Sin unidades encontradas.")

print("\n" + "="*50)
