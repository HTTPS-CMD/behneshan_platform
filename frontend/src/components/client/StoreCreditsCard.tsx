"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Gift, MapPin, Store, Ticket, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { fmtMoney, toFaDigits } from "@/lib/club";

interface StoreWallet {
  id: string; business_name: string; business_slug: string; business_logo: string | null;
  membership_no: number; credit_balance: number; purchase_count: number;
  next_expiry: { amount: number; date: string } | null;
  rewards?: { id: number; title: string; description: string; valid_until: string; min_purchase: number }[];
}

interface ShareVoucher {
  id: string; code: string; business_name: string; business_slug: string; business_logo: string | null;
  business_address: string | null; origin_name: string; description: string; valid_until_jalali: string;
}

/** کارت «اعتبار من در فروشگاه‌ها» در پنل مشتری (کش‌بک باشگاه مشتریان + کوپن فروشگاه‌های همکار) */
export default function StoreCreditsCard() {
  const [data, setData] = useState<{ total_credit: number; wallets: StoreWallet[]; share_vouchers?: ShareVoucher[] } | null>(null);

  useEffect(() => {
    api.get("/loyalty/client/wallets/").then((r) => setData(r.data)).catch(() => setData({ total_credit: 0, wallets: [] }));
  }, []);

  const vouchers = data?.share_vouchers || [];
  if (!data || (data.wallets.length === 0 && vouchers.length === 0)) return null;
  const rewards = data.wallets.flatMap((w) => (w.rewards || []).map((r) => ({ ...r, business_name: w.business_name, business_slug: w.business_slug })));

  return (
    <section className="col-span-full rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-black text-gray-900">
          <Wallet className="h-5 w-5 text-saffron-600" /> اعتبار و هدیه‌های من در فروشگاه‌ها
        </h3>
        <span className="rounded-xl bg-saffron-50 px-3 py-1.5 text-sm font-black text-saffron-700">
          جمع: {fmtMoney(data.total_credit)} تومان
        </span>
      </div>
      {data.wallets.length > 0 && (
      <p className="mb-4 text-sm text-gray-500">
        این اعتبار از کش‌بک خریدهای شماست و در خرید بعدی از همان فروشگاه خرج می‌شود. موقع خرید، «کد خرید حضوری» را به فروشنده نشان دهید.
      </p>
      )}
      {data.wallets.length > 0 && (
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.wallets.map((w) => (
          <li key={w.id}>
            <Link href={`/business/${w.business_slug}`}
              className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-cream/60 p-3 transition-colors hover:border-brand-200">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white text-brand-400">
                {w.business_logo ? <img src={w.business_logo} alt="" className="h-full w-full object-cover" /> : <Store className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-gray-800">{w.business_name}</p>
                <p className="text-[11px] text-gray-500">
                  اشتراک {toFaDigits(w.membership_no)}
                  {w.next_expiry ? ` · ${fmtMoney(w.next_expiry.amount)} تا ${toFaDigits(w.next_expiry.date)}` : ""}
                </p>
              </div>
              <p className={`shrink-0 font-black ${w.credit_balance ? "text-saffron-700" : "text-gray-300"}`}>{fmtMoney(w.credit_balance)}</p>
            </Link>
          </li>
        ))}
      </ul>
      )}

      {vouchers.length > 0 && (
        <div className="mt-5">
          <h4 className="mb-1 flex items-center gap-2 text-sm font-black text-gray-800"><Ticket className="h-4 w-4 text-saffron-600" /> کوپن‌های هدیه از فروشگاه‌های همکار</h4>
          <p className="mb-3 text-xs text-gray-500">به‌خاطر خریدهایتان، این فروشگاه‌های نزدیک برای اولین خریدتان تخفیف گذاشته‌اند.</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {vouchers.map((v) => (
              <li key={v.id} className="flex gap-3 rounded-2xl border border-dashed border-brand-300 bg-brand-50/60 p-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white text-brand-400">
                  {v.business_logo ? <img src={v.business_logo} alt="" className="h-full w-full object-cover" /> : <Store className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <p className="font-black text-brand-800">{toFaDigits(v.description)}</p>
                  <Link href={`/business/${v.business_slug}`} className="text-sm font-bold text-gray-800 hover:text-brand-700">{v.business_name}</Link>
                  {v.business_address && <p className="flex items-center gap-1 truncate text-[11px] text-gray-500"><MapPin className="h-3 w-3 shrink-0" />{v.business_address}</p>}
                  <p className="mt-0.5 text-[11px] text-gray-500">اعتبار تا {toFaDigits(v.valid_until_jalali)} · هدیه‌ی خرید از {v.origin_name}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-gray-500">برای استفاده، موقع خرید «کد خرید حضوری» را به فروشنده نشان دهید؛ تخفیف خودکار اعمال می‌شود.</p>
        </div>
      )}

      {rewards.length > 0 && (
        <div className="mt-5">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-black text-gray-800"><Gift className="h-4 w-4 text-saffron-600" /> هدیه‌های فعال شما</h4>
          <ul className="grid gap-2 sm:grid-cols-2">
            {rewards.map((r) => (
              <li key={r.id} className="rounded-2xl border border-dashed border-saffron-300 bg-saffron-50 p-3">
                <p className="font-black text-saffron-800">{toFaDigits(r.description)}</p>
                <p className="mt-0.5 text-xs text-gray-600">
                  {r.title} · <Link href={`/business/${r.business_slug}`} className="font-bold hover:text-brand-700">{r.business_name}</Link>
                </p>
                <p className="mt-0.5 text-[11px] text-gray-500">
                  {r.valid_until ? `اعتبار تا ${toFaDigits(r.valid_until)}` : ""}{r.min_purchase ? ` · حداقل خرید ${fmtMoney(r.min_purchase)} تومان` : ""}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-gray-500">برای استفاده، موقع خرید «کد خرید حضوری» را به فروشنده نشان دهید.</p>
        </div>
      )}
    </section>
  );
}
