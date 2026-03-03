import type { RepoKey, ValidationIssue } from "../lib/types";

const DENY_EXT = new Set([".mp4", ".mov", ".avi", ".mkv", ".zip", ".exe", ".dll", ".bin"]);

export function validateFilename(filename: string): ValidationIssue[] {
  const lower = filename.toLowerCase();
  for (const ext of DENY_EXT) {
    if (lower.endsWith(ext)) {
      return [
        {
          code: "DENYLIST_EXTENSION",
          severity: "error",
          message: `Filename extension is denied: ${ext}`,
          details: { filename, ext },
        },
      ];
    }
  }
  return [];
}

export function validateRepoKey(repoKey: string, allowed: RepoKey | null): ValidationIssue[] {
  if (allowed) return [];
  return [
    {
      code: "UNKNOWN_REPO",
      severity: "error",
      message: `Unknown repo key: ${repoKey}`,
      details: { repoKey },
    },
  ];
}

export function validatePath(pathInRepo: string): {
  normalizedPath: string;
  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = [];
  let p = pathInRepo.trim();

  if (!p) {
    issues.push({ code: "EMPTY_PATH", severity: "error", message: "Empty path in TARGET header." });
    return { normalizedPath: p, issues };
  }

  if (p.startsWith("/")) {
    issues.push({
      code: "ABSOLUTE_PATH",
      severity: "error",
      message: "Absolute paths are not allowed.",
    });
  }

  if (p.includes("\\")) {
    p = p.replace(/\\/g, "/");
    issues.push({
      code: "BACKSLASH_IN_PATH",
      severity: "warn",
      message: "Backslashes were normalized to forward slashes.",
    });
  }

  const segments = p.split("/");
  if (segments.some((s) => s === "..")) {
    issues.push({
      code: "PATH_TRAVERSAL",
      severity: "error",
      message: "Path traversal ('..') is not allowed.",
    });
  }

  return { normalizedPath: p, issues };
}

export function validatePayloadSizeBytes(payload: string, maxBytes: number): ValidationIssue[] {
  const bytes = Buffer.byteLength(payload, "utf8");
  if (bytes > maxBytes) {
    return [
      {
        code: "PAYLOAD_TOO_LARGE",
        severity: "error",
        message: `Payload exceeds max size (${maxBytes} bytes).`,
        details: { bytes, maxBytes },
      },
    ];
  }
  return [];
}

export function detectBinary(normalized: string, forceBinary: boolean): ValidationIssue[] {
  if (forceBinary) {
    return [
      {
        code: "BINARY_DETECTED",
        severity: "error",
        message: "Binary mode enabled; input is not routable.",
      },
    ];
  }
  if (normalized.includes("\x00")) {
    return [
      {
        code: "BINARY_DETECTED",
        severity: "error",
        message: "Null byte detected; input is binary.",
      },
    ];
  }
  return [];
}
