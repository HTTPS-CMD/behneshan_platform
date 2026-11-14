from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('loyalty', '0004_sharesettings_alter_smsledger_options_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='purchase',
            name='client_ref',
            field=models.UUIDField(blank=True, help_text='برای جلوگیری از ثبت دوباره‌ی یک تراکنش وقتی دستگاه درخواست را تکرار می‌کند', null=True, verbose_name='شناسه‌ی یکتای درخواست دستگاه'),
        ),
        migrations.AddField(
            model_name='purchase',
            name='pos_reference',
            field=models.CharField(blank=True, max_length=64, verbose_name='کد پیگیری کارت‌خوان'),
        ),
        migrations.AlterField(
            model_name='purchase',
            name='source',
            field=models.CharField(choices=[('PANEL', 'پنل فروشنده'), ('IMPORT', 'ورود از اکسل'), ('LEGACY', 'پذیرش مشتری (قدیمی)'), ('POS', 'کارت‌خوان')], default='PANEL', max_length=10),
        ),
        migrations.AddConstraint(
            model_name='purchase',
            constraint=models.UniqueConstraint(condition=models.Q(('client_ref__isnull', False)), fields=('business', 'client_ref'), name='uniq_purchase_client_ref'),
        ),
    ]
