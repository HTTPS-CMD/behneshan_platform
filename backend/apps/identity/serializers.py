from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()

class ClientProfileSerializer(serializers.ModelSerializer):
    level_display = serializers.CharField(source='get_level_display', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'phone_number', 'full_name', 'wallet_balance', 
            'purchase_profit', 'level', 'level_display', 'referral_profit'
        ]
        read_only_fields = ['wallet_balance', 'purchase_profit', 'level', 'referral_profit']