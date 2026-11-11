import { toFaDigits } from "@/lib/format";
import {
  Bell,
  Info,
  Megaphone,
  MessageSquareReply,
  PartyPopper,
  Receipt,
  Rocket,
  Star,
  Store,
  Ticket,
  UserPlus,
  Heart,
  type LucideIcon,
} from "lucide-react";

export interface AppNotification {
  id: number;
  category: string;
  category_display: string;
  title: string;
  message: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

export interface UnreadCountResponse {
  unread: number;
  latest: AppNotification | null;
}

// آیکون و رنگ هر نوع اعلان
export const CATEGORY_STYLE: Record<string, { icon: LucideIcon; className: string }> = {
  WELCOME: { icon: PartyPopper, className: "bg-amber-50 text-amber-600" },
  REVIEW: { icon: Star, className: "bg-yellow-50 text-yellow-600" },
  REPLY: { icon: MessageSquareReply, className: "bg-sky-50 text-sky-600" },
  FOLLOW: { icon: Heart, className: "bg-rose-50 text-rose-500" },
  CAMPAIGN: { icon: Ticket, className: "bg-orange-50 text-orange-600" },
  TRANSACTION: { icon: Receipt, className: "bg-emerald-50 text-emerald-600" },
  BUSINESS: { icon: Store, className: "bg-teal-50 text-teal-600" },
  REQUEST: { icon: Rocket, className: "bg-purple-50 text-purple-600" },
  USER: { icon: UserPlus, className: "bg-indigo-50 text-indigo-600" },
  BROADCAST: { icon: Megaphone, className: "bg-fuchsia-50 text-fuchsia-600" },
  SYSTEM: { icon: Info, className: "bg-slate-100 text-slate-600" },
};

export const getCategoryStyle = (category: string) => CATEGORY_STYLE[category] ?? { icon: Bell, className: "bg-slate-100 text-slate-600" };

export { toFaDigits };

// «۵ دقیقه پیش»، «دیروز» و ...
export function timeAgo(iso: string): string {
  const diff = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "همین الان";
  const minutes = Math.floor(diff / 60);
  if (minutes < 60) return `${toFaDigits(minutes)} دقیقه پیش`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${toFaDigits(hours)} ساعت پیش`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "دیروز";
  if (days < 7) return `${toFaDigits(days)} روز پیش`;
  return new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "long", day: "numeric" }).format(new Date(iso));
}

// فقط مسیرهای داخلی سایت باز می‌شوند
export const isSafeLink = (link?: string) => !!link && link.startsWith("/") && !link.startsWith("//");

// ---- تنظیم صدا (برای هر کاربر در مرورگر خودش) ----
const SOUND_KEY = "notif_sound_enabled";

export function isSoundEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, enabled ? "1" : "0");
  } catch {
    /* مرورگر اجازه‌ی ذخیره نداد — مهم نیست */
  }
}

// صدای کوتاه «دینگ» بدون نیاز به فایل صوتی + لرزش در موبایل
let audioCtx: AudioContext | null = null;

export function playNotificationSound() {
  try {
    if (typeof window === "undefined") return;
    navigator.vibrate?.(80);
    if (!isSoundEnabled()) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx ?? new Ctx();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const now = audioCtx.currentTime;
    [880, 1318.5].forEach((freq, i) => {
      const osc = audioCtx!.createOscillator();
      const gain = audioCtx!.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.12;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
      osc.connect(gain).connect(audioCtx!.destination);
      osc.start(start);
      osc.stop(start + 0.4);
    });
  } catch {
    /* اگر مرورگر اجازه‌ی پخش صدا نداد، بی‌صدا ادامه می‌دهیم */
  }
}

// مسیر صفحه‌ی کامل اعلان‌ها بر اساس نقش
export const notificationsPageFor = (role: string | null) =>
  role === "ADMIN" ? "/admin-panel/notifications" : "/dashboard/notifications";
