import re

with open("alumno.html", "r", encoding="utf-8") as f:
    code = f.read()

menu_function = """
window.generarMenuJerarquico = function() {
    const container = document.getElementById('sidebar-dynamic-menu') || document.getElementById('sidebar-units-container') || document.getElementById('units-list');
    if (!container) return;
    container.innerHTML = '';

    const uKeys = Object.keys(unidadesCache).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (uKeys.length === 0) {
        container.innerHTML = '<div style="padding:10px; color:#aaa; font-size:0.75rem;">Chargement des unités...</div>';
        return;
    }

    uKeys.forEach((uId) => {
        const u = unidadesCache[uId] || {};
        let ejH = [];
        
        if (currentSkill === 'CO') ejH = u.CO || u.ejercicios_CO || u.co || [];
        else if (currentSkill === 'CE') ejH = u.CE || u.ejercicios_CE || u.ce || [];
        else if (currentSkill === 'PE') ejH = u.PE || u.ejercicios_PE || u.pe || [];
        else if (currentSkill === 'PO') ejH = u.PO || u.PO_entretien || u.PO_interaction || u.PO_expression || u.po || [];

        const isUnitOpen = openUnitsState[uId] !== false;
        const wrapper = document.createElement('div');
        wrapper.className = 'unit-wrapper';
        wrapper.style.marginBottom = '8px';

        const ID_Limpio = uId.replace(/\\D/g, '');
        const nombreUnidadReal = u.nombre || u[`tema_${currentSkill}`] || `Unité ${ID_Limpio || uId}`;

        const toggleBtn = document.createElement('button');
        toggleBtn.className = `unit-toggle-btn ${currentUnitId === uId ? 'active' : ''}`;
        toggleBtn.onclick = () => window.toggleUnitMenu(uId);
        toggleBtn.style.cssText = 'width:100%; padding:10px; background:rgba(255,255,255,0.05); color:#e2b044; border:1px solid rgba(197,160,89,0.3); border-radius:6px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; font-weight:700; font-size:0.85rem;';
        toggleBtn.innerHTML = `<span><i class="fas fa-book"></i> ${nombreUnidadReal}</span> <i class="fas ${isUnitOpen ? 'fa-chevron-down' : 'fa-chevron-right'}"></i>`;
        wrapper.appendChild(toggleBtn);

        const sub = document.createElement('div');
        sub.className = 'submenu-activities';
        sub.style.display = isUnitOpen ? 'flex' : 'none';
        sub.style.flexDirection = 'column';
        sub.style.gap = '4px';
        sub.style.padding = '6px 0 6px 10px';

        if (ejH.length === 0) {
            sub.innerHTML = '<div style="font-size:0.75rem; color:#888; padding:5px;">Aucune activité</div>';
        } else {
            ejH.forEach((ej, eIdx) => {
                const clv = `${uId}_${currentSkill}_${eIdx}`;
                const esCompleto = mapaAciertosAlumno && mapaAciertosAlumno[clv] === true;
                const titulo = ej.titre || ej.titulo || `Activité ${eIdx + 1}`;

                const btnAct = document.createElement('button');
                btnAct.className = `activity-link-btn ${currentUnitId === uId && currentExerciseIndex === eIdx ? 'active' : ''}`;
                btnAct.onclick = () => window.cargarActividadDirecta(uId, eIdx);
                btnAct.style.cssText = 'display:flex; align-items:center; justify-content:space-between; width:100%; padding:8px 10px; background:transparent; color:#fff; border:none; border-bottom:1px solid rgba(255,255,255,0.05); cursor:pointer; font-size:0.8rem;';
                btnAct.innerHTML = `<span><i class="fas ${esCompleto ? 'fa-check' : 'fa-play'}" style="${esCompleto ? 'color:#28a745' : ''}"></i> ${eIdx + 1}. ${titulo}</span> ${esCompleto ? '<span style="color:#28a745; font-size:0.75rem;">✅</span>' : ''}`;
                sub.appendChild(btnAct);
            });
        }

        wrapper.appendChild(sub);
        container.appendChild(wrapper);
    });
};

window.renderActiveInterface = function() {
    const menuContainer = document.getElementById('sidebar-dynamic-menu');
    const controlsRow = document.getElementById('parcours-controls-container');
    if (currentActiveTab === "parcours") {
        if (controlsRow) controlsRow.style.display = "flex";
        if (menuContainer) menuContainer.style.display = "flex";
        window.generarMenuJerarquico();
    }
};
"""

if "window.generarMenuJerarquico" in code:
    code = re.sub(r'window\.generarMenuJerarquico\s*=\s*function\s*\(\)\s*\{[\s\S]*?\};', menu_function.strip(), code)
else:
    code = code.replace("async function descargarColeccionUnidades() {", menu_function + "\nasync function descargarColeccionUnidades() {")

with open("alumno.html", "w", encoding="utf-8") as f:
    f.write(code)

print("✅ Menú lateral corregido con soporte multi-clave.")
