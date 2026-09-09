import re

with open("index.js", "r", encoding="utf-8") as f:
    code = f.read()

# Buscar donde se obtiene el texto de Gemini y antes de hacer JSON.parse
# Reemplazamos la lógica de parseo para limpiar caracteres de control (\n, \t, etc.)
parse_fix = """
      let rawText = response.response.text();
      let cleanText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
      
      // Sanitizar caracteres de control invisibles dentro de cadenas de texto
      cleanText = cleanText.replace(/[\\x00-\\x1F\\x7F-\\x9F]/g, function(match) {
          if (match === '\\n') return '\\\\n';
          if (match === '\\r') return '\\\\r';
          if (match === '\\t') return '\\\\t';
          return '';
      });

      const evaluacionData = JSON.parse(cleanText);
"""

# Reemplazo seguro en la función
if "JSON.parse" in code:
    code = re.sub(r'let rawText =[\s\S]*?JSON\.parse\([^)]+\);', parse_fix, code)
    with open("index.js", "w", encoding="utf-8") as f:
        f.write(code)
    print("✅ Sanitización de caracteres JSON instalada en index.js")
else:
    print("⚠️ No se encontró el bloque exacto de JSON.parse")
