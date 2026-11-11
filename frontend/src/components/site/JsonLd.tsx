/** داده‌ی ساخت‌یافته‌ی schema.org برای موتورهای جستجو (JSON-LD) */
export default function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // «<» انکود می‌شود تا متن کاربر نتواند تگ script را ببندد
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
