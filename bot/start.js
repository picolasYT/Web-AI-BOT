export default function registerStart(bot) {
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    const menu = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🧠 Modo Guiado", callback_data: "modo_guiado" },
            { text: "✍️ Modo Manual", callback_data: "modo_manual" }
          ],
          [{ text: "📁 Mis Proyectos", callback_data: "mis_proyectos" }],
          [{ text: "❌ Cancelar", callback_data: "cancelar" }]
        ]
      }
    };

    bot.sendMessage(chatId, "👋 Bienvenido a Web AI Bot", menu);
  });
}