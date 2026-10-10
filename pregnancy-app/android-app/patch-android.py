"""يجهّز مشروع أندرويد المولَّد للنشر على Google Play: رقم الإصدار، توقيع الإصدار، وإزالة إذن المنبّه الدقيق."""
import os, re, sys
d = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'android', 'app')
run = int(os.environ.get('GITHUB_RUN_NUMBER', '1'))

g = open(os.path.join(d, 'build.gradle'), encoding='utf-8').read()
g = re.sub(r'versionCode \d+', f'versionCode {run + 100}', g)
g = re.sub(r'versionName "[^"]*"', f'versionName "1.0.{run}"', g)
if os.environ.get('NABD_UPLOAD_KEYSTORE_FILE'):
    signing = '''    signingConfigs {
        release {
            storeFile file(System.getenv("NABD_UPLOAD_KEYSTORE_FILE"))
            storePassword System.getenv("NABD_UPLOAD_PASSWORD")
            keyAlias "nabd-upload"
            keyPassword System.getenv("NABD_UPLOAD_PASSWORD")
        }
    }
    buildTypes {'''
    g = g.replace('    buildTypes {', signing, 1)
    g = re.sub(r'(release \{\s*\n\s*minifyEnabled false)', r'\1\n            signingConfig signingConfigs.release', g, count=1)
open(os.path.join(d, 'build.gradle'), 'w', encoding='utf-8').write(g)

m = os.path.join(d, 'src', 'main', 'AndroidManifest.xml')
x = open(m, encoding='utf-8').read()
if 'xmlns:tools' not in x:
    x = x.replace('<manifest xmlns:android="http://schemas.android.com/apk/res/android"', '<manifest xmlns:android="http://schemas.android.com/apk/res/android"\n    xmlns:tools="http://schemas.android.com/tools"', 1)
# الإشعارات الأسبوعية لا تحتاج دقة المنبّه، وGoogle Play يقيّد هذا الإذن
x = x.replace('</manifest>', '    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" tools:node="remove" />\n</manifest>', 1)
open(m, 'w', encoding='utf-8').write(x)
print('patched: versionCode', run + 100, '| release signing' if os.environ.get('NABD_UPLOAD_KEYSTORE_FILE') else '| no release key')
