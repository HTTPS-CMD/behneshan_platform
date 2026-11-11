import { NextRequest, NextResponse } from "next/server";
import { BACKEND_API, REFRESH_COOKIE, clearSessionCookies, forwardHeaders, isSameOrigin } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** خروج: refresh در جنگو باطل (blacklist) و کوکی‌ها پاک می‌شوند */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "درخواست نامعتبر." }, { status: 403 });
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;
  if (refresh) {
    try {
      await fetch(`${BACKEND_API}/identity/logout/`, {
        method: "POST", headers: forwardHeaders(req), body: JSON.stringify({ refresh }), cache: "no-store",
      });
    } catch {
      // حتی اگر جنگو در دسترس نباشد، کوکی‌ها پاک می‌شوند
    }
  }
  const res = NextResponse.json({ ok: true });
  clearSessionCookies(res);
  return res;
}
