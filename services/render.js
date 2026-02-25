import axios from "axios";

export async function publicarEnRender(chatId, html) {
  const response = await axios.post(
    "https://web-ai-bot-web.onrender.com/api/crear",
    {
      usuario: chatId.toString(),
      html
    }
  );

  return response.data?.url || null;
}