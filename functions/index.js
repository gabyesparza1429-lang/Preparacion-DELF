const { onRequest } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI } = require("@google/generative-ai");

function getApiKey() {
  return process.env.GEMINI_API_KEY || process.env.GEMINI_SECRET_KEY || "";
}

async function generarConGemini(apiKey, contents) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelos = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  let ultimoError = null;

  for (const nombreModelo of modelos) {
    try {
      const model = genAI.getGenerativeModel({
        model: nombreModelo,
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.3
        }
      });
      const result = await model.generateContent(contents);
      const rawText = result.response.text().replace(/```json/gi, "").replace(/```/g, "").trim();
      return JSON.parse(rawText);
    } catch (err) {
      ultimoError = err;
    }
  }
  throw ultimoError || new Error("No se pudo obtener respuesta de Gemini.");
}

function normalizarEvaluacionDELF(data, nivel, nombreAlumno, palabras) {
  const permitidos = [0, 1, 3, 5];
  const criteriosRaw = Array.isArray(data.criterios) ? data.criterios : [];
  let suma = 0;

  const criterios = criteriosRaw.slice(0, 5).map((c, idx) => {
    let n = Number(c.nota);
    if (!permitidos.includes(n)) {
      n = permitidos.reduce((prev, curr) => Math.abs(curr - n) < Math.abs(prev - n) ? curr : prev, 3);
    }
    suma += n;
    const etiqueta = n === 0 ? "INSUFFISANT" : (n === 1 ? "EN DESSOUS" : (n === 3 ? "AU NIVEAU" : "SUPRA"));
    return {
      nombre: c.nombre || `Critère ${idx + 1}`,
      nota: n,
      etiqueta,
      apreciacion: c.apreciacion || ""
    };
  });

  const admis = suma >= 13;
  const niv = (nivel || "B1").toUpperCase();
  return {
    nivel: niv,
    eleve: nombreAlumno || "Élève",
    palabras: palabras || 0,
    nota_total: suma,
    admis,
    veredicto: admis
      ? `Niveau ${niv} Atteint / Validé (Admis)`
      : `Niveau ${niv} Non Atteint (À renforcer)`,
    criterios,
    errores: Array.isArray(data.errores) ? data.errores : [],
    recomendaciones_supra: Array.isArray(data.recomendaciones_supra) ? data.recomendaciones_supra : [],
    comentario_general: data.comentario_general || ""
  };
}

exports.procesarTextoPE = onRequest({ cors: true, timeoutSeconds: 60 }, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).send("");

  try {
    const apiKey = getApiKey();
    if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY no configurada en el servidor." });

    const { texto, consigne, nivel, nombreAlumno } = req.body || {};
    if (!texto || !texto.trim()) return res.status(400).json({ error: "Aucun texte reçu." });

    const niv = (nivel || "B1").toUpperCase();
    const alumno = nombreAlumno || "l'élève";
    const palabras = texto.trim().split(/\s+/).filter(Boolean).length;

    const prompt = `Eres Sophia, examinadora oficial y jurado certificada del examen DELF nivel ${niv}.
Evalúa la siguiente Production Écrite del alumno llamado "${alumno}" (${palabras} palabras).

[CONSIGNA DEL EXAMEN]:
${consigne || "Production écrite officielle DELF"}

[TEXTO DEL ALUMNO]:
"${texto}"

REGLAS ESTRICTAS DE JURADO DELF (OBLIGATORIAS):
1. Evalúa exactamente los 5 criterios oficiales (cada uno sobre 5 puntos, total /25):
   - "1. Réalisation de la tâche"
   - "2. Cohérence et cohésion"
   - "3. Adéquation sociolinguistique"
   - "4. Lexique (Vocabulaire)"
   - "5. Morphosyntaxe (Grammaire)"
2. ESCALA ESTRICTA: Para cada criterio asigna ÚNICAMENTE uno de estos cuatro números enteros: 0, 1, 3 o 5. Está PROHIBIDO usar 2, 4 o decimales.
   - 0 = INSUFFISANT
   - 1 = EN DESSOUS DU NIVEAU ${niv}
   - 3 = AU NIVEAU ${niv}
   - 5 = SUPRA (Au-dessus du niveau ${niv})
3. SIN DOBLE PENALIZACIÓN: Los errores de ortografía o gramática SOLO penalizan en "4. Lexique" o "5. Morphosyntaxe", nunca en Coherencia o Realización de la tarea si el mensaje se entiende.
4. DIRÍGETE AL ALUMNO POR SU NOMBRE (${alumno}) de forma empática y pedagógica en español, citando ejemplos literales de su texto en francés.

Devuelve ÚNICAMENTE un JSON válido con esta estructura exacta:
{
  "criterios": [
    { "nombre": "1. Réalisation de la tâche", "nota": 3, "apreciacion": "..." },
    { "nombre": "2. Cohérence et cohésion", "nota": 3, "apreciacion": "..." },
    { "nombre": "3. Adéquation sociolinguistique", "nota": 5, "apreciacion": "..." },
    { "nombre": "4. Lexique (Vocabulaire)", "nota": 3, "apreciacion": "..." },
    { "nombre": "5. Morphosyntaxe (Grammaire)", "nota": 1, "apreciacion": "..." }
  ],
  "errores": [
    { "original": "frase exacta con error del alumno", "correccion": "frase corregida en francés", "explicacion": "breve explicación" }
  ],
  "recomendaciones_supra": [
    "1. Réalisation de la tâche: consejo concreto para subir a 5/5...",
    "2. Cohérence et cohésion: consejo concreto para subir a 5/5..."
  ],
  "comentario_general": "Mensaje final motivador dirigido a ${alumno}."
}`;

    const rawEval = await generarConGemini(apiKey, prompt);
    const evaluacion = normalizarEvaluacionDELF(rawEval, niv, alumno, palabras);
    return res.status(200).json(evaluacion);
  } catch (error) {
    console.error("Error procesarTextoPE:", error);
    return res.status(500).json({ error: error.message || "Error interno evaluando texto." });
  }
});

