/**
 * POST /api/vocab/auth
 *
 * 验证管理员密码，设置 session cookie。
 * Body: { password: string }
 */

export const prerender = false;

import { buildSessionCookie } from "../../../lib/vocab-auth";

export async function POST({ request }: { request: Request }) {
  try {
    const { password } = await request.json();
    const expected = import.meta.env.VOCAB_ADMIN_PASSWORD;

    if (!expected) {
      return new Response(
        JSON.stringify({ error: "Server not configured: VOCAB_ADMIN_PASSWORD missing" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    if (password !== expected) {
      return new Response(
        JSON.stringify({ error: "密码错误" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    const cookie = buildSessionCookie();
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": cookie,
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}
