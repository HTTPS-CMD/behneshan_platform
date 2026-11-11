"""
خروجی اکسل تراکنش‌ها و ورود گروهی تراکنش از فایل اکسل.
نیاز به پکیج openpyxl دارد:  pip install openpyxl
"""
import datetime
import io

from django.utils import timezone

from .jalali import FA_DIGITS, jalali_to_date, to_jalali_str
from .models import Purchase

IMPORT_HEADERS = ['موبایل', 'نام مشتری', 'مبلغ (تومان)', 'شعبه', 'بخش', 'روش پرداخت', 'تاریخ (شمسی)', 'توضیحات']
MAX_IMPORT_ROWS = 2000

PAYMENT_ALIASES = {
    'نقد': 'CASH', 'نقدی': 'CASH', 'cash': 'CASH',
    'کارتخوان': 'POS', 'کارت‌خوان': 'POS', 'کارت خوان': 'POS', 'pos': 'POS',
    'کارت به کارت': 'CARD', 'کارت‌به‌کارت': 'CARD', 'card': 'CARD',
    'آنلاین': 'ONLINE', 'online': 'ONLINE',
    'سایر': 'OTHER', 'other': 'OTHER',
}


def _require_openpyxl():
    try:
        import openpyxl  # noqa: F401
        return openpyxl
    except ImportError as exc:
        raise RuntimeError("پکیج openpyxl نصب نیست. در بک‌اند اجرا کنید: pip install openpyxl") from exc


def _style_header(ws, row=1):
    from openpyxl.styles import Alignment, Font, PatternFill
    for cell in ws[row]:
        cell.font = Font(bold=True, color='FFFFFF')
        cell.fill = PatternFill('solid', fgColor='153A5F')
        cell.alignment = Alignment(horizontal='center', vertical='center')


def export_purchases(queryset):
    openpyxl = _require_openpyxl()
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'تراکنش‌ها'
    ws.sheet_view.rightToLeft = True
    headers = ['ردیف', 'تاریخ', 'ساعت', 'نام مشتری', 'موبایل', 'شماره اشتراک', 'شعبه', 'بخش', 'روش پرداخت',
               'مبلغ فاکتور', 'تخفیف', 'منبع تخفیف', 'اعتبار مصرف‌شده', 'مبلغ پرداختی', 'کش‌بک', 'تأیید با کد', 'توضیحات']
    ws.append(headers)
    _style_header(ws)
    for i, p in enumerate(queryset.select_related('customer', 'branch', 'line').iterator(chunk_size=500), start=1):
        local = timezone.localtime(p.purchased_at)
        ws.append([
            i, to_jalali_str(p.purchased_at), local.strftime('%H:%M'), p.customer.full_name, p.customer.phone_number,
            p.customer.membership_no, p.branch.name if p.branch else '', p.line.name if p.line else '',
            p.get_payment_method_display(), p.original_amount, p.discount_amount, p.get_discount_source_display(),
            p.credit_used, p.final_amount, p.cashback_amount, 'بله' if p.verified else 'خیر', p.note,
        ])
    widths = [6, 12, 8, 22, 14, 12, 16, 16, 14, 14, 12, 14, 14, 14, 12, 10, 30]
    for idx, w in enumerate(widths, start=1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(idx)].width = w
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def import_template():
    openpyxl = _require_openpyxl()
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'تراکنش‌ها'
    ws.sheet_view.rightToLeft = True
    ws.append(IMPORT_HEADERS)
    _style_header(ws)
    ws.append(['09121234567', 'علی محمدی', 250000, '', '', 'نقدی', to_jalali_str(timezone.localdate()), 'نمونه - این ردیف را پاک کنید'])
    for idx, w in enumerate([14, 22, 14, 16, 16, 14, 14, 30], start=1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(idx)].width = w
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _cell_str(v):
    if v is None:
        return ''
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v).strip()


