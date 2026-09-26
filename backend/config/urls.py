from django.contrib import admin
from django.urls import include, path

admin.site.site_header = "Cardio Sense administration"
admin.site.site_title = "Cardio Sense admin"
admin.site.index_title = "Profiles and risk assessments"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("predictor.urls")),
]
