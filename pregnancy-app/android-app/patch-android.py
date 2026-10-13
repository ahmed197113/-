"""يجهّز مشروع أندرويد المولَّد للنشر على Google Play: رقم الإصدار، توقيع الإصدار، إزالة إذن المنبّه الدقيق، وويدجت الشاشة الرئيسية."""
import os, re, shutil, sys
d = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'android', 'app')
run = int(os.environ.get('GITHUB_RUN_NUMBER', '1'))

g = open(os.path.join(d, 'build.gradle'), encoding='utf-8').read()
g = re.sub(r'versionCode \d+', f'versionCode {run + 100}', g)
g = re.sub(r'versionName "[^"]*"', f'versionName "1.2.{run}"', g)
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
# ويدجت الشاشة الرئيسية
if 'NabdWidget' not in x:
    x = x.replace('</application>', '''        <receiver android:name=".NabdWidget" android:exported="false" android:label="نبضٌ صغير">
            <intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE" /></intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/nabd_widget_info" />
        </receiver>
    </application>''', 1)
open(m, 'w', encoding='utf-8').write(x)

w = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'widget')
src = os.path.join(d, 'src', 'main')
java = os.path.join(src, 'java', 'app', 'nabd', 'pregnancy')
for f, to in [('NabdWidget.java', java), ('nabd_widget.xml', os.path.join(src, 'res', 'layout')),
              ('nabd_widget_bg.xml', os.path.join(src, 'res', 'drawable')), ('nabd_widget_info.xml', os.path.join(src, 'res', 'xml'))]:
    os.makedirs(to, exist_ok=True); shutil.copy(os.path.join(w, f), to)
# تحديث الويدجت فور الخروج من التطبيق
ma = os.path.join(java, 'MainActivity.java')
a = open(ma, encoding='utf-8').read()
if 'refreshAll' not in a:
    a2 = re.sub(r'extends BridgeActivity\s*\{\s*\}', '''extends BridgeActivity {
    @Override
    public void onPause() {
        super.onPause();
        NabdWidget.refreshAll(this);
    }
}''', a)
    if a2 == a: print('warning: MainActivity not patched'); 
    open(ma, 'w', encoding='utf-8').write(a2)
print('patched: versionCode', run + 100, '| release signing' if os.environ.get('NABD_UPLOAD_KEYSTORE_FILE') else '| no release key')
