#!/usr/bin/env python3
"""zipalign مبسط: يعيد كتابة الـ APK بحيث تبدأ بيانات الملفات غير المضغوطة على حدود 4 بايت
(مطلوب لـ resources.arsc في أندرويد 11+). يُبقي طريقة الضغط التي اختارها aapt2 لكل ملف."""
import sys, zipfile

src, dst = sys.argv[1], sys.argv[2]

with zipfile.ZipFile(src) as zin, open(dst, 'wb') as raw:
    zout = zipfile.ZipFile(raw, 'w')
    for info in zin.infolist():
        data = zin.read(info.filename)
        ni = zipfile.ZipInfo(info.filename, date_time=(2026, 1, 1, 0, 0, 0))
        ni.external_attr = info.external_attr
        stored = info.compress_type == zipfile.ZIP_STORED or info.filename == 'resources.arsc'
        ni.compress_type = zipfile.ZIP_STORED if stored else zipfile.ZIP_DEFLATED
        if stored:
            header_end = raw.tell() + 30 + len(ni.filename.encode('utf-8'))
            pad = (4 - header_end % 4) % 4
            ni.extra = b'\x00' * pad
        zout.writestr(ni, data)
    zout.close()

# تحقق
with zipfile.ZipFile(dst) as z, open(dst, 'rb') as f:
    for i in z.infolist():
        if i.compress_type == zipfile.ZIP_STORED:
            f.seek(i.header_offset + 26)
            n, m = int.from_bytes(f.read(2), 'little'), int.from_bytes(f.read(2), 'little')
            off = i.header_offset + 30 + n + m
            assert off % 4 == 0, (i.filename, off)
print('aligned', dst)
