"""يجهّز مشروع أندرويد المولَّد للنشر على Google Play: رقم الإصدار، توقيع الإصدار، إزالة إذن المنبّه الدقيق، وويدجت الشاشة الرئيسية."""
import os, re, shutil, sys
d = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'android', 'app')
run = int(os.environ.get('GITHUB_RUN_NUMBER', '1'))

g = open(os.path.join(d, 'build.gradle'), encoding='utf-8').read()
# رقم الإصدار: من رقم البناء على GitHub، أو من version.json إن كان أكبر (لتثبيت رقم معيّن مثل 1.2.48)
import json
here = os.path.dirname(os.path.abspath(__file__))
code, name = run + 100, f'1.2.{run}'
vf = os.path.join(here, 'version.json')
if os.path.exists(vf):
    v = json.load(open(vf, encoding='utf-8'))
    if v['code'] >= code: code, name = v['code'], v['name']
g = re.sub(r'versionCode \d+', f'versionCode {code}', g)
g = re.sub(r'versionName "[^"]*"', f'versionName "{name}"', g)
# توقيع ثابت: نسخة التجربة (APK) دائماً بـ nabd-debug.keystore (SHA-1 D5:F7…2F:37 المسجّلة في Firebase وFacebook)
debug_ks = os.path.join(here, 'nabd-debug.keystore').replace('\\', '/')
release = '''
        release {
            storeFile file(System.getenv("NABD_UPLOAD_KEYSTORE_FILE"))
            storePassword System.getenv("NABD_UPLOAD_PASSWORD")
            keyAlias "nabd-upload"
            keyPassword System.getenv("NABD_UPLOAD_PASSWORD")
        }''' if os.environ.get('NABD_UPLOAD_KEYSTORE_FILE') else ''
g = g.replace('    buildTypes {', f'''    signingConfigs {{
        debug {{
            storeFile file("{debug_ks}")
            storePassword "android"
            keyAlias "androiddebugkey"
            keyPassword "android"
        }}{release}
    }}
    buildTypes {{
        debug {{
            signingConfig signingConfigs.debug
        }}''', 1)
if release:
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
# تسجيل الدخول عبر Firebase (Google وFacebook) — فقط عند وجود google-services.json
FB_APP_ID, FB_CLIENT_TOKEN = '1001207472985367', 'afcdd6a488d6802dd2e0de80b494facf'  # يُدمجان في التطبيق بطبيعتهما (ليسا سرّين)
gs = os.path.join(d, 'google-services.json')
firebase = os.path.exists(gs)
if firebase:
    import json
    pk = [c['client_info']['android_client_info']['package_name'] for c in json.load(open(gs, encoding='utf-8'))['client']]
    if 'app.nabd.pregnancy' not in pk: sys.exit(f'google-services.json لا يحتوي app.nabd.pregnancy (فيه: {pk})')
    vg = os.path.join(os.path.dirname(d), 'variables.gradle')
    v = open(vg, encoding='utf-8').read()
    if 'rgcfaIncludeGoogle' not in v:
        v = v.replace('ext {', "ext {\n    rgcfaIncludeGoogle = true\n    rgcfaIncludeFacebook = true\n    androidxCredentialsVersion = '1.3.0'\n    androidxCredentialsPlayServicesAuthVersion = '1.3.0'", 1)
        open(vg, 'w', encoding='utf-8').write(v)
    sx = os.path.join(src, 'res', 'values', 'strings.xml')
    t = open(sx, encoding='utf-8').read()
    if 'facebook_app_id' not in t:
        t = t.replace('</resources>', f'''    <string name="facebook_app_id">{FB_APP_ID}</string>
    <string name="fb_login_protocol_scheme">fb{FB_APP_ID}</string>
    <string name="facebook_client_token">{FB_CLIENT_TOKEN}</string>
</resources>''', 1)
        open(sx, 'w', encoding='utf-8').write(t)
    x = open(m, encoding='utf-8').read()
    if 'com.facebook.sdk.ApplicationId' not in x:
        x = x.replace('</application>', '''        <meta-data android:name="com.facebook.sdk.ApplicationId" android:value="@string/facebook_app_id" />
        <meta-data android:name="com.facebook.sdk.ClientToken" android:value="@string/facebook_client_token" />
        <!-- لا تتبّع ولا إعلانات: نستخدم Facebook لتسجيل الدخول فقط -->
        <meta-data android:name="com.facebook.sdk.AutoLogAppEventsEnabled" android:value="false" />
        <meta-data android:name="com.facebook.sdk.AdvertiserIDCollectionEnabled" android:value="false" />
        <activity android:name="com.facebook.FacebookActivity" android:configChanges="keyboard|keyboardHidden|screenLayout|screenSize|orientation" android:label="@string/app_name" />
        <activity android:name="com.facebook.CustomTabActivity" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="@string/fb_login_protocol_scheme" />
            </intent-filter>
        </activity>
    </application>''', 1)
        x = x.replace('</manifest>', '    <uses-permission android:name="com.google.android.gms.permission.AD_ID" tools:node="remove" />\n</manifest>', 1)
        open(m, 'w', encoding='utf-8').write(x)
