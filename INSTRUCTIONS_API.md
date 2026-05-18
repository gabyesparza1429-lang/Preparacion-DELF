# Instrucciones para Reactivar el Motor de Sophia (Gemini API)

Actualmente, el sistema no puede generar ejercicios porque la API Key de Google ha sido bloqueada (por seguridad) o el servicio no está activo en tu cuenta de Google Cloud.

Sigue estos pasos para solucionar el problema:

## 1. Habilitar la API de Gemini
1. Ve a la [Consola de Google Cloud](https://console.developers.google.com/apis/api/generativelanguage.googleapis.com/overview?project=objectif-reussite-delf).
2. Asegúrate de que el proyecto seleccionado sea `objectif-reussite-delf`.
3. Haz clic en el botón **"HABILITAR"** (Enable) si aparece. Si ya está habilitada, verás un panel de gestión.

## 2. Generar una Nueva API Key
1. Ve a [Google AI Studio (API Keys)](https://aistudio.google.com/app/apikey).
2. Haz clic en **"Create API key"**.
3. Selecciona tu proyecto `objectif-reussite-delf` o crea uno nuevo si lo prefieres.
4. **Copia** la nueva API Key generada.

## 3. Actualizar el Proyecto
1. Abre el archivo `config.js` en tu editor de código.
2. Reemplaza el valor de `API_KEY` por tu nueva llave:
   ```javascript
   export const API_KEY = "TU_NUEVA_LLAVE_AQUI";
   ```
3. Guarda el archivo y sube los cambios a tu servidor o Firebase Hosting.

## 4. Probar en el Panel de Admin
1. Entra a `admin.html`.
2. En la pestaña **Réussite DELF**, haz clic en el botón **"Sophia: Procesar"**.
3. Revisa la consola negra en la parte inferior para confirmar el éxito.

---
**Nota:** Nunca compartas tu API Key públicamente (en GitHub, por ejemplo) para evitar que sea bloqueada nuevamente.
