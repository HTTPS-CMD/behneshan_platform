"use client";

import { useState } from "react";
import { useRouter } from "next/navigation"; // اضافه شدن روتر
import { RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ClearCacheButton() {
  const router = useRouter(); // تعریف روتر
  const [isClearing, setIsClearing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<'info' | 'success' | 'error' | null>(null);

  const handleClearCache = () => {
    if (isClearing) return;

    setIsClearing(true);
    setProgress(0);
    setMessage("شروع عملیات...");
    setStatus('info');

    const eventSource = new EventSource('/api/clear-cache-live');

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setProgress(data.progress);
      setMessage(data.message);

      if (data.status === 'success' || data.status === 'error') {
        setStatus(data.status);
        eventSource.close();
        
        // بعد از پر شدن نوار، صفحه رفرش می‌شود تا تغییرات دیده شوند
        setTimeout(() => {
          setIsClearing(false);
          setProgress(0);
          if (data.status === 'success') {
            window.location.reload(); // رفرش کل صفحه برای دریافت دیتای جدید
          }
        }, 2000); 
      }
    };

    eventSource.onerror = () => {
      setMessage("ارتباط زنده با سرور قطع شد.");
      setStatus('error');
      eventSource.close();
    };
  };

  return (
    <div className="w-full mb-2">
      <button
        onClick={handleClearCache}
        disabled={isClearing}
        className="flex items-center gap-3 px-4 py-3 w-full text-amber-400 hover:bg-amber-400/10 rounded-xl font-medium transition-all disabled:opacity-50"
      >
        <RefreshCw className={`w-5 h-5 ${isClearing && status === 'info' ? "animate-spin" : ""}`} />
        {isClearing ? "در حال ارتباط زنده..." : "پاکسازی کش سایت"}
      </button>

      <AnimatePresence>
        {isClearing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 px-4"
          >
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-2">
              <motion.div
                className={`h-full ${status === 'error' ? 'bg-rose-500' : status === 'success' ? 'bg-emerald-500' : 'bg-amber-400'}`}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ ease: "linear", duration: 0.3 }}
              />
            </div>
            
            <div className="flex items-center gap-2 text-[11px] font-bold">
              {status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
              {status === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
              <span className={`${status === 'error' ? 'text-rose-500' : status === 'success' ? 'text-emerald-500' : 'text-slate-400'}`}>
                {message}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}