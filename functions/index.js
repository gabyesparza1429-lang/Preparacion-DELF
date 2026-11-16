const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp, getApps } = require("firebase-admin/app");
const cors = require("cors")({ origin: true });
const { GoogleGenAI } = require("@google/genai");

if (!getApps().length) {
  initializeApp();
}

const PROJECT_ID = process.env.GCLOUD_PROJECT || "objectif-reussite-delf";
const LOCATION = "us-central1";

const GRILLES_DELF = {
  A1: "DELF A1 (25 pts): 1. Respect de la consigne, 2. Correction sociolinguistique, 3. Capacité à informer et décrire, 4. Lexique / orthographe lexicale, 5. Morphosyntaxe / orthographe grammaticale.",
  A2: "DELF A2 (25 pts): 1. Respect de la consigne, 2. Correction sociolinguistique, 3. Capacité à raconter / décrire / informer, 4. Lexique / orthographe lexicale, 5. Morphosyntaxe / orthographe grammaticale.",
  B1: "DELF B1 (25 pts): 1. Réalisation de la tâche (respect de la consigne et longueur), 2. Cohérence et cohésion (articulateurs logiques et structure), 3. Adéquation sociolinguistique (registre et formules), 4. Lexique / orthographe lexicale, 5. Morphosyntaxe / orthographe grammaticale.",
  B2: "DELF B2 (25 pts): 1. Réalisation de la tâche et argumentation, 2. Cohérence et cohésion, 3. Adéquation sociolinguistique, 4. Étendue et maîtrise du lexique, 5. Choix des formes et morphosyntaxe.",
  C1: "DALF C1 (25 pts): 1. Respect de la consigne et traitement du sujet, 2. Cohérence et cohésion, 3. Adéquation sociolinguistique, 4. Richesse et précision lexicale, 5. Maîtrise grammaticale et élaboration des phrases."
};

const SYSTEM_PROMPT_DELF = `Eres Sophia, examinadora oficial certificada del DELF/DALF (France Éducation International).
Evalúas producciones escritas y orales en francés siguiendo estrictamente los descriptores y grillas oficiales del nivel indicado.

REGLAS CRÍTICAS DE INTEGRIDAD Y PRECISIÓN:
1. IDENTIDAD DEL ALUMNO: Dirígete ÚNICAMENTE al alumno indicado en "nombreAlumno". Nunca uses otro nombre.
2. CITA LITERAL OBLIGATORIA: En el listado de errores ("errores"), la propiedad "original" DEBE ser una copia EXACTA, palabra por palabra, de un fragmento que aparezca literalmente en el texto/audio del alumno enviado en ESTA solicitud. Queda TERMINANTEMENTE PROHIBIDO inventar errores o citar frases que no existan en el texto recibido.
3. LECTURA DE CONSIGNA: Evalúa si el texto responde exactamente a la "consigne" proporcionada.
4. ESCALA ESTRICTA POR CRITERIO: Asigna a cada criterio ÚNICAMENTE uno de estos cuatro enteros: 0 (INSUFFISANT), 1 (EN DESSOUS), 3 (AU NIVEAU) o 5 (SUPRA). Prohibido usar 2, 4 o decimales.
5. SUMA EXACTA: "nota_total" debe ser la suma matemática exacta de los criterios (sobre 25). Si nota_total >= 13, "admis" es true; si es < 13, "admis" es false.
6. IDIOMA: Todas las apreciaciones, explicaciones de errores, recomendaciones SUPRA y el comentario general deben redactarse en ESPAÑOL claro y pedagógico. Solo "original" y "correccion" van en francés.

Devuelve ÚNICAMENTE un objeto JSON válido (sin markdown):
{
  "nivel": "B1",
  "eleve": "Nombre del alumno",
  "palabras": 150,
  "nota_total": 15,
  "admis": true,
  "veredicto": "Niveau B1 Atteint / Validé (Admis)",
  "criterios": [
    {
      "nombre": "1. Réalisation de la tâche",
      "nota": 3,
      "etiqueta": "AU NIVEAU",
      "apreciacion": "Explicación en español sobre el cumplimiento de la consigna."
    }
  ],
  "errores": [
    {
      "original": "fragmento exacto extraído del texto del alumno",
      "correccion": "forma correcta en francés",
      "explicacion": "Explicación gramatical u ortográfica en español."
    }
  ],
  "recomendaciones_supra": [
    "Consejo concreto en español para alcanzar 5/5 (SUPRA)."
  ],
  "comentario_general": "Mensaje personalizado en español dirigido al alumno por su nombre."
}`;

