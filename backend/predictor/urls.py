from django.urls import path

from . import accounts, connections, views

urlpatterns = [
    path("auth/me/", accounts.MeView.as_view(), name="auth-me"),
    path("auth/register/", accounts.RegisterView.as_view(), name="auth-register"),
    path("auth/login/", accounts.LoginView.as_view(), name="auth-login"),
    path("auth/logout/", accounts.LogoutView.as_view(), name="auth-logout"),
    path("connect/", connections.providers, name="connect-providers"),
    path("connect/<str:provider>/start/", connections.start, name="connect-start"),
    path("connect/<str:provider>/callback/", connections.callback, name="connect-callback"),
    path("predict/", views.PredictView.as_view(), name="predict"),
    path("history/", views.HistoryView.as_view(), name="history"),
    path("history/<str:ref>/", views.HistoryRecordView.as_view(), name="history-record"),
    path("profile/", views.ProfileView.as_view(), name="profile"),
]
