"""يُعدّل مشروع أندرويد المولَّد (npx cap add android) قبل البناء:
   - رقم الإصدار: versionCode يزيد مع كل بناء (شرط Google Play)، وversionName من VERSION.
   - إزالة إذن SCHEDULE_EXACT_ALARM الذي تضيفه إضافة الإشعارات: Google Play يطلب له تصريحاً خاصاً
     ولا يحتاجه التطبيق (إشعار أسبوعي لا يحتاج دقة الدقيقة).
   - قفل النسخ الاحتياطي التلقائي لأندرويد: android:allowBackup="false" وandroid:fullBackupContent="false"
     على <application>، حتى لا تُنسخ بيانات الحمل الصحية إلى Google Drive أو تُنقل بين الأجهزة دون علم المستخدمة.
   السكربت idempotent: تشغيله أكثر من مرة لا يكرر التعديلات."""
import os, re, sys

here = os.path.dirname(os.path.abspath(__file__))
code = int(sys.argv[1])
name = open(os.path.join(here, 'VERSION')).read().strip()

gradle = os.path.join(here, 'android/app/build.gradle')
g = open(gradle).read()
g, n1 = re.subn(r'versionCode \d+', f'versionCode {code}', g)
g, n2 = re.subn(r'versionName "[^"]*"', f'versionName "{name}"', g)
assert n1 == 1 and n2 == 1, 'versionCode/versionName not found'
open(gradle, 'w').write(g)

manifest = os.path.join(here, 'android/app/src/main/AndroidManifest.xml')
m = open(manifest).read()
if 'xmlns:tools' not in m:
    m = m.replace('<manifest xmlns:android="http://schemas.android.com/apk/res/android"',
                  '<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools"', 1)
rm = '<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" tools:node="remove" />'
if rm not in m:
    m = m.replace('</manifest>', f'    {rm}\n</manifest>')
for attr, val in (('android:allowBackup', 'false'), ('android:fullBackupContent', 'false')):
    app = re.search(r'<application\b[^>]*>', m).group(0)
    if f'{attr}="{val}"' in app:
        continue
    fixed = re.sub(rf'\s{attr}="[^"]*"', '', app).replace('<application', f'<application\n        {attr}="{val}"', 1)
    m = m.replace(app, fixed, 1)
open(manifest, 'w').write(m)
print(f'version {name} ({code}); exact-alarm permission removed; backup disabled')
