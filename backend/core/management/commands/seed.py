import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from core.dataset import DatasetError, ensure_seeded, import_dataset


class Command(BaseCommand):
    help = 'Import the Caspian Match Simulator dataset. --auto: only when the DB is empty or the bundled seed is newer (used at deploy start).'

    def add_arguments(self, parser):
        parser.add_argument('path', nargs='?', default=None, help='dataset JSON (default: bundled shared/seed file)')
        parser.add_argument('--auto', action='store_true')

    def handle(self, *args, path, auto, **opts):
        try:
            if path:
                p = Path(path)
                if not p.exists():
                    raise CommandError(f'{p} not found')
                summary = import_dataset(json.loads(p.read_text(encoding='utf-8')))
            else:
                summary = ensure_seeded(force=not auto)
        except DatasetError as e:
            raise CommandError(str(e))
        self.stdout.write(self.style.SUCCESS(f'Imported {summary}' if summary else 'Dataset already up to date'))
