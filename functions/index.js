const { onRequest } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.procesarTextoPE = onRequest({ cors: true, timeoutSeconds: 60 }, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).send("");

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Clave API no configurada" });

    const { texto, consigne, nivel } = req.body || {};
    if (!texto) return res.status(400).json({ error: "No hay texto enviado" });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeAIModel({ model: "gemini-1.5-flash" });

    const prompt = `Tu es Sophia, évaluatrice experte du DELF ${nivel || "B1"}. Évalue ce texte en HTML sans markdown: Note sur 25, remarques et corrections. Consigne: ${consigne || "PE"}. Texte: "${texto}"`;

    const result = await model.generateContent(prompt);
    let htmlContent = result.response.text().replace(/```html/gi, "").replace(/```/g, "").trim();

    return res.status(200).json({ texto_html: htmlContent });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});