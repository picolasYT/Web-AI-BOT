import axios from "axios";

export async function generarArchivos(prompt) {

  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: "openai/gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
Eres un diseñador web senior experto en UX/UI moderno (2026).

Tu tarea es generar una página web profesional, visualmente atractiva y moderna.

REQUISITOS OBLIGATORIOS:

🎨 Diseño
- Estilo moderno y minimalista
- Espaciado limpio
- Layout bien estructurado
- Secciones claras (Hero, Features, CTA, Footer)
- Diseño elegante y profesional

📱 Responsive
- Mobile-first
- Totalmente adaptable a celulares
- Usar media queries correctamente

✨ Animaciones
- Animaciones suaves con CSS (transition, transform, fade-in)
- Hover effects modernos en botones
- Animación ligera en hero o secciones
- NO usar librerías externas

🔤 Tipografía
- Usar Google Fonts (Inter o Poppins)
- Buena jerarquía visual (h1, h2, p)

🎯 Botones
- Botones modernos con hover elegante
- Bordes redondeados
- Sombras suaves
- Efecto al pasar el mouse

🎨 Estilo visual
- Colores armoniosos
- Degradados suaves opcionales
- Sombras modernas (box-shadow suaves)
- Fondo atractivo (oscuro o claro según contexto)

📦 Estructura técnica
- HTML limpio y semántico
- CSS separado en style.css
- JS separado en script.js
- Código optimizado
- Comentarios mínimos pero claros

⚠️ MUY IMPORTANTE:
- En el HTML usar rutas RELATIVAS
- NO usar rutas que empiecen con "/"
- NO usar frameworks
- NO usar CDN externos
- El CSS y JS deben ir separados en los campos correspondientes

🚨 CRÍTICO:
Devuelve únicamente un objeto JSON válido.
No incluyas texto adicional.
No incluyas explicaciones.
No uses markdown.
No uses bloques \`\`\`.
Devuelve SOLO el JSON puro.

Formato obligatorio:

{
  "html": "...",
  "css": "...",
  "js": "..."
}
`
        },
        { role: "user", content: prompt }
      ]
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://web-ai-bot.local",
        "X-Title": "Web AI Bot"
      }
    }
  );

  const content = response.data.choices[0].message.content;

  let parsed;

  try {
    // Intento parseo directo
    parsed = JSON.parse(content);
  } catch {
    // Si viene texto antes o después del JSON
    const match = content.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error("No se pudo extraer JSON válido de la respuesta de la IA");
    }

    parsed = JSON.parse(match[0]);
  }

  // Validación mínima
  if (!parsed.html) {
    throw new Error("La IA no devolvió HTML válido");
  }

  return parsed;
}