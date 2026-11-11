# جدول محتوای صفحه‌ی لندینگ (قابل ویرایش از پنل ادمین)
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cms', '0003_remove_sitesetting_hero_align_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='LandingPage',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('content', models.JSONField(blank=True, default=dict, verbose_name='محتوا')),
                ('hero_image', models.ImageField(blank=True, null=True, upload_to='cms/landing/', verbose_name='تصویر پس‌زمینه‌ی هیرو')),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'صفحه‌ی لندینگ',
                'verbose_name_plural': 'صفحه‌ی لندینگ',
                'db_table': 'cms_landing_page',
            },
        ),
    ]
