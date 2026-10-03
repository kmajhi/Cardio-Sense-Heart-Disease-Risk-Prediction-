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
