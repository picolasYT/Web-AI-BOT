import dotenv from "dotenv";
import TelegramBot from "node-telegram-bot-api";

import registerStart from "./bot/start.js";
import registerCallbacks from "./bot/callbacks.js";
import registerMessages from "./bot/messages.js";

dotenv.config();

const bot = new TelegramBot(process.env.TG_TOKEN, { polling: true });

console.log("🤖 Web AI Bot iniciado...");

// 🔥 ESTADOS GLOBALES
const usuariosActivos = new Set();
const modoGuiado = {};

// 🔥 Pasamos estados a los módulos
registerStart(bot);
registerCallbacks(bot, usuariosActivos, modoGuiado);
registerMessages(bot, usuariosActivos, modoGuiado);