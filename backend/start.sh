#!/usr/bin/env bash
set -e

# Ensure Python unbuffered stdout/stderr for immediate live Render logging
export PYTHONUNBUFFERED=1

echo "=== Starting docuMind Deployment Bootstrap ==="

# 1. Run database migrations on Supabase PostgreSQL
echo "Applying database migrations..."
python manage.py migrate --noinput

# 2. Collect static files for WhiteNoise
echo "Collecting static assets..."
python manage.py collectstatic --noinput

# 3. Start Celery worker in background (concurrency=1 to fit Render 512MB RAM ceiling)
echo "Starting Celery worker in background..."
celery -A config worker --loglevel=info --concurrency=1 --pool=threads &
CELERY_PID=$!

# Trap SIGTERM / SIGINT so both Celery and Gunicorn shut down cleanly
cleanup() {
    echo "Stopping background Celery worker (PID: $CELERY_PID)..."
    kill -TERM "$CELERY_PID" 2>/dev/null || true
    wait "$CELERY_PID" 2>/dev/null || true
    exit 0
}
trap cleanup SIGTERM SIGINT

# 4. Start Gunicorn WSGI server in foreground (directing access and error logs to stdout/stderr)
echo "Starting Gunicorn server on port ${PORT:-8000}..."
exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:${PORT:-8000} \
    --workers 1 \
    --threads 2 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile - \
    --capture-output \
    --log-level info
