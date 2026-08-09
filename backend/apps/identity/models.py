import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.utils.translation import gettext_lazy as _

class UserManager(BaseUserManager):
    def create_user(self, phone_number, password=None, **extra_fields):
        if not phone_number:
            raise ValueError('شماره موبایل الزامی است')
        
        user = self.model(phone_number=phone_number, **extra_fields)
        
        # اگر پسورد داده شده بود (مثل زمان ساخت ادمین) آن را هش و ذخیره کن
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password() # برای کاربران عادی که با OTP لاگین می‌کنند
            
        user.save(using=self._db)
        return user

    def create_superuser(self, phone_number, password=None, **extra_fields):
        # به ادمین مجوزهای دسترسی کامل را می‌دهیم
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        
        # ---> این خط باید اضافه شود <---
        extra_fields.setdefault('role', self.model.RoleChoices.ADMIN)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(phone_number, password, **extra_fields)


    
class User(AbstractBaseUser, PermissionsMixin):
    class RoleChoices(models.TextChoices):
        ADMIN = 'ADMIN', 'مدیر'
        BUSINESS_OWNER = 'BUSINESS_OWNER', 'صاحب کسب‌وکار'
        CLIENT = 'CLIENT', 'مشتری'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    phone_number = models.CharField(max_length=11, unique=True)
    
    # فیلدهای جدید اضافه شده برای شاهکار و هویت
    full_name = models.CharField(max_length=255, null=True, blank=True, verbose_name="نام و نام خانوادگی")
    national_id = models.CharField(max_length=10, unique=True, null=True, blank=True, verbose_name="کد ملی")
    is_shahkar_verified = models.BooleanField(default=False, verbose_name="تاییدیه شاهکار")

    role = models.CharField(
        max_length=20,
        choices=RoleChoices.choices,
        default=RoleChoices.CLIENT,
    )
    
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = 'phone_number'

    def __str__(self):
        return f"{self.full_name or 'کاربر'} ({self.phone_number})"