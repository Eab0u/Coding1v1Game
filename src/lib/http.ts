import type { NextRequest } from "next/server";

/** Returns the trusted origin if it matches the request's Origin header, else null. */
export function requireSameOrigin(request: NextRequest): string | null {
  const origin = process.env.APP_ORIGIN || (process.env.NODE_ENV !== "production" ? request.nextUrl.origin : "");
  if (!origin || request.headers.get("origin") !== origin) return null;
  return origin;
}

/** Reads a request body while enforcing a byte cap on the stream itself, since Content-Length
 * can be absent (e.g. chunked transfer-encoding) or forged. Returns null if the cap is exceeded. */
export async function readBoundedText(request: Request, maxBytes: number): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks).toString("utf8");
}
