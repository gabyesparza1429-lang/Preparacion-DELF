require('dotenv').config();
const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });
const { GoogleGenAI } = require("@google/genai");

exports.procesarAudioPO = onRequest((req, res) => {
  return cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Méthode non autorisée" });
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Clé API non trouvée dans le fichier .env" });
      }

      const { audioBase64, mimeType } = req.body;
      if (!audioBase64) {
        return res.status(400).json({ error: "Aucun fichier audio reçu." });
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
        transcription: "Enregistrement reçu par le jury DELF.",
        feedback: response.text || "Évaluation terminée."
      });
    } catch (err) {
      console.error("Erreur Jury DELF:", err);
      return res.status(500).json({ error: err.message || "Erreur lors de l'évaluation." });
    }
  });
});
