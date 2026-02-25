import { generarProyecto } from "../services/generator.js";

export default function registerMessages(bot, usuariosActivos, modoGuiado) {

  bot.on("message", async (msg) => {

    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith("/")) return;
    if (!usuariosActivos.has(chatId)) return;

    try {

      // 🔥 1️⃣ Mensaje inicial
      const statusMsg = await bot.sendMessage(
        chatId,
        "⚙️ Generando página web...\n\n[░░░░░░░░░░] 0%"
      );

      const messageId = statusMsg.message_id;

      // 🔥 2️⃣ Simulación progreso
      await bot.editMessageText(
        "🧠 Analizando prompt...\n\n[██░░░░░░░░] 20%",
        { chat_id: chatId, message_id: messageId }
      );

      await new Promise(r => setTimeout(r, 800));

      await bot.editMessageText(
        "🎨 Diseñando interfaz...\n\n[████░░░░░░] 40%",
        { chat_id: chatId, message_id: messageId }
      );

      await new Promise(r => setTimeout(r, 800));

      await bot.editMessageText(
        "✨ Aplicando estilos y animaciones...\n\n[██████░░░░] 60%",
        { chat_id: chatId, message_id: messageId }
      );

      await new Promise(r => setTimeout(r, 800));

      await bot.editMessageText(
        "🚀 Publicando proyecto...\n\n[████████░░] 80%",
        { chat_id: chatId, message_id: messageId }
      );

      // 🔥 3️⃣ Generación real
      const resultado = await generarProyecto(
        chatId,
        text,
        "Proyecto Manual"
      );

      // 🔥 4️⃣ Final
      await bot.editMessageText(
        "✅ Página completada\n\n[██████████] 100%",
        { chat_id: chatId, message_id: messageId }
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