def parse_import(file_obj, business):
    """
    فایل را می‌خواند و اعتبارسنجی می‌کند. خروجی: (rows, errors)
    هر row: dict آماده برای record_purchase. اگر errors خالی نباشد هیچ ردیفی ثبت نمی‌شود.
    """
    from apps.directory.crm import normalize_phone

    from .models import Branch, SalesLine

    openpyxl = _require_openpyxl()
    try:
        wb = openpyxl.load_workbook(file_obj, read_only=True, data_only=True)
    except Exception:
        return [], [{"row": 0, "error": "فایل اکسل قابل خواندن نیست. فقط فایل xlsx پذیرفته می‌شود."}]
    ws = wb.active

    branches = {b.name.strip(): b for b in Branch.objects.filter(business=business, is_active=True)}
    lines = {}
    for line in SalesLine.objects.filter(branch__business=business, branch__is_active=True, is_active=True).select_related('branch'):
        lines[(line.branch.name.strip(), line.name.strip())] = line

    rows, errors = [], []
    today = timezone.localdate()
    for idx, raw in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        values = [_cell_str(v) for v in (list(raw) + [None] * 8)[:8]]
        if not any(values):
            continue
        if len(rows) + len(errors) >= MAX_IMPORT_ROWS:
            errors.append({"row": idx, "error": f"حداکثر {MAX_IMPORT_ROWS} ردیف در هر فایل مجاز است."})
            break
        phone_raw, name, amount_raw, branch_name, line_name, pay_raw, date_raw, note = values
        row_errors = []

        phone_raw = phone_raw.translate(FA_DIGITS).replace(' ', '').replace('-', '')
        if phone_raw.startswith('+98'):
            phone_raw = '0' + phone_raw[3:]
        elif phone_raw.startswith('98') and len(phone_raw) == 12:
            phone_raw = '0' + phone_raw[2:]
        elif phone_raw.startswith('9') and len(phone_raw) == 10:
            phone_raw = '0' + phone_raw  # اکسل صفر اول را حذف می‌کند
        phone = normalize_phone(phone_raw)
        if not phone:
            row_errors.append("موبایل نامعتبر")

        try:
            amount = int(float(amount_raw.translate(FA_DIGITS).replace(',', '').replace('٬', '')))
            if amount <= 0:
                raise ValueError
        except (ValueError, AttributeError):
            amount = 0
            row_errors.append("مبلغ نامعتبر")

        branch = line = None
        if branch_name:
            branch = branches.get(branch_name)
            if not branch:
                row_errors.append(f"شعبه‌ی «{branch_name}» پیدا نشد")
        if line_name:
            if not branch:
                row_errors.append("برای بخش، نام شعبه هم لازم است")
            else:
                line = lines.get((branch_name, line_name))
                if not line:
                    row_errors.append(f"بخش «{line_name}» در این شعبه پیدا نشد")

        payment = Purchase.PaymentMethod.CASH
        if pay_raw:
            payment = PAYMENT_ALIASES.get(pay_raw.lower().replace('ي', 'ی'), pay_raw.upper())
            if payment not in Purchase.PaymentMethod.values:
                row_errors.append("روش پرداخت نامعتبر")

        purchased_at = None
        if date_raw:
            d = jalali_to_date(date_raw)
            if not d:
                try:
                    d = datetime.date.fromisoformat(date_raw[:10])
                except ValueError:
                    d = None
            if not d:
                row_errors.append("تاریخ نامعتبر (مثال: 1403/05/12)")
            elif d > today:
                row_errors.append("تاریخ نمی‌تواند در آینده باشد")
            else:
                purchased_at = timezone.make_aware(datetime.datetime.combine(d, datetime.time(12, 0)))

        if row_errors:
            errors.append({"row": idx, "error": "، ".join(row_errors)})
        else:
            rows.append({
                "row": idx, "phone": phone, "name": name, "amount": amount, "branch": branch, "line": line,
                "payment_method": payment, "purchased_at": purchased_at, "note": note,
            })
    wb.close()
    if not rows and not errors:
        errors.append({"row": 0, "error": "فایل هیچ ردیفی ندارد."})
    return rows, errors
