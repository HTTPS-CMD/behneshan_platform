"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Coins, Download, Filter, Loader2, Plus, Receipt, Search, Upload, Wallet, X } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/toaster";
import ClubHeader from "@/components/club/ClubHeader";
import NewPurchaseDialog from "@/components/club/NewPurchaseDialog";
import ImportDialog from "@/components/club/ImportDialog";
import { Btn, EmptyState, Field, Modal, Pagination, StatCard, inputCls } from "@/components/club/ui";
import { PAYMENT_METHODS, apiError, fmtMoney, isJalaliDate, saveBlob, toEnDigits, toFaDigits } from "@/lib/club";

interface Purchase {
  id: string; customer_id: string; customer_name: string; customer_phone: string; membership_no: number;
  branch_name: string; line_name: string; payment_method: string; payment_method_display: string;
  original_amount: number; discount_percent: number; discount_source_display: string; discount_amount: number;
  credit_used: number; final_amount: number; cashback_amount: number; verified: boolean; source: string;
  note: string; purchased_jalali: string; purchased_time: string;
}
interface Totals { count: number; original: number; final: number; discount: number; credit_used: number; cashback: number }

const PAGE_SIZE = 20;
const emptyFilters = { q: "", date_from: "", date_to: "", branch: "", line: "", payment_method: "", credit: "" };

