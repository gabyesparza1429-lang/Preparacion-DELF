const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const cors = require("cors")({ origin: true });
const { GoogleGenAI } = require("@google/genai");

if (!getApps().length) initializeApp();
const db = getFirestore();

// Descriptores pedagógicos unificados del CECR (A1 - C1)
const CECR_DESCRIPTEURS = {
  A1: "A1 (Découverte): Expressions simples et isolées. Contrôle syntaxique limité. Tolérance élevée aux fautes si l'énoncé est compréhensible.",
  A2: "A2 (Survie): Séries de phrases reliées par 'et', 'mais', 'parce que'. Description d'événements passés et d'habitudes. Erreurs simples tolérées.",
  B1: "B1 (Seuil): Récit linéaire, expression de sentiments/opinions, maîtrise des temps du passé (imparfait/passé composé) et connecteurs logiques.",
  B2: "B2 (Indépendant): Argumentation développée, nuance des points de vue, haut degré de correction gramaticale et variété d'articulateurs.",
  C1: "C1 (Autonome): Discours fluide, complexe et structuré. Précision lexicale, maîtrise des registres et style naturel sans effort apparent."
};

const GRILLES_DISCRETES = {
  PO: {
    A1: { total: 25, discrete: "0, 1, 2.5, 4, 5" },
    A2: { total: 25, discrete: "0, 1, 2.5, 4, 5" },
    B1: { total: 25, discrete: "0, 1, 2.5, 4, 5" },
    B2: { total: 25, discrete: "0, 1.5, 3, 5" },
    C1: { total: 25, discrete: "0, 1, 3, 5" }
  },
  PE: {
    A1: { total: 15, minWords: 20, discrete: "0, 0.5, 2, 3" },
    A2: { total: 12.5, minWords: 30, discrete: "0, 0.5, 1.5, 2.5" },
    B1: { total: 25, minWords: 80, discrete: "0, 1, 3, 5" },
    C1: { total: 12.5, minWords: 125, discrete: "0, 0.5, 1.5, 2.5" }
  }
};

exports.procesarAudioPO = onRequest({ cors: true, timeoutSeconds: 120 }, (req, res) => {
  return cors(req, res, async () => {
    if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });
    try {
      const apiKey = process.env.GEMINI_API_KEY || "";
      const { audioBase64, mimeType, prompt, text, nivel } = req.body || {};
      const lvl = (nivel || "B1").toUpperCase().trim();
      const descr = CECR_DESCRIPTEURS[lvl] || CECR_DESCRIPTEURS["B1"];
      const discrete = GRILLES_DISCRETES.PO[lvl]?.discrete || "0, 1, 2.5, 4, 5";

      const ai = new GoogleGenAI({ apiKey });
      const systemInstruction = `Jury DELF/DALF (${lvl}).
Descripteurs CECR applicables: ${descr}
Utilise STRICTEMENT les notes discrètes suivantes: ${discrete}.
Dans "transcription_html", marque les erreurs par catégorie: <span class="err-item err-[task|lexique|morphosyntaxe|phonologique]" style="color:#d93025; font-weight:bold; background-color:#fee2e2; padding:2px 4px;">erreur [type -> correction]</span>.
Chaque rubrique doit avoir des POINTS POSITIFS et POINTS À AMÉLIORER dans "error", et un conseil dans "supra".

JSON STRICT:
{
  "score_global": "15/25",
  "status": "${lvl} Acquis",
  "transcription_html": "texte...",
  "rubriques": {
    "production_orale_task": { "score": "3.5/5", "error": "POINTS POSITIFS:...\\nPOINTS À AMÉLIORER:...", "supra": "Conseil..." },
    "lexique": { "score": "3.5/5", "error": "POINTS POSITIFS:...\\nPOINTS À AMÉLIORER:...", "supra": "Conseil..." },
    "morphosyntaxe": { "score": "4/5", "error": "POINTS POSITIFS:...\\nPOINTS À AMÉLIORER:...", "supra": "Conseil..." },
    "phonologique": { "score": "4/5", "error": "POINTS POSITIFS:...\\nPOINTS À AMÉLIORER:...", "supra": "Conseil..." }
  }
}`;

      let contents = [];
      if (audioBase64) contents.push({ inlineData: { data: audioBase64.replace(/^data:audio\/[a-z0-9]+;base64,/, ""), mimeType: mimeType || "audio/webm" } });
      contents.push({ text: prompt || text || `Évalue cet enregistrement PO selon la grille ${lvl}.` });

      const response = await ai.models.generateContent({ model: "gemini-2.5-flash", contents, config: { systemInstruction, responseMimeType: "application/json" } });
      let cleanText = response.text.trim();
      const fb = cleanText.indexOf("{"), lb = cleanText.lastIndexOf("}");
      if (fb !== -1 && lb !== -1) cleanText = cleanText.substring(fb, lb + 1);

      return res.status(200).json(JSON.parse(cleanText));
    } catch (err) {
      return res.status(500).json({ error: "Error PO: " + err.message });
    }
  });
});

