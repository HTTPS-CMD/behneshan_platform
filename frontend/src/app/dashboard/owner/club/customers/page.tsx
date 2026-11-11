"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Filter, Loader2, Search, Tags, UserPlus, Users, X } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/toaster";
import ClubHeader from "@/components/club/ClubHeader";
import NewPurchaseDialog from "@/components/club/NewPurchaseDialog";
import {
  Customer, CustomerFormDialog, CustomerProfileDialog, Label, LabelChip, LabelsDialog,
} from "@/components/club/CustomerDialogs";
import { Btn, EmptyState, Field, Pagination, StatCard, inputCls } from "@/components/club/ui";
import { JALALI_MONTHS, apiError, fmtMoney, toFaDigits } from "@/lib/club";

const PAGE_SIZE = 20;
const emptyFilters = { q: "", segment: "", label: "", marital_status: "", birth_month: "", has_credit: "", has_account: "", ordering: "newest" };

export default function ClubCustomersPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [labels, setLabels] = useState<Label[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [segments, setSegments] = useState<{ key: string; label: string; count: number }[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [profile, setProfile] = useState<Customer | null>(null);
  const [purchasePhone, setPurchasePhone] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, page_size: PAGE_SIZE };
      Object.entries(applied).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await api.get("/loyalty/owner/customers/", { params });
      setItems(res.data.results);
      setCount(res.data.count);
    } catch (e) {
      toast.error(apiError(e, "دریافت مشتریان ناموفق بود."));
    } finally {
      setLoading(false);
    }
  }, [applied, page]);

  const loadLabels = useCallback(() => {
    api.get("/loyalty/owner/labels/").then((r) => setLabels(r.data)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);
  // ورود از «دیتای هوشمند» با ?segment=...
  useEffect(() => {
    const seg = new URLSearchParams(window.location.search).get("segment");
    if (seg) {
      setFilters((f) => ({ ...f, segment: seg }));
      setApplied((f) => ({ ...f, segment: seg }));
      setShowFilters(true);
    }
    api.get("/loyalty/owner/segments/").then((r) => setSegments(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    loadLabels();
    api.get("/loyalty/owner/branches/").then((r) => setBranches(r.data)).catch(() => {});
  }, [loadLabels]);

  const apply = () => { setPage(1); setApplied(filters); };
  const clear = () => { setFilters(emptyFilters); setApplied(emptyFilters); setPage(1); };
  const activeFilters = Object.entries(applied).filter(([k, v]) => v && !(k === "ordering" && v === "newest")).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6" dir="rtl">
      <ClubHeader
        title="مشتریان باشگاه"
        subtitle="لیست مشتریان، برچسب‌ها، تاریخ تولد و اعتبار هر مشتری"
        actions={<>
          <Btn variant="accent" onClick={() => { setEditing(null); setFormOpen(true); }}><UserPlus className="h-4 w-4" /> افزودن مشتری</Btn>
          <Btn variant="outline" onClick={() => setLabelsOpen(true)}><Tags className="h-4 w-4" /> برچسب‌ها</Btn>
        </>}
      />

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="تعداد مشتریان" value={count.toLocaleString("fa-IR")} sub={activeFilters ? "با فیلتر فعلی" : undefined} icon={Users} />
        <StatCard label="برچسب‌ها" value={labels.length.toLocaleString("fa-IR")} icon={Tags} tone="saffron" />
      </div>

      <section className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-gray-400" />
            <input className={`${inputCls} pr-9`} placeholder="نام، موبایل یا شماره اشتراک" value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })} onKeyDown={(e) => e.key === "Enter" && apply()} />
          </div>
          <Btn variant="outline" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
            <Filter className="h-4 w-4" /> فیلترها{activeFilters ? ` (${activeFilters.toLocaleString("fa-IR")})` : ""}
          </Btn>
          <Btn onClick={apply}>اعمال</Btn>
        </div>
        {showFilters && (
          <div className="mt-4 grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="گروه (دیتای هوشمند)">
              <select className={inputCls} value={filters.segment} onChange={(e) => setFilters({ ...filters, segment: e.target.value })}>
                <option value="">همه</option>
                {segments.map((s) => <option key={s.key} value={s.key}>{s.label} ({s.count.toLocaleString("fa-IR")})</option>)}
              </select>
            </Field>
            <Field label="برچسب">
              <select className={inputCls} value={filters.label} onChange={(e) => setFilters({ ...filters, label: e.target.value })}>
                <option value="">همه</option>
                {labels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </Field>
            <Field label="وضعیت تأهل">
              <select className={inputCls} value={filters.marital_status} onChange={(e) => setFilters({ ...filters, marital_status: e.target.value })}>
                <option value="">همه</option><option value="SINGLE">مجرد</option><option value="MARRIED">متأهل</option>
              </select>
            </Field>
            <Field label="ماه تولد">
              <select className={inputCls} value={filters.birth_month} onChange={(e) => setFilters({ ...filters, birth_month: e.target.value })}>
                <option value="">همه</option>
                {JALALI_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </Field>
            <Field label="اعتبار">
              <select className={inputCls} value={filters.has_credit} onChange={(e) => setFilters({ ...filters, has_credit: e.target.value })}>
                <option value="">همه</option><option value="1">دارای اعتبار</option>
              </select>
            </Field>
            <Field label="حساب سایت">
              <select className={inputCls} value={filters.has_account} onChange={(e) => setFilters({ ...filters, has_account: e.target.value })}>
                <option value="">همه</option><option value="1">عضو سایت</option><option value="0">بدون حساب</option>
              </select>
            </Field>
            <Field label="مرتب‌سازی">
              <select className={inputCls} value={filters.ordering} onChange={(e) => setFilters({ ...filters, ordering: e.target.value })}>
                <option value="newest">جدیدترین</option><option value="recent">آخرین خرید</option>
                <option value="purchases">بیشترین خرید</option><option value="credit">بیشترین اعتبار</option>
                <option value="membership">شماره اشتراک</option>
              </select>
            </Field>
            <div className="sm:col-span-2 lg:col-span-4">
              <button onClick={clear} className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-gray-500 hover:text-rose-600"><X className="h-4 w-4" /> پاک کردن فیلترها</button>
            </div>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-brand-500" /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={Users} title="مشتری یافت نشد"
            text={activeFilters ? "فیلترها را تغییر دهید." : "مشتریان با اولین خرید خودکار اضافه می‌شوند، یا می‌توانید دستی ثبتشان کنید."}
            action={!activeFilters && <Btn variant="accent" onClick={() => { setEditing(null); setFormOpen(true); }}><UserPlus className="h-4 w-4" /> افزودن مشتری</Btn>} />
        ) : (
          <ul className="divide-y divide-gray-50">
            {items.map((c) => (
              <li key={c.id}>
                <button onClick={() => setProfile(c)} className="grid w-full grid-cols-[1fr_auto] items-center gap-3 p-4 text-right transition-colors hover:bg-brand-50/40 md:grid-cols-[2fr_1fr_1fr_1fr]">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate font-bold text-gray-800">
                      {c.full_name || "بدون نام"}
                      {c.has_account && <BadgeCheck className="h-4 w-4 shrink-0 text-brand-500" aria-label="عضو سایت" />}
                    </p>
                    <p className="text-xs text-gray-500"><span dir="ltr">{c.phone_number}</span> · اشتراک {toFaDigits(c.membership_no)}</p>
                    {c.labels.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{c.labels.map((l) => <LabelChip key={l.id} label={l} />)}</div>}
                  </div>
                  <div className="hidden text-sm md:block">
                    <p className="text-[11px] text-gray-500">خرید</p>
                    <p className="font-bold text-gray-700">{toFaDigits(c.purchase_count)} بار · {fmtMoney(c.total_purchase_amount)}</p>
                  </div>
                  <div className="hidden text-sm md:block">
                    <p className="text-[11px] text-gray-500">آخرین خرید</p>
                    <p className="font-bold text-gray-700">{c.last_purchase_jalali ? toFaDigits(c.last_purchase_jalali) : "—"}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-[11px] text-gray-500">اعتبار</p>
                    <p className={`font-black ${c.credit_balance ? "text-saffron-700" : "text-gray-300"}`}>{fmtMoney(c.credit_balance)}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Pagination page={page} count={count} pageSize={PAGE_SIZE} onChange={setPage} />

      <CustomerFormDialog open={formOpen} onClose={() => setFormOpen(false)} onSaved={() => { load(); loadLabels(); }} labels={labels} edit={editing} />
      <LabelsDialog open={labelsOpen} onClose={() => setLabelsOpen(false)} labels={labels} onChanged={() => { loadLabels(); load(); }} />
      <CustomerProfileDialog
        customer={profile}
        onClose={() => setProfile(null)}
        onEdit={(c) => { setProfile(null); setEditing(c); setFormOpen(true); }}
        onNewPurchase={(phone) => { setProfile(null); setPurchasePhone(phone); }}
        onChanged={load}
      />
      <NewPurchaseDialog open={purchasePhone !== null} onClose={() => setPurchasePhone(null)} onDone={load}
        branches={branches} presetPhone={purchasePhone || ""} />
    </div>
  );
}
