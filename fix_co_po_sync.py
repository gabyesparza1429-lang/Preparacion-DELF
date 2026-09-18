import firebase_admin
from firebase_admin import credentials, firestore

if not firebase_admin._apps:
    cred = credentials.Certificate('serviceAccountKey.json')
    firebase_admin.initialize_app(cred)

db = firestore.client()

# Normalizar arreglos PO en todas las unidades B1
for unit in ['Unite_1', 'Unite_2', 'Unite_3']:
    ref = db.collection('BibliotecaEjercicios').document('B1').collection('Unidades').document(unit)
    doc = ref.get()
    if doc.exists:
        data = doc.to_dict()
        po_data = data.get('PO') or data.get('po') or []
        if po_data:
            for idx, item in enumerate(po_data):
                item['habilidad'] = 'PO'
                if 'instruccion' not in item and 'texto_lectura' in item:
                    item['instruccion'] = item['texto_lectura']
            ref.update({'PO': po_data})
            print(f"✅ PO normalizado en {unit} ({len(po_data)} actividades)")
        else:
            print(f"⚠️ No se encontró lista PO en {unit}")

