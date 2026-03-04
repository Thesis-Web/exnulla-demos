export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const data = new Uint8Array(bytes).buffer;

  const digest = await crypto.subtle.digest("SHA-256", data);
  const out = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return out;
}
