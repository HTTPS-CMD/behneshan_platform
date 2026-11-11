def get_owner_business(user):
    """
    کسب‌وکار اصلیِ صاحب حساب (قدیمی‌ترین کسب‌وکار ثبت‌شده).
    قبلاً در ۱۱ جای کد `user.businesses.first()` تکرار شده بود که چون شناسه‌ها UUID هستند،
    ترتیب ثابتی نداشت و ممکن بود هر بار یک کسب‌وکار متفاوت برگرداند.
    """
    if not user or not user.is_authenticated:
        return None
    return user.businesses.order_by('created_at').first()
