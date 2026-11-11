"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/toaster";
import { Btn, Modal, Notice } from "@/components/club/ui";
import { apiError, fmtMoney, saveBlob } from "@/lib/club";

interface RowError { row: number; error: string }

/** ثبت گروهی تراکنش با فایل اکسل */
export default function ImportDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<RowError[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = () => { setFile(null); setErrors([]); onClose(); };

  const downloadTemplate = async () => {
    try {
      const res = await api.get("/loyalty/owner/purchases/import-template/", { responseType: "blob" });
      saveBlob(res.data, "transactions-template.xlsx");
    } catch (e) { toast.error(apiError(e, "دریافت نمونه فایل ناموفق بود.")); }
  };

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setErrors([]);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await api.post("/loyalty/owner/purchases/import/", form);
      toast.success(`${Number(res.data.imported).toLocaleString("fa-IR")} تراکنش ثبت شد. کش‌بک کل: ${fmtMoney(res.data.total_cashback)} تومان`);
      onDone();
      close();
    } catch (e: any) {
      setErrors(e?.response?.data?.row_errors || []);
      toast.error(apiError(e, "ثبت فایل ناموفق بود."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="ثبت گروهی تراکنش با اکسل">
      <div className="space-y-4">
        <Notice>
          ستون‌های فایل: موبایل، نام مشتری، مبلغ (تومان)، شعبه، بخش، روش پرداخت، تاریخ شمسی، توضیحات.
          ردیف‌های اکسل فقط کش‌بک می‌گیرند (خرج اعتبار و تخفیف VIP فقط با کد خرید مشتری ممکن است).
          اگر حتی یک ردیف خطا داشته باشد، هیچ ردیفی ثبت نمی‌شود.
        </Notice>
        <Btn variant="outline" className="w-full" onClick={downloadTemplate}><Download className="h-4 w-4" /> دریافت فایل نمونه</Btn>

        <button type="button" onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-500 transition-colors hover:border-brand-300 hover:bg-brand-50/40">
          <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
          {file ? <span className="font-bold text-gray-800">{file.name}</span> : <span>انتخاب فایل xlsx</span>}
        </button>
        <input ref={inputRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] || null); setErrors([]); }} />

        {errors.length > 0 && (
          <div className="max-h-48 overflow-y-auto rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            {errors.map((er, i) => (
              <p key={i} className="py-0.5">{er.row ? `ردیف ${er.row.toLocaleString("fa-IR")}: ` : ""}{er.error}</p>
            ))}
          </div>
        )}

        <Btn className="w-full" onClick={upload} loading={busy} disabled={!file}><Upload className="h-4 w-4" /> بارگذاری و ثبت</Btn>
      </div>
    </Modal>
  );
}