exports.procesarAudioPO = onRequest({ cors: true, timeoutSeconds: 90 }, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).send("");

  try {
    const apiKey = getApiKey();
    if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY no configurada en el servidor." });

    const { audioBase64, mimeType, consigne, nivel, nombreAlumno } = req.body || {};
    if (!audioBase64) return res.status(400).json({ error: "Aucun enregistrement audio reçu." });

    const niv = (nivel || "B1").toUpperCase();
    const alumno = nombreAlumno || "l'élève";
    const tipoAudio = (mimeType && mimeType.includes("audio/")) ? mimeType.split(";")[0] : "audio/webm";

    const prompt = `Eres Sophia, examinadora oficial y jurado certificada del examen DELF nivel ${niv}.
Escucha atentamente esta Production Orale del alumno llamado "${alumno}" y evalúala como jurado oficial.

[CONSIGNA DEL EXAMEN]:
${consigne || "Production orale officielle DELF"}

REGLAS ESTRICTAS DE JURADO DELF (OBLIGATORIAS):
1. Evalúa exactamente 5 criterios oficiales de Production Orale (cada uno sobre 5 puntos, total /25):
   - "1. Réalisation de la tâche (Monologue / Interaction)"
   - "2. Cohérence et organisation du discours"
   - "3. Lexique (Étendue et maîtrise)"
   - "4. Morphosyntaxe (Grammaire orale)"
   - "5. Phonologie (Prononciation, rythme et intonation)"
2. ESCALA ESTRICTA: Para cada criterio asigna ÚNICAMENTE uno de estos cuatro números enteros: 0, 1, 3 o 5. Está PROHIBIDO usar 2, 4 o decimales.
   - 0 = INSUFFISANT
   - 1 = EN DESSOUS DU NIVEAU ${niv}
   - 3 = AU NIVEAU ${niv}
   - 5 = SUPRA (Au-dessus du niveau ${niv})
3. SIN DOBLE PENALIZACIÓN: Los errores gramaticales o de pronunciación no penalizan en "Réalisation de la tâche" si el discurso es comprensible.
4. DIRÍGETE AL ALUMNO POR SU NOMBRE (${alumno}) de forma empática y profesional en español, citando frases que dijo en el audio.

Devuelve ÚNICAMENTE un JSON válido con esta estructura exacta:
{
  "transcripcion_breve": "Resumen o transcripción breve de lo que dijo el alumno en francés",
  "criterios": [
    { "nombre": "1. Réalisation de la tâche (Monologue / Interaction)", "nota": 3, "apreciacion": "..." },
    { "nombre": "2. Cohérence et organisation du discours", "nota": 3, "apreciacion": "..." },
    { "nombre": "3. Lexique (Étendue et maîtrise)", "nota": 3, "apreciacion": "..." },
    { "nombre": "4. Morphosyntaxe (Grammaire orale)", "nota": 1, "apreciacion": "..." },
    { "nombre": "5. Phonologie (Prononciation, rythme et intonation)", "nota": 3, "apreciacion": "..." }
  ],
  "errores": [
    { "original": "frase pronunciada con error", "correccion": "forma correcta en francés", "explicacion": "breve explicación" }
  ],
  "recomendaciones_supra": [
    "Consejo concreto para alcanzar nivel SUPRA (5/5) en oral..."
  ],
  "comentario_general": "Mensaje final motivador dirigido a ${alumno}."
}`;

    const rawEval = await generarConGemini(apiKey, [
      prompt,
      {
        inlineData: {
          mimeType: tipoAudio,
          data: audioBase64
        }
      }
    ]);

    const evaluacion = normalizarEvaluacionDELF(rawEval, niv, alumno, 0);
    evaluacion.transcripcion_breve = rawEval.transcripcion_breve || "";
    return res.status(200).json(evaluacion);
  } catch (error) {
    console.error("Error procesarAudioPO:", error);
    return res.status(500).json({ error: error.message || "Error interno evaluando audio." });
  }
});
