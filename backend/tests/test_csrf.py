"""CSRF refusals: JSON with the refused origin for the app, the usual page elsewhere."""

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db
LOGIN = {"email": "nobody@example.com", "password": "Wrong-Pass-123"}


def csrf_client():
    api = APIClient(enforce_csrf_checks=True)
    api.get(reverse("auth-me"))  # sets the csrftoken cookie, as the app does on load
    return api, api.cookies["csrftoken"].value


def test_the_trusted_site_gets_through(settings):
    api, token = csrf_client()
    res = api.post(reverse("auth-login"), LOGIN, format="json", HTTP_X_CSRFTOKEN=token,
                   HTTP_ORIGIN=settings.FRONTEND_URL, HTTP_REFERER=settings.FRONTEND_URL + "/")
    assert res.status_code == 400  # past CSRF, refused only for the wrong password


def test_an_untrusted_site_gets_a_json_reason_naming_it(settings):
    api, token = csrf_client()
    res = api.post(reverse("auth-login"), LOGIN, format="json", HTTP_X_CSRFTOKEN=token,
                   HTTP_ORIGIN="https://elsewhere.example", HTTP_REFERER="https://elsewhere.example/")
    assert res.status_code == 403
    body = res.json()
    assert body["code"] == "csrf_failed"
    assert "https://elsewhere.example" in body["detail"] and "FRONTEND_URL" in body["detail"]


def test_a_missing_token_says_to_refresh(settings):
    api, _ = csrf_client()
    res = api.post(reverse("auth-login"), LOGIN, format="json", HTTP_ORIGIN=settings.FRONTEND_URL)
    assert res.status_code == 403 and "Refresh the page" in res.json()["detail"]
