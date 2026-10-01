"""The signed-in user's profile, and what deleting one means.

DELETE /api/profile/ only marks the profile deleted, so the page's Undo can put
it back exactly as it was, linked accounts included. After UNDO_SECONDS it is
purged for good: lazily on the next API call, or by
`python manage.py purge_deleted_profiles` (run it from a scheduler in production).
Deleting the whole account (DELETE /api/auth/account/) removes everything at once.
"""

from datetime import timedelta

from django.utils import timezone

from .models import ConnectionEvent, Profile

UNDO_SECONDS = 600


def _cutoff():
    return timezone.now() - timedelta(seconds=UNDO_SECONDS)


def purge(profile):
    """Delete a profile for good. Its linked accounts are logged as unlinked;
    its assessments stay with the account (their profile link is cleared)."""
    for provider, link in (profile.connections or {}).items():
        ConnectionEvent.objects.create(
            provider=provider, action="disconnected", profile=profile,
            handle=str(link.get("handle", ""))[:80], detail="Profile deleted",
        )
    profile.delete()


def purge_expired():
    """Purge every profile deleted more than UNDO_SECONDS ago. Returns how many."""
    expired = list(Profile.objects.filter(deleted_at__lt=_cutoff()))
    for profile in expired:
        purge(profile)
    return len(expired)


def current_profile(user, *, include_deleted=False):
    """The user's profile, or None. A deleted one only comes back with include_deleted
    (and only while it can still be restored)."""
    if not user.is_authenticated:
        return None
    profile = Profile.objects.filter(user=user).first()
    if profile is None or profile.deleted_at is None:
        return profile
    if profile.deleted_at < _cutoff():
        purge(profile)
        return None
    return profile if include_deleted else None
