import csv
import json

from django.contrib import admin
from django.http import HttpResponse
from django.utils.html import format_html

from .models import Assessment, ConnectionEvent, Profile, SocialAccount


def cell(value):
    """A CSV cell that spreadsheets show as text. Values starting with = + - @ (or a
    tab/CR) would otherwise run as formulas, and names and notes are user input."""
    text = "" if value is None else str(value)
    return "'" + text if text[:1] in ("=", "+", "-", "@", "\t", "\r") else text


def csv_row(writer, values):
    writer.writerow([cell(v) for v in values])


def pretty_json(value):
    return format_html("<pre style='margin:0;white-space:pre-wrap'>{}</pre>",
                       json.dumps(value, indent=2, ensure_ascii=False))


class ConnectionEventInline(admin.TabularInline):
    model = ConnectionEvent
    extra = 0
    can_delete = False
    fields = ["created_at", "provider", "action", "handle", "detail"]
    readonly_fields = fields
    verbose_name_plural = "Linked-account history"

    def has_add_permission(self, request, obj=None):
        return False


class AssessmentInline(admin.TabularInline):
    model = Assessment
    extra = 0
    can_delete = False
    show_change_link = True
    fields = ["created_at", "risk_level", "probability", "model_name"]
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ["full_name", "user", "email", "phone", "sex", "date_of_birth", "assessment_count", "updated_at"]
    list_filter = ["sex", "blood_group", "hypertension", "diabetes", "smoker", "deleted_at"]
    search_fields = ["full_name", "email", "phone"]
    readonly_fields = ["photo_preview", "created_at", "updated_at", "deleted_at"]
    inlines = [AssessmentInline, ConnectionEventInline]
    fieldsets = [
        (None, {"fields": ["user", "full_name", "photo_preview", "photo", "email", "phone"]}),
        ("Body", {"fields": ["date_of_birth", "sex", "height_cm", "weight_kg", "blood_group"]}),
        ("Location", {"fields": ["city", "state", "country", "country_code", "timezone", "latitude", "longitude"]}),
        ("History and lifestyle", {"fields": [
            "hypertension", "diabetes", "family_history", "chest_pain_history", "smoker", "activity",
            "medications", "allergies"]}),
        ("Emergency contact", {"fields": ["emergency_name", "emergency_phone"]}),
        ("Linked accounts", {"fields": ["connections"], "classes": ["collapse"]}),
        ("Record", {"fields": ["created_at", "updated_at", "deleted_at"]}),
    ]

    @admin.display(description="Assessments")
    def assessment_count(self, obj):
        return obj.assessments.count()

    @admin.display(description="Photo preview")
    def photo_preview(self, obj):
        if obj.photo.startswith("data:image/jpeg;base64,"):
            return format_html('<img src="{}" width="96" height="96" style="border-radius:50%">', obj.photo)
        return "—"


@admin.register(Assessment)
class AssessmentAdmin(admin.ModelAdmin):
    list_display = ["reference", "created_at", "user", "profile", "age", "sex", "probability_pct", "risk_level", "model_name"]
    list_filter = ["risk_level", "low_confidence", "sex", "model_name", "created_at"]
    search_fields = ["id", "user__email", "profile__full_name", "notes"]
    date_hierarchy = "created_at"
    list_select_related = ["profile"]
    actions = ["export_csv"]
    # What the model saw and said is an audit trail: staff can relink or annotate, not rewrite it.
    readonly_fields = [
        "reference", "created_at", "age", "sex", "probability_pct", "risk_level",
        "inputs_display", "factors_display", "missing_fields", "outside_training", "low_confidence", "model_name", "model_trained_at",
    ]
    fieldsets = [
        (None, {"fields": ["reference", "created_at", "profile", "notes"]}),
        ("Result", {"fields": ["probability_pct", "risk_level", "factors_display", "missing_fields", "outside_training", "low_confidence"]}),
        ("Request", {"fields": ["age", "sex", "inputs_display"]}),
        ("Model", {"fields": ["model_name", "model_trained_at"]}),
    ]

    def has_add_permission(self, request):
        return False  # assessments only come from POST /api/predict/

    @admin.display(description="Reference", ordering="id")
    def reference(self, obj):
        return obj.reference

    @admin.display(description="Probability", ordering="probability")
    def probability_pct(self, obj):
        return f"{obj.probability:.1%}"

    @admin.display(description="Inputs")
    def inputs_display(self, obj):
        return pretty_json(obj.inputs)

    @admin.display(description="Top factors")
    def factors_display(self, obj):
        return pretty_json(obj.top_factors)

    @admin.action(description="Export selected assessments to CSV")
    def export_csv(self, request, queryset):
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="assessments.csv"'
        writer = csv.writer(response)
        writer.writerow(["reference", "created_at", "profile", "age", "sex", "probability",
                         "risk_level", "model_name", "model_trained_at", "inputs", "top_factors", "notes"])
        for a in queryset.select_related("profile"):
            csv_row(writer, [a.reference, a.created_at.isoformat(), a.profile or "", a.age, a.sex,
                             a.probability, a.risk_level, a.model_name, a.model_trained_at,
                             json.dumps(a.inputs), json.dumps(a.top_factors), a.notes])
        return response


@admin.register(ConnectionEvent)
class ConnectionEventAdmin(admin.ModelAdmin):
    """Linked-account audit log: who linked or unlinked what, and why attempts failed."""

    list_display = ["created_at", "provider", "action", "handle", "profile", "detail"]
    list_filter = ["action", "provider", "created_at"]
    search_fields = ["handle", "detail", "profile__full_name"]
    date_hierarchy = "created_at"
    list_select_related = ["profile"]
    actions = ["export_csv"]

    # An audit trail: written only by the app, never edited by hand.
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser

    @admin.action(description="Export selected events to CSV")
    def export_csv(self, request, queryset):
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="connection-events.csv"'
        writer = csv.writer(response)
        writer.writerow(["created_at", "provider", "action", "handle", "profile", "detail"])
        for e in queryset.select_related("profile"):
            csv_row(writer, [e.created_at.isoformat(), e.provider, e.action, e.handle, e.profile or "", e.detail])
        return response


@admin.register(SocialAccount)
class SocialAccountAdmin(admin.ModelAdmin):
    """Google / X identities that sign in to an account. Created only by the sign-in flow."""

    list_display = ["user", "provider", "handle", "created_at", "last_login_at"]
    list_filter = ["provider", "created_at"]
    search_fields = ["user__email", "user__username", "handle", "uid"]
    readonly_fields = ["user", "provider", "uid", "handle", "created_at", "last_login_at"]

    def has_add_permission(self, request):
        return False
