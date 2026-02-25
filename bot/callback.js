import { cargarDB } from "../database/db.js";

export default function registerCallbacks(bot, usuariosActivos, modoGuiado) {

  bot.on("callback_query", async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    // ======================
    // MODO MANUAL
    // ======================

    if (data === "modo_manual") {
      usuariosActivos.add(chatId);
      bot.sendMessage(chatId, "✍️ Modo Manual activado.\nDescribí tu web libremente.");
    }

    // ======================
    // MODO GUIADO
    // ======================

    if (data === "modo_guiado") {
      usuariosActivos.add(chatId);
      modoGuiado[chatId] = { paso: 1, datos: {} };
      bot.sendMessage(chatId, "🧠 Modo Guiado\n\n1️⃣ ¿Nombre del sitio?");
    }

    // ======================
    // MIS PROYECTOS
    // ======================

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

    // ======================
    // CANCELAR
    // ======================

    if (data === "cancelar") {
      usuariosActivos.delete(chatId);
      delete modoGuiado[chatId];
      bot.sendMessage(chatId, "❌ Conversación cancelada.");
    }

    bot.answerCallbackQuery(callbackQuery.id);
  });

}