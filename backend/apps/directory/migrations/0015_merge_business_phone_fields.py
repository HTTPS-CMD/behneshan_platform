# ادغام دو فیلد تلفن کسب‌وکار: phone_number (تکراری) در public_phone + اصلاح نام برند
from django.db import migrations, models
from django.db.models import Q


def copy_phone_to_public(apps, schema_editor):
    Business = apps.get_model('directory', 'Business')
    qs = Business.objects.filter(Q(public_phone__isnull=True) | Q(public_phone=''))
    qs = qs.exclude(phone_number__isnull=True).exclude(phone_number='')
    for biz in qs.only('id', 'phone_number'):
        biz.public_phone = biz.phone_number
        biz.save(update_fields=['public_phone'])


class Migration(migrations.Migration):

    dependencies = [
        ('directory', '0014_alter_discountcampaign_discount_percent_and_more'),
    ]

    operations = [
        migrations.RunPython(copy_phone_to_public, migrations.RunPython.noop),
        migrations.RemoveField(model_name='business', name='phone_number'),
        # یکسان‌سازی نام برند در برچسب نوع درخواست (چارسوق ← چهارسوق)
        migrations.AlterField(
            model_name='businessrequest',
            name='request_type',
            field=models.CharField(
                choices=[('LADDER', 'درخواست نردبان'), ('SMS', 'تبلیغات پیامکی'), ('FEATURED', 'معرفی ویژه روز در چهارسوق')],
                max_length=20, verbose_name='نوع درخواست',
            ),
        ),
    ]
