import os
import firebase_admin
from firebase_admin import credentials, firestore

key_path = "functions/serviceAccountKey.json" if os.path.exists("functions/serviceAccountKey.json") else "serviceAccountKey.json"
if not firebase_admin._apps:
    if os.path.exists(key_path):
        cred = credentials.Certificate(key_path)
        firebase_admin.initialize_app(cred)
    else:
        firebase_admin.initialize_app()

db = firestore.client()

interacciones_b1 = [
    {
        "habilidad": "PO",
        "tipo": "oral_interaction",
        "instruccion": "Activité 1 : Voyage en bus",
        "texto_lectura": "Vous êtes en France. Vous prenez le bus pour aller à l'aéroport. En montant dans le bus, vous vous rendez compte que vous n'avez pas acheté le bon ticket. Vous expliquez la situation au contrôleur mais ce dernier veut vous faire payer une amende. Vous essayez de le convaincre de ne pas le faire.\n\nL'examinateur/L'examinatrice joue le rôle du contrôleur.",
        "ruta_audio": "Bonjour, vous m'expliquez ce qui se passe avec votre ticket ?"
    },
    {
        "habilidad": "PO",
        "tipo": "oral_interaction",
        "instruccion": "Activité 2 : Concours de cuisine",
        "texto_lectura": "Vous participez à un concours de cuisine en France. Vous vous rendez compte que vous n'avez pas tous les ingrédients n�cessaires. Vous expliquez la situation à l'organisateur du concours qui veut vous disqualifier. Vous tentez de le convaincre de ne pas le faire et vous proposez des solutions.\n\nL'examinateur/L'examinatrice joue le rôle de l'organisateur.",
        "ruta_audio": "Bonjour, pourquoi n'avez!vous pas tous vos ingrédients ?"
    },
    {
        "habilidad": "PO",
        "tipo": "oral_interaction",
        "instruccion": "Activité 3 : Chambre partagée",
        "texto_lectura": "Vous avez prævu un voyage en France avec un(e) ami(e) français(e). Pour faire des économies, vous proposez de partager une seule chambre d'hôtel, mais votre ami(e) préfère avoir sa propre chambre. Vous essayez de le/la convaincre.\n\nL'examinateur/L'examinatrice joue le rôle de votre ami(e).",
        "ruta_audio": "Je préfère qu'on prenne deux chambres séparées, c'est plus comfortable non ?"
    }
]

unidades_ref = db.collection("BibliotecaEjercicios").document("B1").collection("Unidades")
docs = list(unidades_ref.stream())

for doc in docs:
    data = doc.to_dict()
    po_actual = data.get("PO", [])
    monologos = [act for act in po_actual if act.get("tipo") != "oral_interaction"]
    nueva_lista_po = interacciones_b1 + monologos
    doc.reference.update({"PO": nueva_lista_po})
    print(f"�)� Unidad {doc.id} reestructurada correctamente en B1.")

print("\nP🎣 Proceso completado exitosamente.")