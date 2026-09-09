import os
import json
import time  
import re
from collections import Counter
import firebase_admin
from firebase_admin import credentials, firestore
from google import genai
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv
from pypdf import PdfReader, PdfWriter

# Cargar automáticamente las variables del archivo .env
load_dotenv()

# ========================================================
# ZONA 1: ESQUEMAS DE DATOS (PYDANTIC)
# ========================================================
class Pregunta(BaseModel):
    pregunta: str
    opciones: List[str]
    respuesta_correcta: str

# COMPONENTE NUEVO COMPATIBLE: Parejas de título y contenido para los anuncios/testimonios
class BloqueTexto(BaseModel):
    titulo_bloque: str
    contenido_bloque: str

class Actividad(BaseModel):
    habilidad: str  
    tipo: str       
    instruccion: str
    ruta_audio: Optional[str] = None
    texto_lectura: Optional[str] = None
    # CORRECCIÓN CRÍTICA: Cambiado de Dict a List para evitar el error 'additionalProperties'
    texto_lectura_modular: Optional[List[BloqueTexto]] = None
    preguntas: Optional[List[Pregunta]] = None
    transcripcion: Optional[str] = None  
    campos_formulario: Optional[List[str]] = None

class ContenedorEjercicios(BaseModel):
    exercises: List[Actividad]  # Nombre nativo del atributo ajustado para el esquema receptor

class VocabularioEstructurado(BaseModel):
    palabra: str
    lema: str
    tipo_gramatical: str
    definicion: str
    sinonimos: List[str]
    ejemplo_uso: str

class ContenedorDiccionario(BaseModel):
    diccionario_unidad: List[VocabularioEstructurado]

# ========================================================
# ZONA 2: CONEXIÓN DE BASE DE DATOS Y MAPEOS FIJOS
# ========================================================
if not firebase_admin._apps:
    cred = None
    firebase_admin.initialize_app()
db = firestore.client()

MAPA_LIBROS = {
    "A1": "ABC DELF A1 - 2025.pdf",
    "A2": "ABC DELF A2 - 2025.pdf",
    "B1": "ABC DELF B1 - 2025.pdf",
    "B2": "ABC DELF B2 - 2025.pdf",
    "C1": "Le DALF 100% Réussite C1 - C2.pdf"
}

MAPA_TRANSCRIPCIONES = {
    "A1": "Transcriptions_A1.pdf",
    "A2": "Transcriptions_A2.pdf",
    "B1": "Transcriptions_B1.pdf",
    "B2": "Transcriptions_B2.pdf",
    "C1": "Transcriptions_C1.pdf"
}

# ========================================================
# ZONA 3: FUNCIONES DE PROCESAMIENTO LOCAL
# ========================================================
def recortar_pdf(ruta_original, pagina_inicio, pagina_fin, prefijo="temporal"):
    """Recorta un fragmento de cualquier PDF de forma optimizada"""
    if not os.path.exists(ruta_original):
        return None
    ruta_temporal = f"{prefijo}_gemini.pdf"
    reader = PdfReader(ruta_original)
    writer = PdfWriter()
    
    idx_inicio = max(0, pagina_inicio - 1)
    idx_fin = min(len(reader.pages), pagina_fin)
    
    for page_num in range(idx_inicio, idx_fin):
        writer.add_page(reader.pages[page_num])
        
    with open(ruta_temporal, "wb") as f_out:
        writer.write(f_out)
        
    return ruta_temporal

