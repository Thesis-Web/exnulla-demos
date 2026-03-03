export function normalizeContent(input: string, normalizeCrlf: boolean): string {
  if (!normalizeCrlf) return input;
  // Replace CRLF with LF, and strip stray CR at EOL
  return input.replace(/\r\n/g, "\n").replace(/\r/g, "");
}

export function splitLine1AndRest(normalized: string): { line1: string; rest: string } {
  const idx = normalized.indexOf("\n");
  if (idx === -1) return { line1: normalized, rest: "" };
  return { line1: normalized.slice(0, idx), rest: normalized.slice(idx + 1) };
}
