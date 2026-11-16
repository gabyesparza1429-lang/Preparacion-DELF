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

  function obtenerNombreAlumno() {
    const el = document.getElementById("student-welcome") || document.getElementById("welcome-message");
    if (el && el.innerText) {
      const limpio = el.innerText.replace(/Élève\s*:/i, "").trim();
      if (limpio) return limpio;
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
  // 2. RENDERIZADOR OFICIAL DEL REPORTE (0, 1, 3, 5 ESTRICTO)
  // =========================================================
  function normalizarObjetoEvaluacion(raw) {
    if (!raw) return null;
    let obj = raw;
    if (typeof obj === "string") {
      try {
        obj = JSON.parse(obj.replace(/```json/gi, "").replace(/```/g, "").trim());
      } catch (e) {
        return { legacy_html: raw };
      }
    }
    if (obj && obj.respuesta_ia) {
      return normalizarObjetoEvaluacion(obj.respuesta_ia);
    }
    if (!obj || typeof obj !== "object" || !Array.isArray(obj.criterios)) {
      return { legacy_html: typeof raw === "string" ? raw : JSON.stringify(raw) };
    }
    return obj;
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
      ? `<div style="margin-top:16px; padding:14px 16px; background:#f8fafc; border-left:4px solid #0f172a; border-radius:6px; color:#334155; font-size:0.9rem; line-height:1.55;">
           <strong>Commentaire du jury (Sophia) :</strong> ${data.comentario_general}
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
          ${supraHTML}
          ${comentarioHTML}
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
  // 3. LLAMADA A CLOUD FUNCTIONS (CON RESPALDO DIRECTO)
  // =========================================================
  async function llamarFuncionNube(nombreFuncion, payload) {
    const urls = [
      `/${nombreFuncion}`,
      `https://us-central1-objectif-reussite-delf.cloudfunctions.net/${nombreFuncion}`
    ];
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
  async function obtenerIntentosActividad(uId, eIdx, skill) {
    const studentId = window.urlId || new URLSearchParams(window.location.search).get("id");
    if (!studentId || studentId === "admin_preview" || !window.db || !window.collection || !window.getDocs) {
      return [];
    }
    const colRef = window.collection(window.db, "Usuarios", studentId, "HistorialSophia");
    const snap = await window.getDocs(colRef);
    const lista = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      const docUnidad = d.unidad !== undefined ? d.unidad : d.unidadId;
      const docAct = d.actividad !== undefined ? Number(d.actividad) : Number(d.ejercicioIndex);
      const docSkill = d.habilidad || (d.tipo === "Production_Orale" ? "PO" : "PE");
      if (String(docUnidad) === String(uId) && Number(docAct) === Number(eIdx) && String(docSkill) === String(skill)) {
        lista.push({ id: docSnap.id, ...d });
      }
    });
    lista.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
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
      await window.setDoc(userRef, {
        mapa_aciertos: { [llaveProgreso]: true }
      }, { merge: true });

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
                <audio controls src="${url}" style="width:100%; max-width:440px;"></audio>
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
              <audio controls src="${url}" style="width:100%; max-width:440px;"></audio>
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
    // A. Botón Grabar / Detener Audio PO
    const btnRec = e.target.closest("#btn-record-po");
    if (btnRec) {
      e.preventDefault();
      e.stopImmediatePropagation();
      await window.grabarPO();
      return;
    }

    // B. Botón Reiniciar Audio PO
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

    // C. Botón Evaluar Production Écrite (PE)
    const btnPE = e.target.closest("#btn-submit-pe") || e.target.closest("#btn-evaluar-sophia");
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
        const nombreAlumno = obtenerNombreAlumno();
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

    // D. Botón Evaluar Production Orale (PO)
    const btnPO = e.target.closest("#btn-evaluar-audio-sophia") || e.target.closest("#btn-submit-po");
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
      const intentosPrevios = await obtenerIntentosActividad(uId, eIdx, "PO");
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
        const nombreAlumno = obtenerNombreAlumno();
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

        const intentosActualizados = await obtenerIntentosActividad(uId, eIdx, "PO");
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
})();
