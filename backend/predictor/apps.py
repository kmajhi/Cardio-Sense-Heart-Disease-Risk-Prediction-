import logging
import os
import sys
import threading

from django.apps import AppConfig

log = logging.getLogger(__name__)

# A typical adult (the training medians), used only to warm the model up.
WARMUP_PATIENT = {
    "age": 45, "sex": "M", "height_cm": 159, "weight_kg": 63, "family_history": 0, "hypertension": 0,
    "diabetes": 0, "chest_pain_history": 0, "bp_mmhg": 115, "rbs_mmol_l": 6.7, "total_cholesterol": 200,
    "hdl": 45, "ldl": 120, "triglycerides": 150, "hemoglobin": 12.7, "creatinine": 1.0, "platelets": 270000,
    "sodium": 139, "potassium": 4.1, "chloride": 101,
}


def serving():
    """True in a web server process (runserver, gunicorn), not in migrate, shell or tests."""
    if os.environ.get("CARDIO_WARMUP", "1") == "0":
        return False
    argv = " ".join(sys.argv)
    if "runserver" in argv:
        # Only the child that serves requests, not runserver's file-watcher parent.
        return os.environ.get("RUN_MAIN") == "true" or "--noreload" in argv
    return "gunicorn" in argv


def warm_up():
    """Load the model and build the SHAP explainer once, so the first real
    prediction after a start doesn't wait ~30-40 s for them."""
    try:
        from .services import prediction_service

        prediction_service.predict(WARMUP_PATIENT)
        log.info("Prediction model warmed up")
    except Exception:  # noqa: BLE001 (a missing model is reported on first use instead)
        log.warning("Model warm-up failed; the first prediction will load it", exc_info=True)


class PredictorConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "predictor"
    verbose_name = "Cardio Sense"

    def ready(self):
        from . import activity  # noqa: F401 (connects the login/logout signal handlers)

        if serving():
            threading.Thread(target=warm_up, name="model-warmup", daemon=True).start()
