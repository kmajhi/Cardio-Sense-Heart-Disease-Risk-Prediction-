import threading
import time

from predictor import watchdog


def test_a_stuck_request_is_logged_with_its_stack(caplog, monkeypatch):
    monkeypatch.setattr(watchdog, "SLOW_REQUEST_SECONDS", 0.05)
    release = threading.Event()

    def stuck_view(request):
        release.wait(5)  # the line the log must point at
        return "ok"

    class Req:
        method, path = "POST", "/api/predict/"

    middleware = watchdog.SlowRequestWatchdogMiddleware(stuck_view)
    worker = threading.Thread(target=middleware, args=(Req(),))
    worker.start()
    time.sleep(0.2)
    with caplog.at_level("WARNING", logger="predictor.watchdog"):
        assert watchdog.check_slow_requests() == 1
        assert watchdog.check_slow_requests() == 0  # reported once
    release.set()
    worker.join()
    assert "POST /api/predict/ still running" in caplog.text
    assert "release.wait(5)" in caplog.text
    assert not watchdog._running  # cleaned up when the request ends
