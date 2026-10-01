"""Rows from before accounts existed: the seeded demo profile and assessments
with no user. The API never shows them; this removes them when you're ready."""

from django.core.management.base import BaseCommand

from predictor.models import Assessment, Profile


class Command(BaseCommand):
    help = "Delete profiles and assessments that belong to no account (pre-accounts data)."

    def add_arguments(self, parser):
        parser.add_argument("--yes", action="store_true", help="Delete without asking.")

    def handle(self, *args, **options):
        profiles = Profile.objects.filter(user__isnull=True)
        assessments = Assessment.objects.filter(user__isnull=True)
        summary = f"{profiles.count()} profile(s) and {assessments.count()} assessment(s) with no account"
        if not options["yes"]:
            self.stdout.write(f"Would delete {summary}. Re-run with --yes to delete them.")
            return
        assessments.delete()
        profiles.delete()
        self.stdout.write(f"Deleted {summary}.")
