# Instrucciones para Reactivar el Motor de Sophia (Gemini API)

Debido a que Google bloquea automáticamente las llaves que se encuentran en el código fuente, hemos cambiado la forma de configurar a Sophia para que sea más segura.

Sigue estos pasos para solucionar el problema:

## 1. Habilitar la API de Gemini
1. Ve a la [Consola de Google Cloud](https://console.developers.google.com/apis/api/generativelanguage.googleapis.com/overview?project=942279633770).
2. Asegúrate de que el proyecto seleccionado sea `objectif-reussite-delf`.
3. Haz clic en el botón **"HABILITAR"** (Enable) si aparece.

## 2. Generar una Nueva API Key
1. Ve a [Google AI Studio (API Keys)](https://aistudio.google.com/app/apikey).
2. Haz clic en **"Create API key"**.
3. Selecciona tu proyecto o crea uno nuevo.
4. **Copia** la nueva API Key generada.

## 3. Configurar en el Panel de Administrador
1. Abre tu panel de control (`admin.html`).
2. En la pestaña **Réussite DELF**, verás un nuevo campo que dice: **"Pega tu Gemini API Key aquí..."**.
3. Pega tu llave en ese campo.
4. Haz clic en **"Guardar Configuración"**.

*Nota: La llave se guardará de forma segura en tu navegador y no se compartirá en el código fuente, evitando que sea bloqueada de nuevo.*

## 4. Generar Material
1. Una vez guardada la llave, selecciona el nivel y haz clic en el botón **"Sophia: Procesar"**.
2. Revisa la consola negra en la parte inferior para confirmar que dice: `> ¡ÉXITO!`.

---
**Seguridad:** Nunca pegues tu llave en archivos como `config.js` o `admin.html`. Usa siempre el panel de administración.
