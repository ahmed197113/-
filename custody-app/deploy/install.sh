#!/usr/bin/env bash
# تثبيت خادم نظام إدارة العهد على خادم Ubuntu (22.04 أو أحدث) بأمر واحد:
#   curl -fsSL https://raw.githubusercontent.com/ahmed197113/-/ccr-60d78cf9-33quzo/custody-app/deploy/install.sh | sudo bash -s custody.metal-lines.com
# يثبّت: Node.js 20، التطبيق كخدمة تعمل تلقائياً، Caddy مع شهادة HTTPS مجانية، ونسخة احتياطية يومية.
set -euo pipefail

DOMAIN="${1:-}"
REPO="https://github.com/ahmed197113/-.git"
BRANCH="${BRANCH:-ccr-60d78cf9-33quzo}"
APP_DIR=/opt/custody
DATA_DIR=/var/lib/custody
BACKUP_DIR=/var/backups/custody

if [ -z "$DOMAIN" ]; then
  echo "الاستخدام: sudo bash install.sh <النطاق>   مثال: sudo bash install.sh custody.metal-lines.com" >&2
  exit 1
fi
if [ "$(id -u)" -ne 0 ]; then echo "شغّل السكربت بصلاحية root (sudo)" >&2; exit 1; fi

echo "==> تثبيت المتطلبات"
apt-get update -y
apt-get install -y curl git ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "==> تنزيل التطبيق"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch --depth 1 origin "$BRANCH" && git -C "$APP_DIR" reset --hard "origin/$BRANCH"
else
  git clone --depth 1 --branch "$BRANCH" "$REPO" "$APP_DIR"
fi

id custody >/dev/null 2>&1 || useradd --system --home "$DATA_DIR" --shell /usr/sbin/nologin custody
mkdir -p "$DATA_DIR" "$BACKUP_DIR"
chown -R custody:custody "$DATA_DIR"

echo "==> تشغيل التطبيق كخدمة"
cat > /etc/systemd/system/custody.service <<EOF
[Unit]
Description=Metal Lines custody management
After=network.target

[Service]
User=custody
Environment=PORT=3000
Environment=DATA_DIR=$DATA_DIR
WorkingDirectory=$APP_DIR/custody-app
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now custody
systemctl restart custody

echo "==> تثبيت Caddy وشهادة HTTPS"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y && apt-get install -y caddy
fi
cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
  encode gzip
  request_body {
    max_size 25MB
  }
  reverse_proxy localhost:3000
}
EOF
systemctl reload caddy || systemctl restart caddy

if command -v ufw >/dev/null && ufw status | grep -q active; then ufw allow 80/tcp; ufw allow 443/tcp; fi

echo "==> نسخة احتياطية يومية (تُحفظ آخر 30 نسخة)"
cat > /etc/cron.daily/custody-backup <<EOF
#!/bin/sh
tar -czf $BACKUP_DIR/custody-\$(date +%F).tar.gz -C $DATA_DIR .
ls -1t $BACKUP_DIR/custody-*.tar.gz | tail -n +31 | xargs -r rm --
EOF
chmod +x /etc/cron.daily/custody-backup

sleep 2
if curl -fs http://localhost:3000/api/status >/dev/null; then
  echo
  echo "✅ تم التثبيت. افتح https://$DOMAIN لإنشاء حساب المدير، وفي تطبيق الجوال اختر «الربط بخادم الشركة» واكتب: https://$DOMAIN"
else
  echo "⚠️ الخدمة لم تستجب بعد. راجع السجل: journalctl -u custody -n 50" >&2
  exit 1
fi
