import os
import json
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from google import genai
from dotenv import load_dotenv

# Cargar variables de entorno del archivo .env
load_dotenv()

# Configuramos Flask para que busque tus archivos HTML en la raíz del repositorio
app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)  # Habilita peticiones cruzadas seguras

# Inicialización segura del cliente SDK de Gemini de Google
api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

# =================================================================
# ENRUTADOR DE PÁGINAS WEB (SERVIDOR DE ARCHIVOS)
# =================================================================

# 1. Ruta para la página principal (index.html)
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

# 2. Ruta dinámica para tus archivos HTML (admin.html, alumno.html, etc.)
@app.route('/<path:filename>')
def servir_paginas(filename):
    if filename.endswith('.html') or '.' not in filename:
        nombre_archivo = filename if filename.endswith('.html') else f"{filename}.html"
        return send_from_directory('.', nombre_archivo)
    return send_from_directory('.', filename)

# =================================================================
# RUTA 1: DICCIONARIO Y ANÁLISIS DE FRASES (SOPHIA IA)
# =================================================================
@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        datos = request.get_json()
        if not datos:
            return jsonify({"error": "No se recibieron datos válidos"}), 400

        mensaje_alumno = datos.get("message", "").strip()

        if not mensaje_alumno:
            return jsonify({"error": "Faltan parámetros críticos"}), 400

        # Consumo directo de Gemini
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=mensaje_alumno,
            config={
                "temperature": 0.3
            }
        )

        respuesta_text = response.text.strip()

        # Limpieza de marcas de bloque markdown si existen
        if respuesta_text.startswith("```"):
            lineas = respuesta_text.splitlines()
            if len(lineas) > 2:
                respuesta_text = "\n".join(lineas[1:-1]).strip()
        else:
            respuesta_text = respuesta_text.replace("```html", "").replace("```", "").strip()

        return jsonify({
            "reply": respuesta_text
        }), 200

    except Exception as e:
        print(f"❌ Error en la ruta /api/chat de Sophia: {e}")
        return jsonify({"error": "Error interno en el glosario", "detalles": str(e)}), 500


# =================================================================
# RUTA 2: EVALUACIÓN DE PRONUNCIACIÓN DE VOZ (MICRÓFONO)
# =================================================================
@app.route('/evaluar-pronunciacion', methods=['POST'])
def evaluar_pronunciacion():
    try:
        datos = request.get_json()
        if not datos:
            return jsonify({"error": "No se recibieron datos válidos"}), 400

        guion_esperado = datos.get("guion_esperado", "").strip()
        texto_alumno = datos.get("texto_alumno", "").strip()
        nivel = datos.get("nivel", "A1").strip()

        if not guion_esperado or not texto_alumno:
            return jsonify({"error": "Faltan parámetros críticos para evaluar"}), 400

        prompt = f"""
        Eres Sophia, una examinadora experta nativa del DELF. Evalúa la precisión fonética y correspondencia de la siguiente lectura.
        
        Nivel del estudiante: {nivel}
        Frase original esperada: "{guion_esperado}"
        Texto transcrito capturado: "{texto_alumno}"

        REGLAS DE EVALUACIÓN:
        1. Compara qué tan cerca estuvo el alumno de pronunciar la frase esperada según las reglas de elisión, liaison y fonemas franceses.
        2. Genera una respuesta de retroalimentación pedagógica directa y constructiva de máximo dos líneas.
        3. LA RESPUESTA DEBE ESTAR COMPLETAMENTE EN FRANCÉS. NO uses tonos condescendientes ni introducciones de relleno. Ve directo al grano indicando los aciertos y qué sonidos específicos debe mejorar.
        """

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config={
                "temperature": 0.3
            }
        )

        feedback_text = response.text.strip()

        if feedback_text.startswith("```"):
            lineas = feedback_text.splitlines()
            if len(lineas) > 2:
                feedback_text = "\n".join(lineas[1:-1]).strip()

        return jsonify({
            "status": "success",
            "evaluacion": feedback_text
        }), 200

    except Exception as e:
        print(f"❌ Error en el servidor Sophia: {e}")
        return jsonify({"error": "Error interno del servidor", "detalles": str(e)}), 500

# Railway usa una variable de entorno llamada PORT asignada dinámicamente
import os

if __name__ == "__main__":
    # Esto lee el puerto que Railway necesita en automático, y si no hay, usa el 5000 por defecto
    puerto = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=puerto)
