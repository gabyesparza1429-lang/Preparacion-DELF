(function () {
  if (window.__SOPHIA_UNIFIED_LOADED__) return;
  window.__SOPHIA_UNIFIED_LOADED__ = true;

  const METAS_PALABRAS = {
    A1: 40,
    A2: 60,
    B1: 160,
    B2: 250,
    C1: 250
  };

  function obtenerNivelActual() {
    return String(window.currentLevel || "B1").toUpperCase().replace(/[^A-Z0-9]/g, "") || "B1";
  }

  window.__SOPHIA_REAL_STUDENT_NAME__ = null;

  async function resolverNombreAlumnoReal() {
    if (window.__SOPHIA_REAL_STUDENT_NAME__) return window.__SOPHIA_REAL_STUDENT_NAME__;
    const studentId = window.urlId || new URLSearchParams(window.location.search).get("id") || "";
    try {
      if (studentId && studentId !== "admin_preview" && window.db && window.doc && window.getDoc) {
        const snap = await window.getDoc(window.doc(window.db, "Usuarios", studentId));
        if (snap.exists()) {
          const d = snap.data();
          const nombre = d.nombre || d.name || d.alumno || "";
          if (nombre && String(nombre).trim()) {
            window.__SOPHIA_REAL_STUDENT_NAME__ = String(nombre).trim();
            return window.__SOPHIA_REAL_STUDENT_NAME__;
          }
        }
      }
    } catch (e) {}
    return obtenerNombreAlumno();
  }

  function obtenerNombreAlumno() {
    if (window.__SOPHIA_REAL_STUDENT_NAME__) return window.__SOPHIA_REAL_STUDENT_NAME__;
    const el = document.getElementById("student-welcome") || document.getElementById("welcome-message") || document.querySelector(".student-name");
    if (el && el.innerText) {
      const limpio = el.innerText.replace(/Élève\s*:/i, "").replace(/Bienvenue\s*,?/i, "").trim();
      if (limpio && limpio.length > 1) return limpio;
    }
    const idParam = new URLSearchParams(window.location.search).get("id") || window.urlId || "";
    if (idParam && idParam !== "admin_preview") {
      const base = idParam.replace(/[0-9]/g, "");
      if (base) return base.charAt(0).toUpperCase() + base.slice(1);
    }
    return "Élève";
  }

  function obtenerConsignaActual(skill) {
    try {
      const uId = window.currentUnitId;
      const idx = Number(window.currentExerciseIndex || 0);
      if (window.unidadesCache && uId && window.unidadesCache[uId]) {
        const lista = window.unidadesCache[uId][skill] || window.unidadesCache[uId][skill.toLowerCase()] || [];
        if (lista[idx]) {
          return lista[idx].consigne || lista[idx].sujet || lista[idx].instruccion || lista[idx].titre || "";
        }
      }
    } catch (e) {}
    const sujetEl = document.querySelector(".sujet-card") || document.querySelector(".consigne-box") || document.getElementById("sujet-container");
    if (sujetEl && sujetEl.innerText.trim().length > 10) return sujetEl.innerText.trim();
    return skill === "PO" ? "Production orale officielle DELF" : "Production écrite officielle DELF";
  }

  function contarPalabras(texto) {
    if (!texto || !texto.trim()) return 0;
    return texto.trim().split(/\s+/).filter(Boolean).length;
  }

  // =========================================================
  // 1. CONTADOR DE PALABRAS EN VIVO PARA PRODUCTION ÉCRITE
  // =========================================================
  function actualizarContadorPalabras(ta) {
    if (!ta) return;
    let barra = document.getElementById("pe-word-counter-bar");
    if (!barra) {
      barra = document.createElement("div");
      barra.id = "pe-word-counter-bar";
      barra.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-top:8px; margin-bottom:12px; padding:8px 14px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; font-family:'Montserrat', sans-serif; font-size:0.88rem; color:#334155;";
      ta.insertAdjacentElement("afterend", barra);
    }
    const nivel = obtenerNivelActual();
    const meta = METAS_PALABRAS[nivel] || 160;
    const total = contarPalabras(ta.value);
    const cumplido = total >= meta;
    const color = cumplido ? "#166534" : (total > 0 ? "#b45309" : "#475569");
    const bgBadge = cumplido ? "#dcfce7" : (total > 0 ? "#fef3c7" : "#e2e8f0");
    const estado = cumplido
      ? `<i class="fas fa-check-circle"></i> Minimum atteint (${meta} mots requis)`
      : `Objectif DELF ${nivel} : ${meta} mots minimum`;

    barra.innerHTML = `
      <span style="font-weight:700; color:${color};">
        <i class="fas fa-pen-nib"></i> Nombre de mots : <span style="background:${bgBadge}; padding:2px 10px; border-radius:12px; font-size:0.95rem;">${total}</span>
      </span>
      <span style="font-size:0.82rem; font-weight:600; color:${color};">${estado}</span>
    `;
  }

  document.addEventListener("input", function (e) {
    if (e.target && (e.target.id === "pe-student-response" || e.target.id === "textarea-pe" || e.target.tagName === "TEXTAREA")) {
      actualizarContadorPalabras(e.target);
    }
  });

  const observadorDOM = new MutationObserver(function () {
    const ta = document.getElementById("pe-student-response") || document.getElementById("textarea-pe");
    if (ta && !document.getElementById("pe-word-counter-bar")) {
      actualizarContadorPalabras(ta);
    }
  });
  observadorDOM.observe(document.documentElement, { childList: true, subtree: true });

  // =========================================================
  // 2. NORMALIZADOR Y RENDERIZADOR OFICIAL DEL REPORTE (0, 1, 3, 5)
  // =========================================================
  function normalizarObjetoEvaluacion(raw) {
    if (!raw) return null;
    let obj = raw;
    let saludoPrevio = "";

    if (typeof obj === "string") {
      let limpio = obj.replace(/```json/gi, "").replace(/```/g, "").trim();
      const ini = limpio.indexOf("{");
      const fin = limpio.lastIndexOf("}");
      if (ini !== -1 && fin !== -1 && fin > ini) {
        saludoPrevio = limpio.slice(0, ini).replace(/Aquí te presento mi evaluación detallada.*$/i, "").trim();
        limpio = limpio.slice(ini, fin + 1);
      }
      try {
        obj = JSON.parse(limpio);
      } catch (e) {
        return { legacy_html: raw };
      }
    }

    if (obj && obj.respuesta_ia) {
      return normalizarObjetoEvaluacion(obj.respuesta_ia);
    }
    if (!obj || typeof obj !== "object") {
      return { legacy_html: typeof raw === "string" ? raw : JSON.stringify(raw) };
    }

    const listaCrit = Array.isArray(obj.criterios) ? obj.criterios : (Array.isArray(obj.criteres) ? obj.criteres : null);
    if (!listaCrit) {
      return { legacy_html: typeof raw === "string" ? raw : JSON.stringify(raw) };
    }

    const permitidos = [0, 1, 3, 5];
    let suma = 0;
    const criteriosNorm = listaCrit.map((c, idx) => {
      let n = Number(c.nota !== undefined ? c.nota : c.note);
      if (!permitidos.includes(n)) {
        n = permitidos.reduce((prev, curr) => Math.abs(curr - n) < Math.abs(prev - n) ? curr : prev, 3);
      }
      suma += n;
      const etiqueta = n === 0 ? "INSUFFISANT" : (n === 1 ? "EN DESSOUS" : (n === 3 ? "AU NIVEAU" : "SUPRA"));
      return {
        nombre: c.nombre || c.nom || `Critère ${idx + 1}`,
        nota: n,
        etiqueta,
        apreciacion: c.apreciacion || c.commentaire || ""
      };
    });

    const listaErr = Array.isArray(obj.errores) ? obj.errores : (Array.isArray(obj.erreurs) ? obj.erreurs : []);
    const erroresNorm = listaErr.map((e) => ({
      original: e.original || "",
      correccion: e.correccion || e.correction || "",
      explicacion: e.explicacion || e.explication || ""
    }));

    const listaRec = Array.isArray(obj.recomendaciones_supra)
      ? obj.recomendaciones_supra
      : (Array.isArray(obj.recommandations) ? obj.recommandations : (Array.isArray(obj.recomendaciones) ? obj.recomendaciones : []));

    return {
      nivel: obj.nivel || obj.niveau || obtenerNivelActual(),
      eleve: obj.eleve || obtenerNombreAlumno(),
      palabras: obj.palabras || obj.mots || 0,
      nota_total: suma,
      admis: suma >= 13,
      veredicto: obj.veredicto || obj.verdict || "",
      criterios: criteriosNorm,
      errores: erroresNorm,
      recomendaciones_supra: listaRec,
      recursos_linguistiques: obj.recursos_linguistiques || null,
      comentario_general: obj.comentario_general || obj.commentaire_general || saludoPrevio || ""
    };
  }

  window.renderizarReporteDELF = function (rawPayload, opciones) {
    const opts = opciones || {};
    const data = normalizarObjetoEvaluacion(rawPayload);
    if (!data) return "";

    if (data.legacy_html) {
      return `<div style="background:#fff; border:1px solid #cbd5e1; border-radius:10px; padding:20px; line-height:1.6; color:#1e293b;">${data.legacy_html}</div>`;
    }

    const nivel = data.nivel || obtenerNivelActual();
    const eleve = data.eleve || obtenerNombreAlumno();
    const subInfo = opts.skill === "PO"
      ? "Production Orale"
      : `${data.palabras || opts.palabras || 0} mots`;

    let suma = 0;
    const filasHTML = (data.criterios || []).map((c) => {
      const n = Number(c.nota) || 0;
      suma += n;
      let badgeBg = "#fee2e2";
      let badgeColor = "#991b1b";
      let badgeText = c.etiqueta || "INSUFFISANT";
      if (n === 1) {
        badgeBg = "#fef3c7";
        badgeColor = "#92400e";
        badgeText = "EN DESSOUS";
      } else if (n === 3) {
        badgeBg = "#e0f2fe";
        badgeColor = "#075985";
        badgeText = "AU NIVEAU";
      } else if (n === 5) {
        badgeBg = "#dcfce7";
        badgeColor = "#166534";
        badgeText = "SUPRA";
      }

      return `
        <tr>
          <td style="padding:14px 12px; border-bottom:1px solid #e2e8f0; font-weight:700; color:#1e293b; width:26%; vertical-align:top;">
            ${c.nombre}
          </td>
          <td style="padding:14px 10px; border-bottom:1px solid #e2e8f0; text-align:center; width:16%; vertical-align:top;">
            <div style="font-size:1.35rem; font-weight:800; color:#0f172a; line-height:1.1;">${n} / 5</div>
            <span style="display:inline-block; margin-top:5px; padding:3px 8px; border-radius:6px; font-size:0.7rem; font-weight:800; letter-spacing:0.3px; background:${badgeBg}; color:${badgeColor};">
              ${badgeText}
            </span>
          </td>
          <td style="padding:14px 12px; border-bottom:1px solid #e2e8f0; color:#334155; font-size:0.9rem; line-height:1.55; vertical-align:top;">
            ${c.apreciacion || ""}
          </td>
        </tr>`;
    }).join("");

    const notaFinal = typeof data.nota_total === "number" ? data.nota_total : suma;
    const admis = notaFinal >= 13;
    const verdictBg = admis ? "#f0fdf4" : "#fef2f2";
    const verdictBorder = admis ? "#86efac" : "#fca5a5";
    const verdictColor = admis ? "#166534" : "#991b1b";
    const verdictTexto = data.veredicto || (admis
      ? `Verdict : Niveau ${nivel} Atteint / Validé (Admis)`
      : `Verdict : Niveau ${nivel} Non Atteint (À renforcer)`);

    const audioPlayerHTML = opts.audioUrl
      ? `<div style="margin-bottom:16px; padding:12px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px;">
           <div style="font-weight:700; font-size:0.85rem; color:#0f172a; margin-bottom:6px;"><i class="fas fa-headphones"></i> Enregistrement évalué :</div>
           <audio controls src="${opts.audioUrl}" style="width:100%; height:36px;"></audio>
         </div>`
      : "";

    const erroresLista = Array.isArray(data.errores) ? data.errores : [];
    const erroresHTML = erroresLista.length > 0
      ? `<div style="margin-top:20px; background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:16px;">
           <h4 style="margin:0 0 12px 0; color:#b91c1c; font-size:0.98rem; font-weight:800;">
             <i class="fas fa-times-circle"></i> Erreurs identifiées et Corrections
           </h4>
           ${erroresLista.map((err) => `
             <div style="background:#ffffff; border:1px solid #fecaca; border-radius:6px; padding:10px 12px; margin-bottom:8px; font-size:0.88rem; line-height:1.5;">
               <div style="color:#dc2626;"><strong>Original :</strong> <span style="text-decoration:line-through;">"${err.original || ""}"</span></div>
               <div style="color:#15803d; margin-top:3px;"><strong>Correction :</strong> "${err.correccion || ""}"</div>
               ${err.explicacion ? `<div style="color:#475569; font-size:0.82rem; margin-top:3px;"><em>${err.explicacion}</em></div>` : ""}
             </div>
           `).join("")}
         </div>`
      : "";

    const supraLista = Array.isArray(data.recomendaciones_supra) ? data.recomendaciones_supra : [];
    const supraHTML = supraLista.length > 0
      ? `<div style="margin-top:18px; background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:16px;">
           <h4 style="margin:0 0 10px 0; color:#b45309; font-size:0.98rem; font-weight:800;">
             <i class="fas fa-award"></i> Recommandations pour le Niveau SUPRA (5/5)
           </h4>
           <ul style="margin:0; padding-left:18px; color:#78350f; font-size:0.88rem; line-height:1.55;">
             ${supraLista.map((rec) => `<li style="margin-bottom:6px;">${rec}</li>`).join("")}
           </ul>
         </div>`
      : "";

    const comentarioHTML = data.comentario_general
      ? `<div style="margin-bottom:18px; padding:14px 16px; background:#f8fafc; border-left:4px solid #0f172a; border-radius:6px; color:#1e293b; font-size:0.92rem; line-height:1.6;">
           <strong style="color:#0f172a;"><i class="fas fa-comment-dots"></i> Commentaire du jury (Sophia) :</strong> ${data.comentario_general}
         </div>`
      : "";

    const fallbackPorNivel = {
      A1: {
        conectores: ["D'abord (primero)", "Ensuite (después)", "Mais (pero)", "Parce que (porque)", "Enfin (finalmente)"],
        verbos: ["aimer (gustar/amar)", "préférer (preferir)", "vouloir (querer)", "pouvoir (poder)", "devoir (deber)"],
        adjetivos: ["intéressant (interesante)", "facile (fácil)", "difficile (difícil)", "important (importante)", "agréable (agradable)"],
        vocabulario: ["à mon avis (en mi opinión)", "tous les jours (todos los días)", "de temps en temps (de vez en cuando)"]
      },
      A2: {
        conectores: ["Premièrement (en primer lugar)", "De plus (además)", "Cependant (sin embargo)", "C'est pourquoi (por eso)", "En conclusion (en conclusión)"],
        verbos: ["conseiller de (aconsejar)", "apprendre à (aprender a)", "s'améliorer (mejorar)", "pratiquer (practicar)", "partager (compartir)"],
        adjetivos: ["efficace (eficaz)", "utile (útil)", "motivé(e) (motivado/a)", "régulier/régulière (regular)", "enrichissant(e) (enriquecedor/a)"],
        vocabulario: ["faire des progrès (hacer progresos)", "prendre l'habitude de (acostumbrarse a)", "avoir l'occasion de (tener la oportunidad de)"]
      },
      B1: {
        conectores: ["D'une part... d'autre part (por una parte... por otra parte)", "En revanche (en cambio)", "Par conséquent (por consiguiente)", "Grâce à (gracias a)", "En somme (en resumen)"],
        verbos: ["maîtriser (dominar)", "approfondir (profundizar)", "surmonter (superar)", "recommander de (recomendar)", "s'entraîner à (entrenarse en)"],
        adjetivos: ["indispensable (indispensable)", "pertinent(e) (pertinente)", "enrichissant(e) (enriquecedor/a)", "autonome (autónomo/a)", "structuré(e) (estructurado/a)"],
        vocabulario: ["la maîtrise de la langue (el dominio del idioma)", "mettre en pratique (poner en práctica)", "à long terme (a largo plazo)", "tenir compte de (tener en cuenta)"]
      },
      B2: {
        conectores: ["Néanmoins (no obstante)", "En outre (además)", "Force est de constater que (hay que constatar que)", "De surcroît (por añadidura)", "En définitive (en definitiva)"],
        verbos: ["souligner (subrayar)", "favoriser (favorecer)", "remédier à (remediar)", "s'avérer (resultar)", "consolider (consolidar)"],
        adjetivos: ["primordial(e) (primordial)", "judicieux/judicieuse (acertado/a)", "probant(e) (convincente)", "incontournable (imprescindible)"],
        vocabulario: ["tirer profit de (sacar provecho de)", "à cet égard (a este respecto)", "en ce qui concerne (en lo que respecta a)"]
      }
    };
    const rawRec = data.recursos_linguistiques || {};
    const defRec = fallbackPorNivel[nivel] || fallbackPorNivel.B1;
    const rec = {
      conectores: (Array.isArray(rawRec.conectores) && rawRec.conectores.length) ? rawRec.conectores : defRec.conectores,
      verbos: (Array.isArray(rawRec.verbos) && rawRec.verbos.length) ? rawRec.verbos : defRec.verbos,
      adjetivos: (Array.isArray(rawRec.adjetivos) && rawRec.adjetivos.length) ? rawRec.adjetivos : defRec.adjetivos,
      vocabulario: (Array.isArray(rawRec.vocabulario) && rawRec.vocabulario.length) ? rawRec.vocabulario : defRec.vocabulario
    };
    const tieneRecursos = true;

    const renderChips = (arr) => (arr || []).map((item) =>
      `<span style="display:inline-block; background:#ffffff; border:1px solid #bfdbfe; color:#1e3a8a; padding:4px 10px; border-radius:14px; font-size:0.82rem; font-weight:600; margin:3px 4px 3px 0;">${item}</span>`
    ).join("");

    const recursosHTML = tieneRecursos
      ? `<div style="margin-top:18px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:16px;">
           <h4 style="margin:0 0 12px 0; color:#1d4ed8; font-size:0.98rem; font-weight:800;">
             <i class="fas fa-toolbox"></i> Boîte à outils linguistiques (Connecteurs, Verbes, Adjectifs & Vocabulaire)
           </h4>
           ${rec.conectores && rec.conectores.length ? `<div style="margin-bottom:10px;"><div style="font-size:0.82rem; font-weight:800; color:#1e40af; margin-bottom:4px;"><i class="fas fa-link"></i> Connecteurs logiques :</div><div>${renderChips(rec.conectores)}</div></div>` : ""}
           ${rec.verbos && rec.verbos.length ? `<div style="margin-bottom:10px;"><div style="font-size:0.82rem; font-weight:800; color:#1e40af; margin-bottom:4px;"><i class="fas fa-bolt"></i> Verbes utiles :</div><div>${renderChips(rec.verbos)}</div></div>` : ""}
           ${rec.adjetivos && rec.adjetivos.length ? `<div style="margin-bottom:10px;"><div style="font-size:0.82rem; font-weight:800; color:#1e40af; margin-bottom:4px;"><i class="fas fa-sparkles"></i> Adjectifs et nuances :</div><div>${renderChips(rec.adjetivos)}</div></div>` : ""}
           ${rec.vocabulario && rec.vocabulario.length ? `<div><div style="font-size:0.82rem; font-weight:800; color:#1e40af; margin-bottom:4px;"><i class="fas fa-book-open"></i> Vocabulaire et expressions clés :</div><div>${renderChips(rec.vocabulario)}</div></div>` : ""}
         </div>`
      : "";

    return `
      <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:10px; overflow:hidden; box-shadow:0 4px 14px rgba(15,23,42,0.08); font-family:'Montserrat', sans-serif; margin-top:16px;">
        <div style="background:#0f172a; color:#ffffff; padding:16px 20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div>
            <div style="font-size:1.1rem; font-weight:800; letter-spacing:0.2px;">Rapport d'Évaluation DELF - Niveau ${nivel}</div>
            <div style="font-size:0.82rem; color:#cbd5e1; margin-top:2px;">Élève : ${eleve} | ${subInfo}</div>
          </div>
          <div style="font-size:1.45rem; font-weight:900; color:#ffffff;">${notaFinal} / 25</div>
        </div>

        <div style="padding:18px 20px;">
          ${audioPlayerHTML}
          <div style="background:${verdictBg}; border:1px solid ${verdictBorder}; color:${verdictColor}; padding:10px 14px; border-radius:6px; text-align:center; font-weight:800; font-size:0.92rem; margin-bottom:16px;">
            ${verdictTexto.startsWith("Verdict") ? verdictTexto : "Verdict : " + verdictTexto}
          </div>

          ${comentarioHTML}

          <table style="width:100%; border-collapse:collapse; text-align:left;">
            <thead>
              <tr style="background:#f8fafc; border-bottom:2px solid #cbd5e1;">
                <th style="padding:10px 12px; color:#334155; font-size:0.85rem;">Critère</th>
                <th style="padding:10px; color:#334155; font-size:0.85rem; text-align:center;">Note</th>
                <th style="padding:10px 12px; color:#334155; font-size:0.85rem;">Appréciation</th>
              </tr>
            </thead>
            <tbody>
              ${filasHTML}
            </tbody>
          </table>

          ${erroresHTML}
          ${recursosHTML}
          ${supraHTML}
        </div>
      </div>`;
  };

  window.mostrarEvaluacionSophia = function (payload, skill, audioUrl) {
    const sBox = document.getElementById("sophia-box");
    const vText = document.getElementById("sophia-verdict-text");
    if (sBox) sBox.style.display = "block";
    if (vText) {
      vText.innerHTML = window.renderizarReporteDELF(payload, {
        skill: skill || window.currentSkill || "PE",
        audioUrl: audioUrl || ""
      });
    }
  };

  window.mostrarEvaluacionOralSophia = function (payload, audioUrl) {
    window.mostrarEvaluacionSophia(payload, "PO", audioUrl);
  };

  // =========================================================
  // 3. LLAMADA A CLOUD RUN V2
  // =========================================================
  async function llamarFuncionNube(nombreFuncion, payload) {
    const mapaRun = {
      procesarTextoPE: "https://procesartextope-iq4wsljhqq-uc.a.run.app",
      procesarAudioPO: "https://procesaraudiopo-iq4wsljhqq-uc.a.run.app",
        simularInteraccionPO: "https://simularinteraccionpo-iq4wsljhqq-uc.a.run.app"
    };
    const urls = [
      mapaRun[nombreFuncion],
      `https://us-central1-objectif-reussite-delf.cloudfunctions.net/${nombreFuncion}`
    ].filter(Boolean);

    let ultimoError = null;
    for (const url of urls) {
      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const text = await resp.text();
        let data = {};
        try { data = JSON.parse(text); } catch (e) { data = { error: text }; }
        if (resp.ok) return data;
        ultimoError = new Error(data.error || `HTTP ${resp.status}`);
      } catch (err) {
        ultimoError = err;
      }
    }
    throw ultimoError || new Error("Error de conexión con Sophia.");
  }

  // =========================================================
  // 4. HISTORIAL DE HASTA 3 INTENTOS + ACORDEÓN + PROGRESO
  // =========================================================
  function obtenerAlumnoId() {
    return window.urlId || new URLSearchParams(window.location.search).get("id") || "";
  }
  async function obtenerIntentosActividad(uId, eIdx, skill, modalidad) {
    const lista = [];
    const uid = obtenerAlumnoId();
    if (!uid || !window.db || !window.collection) return lista;
    try {
      const ref = window.collection(window.db, "Usuarios", uid, "HistorialSophia");
      const snap = await window.getDocs(ref);
      snap.forEach((d) => {
        const data = d.data() || {};
        if (
          String(data.unidad) === String(uId) &&
          Number(data.actividad) === Number(eIdx) &&
          String(data.habilidad).toUpperCase() === String(skill).toUpperCase()
        ) {
          const esInter = data.modalidad === "interaccion" || String(data.texto_alumno || "").startsWith("Examinateur:");
          if (modalidad === "interaccion" && !esInter) return;
          if (modalidad === "audio" && esInter) return;
          lista.push({ id: d.id, ...data });
        }
      });
      lista.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    } catch (e) {
      console.warn("Error leyendo HistorialSophia:", e);
    }
    return lista;
  }

  function actualizarEstadoBotonIntentos(skill, cantidad) {
    const btnPE = document.getElementById("btn-submit-pe") || document.getElementById("btn-evaluar-sophia");
    const btnPO = document.getElementById("btn-evaluar-audio-sophia") || document.getElementById("btn-submit-po");
    const btn = skill === "PO" ? btnPO : btnPE;
    if (!btn) return;

    if (cantidad >= 3) {
      btn.disabled = true;
      btn.style.opacity = "0.55";
      btn.style.cursor = "not-allowed";
      btn.innerHTML = `<i class="fas fa-lock"></i> Limite de 3 tentatives atteint (3/3)`;
    } else {
      btn.disabled = false;
      btn.style.opacity = "1";
      btn.style.cursor = "pointer";
      const restante = cantidad > 0 ? ` (${cantidad}/3)` : "";
      btn.innerHTML = skill === "PO"
        ? `<i class="fas fa-paper-plane"></i> Évaluer ma production orale${restante}`
        : `<i class="fas fa-paper-plane"></i> Soumettre la production${restante}`;
    }
  }

  function renderizarAcordeonHistorial(intentos, skill) {
    if (!intentos || intentos.length <= 1) return "";
    let html = `
      <div style="margin-top:24px; padding-top:16px; border-top:2px dashed #cbd5e1; font-family:'Montserrat', sans-serif;">
        <h4 style="color:#0f172a; font-size:1rem; margin:0 0 12px 0;">
          <i class="fas fa-history"></i> Historique des tentatives précédentes (${intentos.length - 1})
        </h4>`;

    for (let i = 0; i < intentos.length - 1; i++) {
      const item = intentos[i];
      const obj = normalizarObjetoEvaluacion(item.respuesta_ia);
      const score = obj && typeof obj.nota_total === "number" ? `${obj.nota_total} / 25` : "Évalué";
      const fecha = item.fecha || "";
      const detalleHTML = window.renderizarReporteDELF(item.respuesta_ia, { skill, audioUrl: item.audio_url || "" });
      const textoPrevio = item.texto_alumno
        ? `<div style="background:#f8fafc; padding:10px 12px; border-radius:6px; border:1px solid #e2e8f0; margin-bottom:10px; font-size:0.88rem; color:#334155;">
             <strong>Texte soumis :</strong><br>${item.texto_alumno.replace(/\n/g, "<br>")}
           </div>`
        : "";

      html += `
        <details style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:10px 14px; margin-bottom:10px;">
          <summary style="cursor:pointer; font-weight:700; color:#0f172a; font-size:0.92rem; display:flex; justify-content:space-between; align-items:center;">
            <span><i class="fas fa-folder-open" style="color:#0284c7;"></i> Tentative ${i + 1} ${fecha ? `(${fecha})` : ""}</span>
            <span style="background:#e2e8f0; color:#0f172a; padding:2px 10px; border-radius:12px; font-size:0.85rem;">Note : ${score}</span>
          </summary>
          <div style="margin-top:12px;">
            ${textoPrevio}
            ${detalleHTML}
          </div>
        </details>`;
    }
    html += `</div>`;
    return html;
  }

  window.recuperarEvaluacionGuardada = async function (uId, eIdx, skill) {
    const unit = uId || window.currentUnitId;
    const idx = eIdx !== undefined ? eIdx : window.currentExerciseIndex;
    const sk = skill || window.currentSkill || "PE";
    if (!unit) return;

    try {
      const intentos = await obtenerIntentosActividad(unit, idx, sk);
      actualizarEstadoBotonIntentos(sk, intentos.length);

      if (intentos.length > 0) {
        const ultimo = intentos[intentos.length - 1];
        const ta = document.getElementById("pe-student-response") || document.getElementById("textarea-pe");
        if (sk === "PE" && ta && ultimo.texto_alumno) {
          ta.value = ultimo.texto_alumno;
          actualizarContadorPalabras(ta);
        }

        const sBox = document.getElementById("sophia-box");
        const vText = document.getElementById("sophia-verdict-text");
        if (sBox) sBox.style.display = "block";
        if (vText) {
          const reportePrincipal = window.renderizarReporteDELF(ultimo.respuesta_ia, {
            skill: sk,
            audioUrl: ultimo.audio_url || ""
          });
          const acordeon = renderizarAcordeonHistorial(intentos, sk);
          vText.innerHTML = reportePrincipal + acordeon;
        }
      }
    } catch (err) {
      console.error("Error cargando historial:", err);
    }
  };

  async function guardarResultadoYMarcarHecho(skill, datosExtra) {
    const studentId = window.urlId || new URLSearchParams(window.location.search).get("id");
    const uId = window.currentUnitId || "Unite_1";
    const eIdx = Number(window.currentExerciseIndex || 0);
    const llaveProgreso = `${uId}_${skill}_${eIdx}`;

    if (typeof window.mapaAciertosAlumno === "object" && window.mapaAciertosAlumno !== null) {
      window.mapaAciertosAlumno[llaveProgreso] = true;
    }

    if (!studentId || studentId === "admin_preview" || !window.db) return;

    try {
      await window.addDoc(window.collection(window.db, "Usuarios", studentId, "HistorialSophia"), {
        fecha: new Date().toISOString().split("T")[0],
        timestamp: Date.now(),
        tipo: skill === "PO" ? "Production_Orale" : "Production_Escrita",
        habilidad: skill,
        unidad: uId,
        actividad: eIdx,
        ...datosExtra
      });

      const userRef = window.doc(window.db, "Usuarios", studentId);
      let totalActsNivel = 0;
      let completadasNivel = 0;
      const mapaActual = Object.assign({}, window.mapaAciertosAlumno || {}, { [llaveProgreso]: true });

      if (window.unidadesCache && typeof window.unidadesCache === "object") {
        Object.keys(window.unidadesCache).forEach((uk) => {
          const uObj = window.unidadesCache[uk] || {};
          ["CO", "CE", "PE", "PO"].forEach((sk) => {
            const arr = uObj[sk] || uObj[sk.toLowerCase()] || [];
            if (Array.isArray(arr)) {
              arr.forEach((_, i) => {
                totalActsNivel++;
                if (
                  mapaActual[`${uk}_${sk}_${i}`] === true ||
                  mapaActual[`${uk}_${sk.toLowerCase()}_${i}`] === true
                ) {
                  completadasNivel++;
                }
              });
            }
          });
        });
      }

      const updatePayload = {
        mapa_aciertos: { [llaveProgreso]: true }
      };

      if (totalActsNivel > 0) {
        const pct = Math.min(100, Math.round((completadasNivel / totalActsNivel) * 100));
        updatePayload.progreso = pct;
        const pTxt = document.getElementById("progress-text-target");
        const pBar = document.getElementById("progress-bar-fill");
        if (pTxt) pTxt.innerText = `${pct}%`;
        if (pBar) pBar.style.width = `${pct}%`;
      }

      await window.setDoc(userRef, updatePayload, { merge: true });

      if (typeof window.generarMenuJerarquico === "function") window.generarMenuJerarquico();
      if (typeof window.calcularTodasLasNotasHabilidades === "function") await window.calcularTodasLasNotasHabilidades();
    } catch (err) {
      console.error("Error guardando progreso en Firestore:", err);
    }
  }

  // =========================================================
  // 5. GRABACIÓN DE AUDIO EN PRODUCTION ORALE (PO)
  // =========================================================
  window.audioStreamPO = null;
  window.mediaRecorderPO = null;
  window.audioChunksPO = [];
  window.recordedAudioBlobPO = null;
  window.isRecordingAudioPO = false;

  window.grabarPO = async function () {
    const btn = document.getElementById("btn-record-po");
    const feedback = document.getElementById("po-audio-feedback");

    if (!window.isRecordingAudioPO) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        window.audioStreamPO = stream;
        window.audioChunksPO = [];
        window.mediaRecorderPO = new MediaRecorder(stream);

        window.mediaRecorderPO.ondataavailable = function (ev) {
          if (ev.data && ev.data.size > 0) window.audioChunksPO.push(ev.data);
        };

        window.mediaRecorderPO.onstop = function () {
          const blob = new Blob(window.audioChunksPO, { type: window.mediaRecorderPO.mimeType || "audio/webm" });
          window.recordedAudioBlobPO = blob;
          const url = URL.createObjectURL(blob);
          if (feedback) {
            feedback.innerHTML = `
              <div style="margin-top:10px; padding:12px; background:#f0fdf4; border:1px solid #86efac; border-radius:8px;">
                <div style="color:#166534; font-weight:700; margin-bottom:6px;"><i class="fas fa-check-circle"></i> Enregistrement prêt pour l'évaluation :</div>
                <div style="font-size:0.85rem; color:#166534;">Prêt pour l'évaluation par Sophia.</div>
              </div>`;
          }
        };

        window.mediaRecorderPO.start();
        window.isRecordingAudioPO = true;
        if (btn) {
          btn.style.background = "#dc2626";
          btn.innerHTML = `<i class="fas fa-stop-circle"></i> Arrêter l'enregistrement`;
        }
        if (feedback) {
          feedback.innerHTML = `<div style="color:#dc2626; font-weight:700;"><i class="fas fa-circle fa-fade"></i> Enregistrement en cours... Parlez clairement dans votre microphone.</div>`;
        }
      } catch (err) {
        alert("Impossible d'accéder au microphone. Vérifiez les autorisations de votre navigateur.");
      }
    } else {
      window.isRecordingAudioPO = false;
      try {
        if (window.mediaRecorderPO && window.mediaRecorderPO.state !== "inactive") {
          window.mediaRecorderPO.stop();
        }
        if (window.audioStreamPO) {
          window.audioStreamPO.getTracks().forEach((t) => t.stop());
        }
      } catch (e) {}
      if (btn) {
        btn.style.background = "#0288d1";
        btn.innerHTML = `<i class="fas fa-microphone"></i> Ré-enregistrer`;
      }
    }
  };
  window.toggleAudioRecordingPO = window.grabarPO;

  document.addEventListener("change", function (e) {
    if (e.target && e.target.id === "po-file-input") {
      const file = e.target.files && e.target.files[0];
      if (file) {
        window.recordedAudioBlobPO = file;
        const url = URL.createObjectURL(file);
        const feedback = document.getElementById("po-audio-feedback");
        if (feedback) {
          feedback.innerHTML = `
            <div style="margin-top:10px; padding:12px; background:#f0fdf4; border:1px solid #86efac; border-radius:8px;">
              <div style="color:#166534; font-weight:700; margin-bottom:6px;"><i class="fas fa-file-audio"></i> Fichier audio prêt : ${file.name}</div>
              <div style="font-size:0.85rem; color:#166534;">Prêt pour l'évaluation par Sophia.</div>
            </div>`;
        }
      }
    }
  });

  function blobABase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || "").split(",")[1] || "");
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // =========================================================
  // 6. CAPTURA ÚNICA DE CLICS PARA EVALUAR PE Y PO
  // =========================================================
  document.addEventListener("click", async function (e) {
    const btnRec = e.target.closest("#btn-record-po");
    if (btnRec) {
      e.preventDefault();
      e.stopImmediatePropagation();
      await window.grabarPO();
      return;
    }

    const btnResetPO = e.target.closest("#btn-reset-po");
    if (btnResetPO) {
      e.preventDefault();
      e.stopImmediatePropagation();
      window.recordedAudioBlobPO = null;
      const inp = document.getElementById("po-file-input");
      if (inp) inp.value = "";
      const fb = document.getElementById("po-audio-feedback");
      if (fb) fb.innerHTML = "";
      return;
    }

    const btnAny = e.target.closest("button");
    const btnTxt = btnAny ? (btnAny.innerText || "").toLowerCase() : "";
    const btnPE = e.target.closest("#btn-submit-pe, #btn-evaluar-sophia") || (btnAny && (btnTxt.includes("soumettre la production") || btnTxt.includes("soumettre") && !btnTxt.includes("orale")) ? btnAny : null);
    if (btnPE) {
      e.preventDefault();
      e.stopImmediatePropagation();

      const ta = document.getElementById("pe-student-response") || document.getElementById("textarea-pe") || document.querySelector("textarea");
      const texto = ta ? ta.value.trim() : "";
      if (!texto) {
        alert("Veuillez rédiger votre production écrite avant de l'envoyer à Sophia.");
        return;
      }

      const uId = window.currentUnitId || "Unite_1";
      const eIdx = Number(window.currentExerciseIndex || 0);
      const intentosPrevios = await obtenerIntentosActividad(uId, eIdx, "PE");
      if (intentosPrevios.length >= 3) {
        actualizarEstadoBotonIntentos("PE", intentosPrevios.length);
        alert("Vous avez atteint la limite de 3 tentatives pour cette activité.");
        return;
      }

      btnPE.disabled = true;
      btnPE.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Sophia évalue votre texte...`;

      const sBox = document.getElementById("sophia-box");
      const vText = document.getElementById("sophia-verdict-text");
      if (sBox) sBox.style.display = "block";
      if (vText) {
        vText.innerHTML = `<div style="padding:20px; text-align:center; color:#0f172a; font-weight:700;"><i class="fas fa-spinner fa-spin fa-lg"></i> Sophia analyse votre texte selon la grille officielle DELF...</div>`;
        vText.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }

      try {
        const nivel = obtenerNivelActual();
        const nombreAlumno = await resolverNombreAlumnoReal();
        const consigne = obtenerConsignaActual("PE");
        const palabras = contarPalabras(texto);

        const resultado = await llamarFuncionNube("procesarTextoPE", {
          texto,
          consigne,
          nivel,
          nombreAlumno
        });

        await guardarResultadoYMarcarHecho("PE", {
          texto_alumno: texto,
          palabras,
          consigne,
          respuesta_ia: JSON.stringify(resultado)
        });

        const intentosActualizados = await obtenerIntentosActividad(uId, eIdx, "PE");
        const reporteHTML = window.renderizarReporteDELF(resultado, { skill: "PE", palabras });
        const acordeonHTML = renderizarAcordeonHistorial(intentosActualizados, "PE");
        if (vText) vText.innerHTML = reporteHTML + acordeonHTML;
        actualizarEstadoBotonIntentos("PE", intentosActualizados.length);
      } catch (err) {
        console.error("Error evaluando PE:", err);
        if (vText) {
          vText.innerHTML = `<div style="padding:15px; background:#fef2f2; border:1px solid #fecaca; color:#b91c1c; border-radius:8px;"><strong>Erreur :</strong> ${err.message}</div>`;
        }
        actualizarEstadoBotonIntentos("PE", intentosPrevios.length);
      }
      return;
    }

    const btnPO = e.target.closest("#btn-evaluar-audio-sophia, #btn-submit-po") || (btnAny && !btnAny.classList.contains("skill-tab-btn") && btnAny.id !== "skill-PO" && btnTxt.includes("évaluer ma production") ? btnAny : null);
    if (btnPO) {
      e.preventDefault();
      e.stopImmediatePropagation();

      if (window.isRecordingAudioPO) {
        await window.grabarPO();
        await new Promise((r) => setTimeout(r, 350));
      }

      const inp = document.getElementById("po-file-input");
      const audioBlob = window.recordedAudioBlobPO || (inp && inp.files && inp.files[0]);
      if (!audioBlob || audioBlob.size === 0) {
        alert("Veuillez d'abord enregistrer votre voix ou importer un fichier audio.");
        return;
      }

      const uId = window.currentUnitId || "Unite_1";
      const eIdx = Number(window.currentExerciseIndex || 0);
      const intentosPrevios = await obtenerIntentosActividad(uId, eIdx, "PO", "audio");
      if (intentosPrevios.length >= 3) {
        actualizarEstadoBotonIntentos("PO", intentosPrevios.length);
        alert("Vous avez atteint la limite de 3 tentatives pour cette activité.");
        return;
      }

      btnPO.disabled = true;
      btnPO.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Sophia écoute votre audio...`;

      const sBox = document.getElementById("sophia-box");
      const vText = document.getElementById("sophia-verdict-text");
      if (sBox) sBox.style.display = "block";
      if (vText) {
        vText.innerHTML = `<div style="padding:20px; text-align:center; color:#0f172a; font-weight:700;"><i class="fas fa-spinner fa-spin fa-lg"></i> Sophia écoute et évalue votre production orale selon la grille DELF...</div>`;
        vText.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }

      try {
        const audioBase64 = await blobABase64(audioBlob);
        const audioLocalUrl = URL.createObjectURL(audioBlob);
        const nivel = obtenerNivelActual();
        const nombreAlumno = await resolverNombreAlumnoReal();
        const consigne = obtenerConsignaActual("PO");

        const resultado = await llamarFuncionNube("procesarAudioPO", {
          audioBase64,
          mimeType: audioBlob.type || "audio/webm",
          consigne,
          nivel,
          nombreAlumno
        });

        await guardarResultadoYMarcarHecho("PO", {
          texto_alumno: resultado.transcripcion_breve || "Production orale enregistrée",
          consigne,
          respuesta_ia: JSON.stringify(resultado)
        });

        const intentosActualizados = await obtenerIntentosActividad(uId, eIdx, "PO", "audio");
        const reporteHTML = window.renderizarReporteDELF(resultado, { skill: "PO", audioUrl: audioLocalUrl });
        const acordeonHTML = renderizarAcordeonHistorial(intentosActualizados, "PO");
        if (vText) vText.innerHTML = reporteHTML + acordeonHTML;
        actualizarEstadoBotonIntentos("PO", intentosActualizados.length);
      } catch (err) {
        console.error("Error evaluando PO:", err);
        if (vText) {
          vText.innerHTML = `<div style="padding:15px; background:#fef2f2; border:1px solid #fecaca; color:#b91c1c; border-radius:8px;"><strong>Erreur :</strong> ${err.message}</div>`;
        }
        actualizarEstadoBotonIntentos("PO", intentosPrevios.length);
      }
    }
  }, true);


  window.estadoInteraccionPO = { activa: false, historial: [], turnosAlumno: 0 };

  function leerVozFrancesGratis(texto) {
    try {
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();

      const hablar = () => {
        const u = new SpeechSynthesisUtterance(texto);
        u.lang = "fr-FR";
        u.rate = 0.98;
        u.pitch = 1.04;

        const voces = window.speechSynthesis.getVoices() || [];
        const vocesFr = voces.filter((v) => v.lang && v.lang.toLowerCase().startsWith("fr"));
        // Priorizar voces naturales/neuronales de Google, Microsoft o Apple
        const vozNatural =
          vocesFr.find((v) => /natural|neural|google français|denise|vivienne|amélie|thomas|aurelie/i.test(v.name)) ||
          vocesFr.find((v) => v.lang.toLowerCase() === "fr-fr") ||
          vocesFr[0];
        if (vozNatural) u.voice = vozNatural;
        window.speechSynthesis.speak(u);
      };

      if ((window.speechSynthesis.getVoices() || []).length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          window.speechSynthesis.onvoiceschanged = null;
          hablar();
        };
      } else {
        hablar();
      }
    } catch (_) {}
  }

  async function invocarSimuladorNube(payload) {
    if (typeof llamarFuncionNube === "function") {
      return await llamarFuncionNube("simularInteraccionPO", payload);
    }
    const r = await fetch("https://simularinteraccionpo-iq4wsljhqq-uc.a.run.app", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Error HTTP " + r.status);
    return data;
  }

  function obtenerNivelSeguro() {
    if (typeof obtenerNivelActual === "function") return obtenerNivelActual();
    const txt = (document.body.innerText || "").match(/NIVEAU\s+(A1|A2|B1|B2|C1)/i);
    return txt ? txt[1].toUpperCase() : "B1";
  }

  function obtenerConsignaSegura() {
    // 1. Leer directamente desde .exercise-card (donde alumno.html pinta el sujeto, documento y preguntas)
    const card = document.querySelector(".exercise-card");
    if (card) {
      const clon = card.cloneNode(true);
      clon.querySelectorAll("#container-po-audio-dual, #container-po-interaccion-live, #btn-reset-po, #btn-submit-po, #sophia-box").forEach((n) => n.remove());
      const textoCard = (clon.innerText || "").replace(/Zone d'Examen Réel \(Blindé\)/gi, "").trim();
      if (textoCard && textoCard.length > 10) return textoCard;
    }
    if (typeof obtenerConsignaActual === "function") {
      const c = obtenerConsignaActual("PO");
      if (c && c.length > 10) return c;
    }
    return "Exercice de production orale DELF";
  }

  function pintarChatInteraccionPO() {
    const box = document.getElementById("po-chat-mensajes");
    if (!box) return;
    const h = (window.estadoInteraccionPO && window.estadoInteraccionPO.historial) || [];
    if (!h.length) {
      box.innerHTML = '<div style="text-align:center;color:#64748b;padding:20px;">Cliquez sur « Démarrer l\'interaction » pour commencer.</div>';
      return;
    }
    box.innerHTML = h.map((m) => {
      const ia = m.rol === "sophia";
      const safe = String(m.texto || "").replace(/'/g, "\\'");
      return '<div style="display:flex;flex-direction:column;align-items:' + (ia ? "flex-start" : "flex-end") + ';margin-bottom:10px;">'
        + '<div style="font-size:0.75rem;font-weight:700;color:' + (ia ? "#0f172a" : "#0369a1") + ';margin-bottom:2px;">' + (ia ? "🎙️ Examinateur (Sophia)" : "🗣️ Vous") + '</div>'
        + '<div style="max-width:82%;padding:10px 14px;border-radius:12px;font-size:0.92rem;background:' + (ia ? "#f1f5f9" : "#0f172a") + ';color:' + (ia ? "#0f172a" : "#fff") + ';border:1px solid #cbd5e1;">'
        + m.texto
        + (ia ? ' <button type="button" data-voz-po="' + safe + '" style="background:none;border:none;color:#0284c7;cursor:pointer;"><i class="fas fa-volume-up"></i></button>' : '')
        + '</div></div>';
    }).join("");
    box.scrollTop = box.scrollHeight;
  }

  window.iniciarSimuladorInteraccionPO = async function() {
    const btn = document.getElementById("btn-start-interaccion-po");
    const aviso = document.getElementById("po-interaccion-aviso");
    if (aviso) aviso.innerHTML = "";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Préparation de Sophia...';
    }

    try {
      if (window.isRecordingAudioPO && typeof window.grabarPO === "function") {
        try { await window.grabarPO(); } catch (_) {}
      }

      const uId = window.currentUnitId || "Unite_1";
      const eIdx = Number(window.currentExerciseIndex || 0);
      if (typeof obtenerIntentosActividad === "function") {
        const prev = await obtenerIntentosActividad(uId, eIdx, "PO", "interaccion");
        if (prev.length >= 3) {
          if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-lock"></i> Limite de 3 tentatives atteint (3/3)'; }
          alert("Limite de 3 tentatives atteint (3/3).");
          return;
        }
      }

      window.estadoInteraccionPO = { activa: true, historial: [], turnosAlumno: 0 };
      const nombre = typeof resolverNombreAlumnoReal === "function" ? await resolverNombreAlumnoReal() : "Candidat";

      const resp = await invocarSimuladorNube({
        accion: "turno",
        nivel: obtenerNivelSeguro(),
        consigne: obtenerConsignaSegura(),
        historial: [],
        nombreAlumno: nombre
      });

      if (!resp || !resp.respuesta_fr) throw new Error("Réponse vide du serveur.");

      window.estadoInteraccionPO.historial.push({ rol: "sophia", texto: resp.respuesta_fr });
      if (btn) btn.style.display = "none";
      const panel = document.getElementById("po-interaccion-panel-activo");
      if (panel) panel.style.display = "block";
      const pista = document.getElementById("po-interaccion-pista");
      if (pista) pista.innerText = resp.pista_es ? "💡 Guía: " + resp.pista_es : "";
      pintarChatInteraccionPO();
      leerVozFrancesGratis(resp.respuesta_fr);
    } catch (e) {
      console.error("Error iniciarSimuladorInteraccionPO:", e);
      if (aviso) aviso.innerHTML = '<div style="color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;padding:8px 12px;border-radius:8px;margin-top:8px;font-size:0.85rem;">⚠️ ' + (e.message || e) + '</div>';
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-play-circle"></i> Démarrer l\'interaction avec Sophia';
      }
    }
  };

  window.grabandoTurnoPO = false;
  window.reconocimientoTurnoPO = null;

  window.detenerVozTurnoAlumno = function() {
    window.grabandoTurnoPO = false;
    if (window.reconocimientoTurnoPO) {
      try { window.reconocimientoTurnoPO.stop(); } catch (_) {}
      window.reconocimientoTurnoPO = null;
    }
    const mic = document.getElementById("btn-mic-turno-po");
    if (mic) {
      mic.style.background = "#0284c7";
      mic.innerHTML = '<i class="fas fa-microphone"></i> Parler';
    }
  };

  window.activarVozTurnoAlumno = function() {
    if (window.grabandoTurnoPO) {
      window.detenerVozTurnoAlumno();
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const inp = document.getElementById("po-interaccion-input");
    const mic = document.getElementById("btn-mic-turno-po");
    if (!SR) {
      alert("Usa el cuadro de texto para escribir tu réplica en francés.");
      if (inp) inp.focus();
      return;
    }

    window.grabandoTurnoPO = true;
    const textoPrevio = inp && inp.value.trim() ? inp.value.trim() + " " : "";
    let acumuladoFinal = "";

    const rec = new SR();
    rec.lang = "fr-FR";
    rec.continuous = true;
    rec.interimResults = true;
    window.reconocimientoTurnoPO = rec;

    if (mic) {
      mic.style.background = "#dc2626";
      mic.innerHTML = '<i class="fas fa-stop-circle"></i> Arrêter';
    }

    rec.onresult = (ev) => {
      let interino = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const pieza = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) {
          acumuladoFinal += pieza + " ";
        } else {
          interino += pieza;
        }
      }
      if (inp) {
        inp.value = (textoPrevio + acumuladoFinal + interino).replace(/\s+/g, " ").trimStart();
      }
    };

    rec.onerror = (ev) => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        window.detenerVozTurnoAlumno();
      }
    };

    rec.onend = () => {
      // Si el alumno aún no ha pulsado "Arrêter", reanudar escucha sin perder lo dictado
      if (window.grabandoTurnoPO) {
        try {
          rec.start();
        } catch (_) {
          window.detenerVozTurnoAlumno();
        }
      } else {
        window.detenerVozTurnoAlumno();
      }
    };

    rec.start();
  };

  window.enviarTurnoAlumnoPO = async function() {
    if (window.grabandoTurnoPO) {
      window.detenerVozTurnoAlumno();
    }
    const inp = document.getElementById("po-interaccion-input");
    const send = document.getElementById("btn-enviar-turno-po");
    const txt = inp ? inp.value.trim() : "";
    if (!txt) { alert("Habla o escribe tu respuesta en francés primero."); return; }

    window.estadoInteraccionPO.historial.push({ rol: "alumno", texto: txt });
    window.estadoInteraccionPO.turnosAlumno += 1;
    if (inp) inp.value = "";
    pintarChatInteraccionPO();

    const cnt = document.getElementById("po-contador-turnos");
    if (cnt) cnt.innerText = "Échanges : " + window.estadoInteraccionPO.turnosAlumno + " / 5";
    if (send) { send.disabled = true; send.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

    try {
      const nombre = typeof resolverNombreAlumnoReal === "function" ? await resolverNombreAlumnoReal() : "Candidat";
      const resp = await invocarSimuladorNube({
        accion: "turno",
        nivel: obtenerNivelSeguro(),
        consigne: obtenerConsignaSegura(),
        historial: window.estadoInteraccionPO.historial,
        nombreAlumno: nombre
      });
      window.estadoInteraccionPO.historial.push({ rol: "sophia", texto: resp.respuesta_fr });
      pintarChatInteraccionPO();
      leerVozFrancesGratis(resp.respuesta_fr);
      const pista = document.getElementById("po-interaccion-pista");
      if (pista) pista.innerText = resp.finalizado || window.estadoInteraccionPO.turnosAlumno >= 5
        ? "✅ Interacción lista. Pulsa « Terminer et évaluer » para tu nota DELF."
        : (resp.pista_es ? "💡 Guía: " + resp.pista_es : "");
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      if (send) { send.disabled = false; send.innerHTML = '<i class="fas fa-paper-plane"></i> Répondre'; }
    }
  };

  window.finalizarYEvaluarInteraccionPO = async function() {
    const est = window.estadoInteraccionPO;
    if (!est || !est.turnosAlumno) { alert("Responde al menos una vez antes de evaluar."); return; }
    const uId = window.currentUnitId || "Unite_1";
    const eIdx = Number(window.currentExerciseIndex || 0);
    if (typeof obtenerIntentosActividad === "function") {
      const prev = await obtenerIntentosActividad(uId, eIdx, "PO", "interaccion");
      if (prev.length >= 3) { alert("Limite de 3 tentatives atteint (3/3)."); return; }
    }

    const btnEv = document.getElementById("btn-finalizar-interaccion-po");
    if (btnEv) { btnEv.disabled = true; btnEv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Évaluation...'; }
    const sBox = document.getElementById("sophia-box");
    const vText = document.getElementById("sophia-verdict-text");
    if (sBox) sBox.style.display = "block";
    if (vText) vText.innerHTML = '<div style="padding:20px;text-align:center;font-weight:700;"><i class="fas fa-spinner fa-spin"></i> Sophia évalue votre interaction...</div>';

    try {
      const consigne = obtenerConsignaSegura();
      const nombre = typeof resolverNombreAlumnoReal === "function" ? await resolverNombreAlumnoReal() : "Candidat";
      const res = await invocarSimuladorNube({
        accion: "evaluar",
        nivel: obtenerNivelSeguro(),
        consigne,
        historial: est.historial,
        nombreAlumno: nombre
      });
      const plano = est.historial.map((t) => (t.rol === "sophia" ? "Examinateur: " : "Candidat: ") + t.texto).join("\n");
      if (typeof guardarResultadoYMarcarHecho === "function") {
        await guardarResultadoYMarcarHecho("PO", { texto_alumno: plano, consigne, respuesta_ia: JSON.stringify(res), modalidad: "interaccion" });
      }
      const act = typeof obtenerIntentosActividad === "function" ? await obtenerIntentosActividad(uId, eIdx, "PO", "interaccion") : [res];
      if (vText && typeof window.renderizarReporteDELF === "function") {
        vText.innerHTML = window.renderizarReporteDELF(res, { skill: "PO" }) + (typeof renderizarAcordeonHistorial === "function" ? renderizarAcordeonHistorial(act, "PO") : "");
      }

      const panel = document.getElementById("po-interaccion-panel-activo");
      const btnSt = document.getElementById("btn-start-interaccion-po");
      if (panel) panel.style.display = "none";
      if (btnSt) {
        btnSt.style.display = "inline-flex";
        btnSt.disabled = act.length >= 3;
        btnSt.innerHTML = act.length >= 3 ? '<i class="fas fa-lock"></i> Limite de 3 tentatives atteint (3/3)' : '<i class="fas fa-redo"></i> Nouvelle interaction (' + act.length + '/3)';
      }
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      if (btnEv) { btnEv.disabled = false; btnEv.innerHTML = '<i class="fas fa-check-circle"></i> Terminer et évaluer l\'interaction'; }
    }
  };

  // Delegación global en fase de captura para garantizar respuesta inmediata al clic
  if (!window.__delegacionInteraccionPOInstalada) {
    window.__delegacionInteraccionPOInstalada = true;
    document.addEventListener("click", function(ev) {
      const target = ev.target;
      if (!target) return;
      if (target.closest("#btn-start-interaccion-po")) {
        ev.preventDefault();
        ev.stopPropagation();
        window.iniciarSimuladorInteraccionPO();
      } else if (target.closest("#btn-mic-turno-po")) {
        ev.preventDefault();
        window.activarVozTurnoAlumno();
      } else if (target.closest("#btn-enviar-turno-po")) {
        ev.preventDefault();
        window.enviarTurnoAlumnoPO();
      } else if (target.closest("#btn-finalizar-interaccion-po")) {
        ev.preventDefault();
        window.finalizarYEvaluarInteraccionPO();
      } else if (target.closest("[data-voz-po]")) {
        const b = target.closest("[data-voz-po]");
        leerVozFrancesGratis(b.getAttribute("data-voz-po"));
      }
    }, true);
  }

  setInterval(() => {
    const cInt = document.getElementById("container-po-interaccion-live");
    const cDual = document.getElementById("container-po-audio-dual");
    const bRst = document.getElementById("btn-reset-po");
    const bSub = document.getElementById("btn-submit-po");
    if (!cInt || !cDual) return;

    if (window.currentSkill !== "PO") {
      cInt.style.display = "none";
      return;
    }

    cDual.style.display = "block";
    if (bRst) bRst.style.display = "inline-block";
    if (bSub) bSub.style.display = "inline-flex";
    cInt.style.display = "block";

    const claveAct = (window.currentUnitId || "") + "_" + (window.currentExerciseIndex || 0);
    if (cInt.dataset.claveAct && cInt.dataset.claveAct !== claveAct) {
      window.estadoInteraccionPO = { activa: false, historial: [], turnosAlumno: 0 };
      delete cInt.dataset.ok;
    }
    cInt.dataset.claveAct = claveAct;

    if (!cInt.dataset.ok) {
      cInt.dataset.ok = "1";
      cInt.innerHTML = '<div style="background:#f0f9ff;border:2px dashed #0284c7;border-radius:10px;padding:16px;margin-bottom:14px;">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;">'
        + '<div><h4 style="margin:0;color:#0f172a;font-size:0.98rem;"><i class="fas fa-comments" style="color:#0284c7;"></i> Option 3 : Simulation d\'Interaction Orale en Direct</h4>'
        + '<span style="font-size:0.82rem;color:#475569;">Dialogue interactif tour par tour avec l\'examinatrice Sophia (Voix FR)</span></div>'
        + '<span id="po-contador-turnos" style="background:#e0f2fe;color:#0369a1;padding:4px 12px;border-radius:20px;font-weight:700;font-size:0.82rem;">Échanges : 0 / 5</span></div>'
        + '<div style="text-align:center;margin:8px 0;"><button type="button" id="btn-start-interaccion-po" style="background:#0284c7;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:8px;"><i class="fas fa-play-circle"></i> Démarrer l\'interaction avec Sophia</button><div id="po-interaccion-aviso"></div></div>'
        + '<div id="po-interaccion-panel-activo" style="display:none;margin-top:12px;">'
        + '<div id="po-chat-mensajes" style="background:#fff;border:1px solid #cbd5e1;border-radius:10px;padding:12px;max-height:300px;overflow-y:auto;margin-bottom:10px;"></div>'
        + '<div id="po-interaccion-pista" style="font-size:0.82rem;color:#0369a1;font-weight:600;margin-bottom:8px;"></div>'
        + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
        + '<button type="button" id="btn-mic-turno-po" style="background:#0284c7;color:#fff;border:none;padding:10px 14px;border-radius:8px;font-weight:700;cursor:pointer;"><i class="fas fa-microphone"></i> Parler</button>'
        + '<input type="text" id="po-interaccion-input" placeholder="Parlez ou écrivez votre réplique en français..." style="flex:1;min-width:200px;padding:10px;border:1px solid #cbd5e1;border-radius:8px;" onkeydown="if(event.key===\'Enter\'){event.preventDefault();window.enviarTurnoAlumnoPO();}">'
        + '<button type="button" id="btn-enviar-turno-po" style="background:#0f172a;color:#fff;border:none;padding:10px 16px;border-radius:8px;font-weight:700;cursor:pointer;"><i class="fas fa-paper-plane"></i> Répondre</button>'
        + '</div><div style="margin-top:12px;padding-top:10px;border-top:1px dashed #cbd5e1;text-align:right;">'
        + '<button type="button" id="btn-finalizar-interaccion-po" style="background:#15803d;color:#fff;border:none;padding:10px 18px;border-radius:8px;font-weight:700;cursor:pointer;"><i class="fas fa-check-circle"></i> Terminer et évaluer l\'interaction</button>'
        + '</div></div></div>';
    }
  }, 700);

})();
