import os
import sys
from pathlib import Path
from celery import Celery

# Ensure project root (containing ai_engine) and backend dir are in sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
DOCUMIND_ROOT = BASE_DIR.parent

for p in (str(DOCUMIND_ROOT), str(BASE_DIR)):
    if p not in sys.path:
        sys.path.insert(0, p)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('config')

app.config_from_object('django.conf:settings', namespace='CELERY')

app.autodiscover_tasks()
