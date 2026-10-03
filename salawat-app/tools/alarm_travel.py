"""Reads `dumpsys alarm` (stdin) and prints the seconds until the app's next alarm for a receiver.
Usage: alarm_travel.py RECEIVER_SUBSTRING DEVICE_NOW("YYYY-mm-dd HH:MM:SS") → prints seconds or nothing."""
import re, sys
from datetime import datetime
receiver, now_s = sys.argv[1], sys.argv[2]
now = datetime.strptime(now_s, "%Y-%m-%d %H:%M:%S")
lines = sys.stdin.read().splitlines()
best = None
for i, line in enumerate(lines):
    if "com.reminder.salawat" not in line or receiver not in line:
        continue
    for j in range(max(0, i - 3), min(len(lines), i + 6)):
        m = re.search(r"origWhen=(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)", lines[j])
        if m:
            t = datetime.strptime(m.group(1), "%Y-%m-%d %H:%M:%S")
            d = (t - now).total_seconds()
            if d > 0 and (best is None or d < best):
                best = d
            break
if best is not None:
    print(int(best))