exports.procesarTextoPE = onRequest({ cors: true, timeoutSeconds: 60 }, (req, res) => {
  return cors(req, res, async () => {
    if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });
    try {
      const apiKey = process.env.GEMINI_API_KEY || "";
      const { texto, nivel, consigne } = req.body || {};
      const lvl = (nivel || "B1").toUpperCase().trim();
      const cfg = GRILLES_PE_CFG = GRILLES_DISCRETES.PE[lvl] || GRILLES_DISCRETES.PE["B1"];
      const descr = CECR_DESCRIPTEURS[lvl] || CECR_DESCRIPTEURS["B1"];

      const wordCount = (texto || "").trim().split(/\s+/).filter(w => w.length > 0).length;
      if (wordCount < cfg.minWords) {
        return res.status(200).json({
          score_global: `0/${cfg.total}`,
          status: `${lvl} Non Acquis`,
          transcription_html: texto,
          rubriques: { task: { score: `0`, error: `Pénalité : Moins de 50% des mots requis (${wordCount}/${cfg.minWords} mots min).`, supra: "Atteindre le nombre de mots minimal." } }
        });
      }

      const ai = new GoogleGenAI({ apiKey });
      const systemInstruction = `Jury DELF PE (${lvl}). Descripteurs CECR: ${descr}.
Utilise UNIQUEMENT les notes discrètes: ${cfg.discrete}.
Marque les erreurs dans "transcription_html" avec: <span style="color:#d93025; font-weight:bold; background-color:#fee2e2;">erreur [type -> correction]</span>.

JSON STRICT:
{
  "score_global": "18/25",
  "status": "${lvl} Acquis",
  "transcription_html": "Texte corrigé...",
  "rubriques": {
    "task": { "score": "3/5", "error": "Diagnostic...", "supra": "Conseil..." },
    "coherence": { "score": "3/5", "error": "Diagnostic...", "supra": "Conseil..." },
    "lexique": { "score": "3/5", "error": "Diagnostic...", "supra": "Conseil..." },
    "morphosyntaxe": { "score": "3/5", "error": "Diagnostic...", "supra": "Conseil..." }
  }
}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ text: `Consigne: ${consigne || "PE"}\n\nTexte: ${texto}` }],
        config: { systemInstruction, responseMimeType: "application/json" }
      });

      let cleanText = response.text.trim();
      const fb = cleanText.indexOf("{"), lb = cleanText.lastIndexOf("}");
      if (fb !== -1 && lb !== -1) cleanText = cleanText.substring(fb, lb + 1);

      return res.status(200).json(JSON.parse(cleanText));
    } catch (err) {
      return res.status(500).json({ error: "Error PE: " + err.message });
    }
  });
});
