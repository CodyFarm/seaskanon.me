/**
 * Vocab Studio 认证工具
 *
 * 使用简单的 HMAC session cookie 进行管理员认证。
 * Session 有效期 24 小时。
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE = "vocab_session";
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getSecret(): string {
  const pw = import.meta.env.VOCAB_ADMIN_PASSWORD;
  if (!pw) throw new Error("VOCAB_ADMIN_PASSWORD not configured");
  return pw;
}

/** Create a signed session token: base64(timestamp:hmac) */
export function createSessionToken(): string {
  const secret = getSecret();
  const timestamp = Date.now().toString();
  const hmac = createHmac("sha256", secret).update(timestamp).digest("hex");
  const payload = `${timestamp}:${hmac}`;
  return Buffer.from(payload).toString("base64url");
}

/** Verify a session token. Returns true if valid and not expired. */
export function verifySessionToken(token: string): boolean {
  try {
    const secret = getSecret();
    const payload = Buffer.from(token, "base64url").toString("utf-8");
    const [timestampStr, receivedHmac] = payload.split(":");
    if (!timestampStr || !receivedHmac) return false;

    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) return false;

    // Check expiry
    if (Date.now() - timestamp > SESSION_TTL) return false;

    // Verify HMAC
    const expectedHmac = createHmac("sha256", secret)
      .update(timestampStr)
      .digest("hex");

    // Constant-time comparison
    const a = Buffer.from(receivedHmac);
    const b = Buffer.from(expectedHmac);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Extract and verify the session cookie from an Astro API request. */
export function isAuthenticated(request: Request): boolean {
  const cookies = request.headers.get("cookie") || "";
  const match = cookies.match(
    new RegExp(`${SESSION_COOKIE}=([^;]+)`)
  );
  if (!match) return false;
  return verifySessionToken(match[1]);
}

/** Build a Set-Cookie header value for a new session. */
export function buildSessionCookie(): string {
  const token = createSessionToken();
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL / 1000}`;
}

/** Return an Astro Response for unauthenticated requests. */
export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
