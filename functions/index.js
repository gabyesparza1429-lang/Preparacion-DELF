const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });
const { GoogleGenAI } = require("@google/genai");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

exports.procesarAudioPO = onRequest({
  cors: true,
  bodyParserOptions: { json: { limit: "50mb" } }
}, (req, res) => {
  return cors(req, res, async () => {
    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Méthode non autorisée" });
    }

    try {
      let { audioBase64, mimeType, nivel, apiKey: clientApiKey } = req.body || {};
      if (!audioBase64) {
        return res.status(400).json({ error: "Aucun fichier audio reçu." });
      }

      if (audioBase64.includes(",")) {
        audioBase64 = audioBase64.split(",")[1];
      }

      const currentNivel = nivel || "B1";

      let apiKey = process.env.GEMINI_API_KEY || clientApiKey;

      let configSophia = {};
      try {
        const sophiaDoc = await db.doc("Config/Sophia").get();
        if (sophiaDoc.exists) {
          configSophia = sophiaDoc.data() || {};
          if (!apiKey && configSophia.apiKey) {
            apiKey = configSophia.apiKey;
          }
        }
      } catch (e) {
        console.warn("Erreur lecture Config/Sophia:", e);
      }

      let directrices = configSophia.po_prompt || configSophia.prompt || "";
      try {
        const dirDoc = await db.doc(`IA_Directrices/${currentNivel}_PO`).get();
        if (dirDoc.exists) {
          const dirData = dirDoc.data();
          if (dirData.prompt || dirData.description) {
            directrices += "\n" + (dirData.prompt || dirData.description);
          }
        }
      } catch (e) {
        // Optionnel
      }

      if (!apiKey) {
        return res.status(500).json({ error: "Clé API Gemini non configurée sur el servidor ni recibida del cliente." });
      }

      const promptText = `Tu es un jury officiel certifié du DELF pour le niveau ${currentNivel}. Évalue cet enregistrement oral de l'élève selon la grille d'évaluation officielle du DELF (Production Orale).
${directrices ? "Consignes spécifiques et grille d'évaluation à appliquer :\n" + directrices : ""}
Tu DOIS impérativement répondre au format JSON strict avec la structure exacte suivante :
{
  "transcription": "Texte exact transcrit de l'audio de l'élève en français",
  "score_global": "Note globale sur 25 (ex: 18.5/25)",
  "status": "DELF ${currentNivel} Atteint" ou "DELF ${currentNivel} Non Atteint",
  "overall_assessment": "Appréciation globale pédagogique et bienveillante en français",
  "suggestions": [
    "Conseil ou piste d'amélioration 1",
    "Conseil ou piste d'amélioration 2"
  ],
  "rubriques": {
    "tache_orale": {
      "title": "Tâche Oral",
      "score": "Note sur 5 (ex: 4.5/5)",
      "comment": "Commentaire sur la réalisation de la tâche, la cohérence et le respect de la consigne",
      "supra": "Objectif pour progresser"
    },
    "lexique": {
      "title": "Lexique",
      "score": "Note sur 5 (ex: 4/5)",
      "comment": "Commentaire sur la richesse et l'exactitude du vocabulaire",
      "supra": "Objectif lexique"
    },
    "morphosyntaxe": {
      "title": "Morphosyntaxe",
      "score": "Note sur 5 (ex: 3.5/5)",
      "comment": "Commentaire sur la structure des phrases, conjugaisons et grammaire",
      "supra": "Objectif grammaire"
    },
    "phonologie": {
      "title": "Phonologie",
      "score": "Note sur 5 ou 10 (ex: 4/5)",
      "comment": "Commentaire sur la prononciation, l'intonation et la fluidité",
      "supra": "Objectif phonétique"
    }
  }
}`;

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
                text: promptText
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json"
        }
      });

      let jsonResult;
      try {
        jsonResult = JSON.parse(response.text);
      } catch (e) {
        jsonResult = {
          transcription: "Enregistrement reçu.",
          feedback: response.text
        };
      }

      return res.status(200).json(jsonResult);
    } catch (err) {
      console.error("Erreur Backend:", err);
      return res.status(500).json({ error: err.message || "Erreur interne" });
    }
  });
});
