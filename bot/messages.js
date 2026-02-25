import { generarProyecto } from "../services/generator.js";

export default function registerMessages(bot, usuariosActivos, modoGuiado) {

  bot.on("message", async (msg) => {

    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith("/")) return;
    if (!usuariosActivos.has(chatId)) return;

    try {

      const resultado = await generarProyecto(
        chatId,
        text,
        "Proyecto Manual"
      );

      if (resultado.tipo === "online") {
        await bot.sendMessage(
          chatId,
          `🚀 Web creada:\n${resultado.url}`
        );
      } else {
        await bot.sendMessage(
          chatId,
          "⚠️ No se pudo publicar online. Te envío el ZIP."
        );

        await bot.sendDocument(chatId, resultado.zipPath);
      }

    } catch (error) {
      console.error("ERROR:", error.message);
      bot.sendMessage(chatId, "❌ Error generando la web.");
    }

  });

}