# ========================================================
# ZONA 4: CONSOLA Y LOGICA DE INTELIGENCIA ARTIFICIAL (SOPHIA)
# ========================================================
def lanzar_consola_modular():
    print("\n" + "=" * 60)
    print("   CONSOLA INTERACTIVA SOPHIA IA - PROCESAMIENTO PARALELO")
    print("=" * 60)
    
    nivel = input("➔ Escribe el Nivel (ej: A1, A2, B1, B2, C1): ").strip().upper()
    if nivel not in MAPA_LIBROS:
        print(f"❌ ERROR: El nivel '{nivel}' no es válido.")
        return

    nombre_pdf_completo = MAPA_LIBROS[nivel]
    nombre_pdf_trans = MAPA_TRANSCRIPCIONES.get(nivel, None)

    num_unidad = input("➔ Escribe el número de Unidad (ej: 1, 2, 3): ").strip()
    tema_unidad = input("➔ Escribe el Tema de esta sección (ej: Identifier un événement): ").strip()
    
    print("\n--- Selecciona la Habilidad ---")
    print("1. CO (Compréhension Orale)")
    print("2. CE (Compréhension Écrite)")
    print("3. PE (Production Écrite)")
    print("4. PO (Production Orale)")
    opc_habilidad = input("➔ Elige el número de opción: ").strip()
    
    mapa_habilidades = {"1": "CO", "2": "CE", "3": "PE", "4": "PO"}
    habilidad_seleccionada = mapa_habilidades.get(opc_habilidad, "CO")
    
    rango_actividades = input("\n➔ Escribe el rango de Actividades para el prompt (ej: 17 a 33): ").strip()

    print("\n--- Rango de Páginas del PDF de Ejercicios ---")
    pag_inicio = int(input("➔ Desde qué página del PDF físico inicia (ej: 14): ").strip())
    pag_fin = int(input("➔ Hasta qué página del PDF físico termina (ej: 18): ").strip())

    pag_trans_inicio = 0
    pag_trans_fin = 0
    if habilidad_seleccionada == "CO" and nombre_pdf_trans:
        print(f"\n--- Rango de Páginas del archivo {nombre_pdf_trans} ---")
        pag_trans_inicio = int(input("➔ Desde qué página del PDF de transcripciones inicia (ej: 4): ").strip())
        pag_trans_fin = int(input("➔ Hasta qué página del PDF de transcripciones termina (ej: 6): ").strip())

    id_documento_unidad = f"Unite_{num_unidad}"

    print("\n" + "-" * 50)
    print(f"> Preparando fragmentos de lectura para la Inteligencia Artificial...")
    
    try:
        api_key = os.getenv("GEMINI_API_KEY") 
        client = genai.Client(api_key=api_key)
        contents_payload = []

        archivo_recortado = recortar_pdf(nombre_pdf_completo, pag_inicio, pag_fin, "ejercicios")
        if not archivo_recortado:
            print(f"\n❌ ERROR CRÍTICO: No se encontró el archivo '{nombre_pdf_completo}' en tu carpeta.")
            return
        print("> Subiendo fragmento de ejercicios a Gemini...")
        file_ejercicios = client.files.upload(file=archivo_recortado)
        contents_payload.append(file_ejercicios)

        archivo_trans_recortado = None
        if pag_trans_inicio > 0 and nombre_pdf_trans:
            archivo_trans_recortado = recortar_pdf(nombre_pdf_trans, pag_trans_inicio, pag_trans_fin, "transcripciones")
            if archivo_trans_recortado:
                print(f"> Subiendo fragmento de {nombre_pdf_trans} a Gemini...")
                file_trans = client.files.upload(file=archivo_trans_recortado)
                contents_payload.append(file_trans)

    except Exception as e:
        print(f"\n❌ Error al preparar los archivos locales: {e}")
        return
    
    print(f"> Procesando Unité {num_unidad} - Sección: {habilidad_seleccionada}...")

    reglas_especificas = ""
   
    if habilidad_seleccionada == "CO":
        reglas_especificas = """
        3. El campo "instruccion" DEBE empezar estrictamente con el texto de la actividad correspondiente (ej: "Activité 60").
        4. MAPEO DE AUDIO (NÚMERO PURO): Coloca en "ruta_audio" únicamente el número directo de la actividad más ".mp3" (ej: "60.mp3").
        5. EXTRACCIÓN DE TRANSCRIPCIÓN INTERACTIVA: Busca en el fragmento de transcripciones adjunto el texto exacto hablado correspondiente a cada actividad extraída y transcríbelo de forma íntegra en francés dentro del campo "transcripcion". NO lo dejes como null bajo ninguna circunstancia si el documento está adjunto.
        6. REGLA PARA EJERCICIOS DE ASOCIACIÓN DE IMÁGENES (ASOCIAR DIÁLOGOS A IMÁGENES A, B, C...): Si el ejercicio consiste en escuchar diálogos o situaciones y asociarlos a imágenes del libro (como Image A, Image B, Image C), DEBES generar una estructura en el campo "preguntas" donde cada situación detectada en el audio sea una pregunta. Ejemplo:
           - pregunta: "Situation n° 1"
           - opciones: ["Image A | descripción de la escena en francés", "Image B | descripción de la escena en francés"]
        7. REGLA PARA IDENTIFICACIÓN DE OBJETOS (OUI / NON CON DIBUJOS NUMERADOS): Si el ejercicio muestra una serie de objetos numerados (1, 2, 3...) para marcar "Oui" o "Non" según se escuchen en el audio (ej: Activité 60), DEBES crear una pregunta por cada número. El campo "pregunta" debe ser el número seguido del nombre del objeto en francés (ej: "1. La guitare", "2. Le piano"). El campo "opciones" para cada uno debe ser estrictamente ["Oui", "Non"].
        """
    elif habilidad_seleccionada == "CE":
        reglas_especificas = """
        3. El campo "instruccion" DEBE empezar estrictamente con el texto de la actividad correspondiente (ej: "Activité 12").
        4. ANÁLISIS DE FORMATO INTERACTIVO Y CRUZADO: Identifica la tipología de presentación del ejercicio. Si la lectura contiene múltiples anuncios cortos independientes (ej. Deportes, Cursos, Recetas) u opiniones cruzadas de personas (ej. Jean-Phi, Brigitte, Yves), DEBES separar rigurosamente cada bloque de texto dentro de la lista "texto_lectura_modular", asignándole el título del anuncio o nombre de la persona a "titulo_bloque", y el texto descriptivo a "contenido_bloque".
        5. Si la lectura es modular, en el arreglo de "preguntas", el campo "pregunta" DEBE iniciar mandatoriamente con el formato "Nombre del Bloque - Enunciado de la pregunta" (ej. "Volley-ball - 1. Équipe d'au moins 3 personnes" o "Jean-Phi - 1. Qui préfère travailler seul ?"). El campo "texto_lectura" se mantendrá como un respaldo de texto completo.
        """
    elif habilidad_seleccionada == "PE":
        reglas_especificas = """
        3. Identifica rigurosamente las actividades de Production Écrite y procésalas una por una. El campo "instruccion" DEBE iniciar con el número de actividad (ej: "Activité 3").
        4. TEXTO DE CONTEXTO O ESTIMULO OBLIGATORIO: Transcribe de forma íntegra el mensaje, correo, anuncio o situación de partida que el alumno debe leer antes de escribir (ej: el mensaje de Léa "Bonjour, Je voudrais améliorer mon français...") y guárdalo obligatoriamente en el campo "texto_lectura".
        5. Identifica la naturaleza del ejercicio: Si contiene un formulario o ficha rellenable, el campo "tipo" DEBE ser estrictamente "formulario".
        6. EXTRACCIÓN DE CAMPOS: Cuando el "tipo" sea "formulario", extrae uno a uno los campos solicitados en francés y guárdalos como una lista de textos en la propiedad "campos_formulario".
        7. Si el ejercicio pide redactar un texto libre o carta de respuesta, el campo "tipo" DEBE ser estrictamente "texto" y "campos_formulario" queda como null.
        8. Para todos los ejercicios de PE, el campo "preguntas" queda como null.
        """
    elif habilidad_seleccionada == "PO":
        reglas_especificas = f"""
        3. Clasifica CADA actividad de Production Orale para el nivel ({nivel}) asignándole estrictamente uno de los siguientes valores exactos al campo "tipo": 'oral_interaction', 'oral_cards', 'oral_monologue', o 'oral_debate'.
        4. GUION PARA SOPHIA (CAMPO RUTA_AUDIO): Redacta las directrices o primera línea de conversación que Sophia usará en la simulación de voz en francés.
        5. Para todas las actividades de PO, el campo "preguntas" debe configurarse como null.
        """

    prompt = f"""
    Analiza las páginas de los documentos adjuntos y extrae los ejercicios de la Unité {num_unidad} para la sección de {habilidad_seleccionada} en el rango ({rango_actividades}).
    
    TODO EL CONTENIDO GENERADO DEBE ESTAR ESTRICTAMENTE EN FRANCÉS.

    REGLAS ESPECÍFICAS DE LA COMPETENCIA ({habilidad_seleccionada}):
    {reglas_especificas}

    REGLAS DE FORMATO PARA PREGUNTAS Y OPCIONES:
    6. Para casillas Sí/No o Verdadero/Falso, el campo "opciones" debe ser estrictamente: ["Oui", "Non"] o ["Vrai", "Faux"].
    7. REGLA DE RESPUESTA E IMÁGENES (A1 / B1): En el campo "respuesta_correcta" NO guardes letras solas (A, B, C) a menos que sea un ejercicio de imágenes. Si las opciones del examen son imágenes (ej: opciones A, B, C que muestran dibujos), el campo "opciones" DEBE incluir el nombre del archivo físico asignado y una descripción clara del objeto en francés separada por una barra vertical. Ejemplo: ["1.png | un dictionnaire", "2.png | une montre", "3.png | un stylo"]. En este caso específico, "respuesta_correcta" guardará el texto completo de la opción ganadora.
    8. REGLA PARA MAPAS Y TRAYECTOS VISUALES: Si el ejercicio consiste en elegir un trayecto, itinerario o camino correcto basándose en imágenes, mapas o planos del libro, las opciones NO deben decir "Chemin incorrect". DEBES analizar visualmente cada mapa alternativo (A, B, C...) y describir detalladamente en francés el trayecto que representa cada uno (ej. las calles por las que pasa, si gira a la izquierda o derecha, etc.), para que todas las opciones contengan descripciones reales de los caminos y el alumno pueda discriminar cuál es el correcto.

    REGLAS GENERALES:
    9. Coloca todas las actividades procesadas dentro de la lista única "ejercicios".
    """
    contents_payload.append(prompt)

    intentos_maximos = 10
    segundos_espera = 5
    exito = False
    response_text = ""

    for intento in range(1, intentos_maximos + 1):
        try:
            print(f"\n> Enviando petición a Gemini (Intento {intento}/{intentos_maximos})...")
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=contents_payload,
                config={
                    "response_mime_type": "application/json",
                    "response_schema": ContenedorEjercicios,
                    "temperature": 0.1
                }
            )
            response_text = response.text
            exito = True
            break 
            
        except Exception as err:
            str_err = str(err)
            if "503" in str_err or "429" in str_err or "UNAVAILABLE" in str_err:
                print(f"⚠️ Servidores ocupados. Esperando {segundos_espera} segundos para reintentar...")
                time.sleep(segundos_espera)
                segundos_espera += 5  
            else:
                print(f"\n❌ Error crítico no recuperable: {err}")
                return

    try:
        if archivo_recortado and os.path.exists(archivo_recortado): os.remove(archivo_recortado)
        if archivo_trans_recortado and os.path.exists(archivo_trans_recortado): os.remove(archivo_trans_recortado)
        client.files.delete(name=file_ejercicios.name)
        if archivo_trans_recortado: client.files.delete(name=file_trans.name)
    except:
        pass

    if not exito:
        print("\n❌ Se agotaron los 10 intentos automáticos debido a saturación.")
        return

    # ========================================================
    # ZONA 5: CONSTRUCCIÓN DEL GLOSARIO (MOTOR GRATUITO FLASH)
    # ========================================================
    try:
        datos_api = json.loads(response_text)
        # Adaptación segura del atributo contenedor devuelto por la IA
        nuevas_actividades = datos_api.get("exercises", datos_api.get("ejercicios", []))

        print("> Filtrando y limpiando cadenas de texto para el diccionario...")
        texto_limpio = response_text.lower()
        texto_limpio = re.sub(r'[\d\[\]\{\}\(\)\"\':;,.\?\!\-\_\/]', ' ', texto_limpio)
        palabras_brutas = re.findall(r'\b[a-zàâçéèêëîïôûùüÿñæœ]+\b', texto_limpio)
        
        conteo_frecuencias = Counter(palabras_brutas)
        
        palabras_validas = []
        for p in palabras_brutas:
            p_limpia = p.strip()
            if len(p_limpia) > 1 or p_limpia in ['a', 'à', 'y', 'u']:
                palabras_validas.append(p_limpia)
        
        lista_palabras_envio = sorted(list(set(palabras_validas)))
        
        # Filtro de seguridad obligatorio para cuota gratuita de la API
        lista_palabras_envio = lista_palabras_envio[:100]

        # ---------------------------------------------------------------------
        # MEJORA DE SEGURIDAD CRÍTICA: Pausa obligatoria para evitar el error 429
        # ---------------------------------------------------------------------
        print("⏳ Aplicando pausa de seguridad de 8 segundos para liberar la cuota de la API...")
        time.sleep(15)
        # ---------------------------------------------------------------------

        print(f"> Invocando a Gemini 2.5 Flash para construir el diccionario de {len(lista_palabras_envio)} términos...")
        
        idioma_def = "español de forma muy clara y sencilla" if nivel in ["A1", "A2"] else "francés avanzado"
        
        prompt_vocabulario = f"""
        Actúa como un lexicógrafo de FLE de alto nivel. Analiza rigurosamente CADA UNA de las palabras únicas de esta lista extraída de la unidad: {lista_palabras_envio}.
        
        REGLA CRÍTICA: Debes procesar cada palabra de la lista exactamente UNA sola vez. No dupliques entradas en la respuesta.
        
        Genera un objeto estructurado para cada término completando los campos solicitados:
        1. "palabra": La palabra exacta en minúsculas.
        2. "lema": La forma base o de diccionario (infinitivo para verbos, masculino singular para adjetivos y sustantivos).
        3. "tipo_gramatical": Categoría exacta con su género si aplica (ej: "article défini", "préposition", "nom (m)", "nom (f)", "verbe", "adjectif").
        4. "definicion": Una definición pedagógica escrita estrictamente en {idioma_def}.
        5. "sinonimos": Una lista con 1 o 2 sinónimos siempre en FRANCÉS.
        6. "ejemplo_uso": Una oración breve y contextualizada utilizando el término en FRANCÉS.
        """
        
        diccionario_final = []
        try:
            response_pro = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt_vocabulario,
                config={
                    "response_mime_type": "application/json",
                    "response_schema": ContenedorDiccionario,
                    "temperature": 0.1
                }
            )
            
            datos_dict_pro = json.loads(response_pro.text)
            lista_items_extraidos = datos_dict_pro.get("diccionario_unidad", [])
            
            palabras_ya_guardadas = set()
            for item in lista_items_extraidos:
                palabra_normalizada = item.get("palabra", "").lower().strip()
                if palabra_normalizada and palabra_normalizada not in palabras_ya_guardadas:
                    item["frecuencia"] = conteo_frecuencias.get(palabra_normalizada, 1)
                    diccionario_final.append(item)
                    palabras_ya_guardadas.add(palabra_normalizada)
                    
        except Exception as error_pro:
            print(f"⚠️ Alerta en el motor: {error_pro}. Generando diccionario de respaldo obligatorio...")
            diccionario_final = []
            for p in lista_palabras_envio:
                diccionario_final.append({
                    "palabra": p,
                    "lema": p,
                    "tipo_gramatical": "mot",
                    "definicion": "Vocabulaire de l'unité.",
                    "sinonimos": [],
                    "ejemplo_uso": "",
                    "frecuencia": conteo_frecuencias.get(p, 1)
                })

