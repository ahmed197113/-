#!/usr/bin/env bash
# Runs inside the emulator job: installs the debug APK, seeds a configured state and captures every screen.
set -x
out="$1"
mkdir -p "$out"
pkg=com.reminder.salawat
apk=app/build/outputs/apk/debug/app-debug.apk

shot() {
  sleep "${2:-4}"
  adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS >/dev/null 2>&1 || true
  adb exec-out screencap -p > "$out/$1.png"
}
start() { adb shell am start -W -n "$pkg/$1" "${@:2}" >/dev/null; }
# Taps the first on-screen element whose text contains $1 (via a uiautomator dump).
tap_text() {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  local xy
  xy=$(adb exec-out cat /sdcard/ui.xml | python3 -c '
import re,sys
x=sys.stdin.read(); t=sys.argv[1]
nodes=[]
for m in re.finditer(r"<node [^>]*>", x):
    n=m.group(0); tx=re.search(r"text=\"([^\"]*)\"", n)
    nodes.append((tx.group(1) if tx else "", n))
hit=[n for tx,n in nodes if tx==t] or [n for tx,n in nodes if t in tx]
if hit:
    a=list(map(int,re.search(r"bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"", hit[0]).groups()))
    print((a[0]+a[2])//2, (a[1]+a[3])//2)
' "$1")
  echo "tap_text '$1' -> $xy"
  [ -n "$xy" ] && adb shell input tap $xy
}

adb root || true
adb shell cmd alarm set-timezone Africa/Cairo || adb shell setprop persist.sys.timezone Africa/Cairo || true
adb install -r "$apk"
# The emulator's launcher tends to ANR on CI and its dialog covers the screenshots; we start screens directly anyway.
adb shell pm disable-user --user 0 com.google.android.apps.nexuslauncher || true
adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS || true

# 1. First run: onboarding
start .MainActivity
shot 01-onboarding-welcome 6
# First run asks for the adhan's permissions straight away
tap_text "$(printf 'التالي')" || true
shot 01b-onboarding-notif-permission 3
tap_text "Allow" || tap_text "السماح" || true
shot 01c-onboarding-next-permission 3
tap_text "لاحقاً" || true
shot 01d-onboarding-after-permissions 4

# 2. Seed a configured user (Cairo, Egyptian method, alerts on) and open the app
adb shell am force-stop $pkg
adb shell "run-as $pkg mkdir -p shared_prefs"
adb shell "run-as $pkg sh -c 'cat > shared_prefs/salawat_prefs.xml'" <<'XML'
<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <boolean name="onboarded" value="true" />
    <boolean name="alert_perms_asked_v6" value="true" />
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
adb shell appops set $pkg SCHEDULE_EXACT_ALARM allow || true

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
shot 09-mushaf-p1 15
start .QuranPagerActivity --ei page 2
shot 09b-mushaf-p2 15
start .QuranPagerActivity --ei page 3
shot 09c-mushaf-p3 15
start .QuranPagerActivity --ei page 604
shot 09d-mushaf-p604 15
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
tap_text "صحيح البخاري"
shot 23-hadith-reader 25
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

# Location button: services off -> explanation; then on + permission -> fix saved automatically
adb shell settings put secure location_mode 0 || adb shell cmd location set-location-enabled false || true
start .SettingsActivity
sleep 4
tap_text "الموقع" || true
sleep 2
shot 40-location-sheet 2
tap_text "استخدام موقعي الحالي"
shot 41-location-permission 4
tap_text "أثناء استخدام" || tap_text "While using" || tap_text "Only this time" || true
shot 42-location-services-off 5
adb shell input keyevent KEYCODE_BACK; sleep 1
adb shell input keyevent KEYCODE_BACK; sleep 1
adb shell cmd location set-location-enabled true || adb shell settings put secure location_mode 3 || true
adb emu geo fix 31.2357 30.0444 || true
adb shell pm grant $pkg android.permission.ACCESS_COARSE_LOCATION || true
start .SettingsActivity
sleep 4
tap_text "الموقع" || true
sleep 2
for i in 1 2 3; do adb emu geo fix 31.2357 30.0444 || true; sleep 1; done
tap_text "استخدام موقعي الحالي"
shot 43-location-locating 2
for i in $(seq 1 12); do adb emu geo fix 31.2357 30.0444 || true; sleep 2; done
shot 44-location-saved 6
adb shell "run-as $pkg cat shared_prefs/prayer_times_prefs.xml" > "$out/prayer_prefs_after_gps.txt" || true

# Alerts fire with the app closed: pre-adhan takbir, iqama, salawat (receivers invoked directly as root)
adb shell am force-stop $pkg
adb shell am broadcast -n $pkg/.ReminderReceiver --es type PRE_ADHAN --es prayer DHUHR || true
sleep 3
adb shell dumpsys media_session > /dev/null 2>&1 || true
adb shell "dumpsys audio | grep -i -A3 'players:'" > "$out/audio-during-takbir.txt" 2>&1 || true
adb shell am broadcast -n $pkg/.ReminderReceiver --es type IQAMA --es prayer ASR || true
adb shell am broadcast -n $pkg/.SalawatReceiver || true
sleep 2
adb shell cmd statusbar expand-notifications || true
shot 45-alerts-notifications 2
adb shell cmd statusbar collapse || true
adb shell "dumpsys alarm | grep -A2 $pkg" > "$out/alarms.txt" 2>&1 || true

start .QuranPagerActivity --ei page 50
shot 46-mushaf-title 4
start .MainActivity --es tab quran
shot 47-quran-index 4

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

# Colour theme (blue) + sepia Mushaf, then purple + night Mushaf
for combo in "blue SEPIA" "purple NIGHT"; do
  set -- $combo
  adb shell am force-stop $pkg
  adb shell "run-as $pkg cat shared_prefs/salawat_prefs.xml" > /tmp/sp.xml
  sed -i '/color_theme\|reading_mode/d; s#</map>#<string name="color_theme">'"$1"'</string>\n<string name="reading_mode">'"$2"'</string>\n</map>#' /tmp/sp.xml
  adb shell "run-as $pkg sh -c 'cat > shared_prefs/salawat_prefs.xml'" < /tmp/sp.xml
  start .MainActivity --es tab home
  shot 50-theme-$1-home 6
  start .QuranPagerActivity --ei page 2
  shot 51-theme-$1-mushaf-$2 5
done

# ---- Text (Tanzil) view of page 421 at night, as on a phone without the Mushaf page font ----
adb shell am force-stop $pkg
adb shell "run-as $pkg cat shared_prefs/salawat_prefs.xml" > /tmp/sp.xml
sed -i '/mushaf_pages\|reading_mode/d; s#</map>#<boolean name="mushaf_pages" value="false" />\n<string name="reading_mode">NIGHT</string>\n</map>#' /tmp/sp.xml
adb shell "run-as $pkg sh -c 'cat > shared_prefs/salawat_prefs.xml'" < /tmp/sp.xml
start .QuranPagerActivity --ei page 421
shot 64-text-page-421-night 5
adb shell am force-stop $pkg
sed -i '/mushaf_pages/d' /tmp/sp.xml
adb shell "run-as $pkg sh -c 'cat > shared_prefs/salawat_prefs.xml'" < /tmp/sp.xml

# ---- New screens (Arabic), then the English interface ----
adb shell am force-stop $pkg
start .RamadanActivity
shot 65-ramadan 10
start .RemindersActivity
shot 66-reminders 4
start .QuranPagerActivity --ei page 50
sleep 4
adb shell input tap 540 1300
shot 67-ayah-sheet 6
adb shell am force-stop $pkg
adb shell cmd locale set-app-locales $pkg --locales en || true
start .MainActivity --es tab home
shot 70-en-home 6
start .MainActivity --es tab prayer
shot 71-en-prayer 4
start .MainActivity --es tab more
shot 72-en-more 4
start .SettingsActivity
shot 73-en-settings 4
start .RamadanActivity
shot 74-en-ramadan 10
start .MainActivity --es tab quran
shot 75-en-quran-index 4
start .QuranPagerActivity --ei page 50
sleep 4
adb shell input tap 540 1300
shot 76-en-ayah-sheet 8
adb shell am force-stop $pkg
adb shell cmd locale set-app-locales $pkg --locales ar || true

# ---- End-to-end alarms: jump the clock to just before each scheduled alarm and let it fire on its own ----
travel() {  # $1 receiver, $2 label
  # App closed the way a phone closes it (swiped away / killed in the background). force-stop would also
  # cancel every alarm, which Android only does when the user stops the app from its settings page.
  adb shell input keyevent KEYCODE_HOME
  adb shell am kill $pkg
  sleep 2
  now=$(adb shell date "+%Y-%m-%d\ %H:%M:%S" | tr -d '\r')
  secs=$(adb shell dumpsys alarm | python3 tools/alarm_travel.py "$1" "$now")
  echo "== $2: next $1 alarm in ${secs:-NONE}s (device now $now)" >> "$out/alarms-e2e.log"
  [ -z "$secs" ] && return
  epoch=$(adb shell date +%s | tr -d '\r')
  target=$((epoch + secs - 15))
  adb shell "date @$target" > /dev/null 2>&1 || adb shell "toybox date $(python3 -c "import time;print(time.strftime('%m%d%H%M%Y.%S', time.localtime($target)))")" > /dev/null 2>&1
  sleep 40
  adb shell "dumpsys notification --noredact" | grep -E "pkg=com.reminder.salawat|android.title=|android.text=" | grep -B1 -A2 "com.reminder.salawat" | head -40 >> "$out/alarms-e2e.log"
  adb shell "dumpsys audio" | grep -iE "player|usage=USAGE_ALARM|state:started" | head -10 >> "$out/alarms-e2e.log"
  adb shell cmd statusbar expand-notifications || true
  shot 60-e2e-$2 2
  adb shell cmd statusbar collapse || true
}
adb shell settings put global auto_time 0 || true
adb shell "dumpsys alarm" | grep -B2 -A4 "com.reminder.salawat" > "$out/alarms-before.log" || true
travel SalawatReceiver salawat
travel ReminderReceiver reminder-1
travel PrayerAlarmReceiver adhan
sleep 150
adb shell "dumpsys notification --noredact" | grep -E "android.title=|android.text=" | head -20 >> "$out/alarms-e2e.log"
shot 61-e2e-after-adhan 1
travel ReminderReceiver reminder-2
travel ReminderReceiver reminder-3
adb shell "dumpsys alarm" | grep -B2 -A4 "com.reminder.salawat" > "$out/alarms-after.log" || true

adb logcat -d -s AndroidRuntime:E > "$out/crash.log" || true
[ -s "$out/crash.log" ] || echo "no crashes" > "$out/crash.log"
ls -la "$out"
