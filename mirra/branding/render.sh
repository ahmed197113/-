#!/bin/sh
# usage: render.sh in.svg out.png size
d=$(mktemp -d)
printf '<html><body style="margin:0;background:transparent"><img src="file://%s" style="width:%spx;height:%spx;display:block"></body></html>' "$(realpath "$1")" "$3" "$3" > $d/i.html
$(ls /opt/pw-browsers/chromium_headless_shell-1194/*/headless_shell) --headless --no-sandbox --disable-gpu --hide-scrollbars --allow-file-access-from-files --default-background-color=00000000 --window-size=$3,$3 --screenshot="$(realpath -m "$2")" file://$d/i.html >/dev/null 2>&1
rm -rf $d
