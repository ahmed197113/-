#!/usr/bin/env bash
# Runs inside the emulator job: installs the debug APK, seeds a configured state and captures every screen.
set -x
out="$1"
mkdir -p "$out"
pkg=com.reminder.salawat
apk=app/build/outputs/apk/debug/app-debug.apk

shot() {
  sleep "${2:-4}"
  adb exec-out screencap -p > "$out/$1.png"
}
start() { adb shell am start -W -n "$pkg/$1" "${@:2}" >/dev/null; }

adb root || true
adb shell cmd alarm set-timezone Africa/Cairo || adb shell setprop persist.sys.timezone Africa/Cairo || true
adb install -r "$apk"

# 1. First run: onboarding
start .MainActivity
shot 01-onboarding-welcome 6

# 2. Seed a configured user (Cairo, Egyptian method, alerts on) and open the app
adb shell am force-stop $pkg
adb shell "run-as $pkg mkdir -p shared_prefs"
adb shell "run-as $pkg sh -c 'cat > shared_prefs/salawat_prefs.xml'" <<'XML'
<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <boolean name="onboarded" value="true" />
    <boolean name="reminder_enabled" value="true" />
    <long name="reminder_interval_minutes" value="30" />
    <int name="last_page" value="2" />
    <int name="bookmark_global" value="255" />
</map>
XML
adb shell "run-as $pkg sh -c 'cat > shared_prefs/prayer_times_prefs.xml'" <<'XML'
<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <boolean name="use_location" value="false" />
    <string name="city">Cairo</string>
    <string name="country">Egypt</string>
    <int name="method" value="5" />
    <boolean name="prayer_alerts" value="true" />
</map>
XML
today=$(adb shell date +%Y-%m-%d | tr -d '\r')
adb shell "run-as $pkg sh -c 'cat > shared_prefs/prayer_tracker.xml'" <<XML
<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <boolean name="${today}_FAJR" value="true" />
    <boolean name="${today}_DHUHR" value="true" />
    <int name="qada_FAJR" value="3" />
</map>
XML
adb shell pm grant $pkg android.permission.POST_NOTIFICATIONS || true

start .MainActivity --es tab prayer
shot 03-prayer 12
start .MainActivity --es tab home
shot 02-home 5
adb shell input swipe 540 1800 540 500 300
shot 02b-home-scrolled 2
adb shell input swipe 540 1800 540 300 300
shot 02c-home-scrolled-more 2
start .MainActivity --es tab quran
shot 04-quran 4
start .MainActivity --es tab azkar
shot 05-azkar 4
start .MainActivity --es tab more
shot 06-more 4
start .SettingsActivity
shot 07-settings 4
start .TasbihActivity
shot 08-tasbih 4
start .QuranPagerActivity --ei page 1
shot 09-mushaf-p1 5
start .QuranPagerActivity --ei page 50
shot 10-mushaf-p50 5
start .AzkarDetailActivity --ei category_id 27 --es category_title "أذكار الصباح والمساء"
shot 11-azkar-detail 10
start .AdhanSettingsActivity
shot 12-adhan 4
start .QiblaActivity
shot 13-qibla 4

start .TrackerActivity
shot 20-tracker 4
start .CalendarActivity
shot 21-calendar 5
start .HadithBooksActivity
shot 22-hadith-books 4
start .HadithReaderActivity --es book nawawi40
shot 23-hadith-reader 5
start .NamesActivity
shot 24-names 4
start .RuqyahActivity
shot 25-ruqyah 5
start .ZakatActivity
shot 26-zakat 4
start .QuranSearchActivity --es query "\u0627\u0644\u0635\u0628\u0631"
true
shot 27-search 5
start .RemindersActivity
shot 28-reminders 4
start .MainActivity --es tab more
adb shell input swipe 540 1600 540 600 300
shot 29-more-scrolled 2

# Dark mode
adb shell cmd uimode night yes
adb shell am force-stop $pkg
start .MainActivity --es tab home
shot 14-home-dark 6
start .MainActivity --es tab prayer
shot 15-prayer-dark 4
start .QuranPagerActivity --ei page 3
shot 16-mushaf-dark 5
adb shell cmd uimode night no

adb logcat -d -s AndroidRuntime:E > "$out/crash-log.txt" || true
ls -la "$out"
