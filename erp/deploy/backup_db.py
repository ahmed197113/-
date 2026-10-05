"""نسخة احتياطية يومية آمنة لقاعدة البيانات (تحتفظ بآخر 30 نسخة).
الاستخدام: python /home/YOUR_USERNAME/erp_app/deploy/backup_db.py
"""
import datetime as dt
import pathlib
import sqlite3

APP = pathlib.Path(__file__).resolve().parent.parent
BACKUPS = pathlib.Path.home() / "backups"
KEEP = 30

BACKUPS.mkdir(exist_ok=True)
target = BACKUPS / f"erp-{dt.datetime.now():%Y-%m-%d}.sqlite3"
src = sqlite3.connect(APP / "db.sqlite3")
dst = sqlite3.connect(target)
with dst:
    src.backup(dst)  # نسخ متسق حتى أثناء استخدام البرنامج
dst.close()
src.close()
old = sorted(BACKUPS.glob("erp-*.sqlite3"))[:-KEEP]
for f in old:
    f.unlink()
print("backup:", target)