function limpiarYParsearJSON(rawText) {
  let clean = String(rawText || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  const ini = clean.indexOf("{");
  const fin = clean.lastIndexOf("}");
  if (ini !== -1 && fin !== -1 && fin > ini) {
    clean = clean.slice(ini, fin + 1);
  }
  return JSON.parse(clean);
}

function crearClienteVertex() {
  return new GoogleGenAI({
    vertexai: true,
    project: PROJECT_ID,
    location: LOCATION
  });
}

exports.procesarTextoPE = onRequest({ cors: true, timeoutSeconds: 120 }, (req, res) => {
  return cors(req, res, async () => {
    if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
    try {
      const { texto, consigne, nivel, nombreAlumno } = req.body || {};
      if (!texto || !String(texto).trim()) {
        return res.status(400).json({ error: "El texto del alumno está vacío." });
      }

      const lvl = String(nivel || "B1").toUpperCase();
      const grille = GRILLES_DELF[lvl] || GRILLES_DELF.B1;
      const palabras = String(texto).trim().split(/\s+/).filter(Boolean).length;

      const ai = crearClienteVertex();
      const promptUsuario = `DATOS DE ESTA EVALUACIÓN ÚNICA:
- Alumno (nombreAlumno): ${nombreAlumno || "Élève"}
- Nivel DELF: ${lvl}
- Grilla aplicable: ${grille}
- Cantidad real de palabras: ${palabras}
- Consigna del ejercicio: ${consigne || "Production écrite DELF"}

TEXTO LITERAL ESCRITO POR ${nombreAlumno || "EL ALUMNO"} (ANALIZA EXCLUSIVAMENTE ESTE TEXTO):
"""
${texto}
"""`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ text: promptUsuario }],
        config: {
          systemInstruction: SYSTEM_PROMPT_DELF,
          responseMimeType: "application/json",
          temperature: 0.2
        }
      });

      const data = limpiarYParsearJSON(response.text);
      data.eleve = nombreAlumno || data.eleve || "Élève";
      data.nivel = lvl;
      data.palabras = palabras;
      return res.status(200).json(data);
    } catch (err) {
      console.error("Error procesarTextoPE:", err);
      return res.status(500).json({ error: err.message });
    }
  });
});

exports.procesarAudioPO = onRequest({ cors: true, timeoutSeconds: 120 }, (req, res) => {
  return cors(req, res, async () => {
    if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
    try {
      const { audioBase64, mimeType, consigne, nivel, nombreAlumno } = req.body || {};
      if (!audioBase64) return res.status(400).json({ error: "No se recibió audio." });

      const lvl = String(nivel || "B1").toUpperCase();
      const cleanBase64 = String(audioBase64).replace(/^data:audio\/[a-z0-9.+-]+;base64,/, "");

      const ai = crearClienteVertex();
      const promptOral = `DATOS DE ESTA EVALUACIÓN ORAL ÚNICA:
- Alumno (nombreAlumno): ${nombreAlumno || "Élève"}
- Nivel DELF: ${lvl}
- Habilidad: Production Orale (4 criterios oficiales: 1. Réalisation de la tâche, 2. Cohérence et cohésion, 3. Lexique, 4. Morphosyntaxe et phonologie)
- Consigna: ${consigne || "Production orale DELF"}

Escucha el audio adjunto, incluye además la clave "transcripcion_breve" con la transcripción literal en francés de lo que dijo ${nombreAlumno || "el alumno"}, y evalúa con notas estrictas 0, 1, 3 o 5 (suma sobre 20 o 25 según escala).`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          { inlineData: { data: cleanBase64, mimeType: mimeType || "audio/webm" } },
          { text: promptOral }
        ],
        config: {
          systemInstruction: SYSTEM_PROMPT_DELF,
          responseMimeType: "application/json",
          temperature: 0.2
        }
      });

      const data = limpiarYParsearJSON(response.text);
      data.eleve = nombreAlumno || data.eleve || "Élève";
      data.nivel = lvl;
      return res.status(200).json(data);
    } catch (err) {
      console.error("Error procesarAudioPO:", err);
      return res.status(500).json({ error: err.message });
    }
  });
});
