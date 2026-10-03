"""Logs where a request is stuck when it runs too long.

On Render, predictions hung while every other request was answered, until the
4 gunicorn threads were all stuck and the health check failed. gunicorn only
logs a request once it finishes, so a hang leaves no trace. This middleware
notes which thread serves which request; a background thread logs the stack of
any request still running after SLOW_REQUEST_SECONDS (once per request), so the
deploy logs show exactly which line it is waiting on.
"""

from __future__ import annotations

import logging
import os
import sys
import threading
import time
import traceback

log = logging.getLogger(__name__)

SLOW_REQUEST_SECONDS = float(os.environ.get("SLOW_REQUEST_SECONDS", 15))
_running: dict[int, list] = {}  # thread id -> [method, path, started, reported]
_lock = threading.Lock()
_watcher: threading.Thread | None = None


def check_slow_requests() -> int:
    """Log the stack of every request running longer than SLOW_REQUEST_SECONDS (once each)."""
    now = time.monotonic()
    with _lock:
        slow = [(tid, entry) for tid, entry in _running.items() if not entry[3] and now - entry[2] > SLOW_REQUEST_SECONDS]
        for _, entry in slow:
            entry[3] = True
    frames = sys._current_frames()
    for tid, (method, path, started, _) in slow:
        frame = frames.get(tid)
        stack = "".join(traceback.format_stack(frame)[-25:]) if frame else "(thread gone)\n"
        log.warning("Slow request: %s %s still running after %.0f s. Stack:\n%s", method, path, now - started, stack)
    if slow:
        # Every other thread too, to show who holds whatever the request waits on.
        names = {t.ident: t.name for t in threading.enumerate()}
        slow_ids = {tid for tid, _ in slow}
        others = [
            f"--- {names.get(tid, tid)}\n" + "".join(traceback.format_stack(frame)[-12:])
            for tid, frame in frames.items()
            if tid not in slow_ids and tid != threading.get_ident()
        ]
        log.warning("Other threads while a request was slow:\n%s", "\n".join(others))
    return len(slow)


def _watch():
    while True:
        time.sleep(5)
        try:
            check_slow_requests()
        except Exception:  # noqa: BLE001 (never let the watchdog die)
            log.exception("Slow-request watchdog failed")


def _ensure_watcher():
    global _watcher
    if _watcher is None or not _watcher.is_alive():
        _watcher = threading.Thread(target=_watch, name="slow-request-watchdog", daemon=True)
        _watcher.start()


class SlowRequestWatchdogMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        _ensure_watcher()
        tid = threading.get_ident()
        with _lock:
            _running[tid] = [request.method, request.path, time.monotonic(), False]
        try:
            return self.get_response(request)
        finally:
            with _lock:
                _running.pop(tid, None)