if firebase:
    # Crashlytics: إضافة Gradle (بدونها يتوقف التطبيق عند الفتح)
    rg = os.path.join(os.path.dirname(d), 'build.gradle')
    r = open(rg, encoding='utf-8').read()
    if 'firebase-crashlytics-gradle' not in r:
        r = r.replace("classpath 'com.google.gms:google-services", "classpath 'com.google.firebase:firebase-crashlytics-gradle:3.0.3'\n        classpath 'com.google.gms:google-services", 1)
        open(rg, 'w', encoding='utf-8').write(r)
    ag = os.path.join(d, 'build.gradle')
    t = open(ag, encoding='utf-8').read()
    if 'com.google.firebase.crashlytics' not in t:
        # خارج try/catch في القالب: لو فشل تطبيقها يفشل البناء بوضوح بدل تطبيق يتوقف عند الفتح
        t += "\napply plugin: 'com.google.firebase.crashlytics'\n"
        open(ag, 'w', encoding='utf-8').write(t)
    # رسالة خطأ تسجيل الدخول كاملة: نوع الاستثناء وstatusCode لـ GoogleSignIn
    fa = os.path.join(here, 'node_modules', '@capacitor-firebase', 'authentication', 'android', 'src', 'main', 'java', 'io', 'capawesome', 'capacitorjs', 'plugins', 'firebase', 'authentication', 'FirebaseAuthentication.java')
    if os.path.exists(fa):
        j = open(fa, encoding='utf-8').read()
        old = '''        if (message == null && exception != null) {
            message = exception.getMessage();
        }
        Logger.error(TAG, message, exception);
        String code = FirebaseAuthenticationHelper.createErrorCode(exception);
        call.reject(message, code);'''
        new = '''        if (message == null && exception != null) {
            message = exception.getMessage();
        }
        String code = FirebaseAuthenticationHelper.createErrorCode(exception);
        if (exception != null) {
            String type = exception.getClass().getSimpleName();
            if (exception instanceof com.google.android.gms.common.api.ApiException) {
                int sc = ((com.google.android.gms.common.api.ApiException) exception).getStatusCode();
                type += " statusCode=" + sc + " " + com.google.android.gms.common.api.CommonStatusCodes.getStatusCodeString(sc);
                if (code == null) code = "status-" + sc;
            } else if (exception instanceof androidx.credentials.exceptions.GetCredentialException) {
                type += " type=" + ((androidx.credentials.exceptions.GetCredentialException) exception).getType();
            }
            message = type + ": " + message;
            if (code == null) code = exception.getClass().getSimpleName();
        }
        Logger.error(TAG, message, exception);
        call.reject(message, code);'''
        n = j.count(old)
        j = j.replace(old, new)
        open(fa, 'w', encoding='utf-8').write(j)
        print('auth error details patched:', n)
print('firebase login:', 'on' if firebase else 'off (no google-services.json)')
print('patched: versionCode', code, name, '| release signing' if os.environ.get('NABD_UPLOAD_KEYSTORE_FILE') else '| no release key')
