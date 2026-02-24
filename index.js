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
      return bot.sendMessage(chatId, "2️⃣ ¿Tipo de sitio? (servidor, negocio, portfolio, tienda)");
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

    const projectName = `web-${Date.now()}`;
    const projectPath = `./${projectName}`;

    await fs.mkdir(projectPath);
    await fs.writeFile(`${projectPath}/index.html`, files.html);
    await fs.writeFile(`${projectPath}/style.css`, files.css);
    await fs.writeFile(`${projectPath}/script.js`, files.js);

    let deployedURL = null;

    await new Promise((resolve) => {
      exec(`cd ${projectName} && vercel --prod --yes`, (error, stdout) => {
        if (!error) {
          const match = stdout.match(/https:\/\/[^\s]+/);
          if (match) deployedURL = match[0];
        }
        resolve();
      });
    });

    const zipPath = `${projectName}.zip`;
    await crearZip(projectPath, zipPath);

    if (deployedURL) {
      bot.sendMessage(chatId, `🚀 Web publicada:\n${deployedURL}`);
    } else {
      bot.sendMessage(chatId, "⚠️ No se pudo crear subdominio automático.");
    }

    await bot.sendDocument(chatId, zipPath);

    // Guardar en DB
    const db = cargarDB();
    if (!db[chatId]) db[chatId] = [];
    db[chatId].push({
      nombre: nombreProyecto,
      url: deployedURL,
      fecha: new Date().toISOString()
    });
    guardarDB(db);

    setTimeout(async () => {
      await fs.remove(projectPath);
      await fs.remove(zipPath);
    }, 15000);

  } catch (err) {
    console.error("ERROR:", err.response?.data || err.message);
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
Devuelve SOLO JSON válido:
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