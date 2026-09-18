const { onRequest } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.procesarTextoPE = onRequest({ cors: true, timeoutSeconds: 60 }, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).send("");

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Clave GEMINI_API_KEY no encontrada." });

    const { texto, consigne, nivel } = req.body || {};
    if (!texto) return res.status(400).json({ error: "Aucun texte reçu." });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeAIModel({ model: "gemini-1.5-flash" });

    const prompt = `Tu es Sophia, une évaluatrice experte du DELF ${nivel || "B1"}. 
Évalue la production écrite suivante selon les critères officiels du DELF (Réalisation de la tâche, Cohérence/cohésion, Adéquation sociolinguistique, Lexique, Morphosyntaxe).

Consigne: ${consigne || "Production écrite"}
Texte de l\x27élève: "${texto}"

Donne une évaluation complète, structurée et bienveillante en français directement au format HTML (utilisant <h3>, <h4>, <ul>, <li>, <strong>, <p>) sans balises markdown :
1. Note globale sur 25 (ex: <div style="font-size:1.3rem; color:#002244; margin-bottom:15px;"><strong>Note Finale : 16/25</strong></div>).
2. Remarques détaillées par critère avec leurs points respectifs.
3. Corrections du texte et explications des principales erreurs.`;

    const result = await model.generateContent(prompt);
    let htmlOutput = result.response.text().replace(/```html/gi, "").replace(/```/g, "").trim();

    return res.status(200).json({ texto_html: htmlOutput });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});