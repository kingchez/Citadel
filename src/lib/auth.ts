// Uses the Web Crypto API (globalThis.crypto.subtle) instead of Node's
// `crypto` module, since this file is imported from middleware.ts, which
// runs on the Edge runtime and doesn't support Node built-ins.

const COOKIE_NAME = "citadel_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year - "don't make me log in again"

function getSecret(): string {
  const secret = process.env.CITADEL_SESSION_SECRET;
  if (!secret) {
    throw new Error("CITADEL_SESSION_SECRET is not configured.");
  }
  return secret;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sign(value: string): Promise<string> {
  const key = await hmacKey(getSecret());
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return toHex(signature);
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/** Builds the cookie value: `<issuedAt>.<signature>`. There's no per-user
 * identity to encode - Citadel is single-operator - so the token just proves
 * "someone who knew the password created this session," and never expires
 * client-side (Kingsley shouldn't have to re-enter the password). */
export async function createSessionToken(): Promise<string> {
  const issuedAt = Date.now().toString();
  return `${issuedAt}.${await sign(issuedAt)}`;
}

export async function isValidSessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const [issuedAt, signature] = token.split(".");
  if (!issuedAt || !signature) return false;

  let expected: string;
  try {
    expected = await sign(issuedAt);
  } catch {
    return false;
  }

  return timingSafeEqualString(signature, expected);
}

export function checkPassword(candidate: string): boolean {
  const real = process.env.CITADEL_PASSWORD;
  if (!real) {
    throw new Error("CITADEL_PASSWORD is not configured.");
  }
  return timingSafeEqualString(candidate, real);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
export const SESSION_MAX_AGE_SECONDS = MAX_AGE_SECONDS;
