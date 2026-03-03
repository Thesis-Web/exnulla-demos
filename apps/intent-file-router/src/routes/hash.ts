function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256HexUtf8(text: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}
