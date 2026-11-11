/**
 * بررسی امضای JWT (HS256) سمت سرور Next — بدون وابستگی خارجی (Web Crypto).
 * کلید باید با SIMPLE_JWT['SIGNING_KEY'] جنگو یکی باشد: متغیر JWT_SIGNING_KEY در frontend/.env.local
 * فقط در کد سمت سرور (proxy.ts و Route Handlerها) استفاده شود.
 */
export interface JwtPayload {
  user_id?: string;
  role?: string;
  token_type?: string;
  exp?: number;
  [key: string]: unknown;
}

const enc = new TextEncoder();
let cachedKey: { secret: string; key: CryptoKey } | null = null;
let warned = false;

function b64urlToBytes(input: string): Uint8Array {
  let s = input.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function decodePart<T>(part: string): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(b64urlToBytes(part))) as T;
  } catch {
    return null;
  }
}

async function getKey(secret: string) {
  if (cachedKey?.secret === secret) return cachedKey.key;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  cachedKey = { secret, key };
  return key;
}

/** توکن معتبر (امضا + انقضا) -> payload ، در غیر این صورت null */
export async function verifyJwt(token: string | undefined, expectedType?: "access" | "refresh"): Promise<JwtPayload | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts;
  const header = decodePart<{ alg?: string }>(h);
  const payload = decodePart<JwtPayload>(p);
  if (!header || !payload || header.alg !== "HS256") return null;

  const secret = process.env.JWT_SIGNING_KEY;
  if (secret) {
    try {
      const ok = await crypto.subtle.verify("HMAC", await getKey(secret), b64urlToBytes(sig) as BufferSource, enc.encode(`${h}.${p}`));
      if (!ok) return null;
    } catch {
      return null;
    }
  } else if (process.env.NODE_ENV === "production") {
    if (!warned) { console.error("[auth] JWT_SIGNING_KEY تنظیم نشده؛ همه‌ی نشست‌ها نامعتبر در نظر گرفته می‌شوند."); warned = true; }
    return null;
  } else if (!warned) {
    console.warn("[auth] JWT_SIGNING_KEY تنظیم نشده؛ در حالت توسعه امضای توکن بررسی نمی‌شود.");
    warned = true;
  }

  if (typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) return null;
  if (expectedType && payload.token_type !== expectedType) return null;
  return payload;
}
