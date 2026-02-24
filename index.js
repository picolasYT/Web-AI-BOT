import TelegramBot from "node-telegram-bot-api";
import fs from "fs-extra";
import archiver from "archiver";
import axios from "axios";
import { exec } from "child_process";
import dotenv from "dotenv";

dotenv.config();

const bot = new TelegramBot(process.env.TG_TOKEN, { polling: true });

console.log("🤖 Web AI Bot iniciado...");

// =======================
// ESTADOS
// =======================

const usuariosActivos = new Set();
const modoGuiado = {};
const DB_FILE = "./data.json";

if (!fs.existsSync(DB_FILE)) {
  fs.writeJsonSync(DB_FILE, {});
}

function cargarDB() {
  return fs.readJsonSync(DB_FILE);
}

function guardarDB(data) {
  fs.writeJsonSync(DB_FILE, data, { spaces: 2 });
}

// =======================
// START MENU
// =======================

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  const menu = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🧠 Modo Guiado", callback_data: "modo_guiado" },
          { text: "✍️ Modo Manual", callback_data: "modo_manual" }
        ],
        [
          { text: "📁 Mis Proyectos", callback_data: "mis_proyectos" }
        ],
        [
          { text: "❌ Cancelar", callback_data: "cancelar" }
        ]
      ]
    }
  };

  bot.sendMessage(chatId, "👋 Bienvenido a Web AI Bot\n\n¿Cómo querés crear tu web?", menu);
});

// =======================
// BOTONES
// =======================

bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (data === "modo_manual") {
    usuariosActivos.add(chatId);
    bot.sendMessage(chatId, "✍️ Modo Manual activado.\nDescribí tu web libremente.");
  }

  if (data === "modo_guiado") {
    usuariosActivos.add(chatId);
    modoGuiado[chatId] = { paso: 1, datos: {} };
    bot.sendMessage(chatId, "🧠 Modo Guiado\n\n1️⃣ ¿Nombre del sitio?");
  }

  if (data === "mis_proyectos") {
    const db = cargarDB();
    const proyectos = db[chatId];

    if (!proyectos || proyectos.length === 0) {
      bot.sendMessage(chatId, "📁 No tenés proyectos guardados.");
    } else {
      let texto = "📁 Tus proyectos:\n\n";
      proyectos.forEach((p, i) => {
        texto += `${i + 1}. ${p.nombre}\n${p.url || "Sin URL"}\n\n`;
      });
      bot.sendMessage(chatId, texto);
    }
  }

  if (data === "cancelar") {
    usuariosActivos.delete(chatId);
    delete modoGuiado[chatId];
    bot.sendMessage(chatId, "❌ Conversación cancelada.");
  }

  bot.answerCallbackQuery(callbackQuery.id);
});

// =======================
// MENSAJES
// =======================

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text || text.startsWith("/")) return;
  if (!usuariosActivos.has(chatId)) return;

  // ================= GUIADO =================
  if (modoGuiado[chatId]) {
    const estado = modoGuiado[chatId];

    if (estado.paso === 1) {
      estado.datos.nombre = text;
      estado.paso = 2;
      return bot.sendMessage(chatId, "2️⃣ ¿Tipo de sitio? (servidor, negocio, portfolio, tienda, etc)");
    }

    if (estado.paso === 2) {
      estado.datos.tipo = text;
      estado.paso = 3;
      return bot.sendMessage(chatId, "3️⃣ ¿Color principal?");
    }

    if (estado.paso === 3) {
      estado.datos.color = text;

      const prompt = `
Crear una web:
Nombre: ${estado.datos.nombre}
Tipo: ${estado.datos.tipo}
Color principal: ${estado.datos.color}
`;

      delete modoGuiado[chatId];
      return generarYEnviar(chatId, prompt, estado.datos.nombre);
    }
  }

  // ================= MANUAL =================
  return generarYEnviar(chatId, text, "Proyecto Manual");
});

// =======================
// GENERAR Y ENVIAR
// =======================

async function generarYEnviar(chatId, prompt, nombreProyecto) {
  bot.sendMessage(chatId, "⚙️ Generando web...");

  try {
    const files = await generarArchivos(prompt);

    if (!files?.html) {
      throw new Error("La IA no generó HTML válido");
    }

    // 🔥 COMBINAR TODO EN UN SOLO HTML
    let htmlFinal = files.html;

    // Insertar CSS dentro del <head>
    if (files.css) {
      htmlFinal = htmlFinal.replace(
        "</head>",
        `<style>\n${files.css}\n</style>\n</head>`
      );
    }

    // Insertar JS antes de </body>
    if (files.js) {
      htmlFinal = htmlFinal.replace(
        "</body>",
        `<script>\n${files.js}\n</script>\n</body>`
      );
    }

    // 🔥 ENVIAR A RENDER
    const response = await axios.post(
      "https://TU_RENDER_URL.onrender.com/api/crear",
      {
        usuario: chatId.toString(),
        html: htmlFinal
      }
    );

    const deployedURL = response.data.url;

    // Guardar en DB local del bot
    const db = cargarDB();
    if (!db[chatId]) db[chatId] = [];

    db[chatId].push({
      nombre: nombreProyecto,
      url: deployedURL,
      fecha: new Date().toISOString()
    });

    guardarDB(db);

    // Responder al usuario
    bot.sendMessage(chatId, `🚀 Web creada exitosamente:\n${deployedURL}`);

  } catch (err) {
    console.error("ERROR REAL:", err.response?.data || err.message);
    bot.sendMessage(chatId, "❌ Error generando la web.");
  }
}

// =======================
// OPENROUTER
// =======================

async function generarArchivos(prompt) {
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
- En el HTML usar rutas RELATIVAS:
  <link rel="stylesheet" href="style.css">
  <script src="script.js"></script>
- NO usar rutas que empiecen con "/"
- NO usar frameworks (no Bootstrap, no Tailwind)
- NO usar CDN externos
- EL JS, CSS esten adentro del index.html con las etiquetas <style> y <script>

Devuelve SOLO JSON válido con esta estructura exacta:

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
  const jsonMatch = content.match(/\{[\s\S]*\}/);

  if (!jsonMatch) throw new Error("JSON inválido");

  return JSON.parse(jsonMatch[0]);
}

// =======================
// ZIP
// =======================

function crearZip(source, out) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(out);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", resolve);
    archive.on("error", reject);

    archive.pipe(output);
    archive.directory(source, false);
    archive.finalize();
  });
}