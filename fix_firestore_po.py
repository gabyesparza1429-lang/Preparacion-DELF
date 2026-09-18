import json
import firebase_admin
from firebase_admin import credentials, firestore

if not firebase_admin._apps:
    cred = credentials.Certificate('serviceAccountKey.json')
    firebase_admin.initialize_app(cred)

db = firestore.client()

# Cargar respaldo local de PO Unidad 2
with open('respaldo_B1_Unite_2_PO.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

po_list = data.get('PO', [])

# Estandarizar los 20 ejercicios en el formato exacto que requiere la interfaz
for idx, item in enumerate(po_list):
    item['habilidad'] = 'PO'
    if idx < 4:
        item['tipo'] = 'oral_monologue'
    else:
        item['tipo'] = 'oral_interaction'

# Actualizar el documento Unite_2 en Firestore
doc_ref = db.collection('BibliotecaEjercicios').document('B1').collection('Unidades').document('Unite_2')
doc_ref.update({'PO': po_list})

print(f"✅ Se actualizaron exitosamente {len(po_list)} actividades en Firestore.")
