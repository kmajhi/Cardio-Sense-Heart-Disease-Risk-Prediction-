"""HTTP layer only: ML logic lives in predictor/services/.

Errors come back as { "detail": "..." }, which the frontend's api/client.js shows.
"""

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .connections import record
from .models import Assessment, Profile
from .serializers import ProfileSerializer
from .services import prediction_service
from .services.prediction_service import PredictionInputError

# What an assessment keeps from the request body; anything else is dropped.
PAYLOAD_KEYS = (
    set(prediction_service.FIELD_MAP)
    | {"sex", "bmi", "max_hr", "troponin_i", "troponin_assay", "troponin_qualifier"}
)


def current_profile(user):
    """The signed-in user's profile, or None if they haven't made one."""
    return Profile.objects.filter(user=user).first()


def first_error(errors):
    """DRF's { field: [messages] } → 'field: message' for the { detail } contract."""
    field, messages = next(iter(errors.items()))
    message = messages[0] if isinstance(messages, list) else messages
    return message if field == "non_field_errors" else f"{field}: {message}"


class PredictView(APIView):
    """POST /api/predict/ → { probability, risk_level, top_factors }, saved as an Assessment."""

    def post(self, request):
        if not isinstance(request.data, dict):
            return Response({"detail": "Send the patient's values as a JSON object."}, status=400)
        payload = {k: v for k, v in request.data.items() if k in PAYLOAD_KEYS}

        try:
            result = prediction_service.predict(payload)
        except PredictionInputError as err:
            return Response({"detail": str(err)}, status=400)
        except FileNotFoundError:
            return Response({"detail": "The prediction model isn't available on the server."}, status=503)

        _, metadata = prediction_service.load_model()
        age = payload.get("age")
        Assessment.objects.create(
            user=request.user,
            profile=current_profile(request.user),
            inputs=payload,
            age=int(float(age)) if age not in (None, "") else None,
            sex=payload.get("sex", ""),
            probability=result["probability"],
            risk_level=result["risk_level"],
            top_factors=result["top_factors"],
            model_name=metadata.get("selected_model", ""),
            model_trained_at=metadata.get("trained_at", ""),
        )
        return Response(result)


class HistoryView(APIView):
    """GET /api/history/ → the signed-in user's [{ id, created_at, inputs, result }], oldest first."""

    def get(self, request):
        return Response([a.as_record() for a in Assessment.objects.filter(user=request.user)])


class HistoryRecordView(APIView):
    """DELETE /api/history/<A-0012 or 12>/ (only the signed-in user's own)."""

    def delete(self, request, ref):
        pk = ref.upper().removeprefix("A-")
        deleted, _ = Assessment.objects.filter(pk=int(pk), user=request.user).delete() if pk.isascii() and pk.isdigit() else (0, None)
        if not deleted:
            return Response({"detail": "No such assessment."}, status=404)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProfileView(APIView):
    """GET → profile | 404, PUT → create or replace, DELETE → 204."""

    def get(self, request):
        profile = current_profile(request.user)
        if profile is None:
            return Response({"detail": "No profile yet."}, status=404)
        return Response(ProfileSerializer(profile).data)

    def put(self, request):
        profile = current_profile(request.user)
        serializer = ProfileSerializer(profile, data=request.data)
        if not serializer.is_valid():
            return Response({"detail": first_error(serializer.errors)}, status=400)

        # Links are only ever added by the OAuth flow (connections.py). A save can
        # keep or drop them, but not add one or change what it says. Leaving the
        # field out keeps them all.
        before = (profile.connections or {}) if profile else {}
        sent = serializer.validated_data["connections"] if "connections" in request.data else before
        kept = {provider: before[provider] for provider in sent if provider in before}
        saved = serializer.save(user=request.user, connections=kept)

        for provider in before.keys() - kept.keys():
            record(provider, "disconnected", profile=saved, handle=before[provider].get("handle", ""))
        return Response(serializer.data)

    def delete(self, request):
        profile = current_profile(request.user)
        if profile is not None:
            for provider, link in (profile.connections or {}).items():
                record(provider, "disconnected", profile=profile, handle=link.get("handle", ""),
                       detail="Profile deleted")
            profile.delete()  # its assessments and audit rows stay, unlinked (SET_NULL)
        return Response(status=status.HTTP_204_NO_CONTENT)
