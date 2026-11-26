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

export async function downloadTelegramPhoto(
  fileId: string,
): Promise<{ base64: string; mimeType: string } | null> {
  const token = (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
  if (!token || !fileId) return null;
  try {
    const metaRes = await fetch(`${API}/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`);
    if (!metaRes.ok) return null;
    const meta = (await metaRes.json()) as { ok?: boolean; result?: { file_path?: string } };
    const filePath = meta?.result?.file_path;
    if (!filePath) return null;

    const fileRes = await fetch(`${API}/file/bot${token}/${filePath}`);
    if (!fileRes.ok) return null;
    const buf = Buffer.from(await fileRes.arrayBuffer());
    const lower = filePath.toLowerCase();
    const mimeType = lower.endsWith(".png")
      ? "image/png"
      : lower.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";
    return { base64: buf.toString("base64"), mimeType };
  } catch (err) {
    console.error("Failed to download Telegram photo:", err);
    return null;
  }
}
