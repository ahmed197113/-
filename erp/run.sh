#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
[ -d .venv ] || { python3 -m venv .venv && .venv/bin/pip install -r requirements.txt; }
if [ ! -f db.sqlite3 ]; then .venv/bin/python manage.py migrate && .venv/bin/python manage.py setup_company; fi
.venv/bin/python manage.py migrate --noinput >/dev/null
exec .venv/bin/python manage.py runserver 0.0.0.0:8000
