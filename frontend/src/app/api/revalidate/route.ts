import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { secret, path, tag } = body;

    // رمز عبور برای جلوگیری از پاک شدن کش توسط هکرها
    if (secret !== process.env.REVALIDATION_SECRET) {
      return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: 401 });
    }

    // پاک کردن کش یک مسیر خاص (مثلاً /daily-discounts)
    if (path) {
      revalidatePath(path);
      return NextResponse.json({ revalidated: true, type: 'path', path, now: Date.now() });
    }

    // پاک کردن کش با تگ خاص
    if (tag) {
      // در Next.js 16 آرگومان دوم (پروفایل کش) الزامی است
      revalidateTag(tag, 'max');
      return NextResponse.json({ revalidated: true, type: 'tag', tag, now: Date.now() });
    }

    // اگر مسیر یا تگ مشخص نشد، کش کل سایت را پاک کن
    revalidatePath('/', 'layout');
    return NextResponse.json({ revalidated: true, type: 'all', now: Date.now() });

  } catch (err) {
    return NextResponse.json({ message: 'خطا در پاکسازی کش' }, { status: 500 });
  }
}