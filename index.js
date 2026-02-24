import TelegramBot from "node-telegram-bot-api";
import fs from "fs-extra";
import archiver from "archiver";
import axios from "axios";
import { exec } from "child_process";
import dotenv from "dotenv";

dotenv.config();

const bot = new TelegramBot(process.env.TG_TOKEN, { polling: true });

console.log("🚀 Web AI Bot PRO iniciado");

// ================= DB =================

const DB_FILE = "./data.json";
if (!fs.existsSync(DB_FILE)) fs.writeJsonSync(DB_FILE, {});

function loadDB() {
  return fs.readJsonSync(DB_FILE);
}

function saveDB(data) {
  fs.writeJsonSync(DB_FILE, data, { spaces: 2 });
}

// ================= ESTADOS =================

const usuariosActivos = new Set();
const modoGuiado = {};
const editorEstado = {};

// ================= START MENU =================

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

  bot.sendMessage(chatId, "👋 Bienvenido a Web AI Bot PRO\n\nElegí cómo querés crear tu web:", menu);
});

// ================= BOTONES =================

bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const db = loadDB();

  if (data === "modo_manual") {
    usuariosActivos.add(chatId);
    bot.sendMessage(chatId, "✍️ Modo Manual activado.\nDescribí tu web.");
  }

  if (data === "modo_guiado") {
    usuariosActivos.add(chatId);
    modoGuiado[chatId] = { paso: 1, datos: {} };
    bot.sendMessage(chatId, "1️⃣ Nombre del sitio:");
  }

  if (data === "mis_proyectos") {
    const user = db[chatId];
    if (!user || !user.proyectos?.length)
      return bot.sendMessage(chatId, "📁 No tenés proyectos aún.");

    let texto = "📁 Tus proyectos:\n\n";
    user.proyectos.forEach((p, i) => {
      texto += `${i + 1}. ${p.nombre}\n${p.url || "Sin URL"}\n\n`;
    });

    bot.sendMessage(chatId, texto);
  }

  if (data === "cancelar") {
    usuariosActivos.delete(chatId);
    delete modoGuiado[chatId];
    delete editorEstado[chatId];
    bot.sendMessage(chatId, "❌ Conversación cancelada.");
  }

  if (data === "editar_color") {
    editorEstado[chatId] = { tipo: "color" };
    bot.sendMessage(chatId, "🎨 Escribí el nuevo color principal:");
  }

  if (data === "editar_titulo") {
    editorEstado[chatId] = { tipo: "titulo" };
    bot.sendMessage(chatId, "✏️ Escribí el nuevo título:");
  }

  bot.answerCallbackQuery(query.id);
});

// ================= MENSAJES =================

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!text || text.startsWith("/")) return;

  const db = loadDB();

  // FREE LIMIT (1 proyecto)
  if (!db[chatId]) db[chatId] = { premium: false, proyectos: [] };
  if (!db[chatId].premium && db[chatId].proyectos.length >= 1) {
    return bot.sendMessage(chatId, "🚫 Límite gratis alcanzado (1 web).");
  }

  // EDITOR
  if (editorEstado[chatId]) {
    const tipo = editorEstado[chatId].tipo;
    delete editorEstado[chatId];
    return bot.sendMessage(chatId, `🔄 Cambio aplicado (${tipo}). Regenerá la web.`);
  }

  if (!usuariosActivos.has(chatId)) return;

  // GUIADO
  if (modoGuiado[chatId]) {
    const estado = modoGuiado[chatId];

    if (estado.paso === 1) {
      estado.datos.nombre = text;
      estado.paso = 2;
      return bot.sendMessage(chatId, "2️⃣ Tipo de sitio:");
    }

    if (estado.paso === 2) {
      estado.datos.tipo = text;
      estado.paso = 3;
      return bot.sendMessage(chatId, "3️⃣ Color principal:");
    }

    if (estado.paso === 3) {
      estado.datos.color = text;
      delete modoGuiado[chatId];

      const prompt = `
Crear web profesional.
Nombre: ${estado.datos.nombre}
Tipo: ${estado.datos.tipo}
Color: ${estado.datos.color}
`;

      return generarYEnviar(chatId, prompt, estado.datos.nombre);
    }
  }

  // MANUAL
  generarYEnviar(chatId, text, "Proyecto Manual");
});

// ================= GENERAR =================

async function generarYEnviar(chatId, prompt, nombre) {
  bot.sendMessage(chatId, "⚙️ Generando diseño profesional...");

  const promptFinal = `
Eres diseñador web senior 2026.

Reglas:
- Diseño moderno minimalista
- Responsive
- Google Fonts
- Hero impactante
- Botones con hover
- Animaciones suaves
- Sombras y degradados
- Footer elegante
- Código limpio

Detalles:
${prompt}

Devuelve SOLO JSON:
{
  "html": "...",
  "css": "...",
  "js": "..."
}
`;

  try {
    const files = await generarArchivos(promptFinal);

    const projectName = `web-${Date.now()}`;
    const projectPath = `./${projectName}`;

    await fs.mkdir(projectPath);
    await fs.writeFile(`${projectPath}/index.html`, files.html);
    await fs.writeFile(`${projectPath}/style.css`, files.css);
    await fs.writeFile(`${projectPath}/script.js`, files.js);

    let deployedURL = null;

    await new Promise((resolve) => {
      exec(`cd ${projectName} && vercel --prod --yes`, (err, stdout) => {
        if (!err) {
          const match = stdout.match(/https:\/\/[^\s]+/);
          if (match) deployedURL = match[0];
        }
        resolve();
      });
    });

    const zipPath = `${projectName}.zip`;
    await crearZip(projectPath, zipPath);

    const db = loadDB();
    db[chatId].proyectos.push({
      nombre,
      url: deployedURL,
      fecha: new Date().toISOString()
    });
    saveDB(db);

    if (deployedURL)
      bot.sendMessage(chatId, `🚀 Web publicada:\n${deployedURL}`);

    await bot.sendDocument(chatId, zipPath);

    const opciones = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🎨 Cambiar color", callback_data: "editar_color" },
            { text: "✏️ Cambiar título", callback_data: "editar_titulo" }
          ]
        ]
      }
    };

    bot.sendMessage(chatId, "¿Querés modificar algo?", opciones);

    setTimeout(async () => {
      await fs.remove(projectPath);
      await fs.remove(zipPath);
    }, 15000);

  } catch (err) {
    console.error(err.response?.data || err.message);
    bot.sendMessage(chatId, "❌ Error generando la web.");
  }
}

// ================= OPENROUTER =================

// ================= OPENROUTER =================

async function generarArchivos(prompt) {
  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: "openai/gpt-4o-mini", // ← MODELO ESTABLE
      messages: [
        { role: "user", content: prompt }
      ]
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://localhost", // requerido por OpenRouter en algunos casos
        "X-Title": "Web AI Bot"
      }
    }
  );

  if (!response.data?.choices?.length) {
    throw new Error("Respuesta inválida de OpenRouter");
  }

  const content = response.data.choices[0].message.content;

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("La IA no devolvió JSON válido");
  }

  return JSON.parse(jsonMatch[0]);
}

// ================= ZIP =================

function crearZip(source, out) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(out);
    const archive = archiver("zip");

    output.on("close", resolve);
    archive.on("error", reject);

    archive.pipe(output);
    archive.directory(source, false);
    archive.finalize();
  });
}