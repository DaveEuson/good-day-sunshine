#!/usr/bin/env bash
# Full-screen dashboard on a Raspberry Pi 5 / Jetson / any Linux box with a display.
# Usage:  scripts/kiosk.sh http://<dashboard-host>:4242 [tv|small] [user]
# Install as a user service so it starts on boot:
#   mkdir -p ~/.config/systemd/user && cp scripts/kiosk.service ~/.config/systemd/user/ && \
#   systemctl --user enable --now kiosk && loginctl enable-linger $USER
set -eu
HOST="${1:-http://localhost:4242}"
MODE="${2:-tv}"
USER_NAME="${3:-dave}"
URL="$HOST/?u=$USER_NAME&mode=$MODE"

# keep the panel awake; quiet hours are handled by the page itself
command -v xset >/dev/null && { xset s off; xset -dpms; xset s noblank; } || true
# Wayland (Pi OS Bookworm): wlr-randr / swayidle not needed, the page dims itself

BROWSER=$(command -v chromium-browser || command -v chromium || command -v google-chrome || echo "")
[ -z "$BROWSER" ] && { echo "install chromium: sudo apt install -y chromium-browser"; exit 1; }

exec "$BROWSER" --kiosk --noerrdialogs --disable-infobars --no-first-run \
  --disable-session-crashed-bubble --overscroll-history-navigation=0 \
  --autoplay-policy=no-user-gesture-required --check-for-update-interval=31536000 \
  --enable-features=OverlayScrollbar "$URL"
