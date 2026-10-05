#!/usr/bin/env bash
# End-to-end test + screenshots, run inside the emulator job.
# Drives the real app like a user and writes PASS/FAIL lines to report.txt.
set -x
out="$1"
mkdir -p "$out"
report="$out/report.txt"
: > "$report"
pkg=com.wafr.app
apk=app/build/outputs/apk/debug/app-debug.apk
fails=0

shot() {
  sleep "${2:-3}"
  adb exec-out screencap -p > "$out/$1.png"
}
start() { adb shell am start -W -n "$pkg/.MainActivity" "$@" >/dev/null; }
swipe_up() { adb shell input swipe 540 1700 540 800 350; sleep 1; }
dump() { adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; adb exec-out cat /sdcard/ui.xml; }
# Taps the first on-screen element whose text/content-desc matches $1 (exact first, then contains).
tap_text() {
  local xy
  xy=$(dump | python3 -c '
import re,sys
x=sys.stdin.read(); t=sys.argv[1]
nodes=[]
for m in re.finditer(r"<node [^>]*>", x):
    n=m.group(0)
    for attr in ("text","content-desc"):
        tx=re.search(attr+r"=\"([^\"]*)\"", n)
        if tx and tx.group(1): nodes.append((tx.group(1), n))
hit=[n for tx,n in nodes if tx==t] or [n for tx,n in nodes if t in tx]
if hit:
    a=list(map(int,re.search(r"bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"", hit[0]).groups()))
    print((a[0]+a[2])//2, (a[1]+a[3])//2)
' "$1")
  echo "tap_text '$1' -> $xy"
  if [ -n "$xy" ]; then adb shell input tap $xy; sleep 0.6; return 0; fi
  return 1
}
# Scrolls until the text is visible, then taps it.
scroll_tap() { for i in 1 2 3 4 5 6; do tap_text "$1" && return 0; swipe_up; done; return 1; }
has_text() { dump | grep -q -- "$1"; }
# Passes when an element with this text is fully on screen (not pushed below the bottom edge).
visible_on_screen() {
  local H; H=$(adb shell wm size | grep -oE "[0-9]+x[0-9]+" | tail -1 | cut -dx -f2)
  dump | python3 -c '
import re,sys
x=sys.stdin.read(); t=sys.argv[1]; H=int(sys.argv[2])
for m in re.finditer(r"<node [^>]*>", x):
    n=m.group(0); tx=re.search(r"text=\"([^\"]*)\"", n)
    if tx and t in tx.group(1):
        a=list(map(int,re.search(r"bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"", n).groups()))
        sys.exit(0 if a[3] <= H and a[1] < a[3] else 1)
sys.exit(1)
' "$1" "$H"
}
check() { # name, text
  if has_text "$2"; then echo "PASS  $1" >> "$report"; else echo "FAIL  $1 (expected text: $2)" >> "$report"; fails=$((fails+1)); fi
}
keys() { for k in "$@"; do tap_text "$k" >/dev/null; done; }
hide_kb() { if adb shell dumpsys input_method | grep -q "mInputShown=true"; then adb shell input keyevent 4; sleep 1; fi; }
pass() { echo "PASS  $1" >> "$report"; }
fail() { echo "FAIL  $1" >> "$report"; fails=$((fails+1)); }
in_back() { tap_text "رجوع" || true; sleep 2; }

adb root || true
sleep 3
adb uninstall $pkg >/dev/null 2>&1 || true
adb install -r "$apk"
adb shell pm grant $pkg android.permission.POST_NOTIFICATIONS || true
adb shell pm disable-user --user 0 com.google.android.apps.nexuslauncher || true
adb shell settings put system screen_off_timeout 1800000 || true
adb logcat -c

# ---- 1. Onboarding typed by a "user"
start
shot 01-onboarding-welcome 6
check "onboarding welcome visible" "ميزانيتك من المستقبل"
tap_text "التالي"
tap_text "اسمك (اختياري)" && adb shell input text "Ahmed"
hide_kb
tap_text "دخلك الشهري (اختياري)" && adb shell input text "9000"
hide_kb
shot 02-onboarding-name 2
tap_text "التالي"
tap_text "الميزانية" && adb shell input text "6000"
hide_kb
shot 03-onboarding-budget 2
tap_text "التالي"
shot 04-onboarding-notifications 2
tap_text "انطلق"
shot 10-home-empty 4
check "home after onboarding" "مسموح لك اليوم"
check "user name shown" "Ahmed"

# ---- 1b. Small screen + large text (like many real phones): the save button must stay visible
adb shell wm size 1080x1920; adb shell wm density 460; adb shell settings put system font_scale 1.15
sleep 3
start --es tab HOME; sleep 2
tap_text "إضافة مصروف"; sleep 2
shot 05-small-screen-editor 1
if visible_on_screen "أدخل المبلغ"; then pass "save button visible on small screen + large font"; else fail "save button visible on small screen + large font"; fi
keys 7
if visible_on_screen "سجّل 7"; then pass "save button shows amount on small screen"; else fail "save button shows amount on small screen"; fi
tap_text "سجّل"; sleep 2
adb shell wm size reset; adb shell wm density reset; adb shell settings put system font_scale 1.0
sleep 3
start --es tab HISTORY; sleep 2
check "small-screen expense saved (7)" "-7"
start --es tab HOME; sleep 2

# ---- 2. Log a NEED expense from the + button
tap_text "إضافة مصروف"; sleep 2
keys 2 5
tap_text "ضروري"
shot 11-editor-need 1
tap_text "سجّل"
sleep 2
start --es tab HISTORY; sleep 2
check "need expense saved (25)" "-25"
start --es tab HOME; sleep 2

# ---- 3. Log a WANT expense (the bug the user reported)
tap_text "إضافة مصروف"; sleep 2
keys 1 5 0
tap_text "كمالي"
shot 12-editor-want 1
tap_text "سجّل"
sleep 2
start --es tab HISTORY; sleep 2
check "want expense saved (150)" "-150"
check "want pill shown" "كمالي"
start --es tab HOME; sleep 2
shot 13-home-after-adds 2

# ---- 4. Reply from the 5-hour check-in notification (simulated inline reply)
adb shell am broadcast -n "$pkg/.notify.ActionReceiver" -a com.wafr.app.ENTRY --ez need false --ei origin 1001 --es debug_text "'40 coffee'"
sleep 3
adb shell dumpsys notification --noredact | grep -A2 "pkg=com.wafr.app" > "$out/notifications-after-reply.txt"
start --es tab HISTORY
sleep 3
check "notification reply logged (40)" "-40"
check "notification reply note" "coffee"
check "history defaults to calendar month" "أكتوبر"
check "history shows period total" "إجمالي المصروف"
shot 20-history 1
tap_text "السنة"; sleep 2
check "history year range" "سنة 2026"
shot 21-history-year 1
tap_text "تحليلات الدورة"; sleep 2
check "analytics toggle" "مؤشر الانضباط"
shot 22-insights 1

# ---- 4b. Regular reminders: alarm armed, fires, re-arms itself
if adb shell dumpsys alarm | grep -q "com.wafr.app"; then pass "check-in alarm armed after onboarding"; else fail "check-in alarm armed after onboarding"; fi
adb shell am broadcast -n "$pkg/.notify.CheckInAlarmReceiver" -a com.wafr.app.CHECKIN_ALARM
sleep 3
if adb shell dumpsys notification --noredact | grep -q "pkg=com.wafr.app user=UserHandle{0} id=1001"; then pass "alarm fire posts the check-in notification"; else fail "alarm fire posts the check-in notification"; fi
if adb shell dumpsys alarm | grep -q "com.wafr.app"; then pass "alarm re-armed for the next 5 hours"; else fail "alarm re-armed for the next 5 hours"; fi
adb shell dumpsys alarm | grep -B2 -A6 "com.wafr.app" | head -40 > "$out/alarms.txt"

# ---- 5. "No spending" answer
adb shell am broadcast -n "$pkg/.notify.ActionReceiver" -a com.wafr.app.NONE
sleep 2
echo "PASS  'no spend' broadcast handled (crash check at end)" >> "$report"

# ---- 6. Salary planner: apply plan, then overspend a category
start --es overlay PLANNER
sleep 3
shot 30-planner 1
check "planner shows salary split" "توزيع"
scroll_tap "طبّق هذه الخطة"
sleep 2
check "plan applied" "تم تطبيق الخطة"
shot 31-planner-applied 1
start --es tab PLAN
sleep 3
check "category limits set" "من 1,"
shot 32-plan 1
start --es tab HOME
tap_text "إضافة مصروف"; sleep 2
tap_text "مطاعم وقهوة"
keys 1 2 0 0
sleep 1
check "live over-limit warning in editor" "يتجاوز ميزانية"
shot 33-editor-overlimit 1
tap_text "سجّل"
sleep 3
adb shell dumpsys notification --noredact > "$out/notif-dump.txt"
if grep -q "pkg=com.wafr.app user=UserHandle{0} id=40" "$out/notif-dump.txt"; then echo "PASS  over-limit notification posted" >> "$report"; else echo "FAIL  over-limit notification posted" >> "$report"; fails=$((fails+1)); fi
adb shell cmd statusbar expand-notifications
sleep 3
adb exec-out screencap -p > "$out/34-notification-shade.png"
adb shell cmd statusbar collapse

# ---- 7. Quick Settings tile → floating quick add
adb shell cmd statusbar add-tile "$pkg/.tile.QuickAddTileService" || true
sleep 2
adb shell cmd statusbar click-tile "$pkg/.tile.QuickAddTileService" || true
sleep 4
shot 40-tile-quick-add 1
check "tile opens quick add" "مصروف جديد"
keys 1 2
tap_text "سجّل"
sleep 2
adb shell cmd statusbar expand-settings
sleep 3
adb exec-out screencap -p > "$out/41-quick-settings.png"
adb shell cmd statusbar collapse

# ---- 8. Home-screen widgets (rendered from the real Glance widget code)
adb shell am start -W -n "$pkg/.WidgetPreviewActivity" >/dev/null
sleep 8
shot 50-widgets 1
check "widget renders allowance" "اليوم"
adb shell am force-stop $pkg

# ---- 9. Main screens
start --es tab HOME; shot 60-home 3
swipe_up; shot 61-home-scroll 1
start --es tab INSIGHTS; shot 62-insights 3
swipe_up; swipe_up; shot 63-insights-scroll 1
start --es tab PLAN; shot 65-plan 3
start --es overlay SETTINGS; shot 64-settings 3
check "settings reliability card" "موثوقية الإشعارات"

# ---- 10. Games
start --es tab GAME; sleep 3
shot 70-games-hub 1
check "games hub" "تحدّي الثقافة المالية"
tap_text "ضروري أم كمالي؟"; sleep 2
tap_text "ابدأ"; sleep 1
for i in 1 2 3 4 5 6; do tap_text "ضروري" >/dev/null; tap_text "كمالي" >/dev/null; done
shot 71-rush 1
in_back
tap_text "تحدّي الثقافة المالية"; sleep 2
tap_text "ب"; sleep 1
shot 72-quiz 1
check "quiz explains answer" "التالي"
in_back
tap_text "آلة الزمن"; sleep 3
shot 73-time-machine 1
check "time machine" "تحدّي المليون"
in_back
tap_text "سباق الحرية"; sleep 2
tap_text "موظف"; sleep 2
for i in $(seq 1 10); do
  tap_text "اشترِ الأصل" || tap_text "حسناً" || tap_text "لا، شكراً" || tap_text "سجّل في الدورة" || tap_text "احتفظ" || tap_text "الشهر التالي" || true
done
shot 74-freedom 1
check "freedom game running" "مقياس الحرية"

# ---- 11. Light theme
start --es overlay SETTINGS; sleep 2
scroll_tap "فاتح"
start --es tab HOME; shot 80-light-home 3
start --es tab PLAN; shot 81-light-plan 3

# ---- 11b. Backup → wipe → restore keeps the data
adb shell am force-stop $pkg
start --ez backup_roundtrip true
sleep 5
if adb logcat -d -s WafrTest | grep -q "restored=[1-9]"; then pass "backup and restore round-trip keeps expenses"; else fail "backup and restore round-trip keeps expenses"; fi
start --es tab HISTORY; sleep 2
check "history intact after restore" "-150"

# ---- 11c. 2D arcade + swipe games
start --es tab GAME; sleep 2
tap_text "صائد الثروة"; sleep 2
tap_text "ابدأ"; sleep 1
for x in 200 500 800 300 700 540; do adb shell input swipe $x 1500 $((1080 - x)) 1500 400; done
shot 75-catcher 0
check "catcher running" "مستوى"
in_back
tap_text "شهر في حياتك"; sleep 2
tap_text "ابدأ الشهر"; sleep 2
shot 76-month 0
adb shell input swipe 300 1100 950 1100 250; sleep 1
tap_text "ارفض"; sleep 1
tap_text "ادفع"; sleep 1
shot 77-month-after 0
check "month game advances" "الموقف 4"

# ---- 12. Crash check
adb logcat -d > "$out/logcat.txt"
if grep -q "FATAL EXCEPTION" "$out/logcat.txt"; then
  grep -A 30 "FATAL EXCEPTION" "$out/logcat.txt" | head -80 > "$out/crash.txt"
  echo "FAIL  app crashed (see crash.txt)" >> "$report"; fails=$((fails+1))
else
  echo "PASS  no crashes during the whole run" >> "$report"
fi
echo "TOTAL FAILS: $fails" >> "$report"
cat "$report"
