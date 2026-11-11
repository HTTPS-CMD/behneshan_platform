import { NextRequest, NextResponse } from "next/server";
import { BACKEND_API, forwardHeaders, isSameOrigin, setSessionCookies } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/**
 * ورود/ثبت‌نام: کد OTP به جنگو فرستاده می‌شود و refresh توکن به‌جای رسیدن به جاوااسکریپت،
 * مستقیم در کوکی httpOnly ذخیره می‌شود. مرورگر فقط access کوتاه‌عمر را می‌گیرد.
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "درخواست نامعتبر." }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر." }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND_API}/identity/verify-otp/`, {
      method: "POST", headers: forwardHeaders(req), body: JSON.stringify(body), cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "خطا در ارتباط با سرور." }, { status: 502 });
  }
  
  console.log("[verify-otp] upstream:", BACKEND_API, upstream.status, upstream.url);

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok || !data?.refresh) {
    return NextResponse.json(data, { status: upstream.ok ? 502 : upstream.status });
  }

  const { refresh, ...rest } = data; // refresh هرگز به مرورگر برگردانده نمی‌شود
  const res = NextResponse.json(rest, { status: 200 });
  setSessionCookies(req, res, refresh, data.role);
  return res;
}
