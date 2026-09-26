from django.urls import path

from . import connections, views

urlpatterns = [
    path("connect/", connections.providers, name="connect-providers"),
    path("connect/<str:provider>/start/", connections.start, name="connect-start"),
    path("connect/<str:provider>/callback/", connections.callback, name="connect-callback"),
    path("predict/", views.PredictView.as_view(), name="predict"),
    path("history/", views.HistoryView.as_view(), name="history"),
    path("history/<str:ref>/", views.HistoryRecordView.as_view(), name="history-record"),
    path("profile/", views.ProfileView.as_view(), name="profile"),
]
