#!/usr/bin/env bash
# Runs inside the emulator job: installs the debug APK, walks through the app and captures every screen.
set -x
out="$1"
mkdir -p "$out"
pkg=com.wafr.app
apk=app/build/outputs/apk/debug/app-debug.apk

shot() {
  sleep "${2:-4}"
  adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS >/dev/null 2>&1 || true
  adb exec-out screencap -p > "$out/$1.png"
}
start() { adb shell am start -W -n "$pkg/.MainActivity" "$@" >/dev/null; }
swipe_up() { adb shell input swipe 540 1900 540 700 400; }
# Taps the first on-screen element whose text contains $1 (via a uiautomator dump).
tap_text() {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  local xy
  xy=$(adb exec-out cat /sdcard/ui.xml | python3 -c '
import re,sys
x=sys.stdin.read(); t=sys.argv[1]
nodes=[]
for m in re.finditer(r"<node [^>]*>", x):
    n=m.group(0); tx=re.search(r"(?:text|content-desc)=\"([^\"]*)\"", n)
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
sleep 3
adb uninstall $pkg >/dev/null 2>&1 || true
adb install -r "$apk"
adb shell pm grant $pkg android.permission.POST_NOTIFICATIONS || true
adb shell pm disable-user --user 0 com.google.android.apps.nexuslauncher || true
adb shell settings put system screen_off_timeout 1800000 || true

# 1. Onboarding
start
shot 01-onboarding-welcome 7
tap_text "التالي"; shot 02-onboarding-name 3
tap_text "التالي"; shot 03-onboarding-budget 3
tap_text "التالي"; shot 04-onboarding-notifications 3

# 2. Seed a realistic month and open the app
adb shell am force-stop $pkg
start --ez demo true
sleep 8
adb shell am force-stop $pkg
start
shot 10-home 6
swipe_up; shot 11-home-scroll 3
swipe_up; shot 12-home-scroll2 3

start --es tab INSIGHTS; shot 20-insights 5
swipe_up; shot 21-insights-scroll 3
swipe_up; shot 22-insights-scroll2 3
swipe_up; shot 23-insights-achievements 3

start --es tab PLAN; shot 30-plan 5
swipe_up; shot 31-plan-scroll 3
swipe_up; shot 32-plan-scroll2 3

start --es overlay PLANNER; shot 40-planner 5
swipe_up; shot 41-planner-scroll 3
swipe_up; shot 42-planner-scroll2 3
swipe_up; shot 43-planner-scroll3 3

start --es tab GAME; shot 50-game 5
tap_text "موظف"; shot 51-game-card 4
tap_text "اشترِ الأصل" || tap_text "حسناً" || tap_text "لا، شكراً"; shot 52-game-after 3

start --es overlay SETTINGS; shot 60-settings 5
swipe_up; shot 61-settings-scroll 3

start --es overlay HISTORY; shot 65-history 5

# 3. Add expense sheet with a live category warning
adb shell am force-stop $pkg
adb shell am start -W -a com.wafr.app.ADD -n "$pkg/.MainActivity" >/dev/null
sleep 4
tap_text "تسوق وملابس"
for k in 9 0 0; do tap_text "$k"; done
shot 70-add-expense 3

# 4. Floating quick-add (tile / widget target)
adb shell am force-stop $pkg
adb shell am start -W -n "$pkg/.QuickAddActivity" >/dev/null
shot 71-quick-add 5

# 5. Notifications: 5-hour check-in + status
adb shell am force-stop $pkg
start --ez notify true
sleep 4
adb shell cmd statusbar expand-notifications
shot 80-notification-shade 4
adb shell cmd statusbar collapse

# 6. Light theme
adb shell am force-stop $pkg
adb shell "run-as $pkg ls files/datastore" || true
echo done
