"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Database, Download, HardDrive, Loader2, RefreshCw, ScrollText, Server, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/toaster";
import { Btn, EmptyState, Notice, StatCard } from "@/components/club/ui";
import { apiError, saveBlob, toFaDigits } from "@/lib/club";

type Tab = "health" | "backups" | "logs";
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "health", label: "سلامت سیستم", icon: Activity },
  { id: "backups", label: "بکاپ‌ها", icon: Database },
  { id: "logs", label: "لاگ بک‌اند", icon: ScrollText },
];

const fmtSize = (b: number) => {
  if (b >= 1024 ** 3) return `${toFaDigits((b / 1024 ** 3).toFixed(1))} گیگابایت`;
  if (b >= 1024 ** 2) return `${toFaDigits((b / 1024 ** 2).toFixed(1))} مگابایت`;
  return `${toFaDigits(Math.max(1, Math.round(b / 1024)))} کیلوبایت`;
};
const fmtDate = (ts?: number | null) =>
  ts ? new Date(ts * 1000).toLocaleString("fa-IR", { dateStyle: "medium", timeStyle: "short" }) : "—";
const fmtAge = (sec: number) =>
  sec < 90 ? "چند ثانیه پیش" : sec < 3600 ? `${toFaDigits(Math.round(sec / 60))} دقیقه پیش` : `${toFaDigits(Math.round(sec / 3600))} ساعت پیش`;

/** سلامت سیستم و بکاپ (فقط مدیر سایت) */
export default function AdminSystemPage() {
  const [tab, setTab] = useState<Tab>("health");

  return (
    <div className="mx-auto max-w-6xl space-y-6" dir="rtl">
      <div>
        <p className="text-xs font-bold text-saffron-700">مدیریت سایت</p>
        <h1 className="mt-1 text-2xl font-black text-brand-900">سلامت و بکاپ</h1>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-gray-100 bg-white p-1 shadow-sm" role="tablist">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-sm font-bold ${tab === id ? "bg-brand-700 text-white" : "text-gray-500 hover:text-brand-700"}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "health" && <Health />}
      {tab === "backups" && <Backups />}
      {tab === "logs" && <Logs />}
    </div>
  );
}

