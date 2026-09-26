from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from rest_framework import serializers

from .models import Profile

PHOTO_PREFIX = "data:image/jpeg;base64,"
MAX_PHOTO_CHARS = 300_000  # the frontend stores ~20-40 KB; this leaves plenty of room
MAX_LIST_ITEMS = 50

# The frontend sends '' for an empty date or number and expects '' back.
BLANK_AS_NULL = ("date_of_birth", "height_cm", "weight_kg", "latitude", "longitude")
LOCATION = ("city", "state", "country", "country_code", "timezone", "latitude", "longitude")


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        exclude = ["id", "user"]
        read_only_fields = ["created_at", "updated_at"]
        extra_kwargs = {
            "height_cm": {"min_value": 50, "max_value": 250},
            "weight_kg": {"min_value": 2, "max_value": 400},
            "latitude": {"min_value": -90, "max_value": 90},
            "longitude": {"min_value": -180, "max_value": 180},
        }

    def to_internal_value(self, data):
        if isinstance(data, dict):
            data = {k: (None if k in BLANK_AS_NULL and v == "" else v) for k, v in data.items()}
        return super().to_internal_value(data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        for key in BLANK_AS_NULL:
            if data[key] is None:
                data[key] = ""
        return data

    def validate_full_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Enter your name.")
        return value

    def validate_timezone(self, value):
        if value:
            try:
                ZoneInfo(value)
            except (ZoneInfoNotFoundError, ValueError):
                raise serializers.ValidationError("Not a known time zone.") from None
        return value

    def validate_country_code(self, value):
        if value and not (len(value) == 2 and value.isalpha()):
            raise serializers.ValidationError("Use a two-letter country code.")
        return value.upper()

    def validate(self, attrs):
        # A location needs at least a country with its time zone and coordinates
        # (a city is optional): otherwise it couldn't drive the date or the weather.
        given = [k for k in LOCATION if attrs.get(k) not in ("", None)]
        needed = {"country", "country_code", "timezone", "latitude", "longitude"}
        if given and not needed <= set(given):
            raise serializers.ValidationError({"country": "Pick your country from the list."})
        return attrs

    def validate_photo(self, value):
        if value and (not value.startswith(PHOTO_PREFIX) or len(value) > MAX_PHOTO_CHARS):
            raise serializers.ValidationError("The photo must be a small JPEG data URL.")
        return value

    def _string_list(self, value):
        if not isinstance(value, list) or len(value) > MAX_LIST_ITEMS or not all(
            isinstance(item, str) and len(item) <= 120 for item in value
        ):
            raise serializers.ValidationError(f"Use a list of up to {MAX_LIST_ITEMS} short text items.")
        return [item.strip() for item in value if item.strip()]

    def validate_medications(self, value):
        return self._string_list(value)

    def validate_allergies(self, value):
        return self._string_list(value)

    def validate_connections(self, value):
        if not isinstance(value, dict) or len(value) > 20:
            raise serializers.ValidationError("Connections must be an object keyed by provider.")
        return value
