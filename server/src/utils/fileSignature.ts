/**
 * Detects file type from magic bytes rather than trusting the client-supplied
 * multipart Content-Type header (trivially spoofable) or the original
 * filename's extension. Only the types we actually accept are recognized;
 * anything else returns null and must be rejected by the caller.
 */

export type DetectedFileType = { mimeType: "image/jpeg" | "image/png" | "application/pdf"; extension: string };

export function detectFileType(buffer: Buffer): DetectedFileType | null {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return { mimeType: "image/jpeg", extension: ".jpg" };
  }
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mimeType: "image/png", extension: ".png" };
  }
  if (startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    // "%PDF-"
    return { mimeType: "application/pdf", extension: ".pdf" };
  }
  return null;
}

function startsWith(buffer: Buffer, signature: number[]): boolean {
  if (buffer.length < signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) return false;
  }
  return true;
}
