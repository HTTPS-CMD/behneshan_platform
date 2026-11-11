import { TimerReset } from "lucide-react";
import { toFaDigits } from "@/lib/format";

/** شمارش معکوس اعتبار کد پیامکی (مشترک بین ورود و ثبت‌نام) */
export default function OtpTimer({ seconds }: { seconds: number }) {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toString().padStart(2, "0");
  return (
    <span className={`flex items-center gap-1 text-xs font-bold ${seconds === 0 ? "text-rose-500" : "text-gray-500"}`} aria-live="off">
      <TimerReset className="h-3.5 w-3.5" />
      {seconds === 0 ? "کد منقضی شد" : toFaDigits(`${m}:${s}`)}
    </span>
  );
}
