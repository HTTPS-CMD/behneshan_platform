"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

/**
 * پارامترهای آدرس صفحه‌ی اصلی (‎?search=…&category=…&location=…‎) را به صفحه می‌دهد.
 * منوی پایین موبایل (دسته‌بندی‌ها و جستجو) با همین پارامترها نتیجه را باز می‌کند.
 * بار اول فقط وقتی پارامتر داشته باشد اجرا می‌شود؛ بعد از آن با هر تغییر آدرس.
 */
export default function SearchParamsSync({ onChange }: { onChange: (params: URLSearchParams) => void }) {
  const params = useSearchParams();
  const key = params.toString();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      if (!key) return;
    }
    onChange(new URLSearchParams(key));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return null;
}
