#!/bin/sh
# Container entrypoint: everything a visitor needs is prepared automatically.
set -e
cd /app/backend
python manage.py migrate --noinput
python manage.py seed --auto              # loads / updates the bundled real data when needed
python manage.py collectstatic --noinput -v0
# optional admin account for editing real data (Django admin at /admin/)
if [ -n "$DJANGO_SUPERUSER_USERNAME" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
  python manage.py createsuperuser --noinput --email "${DJANGO_SUPERUSER_EMAIL:-admin@localhost}" 2>/dev/null || true
fi
exec gunicorn backend.wsgi:application --bind "0.0.0.0:${PORT:-8000}" --workers "${WEB_CONCURRENCY:-3}" --timeout 60 --access-logfile -
