const API = "https://api.telegram.org";

export async function sendMessage(chatId: number, text: string) {
  const token = (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
  const res = await fetch(`${API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  return res.ok;
}
