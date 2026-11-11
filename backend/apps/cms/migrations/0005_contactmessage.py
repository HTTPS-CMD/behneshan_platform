# صندوق پیام‌های فرم «تماس با ما» (جدول جدید؛ به داده‌ی موجود دست نمی‌زند)
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cms', '0004_landingpage'),
    ]

    operations = [
        migrations.CreateModel(
            name='ContactMessage',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=120, verbose_name='نام و نام خانوادگی')),
                ('phone', models.CharField(max_length=11, verbose_name='شماره موبایل')),
                ('role', models.CharField(blank=True, choices=[('merchant', 'کاسب'), ('customer', 'مشتری'), ('org', 'سازمان'), ('other', 'سایر')], default='', max_length=20, verbose_name='نقش')),
                ('subject', models.CharField(choices=[('merchant_signup', 'ثبت\u200cنام کاسبان'), ('card', 'خرید و ارتقای کارت'), ('ads', 'تبلیغات و مشاوره'), ('cooperation', 'همکاری'), ('feedback', 'پیشنهاد و انتقاد'), ('other', 'سایر')], default='other', max_length=30, verbose_name='موضوع پیام')),
                ('message', models.TextField(verbose_name='متن پیام')),
                ('is_read', models.BooleanField(default=False, verbose_name='خوانده شده؟')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='زمان ثبت')),
            ],
            options={
                'verbose_name': 'پیام تماس',
                'verbose_name_plural': 'پیام\u200cهای تماس',
                'db_table': 'cms_contact_messages',
                'ordering': ['-created_at'],
            },
        ),
    ]
