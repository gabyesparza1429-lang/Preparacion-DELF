import firebase_admin
from firebase_admin import firestore
import json

if not firebase_admin._apps:
    firebase_admin.initialize_app()

db = firestore.client()

print("🔍 ANALIZANDO ACTIVIDADES DE INTERACCIÓN EN FIRESTORE...\n")

# 1. Revisar colección BibliotecaEjercicios
niveles = ["A1", "A2", "B1", "B2", "C1"]
for lvl in niveles:
    doc = db.collection("BibliotecaEjercicios").document(lvl).get()
python3 revisar_interacciones.py && rm revisar_interacciones.py.get('consigna', '')))[:120]}...\n") '')))[:120]}...\n")):
🔍 ANALIZANDO ACTIVIDADES DE INTERACCIÓN EN FIRESTORE...

gabyesparza1429@cloudshell:~/Preparacion-DELF/functions (objectif-reussite-delf)$ 

cat << 'EOF' > fix_todas_interacciones.py
import firebase_admin
from firebase_admin import firestore
import json

if not firebase_admin._apps:
    firebase_admin.initialize_app()

db = firestore.client()

print("🔄 Actualizando ejercicios de Exercice d'interaction...")

# Consignas oficiales del manual B1
INTERACCIONES_CORRECTAS = [
    {
        "actividad": 1,
        "titulo": "Voyage en bus",
        "tipo": "oral_interaction",
        "texto_lectura": "Vous êtes en France. Vous prenez le bus pour aller à l'aéroport. En montant dans le bus, vous vous rendez compte que vous n'avez pas acheté le bon ticket. Vous expliquez la situation au contrôleur mais ce dernier veut vous faire payer une amende. Vous essayez de le convaincre de ne pas le faire.\n\nL'examinateur/L'examinatrice joue le rôle du contrôleur."
    },
    {
        "actividad": 2,
        "titulo": "Achat d'un vêtement",
        "tipo": "oral_interaction",
        "texto_lectura": "Vous achetez un vêtement dans un magasin en France. En rentrant chez vous, vous remarquez un défaut. Vous retournez au magasin pour demander un échange ou un remboursement. Le vendeur hésite.\n\nL'examinateur/L'examinatrice joue le rôle du vendeur."
    },
    {
        "actividad": 3,
        "titulo": "Inscription au club de sport",
        "tipo": "oral_interaction",
        "texto_lectura": "Vous voulez vous inscrire dans un club de sport. Vous vous renseignez sur les horaires, les tarifs et les services disponibles. Vous négociez une réduction étudiants ou famille.\n\nL'examinateur/L'examinatrice joue le rôle du responsable du club."
    }
]

# 1. Corregir BibliotecaEjercicios para nivel B1
doc_ref = db.collection("BibliotecaEjercicios").document("B1")
doc = doc_ref.get()

if doc.exists:
    data = doc.to_dict()
    raw_val = data.get("Valor", "")
    if raw_val:
        content = json.loads(raw_val) if isinstance(raw_val, str) else raw_val
        units = content if isinstance(content, list) else content.get("Unidades", [])
        
        for u in units:
            po_list = u.get("PO", []) or u.get("po", [])
            for act in po_list:
                if act.get("tipo") == "oral_interaction" or "interaction" in str(act.get("seccion", "")).lower():
                    idx = act.get("actividad", 1) - 1
                    if 0 <= idx < len(INTERACCIONES_CORRECTAS):
                        act.update(INTERACCIONES_CORRECTAS[idx])
        
        nuevo_val = json.dumps(content, ensure_ascii=False) if isinstance(raw_val, str) else content
        doc_ref.set({"Valor": nuevo_val}, merge=True)
        print("✅ BibliotecaEjercicios (B1) actualizada correctamente.")

# 2. Corregir colección individual 'ejercicios' si existe
query = db.collection("ejercicios").where("habilidad", "==", "PO").stream()
for doc in query:
    d = doc.to_dict()
    if d.get("tipo") == "oral_interaction" or "interaction" in str(doc.id).lower():
        act_num = d.get("actividad", 1)
        idx = act_num - 1
        if 0 <= idx < len(INTERACCIONES_CORRECTAS):
            doc.reference.update({
                "titulo": INTERACCIONES_CORRECTAS[idx]["titulo"],
                "texto_lectura": INTERACCIONES_CORRECTAS[idx]["texto_lectura"],
                "consigna": INTERACCIONES_CORRECTAS[idx]["texto_lectura"],
                "instrucciones": INTERACCIONES_CORRECTAS[idx]["texto_lectura"]
            })
            print(f"✅ Ejercicio individual '{doc.id}' corregido.")

print("✨ Proceso completado exitosamente.")