function Health() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setData((await api.get("/ops/health/")).data); }
    catch (e) { toast.error(apiError(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-brand-600" /></div>;
  if (!data?.available) {
    return <Notice tone="warn">وضعیتی ثبت نشده است. اسکریپت agent.sh روی سرور (کرون هر یک دقیقه) نصب نشده یا هنوز اجرا نشده است. راهنما در README-ops-fa.md.</Notice>;
  }

  const c = data.checks || {};
  const items: { label: string; ok: boolean; sub?: string; icon: React.ElementType }[] = [
    { label: "سایت (فرانت)", ok: !!c.frontend?.ok, sub: c.frontend ? `${toFaDigits(c.frontend.ms)} میلی‌ثانیه` : undefined, icon: Server },
    { label: "API (بک‌اند)", ok: !!c.api?.ok, sub: c.api ? `${toFaDigits(c.api.ms)} میلی‌ثانیه` : undefined, icon: Server },
    { label: "دیتابیس", ok: !!c.database?.ok, icon: Database },
    { label: "Redis", ok: !!c.redis?.ok, icon: Database },
  ];
  const disk = data.disk;
  const lr = data.last_backup_request;

  return (
    <div className="space-y-5">
      {data.stale && <Notice tone="error">اطلاعات قدیمی است (آخرین به‌روزرسانی {fmtAge(data.age_seconds)}). احتمالاً agent.sh روی سرور متوقف شده است.</Notice>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {items.map((i) => (
          <StatCard key={i.label} label={i.label} value={i.ok ? "سالم" : "مشکل دارد"} sub={i.sub}
            icon={i.icon} tone={i.ok ? "emerald" : "rose"} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {disk && (
          <StatCard label="فضای دیسک" value={`${toFaDigits(disk.used_percent)}٪ پر`} sub={`${toFaDigits(disk.free_gb)} گیگابایت آزاد`}
            icon={HardDrive} tone={disk.used_percent >= 90 ? "rose" : disk.used_percent >= 75 ? "saffron" : "emerald"} />
        )}
        <StatCard label="آخرین بکاپ دیتابیس" value={data.last_backup ? fmtDate(data.last_backup.modified) : "بکاپی پیدا نشد"}
          sub={data.last_backup ? fmtSize(data.last_backup.size) : undefined} icon={ShieldCheck}
          tone={data.last_backup ? "brand" : "rose"} />
      </div>
      {lr && (
        <Notice tone={lr.ok ? "info" : "error"}>آخرین بکاپ دستی: {lr.message} ({fmtDate(lr.finished_at)})</Notice>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <p className="mb-3 text-sm font-black text-gray-800">کانتینرها</p>
        <div className="divide-y divide-gray-100">
          {(data.containers || []).map((ct: any) => (
            <div key={ct.name} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span dir="ltr" className="font-mono text-xs text-gray-700">{ct.name}</span>
              <span className="flex items-center gap-2 text-xs text-gray-500">
                <span dir="ltr">{ct.status}</span>
                <span className={`h-2.5 w-2.5 rounded-full ${ct.state === "running" ? "bg-emerald-500" : "bg-rose-500"}`} />
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>آخرین به‌روزرسانی: {fmtAge(data.age_seconds)}</span>
        <button onClick={load} className="inline-flex min-h-11 items-center gap-1.5 font-bold text-brand-700"><RefreshCw className="h-4 w-4" /> تازه‌سازی</button>
      </div>
    </div>
  );
}

function Backups() {
  const [items, setItems] = useState<any[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [dl, setDl] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = (await api.get("/ops/backups/")).data;
      setItems(d.results || []); setCanManage(!!d.can_manage); setPending(!!d.pending_backup);
    } catch (e) { toast.error(apiError(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  // تا وقتی درخواست بکاپ در صف است، هر ۱۰ ثانیه لیست را تازه کن
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [pending, load]);

  const runBackup = async () => {
    setRunning(true);
    try {
      await api.post("/ops/backups/run/");
      toast.success("درخواست ثبت شد. حداکثر تا یک دقیقه دیگر بکاپ شروع می‌شود.");
      setPending(true);
    } catch (e) { toast.error(apiError(e)); }
    finally { setRunning(false); }
  };

  const download = async (name: string) => {
    setDl(name);
    try {
      const r = await api.get(`/ops/backups/${encodeURIComponent(name)}/download/`, { responseType: "blob" });
      saveBlob(r.data, name);
    } catch (e) { toast.error(apiError(e, "دانلود ممکن نشد.")); }
    finally { setDl(null); }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-brand-600" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">بکاپ خودکار هر شب انجام می‌شود و ۱۴ نسخه‌ی آخر نگه داشته می‌شود.</p>
        {canManage && (
          <Btn onClick={runBackup} loading={running} disabled={pending}>
            <Database className="h-4 w-4" /> {pending ? "در صف اجرا..." : "بکاپ همین الان"}
          </Btn>
        )}
      </div>
      {canManage && (
        <Notice tone="warn">فایل بکاپ شامل شماره و اطلاعات همه‌ی کاربران است. بعد از دانلود در جای امن نگه دارید و آن را برای کسی نفرستید.</Notice>
      )}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {items.length === 0 ? (
          <EmptyState icon={Database} title="بکاپی پیدا نشد" text="بعد از اولین اجرای backup.sh روی سرور، فایل‌ها اینجا نمایش داده می‌شوند." />
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((b) => (
              <div key={b.name} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p dir="ltr" className="truncate text-left font-mono text-xs font-bold text-gray-800">{b.name}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {b.kind === "media" ? "عکس‌ها (media)" : "دیتابیس"} · {fmtDate(b.modified)} · {fmtSize(b.size)}
                  </p>
                </div>
                {canManage && (
                  <Btn variant="outline" loading={dl === b.name} onClick={() => download(b.name)}>
                    <Download className="h-4 w-4" /> دانلود
                  </Btn>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Logs() {
  const [lines, setLines] = useState<string[]>([]);
  const [updated, setUpdated] = useState<number | null>(null);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = (await api.get("/ops/logs/", { params: { lines: 150 } })).data;
      setAvailable(!!d.available); setLines(d.lines || []); setUpdated(d.updated_at);
    } catch (e) { toast.error(apiError(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">توکن‌ها و شماره‌موبایل‌ها در لاگ ماسک شده‌اند. آخرین به‌روزرسانی: {fmtDate(updated)}</p>
        <Btn variant="outline" onClick={load} loading={loading}><RefreshCw className="h-4 w-4" /> تازه‌سازی</Btn>
      </div>
      {!available ? (
        <Notice tone="warn">لاگی ثبت نشده است. agent.sh روی سرور هنوز اجرا نشده است.</Notice>
      ) : (
        <pre dir="ltr" className="max-h-[60vh] overflow-auto rounded-2xl bg-gray-900 p-4 text-left text-[11px] leading-relaxed text-gray-100">
          {lines.length ? lines.join("\n") : "—"}
        </pre>
      )}
    </div>
  );
}
