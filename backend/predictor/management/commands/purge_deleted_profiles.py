from django.core.management.base import BaseCommand

from predictor.profiles import UNDO_SECONDS, purge_expired


class Command(BaseCommand):
    help = f"Permanently delete profiles deleted more than {UNDO_SECONDS // 60} minutes ago."

    def handle(self, *args, **options):
        self.stdout.write(f"Purged {purge_expired()} deleted profile(s).")
