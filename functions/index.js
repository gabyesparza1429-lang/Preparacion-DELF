const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });
const { GoogleGenAI } = require("@google/genai");

exports.procesarAudioPO = onRequest({
  cors: true,
  bodyParserOptions: { json: { limit: "10mb" } }
}, (req, res) => {
  return cors(req, res, async () => {
    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Méthode non autorisée" });
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Clé API non configurée sur le serveur." });
      }

      let { audioBase64, mimeType } = req.body || {};
      if (!audioBase64) {
        return res.status(400).json({ error: "Aucun fichier audio reçu." });
      }

      if (audioBase64.includes(",")) {
        audioBase64 = audioBase64.split(",")[1];
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: mimeType || "audio/webm",
                  data: audioBase64
                }
              },
              {
                text: "Tu es un jury officiel du DELF. Évalue cet enregistrement oral selon les critères officiels du DELF. Fournis la transcription exacte et une évaluation pédagogique détaillée en JSON avec les clés 'transcription' et 'feedback'."
              }
            ]
          }
        ]
      });

      return res.status(200).json({
        transcription: "Enregistrement analysé par le jury DELF.",
        feedback: response.text || "Analyse terminée."
      });
    } catch (err) {
      console.error("Erreur Backend:", err);
      return res.status(500).json({ error: err.message || "Erreur interne" });
    }
  });
});
