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

export function extractTelegramImageFileId(msg: Record<string, unknown> | null | undefined): string | null {
  if (!msg) return null;
  // 1. Standard compressed photo array on the message
  if (Array.isArray(msg.photo) && msg.photo.length > 0) {
    const photos = msg.photo as Array<{ file_id?: string }>;
    const chosen = photos[Math.max(0, photos.length - 2)] ?? photos[photos.length - 1];
    if (chosen?.file_id) return chosen.file_id;
  }
  // 2. Uncompressed image sent as a document attachment
  const doc = msg.document as { file_id?: string; mime_type?: string } | undefined;
  if (doc?.file_id && typeof doc.mime_type === "string" && doc.mime_type.startsWith("image/")) {
    return doc.file_id;
  }
  // 3. Replied-to message containing a photo or image document
  const reply = msg.reply_to_message as Record<string, unknown> | undefined;
  if (reply) {
    if (Array.isArray(reply.photo) && reply.photo.length > 0) {
      const photos = reply.photo as Array<{ file_id?: string }>;
      const chosen = photos[Math.max(0, photos.length - 2)] ?? photos[photos.length - 1];
      if (chosen?.file_id) return chosen.file_id;
    }
    const replyDoc = reply.document as { file_id?: string; mime_type?: string } | undefined;
    if (replyDoc?.file_id && typeof replyDoc.mime_type === "string" && replyDoc.mime_type.startsWith("image/")) {
      return replyDoc.file_id;
    }
  }
  return null;
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
