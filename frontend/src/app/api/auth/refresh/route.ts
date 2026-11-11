import { NextRequest, NextResponse } from "next/server";
import {
  BACKEND_API, REFRESH_COOKIE, clearSessionCookies, forwardHeaders, isSameOrigin, setSessionCookies,
} from "@/lib/server/session";

export const dynamic = "force-dynamic";

type Tokens = { access: string; refresh: string; role: string };

/*
 * چون هر refresh فقط یک بار قابل استفاده است (چرخش توکن)، اگر چند تب هم‌زمان رفرش کنند
 * همه باید همان نتیجه را بگیرند. نتیجه‌ی هر refresh برای چند ثانیه نگه داشته می‌شود.
 */
const store = globalThis as unknown as {
  __authInflight?: Map<string, Promise<Tokens | null>>;
  __authRecent?: Map<string, { tokens: Tokens; until: number }>;
};
const inflight = (store.__authInflight ??= new Map());
const recent = (store.__authRecent ??= new Map());
const GRACE_MS = 20_000;

async function rotate(req: NextRequest, refresh: string): Promise<Tokens | null> {
  const now = Date.now();
  for (const [k, v] of recent) if (v.until < now) recent.delete(k);
  const cached = recent.get(refresh);
  if (cached) return cached.tokens;

  let p = inflight.get(refresh);
  if (!p) {
    p = (async () => {
      try {
        const r = await fetch(`${BACKEND_API}/identity/token/refresh/`, {
          method: "POST", headers: forwardHeaders(req), body: JSON.stringify({ refresh }), cache: "no-store",
        });
        if (!r.ok) return null;
        const data = await r.json();
        if (!data?.access || !data?.refresh) return null;
        const tokens = { access: data.access, refresh: data.refresh, role: data.role || "CLIENT" };
        recent.set(refresh, { tokens, until: Date.now() + GRACE_MS });
        return tokens;
      } catch {
        return null;
      } finally {
        inflight.delete(refresh);
      }
    })();
    inflight.set(refresh, p);
  }
  return p;
}

/** تمدید نشست: refresh از کوکی httpOnly خوانده و چرخانده می‌شود؛ فقط access جدید به مرورگر می‌رسد */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "درخواست نامعتبر." }, { status: 403 });

  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;
  const tokens = refresh ? await rotate(req, refresh) : null;
  if (!tokens) {
    const res = NextResponse.json({ error: "نشست منقضی شده است." }, { status: 401 });
    clearSessionCookies(res);
    return res;
  }
  const res = NextResponse.json({ access: tokens.access, role: tokens.role }, {
    headers: { "Cache-Control": "no-store" },
  });
  setSessionCookies(req, res, tokens.refresh, tokens.role);
  return res;
}
