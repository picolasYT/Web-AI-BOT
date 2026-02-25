import { generarProyecto } from "../services/generator.js";

const resultado = await generarProyecto(chatId, prompt, nombreProyecto);

if (resultado.tipo === "online") {
  bot.sendMessage(chatId, `🚀 Web creada:\n${resultado.url}`);
} else {
  bot.sendDocument(chatId, resultado.zipPath);
}