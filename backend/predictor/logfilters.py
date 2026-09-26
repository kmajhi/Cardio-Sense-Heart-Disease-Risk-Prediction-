"""Keeps OAuth secrets out of the server log.

The provider sends the browser back to /api/connect/<provider>/callback/?code=…&state=…,
and runserver logs every request line in full. The code is one-time and short-lived,
but it still doesn't belong in a log file, so it's masked before anything is written.
"""

import logging
import re

SENSITIVE = re.compile(
    r"(?P<key>[?&](?:code|state|access_token|id_token|refresh_token|token|client_secret)=)[^&\s\"']+",
    re.IGNORECASE,
)


def redact(text):
    return SENSITIVE.sub(r"\g<key>[hidden]", text)


class RedactOAuthParams(logging.Filter):
    def filter(self, record):
        if isinstance(record.msg, str):
            record.msg = redact(record.msg)
        if isinstance(record.args, tuple):
            record.args = tuple(redact(a) if isinstance(a, str) else a for a in record.args)
        return True
