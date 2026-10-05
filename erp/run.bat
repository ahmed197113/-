@echo off
chcp 65001 >nul
cd /d %~dp0
if not exist .venv (
  echo تجهيز البيئة لأول مرة...
  python -m venv .venv
  .venv\Scripts\pip install -r requirements.txt
)
if not exist db.sqlite3 (
  .venv\Scripts\python manage.py migrate
  .venv\Scripts\python manage.py setup_company
)
.venv\Scripts\python manage.py migrate --noinput >nul
start "" http://127.0.0.1:8000/
.venv\Scripts\python manage.py runserver 0.0.0.0:8000