export default function ClubTransactionsPage() {
  const [items, setItems] = useState<Purchase[]>([]);
  const [count, setCount] = useState(0);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [detail, setDetail] = useState<Purchase | null>(null);
  const [exporting, setExporting] = useState(false);

  const params = useCallback((f: typeof emptyFilters) => {
    const p: Record<string, string> = {};
    Object.entries(f).forEach(([k, v]) => { if (v) p[k] = toEnDigits(v); });
    return p;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/loyalty/owner/purchases/", { params: { ...params(applied), page, page_size: PAGE_SIZE } });
      setItems(res.data.results);
      setCount(res.data.count);
      setTotals(res.data.totals);
    } catch (e) {
      toast.error(apiError(e, "دریافت تراکنش‌ها ناموفق بود."));
    } finally {
      setLoading(false);
    }
  }, [applied, page, params]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get("/loyalty/owner/branches/").then((r) => setBranches(r.data)).catch(() => {});
  }, []);

  const applyFilters = () => {
    for (const k of ["date_from", "date_to"] as const) {
      if (filters[k] && !isJalaliDate(filters[k])) return toast.error("تاریخ را به شکل ۱۴۰۳/۰۵/۱۲ وارد کنید.");
    }
    setPage(1);
    setApplied(filters);
  };
  const clearFilters = () => { setFilters(emptyFilters); setApplied(emptyFilters); setPage(1); };
  const activeFilterCount = Object.values(applied).filter(Boolean).length;
  const lines = branches.find((b) => String(b.id) === filters.branch)?.lines || [];

  const exportExcel = async () => {
    setExporting(true);
    try {
      const res = await api.get("/loyalty/owner/purchases/export/", { params: params(applied), responseType: "blob" });
      saveBlob(res.data, "transactions.xlsx");
    } catch (e) {
      toast.error(apiError(e, "خروجی اکسل ناموفق بود. (pip install openpyxl را در بک‌اند اجرا کنید)"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6" dir="rtl">
      <ClubHeader
        title="تراکنش‌ها و اعتبار"
        subtitle="ثبت خرید مشتری، صدور کش‌بک، خرج اعتبار و تاریخچه‌ی تراکنش‌ها"
        actions={<>
          <Btn variant="accent" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> ثبت تراکنش</Btn>
          <Btn variant="outline" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" /> ورود از اکسل</Btn>
          <Btn variant="outline" onClick={exportExcel} loading={exporting}><Download className="h-4 w-4" /> خروجی اکسل</Btn>
        </>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="تعداد تراکنش" value={(totals?.count || 0).toLocaleString("fa-IR")} icon={Receipt} />
        <StatCard label="مبلغ دریافتی" value={fmtMoney(totals?.final)} sub="تومان" icon={Coins} tone="emerald" />
        <StatCard label="کش‌بک صادرشده" value={fmtMoney(totals?.cashback)} sub="تومان" icon={Wallet} tone="saffron" />
        <StatCard label="اعتبار خرج‌شده" value={fmtMoney(totals?.credit_used)} sub="تومان" icon={BadgeCheck} tone="rose" />
      </div>

      <section className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-gray-400" />
            <input className={`${inputCls} pr-9`} placeholder="جستجوی نام یا موبایل مشتری" value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })} onKeyDown={(e) => e.key === "Enter" && applyFilters()} />
          </div>
          <Btn variant="outline" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
            <Filter className="h-4 w-4" /> فیلترها{activeFilterCount ? ` (${activeFilterCount.toLocaleString("fa-IR")})` : ""}
          </Btn>
          <Btn onClick={applyFilters}>اعمال</Btn>
        </div>
        {showFilters && (
          <div className="mt-4 grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-2 lg:grid-cols-6">
            <Field label="از تاریخ"><input className={inputCls} dir="ltr" placeholder="1403/01/01" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} /></Field>
            <Field label="تا تاریخ"><input className={inputCls} dir="ltr" placeholder="1403/12/29" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} /></Field>
            <Field label="شعبه">
              <select className={inputCls} value={filters.branch} onChange={(e) => setFilters({ ...filters, branch: e.target.value, line: "" })}>
                <option value="">همه</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <Field label="بخش">
              <select className={inputCls} value={filters.line} disabled={!lines.length} onChange={(e) => setFilters({ ...filters, line: e.target.value })}>
                <option value="">همه</option>
                {lines.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </Field>
            <Field label="روش پرداخت">
              <select className={inputCls} value={filters.payment_method} onChange={(e) => setFilters({ ...filters, payment_method: e.target.value })}>
                <option value="">همه</option>
                {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </Field>
            <Field label="اعتبار">
              <select className={inputCls} value={filters.credit} onChange={(e) => setFilters({ ...filters, credit: e.target.value })}>
                <option value="">همه</option>
                <option value="used">فقط خرج اعتبار</option>
              </select>
            </Field>
            <div className="sm:col-span-2 lg:col-span-6">
              <button onClick={clearFilters} className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-gray-500 hover:text-rose-600">
                <X className="h-4 w-4" /> پاک کردن فیلترها
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-brand-500" /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={Receipt} title="تراکنشی یافت نشد"
            text={activeFilterCount ? "فیلترها را تغییر دهید." : "اولین خرید مشتری را ثبت کنید تا کش‌بک بگیرد."}
            action={!activeFilterCount && <Btn variant="accent" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> ثبت تراکنش</Btn>} />
        ) : (
          <>
            {/* جدول دسکتاپ */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-cream text-xs text-gray-500">
                  <tr>
                    {["تاریخ", "مشتری", "شعبه / بخش", "روش پرداخت", "مبلغ فاکتور", "پرداختی", "اعتبار خرج‌شده", "کش‌بک"].map((h) => (
                      <th key={h} className="whitespace-nowrap px-4 py-3 text-right font-bold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((p) => (
                    <tr key={p.id} onClick={() => setDetail(p)} className="cursor-pointer transition-colors hover:bg-brand-50/40">
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">{toFaDigits(p.purchased_jalali)} <span className="text-xs text-gray-500">{p.purchased_time}</span></td>
                      <td className="px-4 py-3">
                        <p className="flex items-center gap-1 font-bold text-gray-800">{p.customer_name || "بدون نام"}{p.verified && <BadgeCheck className="h-4 w-4 text-emerald-600" aria-label="تأیید با کد" />}</p>
                        <p className="text-xs text-gray-500" dir="ltr" style={{ textAlign: "right" }}>{p.customer_phone}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{p.branch_name || "—"}{p.line_name ? ` / ${p.line_name}` : ""}</td>
                      <td className="px-4 py-3 text-gray-600">{p.payment_method_display}</td>
                      <td className="px-4 py-3 font-bold text-gray-800">{fmtMoney(p.original_amount)}</td>
                      <td className="px-4 py-3 font-black text-brand-800">{fmtMoney(p.final_amount)}</td>
                      <td className="px-4 py-3 text-rose-600">{p.credit_used ? fmtMoney(p.credit_used) : "—"}</td>
                      <td className="px-4 py-3 font-bold text-saffron-700">{fmtMoney(p.cashback_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* کارت موبایل */}
            <ul className="divide-y divide-gray-50 md:hidden">
              {items.map((p) => (
                <li key={p.id}>
                  <button onClick={() => setDetail(p)} className="flex w-full items-center justify-between gap-3 p-4 text-right">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-gray-800">{p.customer_name || p.customer_phone}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{toFaDigits(p.purchased_jalali)} · {p.payment_method_display}</p>
                    </div>
                    <div className="shrink-0 text-left">
                      <p className="font-black text-brand-800">{fmtMoney(p.final_amount)}</p>
                      <p className="text-xs font-bold text-saffron-700">+{fmtMoney(p.cashback_amount)} کش‌بک</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <Pagination page={page} count={count} pageSize={PAGE_SIZE} onChange={setPage} />

      <NewPurchaseDialog open={newOpen} onClose={() => setNewOpen(false)} onDone={load} branches={branches} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onDone={load} />

      <Modal open={!!detail} onClose={() => setDetail(null)} title="جزئیات تراکنش">
        {detail && (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["مشتری", detail.customer_name || "بدون نام"], ["موبایل", detail.customer_phone],
              ["شماره اشتراک", String(detail.membership_no)], ["تاریخ", toFaDigits(`${detail.purchased_jalali} - ${detail.purchased_time}`)],
              ["شعبه", detail.branch_name || "—"], ["بخش", detail.line_name || "—"],
              ["روش پرداخت", detail.payment_method_display], ["منبع تخفیف", detail.discount_source_display],
              ["مبلغ فاکتور", `${fmtMoney(detail.original_amount)} تومان`], ["تخفیف", `${fmtMoney(detail.discount_amount)} تومان`],
              ["اعتبار خرج‌شده", `${fmtMoney(detail.credit_used)} تومان`], ["مبلغ پرداختی", `${fmtMoney(detail.final_amount)} تومان`],
              ["کش‌بک", `${fmtMoney(detail.cashback_amount)} تومان`], ["تأیید با کد خرید", detail.verified ? "بله" : "خیر"],
              ["ثبت از", detail.source === "IMPORT" ? "فایل اکسل" : "پنل"], ["توضیحات", detail.note || "—"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-gray-50 p-3">
                <dt className="text-[11px] font-bold text-gray-500">{k}</dt>
                <dd className="mt-0.5 font-bold text-gray-800" dir={k === "موبایل" ? "ltr" : undefined} style={k === "موبایل" ? { textAlign: "right" } : undefined}>{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </Modal>
    </div>
  );
}
