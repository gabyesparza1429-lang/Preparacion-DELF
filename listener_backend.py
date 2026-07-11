import time
import json
import os
import google.generativeai as genai
import firebase_admin
from firebase_admin import credentials, firestore

# 1. Inicializar Firebase Admin SDK (Asegúrate de colocar tu archivo firebase.json en la raíz)
cred = credentials.Certificate("firebase.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

# 2. Configurar la API de Gemini
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

def evaluar_con_rubrica_dinamica(nivel, tipo_prueba, texto_alumno, nombre_alumno):
    """
    Carga el archivo JSON específico desde la carpeta rubricas/ y procesa con Gemini 1.5 Pro
    """
    ruta_rubrica = f"rubricas/{nivel}_{tipo_prueba}.json"
    
    if not os.path.exists(ruta_rubrica):
        print(f"[-] Error crítico: No se encontró la rúbrica del nivel en {ruta_rubrica}")
        return None
        
    with open(ruta_rubrica, "r", encoding="utf-8") as f:
        criterios_oficiales = json.load(f)
        
    # Inyección estricta de las reglas del CECRL en las instrucciones del sistema
    system_instruction = f"""
    Eres una examinadora nativa y certificada del DELF/DALF (France Éducation International).
    Tu único objetivo es evaluar de forma estricta y profesional la producción de los alumnos.
    
    Debes seguir rigurosamente los siguientes criterios oficiales, reglas de penalización y referenciales gramaticales del nivel:
    {json.dumps(criterios_oficiales, ensure_ascii=False, indent=2)}
    
    Emite tu veredicto con el mismo rigor que un corrector humano oficial del CECRL.
    """

    # Estructuras de respuesta compatibles con los botones e interfaz de alumno.html
    if tipo_prueba == "PE":
        estructura_json_esperada = {
            "score_global": "Nota final (ej. 17.5/25)",
            "status": "Admis / Non admis / Niveau Supra",
            "texto_html": "El texto original manteniendo los párrafos intactos, envolviendo CADA error léxico, ortográfico o gramatical en etiquetas html: <span class='sophia-error' data-rubric='[realisation, coherence, adequation, lexique o morphosyntaxe]'>palabra_o_frase_errónea</span>.",
            "rubriques": {
                "realisation": {"score": "Nota", "error": "Análisis detallado en francés de fallos o aciertos respecto a la consigne", "supra": "Consejo avanzado en francés"},
                "coherence": {"score": "Nota", "error": "Evaluación en francés de conectores y lógica", "supra": "Consejo técnico avanzado"},
                "adequation": {"score": "Nota", "error": "Errores de registro o fórmulas de saludo/despedida", "supra": "Consejo técnico avanzado"},
                "lexique": {"score": "Nota", "error": "Desglose en francés de barbarismos u ortografía", "supra": "Sinónimos sugeridos"},
                "morphosyntaxe": {"score": "Nota", "error": "Errores de conjugación o sintaxis", "supra": "Estructuras sugeridas"}
            }
        }
        prompt_usuario = f"Evalúa la producción escrita de {nombre_alumno}. Texto del candidato:\n\"{texto_alumno}\""
    else:
        estructura_json_esperada = {
            "score_global": "Nota final (ej. 19/25)",
            "status": "Admis / Non admis / Niveau Supra",
            "transcription_html": "La transcripción exacta envolviendo los errores en etiquetas html: <span class='sophia-error' data-rubric='[production_orale_task, lexique, morphosyntaxe o phonologique]'>frase_con_error</span>",
            "audio_response_text": "Breve comentario oral directo de aliento y corrección en francés (máximo 2 frases) para TTS.",
            "rubriques": {
                "production_orale_task": {"score": "Nota", "error": "Evaluación en francés del desarrollo del monólogo o interacción", "supra": "Consejo técnico"},
                "lexique": {"score": "Nota", "error": "Pobreza léxica o términos erróneos en la transcripción", "supra": "Consejo técnico"},
                "morphosyntaxe": {"score": "Nota", "error": "Errores de sintaxis oral o concordancia", "supra": "Consejo técnico"},
                "phonologique": {"score": "Nota", "error": "Problemas de inteligibilidad deducidos", "supra": "Consejo técnico"}
            }
        }
        prompt_usuario = f"Evalúa la producción oral de {nombre_alumno} basada en la siguiente transcripción de audio:\n\"{texto_alumno}\""

    model = genai.GenerativeModel(
        model_name="gemini-1.5-pro",
        system_instruction=system_instruction,
        generation_config={
            "response_mime_type": "application/json",
            "temperature": 0.2
        }
    )

    prompt_final = f"{prompt_usuario}\n\nDevuelve obligatoriamente un JSON plano que cumpla estrictamente con esta estructura:\n{json.dumps(estructura_json_esperada)}"
    response = model.generate_content(prompt_final)
    return response.text

def interceptar_solicitudes_firestore(doc_snapshot, changes, read_time):
    """
    Callback en tiempo real de Firestore. Solo actúa si detecta una solicitud de examen con metadatos.
    El glosario flotante no se ve afectado porque no incluye los campos 'nivel' ni 'tipo_prueba'.
    """
    for change in changes:
        if change.type.name == 'ADDED':
            doc_data = change.document.to_dict()
            doc_id = change.document.id
            
            # Filtrar: solo procesar si es examen pendiente de evaluar y tiene metadatos completos
            if "response" not in doc_data and "nivel" in doc_data and "tipo_prueba" in doc_data:
                print(f"[+] Nueva producción detectada para evaluar: {doc_id} ({doc_data['nivel']}_{doc_data['tipo_prueba']})")
                
                try:
                    resultado_evaluacion = evaluar_con_rubrica_dinamica(
                        nivel=doc_data["nivel"],
                        tipo_prueba=doc_data["tipo_prueba"],
                        texto_alumno=doc_data.get("texto_alumno", ""),
                        nombre_alumno=doc_data.get("nombre_alumno", "l'élève")
                    )
                    
                    if resultado_evaluacion:
                        db.collection("generate").document(doc_id).update({
                            "response": resultado_evaluacion
                        })
                        print(f"[✅] Evaluación inyectada con éxito en Firestore para el documento: {doc_id}")
                except Exception as e:
                    print(f"[-] Error al procesar documento {doc_id}: {e}")
                    db.collection("generate").document(doc_id).update({
                        "status": {"state": "ERROR", "message": str(e)}
                    })

# Iniciar el Listener en segundo plano
print("[*] Servidor de evaluación DELF activo. Escuchando peticiones en la colección 'generate'...")
doc_watch = db.collection("generate").on_snapshot(interceptar_solicitudes_firestore)

# Mantener el proceso backend vivo
while True:
    time.sleep(1)
