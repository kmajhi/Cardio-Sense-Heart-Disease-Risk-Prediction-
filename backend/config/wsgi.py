import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
application = get_wsgi_application()

# Import every URL module now, in this one thread, before gunicorn's threads start
# serving. Django otherwise imports them on the first request; with --threads,
# the first few requests (Render's health check among them) import numpy, pandas,
# scikit-learn and shap at the same moment, and one thread can see numpy
# half-initialised: "cannot import name 'ufunc' from partially initialized module
# 'numpy'". The deploy then never passes its health check.
from django.urls import get_resolver  # noqa: E402

get_resolver().url_patterns


# Load the model and run one throwaway prediction in the background, so the
# first real user after a deploy or a free-plan wake-up doesn't wait for it
# (QA BUG-02). load_model() is lock-protected: a request arriving first simply
# waits for this same load. A missing model is reported when it's used instead.
def _warm_up():
    try:
        from predictor.samples import SAMPLES
        from predictor.services import prediction_service

        prediction_service.predict(SAMPLES["moderate"])
    except Exception:  # noqa: BLE001
        pass


if os.environ.get("CARDIO_WARM_UP", "1") != "0":
    import threading  # noqa: E402

    threading.Thread(target=_warm_up, name="model-warm-up", daemon=True).start()
