# جدول جدید؛ به داده‌ی موجود دست نمی‌زند
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='SeoPage',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('page_type', models.CharField(choices=[('static', 'صفحه‌ی ثابت'), ('business', 'کسب‌وکار'), ('category', 'دسته'), ('location', 'محله')], max_length=20, verbose_name='نوع صفحه')),
                ('page_key', models.CharField(max_length=255, verbose_name='کلید صفحه (مسیر یا اسلاگ)')),
                ('title', models.CharField(blank=True, default='', max_length=255, verbose_name='عنوان سئو')),
                ('description', models.CharField(blank=True, default='', max_length=500, verbose_name='توضیح متا')),
                ('focus_keyword', models.CharField(blank=True, default='', max_length=120, verbose_name='کلمه‌ی کلیدی اصلی')),
                ('canonical', models.CharField(blank=True, default='', max_length=500, verbose_name='آدرس کانونیکال')),
                ('og_image', models.CharField(blank=True, default='', max_length=500, verbose_name='تصویر اشتراک‌گذاری')),
                ('noindex', models.BooleanField(default=False, verbose_name='عدم نمایش در گوگل (noindex)')),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'تنظیمات سئوی صفحه',
                'verbose_name_plural': 'تنظیمات سئوی صفحه‌ها',
                'db_table': 'seo_pages',
                'unique_together': {('page_type', 'page_key')},
            },
        ),
    ]