# ========================================================
        # ZONA 6: GUARDADO Y RESPALDOS EN FOCO (FIRESTORE)
        # ========================================================
        unidad_ref = db.collection("BibliotecaEjercicios").document(nivel).collection("Unidades").document(id_documento_unidad)
        
        # 1. Preparar las actividades del motor Pydantic a diccionarios limpios
        ejercicios_listos_para_guardar = []
        for act in nuevas_actividades:
            act_dict = act.model_dump() if hasattr(act, "model_dump") else dict(act)
            
            if act_dict.get("texto_lectura_modular"):
                mapa_firestore_modular = {}
                for bloque in act_dict["texto_lectura_modular"]:
                    if bloque.get("titulo_bloque"):
                        mapa_firestore_modular[bloque["titulo_bloque"]] = bloque.get("contenido_bloque", "")
                act_dict["texto_lectura_modular"] = mapa_firestore_modular
            
            ejercicios_listos_para_guardar.append(act_dict)

        # 2. Descargar el documento actual si existe para fusionar los diccionarios de vocabulario
        documento_existente_snap = unit_ref.get() if 'unit_ref' in locals() else unidad_ref.get()
        diccionario_acumulado = []
        
        if documento_existente_snap.exists:
            datos_viejos = documento_existente_snap.to_dict()
            diccionario_previo = datos_viejos.get("diccionario_unidad", [])
            
            # Combinar términos evitando duplicar palabras idénticas
            palabras_vistas = set()
            for item in diccionario_final + diccionario_previo:
                w = item.get("palabra", "").lower().strip()
                if w and w not in palabras_vistas:
                    diccionario_acumulado.append(item)
                    palabras_vistas.add(w)
        else:
            diccionario_acumulado = diccionario_final

        # 3. Estructurar la actualización usando notación de puntos para proteger las demás habilidades
        datos_actualizacion = {
            "unidad": f"Unité {num_unidad}",
            f"tema_{habilidad_seleccionada}": tema_unidad,
            habilidad_seleccionada: ejercicios_listos_para_guardar,
            "diccionario_unidad": diccionario_acumulado
        }

        # Guardar de forma segura sin sobreescribir las otras secciones
        unidad_ref.set(datos_actualizacion, merge=True)
        
        # Recuperar el estado global para el archivo JSON local de respaldo
        documento_completo_snap = unidad_ref.get()
        datos_completos_actualizados = documento_completo_snap.to_dict() if documento_completo_snap.exists else datos_actualizacion

        nombre_respaldo = f"respaldo_{nivel}_{id_documento_unidad}_{habilidad_seleccionada}.json"
        with open(nombre_respaldo, "w", encoding="utf-8") as f:
            json.dump(datos_completos_actualizados, f, ensure_ascii=False, indent=2)

        print("\n" + "=" * 60)
        print(f"➔ ¡ÉXITO! La sección {habilidad_seleccionada} se guardó de forma aislada y segura en FIREBASE.")
        print("=" * 60)
        
    except Exception as err:
        print(f"\n❌ Error al guardar en la base de datos: {err}")

if __name__ == "__main__":
    while True:
        lanzar_consola_modular()
        print("\n" + "=" * 60)
        continuar = input("➔ ¿Deseas procesar otra sección o unidad? (S/N): ").strip().upper()
        if continuar != "S":
            print("\n¡Proceso terminado con éxito!")
            break