import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from google import genai
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# Inicialización segura
api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

# =================================================================
# ENRUTADOR DE PÁGINAS (CORREGIDO PARA EVITAR INTERFERENCIAS)
# =================================================================

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def servir_paginas(filename):
    # Primero verifica si existe el archivo físico exactamente como se pide
    if os.path.exists(filename):
        return send_from_directory('.', filename)
    # Si no, intenta buscarlo con extensión .html
    elif os.path.exists(f"{filename}.html"):
        return send_from_directory('.', f"{filename}.html")
    # Si no existe, devuelve un 404 real en lugar de intentar procesarlo
    return "Página no encontrada", 404

# =================================================================
# RUTA 1: SOPHIA IA (CHAT)
# =================================================================
@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        datos = request.get_json()
        if not datos or "message" not in datos:
            return jsonify({"error": "Datos inválidos"}), 400

        mensaje_alumno = datos.get("message", "").strip()

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=mensaje_alumno,
            config={"temperature": 0.3}
        )

        respuesta_text = response.text.replace("```html", "").replace("```", "").strip()

        return jsonify({"reply": respuesta_text}), 200

    except Exception as e:
        return jsonify({"error": "Error en Sophia", "detalles": str(e)}), 500

# =================================================================
# RUTA 2: EVALUACIÓN DE PRONUNCIACIÓN
# =================================================================
@app.route('/evaluar-pronunciacion', methods=['POST'])
def evaluar_pronunciacion():
    try:
        datos = request.get_json()
        guion = datos.get("guion_esperado", "")
        texto = datos.get("texto_alumno", "")
        nivel = datos.get("nivel", "A1")

        prompt = f"""
        Eres Sophia, examinadora DELF. Evalúa la precisión fonética.
        Nivel: {nivel}
        Esperado: "{guion}"
        Capturado: "{texto}"
        Responde directo en francés, máximo dos líneas, enfocada en sonidos.
        """

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config={"temperature": 0.3}
        )

        return jsonify({"status": "success", "evaluacion": response.text.strip()}), 200

    except Exception as e:
        return jsonify({"error": "Error interno", "detalles": str(e)}), 500

if __name__ == "__main__":
    puerto = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=puerto)
