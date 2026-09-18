const { onRequest } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.procesarTextoPE = onRequest({ cors: true, timeoutSeconds: 60 }, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).send("");

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "API Key no encontrada." });

    const { texto, consigne, nivel } = req.body || {};
    if (!texto) return res.status(400).json({ error: "Falta el texto a evaluar." });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeAIModel({ model: "gemini-1.5-flash" });

    const prompt = `Tu es un examinateur officiel du DELF ${nivel || "B1"}. 
Évalue cette production écrite selon la grille officielle DELF B1 (25 pts max).
Consigne: ${consigne || "Production écrite"}
Texte: "${texto}"

Réponds EXCLUSIVEMENT par un objet JSON valide, sans balises markdown :
{
  "score_global": "15/25",
  "nombre_mots": "${texto.split(/\s+/).filter(Boolean).length} mots",
  "rubriques": {
    "realisation_tache": { "score": 3, "remarque": "Analyse de la consigne et respect de la longueur." },
    "coherence_cohesion": { "score": 3, "remarque": "Organisation et connecteurs logiques." },
    "adequation_sociolinguistique": { "score": 3, "remarque": "Respect du registre de langue." },
    "lexique": { "score": 3, "remarque": "Richesse et précision du vocabulaire." },
    "morphosyntaxe": { "score": 3, "remarque": "Maîtrise de la grammaire et orthographe." }
  },
  "texto_html": "Texte corrigé avec fautes soulignées"
}`;

    const result = await model.generateContent(prompt);
    let rawText = result.response.text().trim().replace(/```json/gi, "").replace(/```/g, "").trim();
    return res.status(200).json(JSON.parse(rawText));
  } catch (error) {
    console.error("Error backend:", error);
    return res.status(500).json({ error: error.message || "Error interno" });
  }
});
